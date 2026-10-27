const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const passwordLength = 64;
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function readHiddenPassword() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Execute este comando em um terminal interativo para ocultar a senha digitada.');
  }

  return new Promise((resolve, reject) => {
    let password = '';
    process.stdout.write('Senha administrativa ASCII (mínimo 16 caracteres, entrada oculta): ');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const onData = (chunk) => {
      for (const byte of chunk) {
        if (byte === 3) {
          cleanup();
          reject(new Error('Operação cancelada.'));
          return;
        }
        if (byte === 10 || byte === 13) {
          cleanup();
          return resolve(password);
        }
        if (byte === 8 || byte === 127) {
          password = password.slice(0, -1);
          continue;
        }
        if (byte >= 32 && byte <= 126) password += String.fromCharCode(byte);
      }
    };
    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    process.stdin.on('data', onData);
  });
}

async function main() {
  const password = await readHiddenPassword();
  if (password.length < 16) throw new Error('A senha deve ter pelo menos 16 caracteres.');
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, passwordLength, options);
  process.stdout.write(`ADMIN_PASSWORD_HASH=scrypt$${salt.toString('hex')}$${Buffer.from(hash).toString('hex')}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
