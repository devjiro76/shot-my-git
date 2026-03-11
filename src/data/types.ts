export type CommitType = 'bug' | 'feature' | 'refactor' | 'merge' | 'chore' | 'docs' | 'style' | 'test'
export type BossTier = 'MINI' | 'NORMAL' | 'ELITE' | 'MEGA'

export interface CommitData {
  sha: string
  shortSha: string
  author: string
  message: string
  date: string
  files: string[]
  diff: string
  isBug: boolean
  type: CommitType
  insertions: number
  deletions: number
  codeConstructs: string[]  // extracted function/class/variable names
  isMerge: boolean
}

export interface GitEvent {
  type: 'merge' | 'branch' | 'tag' | 'stash'
  label: string
  detail: string
  timestamp: string
}

export interface GitData {
  repoName: string
  totalCommits: number
  commits: CommitData[]
  bugCommits: CommitData[]
  codeCommits: CommitData[]
  events: GitEvent[]
  branches: string[]
  tags: string[]
}

export type GameState = 'LOADING' | 'INTRO' | 'PLAYING' | 'WAVE_CLEAR' | 'GAME_OVER'
