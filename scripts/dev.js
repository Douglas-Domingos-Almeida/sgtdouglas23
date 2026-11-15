import { fork, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const backendRoot = path.join(root, 'BackEnd');
const environment = {
  ...process.env,
  APP_ORIGIN: process.env.APP_ORIGIN || 'http://127.0.0.1:5173',
  AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE || 'false',
  PORT: '3000'
};
let frontend;
let stopping = false;

const backend = fork(path.join(backendRoot, 'server.js'), [], {
  cwd: backendRoot,
  env: environment,
  stdio: ['inherit', 'inherit', 'inherit', 'ipc']
});

function stop(code) {
  if (stopping) return;
  stopping = true;
  clearTimeout(startupTimeout);
  frontend?.kill();
  backend.kill();
  process.exitCode = code;
}

function reportFailure(service, error) {
  console.error(`Falha ao iniciar ${service}:`, error.message);
  stop(1);
}

const startupTimeout = setTimeout(() => {
  reportFailure('o backend', new Error('O servico nao respondeu em 10 segundos.'));
}, 10_000);

backend.once('error', (error) => reportFailure('o backend', error));
backend.once('exit', (code) => {
  if (!stopping) {
    console.error('O backend foi encerrado. O site sera parado para evitar cadastros sem persistencia.');
    stop(code || 1);
  }
});
backend.once('message', (message) => {
  if (message !== 'ready' || stopping) return;
  clearTimeout(startupTimeout);
  const frontendArguments = process.argv.slice(2);
  if (!frontendArguments.some((argument) => argument === '--host' || argument.startsWith('--host='))) {
    frontendArguments.unshift('--host', '127.0.0.1');
  }
  if (!frontendArguments.some((argument) => argument === '--strictPort' || argument.startsWith('--strictPort='))) {
    frontendArguments.push('--strictPort');
  }
  frontend = spawn(process.execPath, [
    path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
    ...frontendArguments
  ], { cwd: root, stdio: 'inherit' });
  frontend.once('error', (error) => reportFailure('o site', error));
  frontend.once('exit', (code) => stop(code ?? 1));
});

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
