const crypto = require('node:crypto');
const fs = require('node:fs');
const mysql = require('mysql2/promise');

const importMarker = 'legacy-json-import-v1';

const collections = {
  noticias: {
    table: 'noticias',
    fields: ['slug', 'title', 'excerpt', 'publishedAt', 'category', 'author', 'coverImage', 'imageAlt', 'imageCaption', 'imageCredit', 'content', 'status']
  },
  competicoes: {
    table: 'competicoes',
    fields: ['name', 'category', 'enrollmentStatus', 'expectedDate', 'expectedEndDate', 'description', 'image']
  },
  depoimentos: {
    table: 'depoimentos',
    fields: ['source', 'subject', 'quote', 'publicationDate']
  }
};

const tableDefinitions = {
  noticias: `(
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    id_type VARCHAR(6) NOT NULL,
    slug TEXT NULL,
    title TEXT NULL,
    excerpt TEXT NULL,
    publishedAt VARCHAR(10) NULL,
    category VARCHAR(100) NULL,
    author TEXT NULL,
    coverImage LONGTEXT NULL,
    imageAlt TEXT NULL,
    imageCaption TEXT NULL,
    imageCredit TEXT NULL,
    content LONGTEXT NULL,
    status VARCHAR(20) NULL,
    extra_json LONGTEXT NOT NULL,
    INDEX idx_noticias_publication (status, publishedAt)
  )`,
  competicoes: `(
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    id_type VARCHAR(6) NOT NULL,
    name VARCHAR(100) NULL,
    category VARCHAR(20) NULL,
    enrollmentStatus VARCHAR(10) NULL,
    expectedDate VARCHAR(10) NULL,
    expectedEndDate VARCHAR(10) NULL,
    description TEXT NULL,
    image LONGTEXT NULL,
    extra_json LONGTEXT NOT NULL,
    INDEX idx_competicoes_category (category)
  )`,
  depoimentos: `(
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    id_type VARCHAR(6) NOT NULL,
    source TEXT NULL,
    subject TEXT NULL,
    quote TEXT NULL,
    publicationDate VARCHAR(10) NULL,
    extra_json LONGTEXT NOT NULL
  )`
};

function quoteIdentifier(identifier) {
  return `\`${identifier.replaceAll('`', '``')}\``;
}

class MysqlStore {
  constructor(config) {
    this.tablePrefix = config.tablePrefix || '';
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: false,
      supportBigNumbers: true
    });
  }

  tableName(collection) {
    const definition = collections[collection];
    if (!definition) throw new Error(`Coleção MySQL desconhecida: ${collection}`);
    return quoteIdentifier(`${this.tablePrefix}${definition.table}`);
  }

  metadataTableName() {
    return quoteIdentifier(`${this.tablePrefix}schema_metadata`);
  }

  async initialize(legacyJsonPath) {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS ${this.metadataTableName()} (
      meta_key VARCHAR(191) NOT NULL PRIMARY KEY,
      meta_value TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    for (const collection of Object.keys(collections)) {
      await this.pool.query(`CREATE TABLE IF NOT EXISTS ${this.tableName(collection)} ${tableDefinitions[collection]}
        ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    }
    await this.importLegacyJson(legacyJsonPath);
  }

  async importLegacyJson(legacyJsonPath) {
    const [markerRows] = await this.pool.query(
      `SELECT meta_value FROM ${this.metadataTableName()} WHERE meta_key = ?`,
      [importMarker]
    );
    if (markerRows.length > 0) return;

    if (!legacyJsonPath || !fs.existsSync(legacyJsonPath)) {
      throw new Error(`O arquivo de persistência para a migração inicial não existe: ${legacyJsonPath}`);
    }
    let legacy;
    try {
      legacy = JSON.parse(fs.readFileSync(legacyJsonPath, 'utf8'));
    } catch (error) {
      throw new Error(`Não foi possível migrar o JSON legado ${legacyJsonPath}: ${error.message}`);
    }

    const rows = {};
    for (const collection of Object.keys(collections)) {
      const sourceRecords = legacy[collection] ?? [];
      if (!Array.isArray(sourceRecords) || sourceRecords.some((record) => !record || typeof record !== 'object' || Array.isArray(record))) {
        throw new Error(`A coleção ${collection} do JSON legado deve ser uma lista de registros válidos.`);
      }
      for (const record of sourceRecords) {
        if (record.id === undefined || record.id === null || String(record.id) === '') {
          throw new Error(`Há um registro sem identificador na coleção ${collection}.`);
        }
      }
      rows[collection] = sourceRecords;
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const [collection, records] of Object.entries(rows)) {
        for (const record of records) {
          await this.insertRecord(collection, record, connection);
        }
      }
      await connection.query(
        `INSERT INTO ${this.metadataTableName()} (meta_key, meta_value) VALUES (?, ?)`,
        [importMarker, new Date().toISOString()]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw new Error(`Não foi possível concluir a migração do JSON para o MySQL: ${error.message}`);
    } finally {
      connection.release();
    }
  }

  getRecordValues(collection, record) {
    const definition = collections[collection];
    const values = {
      id: String(record.id),
      id_type: typeof record.id === 'number' ? 'number' : 'string'
    };
    for (const field of definition.fields) {
      const value = record[field];
      values[field] = value == null ? null : typeof value === 'string' ? value : JSON.stringify(value);
    }
    const knownFields = new Set(['id', ...definition.fields]);
    values.extra_json = JSON.stringify(Object.fromEntries(
      Object.entries(record).filter(([field]) => !knownFields.has(field))
    ));
    return values;
  }

  async insertRecord(collection, record, executor = this.pool) {
    const definition = collections[collection];
    const values = this.getRecordValues(collection, record);
    const columns = ['id', 'id_type', ...definition.fields, 'extra_json'];
    await executor.query(
      `INSERT INTO ${this.tableName(collection)} (${columns.map(quoteIdentifier).join(', ')})
        VALUES (${columns.map(() => '?').join(', ')})`,
      columns.map((column) => values[column])
    );
    return record;
  }

  decodeRow(collection, row) {
    if (!row) return null;
    const definition = collections[collection];
    const extra = JSON.parse(row.extra_json || '{}');
    const id = row.id_type === 'number' ? Number(row.id) : row.id;
    const result = { ...extra, id };
    for (const field of definition.fields) {
      if (row[field] !== null && row[field] !== undefined) result[field] = row[field];
    }
    return result;
  }

  async list(collection) {
    const [rows] = await this.pool.query(`SELECT * FROM ${this.tableName(collection)}`);
    return rows.map((row) => this.decodeRow(collection, row));
  }

  async get(collection, id) {
    const [rows] = await this.pool.query(
      `SELECT * FROM ${this.tableName(collection)} WHERE id = ?`,
      [String(id)]
    );
    return this.decodeRow(collection, rows[0]);
  }

  async create(collection, record) {
    const newRecord = { ...record };
    if (newRecord.id === undefined || newRecord.id === null || String(newRecord.id) === '') {
      newRecord.id = crypto.randomUUID();
    }
    await this.insertRecord(collection, newRecord);
    return this.get(collection, newRecord.id);
  }

  async update(collection, id, record) {
    const current = await this.get(collection, id);
    if (!current) return null;
    const definition = collections[collection];
    const values = this.getRecordValues(collection, { ...record, id: current.id });
    const columns = ['id_type', ...definition.fields, 'extra_json'];
    await this.pool.query(
      `UPDATE ${this.tableName(collection)} SET ${columns.map((column) => `${quoteIdentifier(column)} = ?`).join(', ')} WHERE id = ?`,
      [...columns.map((column) => values[column]), String(id)]
    );
    return this.get(collection, id);
  }

  async delete(collection, id) {
    const [result] = await this.pool.query(
      `DELETE FROM ${this.tableName(collection)} WHERE id = ?`,
      [String(id)]
    );
    return result.affectedRows > 0;
  }

  async dropTables() {
    for (const collection of Object.keys(collections)) {
      await this.pool.query(`DROP TABLE IF EXISTS ${this.tableName(collection)}`);
    }
    await this.pool.query(`DROP TABLE IF EXISTS ${this.metadataTableName()}`);
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = { MysqlStore, collections };
