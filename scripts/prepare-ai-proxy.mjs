import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Intentionally pinned: updates require review, never download code at app startup.
const version = '8.0.45'
const hashes = {
  'win32-x64': ['windows_amd64.zip', 'b049739ca8cd1885c59bdf57de6adf12452e9ab9907f50117906c11fadffff1b'],
  'win32-arm64': ['windows_aarch64.zip', 'fa6a61ca6526afde7800c28d3e72819f1b2f3a500dd9b73ee8032c20e16ead14'],
  'darwin-x64': ['darwin_amd64.tar.gz', 'efa1a2a571fe83b87eb30ee8dff538062ac517a81a04dc0d32ca160bb4fa2e5a'],
  'darwin-arm64': ['darwin_aarch64.tar.gz', '30a9cacbeada0a80ad1f40c2c25015244b7f4fbca8c3cc42af3c4e6ff5d2fbac'],
  'linux-x64': ['linux_amd64.tar.gz', 'e9e3a33a489d8a94ea9bd4b8eb4bb9286a978c3df11dc4c49f5ef393ef0fdc68'],
  'linux-arm64': ['linux_aarch64.tar.gz', '8a7582e98501f414fee1ab691d44fb56ce59db01f21cbd521a414cb358b66394']
}
const platform = process.argv[2] || process.platform
const arch = process.argv[3] || process.arch
const target = `${platform}-${arch}`
if (!hashes[target]) throw new Error(`Unsupported proxy target: ${target}`)
const [suffix, expected] = hashes[target]
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const folder = `${({ win32: 'win', darwin: 'mac', linux: 'linux' })[platform]}-${arch}`
const output = path.join(root, 'resources', 'cli-proxy', folder)
const binary = platform === 'win32' ? 'cli-proxy-api.exe' : 'cli-proxy-api'
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
try {
  const manifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'))
  if (manifest.version === version && manifest.archiveSha256 === expected && manifest.sha256 === sha256(await fs.readFile(path.join(output, binary)))) {
    console.log(`CLIProxyAPI ${version} (${target}) verified`)
    process.exit(0)
  }
} catch { /* First setup or incomplete download. */ }
const tempBase = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir()
await fs.mkdir(tempBase, { recursive: true })
const temp = await fs.mkdtemp(path.join(tempBase, 'frameflow-proxy-download-'))
try {
  const name = `CLIProxyAPI_${version}_${suffix}`
  console.log(`Downloading ${name}...`)
  const response = await fetch(`https://github.com/router-for-me/CLIProxyAPI/releases/download/v${version}/${name}`, { signal: AbortSignal.timeout(180000) })
  if (!response.ok) throw new Error(`Proxy download failed: HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (sha256(bytes) !== expected) throw new Error('Proxy archive checksum mismatch; refusing to execute it')
  const archive = path.join(temp, name)
  await fs.writeFile(archive, bytes)
  const extracted = path.join(temp, 'extracted')
  await fs.mkdir(extracted)
  if (suffix.endsWith('.zip')) {
    if (process.platform !== 'win32') throw new Error('Prepare Windows packages on Windows')
    const quote = (s) => `'${s.replaceAll("'", "''")}'`
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(extracted)}`])
  } else execFileSync('tar', ['-xzf', archive, '-C', extracted])
  const content = await fs.readFile(path.join(extracted, binary))
  await fs.mkdir(output, { recursive: true })
  await fs.writeFile(path.join(output, binary), content, { mode: 0o755 })
  await fs.copyFile(path.join(extracted, 'LICENSE'), path.join(output, 'LICENSE'))
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ version, target, sha256: sha256(content), archiveSha256: expected }, null, 2))
  console.log(`Prepared CLIProxyAPI ${version} (${target}), SHA-256 verified`)
} finally {
  await fs.rm(temp, { recursive: true, force: true })
}
