import { afterEach, describe, expect, it, vi } from 'vitest'

class FakeGainNode {
  gain = {
    value: 1,
    cancelScheduledValues: () => undefined,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined
  }

  connect() {
    return undefined
  }
}

class FakeBufferSourceNode {
  buffer: AudioBuffer | null = null
  loop = false
  playbackRate = { value: 1 }
  onended: (() => void) | null = null

  connect() {
    return undefined
  }

  start() {
    return undefined
  }

  stop() {
    return undefined
  }
}

class FakeAudioContext {
  state: AudioContextState = 'running'
  currentTime = 0
  destination = {}

  createGain() {
    return new FakeGainNode() as unknown as GainNode
  }

  createBufferSource() {
    return new FakeBufferSourceNode() as unknown as AudioBufferSourceNode
  }

  async decodeAudioData() {
    return {} as AudioBuffer
  }

  async resume() {
    this.state = 'running'
    return undefined
  }

  async suspend() {
    this.state = 'suspended'
    return undefined
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('audioManager', () => {
  it('retries menu BGM loading after a transient fetch failure', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))

    const { audioManager } = await import('./audioManager')

    await audioManager.unlock()
    await audioManager.setScene('menu')
    await audioManager.setScene('menu')

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenCalledWith('audio/generated/main_menu_bgm.wav')
  })
})
