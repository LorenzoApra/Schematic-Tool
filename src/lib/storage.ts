export const isDesktop = import.meta.env?.MODE === 'desktop'
export const STORAGE_KEY = 'live-show-schematic-state-v1'

type StorageBridge = {
  postMessage: (message: {
    action: 'load' | 'save'
    value?: string
  }) => Promise<string | null>
}

let desktopProject: string | null = null
let storageError: unknown

function desktopStorage(): StorageBridge {
  const nativeWindow = window as unknown as {
    webkit?: { messageHandlers?: { projectStorage?: StorageBridge } }
  }
  const bridge = nativeWindow.webkit?.messageHandlers?.projectStorage
  if (!bridge) throw new Error('Salvataggio macOS non disponibile')
  return bridge
}

export async function initializeProjectStorage(
  isValid: (value: unknown) => boolean,
) {
  if (!isDesktop) return
  try {
    desktopProject = await desktopStorage().postMessage({ action: 'load' })
    if (desktopProject && !isValid(JSON.parse(desktopProject)))
      throw new Error('Il progetto salvato sul Mac non è valido')
  } catch (error) {
    // Preserve an unreadable project on disk; never replace it with an empty one.
    storageError = error
  }
}

export function readStoredProject() {
  if (isDesktop) return desktopProject
  return window.localStorage.getItem(STORAGE_KEY)
}

export async function saveStoredProject(value: string) {
  if (!isDesktop) {
    window.localStorage.setItem(STORAGE_KEY, value)
    return
  }
  if (storageError) throw storageError
  await desktopStorage().postMessage({ action: 'save', value })
  desktopProject = value
}
