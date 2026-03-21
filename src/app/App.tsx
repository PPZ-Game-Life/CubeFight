import React from 'react'
import type { GameStoreSnapshot } from '../game/state/gameStore'
import { GameStoreProvider } from '../game/state/gameStore'
import { useGameStore } from '../game/state/gameStore'
import { getVisibleValidTargets } from '../game/state/demoRules'
import { LocaleProvider } from '../ui/LocaleProvider'
import { HUD } from '../ui/HUD'
import { MainMenu } from '../ui/MainMenu'
import { SliceControls } from '../ui/SliceControls'
import { GameCanvas } from './GameCanvas'

function pickMenuDemoMove(snapshot: GameStoreSnapshot): { sourceId: string; targetId: string } | null {
  const visiblePlayableCubes = snapshot.visibleCubes.filter((cube) => cube.color === 'blue' || cube.color === 'yellow')
  const candidates = visiblePlayableCubes.flatMap((source) => {
    const targets = getVisibleValidTargets(snapshot.cubes, source.id, snapshot.slice)
      .map((targetId) => snapshot.cubes.find((cube) => cube.id === targetId))
      .filter((target): target is NonNullable<typeof target> => Boolean(target))

    return targets.map((target) => ({
      sourceId: source.id,
      targetId: target.id,
      priority: target.color === source.color ? 2 : 1,
      score: source.level + target.level
    }))
  })

  if (candidates.length === 0) {
    return null
  }

  candidates.sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority
    }

    return right.score - left.score
  })

  return { sourceId: candidates[0].sourceId, targetId: candidates[0].targetId }
}

function AppShell() {
  const [showMainMenu, setShowMainMenu] = React.useState(true)
  const snapshot = useGameStore()
  const { clearSelection, commitBoardAction, overlay, restartDemo, runState, selectCube, selectedCubeId, validTargetIds } = snapshot

  const handleBackToLobby = React.useCallback(() => {
    restartDemo()
    setShowMainMenu(true)
  }, [restartDemo])

  const handleStartGame = React.useCallback(() => {
    restartDemo()
    setShowMainMenu(false)
  }, [restartDemo])

  React.useEffect(() => {
    if (!showMainMenu) {
      return
    }

    const delayMs = selectedCubeId ? 820 : 1320
    const timer = globalThis.setTimeout(() => {
      if (overlay !== 'none') {
        restartDemo()
        return
      }

      if (runState === 'resolving' || runState === 'paused') {
        return
      }

      if (selectedCubeId) {
        if (validTargetIds.length > 0) {
          commitBoardAction(validTargetIds[0])
        } else {
          clearSelection()
        }

        return
      }

      const move = pickMenuDemoMove(snapshot)
      if (!move) {
        restartDemo()
        return
      }

      selectCube(move.sourceId)
    }, delayMs)

    return () => globalThis.clearTimeout(timer)
  }, [clearSelection, commitBoardAction, overlay, restartDemo, runState, selectCube, selectedCubeId, showMainMenu, snapshot, validTargetIds])

  return (
    <>
      <GameCanvas interactive={!showMainMenu} />
      {showMainMenu ? <MainMenu onStart={handleStartGame} /> : null}
      {showMainMenu ? null : <HUD onBackToLobby={handleBackToLobby} />}
      {showMainMenu ? null : <SliceControls />}
    </>
  )
}

export function App() {
  return (
    <LocaleProvider>
      <GameStoreProvider>
        <AppShell />
      </GameStoreProvider>
    </LocaleProvider>
  )
}
