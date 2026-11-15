const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const mysql = require('mysql2/promise');
const { getMysqlConfigPath, loadMysqlConfig } = require('../mysql-config');

function askQuestion(prompt) {
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => input.question(prompt, (answer) => {
    input.close();
    resolve(answer.trim());
  }));
}

function askHiddenPassword(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Execute este comando em um terminal interativo para informar a senha sem exibi-la.');
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
        reject(new Error('Configuração do MySQL cancelada.'));
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
  const configPath = getMysqlConfigPath();
  let existing = null;
  try {
    existing = loadMysqlConfig(process.env);
  } catch {
    // Sem configuração válida ainda; seguir com o assistente.
  }
  if (existing) {
    const replace = await askQuestion(`Já existe uma configuração do MySQL em ${configPath}. Substituí-la? (s/N) `);
    if (!['s', 'sim'].includes(replace.toLocaleLowerCase('pt-BR'))) {
      process.stdout.write('A configuração existente foi mantida.\n');
      return;
    }
  }

  const host = (await askQuestion('Servidor MySQL [127.0.0.1]: ')) || '127.0.0.1';
  const portAnswer = (await askQuestion('Porta [3306]: ')) || '3306';
  const port = Number(portAnswer);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Informe uma porta válida entre 1 e 65535.');
  }
  const database = (await askQuestion('Banco de dados [uca]: ')) || 'uca';
  const user = (await askQuestion('Usuário [uca_app]: ')) || 'uca_app';
  const password = await askHiddenPassword(`Senha do usuário ${user} (entrada oculta): `);
  if (!password) {
    throw new Error('A senha não pode ser vazia; nenhuma configuração foi salva.');
  }

  process.stdout.write('Testando a conexão com o MySQL...\n');
  let connection;
  try {
    connection = await mysql.createConnection({ host, port, user, password, database });
    await connection.query('SELECT 1');
  } catch (error) {
    throw new Error(`Não foi possível conectar ao MySQL: ${error.message}. Nenhuma configuração foi salva.`);
  } finally {
    await connection?.end();
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${configPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify({ host, port, database, user, password }, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx'
    });
    fs.renameSync(temporaryPath, configPath);
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw new Error(`Não foi possível salvar a configuração em ${configPath}: ${error.message}`);
  }
  process.stdout.write(`Conexão validada e configuração salva em ${configPath}.\n`);
  process.stdout.write('Agora inicie o projeto com "npm run dev".\n');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
