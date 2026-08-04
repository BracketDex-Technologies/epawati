#!/usr/bin/env node

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const root = process.cwd();
const binExt = process.platform === 'win32' ? '.cmd' : '';
const prismaBin = path.join(root, 'node_modules', '.bin', `prisma${binExt}`);
const nextBin = path.join(root, 'node_modules', '.bin', `next${binExt}`);
const devDir = path.join(root, '.next', 'dev');
const port = process.env.PORT || '3000';
let child = null;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: root,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || '1',
      },
      stdio: 'inherit',
    });

    proc.on('error', reject);
    proc.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${path.basename(command)} ${args.join(' ')} failed with code ${code ?? 'none'} signal ${signal ?? 'none'}`));
    });
  });
}

function assertPortAvailable() {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();
    tester.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Stop the old localhost server first, then run npm run dev again.`));
        return;
      }
      reject(error);
    });
    tester.once('listening', () => {
      tester.close(resolve);
    });
    tester.listen(Number(port), '0.0.0.0');
  });
}

async function main() {
  fs.rmSync(devDir, { force: true, recursive: true });
  await assertPortAvailable();
  console.log('[local] Building production-like localhost server...');
  await run(prismaBin, ['generate']);
  await run(nextBin, ['build', '--webpack']);

  console.log(`[local] Starting stable localhost server on http://localhost:${port}`);
  child = spawn(nextBin, ['start', '-p', port], {
    cwd: root,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || '1',
    },
    stdio: 'inherit',
  });

  child.on('error', (error) => {
    console.error(`[local] Could not start Next: ${error.message}`);
    process.exit(1);
  });
  child.on('exit', (code, signal) => {
    process.exit(code ?? (signal ? 130 : 0));
  });
}

function stop() {
  if (!child) process.exit(0);
  child.kill('SIGINT');
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
main().catch((error) => {
  console.error(`[local] ${error.message}`);
  process.exit(1);
});
