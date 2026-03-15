import { Cube } from '../entities/Cube';
import { CubeColor } from '../core/Config';
import { Grid3D } from '../entities/Grid3D';

/**
 * 道具类型
 */
export enum ItemType {
  BOMB = 'bomb',                    // 精准打击：摧毁任意方块
  DOWNGRADE_HAMMER = 'downgrade',   // 空间降维：方块等级-1
  COLOR_SWAP = 'swap',              // 色彩置换：红块转蓝/黄
  RAINBOW_BLOCK = 'rainbow',        // 彩虹块：任意合成
  EARTHQUAKE = 'earthquake',        // 大地震：重新洗牌
  ORBITAL_CANNON = 'cannon'         // 轨道炮：十字星爆
}

/**
 * 道具系统
 */
export class ItemSystem {
  private items: Map<ItemType, number> = new Map();
  
  constructor() {
    this.resetItems();
  }
  
  /**
   * 重置道具
   */
  resetItems() {
    this.items.clear();
    for (const type of Object.values(ItemType)) {
      this.items.set(type, 0);
    }
  }
  
  /**
   * 添加道具
   */
  addItem(type: ItemType, count: number = 1) {
    const current = this.items.get(type) || 0;
    this.items.set(type, current + count);
  }
  
  /**
   * 消耗道具
   */
  useItem(type: ItemType): boolean {
    const current = this.items.get(type) || 0;
    if (current > 0) {
      this.items.set(type, current - 1);
      return true;
    }
    return false;
  }
  
  /**
   * 获取道具数量
   */
  getItemCount(type: ItemType): number {
    return this.items.get(type) || 0;
  }
  
  /**
   * 获取所有道具
   */
  getAllItems(): Record<ItemType, number> {
    const result: any = {};
    for (const [type, count] of this.items) {
      result[type] = count;
    }
    return result;
  }
  
  /**
   * 执行道具效果：精准打击
   */
  async useBomb(grid: Grid3D, targetCube: Cube): Promise<void> {
    if (!this.useItem(ItemType.BOMB)) return;
    
    // 销毁目标方块
    grid.setCube(targetCube.gridX, targetCube.gridY, targetCube.gridZ, null);
    await targetCube.destroy();
  }
  
  /**
   * 执行道具效果：降级锤
   */
  async useDowngradeHammer(targetCube: Cube): Promise<void> {
    if (!this.useItem(ItemType.DOWNGRADE_HAMMER)) return;
    
    if (targetCube.level > 1) {
      targetCube.level--;
      // 触发降级动画
      await targetCube.levelDown();
    }
  }
  
  /**
   * 执行道具效果：色彩置换
   */
  async useColorSwap(grid: Grid3D, targetCube: Cube, newColor: CubeColor): Promise<void> {
    if (!this.useItem(ItemType.COLOR_SWAP)) return;
    
    // 只能将红块转换为蓝或黄
    if (targetCube.color !== CubeColor.RED) return;
    
    targetCube.color = newColor;
    // 触发颜色变化动画
    await targetCube.changeColor(newColor);
  }
  
  /**
   * 执行道具效果：轨道炮
   */
  async useOrbitalCannon(grid: Grid3D, targetCube: Cube): Promise<void> {
    if (!this.useItem(ItemType.ORBITAL_CANNON)) return;
    
    const cubesToDestroy: Cube[] = [];
    
    // 获取同轴上的所有方块
    grid.forEach((cube, x, y, z) => {
      if (!cube) return;
      
      // 同X轴
      if (x === targetCube.gridX && y === targetCube.gridY) {
        if (cube.color === CubeColor.RED) {
          cubesToDestroy.push(cube);
        }
      }
      // 同Y轴
      else if (y === targetCube.gridY && z === targetCube.gridZ) {
        if (cube.color === CubeColor.RED) {
          cubesToDestroy.push(cube);
        }
      }
      // 同Z轴
      else if (z === targetCube.gridZ && x === targetCube.gridX) {
        if (cube.color === CubeColor.RED) {
          cubesToDestroy.push(cube);
        }
      }
    });
    
    // 销毁所有红块
    for (const cube of cubesToDestroy) {
      grid.setCube(cube.gridX, cube.gridY, cube.gridZ, null);
      await cube.destroy();
    }
  }
}
