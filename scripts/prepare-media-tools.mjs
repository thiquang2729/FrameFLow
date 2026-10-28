import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Shared LGPL build, deliberately without GPL codecs such as libx264.
const release = 'autobuild-2026-10-27-18-38'
const build = 'n8.1.3-24-g92611900bb'
const targets = {
  'win32-x64': [`ffmpeg-${build}-win64-lgpl-shared-8.1.zip`, '6c6167da57decb941a0466b60d95f7f51e4edd6b2d79c24dc4860c1c15701292', 'win-x64'],
  'linux-x64': [`ffmpeg-${build}-linux64-lgpl-shared-8.1.tar.xz`, '6e995806dff2664d7a6a86d7f39371ec69c559a200b5fed66a79d7fec41916e8', 'linux-x64']
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
await fs.mkdir(path.join(root, 'resources', 'media'), { recursive: true })
const target = targets[`${process.platform}-${process.arch}`]
if (!target) {
  console.log('Media tools are not bundled for this platform yet; SRC analysis will be unavailable. Video review remains available.')
  process.exit(0)
}
const [name, archiveSha256, folder] = target
const output = path.join(root, 'resources', 'media', folder)
const hash = (data) => createHash('sha256').update(data).digest('hex')
try {
  const manifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'))
  if (manifest.archiveSha256 === archiveSha256) {
    const valid = await Promise.all(Object.entries(manifest.files).map(async ([file, expected]) => hash(await fs.readFile(path.join(output, file))) === expected))
    if (valid.length && valid.every(Boolean)) { console.log(`Media tools ${build} (${folder}) verified`); process.exit(0) }
  }
} catch { /* First setup or incomplete installation. */ }
const tempBase = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir()
await fs.mkdir(tempBase, { recursive: true })
const temp = await fs.mkdtemp(path.join(tempBase, 'frameflow-media-download-'))
try {
  const url = `https://github.com/BtbN/FFmpeg-Builds/releases/download/${release}/${name}`
  console.log(`Downloading ${name} (LGPL shared)...`)
  const response = await fetch(url, { signal: AbortSignal.timeout(240000) })
  if (!response.ok) throw new Error(`Media download failed: HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (hash(bytes) !== archiveSha256) throw new Error('Media tools checksum mismatch')
  const archive = path.join(temp, name)
  const extracted = path.join(temp, 'extracted')
  await fs.writeFile(archive, bytes)
  await fs.mkdir(extracted)
  if (process.platform === 'win32') {
    const quote = (s) => `'${s.replaceAll("'", "''")}'`
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(extracted)}`])
  } else execFileSync('tar', ['-xJf', archive, '-C', extracted])
  const folders = (await fs.readdir(extracted, { withFileTypes: true })).filter((item) => item.isDirectory())
  if (folders.length !== 1) throw new Error('Unexpected media archive structure')
  const content = path.join(extracted, folders[0].name)
  // Preserve upstream licenses, documentation, build configuration and shared libraries.
  await fs.mkdir(output, { recursive: true })
  await fs.cp(content, output, { recursive: true })
  const files = {}
  async function collect(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) await collect(file)
      else if (entry.isFile() && !file.endsWith('manifest.json')) files[path.relative(output, file).replaceAll('\\', '/')] = hash(await fs.readFile(file))
    }
  }
  const sourceNotice = `FFmpeg ${build}\nBuild: ${url}\nBuild recipe: https://github.com/BtbN/FFmpeg-Builds/tree/${release}\nCorresponding FFmpeg source: https://github.com/FFmpeg/FFmpeg/tree/92611900bb\nShared LGPL build; upstream license and build information are retained in this directory.\nReview LGPL redistribution obligations before public release.\n`
  await fs.writeFile(path.join(output, 'SOURCE-NOTICE.txt'), sourceNotice)
  await collect(output)
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ build, archiveSha256, files }, null, 2))
  console.log(`Prepared FFmpeg/FFprobe ${build} (${folder})`)
} finally { await fs.rm(temp, { recursive: true, force: true }) }
