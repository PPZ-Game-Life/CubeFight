import React from 'react'
import type { CubeData } from '../../game/model/types'
import { CubeMesh } from './CubeMesh'

export function GridRoot({ cubes, gridSize, interactive = true, allowedCubeIds }: { cubes: CubeData[]; gridSize: number; interactive?: boolean; allowedCubeIds?: string[] | null }) {
  return (
    <group>
      {cubes.map((cube) => (
        <CubeMesh key={cube.id} allowedCubeIds={allowedCubeIds} cube={cube} gridSize={gridSize} interactive={interactive} />
      ))}
    </group>
  )
}
