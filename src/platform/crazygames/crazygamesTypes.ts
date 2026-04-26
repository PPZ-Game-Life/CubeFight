export type CrazyGamesEnvironment = 'local' | 'crazygames' | 'disabled'

export type CrazyGamesSettings = {
  disableChat?: boolean
  muteAudio?: boolean
}

export type CrazyGamesSdk = {
  environment: CrazyGamesEnvironment
  init: () => Promise<void>
  game: {
    settings: CrazyGamesSettings
    addSettingsChangeListener: (listener: (settings: CrazyGamesSettings) => void) => void
    removeSettingsChangeListener: (listener: (settings: CrazyGamesSettings) => void) => void
    gameplayStart: () => void
    gameplayStop: () => void
    loadingStart?: () => void
    loadingStop?: () => void
  }
}

declare global {
  interface Window {
    CrazyGames?: {
      SDK?: CrazyGamesSdk
    }
  }
}
