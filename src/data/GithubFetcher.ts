import type { GitData, CommitData, GitEvent, CommitType } from './types'

const API_BASE = 'https://api.github.com'
const MAX_DETAIL_COMMITS = 50

const TYPE_PATTERNS: { type: CommitType; pattern: RegExp }[] = [
  { type: 'merge', pattern: /\bmerge\b/i },
  { type: 'bug', pattern: /\b(fix|bug|hotfix|patch|resolve|close[sd]?|fixes|fixed|repair|workaround)\b/i },
  { type: 'test', pattern: /\btest(s|ing)?\b/i },
  { type: 'docs', pattern: /\bdocs?\b/i },
  { type: 'style', pattern: /\bstyle\b/i },
  { type: 'refactor', pattern: /\brefactor(ing)?\b/i },
  { type: 'chore', pattern: /\b(chore|build|ci|bump|release|version|upgrade|update dep)\b/i },
  { type: 'feature', pattern: /\b(feat|feature|add|new|implement|support)\b/i },
]

function classifyCommit(message: string): CommitType {
  for (const { type, pattern } of TYPE_PATTERNS) {
    if (pattern.test(message)) return type
  }
  return 'chore'
}

interface GithubCommitSummary {
  sha: string
  commit: {
    author: { name: string; date: string }
    message: string
  }
  parents: { sha: string }[]
}

interface GithubCommitDetail {
  sha: string
  commit: {
    author: { name: string; date: string }
    message: string
  }
  parents: { sha: string }[]
  stats: { additions: number; deletions: number }
  files: { filename: string }[]
}

interface GithubBranch {
  name: string
}

interface GithubTag {
  name: string
  commit: { sha: string }
}

interface GithubRepo {
  full_name: string
  name: string
}

export class GithubFetcher {
  private async get<T>(path: string): Promise<T> {
    const url = `${API_BASE}${path}`
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
    })

    if (res.status === 404) {
      throw new Error(`Repository not found: ${path}`)
    }
    if (res.status === 403) {
      const remaining = res.headers.get('x-ratelimit-remaining')
      if (remaining === '0') {
        const reset = res.headers.get('x-ratelimit-reset')
        const resetTime = reset ? new Date(Number(reset) * 1000).toLocaleTimeString() : 'unknown'
        throw new Error(`GitHub API rate limit exceeded. Resets at ${resetTime}.`)
      }
      throw new Error('GitHub API access forbidden.')
    }
    if (!res.ok) {
      throw new Error(`GitHub API error ${res.status}: ${res.statusText}`)
    }

    return res.json() as Promise<T>
  }

  async fetch(repoSlug: string, onProgress?: (msg: string) => void): Promise<GitData> {
    const progress = (msg: string) => onProgress?.(msg)

    const [owner, repo] = repoSlug.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repo slug "${repoSlug}". Expected format: owner/repo`)
    }

    // 1. Repo info
    progress('Fetching repository info...')
    const repoInfo = await this.get<GithubRepo>(`/repos/${owner}/${repo}`)

    // 2. Commit list (up to 100)
    progress('Loading commits...')
    const commitSummaries = await this.get<GithubCommitSummary[]>(
      `/repos/${owner}/${repo}/commits?per_page=100`
    )

    // 3. Fetch detail for up to MAX_DETAIL_COMMITS commits
    const detailCount = Math.min(commitSummaries.length, MAX_DETAIL_COMMITS)
    const commits: CommitData[] = []

    for (let i = 0; i < detailCount; i++) {
      progress(`Loading commits (${i + 1}/${detailCount})...`)
      const summary = commitSummaries[i]
      const isMergeByParents = summary.parents.length >= 2

      let insertions = 0
      let deletions = 0
      let files: string[] = []

      try {
        const detail = await this.get<GithubCommitDetail>(
          `/repos/${owner}/${repo}/commits/${summary.sha}`
        )
        insertions = detail.stats?.additions ?? 0
        deletions = detail.stats?.deletions ?? 0
        files = (detail.files ?? []).map(f => f.filename)
      } catch {
        // If detail fetch fails (e.g. secondary rate limit), use summary data
        files = []
      }

      const message = summary.commit.message.split('\n')[0]
      const type = isMergeByParents ? 'merge' : classifyCommit(message)

      commits.push({
        sha: summary.sha,
        shortSha: summary.sha.slice(0, 7),
        author: summary.commit.author.name,
        message,
        date: summary.commit.author.date,
        files,
        diff: '',
        isBug: type === 'bug',
        type,
        insertions,
        deletions,
        codeConstructs: [],
        isMerge: isMergeByParents,
      })
    }

    // For remaining commits beyond MAX_DETAIL_COMMITS, add without detail
    for (let i = detailCount; i < commitSummaries.length; i++) {
      const summary = commitSummaries[i]
      const isMergeByParents = summary.parents.length >= 2
      const message = summary.commit.message.split('\n')[0]
      const type = isMergeByParents ? 'merge' : classifyCommit(message)

      commits.push({
        sha: summary.sha,
        shortSha: summary.sha.slice(0, 7),
        author: summary.commit.author.name,
        message,
        date: summary.commit.author.date,
        files: [],
        diff: '',
        isBug: type === 'bug',
        type,
        insertions: 0,
        deletions: 0,
        codeConstructs: [],
        isMerge: isMergeByParents,
      })
    }

    // 4. Branches
    progress('Fetching branches...')
    const branchData = await this.get<GithubBranch[]>(
      `/repos/${owner}/${repo}/branches?per_page=100`
    )
    const branches = branchData.map(b => b.name)

    // 5. Tags
    progress('Fetching tags...')
    const tagData = await this.get<GithubTag[]>(
      `/repos/${owner}/${repo}/tags?per_page=100`
    )
    const tags = tagData.map(t => t.name)

    // 6. Generate GitEvents from merges and tags
    const events: GitEvent[] = []

    for (const commit of commits) {
      if (commit.isMerge) {
        events.push({
          type: 'merge',
          label: 'Merge',
          detail: commit.message,
          timestamp: commit.date,
        })
      }
    }

    for (let i = 0; i < tagData.length; i++) {
      const tag = tagData[i]
      // Find the commit this tag points to
      const taggedCommit = commits.find(c => c.sha === tag.commit.sha)
      const timestamp = taggedCommit?.date ?? new Date().toISOString()
      events.push({
        type: 'tag',
        label: tag.name,
        detail: `Tag: ${tag.name}`,
        timestamp,
      })
    }

    // Sort events by timestamp descending (most recent first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const bugCommits = commits.filter(c => c.isBug)
    const codeCommits = commits.filter(c => !c.isBug)

    progress(`Done! ${commits.length} commits loaded`)

    return {
      repoName: repoInfo.full_name,
      totalCommits: commits.length,
      commits,
      bugCommits,
      codeCommits,
      events,
      branches,
      tags,
    }
  }
}
