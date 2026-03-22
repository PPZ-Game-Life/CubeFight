const fs = require('fs');
const path = require('path');

const LEVELS_FILE = path.join(__dirname, '../config/json/levels.json');
const levelsData = JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8'));

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

function reverseGenerate(levelConfig) {
  const gridSize = levelConfig.gridSize;
  const limits = levelConfig.limits || {};
  let maxSteps = limits.steps || (gridSize === 3 ? 15 : 30);
  const maxBlocks = Math.floor(gridSize * gridSize * gridSize * 0.5); 

  let cubes = [];
  
  const mergeObj = levelConfig.objectives.find(o => o.type === 'merge');
  const devourObj = levelConfig.objectives.find(o => o.type === 'devour');
  const clearRedObj = levelConfig.objectives.find(o => o.type === 'clear_all_red');

  // Set up initial state based on objective
  if (mergeObj) {
    if (mergeObj.targetColor === 'blue') {
      cubes.push({ x: 1, y: 1, z: 1, color: 'blue', level: mergeObj.targetLevel });
    } else {
      cubes.push({ x: 1, y: 1, z: 1, color: 'yellow', level: mergeObj.targetLevel });
      cubes.push({ x: 0, y: 1, z: 1, color: 'blue', level: Math.max(2, mergeObj.targetLevel - 2) });
    }
  } else if (devourObj) {
    // A blue block just devoured the target
    cubes.push({ x: 1, y: 1, z: 1, color: 'blue', level: devourObj.targetLevel + 1 });
    // Simulate reverse devour manually for the first step
    const adj = getAdjacentEmpty(1, 1, 1, cubes, gridSize);
    if (adj.length > 0) {
      cubes[0].x = adj[0].x;
      cubes[0].y = adj[0].y;
      cubes[0].z = adj[0].z;
      cubes.push({ x: 1, y: 1, z: 1, color: devourObj.targetColor, level: devourObj.targetLevel });
    }
  } else {
    // For clear_red or score
    cubes.push({ x: 1, y: 1, z: 1, color: 'blue', level: gridSize === 3 ? 5 : 7 });
  }

  let stepsDone = 0;
  let attempts = 0;
  
  const W_MERGE = 5;
  const W_DEVOUR_RED = clearRedObj ? 5 : 3;
  const W_DEVOUR_YELLOW = 2;

  while (stepsDone < maxSteps && cubes.length < maxBlocks && attempts < maxSteps * 10) {
    attempts++;
    const possibleMoves = [];

    for (let i = 0; i < cubes.length; i++) {
      const cube = cubes[i];
      const adjEmpty = getAdjacentEmpty(cube.x, cube.y, cube.z, cubes, gridSize);
      
      for (const empty of adjEmpty) {
        if (cube.color === 'blue') {
          if (cube.level > 1) {
            possibleMoves.push({ type: 'merge', cubeIndex: i, emptyPos: empty, weight: W_MERGE });
          }
          possibleMoves.push({
            type: 'devour',
            cubeIndex: i,
            emptyPos: empty,
            spawnColor: 'red',
            spawnLevel: getRandomInt(1, Math.max(1, cube.level - 1)),
            weight: W_DEVOUR_RED
          });
          possibleMoves.push({
            type: 'devour',
            cubeIndex: i,
            emptyPos: empty,
            spawnColor: 'yellow',
            spawnLevel: getRandomInt(1, Math.max(1, cube.level - 1)),
            weight: W_DEVOUR_YELLOW
          });
        } else if (cube.color === 'yellow') {
          if (cube.level > 1) {
            possibleMoves.push({ type: 'merge', cubeIndex: i, emptyPos: empty, weight: W_MERGE });
          }
        }
      }
    }

    if (possibleMoves.length === 0) break;

    const totalWeight = possibleMoves.reduce((sum, m) => sum + m.weight, 0);
    let r = Math.random() * totalWeight;
    let selectedMove = possibleMoves[0];
    for (const m of possibleMoves) {
      r -= m.weight;
      if (r <= 0) { selectedMove = m; break; }
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

  // Double check clear_red
  if (clearRedObj && !cubes.some(c => c.color === 'red')) {
    const adj = getAdjacentEmpty(cubes[0].x, cubes[0].y, cubes[0].z, cubes, gridSize);
    if(adj.length > 0) cubes.push({ x: adj[0].x, y: adj[0].y, z: adj[0].z, color: 'red', level: 1 });
  }

  return cubes;
}

for (let i = 0; i < levelsData.levels.length; i++) {
  const level = levelsData.levels[i];
  if (level.id === 1 || level.id === 999) continue;
  level.initialMap = reverseGenerate(level);
}

fs.writeFileSync(LEVELS_FILE, JSON.stringify(levelsData, null, 2));
console.log('Levels successfully regenerated with Improved Reverse Generation Algorithm.');
