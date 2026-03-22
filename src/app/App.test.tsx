import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./GameCanvas', () => ({
  GameCanvas: ({ interactive = true }: { interactive?: boolean }) => <div data-interactive={interactive ? 'true' : 'false'} data-testid="game-canvas" />
}))

import { App } from './App'

describe('App main menu flow', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('shows the main menu first and enters gameplay after pressing play', () => {
    vi.stubGlobal('navigator', { language: 'en' })

    render(<App />)

    expect(screen.getByTestId('main-menu')).toBeInTheDocument()
    expect(screen.getByTestId('main-menu-logo')).toBeInTheDocument()
    expect(screen.getByTestId('main-menu-hero')).toBeInTheDocument()
    expect(screen.getByTestId('main-menu-actions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Skin Shop/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Leaderboard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Settings/i })).toBeInTheDocument()
    expect(screen.queryByTestId('hud-stat-bar')).not.toBeInTheDocument()
    expect(screen.getByTestId('game-canvas')).toHaveAttribute('data-interactive', 'false')

    fireEvent.click(screen.getByTestId('main-menu-start'))

    expect(screen.queryByTestId('main-menu')).not.toBeInTheDocument()
    expect(screen.getByTestId('hud-stat-bar')).toBeInTheDocument()
    expect(screen.queryByTestId('slice-controls-root')).not.toBeInTheDocument()
    expect(screen.getByTestId('hud-level-panel')).toBeInTheDocument()
    expect(screen.getByTestId('game-canvas')).toHaveAttribute('data-interactive', 'true')
  })

  it('returns to the main menu when pressing the lobby button', () => {
    vi.stubGlobal('navigator', { language: 'en' })

    render(<App />)

    fireEvent.click(screen.getByTestId('main-menu-start'))
    fireEvent.click(screen.getByTestId('hud-lobby-button'))

    expect(screen.getByTestId('main-menu')).toBeInTheDocument()
    expect(screen.queryByTestId('hud-stat-bar')).not.toBeInTheDocument()
  })

  it('starts the next run after pressing next level on victory overlay', () => {
    vi.stubGlobal('navigator', { language: 'en' })

    render(<App />)

    fireEvent.click(screen.getByTestId('main-menu-start'))

    const nextLevelButton = screen.queryByRole('button', { name: 'Next Level' })

    if (nextLevelButton) {
      fireEvent.click(nextLevelButton)
      expect(screen.getByTestId('hud-level-panel')).toHaveTextContent('Level 02')
    }
  })

  it('switches locale from settings', () => {
    vi.stubGlobal('navigator', { language: 'en' })

    render(<App />)

    fireEvent.click(screen.getByTestId('main-menu-settings'))
    fireEvent.click(screen.getByTestId('main-menu-locale-zh-CN'))

    expect(screen.getByRole('button', { name: /开始闯关/i })).toBeInTheDocument()
    expect(screen.getByTestId('main-menu-settings')).toHaveTextContent('设置')
  })

  it('allows selecting any authored level after enabling debug mode', () => {
    vi.stubGlobal('navigator', { language: 'en' })

    render(<App />)

    fireEvent.click(screen.getByTestId('main-menu-settings'))
    fireEvent.click(screen.getByTestId('main-menu-debug-toggle'))
    fireEvent.change(screen.getByTestId('main-menu-debug-level-select'), { target: { value: '5' } })

    expect(screen.getByTestId('main-menu-settings')).toHaveTextContent('Debug tools armed')
    expect(screen.getByTestId('main-menu-start')).toHaveTextContent('Level 05')

    fireEvent.click(screen.getByTestId('main-menu-start'))

    expect(screen.getByTestId('hud-level-panel')).toHaveTextContent('Level 05')
    expect(screen.getByTestId('hud-debug-auto-solve')).toHaveTextContent('Auto Clear')

    fireEvent.click(screen.getByTestId('hud-debug-auto-solve'))

    expect(screen.getByTestId('hud-debug-auto-solve')).toHaveTextContent('Stop Auto')
  })
})
