const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { parseImageDataUrl, saveImage } = require('./image-storage');

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
  },
  atletas: {
    table: 'atletas',
    fields: ['nome', 'email', 'telefone', 'disponibilidade', 'areas', 'mensagem', 'createdAt']
  }
};

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

class SqliteStore {
  constructor(databasePath, legacyJsonPath, uploadsDirectory) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.uploadsDirectory = uploadsDirectory;
    fs.mkdirSync(uploadsDirectory, { recursive: true });
    this.database = new Database(databasePath);
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('synchronous = FULL');
    this.database.pragma('foreign_keys = ON');
    this.createSchema();
    this.importLegacyJson(legacyJsonPath);
  }

  createSchema() {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS noticias (
        id TEXT PRIMARY KEY NOT NULL,
        id_type TEXT NOT NULL,
        slug TEXT,
        title TEXT,
        excerpt TEXT,
        publishedAt TEXT,
        category TEXT,
        author TEXT,
        coverImage TEXT,
        imageAlt TEXT,
        imageCaption TEXT,
        imageCredit TEXT,
        content TEXT,
        status TEXT,
        extra_json TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS competicoes (
        id TEXT PRIMARY KEY NOT NULL,
        id_type TEXT NOT NULL,
        name TEXT,
        category TEXT,
        enrollmentStatus TEXT,
        expectedDate TEXT,
        expectedEndDate TEXT,
        description TEXT,
        image TEXT,
        extra_json TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS depoimentos (
        id TEXT PRIMARY KEY NOT NULL,
        id_type TEXT NOT NULL,
        source TEXT,
        subject TEXT,
        quote TEXT,
        publicationDate TEXT,
        extra_json TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS atletas (
        id TEXT PRIMARY KEY NOT NULL,
        id_type TEXT NOT NULL,
        nome TEXT NOT NULL,
        email TEXT NOT NULL,
        telefone TEXT NOT NULL,
        disponibilidade TEXT NOT NULL,
        areas TEXT NOT NULL,
        mensagem TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL,
        extra_json TEXT NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_noticias_publication ON noticias(status, publishedAt);
      CREATE INDEX IF NOT EXISTS idx_competicoes_category ON competicoes(category);
      CREATE INDEX IF NOT EXISTS idx_atletas_created ON atletas(createdAt);
    `);
  }

  importLegacyJson(legacyJsonPath) {
    const completed = this.database.prepare(
      'SELECT value FROM schema_metadata WHERE key = ?'
    ).get('legacy-json-import-v1');
    if (completed) return;

    let legacy = {};
    if (legacyJsonPath && fs.existsSync(legacyJsonPath)) {
      try {
        legacy = JSON.parse(fs.readFileSync(legacyJsonPath, 'utf8'));
      } catch (error) {
        throw new Error(`Não foi possível migrar o JSON legado ${legacyJsonPath}: ${error.message}`);
      }
    }

    const importedFiles = [];
    const rows = {};
    for (const [collection, definition] of Object.entries(collections)) {
      const sourceRecords = legacy[collection] ?? [];
      if (!Array.isArray(sourceRecords) || sourceRecords.some((record) => !record || typeof record !== 'object' || Array.isArray(record))) {
        throw new Error(`A coleção ${collection} do JSON legado deve ser uma lista de registros válidos.`);
      }
      rows[collection] = sourceRecords.map((record) => {
        if (record.id === undefined || record.id === null || String(record.id) === '') {
          throw new Error(`Há um registro sem identificador na coleção ${collection}.`);
        }
        const migrated = { ...record };
        const imageField = collection === 'noticias' ? 'coverImage'
          : collection === 'competicoes' ? 'image' : '';
        if (imageField && typeof migrated[imageField] === 'string' && migrated[imageField].startsWith('data:image/')) {
          const allowedTypes = collection === 'noticias'
            ? ['image/jpeg', 'image/png', 'image/webp']
            : ['image/jpeg', 'image/png'];
          const parsed = parseImageDataUrl(migrated[imageField], allowedTypes, 2 * 1024 * 1024);
          if (parsed.error) {
            throw new Error(`A imagem do registro ${migrated.id} em ${collection} não pôde ser migrada: ${parsed.error}`);
          }
          const imageUrl = saveImage(parsed.buffer, parsed.mimeType, this.uploadsDirectory);
          importedFiles.push(imageUrl);
          migrated[imageField] = imageUrl;
        }
        return migrated;
      });
    }

    const importTransaction = this.database.transaction(() => {
      for (const [collection, records] of Object.entries(rows)) {
        for (const record of records) this.insertRecord(collection, record);
      }
      this.database.prepare(
        'INSERT INTO schema_metadata (key, value) VALUES (?, ?)'
      ).run('legacy-json-import-v1', new Date().toISOString());
    });

    try {
      importTransaction.immediate();
    } catch (error) {
      for (const imageUrl of importedFiles) {
        const filename = imageUrl.slice('/uploads/'.length);
        const filePath = path.join(this.uploadsDirectory, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      throw new Error(`Não foi possível concluir a migração do JSON para SQLite: ${error.message}`);
    }
  }

  getRecordValues(collection, record) {
    const definition = collections[collection];
    if (!definition) throw new Error(`Coleção SQLite desconhecida: ${collection}`);
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

  insertRecord(collection, record) {
    const definition = collections[collection];
    const values = this.getRecordValues(collection, record);
    const columns = ['id', 'id_type', ...definition.fields, 'extra_json'];
    const statement = this.database.prepare(
      `INSERT INTO ${quoteIdentifier(definition.table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
    );
    statement.run(...columns.map((column) => values[column]));
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

  list(collection) {
    const definition = collections[collection];
    if (!definition) throw new Error(`Coleção SQLite desconhecida: ${collection}`);
    return this.database.prepare(
      `SELECT * FROM ${quoteIdentifier(definition.table)} ORDER BY rowid`
    ).all().map((row) => this.decodeRow(collection, row));
  }

  get(collection, id) {
    const definition = collections[collection];
    if (!definition) throw new Error(`Coleção SQLite desconhecida: ${collection}`);
    const row = this.database.prepare(
      `SELECT * FROM ${quoteIdentifier(definition.table)} WHERE id = ?`
    ).get(String(id));
    return this.decodeRow(collection, row);
  }

  create(collection, record) {
    return this.transaction(() => {
      this.insertRecord(collection, record);
      return this.get(collection, record.id);
    });
  }

  update(collection, id, record) {
    return this.transaction(() => {
      const current = this.get(collection, id);
      if (!current) return null;
      const definition = collections[collection];
      const values = this.getRecordValues(collection, { ...record, id: current.id });
      const columns = ['id_type', ...definition.fields, 'extra_json'];
      this.database.prepare(
        `UPDATE ${quoteIdentifier(definition.table)} SET ${columns.map((column) => `${quoteIdentifier(column)} = ?`).join(', ')} WHERE id = ?`
      ).run(...columns.map((column) => values[column]), String(id));
      return this.get(collection, id);
    });
  }

  delete(collection, id) {
    return this.transaction(() => {
      const definition = collections[collection];
      if (!definition) throw new Error(`Coleção SQLite desconhecida: ${collection}`);
      return this.database.prepare(
        `DELETE FROM ${quoteIdentifier(definition.table)} WHERE id = ?`
      ).run(String(id)).changes > 0;
    });
  }

  transaction(callback) {
    return this.database.transaction(callback).immediate();
  }

  close() {
    this.database.close();
  }
}

module.exports = { SqliteStore };
