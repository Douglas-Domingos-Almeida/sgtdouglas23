const crypto = require('node:crypto');
const readline = require('node:readline');
const { promisify } = require('node:util');
const {
  getAdminConfigPath,
  readAdminConfig,
  writeAdminConfig
} = require('../admin-config');

const scrypt = promisify(crypto.scrypt);
const scryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function askQuestion(prompt) {
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => input.question(prompt, (answer) => {
    input.close();
    resolve(answer.trim());
  }));
}

function askHiddenPassword(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Execute este comando em um terminal interativo para cadastrar a senha sem exibi-la.');
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
        reject(new Error('Configuração administrativa cancelada.'));
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
  const configPath = getAdminConfigPath();
  if (process.argv.includes('--if-missing') && readAdminConfig(configPath)) return;
  if (process.env.ADMIN_USERNAME || process.env.ADMIN_PASSWORD_HASH) {
    throw new Error('Remova as variáveis ADMIN_USERNAME e ADMIN_PASSWORD_HASH para configurar a conta local.');
  }
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('A configuração inicial exige um terminal interativo. Execute "npm run admin:setup" no terminal integrado do VS Code.');
  }
  if (readAdminConfig(configPath)) {
    const replace = await askQuestion('Já existe uma conta administrativa local. Substituí-la? (s/N) ');
    if (!['s', 'sim'].includes(replace.toLocaleLowerCase('pt-BR'))) {
      process.stdout.write('A configuração existente foi mantida.\n');
      return;
    }
  }

  const username = await askQuestion('Nome do usuário administrativo: ');
  if (!username || username.length > 100) {
    throw new Error('Informe um nome de usuário com até 100 caracteres.');
  }
  const password = await askHiddenPassword('Senha administrativa (mínimo 16 caracteres, entrada oculta): ');
  if (password.length < 16 || password.length > 1024) {
    throw new Error('A senha deve ter entre 16 e 1024 caracteres.');
  }
  const confirmation = await askHiddenPassword('Confirme a senha (entrada oculta): ');
  if (password !== confirmation) {
    throw new Error('As senhas não conferem; nenhuma configuração foi salva.');
  }

  const salt = crypto.randomBytes(16);
  const passwordHash = Buffer.from(await scrypt(password, salt, 64, scryptOptions));
  writeAdminConfig({
    username,
    passwordHash: `scrypt$${salt.toString('hex')}$${passwordHash.toString('hex')}`
  }, configPath);
  process.stdout.write(`Conta administrativa configurada em ${configPath}.\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
