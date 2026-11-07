const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

class AuthStore {
  constructor(databasePath, initialAdmin) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });
    this.database = new Database(databasePath);
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('synchronous = FULL');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS auth_users (
        username TEXT PRIMARY KEY COLLATE NOCASE NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    if (this.database.prepare('SELECT COUNT(*) AS count FROM auth_users').get().count === 0) {
      this.createUser(initialAdmin.username, 'admin', initialAdmin.passwordHash);
    }
  }

  getUser(username) {
    return this.database.prepare(
      'SELECT username, role, password_hash AS passwordHash, created_at AS createdAt FROM auth_users WHERE username = ? COLLATE NOCASE'
    ).get(username) || null;
  }

  listUsers() {
    return this.database.prepare(
      'SELECT username, role, created_at AS createdAt FROM auth_users ORDER BY username COLLATE NOCASE'
    ).all();
  }

  createUser(username, role, passwordHash) {
    this.database.prepare(
      'INSERT INTO auth_users (username, role, password_hash, created_at) VALUES (?, ?, ?, ?)'
    ).run(username.trim(), role, passwordHash, new Date().toISOString());
    return this.getUser(username);
  }

  updatePassword(username, passwordHash) {
    return this.database.prepare(
      'UPDATE auth_users SET password_hash = ? WHERE username = ? COLLATE NOCASE'
    ).run(passwordHash, username).changes > 0;
  }

  deleteUser(username) {
    return this.database.prepare(
      'DELETE FROM auth_users WHERE username = ? COLLATE NOCASE'
    ).run(username).changes > 0;
  }

  countAdmins() {
    return this.database.prepare(
      "SELECT COUNT(*) AS count FROM auth_users WHERE role = 'admin'"
    ).get().count;
  }

  close() {
    this.database.close();
  }
}

module.exports = { AuthStore };
