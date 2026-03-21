import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import type { Locale } from '../game/model/types'
import { createGameStore, GameStoreContext } from '../game/state/gameStore'
import { LocaleProvider } from './LocaleProvider'
import { SliceControls } from './SliceControls'

function renderWithProviders(options: { locale?: Locale; store?: ReturnType<typeof createGameStore> } = {}) {
  const locale = options.locale ?? 'en'
  const store = options.store ?? createGameStore()

  vi.stubGlobal('navigator', { language: locale })

  return {
    store,
    ...render(
      <LocaleProvider>
        <GameStoreContext.Provider value={store}>
          <SliceControls />
        </GameStoreContext.Provider>
      </LocaleProvider>
    )
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SliceControls', () => {
  it.each([
    ['en', 'Layer', 'Column', 'ALL', 'Reset View'],
    ['zh-CN', '层', '列', 'ALL', '重置视角']
  ] as const)('renders localized slice panels for %s', (locale, layerLabel, columnLabel, allLabel, resetLabel) => {
    renderWithProviders({ locale })

    const layerPanel = screen.getByRole('region', { name: layerLabel })
    const columnPanel = screen.getByRole('region', { name: columnLabel })

    expect(layerPanel).toHaveClass('slice-controls__panel')
    expect(columnPanel).toHaveClass('slice-controls__panel')
    expect(within(layerPanel).getByRole('button', { name: allLabel })).toBeInTheDocument()
    expect(within(columnPanel).getByRole('button', { name: allLabel })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: resetLabel })).toBeInTheDocument()
  })

  it('disables slice controls when an overlay is active', () => {
    const store = createGameStore()
    store.getState().pauseGame()

    const { container } = renderWithProviders({ store })

    expect(container.querySelector('.slice-controls')).toHaveClass('is-disabled')

    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled()
    }
  })

  it('keeps slice callbacks wired through the refreshed controls', () => {
    const store = createGameStore()
    const snapshot = store.getState()
    const showLayerFromTop = vi.fn()
    const showScreenColumn = vi.fn()
    const resetSliceView = vi.fn()
    const resetView = vi.fn()

    Object.assign(snapshot, {
      showLayerFromTop,
      showScreenColumn,
      resetSliceView,
      resetView
    })

    renderWithProviders({ store })

    const layerPanel = screen.getByRole('region', { name: 'Layer' })
    const columnPanel = screen.getByRole('region', { name: 'Column' })

    fireEvent.click(within(layerPanel).getByRole('button', { name: '2' }))
    fireEvent.click(within(columnPanel).getByRole('button', { name: '1' }))
    fireEvent.click(within(layerPanel).getByRole('button', { name: 'ALL' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset View' }))

    expect(showLayerFromTop).toHaveBeenCalledWith(2)
    expect(showScreenColumn).toHaveBeenCalledWith(1)
    expect(resetSliceView).toHaveBeenCalledTimes(1)
    expect(resetView).toHaveBeenCalledTimes(1)
  })
})
