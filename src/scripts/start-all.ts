#!/usr/bin/env bun

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

console.log('🚀 Starting Yeet Bot and Web Interface...\n');

// Start the bot server
const botProcess = spawn('bun', ['run', 'start:web'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env }
});

// Start the web dev server
const webProcess = spawn('bun', ['run', 'web:dev'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env }
});

// Handle process termination
const cleanup = () => {
  console.log('\n🛑 Stopping all processes...');
  botProcess.kill('SIGTERM');
  webProcess.kill('SIGTERM');
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Handle process errors
botProcess.on('error', (err) => {
  console.error('❌ Bot process error:', err);
  cleanup();
});

webProcess.on('error', (err) => {
  console.error('❌ Web process error:', err);
  cleanup();
});

console.log('✅ Bot server running (with websocket)');
console.log('✅ Web interface starting on http://localhost:5173');
console.log('\nPress Ctrl+C to stop all processes\n');