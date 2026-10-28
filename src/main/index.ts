import { app, BrowserWindow, protocol, net, Menu, shell } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { is } from '@electron-toolkit/utils'
import { ProjectService } from './services/project.service'
import { VersionService } from './services/version.service'
import { ReviewService } from './services/review.service'
import { SourceService } from './services/source.service'
import { ExportService } from './services/export.service'
import { registerIpcHandlers } from './ipc/register-ipc'
import { AiService } from './services/ai.service'
import { registerAiIpc } from './ipc/register-ai-ipc'
import { SourceMediaService } from './services/source-media.service'
import { SourceAnalysisService } from './services/source-analysis.service'
import { registerSourceAnalysisIpc } from './ipc/register-source-analysis-ipc'

// Completely disable native application menu on Windows to prevent flickering/resizing
Menu.setApplicationMenu(null)

let mainWindow: BrowserWindow | null = null
let aiService: AiService | null = null
let sourceAnalysisService: SourceAnalysisService | null = null
let quitting = false

// A second app instance must not overwrite the first instance's proxy config.
if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => {
  if (mainWindow?.isMinimized()) mainWindow.restore()
  mainWindow?.focus()
})

function createWindow(): void {
  const preloadPath = fs.existsSync(join(__dirname, '../preload/index.mjs'))
    ? join(__dirname, '../preload/index.mjs')
    : join(__dirname, '../preload/index.js')

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: false, // Don't auto-hide, we explicitly remove it below
    title: 'FrameFlow — Không gian duyệt video AI',
    backgroundColor: '#0c1017',
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      webSecurity: false // Allows streaming local video and local frame snapshots
    }
  })

  // Completely strip native menu bar to eliminate any layout jitter
  mainWindow.removeMenu()
  mainWindow.setMenuBarVisibility(false)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // HMR for renderer based on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (!app.hasSingleInstanceLock()) return
  // Register custom protocol for local files if needed
  protocol.handle('frameflow-media', (request) => {
    const filePath = decodeURIComponent(request.url.replace('frameflow-media://', ''))
    return net.fetch(`file:///${filePath}`)
  })

  // Initialize service singletons
  const projectService = new ProjectService()
  const versionService = new VersionService(projectService)
  const reviewService = new ReviewService(projectService)
  const sourceService = new SourceService(projectService)
  const exportService = new ExportService(projectService, reviewService, versionService)
  const platformFolder = `${process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux'}-${process.arch}`
  aiService = new AiService({
    dataDir: join(app.getPath('userData'), 'ai-proxy'),
    binaryDir: app.isPackaged ? join(process.resourcesPath, 'cli-proxy') : join(app.getAppPath(), 'resources', 'cli-proxy', platformFolder),
    supervisorPath: app.isPackaged ? join(process.resourcesPath, 'proxy-supervisor.cjs') : join(app.getAppPath(), 'resources', 'proxy-supervisor.cjs'),
    nodePath: process.execPath,
    openExternal: (url) => shell.openExternal(url)
  })
  registerAiIpc(aiService)
  const media = new SourceMediaService(app.isPackaged
    ? join(process.resourcesPath, 'media', platformFolder)
    : join(app.getAppPath(), 'resources', 'media', platformFolder))
  sourceAnalysisService = new SourceAnalysisService(projectService, aiService, media)
  registerSourceAnalysisIpc(sourceAnalysisService)
  void aiService.start()

  // Register IPC endpoints
  registerIpcHandlers(
    projectService,
    versionService,
    reviewService,
    sourceService,
    exportService
  )

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', (event) => {
  if (quitting || !aiService) return
  event.preventDefault()
  quitting = true
  void (async () => {
    try { await sourceAnalysisService?.stop() }
    finally { await aiService?.stop() }
  })().finally(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
