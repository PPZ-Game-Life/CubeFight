import * as THREE from 'three';
import { CONFIG } from '../core/Config';

/**
 * Three.js场景管理器
 */
export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  
  private container: HTMLElement;
  private ambientLight!: THREE.AmbientLight;
  private directionalLight!: THREE.DirectionalLight;

  constructor(container: HTMLElement) {
    this.container = container;

    // 创建场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // 创建相机
    this.camera = new THREE.PerspectiveCamera(
      CONFIG.CAMERA.FOV,
      window.innerWidth / window.innerHeight,
      CONFIG.CAMERA.NEAR,
      CONFIG.CAMERA.FAR
    );
    this.camera.position.set(
      CONFIG.CAMERA.POSITION.x,
      CONFIG.CAMERA.POSITION.y,
      CONFIG.CAMERA.POSITION.z
    );
    this.camera.lookAt(0, 0, 0);

    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    this.container.appendChild(this.renderer.domElement);

    // 设置光照
    this.setupLights();

    // 添加网格辅助线（开发用）
    this.addGridHelper();

    // 监听窗口大小变化
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  /**
   * 设置光照
   */
  private setupLights() {
    // 环境光
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    // 方向光
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(5, 10, 5);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.camera.near = 0.1;
    this.directionalLight.shadow.camera.far = 50;
    this.directionalLight.shadow.camera.left = -10;
    this.directionalLight.shadow.camera.right = 10;
    this.directionalLight.shadow.camera.top = 10;
    this.directionalLight.shadow.camera.bottom = -10;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(this.directionalLight);
  }

  /**
   * 添加网格辅助线
   */
  private addGridHelper() {
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    gridHelper.position.y = -2;
    this.scene.add(gridHelper);
  }

  /**
   * 窗口大小变化处理
   */
  private onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * 渲染
   */
  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 添加对象到场景
   */
  add(object: THREE.Object3D) {
    this.scene.add(object);
  }

  /**
   * 从场景移除对象
   */
  remove(object: THREE.Object3D) {
    this.scene.remove(object);
  }

  /**
   * 清理资源
   */
  dispose() {
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
