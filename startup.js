#!/usr/bin/env node

// Startup script for backend-only deployment
const { spawn } = require('child_process');

console.log('🚀 Starting Crypto Trading Backend API...');
console.log('📊 Features: 28 cryptocurrency tickers, live prices, TradingView webhooks');
console.log('🔗 Database: PostgreSQL (Neon) - 24/7 active');
console.log('⚡ Mode: Production API Server');

// Start the application
const child = spawn('node', ['dist/index.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

child.on('exit', (code) => {
  console.log(`Backend API exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down backend API...');
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down backend API...');
  child.kill('SIGINT');
});