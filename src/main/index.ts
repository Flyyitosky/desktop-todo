import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, shell, Tray } from 'electron'
import path from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { storage } from './storage'
import type { Todo, WindowSettings } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let saveBoundsTimer: NodeJS.Timeout | undefined
let todoSaveQueue = Promise.resolve()

const trayIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#2563eb"/>
  <path d="M9 16.5l4.2 4.2L23.5 10.5" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

function showWindow(): void {
  if (!mainWindow) return
  mainWindow.show()
  mainWindow.focus()
}

async function persistWindowSettings(): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const bounds = mainWindow.getBounds()
  await storage.saveSettings({
    ...bounds,
    alwaysOnTop: mainWindow.isAlwaysOnTop()
  })
}

async function createWindow(): Promise<void> {
  const settings = await storage.getSettings()
  const displays = screen.getAllDisplays()
  const savedPositionIsVisible =
    settings.x !== undefined &&
    settings.y !== undefined &&
    displays.some((display) => {
      const area = display.workArea
      return (
        settings.x! >= area.x - settings.width + 80 &&
        settings.x! <= area.x + area.width - 80 &&
        settings.y! >= area.y - settings.height + 80 &&
        settings.y! <= area.y + area.height - 80
      )
    })

  mainWindow = new BrowserWindow({
    x: savedPositionIsVisible ? settings.x : undefined,
    y: savedPositionIsVisible ? settings.y : undefined,
    width: settings.width,
    height: settings.height,
    minWidth: 340,
    minHeight: 460,
    show: true,
    frame: false,
    transparent: false,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  const scheduleSettingsSave = (): void => {
    clearTimeout(saveBoundsTimer)
    saveBoundsTimer = setTimeout(() => void persistWindowSettings(), 300)
  }
  mainWindow.on('move', scheduleSettingsSave)
  mainWindow.on('resize', scheduleSettingsSave)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.show()
  mainWindow.focus()
}

function createTray(): void {
  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trayIconSvg)}`
  )
  tray = new Tray(image.resize({ width: 16, height: 16 }))
  tray.setToolTip('桌面待办')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示待办', click: showWindow },
      {
        label: '快速新增',
        click: () => {
          showWindow()
          mainWindow?.webContents.send('todo:focus-input')
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('double-click', showWindow)
}

function registerIpc(): void {
  ipcMain.handle('todo:list', () => storage.getTodos())
  ipcMain.handle('todo:save', (_event, todos: Todo[]) => {
    todoSaveQueue = todoSaveQueue.then(() => storage.saveTodos(todos))
    return todoSaveQueue
  })
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:hide', () => mainWindow?.hide())
  ipcMain.handle('window:get-always-on-top', () => mainWindow?.isAlwaysOnTop() ?? false)
  ipcMain.handle('window:set-always-on-top', async (_event, value: boolean) => {
    mainWindow?.setAlwaysOnTop(value)
    await persistWindowSettings()
    return value
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', showWindow)
  app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.jackmartin.desktoptodo')
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
    registerIpc()
    await createWindow()
    createTray()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow()
      else showWindow()
    })
  })
}

app.on('before-quit', () => {
  isQuitting = true
  void persistWindowSettings()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep running in the system tray.
  }
})
