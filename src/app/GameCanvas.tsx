import React from 'react'
import { Canvas } from '@react-three/fiber'
import { CameraRig } from '../render/components/CameraRig'
import { Effects } from '../render/components/Effects'
import { GridRoot } from '../render/components/GridRoot'
import { Lights } from '../render/components/Lights'
import { useGameStore } from '../game/state/gameStore'

export function GameCanvas() {
  const { clearSelection, visibleCubes } = useGameStore()

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onPointerMissed={() => clearSelection()}
    >
      <color attach="background" args={['#1a1a2e']} />
      <CameraRig />
      <Lights />
      <GridRoot cubes={visibleCubes} />
      <Effects />
    </Canvas>
  )
}
