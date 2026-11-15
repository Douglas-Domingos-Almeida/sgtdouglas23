const fs = require('node:fs');
const path = require('node:path');
const { getAdminConfigPath } = require('./admin-config');

const identifierPattern = /^[A-Za-z0-9_]+$/;
const tablePrefixPattern = /^[A-Za-z0-9_]{0,32}$/;

function getMysqlConfigPath(environment = process.env) {
  if (environment.UCA_MYSQL_CONFIG_FILE) {
    return path.resolve(environment.UCA_MYSQL_CONFIG_FILE);
  }
  return path.join(path.dirname(getAdminConfigPath(environment)), 'mysql.json');
}

function readMysqlConfigFile(configPath) {
  let content;
  try {
    content = fs.readFileSync(configPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`Não foi possível ler a configuração do MySQL em ${configPath}: ${error.message}`);
  }
  try {
    // Remove o BOM que o PowerShell do Windows adiciona ao salvar UTF-8.
    return JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`A configuração do MySQL em ${configPath} contém JSON inválido: ${error.message}`);
  }
}

function loadMysqlConfig(environment = process.env) {
  const configPath = getMysqlConfigPath(environment);
  const fileConfig = readMysqlConfigFile(configPath) || {};
  const config = {
    host: environment.MYSQL_HOST || fileConfig.host || '127.0.0.1',
    port: Number(environment.MYSQL_PORT || fileConfig.port || 3306),
    database: environment.MYSQL_DATABASE || fileConfig.database || 'uca',
    user: environment.MYSQL_USER || fileConfig.user || 'uca_app',
    password: environment.MYSQL_PASSWORD !== undefined
      ? environment.MYSQL_PASSWORD
      : fileConfig.password,
    tablePrefix: environment.MYSQL_TABLE_PREFIX || fileConfig.tablePrefix || ''
  };
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('A porta do MySQL deve ser um número entre 1 e 65535.');
  }
  if (!identifierPattern.test(config.database)) {
    throw new Error('O nome do banco MySQL deve conter apenas letras, números e sublinhado.');
  }
  if (typeof config.user !== 'string' || !config.user.trim()) {
    throw new Error('O usuário do MySQL deve ser informado.');
  }
  if (typeof config.password !== 'string' || !config.password) {
    throw new Error(
      `A senha do MySQL não está configurada. Defina MYSQL_PASSWORD no ambiente ou crie ${configPath} `
      + 'com {"password": "..."} (fora do repositório; não versione esse arquivo).'
    );
  }
  if (!tablePrefixPattern.test(config.tablePrefix)) {
    throw new Error('O prefixo de tabelas do MySQL deve conter apenas letras, números e sublinhado (até 32 caracteres).');
  }
  return config;
}

module.exports = { getMysqlConfigPath, loadMysqlConfig };
