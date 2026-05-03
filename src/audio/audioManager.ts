type AudioScene = 'menu' | 'game'

type SpriteCue = {
  start: number
  end: number
}

type SpriteManifest = {
  sampleRate: number
  sprite: Record<string, SpriteCue>
}

type PlaySpriteOptions = {
  playbackRate?: number
  gain?: number
  maxInstances?: number
}

const USER_AUDIO_MUTED_STORAGE_KEY = 'cubefight.audio-muted'
const USER_AUDIO_VOLUME_STORAGE_KEY = 'cubefight.audio-volume'

function clampVolume(value: number) {
  if (Number.isNaN(value)) {
    return 0.78
  }

  return Math.min(1, Math.max(0, value))
}

function readStoredUserMuted() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(USER_AUDIO_MUTED_STORAGE_KEY) === 'true'
}

function readStoredUserVolume() {
  if (typeof window === 'undefined') {
    return 0.78
  }

  const storedVolume = window.localStorage.getItem(USER_AUDIO_VOLUME_STORAGE_KEY)
  if (storedVolume === null) {
    return 0.78
  }

  return clampVolume(Number(storedVolume))
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

class AudioManager {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private menuGain: GainNode | null = null
  private gameBaseGain: GainNode | null = null
  private gameMelodyGain: GainNode | null = null
  private unlocked = false
  private currentScene: AudioScene = 'menu'
  private melodyActive = false
  private visibilityHidden = false
  private platformMuted = false
  private userMuted = readStoredUserMuted()
  private userVolume = readStoredUserVolume()
  private menuSource: AudioBufferSourceNode | null = null
  private gameBaseSource: AudioBufferSourceNode | null = null
  private gameMelodySource: AudioBufferSourceNode | null = null
  private menuBufferPromise: Promise<AudioBuffer | null> | null = null
  private gameBaseBufferPromise: Promise<AudioBuffer | null> | null = null
  private gameMelodyBufferPromise: Promise<AudioBuffer | null> | null = null
  private spriteBufferPromise: Promise<AudioBuffer | null> | null = null
  private spriteManifestPromise: Promise<SpriteManifest | null> | null = null
  private activeSpriteCounts = new Map<string, number>()
  private playbackSyncId = 0

  private hasAudioContextSupport() {
    return typeof window !== 'undefined' && (typeof window.AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined')
  }

  private ensureContext() {
    if (this.context || !this.hasAudioContextSupport()) {
      return this.context
    }

    const ContextCtor = window.AudioContext ?? window.webkitAudioContext
    if (!ContextCtor) {
      return null
    }

    this.context = new ContextCtor()
    this.masterGain = this.context.createGain()
    this.musicGain = this.context.createGain()
    this.sfxGain = this.context.createGain()
    this.menuGain = this.context.createGain()
    this.gameBaseGain = this.context.createGain()
    this.gameMelodyGain = this.context.createGain()

    this.masterGain.gain.value = this.userVolume
    this.musicGain.gain.value = 0.6
    this.sfxGain.gain.value = 0.76
    this.menuGain.gain.value = 0
    this.gameBaseGain.gain.value = 0
    this.gameMelodyGain.gain.value = 0

    this.menuGain.connect(this.musicGain)
    this.gameBaseGain.connect(this.musicGain)
    this.gameMelodyGain.connect(this.musicGain)
    this.musicGain.connect(this.masterGain)
    this.sfxGain.connect(this.masterGain)
    this.masterGain.connect(this.context.destination)

    return this.context
  }

  private async decodeAsset(path: string) {
    const context = this.ensureContext()
    if (!context) {
      return null
    }

    const response = await fetch(path)
    if (!response.ok) {
      throw new Error(`Failed to fetch audio asset: ${path}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return context.decodeAudioData(arrayBuffer.slice(0))
  }

  private async loadMenuBuffer() {
    if (!this.menuBufferPromise) {
      this.menuBufferPromise = this.decodeAsset('/audio/generated/main_menu_bgm.wav')
        .then((buffer) => {
          if (!buffer) {
            this.menuBufferPromise = null
          }

          return buffer
        })
        .catch(() => {
          this.menuBufferPromise = null
          return null
        })
    }

    return this.menuBufferPromise
  }

  private async loadGameBaseBuffer() {
    if (!this.gameBaseBufferPromise) {
      this.gameBaseBufferPromise = this.decodeAsset('/audio/generated/ingame_bgm_base.wav')
        .then((buffer) => {
          if (!buffer) {
            this.gameBaseBufferPromise = null
          }

          return buffer
        })
        .catch(() => {
          this.gameBaseBufferPromise = null
          return null
        })
    }

    return this.gameBaseBufferPromise
  }

  private async loadGameMelodyBuffer() {
    if (!this.gameMelodyBufferPromise) {
      this.gameMelodyBufferPromise = this.decodeAsset('/audio/generated/ingame_bgm_melody.wav')
        .then((buffer) => {
          if (!buffer) {
            this.gameMelodyBufferPromise = null
          }

          return buffer
        })
        .catch(() => {
          this.gameMelodyBufferPromise = null
          return null
        })
    }

    return this.gameMelodyBufferPromise
  }

  private async loadSpriteBuffer() {
    if (!this.spriteBufferPromise) {
      this.spriteBufferPromise = this.decodeAsset('/audio/generated/sfx_sprite.wav')
        .then((buffer) => {
          if (!buffer) {
            this.spriteBufferPromise = null
          }

          return buffer
        })
        .catch(() => {
          this.spriteBufferPromise = null
          return null
        })
    }

    return this.spriteBufferPromise
  }

  private async loadSpriteManifest() {
    if (!this.spriteManifestPromise) {
      this.spriteManifestPromise = fetch('/audio/generated/sfx_sprite.json')
        .then((response) => (response.ok ? response.json() : null))
        .then((manifest) => {
          if (!manifest) {
            this.spriteManifestPromise = null
          }

          return manifest as SpriteManifest | null
        })
        .catch(() => {
          this.spriteManifestPromise = null
          return null
        })
    }

    return this.spriteManifestPromise
  }

  private stopSource(source: AudioBufferSourceNode | null) {
    if (!source) {
      return
    }

    try {
      source.stop()
    } catch {
      return
    }
  }

  private async ensureMenuLoop() {
    const context = this.ensureContext()
    if (!context || !this.menuGain || this.menuSource) {
      return
    }

    const buffer = await this.loadMenuBuffer()
    if (!buffer || this.menuSource || this.currentScene !== 'menu' || !this.unlocked || this.visibilityHidden) {
      return
    }

    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(this.menuGain)
    source.start()
    this.menuSource = source
    source.onended = () => {
      if (this.menuSource === source) {
        this.menuSource = null
      }
    }
  }

  private async ensureGameLoops() {
    const context = this.ensureContext()
    if (!context || !this.gameBaseGain || !this.gameMelodyGain) {
      return
    }

    if (!this.gameBaseSource) {
      const baseBuffer = await this.loadGameBaseBuffer()
      if (baseBuffer && !this.gameBaseSource && this.currentScene === 'game' && this.unlocked && !this.visibilityHidden) {
        const source = context.createBufferSource()
        source.buffer = baseBuffer
        source.loop = true
        source.connect(this.gameBaseGain)
        source.start()
        this.gameBaseSource = source
        source.onended = () => {
          if (this.gameBaseSource === source) {
            this.gameBaseSource = null
          }
        }
      }
    }

    if (!this.gameMelodySource) {
      const melodyBuffer = await this.loadGameMelodyBuffer()
      if (melodyBuffer && !this.gameMelodySource && this.currentScene === 'game' && this.unlocked && !this.visibilityHidden) {
        const source = context.createBufferSource()
        source.buffer = melodyBuffer
        source.loop = true
        source.connect(this.gameMelodyGain)
        source.start()
        this.gameMelodySource = source
        source.onended = () => {
          if (this.gameMelodySource === source) {
            this.gameMelodySource = null
          }
        }
      }
    }
  }

  private ramp(node: GainNode | null, value: number, seconds: number) {
    const context = this.context
    if (!context || !node) {
      return
    }

    const now = context.currentTime
    node.gain.cancelScheduledValues(now)
    node.gain.setValueAtTime(node.gain.value, now)
    node.gain.linearRampToValueAtTime(value, now + seconds)
  }

  private syncSceneGains() {
    if (!this.unlocked || this.visibilityHidden || this.platformMuted || this.userMuted) {
      this.ramp(this.menuGain, 0, 0.08)
      this.ramp(this.gameBaseGain, 0, 0.08)
      this.ramp(this.gameMelodyGain, 0, 0.08)
      this.ramp(this.sfxGain, 0, 0.08)
      return
    }

    this.ramp(this.sfxGain, 0.76, 0.08)

    if (this.currentScene === 'menu') {
      this.ramp(this.menuGain, 0.18, 0.25)
      this.ramp(this.gameBaseGain, 0, 0.18)
      this.ramp(this.gameMelodyGain, 0, 0.18)
      return
    }

    this.ramp(this.menuGain, 0, 0.18)
    this.ramp(this.gameBaseGain, 0.2, 0.2)
    this.ramp(this.gameMelodyGain, this.melodyActive ? 0.11 : 0.006, 0.2)
  }

  private async syncScenePlayback() {
    const syncId = ++this.playbackSyncId

    if (!this.unlocked || this.visibilityHidden) {
      this.syncSceneGains()
      return
    }

    if (this.currentScene === 'menu') {
      await this.ensureMenuLoop()
    } else {
      await this.ensureGameLoops()
    }

    if (syncId !== this.playbackSyncId) {
      return
    }

    this.syncSceneGains()
  }

  async unlock() {
    const context = this.ensureContext()
    if (!context) {
      return false
    }

    if (context.state === 'suspended') {
      await context.resume()
    }

    this.unlocked = context.state === 'running'

    if (this.unlocked) {
      void this.syncScenePlayback()
    }

    return this.unlocked
  }

  async warmup() {
    if (!this.hasAudioContextSupport()) {
      return
    }

    this.ensureContext()
    void this.loadMenuBuffer()
    void this.loadGameBaseBuffer()
    void this.loadGameMelodyBuffer()
    void this.loadSpriteBuffer()
    void this.loadSpriteManifest()
  }

  async setScene(scene: AudioScene) {
    this.currentScene = scene
    await this.syncScenePlayback()
  }

  setGameIntensity(active: boolean) {
    this.melodyActive = active
    this.syncSceneGains()
  }

  async setVisibilityHidden(hidden: boolean) {
    this.visibilityHidden = hidden
    if (!this.context) {
      return
    }

    if (hidden && this.context.state === 'running') {
      await this.context.suspend().catch(() => undefined)
    }

    if (!hidden && this.unlocked && this.context.state === 'suspended') {
      await this.context.resume().catch(() => undefined)
    }

    await this.syncScenePlayback()
  }

  setPlatformMuted(muted: boolean) {
    this.platformMuted = muted
    void this.syncScenePlayback()
  }

  isUserMuted() {
    return this.userMuted
  }

  getUserVolume() {
    return this.userVolume
  }

  setUserMuted(muted: boolean) {
    this.userMuted = muted

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(USER_AUDIO_MUTED_STORAGE_KEY, muted ? 'true' : 'false')
    }

    this.syncSceneGains()
  }

  setUserVolume(volume: number) {
    this.userVolume = clampVolume(volume)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(USER_AUDIO_VOLUME_STORAGE_KEY, String(this.userVolume))
    }

    if (this.masterGain) {
      this.masterGain.gain.value = this.userVolume
    }

    this.syncSceneGains()
  }

  duckMusic(amount = 0.65, durationSeconds = 0.5) {
    if (!this.musicGain || !this.context) {
      return
    }

    const now = this.context.currentTime
    const currentValue = this.musicGain.gain.value
    const duckedValue = currentValue * amount
    this.musicGain.gain.cancelScheduledValues(now)
    this.musicGain.gain.setValueAtTime(currentValue, now)
    this.musicGain.gain.linearRampToValueAtTime(duckedValue, now + 0.02)
    this.musicGain.gain.linearRampToValueAtTime(0.6, now + durationSeconds)
  }

  async playSprite(name: string, options: PlaySpriteOptions = {}) {
    const context = this.context
    if (!context || !this.unlocked || this.platformMuted || this.userMuted || !this.sfxGain) {
      return
    }

    const [buffer, manifest] = await Promise.all([this.loadSpriteBuffer(), this.loadSpriteManifest()])
    if (!buffer || !manifest) {
      return
    }

    const cue = manifest.sprite[name]
    if (!cue) {
      return
    }

    const activeCount = this.activeSpriteCounts.get(name) ?? 0
    const maxInstances = options.maxInstances ?? 3
    if (activeCount >= maxInstances) {
      return
    }

    const duration = Math.max(0.01, cue.end - cue.start)
    const source = context.createBufferSource()
    const gainNode = context.createGain()
    source.buffer = buffer
    source.playbackRate.value = options.playbackRate ?? 1
    gainNode.gain.value = options.gain ?? 1
    source.connect(gainNode)
    gainNode.connect(this.sfxGain)

    this.activeSpriteCounts.set(name, activeCount + 1)
    source.onended = () => {
      gainNode.disconnect()
      const currentCount = this.activeSpriteCounts.get(name) ?? 1
      this.activeSpriteCounts.set(name, Math.max(0, currentCount - 1))
    }

    source.start(0, cue.start, duration)
  }

  async playUiConfirm() {
    await this.unlock()
    await this.playSprite('click_confirm', { gain: 0.66, maxInstances: 2 })
  }

  async playSelect() {
    await this.playSprite('select_blue', { gain: 0.68, maxInstances: 2 })
  }

  async playSlice(index: number) {
    const cueIndex = Math.max(1, Math.min(3, index + 1))
    await this.playSprite(`hover_l${cueIndex}`, { gain: 0.58, maxInstances: 2 })
  }

  async playMerge(level: number) {
    this.duckMusic(0.72, 0.42)
    await this.playSprite(`merge_lv${Math.max(2, Math.min(9, level))}`, { gain: 0.78, maxInstances: 2 })
  }

  async playDevourRed() {
    this.duckMusic(0.72, 0.38)
    await this.playSprite('devour_red', { gain: 0.7, maxInstances: 2 })
  }

  async playDevourYellow() {
    await this.playSprite('devour_yellow', { gain: 0.74, maxInstances: 3 })
  }

  async playCombo(comboCount: number) {
    const playbackRate = Math.min(1.45, 1 + Math.max(0, comboCount - 2) * 0.06)
    await this.playSprite('combo_base', { gain: 0.58, playbackRate, maxInstances: 2 })
    if (comboCount >= 5) {
      await this.playSprite('combo_x5_bonus', { gain: 0.5, maxInstances: 1 })
    }
  }

  dispose() {
    this.stopSource(this.menuSource)
    this.stopSource(this.gameBaseSource)
    this.stopSource(this.gameMelodySource)
    this.menuSource = null
    this.gameBaseSource = null
    this.gameMelodySource = null
  }
}

export const audioManager = new AudioManager()
