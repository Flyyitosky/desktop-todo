import { contextBridge, ipcRenderer } from 'electron'
import type { Todo } from '../shared/types'

const desktopApi = {
  listTodos: (): Promise<Todo[]> => ipcRenderer.invoke('todo:list'),
  saveTodos: (todos: Todo[]): Promise<void> => ipcRenderer.invoke('todo:save', todos),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  hideWindow: (): Promise<void> => ipcRenderer.invoke('window:hide'),
  getAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('window:get-always-on-top'),
  setAlwaysOnTop: (value: boolean): Promise<boolean> =>
    ipcRenderer.invoke('window:set-always-on-top', value),
  onFocusInput: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('todo:focus-input', listener)
    return () => ipcRenderer.removeListener('todo:focus-input', listener)
  }
}

contextBridge.exposeInMainWorld('desktopApi', desktopApi)

export type DesktopApi = typeof desktopApi
