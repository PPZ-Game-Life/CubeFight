import type { CubeData, SliceState } from '../model/types'

export function isCubeVisible(cube: CubeData, slice: SliceState): boolean {
  if (!slice.axis || slice.index < 0) return true
  return cube[slice.axis] === slice.index
}

export function getActualTopDownLayerIndex(index: number, gridSize: number): number {
  return gridSize - 1 - index
}

function ascendingOrder(gridSize: number): number[] {
  return Array.from({ length: gridSize }, (_, index) => index)
}

function descendingOrder(gridSize: number): number[] {
  return ascendingOrder(gridSize).reverse()
}

export function getScreenColumnMapping(yaw: number, gridSize: number): { axis: 'x' | 'z'; order: number[] } {
  const normalizedYaw = ((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  const quadrant = Math.round(normalizedYaw / (Math.PI / 2)) % 4

  switch (quadrant) {
    case 0:
      return { axis: 'x', order: ascendingOrder(gridSize) }
    case 1:
      return { axis: 'z', order: descendingOrder(gridSize) }
    case 2:
      return { axis: 'x', order: descendingOrder(gridSize) }
    case 3:
    default:
      return { axis: 'z', order: ascendingOrder(gridSize) }
  }
}
