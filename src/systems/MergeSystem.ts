import { Cube } from '../entities/Cube';
import { CubeColor, LEVEL_VALUES } from '../core/Config';
import { GameStateManager } from '../core/GameStateManager';

/**
 * 合成系统
 * 负责处理蓝块+蓝块合成、黄块+黄块合成的逻辑
 */
export class MergeSystem {
  constructor(private gameState: GameStateManager) {}
  
  /**
   * 检查是否可以合成
   */
  canMerge(cube1: Cube, cube2: Cube): boolean {
    // 必须是同色、同等级、相邻的方块
    if (cube1.color !== cube2.color) return false;
    if (cube1.level !== cube2.level) return false;
    if (cube1.level >= 9) return false; // 9级无法继续合成
    
    return true;
  }
  
  /**
   * 执行合成
   * 返回合成后的新方块等级和获得的分数
   */
  async performMerge(sourceCube: Cube, targetCube: Cube): Promise<{ newLevel: number; score: number; coin: number }> {
    const newLevel = sourceCube.level + 1;
    
    // 获取数值
    const levelValue = LEVEL_VALUES[newLevel as keyof typeof LEVEL_VALUES];
    const score = this.gameState.addScore(levelValue.score);
    
    // 黄块合成时才掉落金币
    let coin = 0;
    if (sourceCube.color === CubeColor.YELLOW) {
      coin = levelValue.coin;
      this.gameState.addCoin(coin);
    }
    
    // 更新最高合成等级
    this.gameState.updateMaxMergedLevel(newLevel);
    
    // 更新Combo
    this.gameState.updateCombo();
    
    // 执行升级动画
    await sourceCube.levelUp();
    
    return { newLevel, score, coin };
  }
  
  /**
   * 获取合成后的分数
   */
  getMergeScore(level: number): number {
    const levelValue = LEVEL_VALUES[level as keyof typeof LEVEL_VALUES];
    return levelValue.score;
  }
  
  /**
   * 获取合成后的金币（仅黄块）
   */
  getMergeCoin(level: number): number {
    const levelValue = LEVEL_VALUES[level as keyof typeof LEVEL_VALUES];
    return levelValue.coin;
  }
}
