import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { Cube } from '../entities/Cube';
import gsap from 'gsap';

/**
 * 输入管理器 - 轨道控制器模式
 */
export class InputManager {
  private sceneManager: SceneManager;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  
  // 轨道控制参数
  private isDragging: boolean = false;
  private previousMousePosition = { x: 0, y: 0 };
  private azimuthAngle: number = 0;        // 水平环绕角度（Yaw）
  private polarAngle: number = Math.PI / 3; // 俯仰角（Pitch），初始60度
  private distance: number = 8;             // 相机距离
  private target = new THREE.Vector3(0, 0, 0); // 观察目标点
  
  // 角度限制（按设计文档：上下各留15度缓冲）
  // polarAngle: 0° = 正上方俯视, 90° = 平视, 180° = 正下方
  // 限制范围：15° 到 85°（既能俯视看顶面，又不会太平）
  private readonly MIN_POLAR_ANGLE = THREE.MathUtils.degToRad(15);
  private readonly MAX_POLAR_ANGLE = THREE.MathUtils.degToRad(85);
  
  // 阻尼参数
  private velocity = { azimuth: 0, polar: 0 };
  private readonly DAMPING = 0.9;
  private readonly SENSITIVITY = 0.005;
  
  private onCubeClickCallback?: (cube: Cube) => void;
  private clickStartTime: number = 0;
  private clickStartPosition = { x: 0, y: 0 };
  private readonly CLICK_THRESHOLD = 300; // 300ms内算点击
  private readonly DRAG_THRESHOLD = 5; // 移动超过5px算拖拽

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.setupEventListeners();
    this.updateCameraPosition();
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners() {
    const canvas = this.sceneManager.renderer.domElement;

    // 鼠标事件
    canvas.addEventListener('mousedown', this.onPointerDown.bind(this));
    canvas.addEventListener('mousemove', this.onPointerMove.bind(this));
    canvas.addEventListener('mouseup', this.onPointerUp.bind(this));
    canvas.addEventListener('click', this.onClick.bind(this));

    // 触摸事件
    canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
  }

  /**
   * 鼠标按下
   */
  private onPointerDown(event: MouseEvent) {
    this.isDragging = false; // 先假设不是拖拽
    this.clickStartTime = Date.now();
    this.clickStartPosition = {
      x: event.clientX,
      y: event.clientY
    };
    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY
    };
  }

  /**
   * 鼠标移动（轨道旋转）
   */
  private onPointerMove(event: MouseEvent) {
    // 检查是否移动超过阈值
    const deltaX = event.clientX - this.clickStartPosition.x;
    const deltaY = event.clientY - this.clickStartPosition.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance > this.DRAG_THRESHOLD) {
      this.isDragging = true;
    }

    if (!this.isDragging) return;

    const moveDeltaX = event.clientX - this.previousMousePosition.x;
    const moveDeltaY = event.clientY - this.previousMousePosition.y;

    // 水平环绕（Yaw）
    this.azimuthAngle -= moveDeltaX * this.SENSITIVITY;
    
    // 俯仰角（Pitch）- 严格限制
    this.polarAngle += moveDeltaY * this.SENSITIVITY;
    this.polarAngle = Math.max(
      this.MIN_POLAR_ANGLE,
      Math.min(this.MAX_POLAR_ANGLE, this.polarAngle)
    );

    // 设置速度用于阻尼
    this.velocity.azimuth = -moveDeltaX * this.SENSITIVITY;
    this.velocity.polar = moveDeltaY * this.SENSITIVITY;

    this.updateCameraPosition();

    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY
    };
  }

  /**
   * 鼠标抬起
   */
  private onPointerUp() {
    this.isDragging = false;
    // 立即停止速度，不再滑动
    this.velocity = { azimuth: 0, polar: 0 };
  }

  /**
   * 点击事件（选中方块）
   */
  private onClick(event: MouseEvent) {
    // 如果拖拽了，不算点击
    if (this.isDragging) {
      console.log('拖拽中，忽略点击');
      return;
    }

    // 如果按下时间过长，不算点击
    const clickDuration = Date.now() - this.clickStartTime;
    if (clickDuration > this.CLICK_THRESHOLD) {
      console.log('按下时间过长，忽略点击');
      return;
    }

    // 计算归一化设备坐标
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    console.log('执行射线检测', this.mouse);
    this.performRaycast();
  }

  /**
   * 触摸开始
   */
  private onTouchStart(event: TouchEvent) {
    event.preventDefault();
    if (event.touches.length === 1) {
      this.isDragging = false;
      this.clickStartTime = Date.now();
      this.clickStartPosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
      this.previousMousePosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
    }
  }

  /**
   * 触摸移动
   */
  private onTouchMove(event: TouchEvent) {
    event.preventDefault();
    if (event.touches.length !== 1) return;

    // 检查是否移动超过阈值
    const deltaX = event.touches[0].clientX - this.clickStartPosition.x;
    const deltaY = event.touches[0].clientY - this.clickStartPosition.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance > this.DRAG_THRESHOLD) {
      this.isDragging = true;
    }

    if (!this.isDragging) return;

    const moveDeltaX = event.touches[0].clientX - this.previousMousePosition.x;
    const moveDeltaY = event.touches[0].clientY - this.previousMousePosition.y;

    this.azimuthAngle -= moveDeltaX * this.SENSITIVITY;
    this.polarAngle += moveDeltaY * this.SENSITIVITY;
    this.polarAngle = Math.max(
      this.MIN_POLAR_ANGLE,
      Math.min(this.MAX_POLAR_ANGLE, this.polarAngle)
    );

    this.velocity.azimuth = -moveDeltaX * this.SENSITIVITY;
    this.velocity.polar = moveDeltaY * this.SENSITIVITY;

    this.updateCameraPosition();

    this.previousMousePosition = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    };
  }

  /**
   * 触摸结束
   */
  private onTouchEnd(event: TouchEvent) {
    if (event.touches.length === 0) {
      this.isDragging = false;
      // 立即停止速度，不再滑动
      this.velocity = { azimuth: 0, polar: 0 };
    }

    // 单击检测
    if (event.changedTouches.length === 1) {
      const touch = event.changedTouches[0];
      this.mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
      this.performRaycast();
    }
  }

  /**
   * 执行射线检测
   */
  private performRaycast() {
    this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);

    // 获取场景中所有可点击的方块（过滤掉被切面隐藏的）
    const cubes = this.sceneManager.scene.children.filter(
      obj => obj.userData.cube instanceof Cube && 
             obj.visible && 
             obj.userData.raycastEnabled !== false
    );

    const intersects = this.raycaster.intersectObjects(cubes, false);

    if (intersects.length > 0) {
      const cube = intersects[0].object.userData.cube as Cube;
      if (this.onCubeClickCallback) {
        this.onCubeClickCallback(cube);
      }
    }
  }

  /**
   * 设置方块点击回调
   */
  onCubeClick(callback: (cube: Cube) => void) {
    this.onCubeClickCallback = callback;
  }

  /**
   * 更新相机位置（轨道控制器核心）
   */
  private updateCameraPosition() {
    // 球坐标转笛卡尔坐标
    const x = this.distance * Math.sin(this.polarAngle) * Math.sin(this.azimuthAngle);
    const y = this.distance * Math.cos(this.polarAngle);
    const z = this.distance * Math.sin(this.polarAngle) * Math.cos(this.azimuthAngle);

    this.sceneManager.camera.position.set(x, y, z);
    this.sceneManager.camera.lookAt(this.target);
    
    // 锁定向上向量为世界Y轴（地平线锁定）
    this.sceneManager.camera.up.set(0, 1, 0);
  }

  /**
   * 更新阻尼（每帧调用）
   */
  update() {
    if (!this.isDragging && (Math.abs(this.velocity.azimuth) > 0.0001 || Math.abs(this.velocity.polar) > 0.0001)) {
      this.azimuthAngle += this.velocity.azimuth;
      this.polarAngle += this.velocity.polar;
      
      // 限制俯仰角
      this.polarAngle = Math.max(
        this.MIN_POLAR_ANGLE,
        Math.min(this.MAX_POLAR_ANGLE, this.polarAngle)
      );

      this.updateCameraPosition();

      // 阻尼衰减
      this.velocity.azimuth *= this.DAMPING;
      this.velocity.polar *= this.DAMPING;
    }
  }

  /**
   * 重置视角
   */
  resetView() {
    gsap.to(this, {
      azimuthAngle: 0,
      polarAngle: Math.PI / 3, // 60度
      duration: 0.5,
      ease: 'power2.out',
      onUpdate: () => this.updateCameraPosition()
    });
    this.velocity = { azimuth: 0, polar: 0 };
  }
}
