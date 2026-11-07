const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { after, before, test } = require('node:test');

const serverPath = path.join(__dirname, '..', 'server.js');
const appOrigin = 'http://127.0.0.1:5173';
const adminUsername = `uca-test-${crypto.randomBytes(6).toString('hex')}`;
const adminPassword = crypto.randomBytes(32).toString('base64url');
const adminSalt = crypto.randomBytes(16);
const adminHash = crypto.scryptSync(adminPassword, adminSalt, 64, {
  N: 32768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024
});
const passwordHash = `scrypt$${adminSalt.toString('hex')}$${adminHash.toString('hex')}`;
const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jpXQAAAAASUVORK5CYII=';
let temporaryDirectory;
let databasePath;
let authDatabasePath;
let baseUrl;
let backend;
let sessionCookie = '';
let csrfToken = '';

async function findAvailablePort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (backend.exitCode !== null) throw new Error('A API encerrou antes de iniciar.');
    try {
      const response = await fetch(`${baseUrl}/auth/session`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('Tempo esgotado aguardando a API de teste.');
}

async function api(pathname, options = {}) {
  const { admin, auth, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers || {});
  headers.set('Origin', appOrigin);
  const cookie = auth?.cookie || sessionCookie;
  if (cookie) headers.set('Cookie', cookie);
  const requestCsrfToken = admin ? csrfToken : auth?.csrfToken;
  if (requestCsrfToken) headers.set('X-CSRF-Token', requestCsrfToken);
  return fetch(`${baseUrl}${pathname}`, { ...requestOptions, headers });
}

async function login(username, password) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { Origin: appOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const body = await response.json();
  return {
    response,
    body,
    auth: {
      cookie: response.headers.get('set-cookie')?.split(';', 1)[0] || '',
      csrfToken: body.csrfToken || ''
    }
  };
}

before(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'uca-auth-test-'));
  databasePath = path.join(temporaryDirectory, 'db.json');
  authDatabasePath = path.join(temporaryDirectory, 'users.sqlite');
  await fs.writeFile(databasePath, JSON.stringify({
    depoimentos: [],
    noticias: [{
      id: 'public-test-article',
      slug: 'public-test-article',
      title: 'Notícia publicada de teste',
      content: 'Conteúdo público de teste.',
      category: 'Competições',
      publishedAt: '2026-10-20',
      status: 'published'
    }, {
      id: 'private-test-draft',
      slug: 'private-test-draft',
      title: 'Rascunho privado',
      content: 'Conteúdo não publicado.',
      category: 'Competições',
      publishedAt: '2026-10-20',
      status: 'draft',
      internalMarker: 'não deve ser exposto'
    }],
    competicoes: []
  }));
  const port = await findAvailablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  backend = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      ADMIN_USERNAME: adminUsername,
      ADMIN_PASSWORD_HASH: passwordHash,
      APP_ORIGIN: appOrigin,
      AUTH_COOKIE_SECURE: 'false',
      DB_PATH: databasePath,
      UCA_AUTH_DB_PATH: authDatabasePath,
      NODE_ENV: 'test',
      PORT: String(port)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  backend.stdout.on('data', (chunk) => { output += chunk.toString(); });
  backend.stderr.on('data', (chunk) => { output += chunk.toString(); });
  try {
    await waitForServer();
  } catch (error) {
    backend.kill();
    throw new Error(`${error.message}\n${output}`);
  }
});

after(async () => {
  if (backend && backend.exitCode === null) {
    backend.kill();
    await once(backend, 'exit');
  }
  if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

test('anônimos não consultam a base completa nem alteram recursos da API', async () => {
  const rootResponse = await api('/');
  assert.equal(rootResponse.status, 404);
  assert.equal((await api('/auth/users')).status, 401);

  const requests = [
    ['POST', '/competicoes', { body: '{}' }],
    ['PUT', '/competicoes/1', { body: '{}' }],
    ['PATCH', '/depoimentos/1', { body: '{}' }],
    ['DELETE', '/depoimentos/1', {}],
    ['POST', '/noticias', { body: '{}' }],
    ['POST', '/depoimentos', { body: '{}' }]
  ];
  for (const [method, pathname, options] of requests) {
    const response = await api(pathname, {
      method,
      headers: options.body ? { 'Content-Type': 'application/json' } : {},
      body: options.body
    });
    assert.equal(response.status, 401, `${method} ${pathname} deve exigir autenticação`);
  }
});

test('login rejeita credenciais inválidas e não retorna dados sensíveis', async () => {
  const response = await api('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: adminUsername, password: crypto.randomBytes(16).toString('hex') })
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: 'Usuário ou senha incorretos.' });
  assert.equal(response.headers.get('set-cookie'), null);
});

test('login administrativo emite cookie protegido e CSRF sem expor credenciais', async () => {
  const { response, body } = await login(adminUsername, adminPassword);
  assert.equal(response.status, 200);
  assert.equal(body.authenticated, true);
  assert.equal(body.role, 'admin');
  assert.equal(body.username, adminUsername);
  assert.equal(typeof body.csrfToken, 'string');
  assert.equal(body.csrfToken.length, 64);
  assert.equal(JSON.stringify(body).includes(adminPassword), false);
  assert.equal(JSON.stringify(body).includes(adminHash.toString('hex')), false);

  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  sessionCookie = setCookie.split(';', 1)[0];
  csrfToken = body.csrfToken;

  const session = await api('/auth/session');
  assert.deepEqual(await session.json(), {
    authenticated: true,
    username: adminUsername,
    role: 'admin',
    csrfToken
  });
});

test('administrador cria membros, que podem usar o cadastro mas não gerenciar usuários', async () => {
  const memberUsername = `uca-member-${crypto.randomBytes(6).toString('hex')}`;
  const memberPassword = crypto.randomBytes(32).toString('base64url');
  const created = await api('/auth/users', {
    method: 'POST',
    admin: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: memberUsername, password: memberPassword, role: 'member' })
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.deepEqual(Object.keys(createdBody).sort(), ['createdAt', 'role', 'username']);
  assert.equal(createdBody.role, 'member');
  assert.equal(JSON.stringify(createdBody).includes(memberPassword), false);

  const users = await api('/auth/users');
  assert.equal(users.status, 200);
  const usersBody = await users.json();
  assert.equal(usersBody.some((user) => user.username === memberUsername), true);
  assert.equal(JSON.stringify(usersBody).includes('passwordHash'), false);

  const memberLogin = await login(memberUsername, memberPassword);
  assert.equal(memberLogin.response.status, 200);
  assert.equal(memberLogin.body.role, 'member');
  assert.equal(memberLogin.body.username, memberUsername);

  const memberSession = await api('/auth/session', { auth: memberLogin.auth });
  assert.equal((await memberSession.json()).role, 'member');

  const memberCompetition = {
    id: crypto.randomUUID(),
    name: 'Competição criada por membro',
    category: 'Nacional',
    enrollmentStatus: 'open',
    expectedDate: '2026-12-20',
    expectedEndDate: '2026-12-22',
    description: 'Cadastro permitido para Membro UCA.',
    image: validPng
  };
  const memberWrite = await api('/competicoes', {
    auth: memberLogin.auth,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(memberCompetition)
  });
  assert.equal(memberWrite.status, 201, 'membros autenticados podem usar as operações de cadastro');
  const cleanupMemberRecord = await api(`/competicoes/${memberCompetition.id}`, {
    admin: true,
    method: 'DELETE'
  });
  assert.equal(cleanupMemberRecord.status, 200);

  const memberListUsers = await api('/auth/users', { auth: memberLogin.auth });
  assert.equal(memberListUsers.status, 403);
  const memberCreateUser = await api('/auth/users', {
    auth: memberLogin.auth,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `uca-denied-${crypto.randomBytes(4).toString('hex')}`,
      password: crypto.randomBytes(24).toString('base64url'),
      role: 'member'
    })
  });
  assert.equal(memberCreateUser.status, 403);
});

test('usuário pode alterar a senha e a senha anterior deixa de autenticar', async () => {
  const username = `uca-password-${crypto.randomBytes(6).toString('hex')}`;
  const currentPassword = crypto.randomBytes(32).toString('base64url');
  const newPassword = crypto.randomBytes(32).toString('base64url');
  const created = await api('/auth/users', {
    method: 'POST',
    admin: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: currentPassword, role: 'admin' })
  });
  assert.equal(created.status, 201);

  const authenticated = await login(username, currentPassword);
  assert.equal(authenticated.response.status, 200);
  const changed = await api('/auth/password', {
    auth: authenticated.auth,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword })
  });
  assert.equal(changed.status, 204);

  assert.equal((await login(username, currentPassword)).response.status, 401);
  assert.equal((await login(username, newPassword)).response.status, 200);
  assert.deepEqual(await (await api('/auth/session', { auth: authenticated.auth })).json(), {
    authenticated: false
  });
});

test('CSRF e origem são validados antes de qualquer mutação administrativa', async () => {
  const noToken = await fetch(`${baseUrl}/competicoes`, {
    method: 'POST',
    headers: {
      Origin: appOrigin,
      Cookie: sessionCookie,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });
  assert.equal(noToken.status, 403);

  const wrongOrigin = await fetch(`${baseUrl}/competicoes`, {
    method: 'POST',
    headers: {
      Origin: 'http://attacker.invalid',
      Cookie: sessionCookie,
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: '{}'
  });
  assert.equal(wrongOrigin.status, 403);
});

test('CRUD de competição autenticado valida a imagem e persiste somente dados válidos', async () => {
  const competition = {
    id: crypto.randomUUID(),
    name: 'Competição de teste temporária',
    category: 'Nacional',
    enrollmentStatus: 'open',
    expectedDate: '2026-12-20',
    expectedEndDate: '2026-12-22',
    description: 'Registro temporário isolado em banco de teste.',
    image: validPng
  };

  const invalidImage = await api('/competicoes', {
    method: 'POST',
    admin: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...competition, image: 'data:image/png;base64,Zm9v' })
  });
  assert.equal(invalidImage.status, 400);

  const oversizedImage = await api('/competicoes', {
    method: 'POST',
    admin: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...competition,
      image: `data:image/png;base64,${(() => {
        const bytes = Buffer.alloc(2 * 1024 * 1024 + 1);
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
        return bytes.toString('base64');
      })()}`
    })
  });
  assert.equal(oversizedImage.status, 413, await oversizedImage.text());

  const createdResponse = await api('/competicoes', {
    method: 'POST',
    admin: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(competition)
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.id, competition.id);
  assert.equal(created.expectedDate, '2026-12-20');
  assert.equal(created.expectedEndDate, '2026-12-22');

  const list = await api('/competicoes');
  assert.equal(list.status, 200);
  assert.equal((await list.json()).length, 1);

  const persisted = JSON.parse(await fs.readFile(databasePath, 'utf8'));
  assert.equal(persisted.competicoes[0].image, validPng);
  assert.equal(persisted.competicoes[0].expectedDate, competition.expectedDate);
  assert.equal(persisted.competicoes[0].expectedEndDate, competition.expectedEndDate);

  for (const dates of [
    { expectedEndDate: '2026-12-19' },
    { expectedEndDate: '2026-02-30' },
    { expectedEndDate: '22/12/2026' },
    { expectedEndDate: null },
    { expectedEndDate: '' },
    { expectedDate: '' },
    { expectedDate: '2026-02-30' },
    { expectedDate: '2026-12-23' }
  ]) {
    const invalidDates = await api(`/competicoes/${competition.id}`, {
      method: 'PATCH',
      admin: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dates)
    });
    assert.equal(invalidDates.status, 400, JSON.stringify(dates));
  }
  const unchanged = JSON.parse(await fs.readFile(databasePath, 'utf8')).competicoes[0];
  assert.equal(unchanged.expectedDate, competition.expectedDate);
  assert.equal(unchanged.expectedEndDate, competition.expectedEndDate);

  const { expectedEndDate, ...legacyCompetition } = competition;
  for (const dates of [
    { expectedDate: '2026-12-20', expectedEndDate: '2026-12-20' },
    { expectedDate: '', expectedEndDate: '' },
    { expectedDate: '2026-12-20' }
  ]) {
    const replacement = { ...legacyCompetition, ...dates };
    const updatedDates = await api(`/competicoes/${competition.id}`, {
      method: 'PUT',
      admin: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replacement)
    });
    assert.equal(updatedDates.status, 200);
    assert.deepEqual(await updatedDates.json(), replacement);
  }

  const updatedResponse = await api(`/competicoes/${competition.id}`, {
    method: 'PATCH',
    admin: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'Descrição atualizada.', expectedEndDate: '2026-12-23' })
  });
  assert.equal(updatedResponse.status, 200);
  assert.equal((await updatedResponse.json()).expectedEndDate, '2026-12-23');

  const deletedResponse = await api(`/competicoes/${competition.id}`, {
    method: 'DELETE',
    admin: true
  });
  assert.equal(deletedResponse.status, 200);
  assert.deepEqual(await (await api('/competicoes')).json(), []);
});

test('API pública expõe notícias publicadas, nunca rascunhos ou a base bruta', async () => {
  const response = await api('/noticias');
  assert.equal(response.status, 200);
  const articles = await response.json();
  assert.deepEqual(articles.map((article) => article.id), ['public-test-article']);
  assert.equal(JSON.stringify(articles).includes('não deve ser exposto'), false);
  assert.equal((await api('/noticias/private-test-draft')).status, 404);
  assert.equal((await api('/noticias/public-test-article')).status, 200);
});

test('logout invalida a sessão e impede novas alterações', async () => {
  const logout = await api('/auth/logout', { method: 'POST', admin: true });
  assert.equal(logout.status, 204);

  const session = await api('/auth/session');
  assert.deepEqual(await session.json(), { authenticated: false });

  const write = await api('/competicoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(write.status, 401);
});
