import React from 'react'
import { GameStoreProvider } from '../game/state/gameStore'
import { LocaleProvider } from '../ui/LocaleProvider'
import { HUD } from '../ui/HUD'
import { SliceControls } from '../ui/SliceControls'
import { GameCanvas } from './GameCanvas'

export function App() {
  return (
    <LocaleProvider>
      <GameStoreProvider>
        <GameCanvas />
        <HUD />
        <SliceControls />
      </GameStoreProvider>
    </LocaleProvider>
  )
}
