import { SceneManager } from './SceneManager';
import { InputManager } from './InputManager';
import { Grid3D } from '../entities/Grid3D';
import { Cube } from '../entities/Cube';
import { CubeColor, CubeState, CONFIG, GameMode, RefreshMode } from './Config';
import { SliceSystem } from '../systems/SliceSystem';
import { GameStateManager } from './GameStateManager';
import { MergeSystem } from '../systems/MergeSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { RedBlockSpawner } from '../systems/RedBlockSpawner';
import { ItemSystem } from '../systems/ItemSystem';

/**
 * 游戏主控制器 - 完整重新实现
 */
export class Game {
  private sceneManager: SceneManager;
  private inputManager: InputManager;
  private grid: Grid3D;
  private sliceSystem: SliceSystem;
  
  // 游戏系统
  private gameState: GameStateManager;
  private mergeSystem: MergeSystem;
  private combatSystem: CombatSystem;
  private redBlockSpawner: RedBlockSpawner;
  private itemSystem: ItemSystem;
  
  // 交互状态
  private selectedCube: Cube | null = null;
  private highlightedCubes: Cube[] = [];
  private isRunning: boolean = false;
  
  // 游戏模式
  private gameMode: GameMode = GameMode.ENDLESS;

  constructor(container: HTMLElement) {
    // 初始化管理器
    this.sceneManager = new SceneManager(container);
    this.inputManager = new InputManager(this.sceneManager);
    this.grid = new Grid3D();
    this.sliceSystem = new SliceSystem(this.grid);
    
    // 初始化游戏系统
    this.gameState = new GameStateManager();
    this.mergeSystem = new MergeSystem(this.gameState);
    this.combatSystem = new CombatSystem(this.gameState);
    this.redBlockSpawner = new RedBlockSpawner(this.grid, this.gameState);
    this.itemSystem = new ItemSystem();

    // 设置输入回调
    this.inputManager.onCubeClick(this.handleCubeClick.bind(this));

    // 初始化游戏
    this.init();
  }

  /**
   * 初始化游戏
   */
  private init() {
    console.log('🎮 CubeFight 初始化中...');
    
    // 设置游戏模式为无尽模式
    this.gameState.setGameMode(GameMode.ENDLESS);
    this.gameMode = GameMode.ENDLESS;
    
    // 创建初始方块阵列
    this.createInitialCubes();
    
    console.log('✅ 游戏初始化完成');
  }

  /**
   * 创建初始方块阵列
   */
  private createInitialCubes() {
    // 无尽模式：随机生成蓝块和黄块，少量红块
    const colors = [CubeColor.BLUE, CubeColor.YELLOW];
    let cubeCount = 0;
    
    for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
      for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
        for (let z = 0; z < CONFIG.GRID_SIZE; z++) {
          // 随机决定是否放置方块（约70%概率）
          if (Math.random() < 0.7) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const level = Math.floor(Math.random() * 3) + 1;
            
            const cube = new Cube(color, level, x, y, z);
            this.grid.setCube(x, y, z, cube);
            this.sceneManager.add(cube.mesh);
            cubeCount++;
          }
        }
      }
    }
    
    console.log(`✅ 创建了 ${cubeCount} 个初始方块`);
  }

  /**
   * 处理方块点击
   */
  private handleCubeClick(cube: Cube) {
    if (this.gameState.isOver() || this.gameState.isPausedState()) {
      return;
    }

    console.log(`点击方块: ${cube.color} Lv.${cube.level} at (${cube.gridX}, ${cube.gridY}, ${cube.gridZ})`);

    // 如果没有选中方块，则选中当前方块
    if (!this.selectedCube) {
      // 只能选中蓝块或黄块
      if (cube.color === CubeColor.BLUE || cube.color === CubeColor.YELLOW) {
        this.selectCube(cube);
      }
      return;
    }

    // 如果点击的是已选中的方块，取消选中
    if (this.selectedCube === cube) {
      this.deselectCube();
      return;
    }

    // 尝试执行操作（合成或吞噬）
    this.tryAction(this.selectedCube, cube);
  }

  /**
   * 选中方块
   */
  private selectCube(cube: Cube) {
    this.selectedCube = cube;
    cube.setSelected(true);
    
    // 智能高亮：显示可操作的相邻方块
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
    
    // 清除所有高亮和灰显
    this.clearHighlights();
  }

  /**
   * 智能高亮系统：高亮可操作方块，灰显不可操作方块
   */
  private highlightValidTargets(sourceCube: Cube) {
    const neighbors = this.grid.getNeighbors(sourceCube.gridX, sourceCube.gridY, sourceCube.gridZ);
    const validTargets: Cube[] = [];

    // 检查每个相邻方块是否可操作
    for (const neighbor of neighbors) {
      const isValid = this.canPerformAction(sourceCube, neighbor.cube);
      
      if (isValid) {
        // 可操作：高亮
        neighbor.cube.setHighlight(true);
        validTargets.push(neighbor.cube);
      } else {
        // 不可操作：灰显
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
    // 蓝块合成蓝块
    if (sourceCube.color === CubeColor.BLUE && targetCube.color === CubeColor.BLUE) {
      return this.mergeSystem.canMerge(sourceCube, targetCube);
    }

    // 黄块合成黄块
    if (sourceCube.color === CubeColor.YELLOW && targetCube.color === CubeColor.YELLOW) {
      return this.mergeSystem.canMerge(sourceCube, targetCube);
    }

    // 蓝块吞噬红块/黄块
    if (sourceCube.color === CubeColor.BLUE) {
      return this.combatSystem.canDevour(sourceCube, targetCube);
    }

    return false;
  }

  /**
   * 尝试执行操作
   */
  private async tryAction(sourceCube: Cube, targetCube: Cube) {
    // 检查是否相邻
    if (!this.isAdjacent(sourceCube, targetCube)) {
      console.log('❌ 方块不相邻');
      this.deselectCube();
      return;
    }

    // 蓝块的操作
    if (sourceCube.color === CubeColor.BLUE) {
      // 合成：蓝+蓝，同等级
      if (targetCube.color === CubeColor.BLUE && sourceCube.level === targetCube.level) {
        await this.performMerge(sourceCube, targetCube);
        return;
      }

      // 吞噬：蓝吃红/黄，蓝的等级 >= 目标等级
      if ((targetCube.color === CubeColor.RED || targetCube.color === CubeColor.YELLOW) &&
          sourceCube.level >= targetCube.level) {
        await this.performDevour(sourceCube, targetCube);
        return;
      }
    }

    // 黄块的操作
    if (sourceCube.color === CubeColor.YELLOW) {
      // 合成：黄+黄，同等级
      if (targetCube.color === CubeColor.YELLOW && sourceCube.level === targetCube.level) {
        await this.performMerge(sourceCube, targetCube);
        return;
      }
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

    // 相邻定义：只有一个轴相差1，其他轴相同
    return (dx === 1 && dy === 0 && dz === 0) ||
           (dx === 0 && dy === 1 && dz === 0) ||
           (dx === 0 && dy === 0 && dz === 1);
  }

  /**
   * 执行合成
   */
  private async performMerge(cube1: Cube, cube2: Cube) {
    console.log('✨ 合成中...');

    // 移除cube2
    this.grid.setCube(cube2.gridX, cube2.gridY, cube2.gridZ, null);
    await cube2.destroy();
    this.sceneManager.remove(cube2.mesh);

    // cube1升级
    const result = await this.mergeSystem.performMerge(cube1, cube2);
    
    this.deselectCube();
    
    // 在动态补位模式下生成新方块
    if (this.gameState.getRefreshMode() === RefreshMode.DYNAMIC) {
      const newCube = this.redBlockSpawner.trySpawnRedBlock();
      if (newCube) {
        this.grid.setCube(newCube.gridX, newCube.gridY, newCube.gridZ, newCube);
        this.sceneManager.add(newCube.mesh);
      }
    }
    
    // 更新UI
    this.updateScoreUI();
    
    // 检查游戏结束条件
    this.checkGameOverCondition();
  }

  /**
   * 执行吞噬
   */
  private async performDevour(blueCube: Cube, targetCube: Cube) {
    console.log('💥 吞噬中...');

    const targetX = targetCube.gridX;
    const targetY = targetCube.gridY;
    const targetZ = targetCube.gridZ;

    // 移除目标方块
    this.grid.setCube(targetX, targetY, targetZ, null);
    await targetCube.destroy();
    this.sceneManager.remove(targetCube.mesh);

    // 蓝色方块移动到目标位置
    this.grid.setCube(blueCube.gridX, blueCube.gridY, blueCube.gridZ, null);
    await blueCube.moveTo(targetX, targetY, targetZ);
    this.grid.setCube(targetX, targetY, targetZ, blueCube);

    // 执行吞噬逻辑
    const result = await this.combatSystem.performDevour(blueCube, targetCube);
    
    this.deselectCube();
    
    // 在动态补位模式下生成新方块
    if (this.gameState.getRefreshMode() === RefreshMode.DYNAMIC) {
      const newCube = this.redBlockSpawner.trySpawnRedBlock();
      if (newCube) {
        this.grid.setCube(newCube.gridX, newCube.gridY, newCube.gridZ, newCube);
        this.sceneManager.add(newCube.mesh);
      }
    }
    
    // 更新UI
    this.updateScoreUI();
    
    // 检查游戏结束条件
    this.checkGameOverCondition();
  }

  /**
   * 检查游戏结束条件
   */
  private checkGameOverCondition() {
    // 检查是否已满（无法进行任何操作）
    if (this.grid.isFull()) {
      // 检查是否还有可操作的方块
      let canMove = false;
      
      this.grid.getAllCubes().forEach(cube => {
        if (cube.color === CubeColor.BLUE) {
          const neighbors = this.grid.getNeighbors(cube.gridX, cube.gridY, cube.gridZ);
          for (const neighbor of neighbors) {
            if (this.canPerformAction(cube, neighbor.cube)) {
              canMove = true;
            }
          }
        }
      });
      
      if (!canMove) {
        console.log('💀 游戏结束！');
        this.gameState.setGameOver(true);
        this.showGameOverUI();
      }
    }
  }

  /**
   * 显示游戏结束UI
   */
  private showGameOverUI() {
    const stats = this.gameState.getSessionStats();
    console.log('📊 游戏统计:', stats);
    // TODO: 实现游戏结束UI
  }

  /**
   * 更新分数UI
   */
  private updateScoreUI() {
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
      scoreElement.textContent = `Score: ${this.gameState.getScore()}`;
    }
    
    const coinElement = document.getElementById('coin');
    if (coinElement) {
      coinElement.textContent = `Coin: ${this.gameState.getCoin()}`;
    }
    
    const comboElement = document.getElementById('combo');
    if (comboElement && this.gameState.getComboCount() > 1) {
      comboElement.textContent = `COMBO x${this.gameState.getComboCount()}`;
    }
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

    // 更新输入管理器（阻尼效果）
    this.inputManager.update();
    
    // 检查Combo超时
    if (this.gameState.getComboCount() > 0 && 
        Date.now() - (this.gameState as any).lastActionTime > CONFIG.COMBO_TIMEOUT) {
      console.log(`Combo断了！最高连击: x${this.gameState.getMaxCombo()}`);
      this.gameState.resetCombo();
    }

    this.sceneManager.render();
    requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * 暂停游戏
   */
  pause() {
    this.isRunning = false;
    this.gameState.pause();
  }

  /**
   * 恢复游戏
   */
  resume() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.gameState.resume();
      this.gameLoop();
    }
  }
}
