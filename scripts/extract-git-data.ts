import simpleGit from 'simple-git'
import { writeFileSync } from 'fs'
import { basename, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ── Commit type classification ──────────────────────────────────────────────

const TYPE_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
  { type: 'merge',    pattern: /^merge\b/i },
  { type: 'bug',      pattern: /^(fix|bug|hotfix|patch|resolve|close[sd]?|fixes)\b[\s(:]/i },
  { type: 'test',     pattern: /^test\b[\s(:]/i },
  { type: 'docs',     pattern: /^docs?\b[\s(:]/i },
  { type: 'style',    pattern: /^style\b[\s(:]/i },
  { type: 'refactor', pattern: /^refactor\b[\s(:]/i },
  { type: 'chore',    pattern: /^(chore|build|ci|bump|release|version)\b[\s(:]/i },
  { type: 'feature',  pattern: /^(feat|feature|add|new|implement)\b[\s(:]/i },
]

function classifyCommit(message: string, isMerge: boolean): string {
  if (isMerge) return 'merge'
  const first = message.split('\n')[0].trim()
  for (const { type, pattern } of TYPE_PATTERNS) {
    if (pattern.test(first)) return type
  }
  return 'chore'
}

// ── Code construct extraction ────────────────────────────────────────────────

const CONSTRUCT_PATTERNS: RegExp[] = [
  /\bfunction\s+(\w+)/g,
  /\bclass\s+(\w+)/g,
  /\binterface\s+(\w+)/g,
  /\btype\s+(\w+)\s*=/g,
  /\bconst\s+(\w+)\s*=/g,
  /\blet\s+(\w+)\s*=/g,
  /\bvar\s+(\w+)\s*=/g,
  /\bdef\s+(\w+)\s*\(/g,
  /\basync\s+function\s+(\w+)/g,
  /\bexport\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g,
  /\bimport\s+.*?\bfrom\s+['"]([^'"]+)['"]/g,
]

function extractCodeConstructs(diff: string): string[] {
  const found = new Set<string>()
  // Only look at added lines (lines starting with +, excluding +++)
  const addedLines = diff
    .split('\n')
    .filter(line => line.startsWith('+') && !line.startsWith('+++'))
    .join('\n')

  for (const pattern of CONSTRUCT_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags)
    let match: RegExpExecArray | null
    while ((match = re.exec(addedLines)) !== null) {
      const name = match[1]
      if (name && name.length > 1 && !/^\d+$/.test(name)) {
        found.add(name)
      }
    }
  }

  return Array.from(found).slice(0, 30) // cap to avoid huge arrays
}

// ── Stat parsing ─────────────────────────────────────────────────────────────

function parseInsertionsDeletions(statOutput: string): { insertions: number; deletions: number } {
  // e.g. "3 files changed, 45 insertions(+), 12 deletions(-)"
  const ins = statOutput.match(/(\d+)\s+insertion/)
  const del = statOutput.match(/(\d+)\s+deletion/)
  return {
    insertions: ins ? parseInt(ins[1], 10) : 0,
    deletions:  del ? parseInt(del[1], 10) : 0,
  }
}

// ── Main extraction ──────────────────────────────────────────────────────────

async function extract(repoPath: string) {
  const absPath = resolve(repoPath)
  const git = simpleGit(absPath)
  const repoName = basename(absPath)

  console.log(`Extracting git data from: ${absPath}`)

  // ── Branches ────────────────────────────────────────────────────────────
  const branchSummary = await git.branch(['-a'])
  const branches = Object.keys(branchSummary.branches)
    .map(b => b.replace(/^remotes\//, '').trim())
    .filter((b, i, arr) => arr.indexOf(b) === i) // dedupe

  console.log(`  Branches: ${branches.length}`)

  // ── Tags ─────────────────────────────────────────────────────────────────
  let tags: string[] = []
  try {
    const tagResult = await git.tags()
    tags = tagResult.all
  } catch {
    tags = []
  }
  console.log(`  Tags: ${tags.length}`)

  // ── Tag → commit map ─────────────────────────────────────────────────────
  const tagCommitMap = new Map<string, string>() // sha -> tag name
  for (const tag of tags) {
    try {
      const sha = (await git.revparse([`${tag}^{}`])).trim()
      tagCommitMap.set(sha, tag)
    } catch {
      try {
        const sha = (await git.revparse([tag])).trim()
        tagCommitMap.set(sha, tag)
      } catch {
        // skip
      }
    }
  }

  // ── Commit log (include merges) ──────────────────────────────────────────
  const log = await git.log({ maxCount: 200 })

  const commits = []
  const events: Array<{
    type: string
    label: string
    detail: string
    timestamp: string
  }> = []

  let processed = 0
  for (const entry of log.all) {
    processed++
    if (processed % 20 === 0) {
      process.stdout.write(`  Processing commits: ${processed}/${log.all.length}\r`)
    }

    // ── Detect merge ───────────────────────────────────────────────────────
    const msgFirstLine = entry.message.split('\n')[0].trim()
    const isMerge = msgFirstLine.toLowerCase().startsWith('merge')

    // ── Diff & stats ───────────────────────────────────────────────────────
    let diff = ''
    let insertions = 0
    let deletions = 0

    try {
      const statOutput = await git.diff([`${entry.hash}~1`, entry.hash, '--stat'])
      const parsed = parseInsertionsDeletions(statOutput)
      insertions = parsed.insertions
      deletions = parsed.deletions
    } catch {
      // first commit or error
    }

    try {
      const patchResult = await git.diff([`${entry.hash}~1`, entry.hash, '-U1'])
      diff = patchResult.slice(0, 1000)
    } catch {
      diff = ''
    }

    // ── Files changed ──────────────────────────────────────────────────────
    const files: string[] = []
    try {
      const showResult = await git.show([entry.hash, '--name-only', '--format='])
      files.push(
        ...showResult
          .split('\n')
          .map(f => f.trim())
          .filter(f => f.length > 0)
      )
    } catch {
      // skip
    }

    // ── Code constructs ────────────────────────────────────────────────────
    const codeConstructs = extractCodeConstructs(diff)

    // ── Classification ─────────────────────────────────────────────────────
    const type = classifyCommit(msgFirstLine, isMerge)
    const isBug = type === 'bug'

    commits.push({
      sha: entry.hash,
      shortSha: entry.hash.slice(0, 7),
      author: entry.author_name,
      message: msgFirstLine,
      date: entry.date,
      files,
      diff,
      isBug,
      type,
      insertions,
      deletions,
      codeConstructs,
      isMerge,
    })

    // ── Events ─────────────────────────────────────────────────────────────
    if (isMerge) {
      events.push({
        type: 'merge',
        label: `Merge: ${msgFirstLine.slice(0, 60)}`,
        detail: entry.hash.slice(0, 7),
        timestamp: entry.date,
      })
    }

    if (tagCommitMap.has(entry.hash)) {
      const tagName = tagCommitMap.get(entry.hash)!
      events.push({
        type: 'tag',
        label: `Tag: ${tagName}`,
        detail: entry.hash.slice(0, 7),
        timestamp: entry.date,
      })
    }
  }

  process.stdout.write('\n')

  // ── Tag events for tags not attached to commits in log ────────────────────
  for (const [sha, tagName] of tagCommitMap.entries()) {
    if (!commits.some(c => c.sha === sha)) {
      events.push({
        type: 'tag',
        label: `Tag: ${tagName}`,
        detail: sha.slice(0, 7),
        timestamp: new Date().toISOString(),
      })
    }
  }

  // ── Sort events by timestamp desc ─────────────────────────────────────────
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const bugCommits = commits.filter(c => c.isBug)
  const codeCommits = commits.filter(c => !c.isMerge)

  const output = {
    repoName,
    totalCommits: commits.length,
    commits,
    bugCommits,
    codeCommits,
    events,
    branches,
    tags,
  }

  const outPath = resolve(__dirname, '..', 'public', 'git-data.json')
  writeFileSync(outPath, JSON.stringify(output, null, 2))

  console.log(`Written ${commits.length} commits to ${outPath}`)
  console.log(`  Bugs:     ${bugCommits.length}`)
  console.log(`  Merges:   ${commits.filter(c => c.isMerge).length}`)
  console.log(`  Features: ${commits.filter(c => c.type === 'feature').length}`)
  console.log(`  Refactor: ${commits.filter(c => c.type === 'refactor').length}`)
  console.log(`  Events:   ${events.length}`)
  console.log(`  Branches: ${branches.length}`)
  console.log(`  Tags:     ${tags.length}`)
}

// ── Entry point ──────────────────────────────────────────────────────────────

const repoArg = process.argv[2]
if (!repoArg) {
  console.error('Usage: npx tsx scripts/extract-git-data.ts <repo-path>')
  process.exit(1)
}

extract(repoArg).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
