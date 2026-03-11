import type { GitData, CommitData } from './types'

export class GitDataLoader {
  private data: GitData | null = null

  async load(url = './git-data.json'): Promise<GitData> {
    const res = await fetch(url)
    const raw = await res.json()

    const commits: CommitData[] = (raw.commits ?? []).map((c: Record<string, unknown>) => ({
      sha: c.sha ?? '',
      shortSha: c.shortSha ?? '',
      author: c.author ?? '',
      message: c.message ?? '',
      date: c.date ?? '',
      files: c.files ?? [],
      diff: c.diff ?? '',
      isBug: c.isBug ?? false,
      type: c.type ?? 'chore',
      insertions: c.insertions ?? 0,
      deletions: c.deletions ?? 0,
      codeConstructs: c.codeConstructs ?? [],
      isMerge: c.isMerge ?? false,
    }))

    const bugCommits = commits.filter(c => c.isBug)
    const codeCommits = commits.filter(c => !c.isBug)

    this.data = {
      repoName: raw.repoName ?? 'unknown',
      totalCommits: commits.length,
      commits,
      bugCommits,
      codeCommits,
      events: raw.events ?? [],
      branches: raw.branches ?? [],
      tags: raw.tags ?? [],
    }

    return this.data
  }

  getData(): GitData {
    return this.data!
  }
}
