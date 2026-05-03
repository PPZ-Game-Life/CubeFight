import React from 'react'
import { Canvas } from '@react-three/fiber'
import { CameraRig } from '../render/components/CameraRig'
import { Effects } from '../render/components/Effects'
import { GridRoot } from '../render/components/GridRoot'
import { Lights } from '../render/components/Lights'
import { TutorialMarkers } from '../render/components/TutorialMarkers'
import { toWorldPosition, useGameStore } from '../game/state/gameStore'

function getDisplayOffset(cubes: ReturnType<typeof useGameStore>['visibleCubes'], gridSize: number): [number, number, number] {
  if (cubes.length <= 1) {
    return cubes.length === 1 ? (() => {
      const [x, y, z] = toWorldPosition(cubes[0].x, cubes[0].y, cubes[0].z, gridSize)
      return [-x, -y, -z] as [number, number, number]
    })() : [0, 0, 0]
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY

  for (const cube of cubes) {
    const [x, y, z] = toWorldPosition(cube.x, cube.y, cube.z, gridSize)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    maxZ = Math.max(maxZ, z)
  }

  return [-(minX + maxX) / 2, -(minY + maxY) / 2, -(minZ + maxZ) / 2]
}

export function GameCanvas({ interactive = true, allowedCubeIds = null, tutorialMarkerCubeIds = [], centerVisibleCubes = false }: { interactive?: boolean; allowedCubeIds?: string[] | null; tutorialMarkerCubeIds?: string[]; centerVisibleCubes?: boolean }) {
  const { clearSelection, gridSize, visibleCubes } = useGameStore()
  const displayOffset = React.useMemo(() => (centerVisibleCubes ? getDisplayOffset(visibleCubes, gridSize) : [0, 0, 0] as [number, number, number]), [centerVisibleCubes, gridSize, visibleCubes])
  const isCoarsePointer = React.useMemo(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }

    return window.matchMedia('(pointer: coarse)').matches
  }, [])
  const dpr = React.useMemo<[number, number]>(() => (isCoarsePointer ? [1, 1.25] : [1, 1.75]), [isCoarsePointer])

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      style={{ background: '#1a1a2e' }}
      onPointerMissed={() => {
        if (interactive) {
          clearSelection()
        }
      }}
    >
      <color attach="background" args={['#1a1a2e']} />
      <CameraRig />
      <Lights />
      <group position={displayOffset}>
        <GridRoot allowedCubeIds={allowedCubeIds} cubes={visibleCubes} gridSize={gridSize} interactive={interactive} reducedQuality={isCoarsePointer} />
        {tutorialMarkerCubeIds.length > 0 ? <TutorialMarkers cubeIds={tutorialMarkerCubeIds} /> : null}
      </group>
      <Effects reducedQuality={isCoarsePointer} />
    </Canvas>
  )
}
