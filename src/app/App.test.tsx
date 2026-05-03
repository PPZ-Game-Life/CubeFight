import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { audioManager } from '../audio/audioManager'

vi.mock('./GameCanvas', () => ({
  GameCanvas: ({ interactive = true }: { interactive?: boolean }) => <div data-interactive={interactive ? 'true' : 'false'} data-testid="game-canvas" />
}))

import { App } from './App'

describe('App main menu flow', () => {
  afterEach(() => {
    audioManager.setUserVolume(0.78)
    window.localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('shows the main menu first and enters tutorial after pressing play', () => {
    vi.stubGlobal('navigator', { language: 'en' })

    render(<App />)

    expect(screen.getByTestId('main-menu')).toBeInTheDocument()
    expect(screen.getByTestId('main-menu-logo')).toBeInTheDocument()
    expect(screen.getByTestId('main-menu-hero')).toBeInTheDocument()
    expect(screen.getByTestId('main-menu-actions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Local Weekly Records/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Settings/i })).toBeInTheDocument()
    expect(screen.queryByTestId('hud-stat-bar')).not.toBeInTheDocument()
    expect(screen.getByTestId('game-canvas')).toHaveAttribute('data-interactive', 'false')

    fireEvent.click(screen.getByTestId('main-menu-start'))

    expect(screen.queryByTestId('main-menu')).not.toBeInTheDocument()
    expect(screen.getByTestId('hud-stat-bar')).toBeInTheDocument()
    expect(screen.queryByTestId('slice-controls-root')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hud-level-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('game-canvas')).toHaveAttribute('data-interactive', 'true')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('returns to the main menu when pressing the lobby button', () => {
    vi.stubGlobal('navigator', { language: 'en' })

    render(<App />)

    fireEvent.click(screen.getByTestId('main-menu-start'))
    fireEvent.click(screen.getByTestId('hud-lobby-button'))

    expect(screen.getByTestId('main-menu')).toBeInTheDocument()
    expect(screen.queryByTestId('hud-stat-bar')).not.toBeInTheDocument()
  })

  it('switches locale from settings', () => {
    vi.stubGlobal('navigator', { language: 'en' })

    render(<App />)

    fireEvent.click(screen.getByTestId('main-menu-settings'))
    fireEvent.click(screen.getByTestId('main-menu-locale-zh-CN'))

    expect(screen.getByRole('button', { name: /开始游戏/i })).toBeInTheDocument()
    expect(screen.getByTestId('main-menu-settings')).toHaveTextContent('设置')

    fireEvent.click(screen.getByTestId('main-menu-start'))

    expect(screen.getByRole('button', { name: '继续' })).toBeInTheDocument()
    expect(screen.getByText(/蓝块是你控制的方块/i)).toBeInTheDocument()
  })

  it('opens game rules and updates volume from settings', () => {
    vi.stubGlobal('navigator', { language: 'en' })

    render(<App />)

    fireEvent.click(screen.getByTestId('main-menu-settings'))

    expect(screen.getByTestId('main-menu-game-rules')).toHaveTextContent('Game Rules')
    expect(screen.getByTestId('main-menu-volume-slider')).toHaveValue('78')

    fireEvent.change(screen.getByTestId('main-menu-volume-slider'), { target: { value: '42' } })

    expect(audioManager.getUserVolume()).toBe(0.42)
    expect(screen.getByText('42%')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('main-menu-game-rules'))

    expect(screen.getByTestId('main-menu-rules-dialog')).toHaveTextContent('Blue cubes')
    expect(screen.getByTestId('main-menu-rules-dialog')).toHaveTextContent('Endless')
  })

  it('shows endless as the only public main menu entry after tutorial completion', () => {
    vi.stubGlobal('navigator', { language: 'en' })
    window.localStorage.setItem('cubefight.progress', JSON.stringify({ tutorialCompleted: true, endlessUnlocked: true, bestScore: 4500, preferredGridSize: 3 }))

    render(<App />)

    expect(screen.getByTestId('main-menu-start-endless')).toBeInTheDocument()
    expect(screen.queryByTestId('main-menu-start')).not.toBeInTheDocument()
    expect(screen.queryByTestId('main-menu-start-campaign')).not.toBeInTheDocument()
    expect(screen.queryByTestId('main-menu-overview-card')).not.toBeInTheDocument()
    expect(screen.getByTestId('main-menu-start-endless')).toHaveTextContent('Current 3×3×3 · Unlock 4×4×4 at 20000')
  })

  it('starts endless at 3x3x3 by default after tutorial completion', () => {
    vi.stubGlobal('navigator', { language: 'en' })
    window.localStorage.setItem('cubefight.progress', JSON.stringify({ tutorialCompleted: true, endlessUnlocked: true, bestScore: 0 }))

    render(<App />)

    expect(screen.getByTestId('main-menu-start-endless')).toHaveTextContent('Current 3×3×3 · Unlock 4×4×4 at 20000')
  })

  it('opens the leaderboard dialog after endless unlock', () => {
    vi.stubGlobal('navigator', { language: 'en' })
    window.localStorage.setItem('cubefight.progress', JSON.stringify({ tutorialCompleted: true, endlessUnlocked: true, bestScore: 4500, preferredGridSize: 3 }))

    render(<App />)

    fireEvent.click(screen.getByTestId('main-menu-leaderboard'))

    expect(screen.getByTestId('main-menu-leaderboard-dialog')).toBeInTheDocument()
    expect(screen.getByText(/Local Weekly Best/i)).toBeInTheDocument()
    expect(screen.getByTestId('leaderboard-empty')).toBeInTheDocument()
  })

  it('shows debug controls in settings on non-release builds', () => {
    vi.stubGlobal('navigator', { language: 'en' })

    render(<App />)

    fireEvent.click(screen.getByTestId('main-menu-settings'))

    expect(screen.getByTestId('main-menu-debug-toggle')).toBeInTheDocument()
    expect(screen.queryByTestId('main-menu-debug-grid-3')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('main-menu-debug-toggle'))

    expect(screen.getByTestId('main-menu-debug-grid-3')).toBeInTheDocument()
    expect(screen.getByTestId('main-menu-debug-grid-4')).toBeInTheDocument()
    expect(screen.getByTestId('main-menu-debug-grid-5')).toBeInTheDocument()
    expect(screen.getByTestId('main-menu-reset-tutorial-progress')).toBeInTheDocument()
  })

  it('resets tutorial progress from debug settings', () => {
    vi.stubGlobal('navigator', { language: 'en' })
    window.localStorage.setItem('cubefight.progress', JSON.stringify({ tutorialCompleted: true, endlessUnlocked: true, bestScore: 4500, preferredGridSize: 3 }))

    render(<App />)

    expect(screen.getByTestId('main-menu-start-endless')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('main-menu-settings'))
    fireEvent.click(screen.getByTestId('main-menu-debug-toggle'))
    fireEvent.click(screen.getByTestId('main-menu-reset-tutorial-progress'))

    expect(screen.getByTestId('main-menu-start')).toBeInTheDocument()
    expect(screen.queryByTestId('main-menu-start-endless')).not.toBeInTheDocument()
  })
})
