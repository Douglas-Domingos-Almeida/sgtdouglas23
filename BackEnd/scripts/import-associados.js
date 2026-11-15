const path = require('node:path');
const { spawnSync } = require('node:child_process');
const mysql = require('mysql2/promise');
const { loadMysqlConfig } = require('../mysql-config');

async function main() {
  const file = process.argv[2] || path.join(__dirname, '..', '..', 'imagens', 'Associados_ABRAM_SC.ods');
  const reader = spawnSync(process.env.UCA_PYTHON || 'python', [
    path.join(__dirname, 'read-associados-ods.py'), path.resolve(file)
  ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  if (reader.error) throw reader.error;
  if (reader.status !== 0) throw new Error(reader.stderr.trim() || 'Falha ao executar o leitor ODS.');
  const rows = JSON.parse(reader.stdout);
  const config = loadMysqlConfig();
  const connection = await mysql.createConnection({
    host: config.host, port: config.port, user: config.user, password: config.password,
    charset: 'utf8mb4'
  });
  try {
    await connection.query('CREATE DATABASE IF NOT EXISTS `ABRAM_SC` CHARACTER SET utf8mb4');
    const [existing] = await connection.query(
      'SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
      ['ABRAM_SC', 'Associados']
    );
    if (existing.length) throw new Error('A tabela ABRAM_SC.Associados já existe; nenhum dado foi sobrescrito.');
    await connection.query(`CREATE TABLE \`ABRAM_SC\`.\`Associados\` (
      \`linha_planilha\` INT UNSIGNED NOT NULL PRIMARY KEY,
      \`BRA\` TEXT NOT NULL,
      \`Nome\` TEXT NOT NULL,
      \`D. NASC\` TEXT NOT NULL,
      \`UF\` TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.beginTransaction();
    try {
      for (let index = 0; index < rows.length; index += 1) {
        await connection.execute(
          'INSERT INTO `ABRAM_SC`.`Associados` (`linha_planilha`, `BRA`, `Nome`, `D. NASC`, `UF`) VALUES (?, ?, ?, ?, ?)',
          [index + 2, ...rows[index]]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw new Error(`Importação revertida; a tabela vazia foi mantida: ${error.message}`);
    }
    console.log(`Importação concluída: ${rows.length} linhas.`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Não foi possível importar os associados: ${error.message}`);
  process.exitCode = 1;
});
