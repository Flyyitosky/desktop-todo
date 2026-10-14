export type Priority = 'high' | 'medium' | 'low'

export interface Todo {
  id: string
  title: string
  completed: boolean
  priority: Priority
  dueDate?: string
  createdAt: string
  updatedAt: string
}

export interface WindowSettings {
  x?: number
  y?: number
  width: number
  height: number
  alwaysOnTop: boolean
}
