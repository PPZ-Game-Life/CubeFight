import { GameMode, RefreshMode, CONFIG, LEVEL_VALUES } from './Config';

/**
 * 游戏状态管理器
 * 负责管理游戏的全局状态：分数、金币、Combo、游戏模式等
 */
export class GameStateManager {
  // 游戏模式
  private gameMode: GameMode = GameMode.ENDLESS;
  private refreshMode: RefreshMode = RefreshMode.DYNAMIC;
  
  // 积分系统
  private score: number = 0;
  private totalScore: number = 0;  // 历史总积分（用于排行榜）
  
  // 金币系统
  private coin: number = 0;
  private totalCoin: number = 0;   // 历史总金币（用于排行榜）
  
  // Combo系统
  private comboCount: number = 0;
  private lastActionTime: number = 0;
  private maxCombo: number = 0;    // 本局最高连击
  
  // 关卡系统
  private currentLevel: number = 1;
  private levelGoal: number = 0;   // 关卡目标（如需要达到的分数）
  
  // 游戏状态
  private isGameOver: boolean = false;
  private isPaused: boolean = false;
  
  // 最高合成等级
  private maxMergedLevel: number = 1;
  
  constructor() {
    this.resetSession();
  }
  
  /**
   * 重置单局游戏状态
   */
  resetSession() {
    this.score = 0;
    this.comboCount = 0;
    this.lastActionTime = 0;
    this.maxCombo = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.maxMergedLevel = 1;
  }
  
  /**
   * 设置游戏模式
   */
  setGameMode(mode: GameMode) {
    this.gameMode = mode;
    const modeConfig = CONFIG.GAME_MODES[mode];
    this.refreshMode = modeConfig.refreshMode;
  }
  
  /**
   * 获取游戏模式
   */
  getGameMode(): GameMode {
    return this.gameMode;
  }
  
  /**
   * 获取刷新模式
   */
  getRefreshMode(): RefreshMode {
    return this.refreshMode;
  }
  
  /**
   * 添加分数（带Combo乘数）
   */
  addScore(baseScore: number): number {
    const multiplier = Math.max(1, this.comboCount);
    const finalScore = baseScore * multiplier;
    this.score += finalScore;
    this.totalScore += finalScore;
    return finalScore;
  }
  
  /**
   * 添加金币
   */
  addCoin(amount: number) {
    this.coin += amount;
    this.totalCoin += amount;
  }
  
  /**
   * 消耗金币
   */
  spendCoin(amount: number): boolean {
    if (this.coin >= amount) {
      this.coin -= amount;
      return true;
    }
    return false;
  }
  
  /**
   * 更新Combo
   */
  updateCombo() {
    const now = Date.now();
    
    // 检查是否超时
    if (now - this.lastActionTime > CONFIG.COMBO_TIMEOUT) {
      this.comboCount = 0;
    }
    
    this.comboCount++;
    this.lastActionTime = now;
    
    // 更新最高连击
    if (this.comboCount > this.maxCombo) {
      this.maxCombo = this.comboCount;
    }
  }
  
  /**
   * 重置Combo
   */
  resetCombo() {
    this.comboCount = 0;
    this.lastActionTime = 0;
  }
  
  /**
   * 获取当前Combo数
   */
  getComboCount(): number {
    return this.comboCount;
  }
  
  /**
   * 获取最高Combo数
   */
  getMaxCombo(): number {
    return this.maxCombo;
  }
  
  /**
   * 更新最高合成等级
   */
  updateMaxMergedLevel(level: number) {
    if (level > this.maxMergedLevel) {
      this.maxMergedLevel = level;
    }
  }
  
  /**
   * 获取最高合成等级
   */
  getMaxMergedLevel(): number {
    return this.maxMergedLevel;
  }
  
  /**
   * 获取当前分数
   */
  getScore(): number {
    return this.score;
  }
  
  /**
   * 获取当前金币
   */
  getCoin(): number {
    return this.coin;
  }
  
  /**
   * 获取历史总分
   */
  getTotalScore(): number {
    return this.totalScore;
  }
  
  /**
   * 获取历史总金币
   */
  getTotalCoin(): number {
    return this.totalCoin;
  }
  
  /**
   * 设置游戏结束
   */
  setGameOver(isOver: boolean) {
    this.isGameOver = isOver;
  }
  
  /**
   * 是否游戏结束
   */
  isOver(): boolean {
    return this.isGameOver;
  }
  
  /**
   * 暂停游戏
   */
  pause() {
    this.isPaused = true;
  }
  
  /**
   * 恢复游戏
   */
  resume() {
    this.isPaused = false;
  }
  
  /**
   * 是否暂停
   */
  isPausedState(): boolean {
    return this.isPaused;
  }
  
  /**
   * 设置当前关卡
   */
  setCurrentLevel(level: number) {
    this.currentLevel = level;
  }
  
  /**
   * 获取当前关卡
   */
  getCurrentLevel(): number {
    return this.currentLevel;
  }
  
  /**
   * 设置关卡目标
   */
  setLevelGoal(goal: number) {
    this.levelGoal = goal;
  }
  
  /**
   * 获取关卡目标
   */
  getLevelGoal(): number {
    return this.levelGoal;
  }
  
  /**
   * 检查是否达成关卡目标
   */
  isLevelGoalMet(): boolean {
    return this.score >= this.levelGoal;
  }
  
  /**
   * 获取游戏统计数据
   */
  getSessionStats() {
    return {
      score: this.score,
      coin: this.coin,
      maxCombo: this.maxCombo,
      maxMergedLevel: this.maxMergedLevel,
      gameMode: this.gameMode,
      currentLevel: this.currentLevel
    };
  }
}
