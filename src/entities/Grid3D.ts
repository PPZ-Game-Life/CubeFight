import { Cube } from './Cube';
import { CubeColor, CONFIG } from '../core/Config';

/**
 * 3D网格数据结构
 */
export class Grid3D {
  private cells: (Cube | null)[][][];
  private size: number;

  constructor(size: number = CONFIG.GRID_SIZE) {
    this.size = size;
    this.cells = this.createEmptyGrid();
  }

  /**
   * 创建空网格
   */
  private createEmptyGrid(): (Cube | null)[][][] {
    return Array(this.size).fill(null).map(() =>
      Array(this.size).fill(null).map(() =>
        Array(this.size).fill(null)
      )
    );
  }

  /**
   * 获取指定位置的方块
   */
  getCube(x: number, y: number, z: number): Cube | null {
    if (!this.isValidPosition(x, y, z)) return null;
    return this.cells[x][y][z];
  }

  /**
   * 设置指定位置的方块
   */
  setCube(x: number, y: number, z: number, cube: Cube | null) {
    if (!this.isValidPosition(x, y, z)) return;
    this.cells[x][y][z] = cube;
  }

  /**
   * 检查位置是否有效
   */
  isValidPosition(x: number, y: number, z: number): boolean {
    return x >= 0 && x < this.size &&
           y >= 0 && y < this.size &&
           z >= 0 && z < this.size;
  }

  /**
   * 检查位置是否为空
   */
  isEmpty(x: number, y: number, z: number): boolean {
    return this.isValidPosition(x, y, z) && this.cells[x][y][z] === null;
  }

  /**
   * 获取相邻方块（6个方向：上下左右前后）
   */
  getNeighbors(x: number, y: number, z: number): Array<{ cube: Cube, x: number, y: number, z: number }> {
    const directions = [
      { dx: 1, dy: 0, dz: 0 },  // 右
      { dx: -1, dy: 0, dz: 0 }, // 左
      { dx: 0, dy: 1, dz: 0 },  // 上
      { dx: 0, dy: -1, dz: 0 }, // 下
      { dx: 0, dy: 0, dz: 1 },  // 前
      { dx: 0, dy: 0, dz: -1 }  // 后
    ];

    const neighbors: Array<{ cube: Cube, x: number, y: number, z: number }> = [];

    for (const dir of directions) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;
      const nz = z + dir.dz;
      const cube = this.getCube(nx, ny, nz);
      
      if (cube) {
        neighbors.push({ cube, x: nx, y: ny, z: nz });
      }
    }

    return neighbors;
  }

  /**
   * 获取所有方块
   */
  getAllCubes(): Cube[] {
    const cubes: Cube[] = [];
    this.forEach((cube) => {
      if (cube) cubes.push(cube);
    });
    return cubes;
  }

  /**
   * 遍历所有格子
   */
  forEach(callback: (cube: Cube | null, x: number, y: number, z: number) => void) {
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        for (let z = 0; z < this.size; z++) {
          callback(this.cells[x][y][z], x, y, z);
        }
      }
    }
  }

  /**
   * 获取空位数量
   */
  getEmptyCount(): number {
    let count = 0;
    this.forEach((cube) => {
      if (!cube) count++;
    });
    return count;
  }

  /**
   * 获取所有空位
   */
  getEmptyPositions(): Array<{ x: number, y: number, z: number }> {
    const positions: Array<{ x: number, y: number, z: number }> = [];
    this.forEach((cube, x, y, z) => {
      if (!cube) positions.push({ x, y, z });
    });
    return positions;
  }

  /**
   * 检查是否已满
   */
  isFull(): boolean {
    return this.getEmptyCount() === 0;
  }

  /**
   * 清空网格
   */
  clear() {
    this.cells = this.createEmptyGrid();
  }

  /**
   * 获取网格尺寸
   */
  getSize(): number {
    return this.size;
  }
}
