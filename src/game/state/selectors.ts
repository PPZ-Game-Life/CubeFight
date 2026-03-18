import { GRID_SIZE } from '../config/config'
import type { CubeData, SliceState } from '../model/types'

export function isCubeVisible(cube: CubeData, slice: SliceState): boolean {
  if (!slice.axis || slice.index < 0) return true
  return cube[slice.axis] === slice.index
}

export function getActualTopDownLayerIndex(index: number): number {
  return GRID_SIZE - 1 - index
}

export function getScreenColumnMapping(yaw: number): { axis: 'x' | 'z'; order: [number, number, number] } {
  const normalizedYaw = ((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  const quadrant = Math.round(normalizedYaw / (Math.PI / 2)) % 4

  switch (quadrant) {
    case 0:
      return { axis: 'x', order: [0, 1, 2] }
    case 1:
      return { axis: 'z', order: [2, 1, 0] }
    case 2:
      return { axis: 'x', order: [2, 1, 0] }
    case 3:
    default:
      return { axis: 'z', order: [0, 1, 2] }
  }
}
