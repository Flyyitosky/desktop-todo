import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Todo, WindowSettings } from '../shared/types'

const defaultSettings: WindowSettings = {
  width: 390,
  height: 620,
  alwaysOnTop: true
}

function dataPath(fileName: string): string {
  return path.join(app.getPath('userData'), fileName)
}

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(dataPath(fileName), 'utf8')) as T
  } catch {
    return fallback
  }
}

async function writeJson<T>(fileName: string, value: T): Promise<void> {
  const target = dataPath(fileName)
  const temporary = `${target}.tmp`
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), 'utf8')
  await fs.rename(temporary, target)
}

export const storage = {
  getTodos: (): Promise<Todo[]> => readJson('todos.json', []),
  saveTodos: (todos: Todo[]): Promise<void> => writeJson('todos.json', todos),
  getSettings: (): Promise<WindowSettings> => readJson('settings.json', defaultSettings),
  saveSettings: (settings: WindowSettings): Promise<void> => writeJson('settings.json', settings)
}
