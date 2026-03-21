import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./GameCanvas', () => ({
  GameCanvas: ({ interactive = true }: { interactive?: boolean }) => <div data-interactive={interactive ? 'true' : 'false'} data-testid="game-canvas" />
}))

import { App } from './App'

describe('App main menu flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the main menu first and enters gameplay after pressing play', () => {
    vi.stubGlobal('navigator', { language: 'en' })

    render(<App />)

    expect(screen.getByTestId('main-menu')).toBeInTheDocument()
    expect(screen.getByTestId('main-menu-actions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Skin Shop/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Leaderboard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Settings/i })).toBeInTheDocument()
    expect(screen.queryByTestId('hud-stat-bar')).not.toBeInTheDocument()
    expect(screen.getByTestId('game-canvas')).toHaveAttribute('data-interactive', 'false')

    fireEvent.click(screen.getByTestId('main-menu-start'))

    expect(screen.queryByTestId('main-menu')).not.toBeInTheDocument()
    expect(screen.getByTestId('hud-stat-bar')).toBeInTheDocument()
    expect(screen.getByTestId('slice-controls-root')).toBeInTheDocument()
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
})
