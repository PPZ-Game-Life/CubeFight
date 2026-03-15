import { Grid3D } from '../entities/Grid3D';
import { Cube } from '../entities/Cube';
import gsap from 'gsap';
import * as THREE from 'three';

/**
 * 剖面切割系统
 */
export class SliceSystem {
  private grid: Grid3D;
  private currentAxis: 'x' | 'y' | 'z' | null = null;
  private currentIndex: number = -1;

  constructor(grid: Grid3D) {
    this.grid = grid;
  }

  /**
   * 显示指定轴的切面
   */
  showSlice(axis: 'x' | 'y' | 'z', index: number) {
    this.currentAxis = axis;
    this.currentIndex = index;

    this.grid.forEach((cube, x, y, z) => {
      if (!cube) return;

      let shouldShow = false;
      
      switch (axis) {
        case 'x':
          shouldShow = x === index;
          break;
        case 'y':
          shouldShow = y === index;
          break;
        case 'z':
          shouldShow = z === index;
          break;
      }

      if (shouldShow) {
        // 显示当前层
        this.showCube(cube);
      } else {
        // 隐藏其他层
        this.hideCube(cube);
      }
    });
  }

  /**
   * 重置视图（显示所有方块）
   */
  resetView() {
    this.currentAxis = null;
    this.currentIndex = -1;

    this.grid.forEach((cube) => {
      if (cube) {
        this.showCube(cube);
      }
    });
  }

  /**
   * 显示方块
   */
  private showCube(cube: Cube) {
    cube.mesh.visible = true;
    
    gsap.to(cube.mesh.material, {
      opacity: 1,
      duration: 0.3
    });
    
    gsap.to(cube.mesh.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.3,
      ease: 'back.out'
    });

    // 恢复碰撞检测
    cube.mesh.userData.raycastEnabled = true;
  }

  /**
   * 隐藏方块（透明化 + 禁用碰撞）
   */
  private hideCube(cube: Cube) {
    // 透明化
    const material = cube.mesh.material as THREE.MeshStandardMaterial;
    material.transparent = true;
    
    gsap.to(material, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        // 完全透明后隐藏
        cube.mesh.visible = false;
      }
    });

    // 禁用射线检测
    cube.mesh.userData.raycastEnabled = false;
  }

  /**
   * 获取当前切面状态
   */
  getCurrentSlice(): { axis: 'x' | 'y' | 'z' | null, index: number } {
    return {
      axis: this.currentAxis,
      index: this.currentIndex
    };
  }

  /**
   * 是否处于切面模式
   */
  isSlicing(): boolean {
    return this.currentAxis !== null;
  }
}
