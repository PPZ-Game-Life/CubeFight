import { Game } from './core/Game';
import './style.css';

/**
 * 游戏入口
 */
class App {
  private game: Game;

  constructor() {
    console.log('🚀 CubeFight 启动中...');

    // 获取容器
    const container = document.getElementById('app');
    if (!container) {
      throw new Error('找不到 #app 容器');
    }

    // 创建游戏实例
    this.game = new Game(container);

    // 设置UI事件
    this.setupUI();

    // 启动游戏
    this.game.start();

    console.log('✅ 游戏已启动');
  }

  /**
   * 设置UI事件
   */
  private setupUI() {
    // 重置视角按钮
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.game.resetView();
      });
    }

    // X轴切面按钮
    const btnSliceX = document.getElementById('btn-slice-x');
    if (btnSliceX) {
      let xIndex = 0;
      btnSliceX.addEventListener('click', () => {
        xIndex = (xIndex + 1) % 3;
        this.game.showSlice('x', xIndex);
        console.log(`X切面: ${xIndex}`);
      });
    }

    // Y轴切面按钮
    const btnSliceY = document.getElementById('btn-slice-y');
    if (btnSliceY) {
      let yIndex = 0;
      btnSliceY.addEventListener('click', () => {
        yIndex = (yIndex + 1) % 3;
        this.game.showSlice('y', yIndex);
        console.log(`Y切面: ${yIndex}`);
      });
    }

    // Z轴切面按钮
    const btnSliceZ = document.getElementById('btn-slice-z');
    if (btnSliceZ) {
      let zIndex = 0;
      btnSliceZ.addEventListener('click', () => {
        zIndex = (zIndex + 1) % 3;
        this.game.showSlice('z', zIndex);
        console.log(`Z切面: ${zIndex}`);
      });
    }
  }
}

// 启动应用
new App();
