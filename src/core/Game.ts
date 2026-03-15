import { SceneManager } from './SceneManager';
import { InputManager } from './InputManager';
import { Grid3D } from '../entities/Grid3D';
import { Cube } from '../entities/Cube';
import { CubeColor, CubeState, CONFIG, GameMode, LEVEL_VALUES } from './Config';
import { SliceSystem } from '../systems/SliceSystem';

/**
 * 游戏主控制器
 * 基于设计文档重新实现,整合双轨经济、Combo系统、动态刷新等核心功能
 */
export class Game {
  private sceneManager: SceneManager;
  private inputManager: InputManager;
  private grid: Grid3D;
  private sliceSystem: SliceSystem;
  
  private selectedCube: Cube | null = null;
  private highlightedCubes: Cube[] = [];
  
  // 双轨经济系统
  private score: number = 0;      // 积分(荣誉数值,用于排行榜)
  private coins: number = 0;      // 金币(购买力,用于买皮肤)
  
  // Combo系统
  private comboCount: number = 0;
  private lastActionTime: number = 0;
  
  // 游戏状态
  private isRunning: boolean = false;
  private gameMode: GameMode = GameMode.ENDLESS;
  
  // 动态刷新系统(无尽模式)
  private spawnTimer: number = 0;
  private spawnInterval: number = 2000; // 2秒刷新一次红块

  constructor(container: HTMLElement) {
    this.sceneManager = new SceneManager(container);
    this.inputManager = new InputManager(this.sceneManager);
    this.grid = new Grid3D();
    this.sliceSystem = new SliceSystem(this.grid);

    this.inputManager.onCubeClick(this.handleCubeClick.bind(this));
    this.init();
  }

  /**
   * 初始化游戏
   */
  private init() {
    console.log('🎮 CubeFight 初始化中...');
    
    // 创建初始方块阵列
    this.createInitialCubes();
    
    console.log('✅ 游戏初始化完成');
  }

  /**
   * 创建初始方块(无尽模式起手配置)
   */
  private createInitialCubes() {
    // 生成完整的3x3x3=27个方块
    const initialSetup = [
      // 底层 (y=0) - 9个方块
      { color: CubeColor.BLUE, level: 1, x: 0, y: 0, z: 0 },
      { color: CubeColor.BLUE, level: 1, x: 1, y: 0, z: 0 },
      { color: CubeColor.YELLOW, level: 1, x: 2, y: 0, z: 0 },
      { color: CubeColor.BLUE, level: 1, x: 0, y: 0, z: 1 },
      { color: CubeColor.RED, level: 1, x: 1, y: 0, z: 1 },
      { color: CubeColor.YELLOW, level: 1, x: 2, y: 0, z: 1 },
      { color: CubeColor.YELLOW, level: 1, x: 0, y: 0, z: 2 },
      { color: CubeColor.BLUE, level: 1, x: 1, y: 0, z: 2 },
      { color: CubeColor.RED, level: 1, x: 2, y: 0, z: 2 },
      
      // 中层 (y=1) - 9个方块
      { color: CubeColor.BLUE, level: 2, x: 0, y: 1, z: 0 },
      { color: CubeColor.YELLOW, level: 1, x: 1, y: 1, z: 0 },
      { color: CubeColor.BLUE, level: 1, x: 2, y: 1, z: 0 },
      { color: CubeColor.RED, level: 1, x: 0, y: 1, z: 1 },
      { color: CubeColor.YELLOW, level: 1, x: 1, y: 1, z: 1 },
      { color: CubeColor.YELLOW, level: 2, x: 2, y: 1, z: 1 },
      { color: CubeColor.BLUE, level: 1, x: 0, y: 1, z: 2 },
      { color: CubeColor.RED, level: 1, x: 1, y: 1, z: 2 },
      { color: CubeColor.BLUE, level: 1, x: 2, y: 1, z: 2 },
      
      // 顶层 (y=2) - 9个方块
      { color: CubeColor.YELLOW, level: 1, x: 0, y: 2, z: 0 },
      { color: CubeColor.BLUE, level: 1, x: 1, y: 2, z: 0 },
      { color: CubeColor.RED, level: 1, x: 2, y: 2, z: 0 },
      { color: CubeColor.RED, level: 1, x: 0, y: 2, z: 1 },
      { color: CubeColor.BLUE, level: 1, x: 1, y: 2, z: 1 },
      { color: CubeColor.YELLOW, level: 1, x: 2, y: 2, z: 1 },
      { color: CubeColor.BLUE, level: 1, x: 0, y: 2, z: 2 },
      { color: CubeColor.BLUE, level: 1, x: 1, y: 2, z: 2 },
      { color: CubeColor.RED, level: 1, x: 2, y: 2, z: 2 }
    ];

    for (const setup of initialSetup) {
      const cube = new Cube(setup.color, setup.level, setup.x, setup.y, setup.z);
      this.grid.setCube(setup.x, setup.y, setup.z, cube);
      this.sceneManager.add(cube.mesh);
    }
    
    console.log(`✅ 初始化完成: 生成了 ${initialSetup.length} 个方块 (3x3x3=27)`);
  }

  /**
   * 处理方块点击
   */
  private handleCubeClick(cube: Cube) {
    console.log(`点击方块: ${cube.color} Lv.${cube.level} at (${cube.gridX}, ${cube.gridY}, ${cube.gridZ})`);

    // 如果没有选中方块,则选中当前方块
    if (!this.selectedCube) {
      // 可以选中蓝色方块或黄色方块
      if (cube.color === CubeColor.BLUE || cube.color === CubeColor.YELLOW) {
        this.selectCube(cube);
      }
      return;
    }

    // 如果点击的是已选中的方块,取消选中
    if (this.selectedCube === cube) {
      this.deselectCube();
      return;
    }

    // 尝试执行操作(合成或吞噬)
    this.tryAction(this.selectedCube, cube);
  }

  /**
   * 选中方块
   */
  private selectCube(cube: Cube) {
    this.selectedCube = cube;
    cube.setSelected(true);
    
    // 智能高亮:显示可操作的相邻方块
    this.highlightValidTargets(cube);
  }

  /**
   * 取消选中
   */
  private deselectCube() {
    if (this.selectedCube) {
      this.selectedCube.setSelected(false);
      this.selectedCube = null;
    }
    
    this.clearHighlights();
  }

  /**
   * 智能高亮系统:高亮可操作方块,灰显不可操作方块
   */
  private highlightValidTargets(sourceCube: Cube) {
    const neighbors = this.grid.getNeighbors(sourceCube.gridX, sourceCube.gridY, sourceCube.gridZ);
    const validTargets: Cube[] = [];

    for (const neighbor of neighbors) {
      const isValid = this.canPerformAction(sourceCube, neighbor.cube);
      
      if (isValid) {
        neighbor.cube.setHighlight(true);
        validTargets.push(neighbor.cube);
      } else {
        neighbor.cube.setDimmed(true);
      }
    }

    this.highlightedCubes = validTargets;

    // 灰显所有非相邻方块
    this.grid.getAllCubes().forEach(cube => {
      if (cube !== sourceCube && !neighbors.find(n => n.cube === cube)) {
        cube.setDimmed(true);
      }
    });
  }

  /**
   * 清除所有高亮效果
   */
  private clearHighlights() {
    this.highlightedCubes.forEach(cube => cube.setHighlight(false));
    this.highlightedCubes = [];
    
    this.grid.getAllCubes().forEach(cube => cube.setDimmed(false));
  }

  /**
   * 检查是否可以执行操作
   */
  private canPerformAction(sourceCube: Cube, targetCube: Cube): boolean {
    if (sourceCube.color === CubeColor.BLUE) {
      // 合成:蓝+蓝,同等级
      if (targetCube.color === CubeColor.BLUE && sourceCube.level === targetCube.level) {
        return true;
      }

      // 吞噬:蓝吃红/黄,蓝的等级 >= 目标等级
      if ((targetCube.color === CubeColor.RED || targetCube.color === CubeColor.YELLOW) &&
          sourceCube.level >= targetCube.level) {
        return true;
      }
    }

    // 黄块合成:黄+黄,同等级
    if (sourceCube.color === CubeColor.YELLOW && targetCube.color === CubeColor.YELLOW &&
        sourceCube.level === targetCube.level) {
      return true;
    }

    return false;
  }

  /**
   * 尝试执行操作
   */
  private tryAction(sourceCube: Cube, targetCube: Cube) {
    if (!this.isAdjacent(sourceCube, targetCube)) {
      console.log('❌ 方块不相邻');
      this.deselectCube();
      return;
    }

    // 蓝色方块的操作
    if (sourceCube.color === CubeColor.BLUE) {
      // 合成:蓝+蓝
      if (targetCube.color === CubeColor.BLUE && sourceCube.level === targetCube.level) {
        this.mergeCubes(sourceCube, targetCube);
        return;
      }

      // 吞噬:蓝吃红/黄
      if ((targetCube.color === CubeColor.RED || targetCube.color === CubeColor.YELLOW) &&
          sourceCube.level >= targetCube.level) {
        this.devourCube(sourceCube, targetCube);
        return;
      }
    }

    // 黄色方块合成
    if (sourceCube.color === CubeColor.YELLOW && targetCube.color === CubeColor.YELLOW &&
        sourceCube.level === targetCube.level) {
      this.mergeCubes(sourceCube, targetCube);
      return;
    }

    console.log('❌ 无法执行操作');
    this.deselectCube();
  }

  /**
   * 检查两个方块是否相邻
   */
  private isAdjacent(cube1: Cube, cube2: Cube): boolean {
    const dx = Math.abs(cube1.gridX - cube2.gridX);
    const dy = Math.abs(cube1.gridY - cube2.gridY);
    const dz = Math.abs(cube1.gridZ - cube2.gridZ);

    return (dx === 1 && dy === 0 && dz === 0) ||
           (dx === 0 && dy === 1 && dz === 0) ||
           (dx === 0 && dy === 0 && dz === 1);
  }

  /**
   * 合成方块
   */
  private async mergeCubes(cube1: Cube, cube2: Cube) {
    console.log('✨ 合成中...');

    // 移除cube2
    this.grid.setCube(cube2.gridX, cube2.gridY, cube2.gridZ, null);
    await cube2.destroy();
    this.sceneManager.remove(cube2.mesh);

    // cube1升级
    cube1.levelUp();
    this.deselectCube();

    // 增加积分(带Combo)
    const baseScore = LEVEL_VALUES.SCORE[cube1.level - 1] || 10;
    this.addScoreWithCombo(baseScore);
    this.updateCombo();

    // 无尽模式:操作后刷新红块
    if (this.gameMode === GameMode.ENDLESS) {
      this.spawnRedCube();
    }
  }

  /**
   * 吞噬方块
   */
  private async devourCube(blueCube: Cube, targetCube: Cube) {
    console.log('💥 吞噬中...');

    const targetX = targetCube.gridX;
    const targetY = targetCube.gridY;
    const targetZ = targetCube.gridZ;
    const targetColor = targetCube.color;
    const targetLevel = targetCube.level;

    // 移除目标方块
    this.grid.setCube(targetX, targetY, targetZ, null);
    await targetCube.destroy();
    this.sceneManager.remove(targetCube.mesh);

    // 蓝色方块移动到目标位置
    this.grid.setCube(blueCube.gridX, blueCube.gridY, blueCube.gridZ, null);
    await blueCube.moveTo(targetX, targetY, targetZ);
    this.grid.setCube(targetX, targetY, targetZ, blueCube);

    this.deselectCube();

    // 增加积分和金币(基于EconomyAndNumbers.md)
    const baseScore = LEVEL_VALUES.SCORE[targetLevel - 1] || 10;
    this.addScoreWithCombo(baseScore);

    // 吃黄块掉落金币
    if (targetColor === CubeColor.YELLOW) {
      const coinReward = LEVEL_VALUES.COIN[targetLevel - 1] || 1;
      this.addCoins(coinReward);
      console.log(`💰 获得金币: +${coinReward}`);
    }

    this.updateCombo();

    // 无尽模式:操作后刷新红块
    if (this.gameMode === GameMode.ENDLESS) {
      this.spawnRedCube();
    }
  }

  /**
   * 更新Combo系统
   */
  private updateCombo() {
    const now = Date.now();
    
    if (now - this.lastActionTime > CONFIG.COMBO_TIMEOUT) {
      this.comboCount = 0;
    }
    
    this.comboCount++;
    this.lastActionTime = now;
    
    if (this.comboCount > 1) {
      this.showComboText(this.comboCount);
    }
  }

  /**
   * 显示Combo文字
   */
  private showComboText(combo: number) {
    const comboTexts = [
      '', '', 'Nice!', 'Great!', 'Awesome!', 'Amazing!', 'Godlike!'
    ];
    const text = combo < comboTexts.length ? comboTexts[combo] : 'UNSTOPPABLE!';
    
    console.log(`🔥 COMBO x${combo} - ${text}`);
    // TODO: 实现UI显示
  }

  /**
   * 带Combo的分数增加
   */
  private addScoreWithCombo(baseScore: number) {
    const multiplier = Math.max(1, this.comboCount);
    const finalScore = baseScore * multiplier;
    this.score += finalScore;
    
    console.log(`+${finalScore} 积分 (x${multiplier})`);
    this.updateScoreUI();
  }

  /**
   * 增加金币
   */
  private addCoins(amount: number) {
    this.coins += amount;
    this.updateCoinsUI();
  }

  /**
   * 更新分数UI
   */
  private updateScoreUI() {
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
      scoreElement.textContent = `Score: ${this.score} | Coins: ${this.coins}`;
    }
  }

  /**
   * 更新金币UI
   */
  private updateCoinsUI() {
    this.updateScoreUI();
  }

  /**
   * 刷新红块(无尽模式)
   */
  private spawnRedCube() {
    const emptyPositions = this.grid.getEmptyPositions();
    if (emptyPositions.length === 0) {
      console.log('⚠️ 没有空位,检查Game Over');
      this.checkGameOver();
      return;
    }

    // 随机选择一个空位
    const pos = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
    
    // 红块等级 = [1, Max(1, 场上最高蓝块等级 - 1)]
    const maxBlueLevel = this.getMaxBlueLevelOnGrid();
    const minLevel = 1;
    const maxLevel = Math.max(1, maxBlueLevel - 1);
    const level = Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;

    const redCube = new Cube(CubeColor.RED, level, pos.x, pos.y, pos.z);
    this.grid.setCube(pos.x, pos.y, pos.z, redCube);
    this.sceneManager.add(redCube.mesh);

    console.log(`🔴 生成红块 Lv.${level} at (${pos.x}, ${pos.y}, ${pos.z})`);
  }

  /**
   * 获取场上最高蓝块等级
   */
  private getMaxBlueLevelOnGrid(): number {
    let maxLevel = 1;
    this.grid.getAllCubes().forEach(cube => {
      if (cube.color === CubeColor.BLUE && cube.level > maxLevel) {
        maxLevel = cube.level;
      }
    });
    return maxLevel;
  }

  /**
   * 检查Game Over
   */
  private checkGameOver() {
    if (this.grid.isFull() && !this.hasValidMoves()) {
      console.log('💀 Game Over!');
      this.pause();
      // TODO: 显示Game Over界面
    }
  }

  /**
   * 检查是否还有有效操作
   */
  private hasValidMoves(): boolean {
    const allCubes = this.grid.getAllCubes();
    
    for (const cube of allCubes) {
      if (cube.color !== CubeColor.BLUE) continue;
      
      const neighbors = this.grid.getNeighbors(cube.gridX, cube.gridY, cube.gridZ);
      for (const neighbor of neighbors) {
        if (this.canPerformAction(cube, neighbor.cube)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * 重置视角
   */
  resetView() {
    this.inputManager.resetView();
    this.sliceSystem.resetView();
  }

  /**
   * 切换切面视图
   */
  showSlice(axis: 'x' | 'y' | 'z', index: number) {
    this.sliceSystem.showSlice(axis, index);
  }

  /**
   * 开始游戏循环
   */
  start() {
    this.isRunning = true;
    this.gameLoop();
  }

  /**
   * 游戏循环
   */
  private gameLoop() {
    if (!this.isRunning) return;

    this.inputManager.update();
    
    // 检查Combo超时
    if (this.comboCount > 0 && Date.now() - this.lastActionTime > CONFIG.COMBO_TIMEOUT) {
      console.log(`Combo断了!最高连击: x${this.comboCount}`);
      this.comboCount = 0;
    }

    this.sceneManager.render();
    requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * 暂停游戏
   */
  pause() {
    this.isRunning = false;
  }

  /**
   * 恢复游戏
   */
  resume() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.gameLoop();
    }
  }
}
