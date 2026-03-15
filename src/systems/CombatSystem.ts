import { Cube } from '../entities/Cube';
import { CubeColor, LEVEL_VALUES } from '../core/Config';
import { GameStateManager } from '../core/GameStateManager';

/**
 * 吞噬系统
 * 负责处理蓝块吃红块/黄块的逻辑
 */
export class CombatSystem {
  constructor(private gameState: GameStateManager) {}
  
  /**
   * 检查是否可以吞噬
   */
  canDevour(blueCube: Cube, targetCube: Cube): boolean {
    // 只有蓝块可以吞噬
    if (blueCube.color !== CubeColor.BLUE) return false;
    
    // 不能吞噬蓝块
    if (targetCube.color === CubeColor.BLUE) return false;
    
    // 蓝块等级必须 >= 目标等级
    if (blueCube.level < targetCube.level) return false;
    
    return true;
  }
  
  /**
   * 执行吞噬
   * 返回获得的分数和金币
   */
  async performDevour(blueCube: Cube, targetCube: Cube): Promise<{ score: number; coin: number }> {
    const levelValue = LEVEL_VALUES[targetCube.level as keyof typeof LEVEL_VALUES];
    
    // 黄块吞噬获得金币
    let coin = 0;
    if (targetCube.color === CubeColor.YELLOW) {
      // 检查是否启用了金币掉落（无尽模式）
      const modeConfig = this.gameState.getGameMode();
      const isEndless = modeConfig === 'endless';
      
      if (isEndless) {
        coin = levelValue.coin;
        this.gameState.addCoin(coin);
      }
    }
    
    // 计算分数（黄块分数翻倍）
    let baseScore = levelValue.score;
    if (targetCube.color === CubeColor.YELLOW) {
      baseScore *= 2;
    }
    
    const score = this.gameState.addScore(baseScore);
    
    // 更新Combo
    this.gameState.updateCombo();
    
    return { score, coin };
  }
  
  /**
   * 获取吞噬分数
   */
  getDevourScore(targetCube: Cube): number {
    const levelValue = LEVEL_VALUES[targetCube.level as keyof typeof LEVEL_VALUES];
    let score = levelValue.score;
    
    // 黄块分数翻倍
    if (targetCube.color === CubeColor.YELLOW) {
      score *= 2;
    }
    
    return score;
  }
  
  /**
   * 获取吞噬金币
   */
  getDevourCoin(targetCube: Cube): number {
    if (targetCube.color !== CubeColor.YELLOW) return 0;
    
    const levelValue = LEVEL_VALUES[targetCube.level as keyof typeof LEVEL_VALUES];
    return levelValue.coin;
  }
}
