export type AssetPrice = {
  symbol: string;
  price: number;
  change: number;
  timestamp: number;
};

// Mock data for initial development and fallback
const MOCK_PRICES: Record<string, number> = {
  'AAPL': 185.92,
  'MSFT': 415.10,
  'TSLA': 175.40,
  'BTC-USD': 64230.50,
  'ETH-USD': 3450.20,
  'NVDA': 875.30,
  'EUR/USD': 1.0845,
  'GBP/USD': 1.2630,
  'USD/JPY': 151.40,
  'AUD/USD': 0.6520,
  'USD/CHF': 0.9010,
};

export const fetchPrice = async (symbol: string): Promise<AssetPrice> => {
  // In a real app, you would fetch from Massive.com (Polygon.io)
  // For now, we simulate a delay and return mock data or a slightly randomized price
  await new Promise(resolve => setTimeout(resolve, 500));

  const basePrice = MOCK_PRICES[symbol] || 100.00;
  const drift = (Math.random() - 0.5) * 0.01; // 1% random drift
  const currentPrice = basePrice * (1 + drift);

  return {
    symbol,
    price: parseFloat(currentPrice.toFixed(2)),
    change: parseFloat((drift * 100).toFixed(2)),
    timestamp: Date.now(),
  };
};

export const getAvailableSymbols = () => Object.keys(MOCK_PRICES);
