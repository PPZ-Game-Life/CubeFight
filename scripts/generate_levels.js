import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LEVELS_FILE = path.join(__dirname, '../config/json/levels.json');
const levelsData = JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8'));

// Directions for 3D grid
const DIRS = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1]
];

function getAdjacentEmpty(x, y, z, cubes, gridSize) {
  const empty = [];
  for (const [dx, dy, dz] of DIRS) {
    const nx = x + dx;
    const ny = y + dy;
    const nz = z + dz;
    if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && nz >= 0 && nz < gridSize) {
      if (!cubes.some(c => c.x === nx && c.y === ny && c.z === nz)) {
        empty.push({ x: nx, y: ny, z: nz });
      }
    }
  }
  return empty;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cloneCubes(cubes) {
  return JSON.parse(JSON.stringify(cubes));
}

function reverseGenerate(levelConfig) {
  const gridSize = levelConfig.gridSize;
  const levelId = levelConfig.id;
  
  // Volume of the grid
  const volume = gridSize * gridSize * gridSize;
  
  // Calculate max steps dynamically based on grid size and level id
  // Base reverse steps should scale to fill the space heavily.
  let maxReverseSteps = Math.floor(volume * 2);
  if (levelId <= 3) {
      maxReverseSteps = Math.floor(volume * 1.5);
  } else if (levelId >= 10) {
      maxReverseSteps = Math.floor(volume * 2.5);
  }

  // maxBlocks allows up to 70-80% fill for higher levels
  const fillPercentage = levelId >= 10 ? 0.8 : (levelId >= 6 ? 0.7 : 0.6);
  const maxBlocks = Math.floor(volume * fillPercentage);

  let cubes = [];
  
  // 1. Define initial target state (which is the END of the game)
  let targetLevel = levelId >= 10 ? getRandomInt(7, 9) : (gridSize >= 4 ? getRandomInt(5, 7) : getRandomInt(4, 5));
  let targetColor = 'blue';

  const mergeObj = levelConfig.objectives.find(o => o.type === 'merge');
  if (mergeObj) {
    targetLevel = mergeObj.targetLevel || targetLevel;
    targetColor = mergeObj.targetColor || 'blue';
  }

  const startX = Math.floor(gridSize / 2);
  const startZ = Math.floor(gridSize / 2);

  if (targetColor === 'blue') {
    cubes.push({ x: startX, y: 0, z: startZ, color: 'blue', level: targetLevel });
  } else if (targetColor === 'yellow') {
    cubes.push({ x: startX, y: 0, z: startZ, color: 'yellow', level: targetLevel });
    let bx = startX > 0 ? startX - 1 : startX + 1;
    cubes.push({ x: bx, y: 0, z: startZ, color: 'blue', level: Math.max(2, targetLevel - 2) });
  } else {
    cubes.push({ x: startX, y: 0, z: startZ, color: 'blue', level: targetLevel });
  }

  let stepsDone = 0;
  let attempts = 0;
  const maxAttempts = maxReverseSteps * 10;

  while (stepsDone < maxReverseSteps && cubes.length < maxBlocks && attempts < maxAttempts) {
    attempts++;
    
    // Find all possible reverse moves
    const possibleMoves = [];

    for (let i = 0; i < cubes.length; i++) {
      const cube = cubes[i];
      const adjEmpty = getAdjacentEmpty(cube.x, cube.y, cube.z, cubes, gridSize);
      
      for (const empty of adjEmpty) {
        if (cube.color === 'blue') {
          // Reverse Merge
          if (cube.level > 1) {
            possibleMoves.push({
              type: 'merge',
              cubeIndex: i,
              emptyPos: empty,
              weight: 5 // Higher weight for merging to spawn more blocks quickly
            });
          }
          // Reverse Devour
          possibleMoves.push({
            type: 'devour',
            cubeIndex: i,
            emptyPos: empty,
            spawnColor: 'red',
            spawnLevel: getRandomInt(1, Math.max(1, cube.level - 1)),
            weight: 3
          });
          possibleMoves.push({
            type: 'devour',
            cubeIndex: i,
            emptyPos: empty,
            spawnColor: 'yellow',
            spawnLevel: getRandomInt(1, Math.max(1, cube.level - 1)),
            weight: 2
          });
        } else if (cube.color === 'yellow') {
          // Reverse Merge only
          if (cube.level > 1) {
            possibleMoves.push({
              type: 'merge',
              cubeIndex: i,
              emptyPos: empty,
              weight: 4
            });
          }
        }
      }
    }

    if (possibleMoves.length === 0) break; // Stuck

    // Pick a random move based on weight
    const totalWeight = possibleMoves.reduce((sum, m) => sum + m.weight, 0);
    let r = Math.random() * totalWeight;
    let selectedMove = possibleMoves[0];
    for (const m of possibleMoves) {
      r -= m.weight;
      if (r <= 0) {
        selectedMove = m;
        break;
      }
    }

    const cube = cubes[selectedMove.cubeIndex];

    if (selectedMove.type === 'merge') {
      cube.level -= 1;
      cubes.push({
        x: selectedMove.emptyPos.x,
        y: selectedMove.emptyPos.y,
        z: selectedMove.emptyPos.z,
        color: cube.color,
        level: cube.level
      });
      stepsDone++;
    } else if (selectedMove.type === 'devour') {
      const originalPos = { x: cube.x, y: cube.y, z: cube.z };
      cube.x = selectedMove.emptyPos.x;
      cube.y = selectedMove.emptyPos.y;
      cube.z = selectedMove.emptyPos.z;
      
      cubes.push({
        x: originalPos.x,
        y: originalPos.y,
        z: originalPos.z,
        color: selectedMove.spawnColor,
        level: selectedMove.spawnLevel
      });
      stepsDone++;
    }
  }

  // Ensure objective makes sense
  const clearRedObj = levelConfig.objectives.find(o => o.type === 'clear_all_red');
  if (clearRedObj) {
    const hasRed = cubes.some(c => c.color === 'red');
    if (!hasRed && cubes.length > 0) {
      const candidates = cubes.filter(c => c.color !== 'blue' || c.level === 1);
      if (candidates.length > 0) {
        candidates[0].color = 'red';
      } else {
         const empty = getAdjacentEmpty(cubes[0].x, cubes[0].y, cubes[0].z, cubes, gridSize);
         if(empty.length > 0) {
           cubes.push({ ...empty[0], color: 'red', level: 1 });
         }
      }
    }
  }

  // We should also adjust limits.steps to give player enough steps to complete the level
  if (!levelConfig.limits) {
    levelConfig.limits = {};
  }
  // Base step limit + stepsDone + extra based on grid size to be generous
  levelConfig.limits.steps = Math.max(15, stepsDone + Math.floor(gridSize * 10));

  return cubes;
}

for (let i = 0; i < levelsData.levels.length; i++) {
  const level = levelsData.levels[i];
  if (level.id === 1 || level.id === 999) continue;
  
  // Apply gridSize progression logic based on level.id
  if (level.id === 2) {
    level.gridSize = 2;
  } else if (level.id >= 3 && level.id <= 5) {
    level.gridSize = 3;
  } else if (level.id >= 6 && level.id <= 9) {
    level.gridSize = 4;
  } else if (level.id >= 10) {
    level.gridSize = 5;
  }
  
  level.initialMap = reverseGenerate(level);
}

fs.writeFileSync(LEVELS_FILE, JSON.stringify(levelsData, null, 2));
console.log('Levels successfully regenerated with adjusted gridSize and step generation.');
