/**
 * Crypto Clicker Quest - Main Entry Point
 * 
 * Initializes the Phaser game and integrates Trails payment service
 */

import { createGame, gameState, formatNumber, type GameState } from './game/GameScene.ts';
import { 
  GamePaymentService, 
  SUPPORTED_CHAINS, 
  type ShopItem 
} from './services/TrailsService.ts';

// ===========================================
// CONFIGURATION
// ===========================================

const CONFIG = {
  TRAILS_API_KEY: import.meta.env.VITE_TRAILS_API_KEY || '',
  TREASURY_ADDRESS: import.meta.env.VITE_TREASURY_ADDRESS || '',
  DESTINATION_CHAIN_ID: 1 // MainNet
};

// ===========================================
// SHOP ITEMS
// ===========================================

const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'click-boost',
    name: 'Click Boost',
    description: '+10 coins per click permanently. Stack infinitely!',
    priceEth: 0.00023,
    effect: () => gameState.addClickPower(10)
  },
  {
    id: 'auto-miner',
    name: 'Auto Miner',
    description: 'Generates 5 coins per second automatically.',
    priceEth: 0.00070,
    effect: () => gameState.addAutoPerSecond(5)
  },
  {
    id: 'multiplier',
    name: '2X Multiplier',
    description: 'Doubles ALL coin generation for 5 minutes!',
    priceEth: 0.0012,
    effect: () => gameState.setMultiplier(2, 5 * 60 * 1000)
  },
  {
    id: 'mega-pack',
    name: 'Mega Pack',
    description: '+50 click power, +20 auto/sec, and 10 min 2x boost!',
    priceEth: 0.0023,
    effect: () => {
      gameState.addClickPower(50);
      gameState.addAutoPerSecond(20);
      gameState.setMultiplier(2, 10 * 60 * 1000);
    }
  },
  {
    id: 'legendary-crystal',
    name: 'Legendary Crystal',
    description: '+500 click power, +100 auto/sec, permanent 1.5x base multiplier!',
    priceEth: 0.05,
    effect: () => {
      gameState.addClickPower(500);
      gameState.addAutoPerSecond(100);
    }
  }
];

// ===========================================
// APPLICATION CLASS
// ===========================================

class CryptoClickerApp {
  private game: Phaser.Game | null = null;
  private paymentService: GamePaymentService;
  private currentPurchaseItem: ShopItem | null = null;

  constructor() {
    this.paymentService = new GamePaymentService(
      CONFIG.TRAILS_API_KEY,
      CONFIG.TREASURY_ADDRESS,
      CONFIG.DESTINATION_CHAIN_ID
    );
  }

  /**
   * Initialize the application
   */
  async init(): Promise<void> {
    // Create the game
    this.game = createGame('game-container');

    // Setup UI
    this.setupWalletButton();
    this.setupShopUI();
    this.setupStatsDisplay();
    this.setupModal();

    // Subscribe to state changes
    gameState.subscribe((state) => this.updateStatsDisplay(state));

    console.log('🎮 Crypto Clicker Quest initialized!');
  }

  /**
   * Setup wallet connection button
   */
  private setupWalletButton(): void {
    const btn = document.getElementById('connect-btn');
    const display = document.getElementById('wallet-display');

    if (!btn || !display) return;

    btn.addEventListener('click', async () => {
      if (this.paymentService.isConnected()) {
        // Disconnect
        this.paymentService.disconnectWallet();
        btn.textContent = 'CONNECT WALLET';
        btn.classList.remove('connected');
        display.style.display = 'none';
        this.showToast('Wallet disconnected', 'success');
      } else {
        // Connect
        try {
          btn.textContent = 'CONNECTING...';
          const address = await this.paymentService.connectWallet();
          const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
          
          display.textContent = shortAddress;
          display.style.display = 'block';
          btn.textContent = 'DISCONNECT';
          btn.classList.add('connected');
          
          this.showToast(`Connected: ${shortAddress}`, 'success');
        } catch (error) {
          btn.textContent = 'CONNECT WALLET';
          this.showToast(
            error instanceof Error ? error.message : 'Connection failed',
            'error'
          );
        }
      }
    });
  }

  /**
   * Setup shop UI with items
   */
  private setupShopUI(): void {
    const shopContainer = document.getElementById('shop-items');
    if (!shopContainer) return;

    shopContainer.innerHTML = SHOP_ITEMS.map(item => `
      <div class="shop-item" data-item-id="${item.id}">
        <div class="item-header">
          <span class="item-name">${item.name.toUpperCase()}</span>
          <span class="item-price">${item.priceEth} ETH</span>
        </div>
        <p class="item-desc">${item.description}</p>
        <button class="buy-btn" data-item-id="${item.id}">
          BUY WITH CRYPTO
        </button>
      </div>
    `).join('');

    // Add click handlers
    shopContainer.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemId = (e.target as HTMLElement).dataset.itemId;
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (item) this.openPurchaseModal(item);
      });
    });
  }

  /**
   * Setup stats display
   */
  private setupStatsDisplay(): void {
    this.updateStatsDisplay(gameState.getState());
  }

  /**
   * Update stats display
   */
  private updateStatsDisplay(state: GameState): void {
    const elements = {
      coins: document.getElementById('coins-display'),
      clickPower: document.getElementById('click-power-display'),
      auto: document.getElementById('auto-display'),
      multiplier: document.getElementById('multiplier-display')
    };

    if (elements.coins) elements.coins.textContent = formatNumber(state.coins);
    if (elements.clickPower) elements.clickPower.textContent = formatNumber(state.clickPower);
    if (elements.auto) elements.auto.textContent = formatNumber(state.autoPerSecond);
    if (elements.multiplier) elements.multiplier.textContent = `${state.multiplier}x`;
  }

  /**
   * Setup purchase modal
   */
  private setupModal(): void {
    const modal = document.getElementById('purchase-modal');
    const cancelBtn = modal?.querySelector('.modal-btn.cancel');
    const confirmBtn = document.getElementById('confirm-btn');

    cancelBtn?.addEventListener('click', () => this.closeModal());
    confirmBtn?.addEventListener('click', () => this.confirmPurchase());

    // Close on overlay click
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) this.closeModal();
    });

    // Populate chain selector
    const chainSelect = document.getElementById('chain-select') as HTMLSelectElement;
    if (chainSelect) {
      chainSelect.innerHTML = Object.entries(SUPPORTED_CHAINS)
        .map(([id, chain]) => `
          <option value="${id}">${chain.name} (${chain.symbol})</option>
        `)
        .join('');
    }
  }

  /**
   * Open purchase modal for an item
   */
  private openPurchaseModal(item: ShopItem): void {
    if (!this.paymentService.isConnected()) {
      this.showToast('Connect your wallet first!', 'error');
      return;
    }

    this.currentPurchaseItem = item;

    const modal = document.getElementById('purchase-modal');
    const title = document.getElementById('modal-title');
    const text = document.getElementById('modal-text');

    if (title) title.textContent = `PURCHASE ${item.name.toUpperCase()}`;
    if (text) {
      text.textContent = `Pay ${item.priceEth} ETH from any chain. Trails handles the cross-chain magic! ✨`;
    }

    modal?.classList.add('active');
  }

  /**
   * Close purchase modal
   */
  private closeModal(): void {
    const modal = document.getElementById('purchase-modal');
    modal?.classList.remove('active');
    this.currentPurchaseItem = null;
  }

  /**
   * Confirm and process purchase
   */
  private async confirmPurchase(): Promise<void> {
    if (!this.currentPurchaseItem) return;

    const item = this.currentPurchaseItem;
    const chainSelect = document.getElementById('chain-select') as HTMLSelectElement;
    const chainId = parseInt(chainSelect.value);
    const confirmBtn = document.getElementById('confirm-btn') as HTMLButtonElement;

    confirmBtn.textContent = 'PROCESSING...';
    confirmBtn.disabled = true;
    confirmBtn.classList.add('processing');

    try {
      const receipt = await this.paymentService.purchaseItem(
        item,
        chainId,
        (status) => this.showToast(status, 'success')
      );

      if (receipt.status === 'completed') {
        this.closeModal();
        this.showToast(`${item.name} purchased! 🎉`, 'success');
      } else {
        this.showToast(`Purchase ${receipt.status}`, 'error');
      }
    } catch (error) {
      this.showToast(
        error instanceof Error ? error.message : 'Purchase failed',
        'error'
      );
    } finally {
      confirmBtn.textContent = 'CONFIRM';
      confirmBtn.disabled = false;
      confirmBtn.classList.remove('processing');
    }
  }

  /**
   * Show toast notification
   */
  private showToast(message: string, type: 'success' | 'error' = 'success'): void {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// ===========================================
// INITIALIZATION
// ===========================================

// Wait for DOM then initialize
document.addEventListener('DOMContentLoaded', () => {
  const app = new CryptoClickerApp();
  app.init().catch(console.error);
});

// Export for external use
export { CryptoClickerApp, SHOP_ITEMS, CONFIG };
