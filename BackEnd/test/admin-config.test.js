const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { after, before, test } = require('node:test');
const { once } = require('node:events');
const {
  getAdminConfigPath,
  loadAdminConfig,
  readAdminConfig,
  validateAdminConfig,
  writeAdminConfig
} = require('../admin-config');

const validConfig = {
  username: 'uca-test-admin',
  passwordHash: `scrypt$${crypto.randomBytes(16).toString('hex')}$${crypto.randomBytes(64).toString('hex')}`
};
let temporaryDirectory;
let configPath;

async function findAvailablePort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForApi(child, url) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('A API encerrou antes de iniciar.');
    try {
      const response = await fetch(`${url}/auth/session`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('Tempo esgotado aguardando a API com configuração local.');
}

before(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'uca-admin-config-test-'));
  configPath = path.join(temporaryDirectory, 'admin-auth.json');
});

after(() => {
  if (temporaryDirectory) fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('admin config accepts only a username and a structurally valid scrypt hash', () => {
  assert.equal(validateAdminConfig(validConfig), true);
  assert.equal(validateAdminConfig({ username: '', passwordHash: validConfig.passwordHash }), false);
  assert.equal(validateAdminConfig({ username: 'admin', passwordHash: 'password' }), false);
  assert.equal(validateAdminConfig({ username: 'a'.repeat(101), passwordHash: validConfig.passwordHash }), false);
});

test('admin config is persisted and loaded from the configured file outside the repository', () => {
  assert.equal(readAdminConfig(configPath), null);
  writeAdminConfig(validConfig, configPath);
  assert.deepEqual(readAdminConfig(configPath), validConfig);
  assert.deepEqual(loadAdminConfig({
    UCA_ADMIN_CONFIG_FILE: configPath,
    LOCALAPPDATA: temporaryDirectory
  }), validConfig);
});

test('admin config rejects malformed files and incomplete environment credentials', () => {
  const malformedPath = path.join(temporaryDirectory, 'malformed.json');
  fs.writeFileSync(malformedPath, '{');
  assert.throws(() => readAdminConfig(malformedPath), /JSON inválido/);
  assert.throws(() => loadAdminConfig({
    ADMIN_USERNAME: validConfig.username,
    UCA_ADMIN_CONFIG_FILE: configPath
  }), /devem ser configuradas em conjunto/);
});

test('environment credentials can override local configuration when both are valid', () => {
  const environmentConfig = {
    ADMIN_USERNAME: validConfig.username,
    ADMIN_PASSWORD_HASH: validConfig.passwordHash
  };
  assert.deepEqual(loadAdminConfig(environmentConfig), validConfig);
});

test('platform config paths stay outside the project when the user config root is set', () => {
  const configuredPath = getAdminConfigPath({ LOCALAPPDATA: temporaryDirectory });
  assert.equal(configuredPath, path.join(temporaryDirectory, 'Projeto UCA', 'admin-auth.json'));
});

test('API inicializa e autentica usando a configuração administrativa local sem variáveis de senha', async () => {
  const username = `uca-file-${crypto.randomBytes(6).toString('hex')}`;
  const password = crypto.randomBytes(32).toString('hex');
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
  const localConfigPath = path.join(temporaryDirectory, 'local-admin-auth.json');
  const localDatabasePath = path.join(temporaryDirectory, 'local-db.json');
  const port = await findAvailablePort();
  fs.writeFileSync(localConfigPath, JSON.stringify({
    username,
    passwordHash: `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
  }));
  fs.writeFileSync(localDatabasePath, JSON.stringify({
    depoimentos: [],
    noticias: [],
    competicoes: []
  }));
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      ADMIN_USERNAME: '',
      ADMIN_PASSWORD_HASH: '',
      APP_ORIGIN: 'http://127.0.0.1:5173',
      AUTH_COOKIE_SECURE: 'false',
      DB_PATH: localDatabasePath,
      UCA_ADMIN_CONFIG_FILE: localConfigPath,
      NODE_ENV: 'test',
      PORT: String(port)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForApi(child, baseUrl);
    let response;
    try {
      response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
    } catch (error) {
      throw new Error(`Não foi possível autenticar com a configuração local: ${error.message}\n${output}`);
    }
    assert.equal(response.status, 200, output);
    assert.equal((await response.json()).role, 'admin');
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await once(child, 'exit');
    }
  }
});
