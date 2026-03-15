import { Cube } from '../entities/Cube';
import { CubeColor, GameMode, CONFIG } from '../core/Config';
import { Grid3D } from '../entities/Grid3D';
import { GameStateManager } from '../core/GameStateManager';

/**
 * 红块生成系统
 * 负责在动态补位模式下自动生成红块
 */
export class RedBlockSpawner {
  private spawnCounter: number = 0;
  private readonly SPAWN_INTERVAL = 1; // 每次操作后生成1个红块
  
  constructor(
    private grid: Grid3D,
    private gameState: GameStateManager
  ) {}
  
  /**
   * 尝试生成红块
   * 在动态补位模式下，每次操作后调用
   */
  trySpawnRedBlock(): Cube | null {
    // 只在动态补位模式下生成
    if (this.gameState.getRefreshMode() !== 'dynamic') {
      return null;
    }
    
    // 获取所有空位
    const emptyPositions = this.grid.getEmptyPositions();
    if (emptyPositions.length === 0) {
      return null; // 没有空位
    }
    
    // 随机选择一个空位
    const randomPos = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
    
    // 确定红块等级
    const redLevel = this.getRedBlockLevel();
    
    // 创建红块
    const redCube = new Cube(CubeColor.RED, redLevel, randomPos.x, randomPos.y, randomPos.z);
    this.grid.setCube(randomPos.x, randomPos.y, randomPos.z, redCube);
    
    return redCube;
  }
  
  /**
   * 根据当前分数确定红块等级
   */
  private getRedBlockLevel(): number {
    const gameMode = this.gameState.getGameMode();
    const modeConfig = CONFIG.GAME_MODES[gameMode];
    const score = this.gameState.getScore();
    
    // 无尽模式：根据分数递进
    if (gameMode === GameMode.ENDLESS) {
      const progression = (modeConfig as any).redLevelProgression;
      const thresholds = Object.keys(progression)
        .map(Number)
        .sort((a, b) => b - a); // 从大到小排序
      
      for (const threshold of thresholds) {
        if (score >= threshold) {
          return progression[threshold];
        }
      }
      return 1; // 默认1级
    }
    
    // 闯关模式：固定最高等级
    const maxLevel = modeConfig.maxRedLevel;
    return Math.min(Math.floor(Math.random() * maxLevel) + 1, maxLevel);
  }
  
  /**
   * 获取当前应该生成的红块等级范围
   */
  getRedBlockLevelRange(): { min: number; max: number } {
    const gameMode = this.gameState.getGameMode();
    const modeConfig = CONFIG.GAME_MODES[gameMode];
    
    if (gameMode === GameMode.ENDLESS) {
      const score = this.gameState.getScore();
      const progression = (modeConfig as any).redLevelProgression;
      const thresholds = Object.keys(progression)
        .map(Number)
        .sort((a, b) => b - a);
      
      for (const threshold of thresholds) {
        if (score >= threshold) {
          const level = progression[threshold];
          return { min: 1, max: level };
        }
      }
      return { min: 1, max: 1 };
    }
    
    // 闯关模式
    return { min: 1, max: modeConfig.maxRedLevel };
  }
}
