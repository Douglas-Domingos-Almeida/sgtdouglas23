const crypto = require('node:crypto');
const readline = require('node:readline');
const { promisify } = require('node:util');
const path = require('node:path');
const { AuthStore } = require('../auth-store');
const { getAdminConfigPath, loadAdminConfig } = require('../admin-config');

const scrypt = promisify(crypto.scrypt);
const scryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const username = 'BRA0460';

function askHiddenPassword(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Execute este comando em um terminal interativo para informar a senha com segurança.');
  }
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(prompt);

  return new Promise((resolve, reject) => {
    let password = '';
    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const onKeypress = (text, key) => {
      if (key?.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Configuração da conta cancelada.'));
        return;
      }
      if (key?.name === 'return' || key?.name === 'enter') {
        cleanup();
        resolve(password);
        return;
      }
      if (key?.name === 'backspace' || key?.name === 'delete') {
        password = Array.from(password).slice(0, -1).join('');
      } else if (text && !key?.ctrl && !key?.meta && text >= ' ') {
        password += text;
      }
    };
    process.stdin.on('keypress', onKeypress);
  });
}

async function main() {
  const config = loadAdminConfig();
  const authDatabasePath = process.env.UCA_AUTH_DB_PATH
    ? path.resolve(process.env.UCA_AUTH_DB_PATH)
    : path.join(path.dirname(getAdminConfigPath()), 'users.sqlite');
  const store = new AuthStore(authDatabasePath, config);
  try {
    if (store.getUser(username)) {
      throw new Error('A conta BRA0460 já existe. Nenhuma senha foi alterada.');
    }

    const password = await askHiddenPassword(
      'Senha de BRA0460 (mínimo 16 caracteres, entrada oculta): '
    );
    if (password.length < 16 || password.length > 1024) {
      throw new Error('A senha deve ter entre 16 e 1024 caracteres.');
    }
    const confirmation = await askHiddenPassword('Confirme a senha (entrada oculta): ');
    if (password !== confirmation) {
      throw new Error('As senhas não conferem; nenhuma conta foi criada.');
    }

    const salt = crypto.randomBytes(16);
    const passwordHash = Buffer.from(await scrypt(password, salt, 64, scryptOptions));
    store.createUser(username, 'admin', `scrypt$${salt.toString('hex')}$${passwordHash.toString('hex')}`);
    process.stdout.write('Conta Administrador UCA BRA0460 criada com senha armazenada em hash.\n');
  } finally {
    store.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
