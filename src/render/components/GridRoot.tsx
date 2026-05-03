import React from 'react'
import type { CubeData } from '../../game/model/types'
import { BoardActionEffects } from './BoardActionEffects'
import { CubeMesh } from './CubeMesh'

export function GridRoot({ cubes, gridSize, interactive = true, allowedCubeIds, reducedQuality = false }: { cubes: CubeData[]; gridSize: number; interactive?: boolean; allowedCubeIds?: string[] | null; reducedQuality?: boolean }) {
  return (
    <group>
      <BoardActionEffects />
      {cubes.map((cube) => (
        <CubeMesh key={cube.id} allowedCubeIds={allowedCubeIds} cube={cube} gridSize={gridSize} interactive={interactive} reducedQuality={reducedQuality} />
      ))}
    </group>
  )
}
