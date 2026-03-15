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

    // 设置切面按钮
    this.setupSliceButtons();
  }

  /**
   * 设置切面按钮
   */
  private setupSliceButtons() {
    const axes = ['x', 'y', 'z'] as const;
    
    axes.forEach(axis => {
      const buttons = document.querySelectorAll(`[data-axis="${axis}"]`);
      
      buttons.forEach(button => {
        button.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          const index = parseInt(target.getAttribute('data-index') || '-1');
          
          // 更新按钮激活状态
          buttons.forEach(btn => btn.classList.remove('active'));
          target.classList.add('active');
          
          // 显示切面
          if (index === -1) {
            // ALL按钮：重置视图
            this.game.resetView();
          } else {
            // 显示指定切面
            this.game.showSlice(axis, index);
          }
        });
      });
    });
  }
}

// 启动应用
new App();
