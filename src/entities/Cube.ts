import * as THREE from 'three';
import { CubeColor, CubeState, CONFIG } from '../core/Config';
import gsap from 'gsap';

/**
 * 方块实体类
 */
export class Cube {
  public mesh: THREE.Mesh;
  public color: CubeColor;
  public level: number;
  public state: CubeState = CubeState.IDLE;
  public gridX: number;
  public gridY: number;
  public gridZ: number;

  private geometry: THREE.BoxGeometry;
  private material: THREE.MeshStandardMaterial;
  private outline: THREE.LineSegments | null = null;

  constructor(color: CubeColor, level: number, x: number, y: number, z: number) {
    this.color = color;
    this.level = level;
    this.gridX = x;
    this.gridY = y;
    this.gridZ = z;

    // 创建几何体和材质
    this.geometry = new THREE.BoxGeometry(CONFIG.CUBE_SIZE, CONFIG.CUBE_SIZE, CONFIG.CUBE_SIZE);
    this.material = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS[color],
      metalness: 0.3,
      roughness: 0.4
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // 存储引用到mesh的userData
    this.mesh.userData.cube = this;

    // 设置位置
    this.updatePosition();

    // 创建边框
    this.createOutline();
  }

  /**
   * 根据网格坐标更新世界坐标
   */
  private updatePosition() {
    const spacing = CONFIG.CUBE_SIZE + CONFIG.CUBE_GAP;
    const offset = (CONFIG.GRID_SIZE - 1) * spacing / 2;
    
    this.mesh.position.set(
      this.gridX * spacing - offset,
      this.gridY * spacing - offset,
      this.gridZ * spacing - offset
    );
  }

  /**
   * 创建选中边框
   */
  private createOutline() {
    const edges = new THREE.EdgesGeometry(this.geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: 0xffffff, 
      linewidth: 2,
      transparent: true,
      opacity: 0
    });
    this.outline = new THREE.LineSegments(edges, lineMaterial);
    this.mesh.add(this.outline);
  }

  /**
   * 设置选中状态
   */
  setSelected(selected: boolean) {
    if (!this.outline) return;

    this.state = selected ? CubeState.SELECTED : CubeState.IDLE;
    
    gsap.to(this.outline.material, {
      opacity: selected ? 1 : 0,
      duration: 0.2
    });

    gsap.to(this.mesh.scale, {
      x: selected ? 1.1 : 1,
      y: selected ? 1.1 : 1,
      z: selected ? 1.1 : 1,
      duration: 0.2,
      ease: 'back.out'
    });
  }

  /**
   * 设置高亮状态（可操作的目标）
   */
  setHighlight(highlighted: boolean) {
    if (!this.outline) return;

    const lineMaterial = this.outline.material as THREE.LineBasicMaterial;
    
    if (highlighted) {
      lineMaterial.color.set(0x00ff00); // 绿色高亮
      gsap.to(lineMaterial, {
        opacity: 0.8,
        duration: 0.2
      });
      
      // 轻微放大
      gsap.to(this.mesh.scale, {
        x: 1.05,
        y: 1.05,
        z: 1.05,
        duration: 0.2
      });
    } else {
      gsap.to(lineMaterial, {
        opacity: 0,
        duration: 0.2
      });
      
      gsap.to(this.mesh.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.2
      });
    }
  }

  /**
   * 设置灰显状态（不可操作）
   */
  setDimmed(dimmed: boolean) {
    gsap.to(this.material, {
      opacity: dimmed ? 0.3 : 1,
      duration: 0.2
    });
    
    if (dimmed) {
      this.material.transparent = true;
    } else {
      this.material.transparent = false;
    }
  }

  /**
   * 升级（合成后）
   */
  levelUp() {
    if (this.level >= CONFIG.MAX_LEVEL) return;
    
    this.level++;
    
    // 升级动画
    gsap.timeline()
      .to(this.mesh.scale, {
        x: 1.3,
        y: 1.3,
        z: 1.3,
        duration: 0.2,
        ease: 'back.out'
      })
      .to(this.mesh.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.2,
        ease: 'back.in'
      });

    // 颜色变亮（等级越高越亮）
    const brightness = 1 + (this.level - 1) * 0.1;
    this.material.emissive = new THREE.Color(CONFIG.COLORS[this.color]);
    this.material.emissiveIntensity = brightness * 0.3;
  }

  /**
   * 移动到新位置
   */
  moveTo(x: number, y: number, z: number, duration: number = 0.3): Promise<void> {
    this.gridX = x;
    this.gridY = y;
    this.gridZ = z;

    const spacing = CONFIG.CUBE_SIZE + CONFIG.CUBE_GAP;
    const offset = (CONFIG.GRID_SIZE - 1) * spacing / 2;

    return new Promise((resolve) => {
      gsap.to(this.mesh.position, {
        x: x * spacing - offset,
        y: y * spacing - offset,
        z: z * spacing - offset,
        duration,
        ease: 'power2.out',
        onComplete: () => resolve()
      });
    });
  }

  /**
   * 销毁动画
   */
  destroy(): Promise<void> {
    this.state = CubeState.DYING;

    return new Promise((resolve) => {
      gsap.to(this.mesh.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.3,
        ease: 'back.in',
        onComplete: () => {
          this.mesh.visible = false;
          resolve();
        }
      });
    });
  }

  /**
   * 降级（道具使用）
   */
  levelDown() {
    if (this.level <= 1) return;
    
    this.level--;
    
    // 降级动画
    gsap.timeline()
      .to(this.mesh.scale, {
        x: 0.8,
        y: 0.8,
        z: 0.8,
        duration: 0.15
      })
      .to(this.mesh.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.15
      });

    // 降低发光强度
    const brightness = 1 + (this.level - 1) * 0.1;
    this.material.emissiveIntensity = brightness * 0.3;
  }

  /**
   * 改变颜色（道具使用）
   */
  changeColor(newColor: CubeColor) {
    this.color = newColor;
    
    // 颜色变化动画
    gsap.to(this.material.color, {
      r: ((CONFIG.COLORS[newColor] >> 16) & 255) / 255,
      g: ((CONFIG.COLORS[newColor] >> 8) & 255) / 255,
      b: (CONFIG.COLORS[newColor] & 255) / 255,
      duration: 0.5
    });
  }

  /**
   * 重置方块（对象池复用）
   */
  reset(color: CubeColor, level: number, x: number, y: number, z: number) {
    this.color = color;
    this.level = level;
    this.gridX = x;
    this.gridY = y;
    this.gridZ = z;
    this.state = CubeState.IDLE;

    this.material.color.set(CONFIG.COLORS[color]);
    this.material.emissiveIntensity = 0;
    this.mesh.scale.set(1, 1, 1);
    this.mesh.visible = true;

    this.updatePosition();
  }

  /**
   * 清理资源
   */
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    if (this.outline) {
      (this.outline.material as THREE.Material).dispose();
      (this.outline.geometry as THREE.BufferGeometry).dispose();
    }
  }
}
