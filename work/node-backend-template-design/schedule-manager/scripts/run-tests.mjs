#!/usr/bin/env node
/**
 * Runs every `*.test.ts` under `tests/` using the spec reporter.
 * Prints margins + divider lines so results are easier to scan than raw TAP
 * (ANSI when stdout is a TTY; plain ASCII otherwise — e.g. CI logs).
 * After each top-level `· unit` suite block in spec output, inserts a blank line for readability.
 *
 * Extra CLI args are forwarded (e.g. `npm test -- --test-only`).
 */
import { spawnSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

async function collectTestFiles(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await collectTestFiles(full, acc)
    else if (e.isFile() && e.name.endsWith('.test.ts')) acc.push(full)
  }
  return acc
}

const tty = process.stdout.isTTY

/** Strip SGR codes so we can match spec reporter lines when color is enabled. */
function stripAnsi(s) {
  return s.replace(/\u001b\[[0-9;]*m/g, '')
}

/**
 * Insert a blank line after each top-level module suite (`describe('@/… · unit')`).
 * Spec completes those blocks with a line like `✔ @/path · unit (1.2ms)`.
 */
function addSpacingAfterModuleSuites(text) {
  const lines = text.split('\n')
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    out.push(line)
    const plain = stripAnsi(line.replace(/\r$/, ''))
    const isModuleSuiteEnd = /^(✔|✖) @\/.+· unit \([\d.]+ms\)$/.test(plain)
    if (isModuleSuiteEnd) {
      const next = lines[i + 1]
      if (next !== undefined && next.trim() !== '') {
        out.push('')
      }
    }
  }
  return out.join('\n')
}

function ansi(code, text) {
  return tty ? `\u001b[${code}m${text}\u001b[0m` : text
}

function divider() {
  const line = (tty ? '─' : '-').repeat(58)
  return ansi(90, line)
}

function printHeader() {
  console.log('')
  console.log(divider())
  if (tty) {
    console.log(`  ${ansi(1, 'schedule-manager')}${ansi(2, ' · unit tests')}`)
  } else {
    console.log('  schedule-manager · unit tests')
  }
  console.log(divider())
  console.log('')
}

function printFooter(exitCode) {
  const ok = exitCode === 0
  console.log('')
  console.log(divider())
  if (tty) {
    const label = ok ? ansi(32, 'pass') : ansi(31, 'fail')
    console.log(`  ${label}${ansi(2, ` · exit ${exitCode}`)}`)
  } else {
    console.log(`  ${ok ? 'pass' : 'fail'} · exit ${exitCode}`)
  }
  console.log(divider())
  console.log('')
}

const testsDir = path.join(projectRoot, 'tests')
const files = (await collectTestFiles(testsDir)).sort((a, b) => a.localeCompare(b))

if (files.length === 0) {
  console.error('No *.test.ts files found under tests/')
  process.exit(1)
}

const tsxCli = path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')

/** Same default as `core/env/bootstrap.ts` so tests agree with `mysqlWallToDate` + `formatMysql`. */
const resolvedSiteTz =
  process.env.CCL_SITE_TIMEZONE !== undefined && String(process.env.CCL_SITE_TIMEZONE).trim() !== ''
    ? String(process.env.CCL_SITE_TIMEZONE).trim()
    : 'Europe/Dublin'

printHeader()

const child = spawnSync(
  process.execPath,
  [tsxCli, '--test', '--test-reporter=spec', ...files, ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      TZ: resolvedSiteTz,
      CCL_SITE_TIMEZONE: resolvedSiteTz,
      ...(tty ? { FORCE_COLOR: process.env.FORCE_COLOR ?? '1' } : {}),
    },
  },
)

if (child.stdout) {
  process.stdout.write(addSpacingAfterModuleSuites(child.stdout))
}
if (child.stderr) {
  process.stderr.write(child.stderr)
}

const code = child.status ?? 1
printFooter(code)
process.exit(code)
