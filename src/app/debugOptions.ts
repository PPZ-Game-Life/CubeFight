import type { EndlessGridSize } from './endlessProgress'

export type DebugOptions = {
  debugMode: boolean
  debugGridSize: EndlessGridSize
}

const DEBUG_OPTIONS_STORAGE_KEY = 'cubefight.debug-options'

export function getIsNonReleaseBuild() {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean; MODE?: string } }).env
  return env?.DEV === true || env?.MODE === 'test'
}

export function readStoredDebugOptions(): DebugOptions {
  if (!getIsNonReleaseBuild() || typeof window === 'undefined') {
    return {
      debugMode: false,
      debugGridSize: 3
    }
  }

  const rawValue = window.localStorage.getItem(DEBUG_OPTIONS_STORAGE_KEY)
  if (!rawValue) {
    return {
      debugMode: false,
      debugGridSize: 3
    }
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<DebugOptions>
    return {
      debugMode: parsed.debugMode === true,
      debugGridSize: parsed.debugGridSize === 4 || parsed.debugGridSize === 5 ? parsed.debugGridSize : 3
    }
  } catch {
    return {
      debugMode: false,
      debugGridSize: 3
    }
  }
}

export function writeStoredDebugOptions(options: DebugOptions) {
  if (!getIsNonReleaseBuild() || typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(DEBUG_OPTIONS_STORAGE_KEY, JSON.stringify(options))
}
