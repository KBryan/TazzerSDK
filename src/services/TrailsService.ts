/**
 * Trails API Service
 * 
 * Production-ready service for cross-chain payments via Trails Protocol.
 * Handles the full intent lifecycle: Quote → Commit → Execute → Receipt
 */

import { ethers } from 'ethers';

// ===========================================
// TYPES
// ===========================================

export enum TradeType {
  EXACT_INPUT = 'EXACT_INPUT',
  EXACT_OUTPUT = 'EXACT_OUTPUT'
}

export enum RouteProvider {
  AUTO = 'AUTO',
  CCTP = 'CCTP',
  LIFI = 'LIFI',
  RELAY = 'RELAY',
  SUSHI = 'SUSHI',
  ZEROX = 'ZEROX'
}

export interface QuoteRequest {
  ownerAddress: string;
  originChainId: number;
  originTokenAddress: string;
  originTokenAmount: bigint;
  destinationChainId: number;
  destinationTokenAddress: string;
  destinationToAddress: string;
  tradeType: TradeType;
  options?: {
    slippageTolerance?: number;
    bridgeProvider?: RouteProvider;
  };
  toCalldata?: string; // For executing contract calls on destination
}

export interface Intent {
  id: string;
  originChainId: number;
  destinationChainId: number;
  originTokenAddress: string;
  destinationTokenAddress: string;
  originTokenAmount: string;
  destinationTokenAmount: string;
  ownerAddress: string;
  destinationToAddress: string;
  expiresAt: number;
}

export interface Quote {
  intent: Intent;
  fromAmount: string;
  fromAmountMin: string;
  toAmount: string;
  toAmountMin: string;
  fees: {
    totalFeeAmount: string;
    totalFeeAmountUsd: string;
  };
  priceImpact: string;
  completionEstimateSeconds: number;
  route: string;
}

export interface IntentReceipt {
  intentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  originTxHash?: string;
  destinationTxHash?: string;
  error?: string;
}

export interface TransactionState {
  step: string;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
  chainId: number;
}

// ===========================================
// CHAIN CONFIGURATIONS
// ===========================================

export const SUPPORTED_CHAINS = {
  1: { name: 'Ethereum', symbol: 'ETH', rpcUrl: 'https://eth.llamarpc.com' },
  10: { name: 'Optimism', symbol: 'ETH', rpcUrl: 'https://mainnet.optimism.io' },
  137: { name: 'Polygon', symbol: 'MATIC', rpcUrl: 'https://polygon-rpc.com' },
  8453: { name: 'Base', symbol: 'ETH', rpcUrl: 'https://mainnet.base.org' },
  42161: { name: 'Arbitrum', symbol: 'ETH', rpcUrl: 'https://arb1.arbitrum.io/rpc' },
  43114: { name: 'Avalanche', symbol: 'AVAX', rpcUrl: 'https://api.avax.network/ext/bc/C/rpc' },
  56: { name: 'BNB Chain', symbol: 'BNB', rpcUrl: 'https://bsc-dataseed.binance.org' },
  81457: { name: 'Blast', symbol: 'ETH', rpcUrl: 'https://rpc.blast.io' }
} as const;

export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

// Common token addresses
export const TOKENS = {
  USDC: {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
  },
  USDT: {
    1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
  }
} as const;

// ===========================================
// TRAILS SERVICE CLASS
// ===========================================

export class TrailsService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.trails.build') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(endpoint: string, body: object): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Step 1: Get a quote for cross-chain transaction
   */
  async quoteIntent(params: QuoteRequest): Promise<Quote> {
    return this.request<Quote>('/v1/quoteIntent', {
      ownerAddress: params.ownerAddress,
      originChainId: params.originChainId,
      originTokenAddress: params.originTokenAddress,
      originTokenAmount: params.originTokenAmount.toString(),
      destinationChainId: params.destinationChainId,
      destinationTokenAddress: params.destinationTokenAddress,
      destinationToAddress: params.destinationToAddress,
      tradeType: params.tradeType,
      slippageTolerance: params.options?.slippageTolerance ?? 0.005,
      bridgeProvider: params.options?.bridgeProvider ?? RouteProvider.AUTO,
      toCalldata: params.toCalldata
    });
  }

  /**
   * Step 2: Commit intent to lock in rates
   */
  async commitIntent(intent: Intent): Promise<{ intentId: string; expiresAt: number }> {
    return this.request('/v1/commitIntent', { intent });
  }

  /**
   * Step 3: Execute the intent (triggers wallet transaction)
   */
  async executeIntent(params: {
    intentId: string;
    depositSignature?: string;
  }): Promise<{ txHash: string }> {
    return this.request('/v1/executeIntent', params);
  }

  /**
   * Step 4a: Get intent receipt (non-blocking)
   */
  async getIntentReceipt(intentId: string): Promise<IntentReceipt> {
    return this.request('/v1/getIntentReceipt', { intentId });
  }

  /**
   * Step 4b: Wait for intent receipt (blocking)
   */
  async waitIntentReceipt(
    intentId: string,
    options?: { timeout?: number; pollInterval?: number }
  ): Promise<IntentReceipt> {
    const timeout = options?.timeout ?? 300000; // 5 minutes default
    const pollInterval = options?.pollInterval ?? 2000; // 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const receipt = await this.getIntentReceipt(intentId);
      
      if (receipt.status === 'completed' || receipt.status === 'failed' || receipt.status === 'refunded') {
        return receipt;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Intent receipt timeout');
  }

  /**
   * Get intent details
   */
  async getIntent(intentId: string): Promise<Intent> {
    return this.request('/v1/getIntent', { intentId });
  }

  /**
   * Search intents by owner
   */
  async searchIntents(params: {
    ownerAddress: string;
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<{ intents: Intent[]; total: number }> {
    return this.request('/v1/searchIntents', params);
  }

  /**
   * Get supported chains
   */
  async getChains(): Promise<Array<{ chainId: number; name: string; supported: boolean }>> {
    return this.request('/v1/getChains', {});
  }

  /**
   * Get token list
   */
  async getTokenList(chainId?: number): Promise<Array<{
    address: string;
    symbol: string;
    decimals: number;
    chainId: number;
  }>> {
    return this.request('/v1/getTokenList', { chainId });
  }

  /**
   * Get token prices
   */
  async getTokenPrices(tokens: Array<{ chainId: number; address: string }>): Promise<{
    prices: Array<{ chainId: number; address: string; priceUsd: number }>;
  }> {
    return this.request('/v1/getTokenPrices', { tokens });
  }
}

// ===========================================
// GAME PAYMENT SERVICE
// ===========================================

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  priceEth: number;
  effect: () => void;
}

export class GamePaymentService {
  private trails: TrailsService;
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private address: string | null = null;
  private treasuryAddress: string;
  private destinationChainId: number;

  constructor(
    apiKey: string,
    treasuryAddress: string,
    destinationChainId: number = 8453 // Base by default
  ) {
    this.trails = new TrailsService(apiKey);
    this.treasuryAddress = treasuryAddress;
    this.destinationChainId = destinationChainId;
  }

  /**
   * Connect to user's wallet
   */
  async connectWallet(): Promise<string> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No wallet detected');
    }

    this.provider = new ethers.BrowserProvider(window.ethereum);
    this.signer = await this.provider.getSigner();
    this.address = await this.signer.getAddress();

    return this.address;
  }

  /**
   * Disconnect wallet
   */
  disconnectWallet(): void {
    this.provider = null;
    this.signer = null;
    this.address = null;
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this.address !== null;
  }

  /**
   * Get connected wallet address
   */
  getAddress(): string | null {
    return this.address;
  }

  /**
   * Get current chain ID
   */
  async getChainId(): Promise<number> {
    if (!this.provider) throw new Error('Wallet not connected');
    const network = await this.provider.getNetwork();
    return Number(network.chainId);
  }

  /**
   * Purchase a shop item with cross-chain payment
   */
  async purchaseItem(
    item: ShopItem,
    fromChainId: number,
    onStatusUpdate?: (status: string) => void
  ): Promise<IntentReceipt> {
    if (!this.address || !this.signer) {
      throw new Error('Wallet not connected');
    }

    const update = onStatusUpdate || (() => {});

    try {
      // Step 1: Get quote
      update('Getting best route...');
      const quote = await this.trails.quoteIntent({
        ownerAddress: this.address,
        originChainId: fromChainId,
        originTokenAddress: NATIVE_TOKEN_ADDRESS,
        originTokenAmount: ethers.parseEther(item.priceEth.toString()),
        destinationChainId: this.destinationChainId,
        destinationTokenAddress: NATIVE_TOKEN_ADDRESS,
        destinationToAddress: this.treasuryAddress,
        tradeType: TradeType.EXACT_INPUT
      });

      // Step 2: Commit intent
      update('Locking in rate...');
      const { intentId } = await this.trails.commitIntent(quote.intent);

      // Step 3: Execute (this will trigger wallet popup in production)
      update('Confirm in your wallet...');
      await this.trails.executeIntent({ intentId });

      // Step 4: Wait for completion
      update('Waiting for confirmation...');
      const receipt = await this.trails.waitIntentReceipt(intentId);

      if (receipt.status === 'completed') {
        // Apply the item effect
        item.effect();
      }

      return receipt;
    } catch (error) {
      if (error instanceof Error && error.message.includes('rejected')) {
        throw new Error('Transaction rejected by user');
      }
      throw error;
    }
  }

  /**
   * Get transaction history for current wallet
   */
  async getTransactionHistory(limit: number = 20): Promise<Intent[]> {
    if (!this.address) {
      throw new Error('Wallet not connected');
    }

    const result = await this.trails.searchIntents({
      ownerAddress: this.address,
      limit
    });

    return result.intents;
  }
}

// ===========================================
// EXPORT DEFAULT INSTANCE FACTORY
// ===========================================

export function createGamePaymentService(
  apiKey: string,
  treasuryAddress: string,
  destinationChainId?: number
): GamePaymentService {
  return new GamePaymentService(apiKey, treasuryAddress, destinationChainId);
}
