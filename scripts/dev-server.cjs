#!/usr/bin/env node

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const devDir = path.join(root, '.next', 'dev');
const lockFile = path.join(devDir, 'lock');
const nextBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'next.cmd' : 'next');
const nextArgs = ['dev', '--webpack', ...process.argv.slice(2)];
let child = null;
let restartCount = 0;
let stopping = false;

function pidIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLock() {
  try {
    return JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  } catch {
    return null;
  }
}

function cleanStaleDevState() {
  const lock = readLock();
  if (!lock) return;
  const pid = Number(lock.pid);
  if (pidIsAlive(pid)) {
    console.error(`[dev] Next already has a live dev server at ${lock.appUrl || `http://localhost:${lock.port || 3000}`} (PID ${pid}).`);
    console.error('[dev] Stop that terminal with Ctrl+C before starting another one.');
    process.exit(1);
  }

  console.log(`[dev] Removing stale Next dev lock from dead PID ${pid || 'unknown'}...`);
  fs.rmSync(devDir, { force: true, recursive: true });
}

function startNext() {
  cleanStaleDevState();
  console.log(`[dev] Starting: next ${nextArgs.join(' ')}`);
  child = spawn(nextBin, nextArgs, {
    cwd: root,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || '1',
    },
    stdio: 'inherit',
  });

  const startedAt = Date.now();
  child.on('exit', (code, signal) => {
    child = null;
    if (stopping) process.exit(code ?? (signal ? 130 : 0));

    const ranForMs = Date.now() - startedAt;
    const lock = readLock();
    if (lock?.pid && pidIsAlive(Number(lock.pid))) {
      console.error(`[dev] Next exited because another dev server is active at ${lock.appUrl || `http://localhost:${lock.port || 3000}`} (PID ${lock.pid}).`);
      process.exit(code ?? 1);
    }

    restartCount += 1;
    console.error(`[dev] Next dev exited unexpectedly after ${Math.round(ranForMs / 1000)}s (code ${code ?? 'none'}, signal ${signal ?? 'none'}).`);
    if (restartCount >= 3) {
      console.error('[dev] Next dev is exiting repeatedly. Use npm run dev for stable localhost testing, or fix the Next dev runtime before using npm run dev:hot.');
      process.exit(code ?? 1);
    }
    console.error(`[dev] Restarting automatically (${restartCount})...`);
    fs.rmSync(devDir, { force: true, recursive: true });
    setTimeout(startNext, 800);
  });

  child.on('error', (error) => {
    console.error(`[dev] Could not start Next: ${error.message}`);
    process.exit(1);
  });
}

function stop() {
  stopping = true;
  if (!child) process.exit(0);
  child.kill('SIGINT');
  setTimeout(() => {
    if (child) child.kill('SIGTERM');
  }, 5_000).unref();
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
startNext();
