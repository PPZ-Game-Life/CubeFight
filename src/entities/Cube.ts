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
  private levelCanvas: HTMLCanvasElement;
  private levelContext: CanvasRenderingContext2D;
  private levelTexture: THREE.CanvasTexture;
  private levelPlaneMaterial: THREE.MeshBasicMaterial;
  private levelPlanes: Array<{ plane: THREE.Mesh; normal: THREE.Vector3 }> = [];

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

    this.levelCanvas = document.createElement('canvas');
    this.levelCanvas.width = 128;
    this.levelCanvas.height = 128;

    const context = this.levelCanvas.getContext('2d');
    if (!context) {
      throw new Error('无法创建方块等级Canvas上下文');
    }

    this.levelContext = context;
    this.levelTexture = new THREE.CanvasTexture(this.levelCanvas);
    this.levelTexture.needsUpdate = true;
    this.levelTexture.colorSpace = THREE.SRGBColorSpace;

    this.levelPlaneMaterial = new THREE.MeshBasicMaterial({
      map: this.levelTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });

    this.createLevelPlanes();

    this.refreshLevelLabel();
  }

  /**
   * 为方块六个面创建等级数字面板
   */
  private createLevelPlanes() {
    const planeSize = CONFIG.CUBE_SIZE * 0.68;
    const offset = CONFIG.CUBE_SIZE * 0.5 + 0.01;

    const planeConfigs = [
      { position: [0, 0, offset], normal: [0, 0, 1] },
      { position: [0, 0, -offset], normal: [0, 0, -1] },
      { position: [offset, 0, 0], normal: [1, 0, 0] },
      { position: [-offset, 0, 0], normal: [-1, 0, 0] },
      { position: [0, offset, 0], normal: [0, 1, 0] },
      { position: [0, -offset, 0], normal: [0, -1, 0] }
    ] as const;

    this.levelPlanes = planeConfigs.map((config) => {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(planeSize, planeSize),
        this.levelPlaneMaterial
      );
      plane.position.set(config.position[0], config.position[1], config.position[2]);
      this.mesh.add(plane);

      return {
        plane,
        normal: new THREE.Vector3(config.normal[0], config.normal[1], config.normal[2])
      };
    });
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

    gsap.to(this.levelPlaneMaterial, {
      opacity: dimmed ? 0.35 : 1,
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
    this.refreshLevelLabel();
    
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
    this.refreshLevelLabel();
    
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

    this.refreshLevelLabel();
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
    this.levelPlaneMaterial.opacity = 1;

    this.updatePosition();
    this.refreshLevelLabel();
  }

  /**
   * 刷新方块正面的等级数字
   */
  private refreshLevelLabel() {
    const ctx = this.levelContext;
    const size = this.levelCanvas.width;

    ctx.clearRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.roundRect(size * 0.18, size * 0.18, size * 0.64, size * 0.64, 18);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(String(this.level), size / 2, size / 2 + 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(this.level), size / 2, size / 2 + 4);

    this.levelTexture.needsUpdate = true;
  }

  /**
   * 根据相机位置更新可见数字面
   */
  updateLevelLabelVisibility(camera: THREE.Camera) {
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);

    const meshWorldQuaternion = this.mesh.getWorldQuaternion(new THREE.Quaternion());
    const inverseMeshWorldQuaternion = meshWorldQuaternion.clone().invert();
    const localCameraPosition = cameraPosition.clone();
    this.mesh.worldToLocal(localCameraPosition);

    const localCameraUp = camera.up.clone().applyQuaternion(inverseMeshWorldQuaternion).normalize();
    const cameraForward = new THREE.Vector3();
    camera.getWorldDirection(cameraForward);
    const localCameraForward = cameraForward.applyQuaternion(inverseMeshWorldQuaternion).normalize();

    this.levelPlanes.forEach(({ plane, normal }) => {
      const planePosition = plane.position.clone();
      const toCamera = localCameraPosition.clone().sub(planePosition).normalize();
      const facing = normal.dot(toCamera);

      plane.visible = facing > 0.08 && this.mesh.visible;
      if (!plane.visible) {
        return;
      }

      let planeUp = localCameraUp.clone().sub(normal.clone().multiplyScalar(localCameraUp.dot(normal)));
      if (planeUp.lengthSq() < 1e-4) {
        planeUp = localCameraForward.clone().sub(normal.clone().multiplyScalar(localCameraForward.dot(normal)));
      }
      if (planeUp.lengthSq() < 1e-4) {
        planeUp = new THREE.Vector3(0, 1, 0).sub(normal.clone().multiplyScalar(normal.y));
      }

      planeUp.normalize();
      const planeRight = new THREE.Vector3().crossVectors(planeUp, normal).normalize();
      const correctedUp = new THREE.Vector3().crossVectors(normal, planeRight).normalize();

      const rotationMatrix = new THREE.Matrix4().makeBasis(planeRight, correctedUp, normal);
      plane.quaternion.setFromRotationMatrix(rotationMatrix);
    });
  }

  /**
   * 清理资源
   */
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.levelTexture.dispose();
    this.levelPlaneMaterial.dispose();
    this.levelPlanes.forEach(({ plane }) => {
      (plane.geometry as THREE.BufferGeometry).dispose();
    });
    if (this.outline) {
      (this.outline.material as THREE.Material).dispose();
      (this.outline.geometry as THREE.BufferGeometry).dispose();
    }
  }
}
