import type { CrazyGamesEnvironment, CrazyGamesSdk, CrazyGamesSettings } from './crazygamesTypes'

type SettingsListener = (settings: CrazyGamesSettings) => void

let initPromise: Promise<boolean> | null = null
let initialized = false
let gameplayActive = false
let settingsListener: SettingsListener | null = null

function getSdk(): CrazyGamesSdk | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.CrazyGames?.SDK ?? null
}

function isCallable(value: unknown): value is () => void {
  return typeof value === 'function'
}

function getEnvironment(): CrazyGamesEnvironment | 'missing' {
  return getSdk()?.environment ?? 'missing'
}

function canUseSdk() {
  const environment = getEnvironment()
  return environment === 'local' || environment === 'crazygames'
}

async function init() {
  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    const sdk = getSdk()
    if (!sdk || !canUseSdk()) {
      initialized = false
      return false
    }

    try {
      await sdk.init()
      initialized = true
      return true
    } catch (error) {
      initialized = false
      console.warn('[CrazyGames] SDK init failed', error)
      return false
    }
  })()

  return initPromise
}

async function notifyLoadingStart() {
  await init()
  const loadingStart = getSdk()?.game.loadingStart
  if (!initialized || !canUseSdk() || !isCallable(loadingStart)) {
    return
  }

  try {
    loadingStart()
  } catch (error) {
    console.warn('[CrazyGames] loadingStart failed', error)
  }
}

async function notifyLoadingStop() {
  await init()
  const loadingStop = getSdk()?.game.loadingStop
  if (!initialized || !canUseSdk() || !isCallable(loadingStop)) {
    return
  }

  try {
    loadingStop()
  } catch (error) {
    console.warn('[CrazyGames] loadingStop failed', error)
  }
}

async function gameplayStart() {
  await init()
  const sdk = getSdk()
  if (!initialized || !sdk || !canUseSdk() || gameplayActive) {
    return
  }

  try {
    sdk.game.gameplayStart()
    gameplayActive = true
  } catch (error) {
    console.warn('[CrazyGames] gameplayStart failed', error)
  }
}

async function gameplayStop() {
  await init()
  const sdk = getSdk()
  if (!initialized || !sdk || !canUseSdk() || !gameplayActive) {
    return
  }

  try {
    sdk.game.gameplayStop()
    gameplayActive = false
  } catch (error) {
    console.warn('[CrazyGames] gameplayStop failed', error)
  }
}

async function syncSettings(listener: SettingsListener) {
  await init()
  const sdk = getSdk()
  if (!initialized || !sdk || !canUseSdk()) {
    listener({ muteAudio: false })
    return () => undefined
  }

  settingsListener = (settings) => listener(settings)
  listener(sdk.game.settings)
  sdk.game.addSettingsChangeListener(settingsListener)

  return () => {
    if (settingsListener) {
      sdk.game.removeSettingsChangeListener(settingsListener)
      settingsListener = null
    }
  }
}

export const crazygamesSdk = {
  init,
  notifyLoadingStart,
  notifyLoadingStop,
  gameplayStart,
  gameplayStop,
  syncSettings,
  getEnvironment
}
