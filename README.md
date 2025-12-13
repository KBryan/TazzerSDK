# ⚡ Crypto Clicker Quest

A Phaser 3 clicker game with cross-chain crypto payments via the Trails API. Players mine coins by clicking a crystal and can purchase permanent upgrades using ETH from any supported blockchain.

View the video on YouTube

[![WIZAI](https://img.youtube.com/vi/qw9I5qYthj0/0.jpg)](https://www.youtube.com/watch?v=qw9I5qYthj0)


[Read my latest article on Medium](https://medium.com/@kwame.bryan/building-economic-incentive-games-with-trails-sdk-8e1eec4fcbcb)


## Features

-  **Phaser 3 Game Engine** - Smooth 60fps gameplay with particle effects and animations
-  **Cross-Chain Payments** - Buy upgrades with ETH from Arbitrum, Base, Polygon, Optimism, and more
-  **Trails API Integration** - Seamless intent-based cross-chain transactions
-  **Persistent Progress** - Game state saved to localStorage
-  **Responsive Design** - Works on desktop and mobile
-  **Retro-Futuristic UI** - Scanline effects, glow animations, pixel fonts

## Quick Start

### Option 1: Standalone HTML (No Build Required)

Simply open `index.html` in a browser. This version includes everything bundled and uses a simulated Trails API for demo purposes.

```bash
# Using Python
python -m http.server 8000

# Or using Node
npx serve .
```

Then open http://localhost:8000

### Option 2: Development Build (Full TypeScript)

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
crypto-clicker/
├── index.html              # Standalone version (no build needed)
├── index-bundled.html      # Template for bundled version
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.ts             # Application entry point
    ├── styles.css          # Global styles
    ├── game/
    │   └── GameScene.ts    # Phaser scenes and game logic
    └── services/
        └── TrailsService.ts # Trails API integration
```

## Configuration

Create a `.env` file with your settings:

```env
VITE_TRAILS_API_KEY=your_api_key_here
VITE_TREASURY_ADDRESS=0xYourTreasuryAddress
```

### Getting a Trails API Key

Join the [Trails Telegram group](https://t.me/build_with_trails) to request API access.

## Game Mechanics

### Clicking
- Click the crystal to earn coins
- Base click power starts at 1
- Upgrades permanently increase click power

### Auto Mining
- Purchase Auto Miners to generate coins passively
- Runs continuously in the background

### Multipliers
- Temporary boosts that multiply ALL coin generation
- Stack with click power and auto mining

### Shop Items

| Item | Price | Effect |
|------|-------|--------|
| Click Boost | 0.001 ETH | +10 click power |
| Auto Miner | 0.002 ETH | +5 coins/second |
| 2X Multiplier | 0.005 ETH | 2x all earnings for 5 min |
| Mega Pack | 0.01 ETH | +50 click, +20 auto, 10 min 2x |
| Legendary Crystal | 0.05 ETH | +500 click, +100 auto |

## Trails API Integration

### Payment Flow

```typescript
// 1. Get quote for cross-chain payment
const quote = await trails.quoteIntent({
  ownerAddress: playerWallet,
  originChainId: 42161,        // Pay from Arbitrum
  originTokenAddress: '0x0...',// Native ETH
  originTokenAmount: parseEther('0.001'),
  destinationChainId: 8453,    // Receive on Base
  destinationTokenAddress: '0x0...',
  destinationToAddress: treasury,
  tradeType: TradeType.EXACT_INPUT
});

// 2. Commit intent (locks rate)
const { intentId } = await trails.commitIntent(quote.intent);

// 3. Execute (triggers wallet popup)
await trails.executeIntent({ intentId });

// 4. Wait for confirmation
const receipt = await trails.waitIntentReceipt(intentId);
```

### Supported Chains

- Ethereum (1)
- Arbitrum (42161)
- Base (8453)
- Optimism (10)
- Polygon (137)
- Avalanche (43114)
- BNB Chain (56)
- Blast (81457)

## Extending the Game

### Adding New Shop Items

```typescript
// In src/main.ts
const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'super-crystal',
    name: 'Super Crystal',
    description: 'Unlocks a new crystal skin!',
    priceEth: 0.02,
    effect: () => {
      // Your custom effect
      gameState.addClickPower(100);
    }
  },
  // ...
];
```

### Custom Game Scenes

```typescript
// Create a new scene
class BossScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BossScene' });
  }
  
  create() {
    // Boss battle logic
  }
}

// Add to game config
const config = {
  scene: [MainScene, BossScene]
};
```

### Adding Contract Calls

Use `toCalldata` for custom contract interactions:

```typescript
import { encodeFunctionData } from 'viem';

const depositCalldata = encodeFunctionData({
  abi: yourContractABI,
  functionName: 'deposit',
  args: [amount]
});

const quote = await trails.quoteIntent({
  // ... standard params
  destinationToAddress: YOUR_CONTRACT,
  toCalldata: depositCalldata
});
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Phaser Game   │────▶│  GameState Mgr  │
│   (MainScene)   │     │  (Observable)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    ┌──────────────────┘
         │    │
         ▼    ▼
┌─────────────────┐     ┌─────────────────┐
│   Shop UI       │────▶│ Payment Service │
│   (DOM)         │     │   (Trails)      │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   Trails API    │
                        │  (Cross-chain)  │
                        └─────────────────┘
```

## Development

```bash
# Type checking
npm run typecheck

# Development with hot reload
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

Requires a Web3 wallet (MetaMask, Coinbase Wallet, etc.) for purchases.

## License

MIT

## Credits

- **Game Engine**: [Phaser 3](https://phaser.io/)
- **Cross-Chain**: [Trails Protocol](https://trails.build/)
- **Fonts**: Press Start 2P, VT323 (Google Fonts)

---

Built with ⚡ by integrating Trails cross-chain payments into Phaser gaming.
