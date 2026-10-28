// Parent-owned pipe is a lifetime lease. Even if Electron crashes, EOF stops Go.
const { spawn } = require('node:child_process')
const [binary, config, mode, callbackPort] = process.argv.slice(2)
const args = ['--config', config, '--local-model']
if (mode === 'login') args.push('--antigravity-login', '--no-browser', '--oauth-callback-port', callbackPort)
const env = { ...process.env }
// Do not accidentally inherit CLIProxyAPI cloud/remote credential storage settings.
for (const key of Object.keys(env)) {
  if (/^(HOME_JWT|PGSTORE_|GITSTORE_|OBJECTSTORE_|DEPLOY|MANAGEMENT_PASSWORD)/i.test(key)) delete env[key]
}
const child = spawn(binary, args, { cwd: require('node:path').dirname(config), env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
const emit = (value) => { if (!process.stdout.destroyed) process.stdout.write(JSON.stringify(value) + '\n') }
child.on('spawn', () => emit({ type: 'spawn', pid: child.pid }))
child.on('error', () => { emit({ type: 'error' }); process.exitCode = 1 })
child.on('close', (code) => { emit({ type: 'exit', code }); process.exit(code === 0 ? 0 : 1) })
for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', (bytes) => { if (mode === 'login') emit({ type: 'output', text: bytes.toString('utf8') }) })
}
let stopping = false
function stop() {
  if (stopping) return
  stopping = true
  child.kill()
  setTimeout(() => { child.kill('SIGKILL') }, 2000).unref()
}
process.stdin.resume()
process.stdin.on('end', stop)
process.stdin.on('error', stop)
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
process.stdout.on('error', stop)
