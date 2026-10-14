import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { Priority, Todo } from '../../shared/types'

type Filter = 'pending' | 'all' | 'completed'

const priorityLabels: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低'
}

function todayString(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

function App(): React.JSX.Element {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [filter, setFilter] = useState<Filter>('pending')
  const [alwaysOnTop, setAlwaysOnTop] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void Promise.all([window.desktopApi.listTodos(), window.desktopApi.getAlwaysOnTop()]).then(
      ([savedTodos, pinned]) => {
        setTodos(savedTodos)
        setAlwaysOnTop(pinned)
        setLoaded(true)
      }
    )
    return window.desktopApi.onFocusInput(() => inputRef.current?.focus())
  }, [])

  useEffect(() => {
    if (loaded) void window.desktopApi.saveTodos(todos)
  }, [todos, loaded])

  const visibleTodos = useMemo(() => {
    const filtered = todos.filter((todo) => {
      if (filter === 'pending') return !todo.completed
      if (filter === 'completed') return todo.completed
      return true
    })
    return filtered.sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed)
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [filter, todos])

  const pendingCount = todos.filter((todo) => !todo.completed).length

  function addTodo(event: FormEvent): void {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    const now = new Date().toISOString()
    setTodos((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: cleanTitle,
        completed: false,
        priority,
        dueDate: dueDate || undefined,
        createdAt: now,
        updatedAt: now
      }
    ])
    setTitle('')
    setDueDate('')
    inputRef.current?.focus()
  }

  function toggleTodo(id: string): void {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === id
          ? { ...todo, completed: !todo.completed, updatedAt: new Date().toISOString() }
          : todo
      )
    )
  }

  function editTodo(todo: Todo): void {
    const nextTitle = window.prompt('修改待办', todo.title)?.trim()
    if (!nextTitle || nextTitle === todo.title) return
    setTodos((current) =>
      current.map((item) =>
        item.id === todo.id
          ? { ...item, title: nextTitle, updatedAt: new Date().toISOString() }
          : item
      )
    )
  }

  function deleteTodo(id: string): void {
    setTodos((current) => current.filter((todo) => todo.id !== id))
  }

  async function togglePin(): Promise<void> {
    const nextValue = !alwaysOnTop
    setAlwaysOnTop(await window.desktopApi.setAlwaysOnTop(nextValue))
  }

  return (
    <main className="app-shell">
      <header className="titlebar">
        <div className="titlebar-drag">
          <strong>桌面待办</strong>
          <span>{pendingCount} 项未完成</span>
        </div>
        <div className="window-actions">
          <button className={alwaysOnTop ? 'active' : ''} onClick={() => void togglePin()} title="置顶">
            ⌖
          </button>
          <button onClick={() => void window.desktopApi.minimizeWindow()} title="最小化">
            —
          </button>
          <button onClick={() => void window.desktopApi.hideWindow()} title="隐藏到托盘">
            ×
          </button>
        </div>
      </header>

      <section className="content">
        <form className="todo-form" onSubmit={addTodo}>
          <input
            ref={inputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="添加一件要做的事…"
            aria-label="待办内容"
            autoFocus
          />
          <div className="form-options">
            <input
              type="date"
              value={dueDate}
              min={todayString()}
              onChange={(event) => setDueDate(event.target.value)}
              aria-label="截止日期"
            />
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
              aria-label="优先级"
            >
              <option value="high">高优先级</option>
              <option value="medium">中优先级</option>
              <option value="low">低优先级</option>
            </select>
            <button type="submit">添加</button>
          </div>
        </form>

        <nav className="filters" aria-label="任务筛选">
          {(['pending', 'all', 'completed'] as Filter[]).map((item) => (
            <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
              {item === 'pending' ? '未完成' : item === 'all' ? '全部' : '已完成'}
            </button>
          ))}
        </nav>

        <section className="todo-list">
          {visibleTodos.length === 0 ? (
            <div className="empty-state">
              <div>✓</div>
              <p>{filter === 'pending' ? '当前没有未完成事项' : '这里还没有任务'}</p>
            </div>
          ) : (
            visibleTodos.map((todo) => (
              <article key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                <button
                  className="check-button"
                  onClick={() => toggleTodo(todo.id)}
                  aria-label={todo.completed ? '恢复任务' : '完成任务'}
                >
                  {todo.completed ? '✓' : ''}
                </button>
                <div className="todo-body" onDoubleClick={() => editTodo(todo)}>
                  <p>{todo.title}</p>
                  <div className="todo-meta">
                    <span className={`priority ${todo.priority}`}>{priorityLabels[todo.priority]}优先级</span>
                    {todo.dueDate && <span className={todo.dueDate < todayString() && !todo.completed ? 'overdue' : ''}>截止 {todo.dueDate}</span>}
                  </div>
                </div>
                <div className="item-actions">
                  <button onClick={() => editTodo(todo)} title="编辑">✎</button>
                  <button onClick={() => deleteTodo(todo.id)} title="删除">×</button>
                </div>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  )
}

export default App
