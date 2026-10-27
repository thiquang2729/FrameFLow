const { spawnSync } = require('node:child_process')
const path = require('node:path')
const electron = require('electron')
const script = path.join(__dirname, 'electron-review-smoke.cjs')
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
delete env.FRAMEFLOW_SMOKE_REOPEN

const first = spawnSync(electron, [script], { env, encoding: 'utf8', timeout: 100000 })
process.stdout.write(first.stdout || '')
process.stderr.write(first.stderr || '')
if (first.status !== 0) process.exit(first.status || 1)
const match = first.stdout.match(/"artifacts":\s*"([^"]+)"/)
if (!match) throw new Error('Smoke test did not return its isolated project directory')
const root = JSON.parse(`"${match[1]}"`)
const second = spawnSync(electron, [script], { env: { ...env, FRAMEFLOW_SMOKE_REOPEN: root }, encoding: 'utf8', timeout: 100000 })
process.stdout.write(second.stdout || '')
process.stderr.write(second.stderr || '')
process.exit(second.status === 0 ? 0 : 1)
