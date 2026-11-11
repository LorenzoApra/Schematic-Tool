import { useEffect, useReducer, useState } from 'react'
import { loadProject, STORAGE_KEY, type ProjectState } from '../lib/project'

interface History {
  past: ProjectState[]
  present: ProjectState
  future: ProjectState[]
  group?: string
}
type Action =
  | {
      type: 'update'
      update: (state: ProjectState) => ProjectState
      group?: string
    }
  | { type: 'undo' | 'redo' | 'end-group' }

function reducer(history: History, action: Action): History {
  if (action.type === 'end-group') return { ...history, group: undefined }
  if (action.type === 'undo') {
    if (!history.past.length) return history
    return {
      past: history.past.slice(0, -1),
      present: history.past[history.past.length - 1],
      future: [history.present, ...history.future],
    }
  }
  if (action.type === 'redo') {
    if (!history.future.length) return history
    return {
      past: [...history.past, history.present],
      present: history.future[0],
      future: history.future.slice(1),
    }
  }
  if (action.type !== 'update') return history
  const present = action.update(history.present)
  if (present === history.present) return history
  return {
    past:
      action.group && action.group === history.group
        ? history.past
        : [...history.past, history.present].slice(-60),
    present,
    future: [],
    group: action.group,
  }
}

export function useProject() {
  const [history, dispatch] = useReducer(reducer, undefined, () => ({
    past: [],
    present: loadProject(),
    future: [],
  }))
  const state = history.present
  const [saved, setSaved] = useState<{ state: ProjectState; error: boolean }>({
    state,
    error: false,
  })

  useEffect(() => {
    const save = () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
        setSaved({ state, error: false })
      } catch {
        setSaved({ state, error: true })
      }
    }
    const timeout = window.setTimeout(save, 450)
    window.addEventListener('pagehide', save)
    window.addEventListener('beforeunload', save)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('pagehide', save)
      window.removeEventListener('beforeunload', save)
    }
  }, [state])

  return {
    state,
    update: (update: (state: ProjectState) => ProjectState, group?: string) =>
      dispatch({ type: 'update', update, group }),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    endGroup: () => dispatch({ type: 'end-group' }),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    saveStatus: saved.error
      ? 'error'
      : saved.state === state
        ? 'saved'
        : 'saving',
  }
}
