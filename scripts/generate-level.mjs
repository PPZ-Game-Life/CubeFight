import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_GRID_SIZE = 3

function parseArgs(argv) {
  const args = {
    level: 101,
    name: 'generated_level',
    color: 'blue',
    targetLevel: 9,
    steps: 12,
    gridSize: DEFAULT_GRID_SIZE,
    cells: 24,
    mode: 'static',
    output: null
  }

  for (let index = 2; index < argv.length; index += 1) {
    const [key, rawValue] = argv[index].split('=')
    const value = rawValue ?? argv[index + 1]

    if (rawValue === undefined) {
      index += 1
    }

    if (key === '--level') args.level = Number(value)
    if (key === '--name') args.name = value
    if (key === '--color') args.color = value
    if (key === '--target-level') args.targetLevel = Number(value)
    if (key === '--steps') args.steps = Number(value)
    if (key === '--grid-size') args.gridSize = Number(value)
    if (key === '--cells') args.cells = Number(value)
    if (key === '--mode') args.mode = value
    if (key === '--output') args.output = value
  }

  return args
}

function makeCellKey(cell) {
  return `${cell.x}:${cell.y}:${cell.z}`
}

function neighbors(cell, gridSize) {
  return [
    { x: cell.x + 1, y: cell.y, z: cell.z },
    { x: cell.x - 1, y: cell.y, z: cell.z },
    { x: cell.x, y: cell.y + 1, z: cell.z },
    { x: cell.x, y: cell.y - 1, z: cell.z },
    { x: cell.x, y: cell.y, z: cell.z + 1 },
    { x: cell.x, y: cell.y, z: cell.z - 1 }
  ].filter((candidate) => candidate.x >= 0 && candidate.y >= 0 && candidate.z >= 0 && candidate.x < gridSize && candidate.y < gridSize && candidate.z < gridSize)
}

function firstFreeNeighbor(cell, occupied, gridSize) {
  return neighbors(cell, gridSize).find((candidate) => !occupied.has(makeCellKey(candidate))) ?? null
}

function buildReverseSolvedTree({ color, targetLevel, steps, gridSize, cells }) {
  const occupied = new Set()
  const cubes = [{ x: Math.floor(gridSize / 2), y: Math.floor(gridSize / 2), z: Math.floor(gridSize / 2), color, level: targetLevel }]
  occupied.add(makeCellKey(cubes[0]))
  const reverseSteps = []

  while (reverseSteps.length < steps) {
    const candidateIndex = cubes.findIndex((cube) => cube.color === color && cube.level > 1)
    if (candidateIndex === -1) {
      break
    }

    const source = cubes[candidateIndex]
    const partner = firstFreeNeighbor(source, occupied, gridSize)
    if (!partner) {
      break
    }

    cubes[candidateIndex] = { ...source, level: source.level - 1 }
    const partnerCube = { ...partner, color, level: source.level - 1 }
    cubes.push(partnerCube)
    occupied.add(makeCellKey(partnerCube))

    reverseSteps.push({
      action: 'split_merge',
      from: { x: source.x, y: source.y, z: source.z, color, level: source.level },
      into: [cubes[candidateIndex], partnerCube]
    })

    if (cubes.length >= cells) {
      break
    }

    const preyCell = firstFreeNeighbor(partnerCube, occupied, gridSize)
    if (!preyCell) {
      continue
    }

    const preyColor = reverseSteps.length % 2 === 0 ? 'red' : 'yellow'
    const preyCube = { ...preyCell, color: preyColor, level: partnerCube.level }
    cubes.push(preyCube)
    occupied.add(makeCellKey(preyCube))
    reverseSteps.push({
      action: 'split_devour',
      survivor: { ...partnerCube },
      prey: preyCube
    })

    if (cubes.length >= cells) {
      break
    }
  }

  return {
    initialMap: cubes.sort((left, right) => left.y - right.y || left.z - right.z || left.x - right.x),
    reverseSteps,
    forwardHint: [...reverseSteps].reverse()
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const generated = buildReverseSolvedTree(args)
  const level = {
    id: args.level,
    name: args.name,
    gridSize: args.gridSize,
    spawnMode: args.mode,
    objectives: [{ type: 'merge', targetColor: args.color, targetLevel: args.targetLevel }],
    limits: args.steps > 0 ? { steps: args.steps * 2 } : null,
    initialMap: generated.initialMap,
    dynamicParams: null,
    reward: { coins: args.targetLevel * 40 },
    generatedHintPath: generated.forwardHint
  }

  const content = JSON.stringify(level, null, 2)
  if (args.output) {
    const outputPath = path.resolve(process.cwd(), args.output)
    await fs.writeFile(outputPath, content)
    console.log(`Wrote generated level to ${outputPath}`)
    return
  }

  console.log(content)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
