import React from 'react'

import { useGameStore } from '../game/state/gameStore'
import { audioManager } from './audioManager'

function sumRecordValues(record: Record<string, number>) {
  return Object.values(record).reduce((total, value) => total + value, 0)
}

function getLatestIncrementKey(previous: Record<string, number>, current: Record<string, number>) {
  for (const [key, value] of Object.entries(current)) {
    if (value > (previous[key] ?? 0)) {
      return key
    }
  }

  return null
}

export function AudioRuntime({ scene }: { scene: 'menu' | 'game' }) {
  const snapshot = useGameStore()
  const previousRef = React.useRef({
    selectedCubeId: snapshot.selectedCubeId,
    comboCount: snapshot.comboCount,
    mergeCounts: snapshot.actionStats.mergeCounts,
    devourCounts: snapshot.actionStats.devourCounts
  })

  React.useEffect(() => {
    void audioManager.warmup()

    const unlock = () => {
      void audioManager.unlock()
    }

    const onVisibilityChange = () => {
      void audioManager.setVisibilityHidden(document.visibilityState === 'hidden')
    }

    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock)
    document.addEventListener('visibilitychange', onVisibilityChange)
    onVisibilityChange()

    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  React.useEffect(() => {
    void audioManager.setScene(scene)
  }, [scene])

  React.useEffect(() => {
    const intense = scene === 'game' && (snapshot.comboCount >= 3 || snapshot.cubes.length / Math.pow(snapshot.gridSize, 3) >= 0.7)
    audioManager.setGameIntensity(intense)
  }, [scene, snapshot.comboCount, snapshot.cubes.length, snapshot.gridSize])

  React.useEffect(() => {
    if (scene !== 'game') {
      previousRef.current = {
        selectedCubeId: snapshot.selectedCubeId,
        comboCount: snapshot.comboCount,
        mergeCounts: snapshot.actionStats.mergeCounts,
        devourCounts: snapshot.actionStats.devourCounts
      }
      return
    }

    const previous = previousRef.current

    if (snapshot.selectedCubeId && snapshot.selectedCubeId !== previous.selectedCubeId) {
      void audioManager.playSelect()
    }

    const previousMergeTotal = sumRecordValues(previous.mergeCounts)
    const currentMergeTotal = sumRecordValues(snapshot.actionStats.mergeCounts)
    if (currentMergeTotal > previousMergeTotal && snapshot.mergeAnimation) {
      void audioManager.playMerge(snapshot.mergeAnimation.nextLevel)
    }

    const previousDevourTotal = sumRecordValues(previous.devourCounts)
    const currentDevourTotal = sumRecordValues(snapshot.actionStats.devourCounts)
    if (currentDevourTotal > previousDevourTotal) {
      const latestDevourKey = getLatestIncrementKey(previous.devourCounts, snapshot.actionStats.devourCounts)
      if (latestDevourKey?.startsWith('red:')) {
        void audioManager.playDevourRed()
      } else if (latestDevourKey?.startsWith('yellow:')) {
        void audioManager.playDevourYellow()
      }
    }

    if (snapshot.comboCount > previous.comboCount && snapshot.comboCount >= 2) {
      void audioManager.playCombo(snapshot.comboCount)
    }

    previousRef.current = {
      selectedCubeId: snapshot.selectedCubeId,
      comboCount: snapshot.comboCount,
      mergeCounts: snapshot.actionStats.mergeCounts,
      devourCounts: snapshot.actionStats.devourCounts
    }
  }, [snapshot])

  return null
}
