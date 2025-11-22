#!/usr/bin/env node

/**
 * Test script for selenium-mcp-server npm package
 */

import { startServer, getVersion } from './index.js';

console.log('🧪 Testing selenium-mcp-server npm package...\n');

// Test 1: Get version
console.log('Test 1: Getting version...');
try {
  const version = await getVersion();
  console.log(`✅ Version: ${version}\n`);
} catch (err) {
  console.log(`⚠️  Could not get version: ${err.message}`);
  console.log('   (This is expected if the Python package is not installed yet)\n');
}

// Test 2: Start server with --help
console.log('Test 2: Starting server with --help...');
const server = startServer({
  args: ['--help'],
  stdio: true
});

server.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Server help displayed successfully\n');
    console.log('All tests passed! 🎉');
  } else {
    console.log(`\n⚠️  Server exited with code ${code}\n`);
  }
  process.exit(code);
});

// Handle errors
server.on('error', (err) => {
  console.error('❌ Error starting server:', err.message);
  process.exit(1);
});
