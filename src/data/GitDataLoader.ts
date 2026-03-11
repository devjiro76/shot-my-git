import type { GitData, CommitData } from './types'

export class GitDataLoader {
  private data: GitData | null = null

  parseRaw(raw: Record<string, unknown>): GitData {
    return this._parse(raw)
  }

  async load(url = './git-data.json'): Promise<GitData> {
    const res = await fetch(url)
    const raw = await res.json()
    return this._parse(raw)
  }

  private _parse(raw: Record<string, unknown>): GitData {
    const commits: CommitData[] = ((raw.commits ?? []) as Record<string, unknown>[]).map((c: Record<string, unknown>) => ({
      sha: (c.sha as string) ?? '',
      shortSha: (c.shortSha as string) ?? '',
      author: (c.author as string) ?? '',
      message: (c.message as string) ?? '',
      date: (c.date as string) ?? '',
      files: (c.files as string[]) ?? [],
      diff: (c.diff as string) ?? '',
      isBug: (c.isBug as boolean) ?? false,
      type: (c.type as CommitData['type']) ?? 'chore',
      insertions: (c.insertions as number) ?? 0,
      deletions: (c.deletions as number) ?? 0,
      codeConstructs: (c.codeConstructs as string[]) ?? [],
      isMerge: (c.isMerge as boolean) ?? false,
    }))

    const bugCommits = commits.filter(c => c.isBug)
    const codeCommits = commits.filter(c => !c.isBug)

    this.data = {
      repoName: (raw.repoName as string) ?? 'unknown',
      totalCommits: commits.length,
      commits,
      bugCommits,
      codeCommits,
      events: (raw.events ?? []) as GitData['events'],
      branches: (raw.branches ?? []) as string[],
      tags: (raw.tags ?? []) as string[],
    }

    return this.data
  }

  getData(): GitData {
    return this.data!
  }
}
