import { spawn, spawnSync } from 'node:child_process';
const initial = spawnSync('tsc', ['-p', 'tsconfig.json'], { stdio: 'inherit' });
if (initial.status !== 0) process.exit(initial.status ?? 1);
const children = [spawn('tsc', ['--watch', '-p', 'tsconfig.json'], { stdio: 'inherit' }), spawn(process.execPath, ['--watch', '--env-file-if-exists=../../.env', 'dist/main.js'], { stdio: 'inherit' })];
let stopping = false;
function stop(code) { if (stopping) return; stopping = true; for (const child of children) child.kill('SIGTERM'); process.exitCode = code; }
for (const child of children) child.on('exit', (code) => stop(code ?? 1));
process.on('SIGINT', () => stop(0)); process.on('SIGTERM', () => stop(0));
