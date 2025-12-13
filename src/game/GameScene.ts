/**
 * Crypto Clicker Quest - Game Logic
 * 
 * Phaser 3 game with clicker mechanics and crypto shop integration
 */

import Phaser from 'phaser';

// ===========================================
// GAME STATE
// ===========================================

export interface GameState {
  coins: number;
  clickPower: number;
  autoPerSecond: number;
  multiplier: number;
  multiplierEndTime: number;
  totalClicks: number;
  totalCoinsEarned: number;
  purchaseCount: number;
}

class GameStateManager {
  private static instance: GameStateManager;
  private state: GameState;
  private listeners: Set<(state: GameState) => void> = new Set();

  private constructor() {
    this.state = this.loadState();
  }

  static getInstance(): GameStateManager {
    if (!GameStateManager.instance) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  private loadState(): GameState {
    const saved = localStorage.getItem('cryptoClickerState');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Invalid save, use defaults
      }
    }
    return {
      coins: 0,
      clickPower: 1,
      autoPerSecond: 0,
      multiplier: 1,
      multiplierEndTime: 0,
      totalClicks: 0,
      totalCoinsEarned: 0,
      purchaseCount: 0
    };
  }

  saveState(): void {
    localStorage.setItem('cryptoClickerState', JSON.stringify(this.state));
  }

  getState(): GameState {
    return { ...this.state };
  }

  subscribe(listener: (state: GameState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.getState()));
    this.saveState();
  }

  // Actions
  addCoins(amount: number): void {
    const earned = amount * this.state.multiplier;
    this.state.coins += earned;
    this.state.totalCoinsEarned += earned;
    this.notify();
  }

  click(): number {
    this.state.totalClicks++;
    const earned = this.state.clickPower * this.state.multiplier;
    this.state.coins += earned;
    this.state.totalCoinsEarned += earned;
    this.notify();
    return earned;
  }

  autoGenerate(): number {
    if (this.state.autoPerSecond <= 0) return 0;
    const earned = this.state.autoPerSecond * this.state.multiplier;
    this.state.coins += earned;
    this.state.totalCoinsEarned += earned;
    this.notify();
    return earned;
  }

  addClickPower(amount: number): void {
    this.state.clickPower += amount;
    this.state.purchaseCount++;
    this.notify();
  }

  addAutoPerSecond(amount: number): void {
    this.state.autoPerSecond += amount;
    this.state.purchaseCount++;
    this.notify();
  }

  setMultiplier(multiplier: number, durationMs: number): void {
    this.state.multiplier = multiplier;
    this.state.multiplierEndTime = Date.now() + durationMs;
    this.state.purchaseCount++;
    this.notify();
  }

  checkMultiplierExpiry(): boolean {
    if (this.state.multiplier > 1 && Date.now() > this.state.multiplierEndTime) {
      this.state.multiplier = 1;
      this.state.multiplierEndTime = 0;
      this.notify();
      return true;
    }
    return false;
  }

  resetState(): void {
    this.state = {
      coins: 0,
      clickPower: 1,
      autoPerSecond: 0,
      multiplier: 1,
      multiplierEndTime: 0,
      totalClicks: 0,
      totalCoinsEarned: 0,
      purchaseCount: 0
    };
    this.notify();
  }
}

export const gameState = GameStateManager.getInstance();

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

export function formatNumber(num: number): string {
  if (num >= 1_000_000_000_000) return (num / 1_000_000_000_000).toFixed(1) + 'T';
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return Math.floor(num).toString();
}

// ===========================================
// MAIN GAME SCENE
// ===========================================

export class MainScene extends Phaser.Scene {
  private crystal!: Phaser.GameObjects.Image;
  private coinEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private glowFX!: Phaser.FX.Glow;
  private clickText!: Phaser.GameObjects.Text;
  private coinCounter!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MainScene' });
  }

  preload(): void {
    this.createTextures();
  }

  private createTextures(): void {
    // Crystal texture
    const crystalGfx = this.make.graphics({ x: 0, y: 0, add: false });
    
    // Outer crystal shape
    crystalGfx.fillStyle(0x00ff88, 1);
    crystalGfx.beginPath();
    crystalGfx.moveTo(60, 0);
    crystalGfx.lineTo(110, 35);
    crystalGfx.lineTo(110, 85);
    crystalGfx.lineTo(60, 120);
    crystalGfx.lineTo(10, 85);
    crystalGfx.lineTo(10, 35);
    crystalGfx.closePath();
    crystalGfx.fillPath();

    // Inner facet
    crystalGfx.fillStyle(0x80ffcc, 0.7);
    crystalGfx.beginPath();
    crystalGfx.moveTo(60, 15);
    crystalGfx.lineTo(95, 40);
    crystalGfx.lineTo(95, 75);
    crystalGfx.lineTo(60, 100);
    crystalGfx.lineTo(25, 75);
    crystalGfx.lineTo(25, 40);
    crystalGfx.closePath();
    crystalGfx.fillPath();

    // Core highlight
    crystalGfx.fillStyle(0xffffff, 0.9);
    crystalGfx.fillCircle(60, 60, 18);
    crystalGfx.fillStyle(0x00ff88, 0.5);
    crystalGfx.fillCircle(60, 60, 12);

    crystalGfx.generateTexture('crystal', 120, 120);

    // Particle texture
    const particleGfx = this.make.graphics({ x: 0, y: 0, add: false });
    particleGfx.fillStyle(0x00ff88, 1);
    particleGfx.fillCircle(8, 8, 8);
    particleGfx.generateTexture('particle', 16, 16);

    // Coin texture
    const coinGfx = this.make.graphics({ x: 0, y: 0, add: false });
    coinGfx.fillStyle(0xffd700, 1);
    coinGfx.fillCircle(12, 12, 12);
    coinGfx.fillStyle(0xffea00, 1);
    coinGfx.fillCircle(10, 10, 8);
    coinGfx.lineStyle(2, 0xcc9900, 1);
    coinGfx.strokeCircle(12, 12, 10);
    coinGfx.generateTexture('coin', 24, 24);

    // Star texture for special effects
    const starGfx = this.make.graphics({ x: 0, y: 0, add: false });
    starGfx.fillStyle(0xffffff, 1);
    this.drawStar(starGfx, 16, 16, 5, 16, 8);
    starGfx.generateTexture('star', 32, 32);
  }

  private drawStar(
    graphics: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    spikes: number,
    outerRadius: number,
    innerRadius: number
  ): void {
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;

    graphics.beginPath();
    graphics.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outerRadius;
      let y = cy + Math.sin(rot) * outerRadius;
      graphics.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      graphics.lineTo(x, y);
      rot += step;
    }

    graphics.lineTo(cx, cy - outerRadius);
    graphics.closePath();
    graphics.fillPath();
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Background gradient
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0d0d15, 0x0d0d15, 0x1a1a2e, 0x1a1a2e);
    bg.fillRect(0, 0, width, height);

    // Background particles
    this.add.particles(centerX, centerY, 'particle', {
      speed: { min: 5, max: 20 },
      scale: { start: 0.2, end: 0 },
      alpha: { start: 0.4, end: 0 },
      lifespan: 4000,
      frequency: 300,
      blendMode: 'ADD',
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(-width/2, -height/2, width, height)
      }
    });

    // Main crystal
    this.crystal = this.add.image(centerX, centerY - 20, 'crystal')
      .setScale(1.8)
      .setInteractive({ useHandCursor: true });

    // Add glow effect
    this.glowFX = this.crystal.preFX!.addGlow(0x00ff88, 4, 0, false, 0.1, 16);

    // Floating animation
    this.tweens.add({
      targets: this.crystal,
      y: centerY - 35,
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Coin emitter
    this.coinEmitter = this.add.particles(centerX, centerY - 20, 'coin', {
      speed: { min: 150, max: 250 },
      angle: { min: 220, max: 320 },
      scale: { start: 0.7, end: 0 },
      lifespan: 1200,
      gravityY: 400,
      rotate: { min: 0, max: 360 },
      emitting: false
    });

    // Click handler
    this.crystal.on('pointerdown', () => this.handleClick());

    // Click instruction text
    this.clickText = this.add.text(centerX, centerY + 100, '⚡ CLICK TO MINE ⚡', {
      fontFamily: '"Press Start 2P", cursive',
      fontSize: '11px',
      color: '#00ff88',
      align: 'center'
    }).setOrigin(0.5);

    // Pulsing animation for click text
    this.tweens.add({
      targets: this.clickText,
      alpha: 0.4,
      duration: 900,
      yoyo: true,
      repeat: -1
    });

    // Coin counter (top)
    this.coinCounter = this.add.text(centerX, 30, '0', {
      fontFamily: '"Press Start 2P", cursive',
      fontSize: '20px',
      color: '#ffd700',
      stroke: '#000',
      strokeThickness: 4,
      align: 'center'
    }).setOrigin(0.5);

    // Stats text (bottom)
    this.statsText = this.add.text(centerX, height - 25, '', {
      fontFamily: '"VT323", monospace',
      fontSize: '16px',
      color: '#888',
      align: 'center'
    }).setOrigin(0.5);

    // Subscribe to state changes
    gameState.subscribe((state) => this.updateDisplay(state));
    this.updateDisplay(gameState.getState());

    // Auto-generation timer
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        gameState.autoGenerate();
        if (gameState.checkMultiplierExpiry()) {
          this.showToast('Multiplier expired!');
        }
      },
      loop: true
    });
  }

  private handleClick(): void {
    const earned = gameState.click();

    // Scale bounce
    this.tweens.add({
      targets: this.crystal,
      scale: 2.0,
      duration: 60,
      yoyo: true,
      ease: 'Power2'
    });

    // Glow pulse
    this.tweens.add({
      targets: this.glowFX,
      outerStrength: 8,
      duration: 100,
      yoyo: true
    });

    // Emit coins
    this.coinEmitter.explode(Math.min(3 + Math.floor(earned / 100), 10));

    // Floating number
    this.showFloatingNumber(earned);

    // Screen shake for big clicks
    if (earned >= 50) {
      this.cameras.main.shake(80, 0.003 * Math.min(earned / 50, 3));
    }

    // Special effects for milestones
    const state = gameState.getState();
    if (state.totalClicks % 100 === 0) {
      this.celebrationEffect();
    }
  }

  private showFloatingNumber(amount: number): void {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    const offsetX = Phaser.Math.Between(-40, 40);
    const text = this.add.text(
      centerX + offsetX,
      centerY - 60,
      `+${formatNumber(amount)}`,
      {
        fontFamily: '"Press Start 2P", cursive',
        fontSize: amount >= 100 ? '16px' : '12px',
        color: amount >= 100 ? '#ffd700' : '#00ff88',
        stroke: '#000',
        strokeThickness: 3
      }
    ).setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: centerY - 140,
      alpha: 0,
      scale: amount >= 100 ? 1.8 : 1.3,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }

  private celebrationEffect(): void {
    const { width, height } = this.cameras.main;
    
    // Star burst
    const stars = this.add.particles(width / 2, height / 2, 'star', {
      speed: { min: 200, max: 400 },
      scale: { start: 0.5, end: 0 },
      lifespan: 1500,
      blendMode: 'ADD',
      tint: [0xffd700, 0x00ff88, 0xff6b35]
    });
    
    stars.explode(20);
    this.time.delayedCall(2000, () => stars.destroy());
  }

  private showToast(message: string): void {
    const { width } = this.cameras.main;
    
    const toast = this.add.text(width / 2, 80, message, {
      fontFamily: '"VT323", monospace',
      fontSize: '18px',
      color: '#ff6b35',
      backgroundColor: '#1a1a2e',
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: toast,
      alpha: 1,
      y: 100,
      duration: 300,
      hold: 2000,
      yoyo: true,
      onComplete: () => toast.destroy()
    });
  }

  private updateDisplay(state: GameState): void {
    this.coinCounter.setText(formatNumber(state.coins));
    
    const multiplierStr = state.multiplier > 1 
      ? ` | ${state.multiplier}x ACTIVE!` 
      : '';
    
    this.statsText.setText(
      `Click: ${formatNumber(state.clickPower)} | Auto: ${formatNumber(state.autoPerSecond)}/s${multiplierStr}`
    );

    // Update glow color based on multiplier
    if (state.multiplier > 1) {
      this.glowFX.color = 0xffd700;
    } else {
      this.glowFX.color = 0x00ff88;
    }
  }

  update(): void {
    // Slow crystal rotation
    if (this.crystal) {
      this.crystal.rotation += 0.001;
    }
  }
}

// ===========================================
// GAME CONFIGURATION
// ===========================================

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 500,
  height: 400,
  parent: 'game-container',
  backgroundColor: '#0d0d15',
  scene: MainScene,
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    pixelArt: false,
    antialias: true
  }
};

// ===========================================
// GAME INSTANCE
// ===========================================

export function createGame(containerId?: string): Phaser.Game {
  const config = { ...gameConfig };
  if (containerId) {
    config.parent = containerId;
  }
  return new Phaser.Game(config);
}
