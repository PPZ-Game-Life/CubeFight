import React from 'react'
import { Canvas } from '@react-three/fiber'
import { CameraRig } from '../render/components/CameraRig'
import { Effects } from '../render/components/Effects'
import { GridRoot } from '../render/components/GridRoot'
import { Lights } from '../render/components/Lights'
import { TutorialMarkers } from '../render/components/TutorialMarkers'
import { useGameStore } from '../game/state/gameStore'

export function GameCanvas({ interactive = true, allowedCubeIds = null, tutorialMarkerCubeIds = [] }: { interactive?: boolean; allowedCubeIds?: string[] | null; tutorialMarkerCubeIds?: string[] }) {
  const { clearSelection, gridSize, visibleCubes } = useGameStore()

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onPointerMissed={() => {
        if (interactive) {
          clearSelection()
        }
      }}
    >
      <color attach="background" args={['#1a1a2e']} />
      <CameraRig />
      <Lights />
      <GridRoot allowedCubeIds={allowedCubeIds} cubes={visibleCubes} gridSize={gridSize} interactive={interactive} />
      {tutorialMarkerCubeIds.length > 0 ? <TutorialMarkers cubeIds={tutorialMarkerCubeIds} /> : null}
      <Effects />
    </Canvas>
  )
}
