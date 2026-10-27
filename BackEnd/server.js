const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const express = require('express');
const jsonServer = require('json-server');

const scrypt = promisify(crypto.scrypt);
const scryptCost = 32768;
const scryptOptions = { N: scryptCost, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const server = jsonServer.create();
const { loadAdminConfig } = require('./admin-config');
const adminConfig = loadAdminConfig();
const databasePath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, 'db.json');
const router = jsonServer.router(databasePath);
const validCategories = new Set([
  'Notícias da UCA Master',
  'Competições',
  'Resultados e conquistas',
  'Histórias de atletas',
  'Eventos e comunicados',
  'Atletismo Master em geral'
]);
const validCompetitionCategories = new Set(['Nacional', 'Internacional']);
const validEnrollmentStatuses = new Set(['open', 'closed']);
const validCompetitionFields = new Set([
  'id', 'name', 'category', 'enrollmentStatus', 'expectedDate', 'expectedEndDate', 'description', 'image'
]);
const maximumImageSize = 2 * 1024 * 1024;
const sessionDurationMs = 8 * 60 * 60 * 1000;
const loginWindowMs = 15 * 60 * 1000;
const maximumLoginAttempts = 5;
const sessions = new Map();
const loginAttempts = new Map();
const validAdminHash = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/;

function requiredOrigin(value, variableName) {
  if (!value) throw new Error(`${variableName} deve ser configurada.`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${variableName} deve ser uma URL de origem válida.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== value) {
    throw new Error(`${variableName} deve conter apenas a origem (protocolo e domínio), sem caminho.`);
  }
  return parsed.origin;
}

const adminUsername = adminConfig.username;
const adminHash = adminConfig.passwordHash;
const appOrigin = requiredOrigin(process.env.APP_ORIGIN || 'http://127.0.0.1:5173', 'APP_ORIGIN');
const cookieSecure = process.env.AUTH_COOKIE_SECURE === 'true';

if (process.env.NODE_ENV === 'production' && !cookieSecure) {
  throw new Error('AUTH_COOKIE_SECURE=true é obrigatório em produção, com HTTPS configurado.');
}
if (!fs.existsSync(databasePath)) {
  throw new Error(`O arquivo de persistência não existe: ${databasePath}`);
}

function normalizeTitle(title) {
  return title.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function isValidIsoDate(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
}

function getCompetitionValidationError(competition) {
  if (!competition || typeof competition !== 'object' || Array.isArray(competition)) {
    return 'Os dados da competição são inválidos.';
  }
  if (Object.keys(competition).some((field) => !validCompetitionFields.has(field))) {
    return 'Os dados da competição contêm campos não permitidos.';
  }
  if (typeof competition.id !== 'string' || !competition.id.trim()) {
    return 'O identificador da competição é obrigatório.';
  }
  if (typeof competition.name !== 'string' || !competition.name.trim() || competition.name.length > 100) {
    return 'Informe um nome de competição com até 100 caracteres.';
  }
  if (!validCompetitionCategories.has(competition.category)) {
    return 'A categoria da competição deve ser Nacional ou Internacional.';
  }
  if (!validEnrollmentStatuses.has(competition.enrollmentStatus)) {
    return 'O status das inscrições não é válido.';
  }
  if (typeof competition.description !== 'string' || competition.description.length > 500) {
    return 'A descrição deve ter no máximo 500 caracteres.';
  }
  if (!isValidIsoDate(competition.expectedDate)) {
    return 'Informe uma data prevista válida.';
  }
  if (Object.hasOwn(competition, 'expectedEndDate')) {
    if (!isValidIsoDate(competition.expectedEndDate)) {
      return 'Informe uma data final prevista válida.';
    }
    if (Boolean(competition.expectedDate) !== Boolean(competition.expectedEndDate)) {
      return 'Informe as datas inicial e final previstas da competição.';
    }
    if (competition.expectedDate && competition.expectedEndDate < competition.expectedDate) {
      return 'A data final não pode ser anterior à data inicial.';
    }
  }
  const imageMatch = typeof competition.image === 'string'
    ? competition.image.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]*={0,2})$/)
    : null;
  if (!imageMatch) return 'A imagem deve ser JPG ou PNG válida.';
  const imageBytes = Buffer.from(imageMatch[2], 'base64');
  if (imageBytes.length > maximumImageSize) {
    return 'A imagem deve ter no máximo 2 MB.';
  }
  const isPng = imageMatch[1] === 'png'
    && imageBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = imageMatch[1] === 'jpeg'
    && imageBytes[0] === 255 && imageBytes[1] === 216 && imageBytes[2] === 255;
  if (!isPng && !isJpeg) return 'O conteúdo do arquivo não corresponde a uma imagem JPG ou PNG válida.';
  return '';
}

function getSessionToken(request) {
  const cookie = request.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)uca_admin_session=([a-f0-9]{64})(?:;|$)/);
  return match?.[1] || '';
}

function getSession(request) {
  const token = getSessionToken(request);
  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = sessions.get(tokenHash);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(tokenHash);
    return null;
  }
  return { ...session, tokenHash };
}

function setSessionCookie(response, token, maxAgeSeconds) {
  const attributes = [
    `uca_admin_session=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`
  ];
  if (cookieSecure) attributes.push('Secure');
  response.setHeader('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(response) {
  setSessionCookie(response, '', 0);
}

function safeEqual(left, right) {
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isAdminOrigin(request) {
  return request.headers.origin === appOrigin;
}

function setCorsHeaders(request, response) {
  response.setHeader('Vary', 'Origin');
  if (request.headers.origin === appOrigin) {
    response.setHeader('Access-Control-Allow-Origin', appOrigin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-CSRF-Token');
  }
}

function isVisibleNews(item) {
  if (item.status === 'published') return true;
  if (item.status !== 'scheduled' || !isValidIsoDate(item.publishedAt)) return false;
  return item.publishedAt <= new Date().toISOString().slice(0, 10);
}

function publicNews(item) {
  const publicFields = [
    'id', 'slug', 'title', 'content', 'category', 'publishedAt', 'status',
    'excerpt', 'author', 'coverImage', 'imageAlt', 'imageCaption', 'imageCredit'
  ];
  return Object.fromEntries(publicFields
    .filter((field) => Object.hasOwn(item, field))
    .map((field) => [field, item[field]]));
}

function getLoginThrottle(request) {
  const now = Date.now();
  for (const [address, limit] of loginAttempts) {
    if (limit.resetAt <= now) loginAttempts.delete(address);
  }
  const address = request.socket.remoteAddress || 'unknown';
  let limit = loginAttempts.get(address);
  if (!limit || limit.resetAt <= now) {
    limit = { count: 0, resetAt: now + loginWindowMs };
    loginAttempts.set(address, limit);
  }
  if (loginAttempts.size > 10000) {
    const oldestAddress = loginAttempts.keys().next().value;
    if (oldestAddress !== undefined) loginAttempts.delete(oldestAddress);
  }
  return limit;
}

server.use((request, response, next) => {
  setCorsHeaders(request, response);
  if (request.method === 'OPTIONS') {
    if (request.headers.origin && !isAdminOrigin(request)) {
      response.status(403).json({ message: 'Origem não autorizada.' });
      return;
    }
    response.status(204).end();
    return;
  }
  next();
});
server.use((request, response, next) => {
  if (request.method === 'GET' && request.path === '/') {
    response.status(404).json({ message: 'Recurso não encontrado.' });
    return;
  }
  next();
});
server.use(jsonServer.defaults({ noCors: true, bodyParser: false }));
server.use(express.json({ limit: '3mb', strict: true }));

server.use(async (request, response, next) => {
  if (request.path === '/auth/session' && request.method === 'GET') {
    const session = getSession(request);
    response.setHeader('Cache-Control', 'no-store');
    response.json(session
      ? { authenticated: true, role: session.role, csrfToken: session.csrfToken }
      : { authenticated: false });
    return;
  }
  if (request.path === '/auth/login' && request.method === 'POST') {
    if (!isAdminOrigin(request)) {
      response.status(403).json({ message: 'Origem não autorizada.' });
      return;
    }
    const throttle = getLoginThrottle(request);
    if (throttle.count >= maximumLoginAttempts) {
      response.setHeader('Retry-After', String(Math.ceil((throttle.resetAt - Date.now()) / 1000)));
      response.status(429).json({ message: 'Muitas tentativas de acesso. Aguarde antes de tentar novamente.' });
      return;
    }
    const username = typeof request.body?.username === 'string' ? request.body.username : '';
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    if (username.length > 100 || password.length > 1024) {
      throttle.count += 1;
      response.status(401).json({ message: 'Usuário ou senha inválidos.' });
      return;
    }

    const [, saltHex, hashHex] = adminHash.match(validAdminHash);
    let candidate;
    try {
      candidate = Buffer.from(await scrypt(password, Buffer.from(saltHex, 'hex'), 64, scryptOptions));
    } catch (error) {
      next(error);
      return;
    }
    const configuredHash = Buffer.from(hashHex, 'hex');
    const usernameMatches = safeEqual(Buffer.from(username), Buffer.from(adminUsername));
    const passwordMatches = safeEqual(candidate, configuredHash);
    if (!usernameMatches || !passwordMatches) {
      throttle.count += 1;
      response.status(401).json({ message: 'Usuário ou senha inválidos.' });
      return;
    }

    loginAttempts.delete(request.socket.remoteAddress || 'unknown');
    for (const [tokenHash, activeSession] of sessions) {
      if (activeSession.expiresAt <= Date.now()) sessions.delete(tokenHash);
    }
    if (sessions.size >= 10000) {
      response.status(503).json({ message: 'O serviço administrativo atingiu o limite de sessões. Tente novamente mais tarde.' });
      return;
    }
    const token = crypto.randomBytes(32).toString('hex');
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + sessionDurationMs;
    sessions.set(crypto.createHash('sha256').update(token).digest('hex'), {
      role: 'admin',
      csrfToken,
      expiresAt
    });
    setSessionCookie(response, token, Math.floor(sessionDurationMs / 1000));
    response.setHeader('Cache-Control', 'no-store');
    response.json({ authenticated: true, role: 'admin', csrfToken });
    return;
  }
  if (request.path === '/auth/logout' && request.method === 'POST') {
    const session = getSession(request);
    if (!session || !isAdminOrigin(request)
      || !safeEqual(Buffer.from(request.headers['x-csrf-token'] || ''), Buffer.from(session.csrfToken))) {
      response.status(403).json({ message: 'Sessão inválida ou solicitação não autorizada.' });
      return;
    }
    sessions.delete(session.tokenHash);
    clearSessionCookie(response);
    response.setHeader('Cache-Control', 'no-store');
    response.status(204).end();
    return;
  }
  next();
});

server.use((request, response, next) => {
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  if (!isMutation || ['/auth/login', '/auth/logout'].includes(request.path)) {
    next();
    return;
  }
  const session = getSession(request);
  if (!session || session.role !== 'admin') {
    response.status(401).json({ message: 'Autenticação administrativa necessária.' });
    return;
  }
  if (!isAdminOrigin(request)
    || !safeEqual(Buffer.from(request.headers['x-csrf-token'] || ''), Buffer.from(session.csrfToken))) {
    response.status(403).json({ message: 'Solicitação administrativa não autorizada.' });
    return;
  }
  next();
});

server.use((request, response, next) => {
  if (request.method === 'GET' && /^\/noticias\/?$/.test(request.path)) {
    const items = router.db.get('noticias').value() || [];
    response.setHeader('Cache-Control', 'no-store');
    response.json(items.filter(isVisibleNews).map(publicNews));
    return;
  }
  const newsId = request.method === 'GET' ? request.path.match(/^\/noticias\/([^/]+)$/) : null;
  if (newsId) {
    const item = (router.db.get('noticias').value() || [])
      .find((article) => String(article.id) === decodeURIComponent(newsId[1]));
    if (!item || !isVisibleNews(item)) {
      response.status(404).json({ message: 'Notícia não encontrada.' });
      return;
    }
    response.setHeader('Cache-Control', 'no-store');
    response.json(publicNews(item));
    return;
  }
  next();
});

server.use((request, response, next) => {
  if (request.method !== 'POST' || request.path !== '/noticias') {
    next();
    return;
  }

  const article = request.body;
  const requiredFields = ['id', 'slug', 'title', 'content', 'category', 'publishedAt', 'status'];
  if (!article || requiredFields.some((field) => typeof article[field] !== 'string' || !article[field].trim())) {
    response.status(400).json({ message: 'Preencha o título, o conteúdo, a categoria e a data da notícia.' });
    return;
  }
  if (!validCategories.has(article.category)) {
    response.status(400).json({ message: 'A categoria informada não é válida.' });
    return;
  }
  if (!['published', 'scheduled'].includes(article.status)) {
    response.status(400).json({ message: 'O status da notícia não é válido.' });
    return;
  }

  const parsedDate = new Date(`${article.publishedAt}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(article.publishedAt) || Number.isNaN(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== article.publishedAt) {
    response.status(400).json({ message: 'Informe uma data de publicação válida.' });
    return;
  }

  const existingArticles = router.db.get('noticias').value() || [];
  if (existingArticles.some((existing) => existing.id === article.id)) {
    response.status(409).json({ message: 'Esta notícia já foi cadastrada.' });
    return;
  }
  if (existingArticles.some((existing) => (
    normalizeTitle(existing.title) === normalizeTitle(article.title)
    && existing.publishedAt === article.publishedAt
  ))) {
    response.status(409).json({ message: 'Já existe uma notícia com este título e data de publicação.' });
    return;
  }

  if (article.coverImage) {
    const imageMatch = typeof article.coverImage === 'string'
      ? article.coverImage.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]*={0,2})$/)
      : null;
    if (!imageMatch) {
      response.status(400).json({ message: 'A imagem deve ser JPG, PNG ou WEBP válida.' });
      return;
    }
    if (Buffer.from(imageMatch[2], 'base64').length > maximumImageSize) {
      response.status(413).json({ message: 'A imagem deve ter no máximo 2 MB.' });
      return;
    }
  }

  next();
});
server.use((request, response, next) => {
  const competitionRequest = request.method === 'POST' && request.path === '/competicoes'
    || ['PUT', 'PATCH'].includes(request.method) && /^\/competicoes\/[^/]+$/.test(request.path);
  if (!competitionRequest) {
    next();
    return;
  }

  const competitions = router.db.get('competicoes').value() || [];
  const isCreate = request.method === 'POST';
  const existingId = isCreate ? null : decodeURIComponent(request.path.split('/').pop());
  let competition = request.body;
  if (isCreate && competitions.some((item) => item.id === request.body?.id)) {
    response.status(409).json({ message: 'Esta competição já foi cadastrada.' });
    return;
  }
  if (!isCreate) {
    const existing = competitions.find((item) => String(item.id) === existingId);
    if (!existing) {
      response.status(404).json({ message: 'A competição não foi encontrada.' });
      return;
    }
    if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
      response.status(400).json({ message: 'Os dados da competição são inválidos.' });
      return;
    }
    if (Object.hasOwn(request.body, 'id') && String(request.body.id) !== String(existing.id)) {
      response.status(400).json({ message: 'O identificador da competição não pode ser alterado.' });
      return;
    }
    competition = request.method === 'PATCH'
      ? { ...existing, ...request.body, id: existing.id }
      : request.body;
  }
  const error = getCompetitionValidationError(competition);
  if (error) {
    response.status(error === 'A imagem deve ter no máximo 2 MB.' ? 413 : 400).json({ message: error });
    return;
  }
  const duplicate = competitions.some((item) => (
    String(item.id) !== String(existingId || '')
    && normalizeTitle(item.name) === normalizeTitle(competition.name)
    && item.category === competition.category
  ));
  if (duplicate) {
    response.status(409).json({ message: 'Já existe uma competição com esse nome nesta categoria.' });
    return;
  }

  next();
});

server.use(router);
server.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 500;
  if (status === 500) console.error('Falha ao processar uma solicitação da API.', error);
  response.status(status).json({
    message: status === 413
      ? 'O corpo da solicitação excede o limite permitido.'
      : status === 400
        ? 'O corpo JSON da solicitação é inválido.'
        : 'Não foi possível processar a solicitação.'
  });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '127.0.0.1', () => {
  console.log(`API de cadastro UCA disponível em http://127.0.0.1:${port}`);
  if (process.send) process.send('ready');
});
