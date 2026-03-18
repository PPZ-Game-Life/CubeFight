import React from 'react'
import type { CubeData } from '../../game/model/types'
import { CubeMesh } from './CubeMesh'

export function GridRoot({ cubes }: { cubes: CubeData[] }) {
  return (
    <group>
      {cubes.map((cube) => (
        <CubeMesh key={cube.id} cube={cube} />
      ))}
    </group>
  )
}
