const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const hashPattern = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/;

function getAdminConfigPath(environment = process.env) {
  if (environment.UCA_ADMIN_CONFIG_FILE) {
    return path.resolve(environment.UCA_ADMIN_CONFIG_FILE);
  }
  const configRoot = environment.LOCALAPPDATA
    || environment.XDG_CONFIG_HOME
    || path.join(os.homedir(), '.config');
  return path.join(configRoot, 'Projeto UCA', 'admin-auth.json');
}

function validateAdminConfig(config) {
  return Boolean(
    config
    && typeof config.username === 'string'
    && config.username.trim()
    && config.username.length <= 100
    && typeof config.passwordHash === 'string'
    && hashPattern.test(config.passwordHash)
  );
}

function readAdminConfig(configPath = getAdminConfigPath()) {
  let content;
  try {
    content = fs.readFileSync(configPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`Não foi possível ler a configuração administrativa em ${configPath}: ${error.message}`);
  }
  let config;
  try {
    config = JSON.parse(content);
  } catch (error) {
    throw new Error(`A configuração administrativa em ${configPath} contém JSON inválido: ${error.message}`);
  }
  if (!validateAdminConfig(config)) {
    throw new Error(`A configuração administrativa em ${configPath} não possui usuário e hash scrypt válidos.`);
  }
  return config;
}

function loadAdminConfig(environment = process.env) {
  const hasUsername = Boolean(environment.ADMIN_USERNAME);
  const hasPasswordHash = Boolean(environment.ADMIN_PASSWORD_HASH);
  if (hasUsername !== hasPasswordHash) {
    throw new Error('ADMIN_USERNAME e ADMIN_PASSWORD_HASH devem ser configuradas em conjunto.');
  }
  if (hasUsername) {
    const config = {
      username: environment.ADMIN_USERNAME,
      passwordHash: environment.ADMIN_PASSWORD_HASH
    };
    if (!validateAdminConfig(config)) {
      throw new Error('ADMIN_USERNAME e ADMIN_PASSWORD_HASH não formam uma configuração administrativa válida.');
    }
    return config;
  }
  const config = readAdminConfig(getAdminConfigPath(environment));
  if (!config) {
    throw new Error(
      'Não há configuração administrativa. Execute "npm run admin:setup" em um terminal interativo para criar uma conta.'
    );
  }
  return config;
}

function writeAdminConfig(config, configPath = getAdminConfigPath()) {
  if (!validateAdminConfig(config)) {
    throw new Error('A configuração administrativa informada não é válida.');
  }
  const directory = path.dirname(configPath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = `${configPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx'
    });
    fs.renameSync(temporaryPath, configPath);
  } catch (error) {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch (cleanupError) {
      console.error('Não foi possível remover o arquivo temporário da configuração administrativa.', cleanupError);
    }
    throw new Error(`Não foi possível salvar a configuração administrativa em ${configPath}: ${error.message}`);
  }
}

module.exports = {
  getAdminConfigPath,
  loadAdminConfig,
  readAdminConfig,
  validateAdminConfig,
  writeAdminConfig
};
