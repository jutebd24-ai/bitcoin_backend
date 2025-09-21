// Script to initialize popular cryptocurrency tickers in the database
import { db } from './db.js';
import { storage } from './storage.js';

const popularTickers = [
  // Major Cryptocurrencies
  { symbol: "BTCUSDT", description: "Bitcoin / Tether USD", category: "major", marketCap: 1 },
  { symbol: "ETHUSDT", description: "Ethereum / Tether USD", category: "major", marketCap: 2 },
  { symbol: "BNBUSDT", description: "Binance Coin / Tether USD", category: "major", marketCap: 4 },
  { symbol: "SOLUSDT", description: "Solana / Tether USD", category: "major", marketCap: 5 },
  { symbol: "XRPUSDT", description: "Ripple / Tether USD", category: "major", marketCap: 6 },
  
  // Layer 1 Blockchain Tokens
  { symbol: "ADAUSDT", description: "Cardano / Tether USD", category: "layer1", marketCap: 8 },
  { symbol: "DOTUSDT", description: "Polkadot / Tether USD", category: "layer1", marketCap: 12 },
  { symbol: "MATICUSDT", description: "Polygon / Tether USD", category: "layer1", marketCap: 15 },
  { symbol: "AVAXUSDT", description: "Avalanche / Tether USD", category: "layer1", marketCap: 11 },
  { symbol: "ATOMUSDT", description: "Cosmos / Tether USD", category: "layer1", marketCap: 20 },
  { symbol: "NEARUSDT", description: "NEAR Protocol / Tether USD", category: "layer1", marketCap: 25 },
  
  // DeFi Tokens
  { symbol: "LINKUSDT", description: "Chainlink / Tether USD", category: "defi", marketCap: 14 },
  { symbol: "UNIUSDT", description: "Uniswap / Tether USD", category: "defi", marketCap: 18 },
  { symbol: "AAVEUSDT", description: "Aave / Tether USD", category: "defi", marketCap: 22 },
  { symbol: "CRVUSDT", description: "Curve / Tether USD", category: "defi", marketCap: 35 },
  { symbol: "COMPUSDT", description: "Compound / Tether USD", category: "defi", marketCap: 45 },
  
  // Legacy & Established
  { symbol: "LTCUSDT", description: "Litecoin / Tether USD", category: "legacy", marketCap: 16 },
  { symbol: "ETCUSDT", description: "Ethereum Classic / Tether USD", category: "legacy", marketCap: 28 },
  { symbol: "XLMUSDT", description: "Stellar / Tether USD", category: "legacy", marketCap: 30 },
  
  // Utility & Infrastructure
  { symbol: "VETUSDT", description: "VeChain / Tether USD", category: "utility", marketCap: 32 },
  { symbol: "FILUSDT", description: "Filecoin / Tether USD", category: "utility", marketCap: 26 },
  { symbol: "TRXUSDT", description: "TRON / Tether USD", category: "utility", marketCap: 17 },
  
  // Emerging & Growth
  { symbol: "FTMUSDT", description: "Fantom / Tether USD", category: "emerging", marketCap: 38 },
  { symbol: "ALGOUSDT", description: "Algorand / Tether USD", category: "emerging", marketCap: 42 },
  { symbol: "ICPUSDT", description: "Internet Computer / Tether USD", category: "emerging", marketCap: 33 },
  
  // Additional Popular Tokens
  { symbol: "EOSUSDT", description: "EOS / Tether USD", category: "legacy", marketCap: 48 },
  { symbol: "HBARUSDT", description: "Hedera / Tether USD", category: "utility", marketCap: 40 },
  { symbol: "XTZUSDT", description: "Tezos / Tether USD", category: "layer1", marketCap: 44 },
];

async function initializeTickers() {
  console.log('Initializing cryptocurrency tickers...');
  
  try {
    // Get existing tickers to avoid duplicates
    const existingTickers = await storage.getAllTickers();
    const existingSymbols = new Set(existingTickers.map(t => t.symbol));
    
    let addedCount = 0;
    
    for (const ticker of popularTickers) {
      if (!existingSymbols.has(ticker.symbol)) {
        await storage.createTicker({
          symbol: ticker.symbol,
          description: ticker.description,
          category: ticker.category,
          marketCap: ticker.marketCap,
          isEnabled: true,
        });
        console.log(`Added: ${ticker.symbol} - ${ticker.description}`);
        addedCount++;
      } else {
        console.log(`Skipped: ${ticker.symbol} (already exists)`);
      }
    }
    
    console.log(`\nInitialization complete!`);
    console.log(`Total tickers added: ${addedCount}`);
    console.log(`Total tickers in system: ${existingTickers.length + addedCount}`);
    
  } catch (error) {
    console.error('Error initializing tickers:', error);
  }
}

// This module exports the initialization function to be called from server startup

export { initializeTickers };