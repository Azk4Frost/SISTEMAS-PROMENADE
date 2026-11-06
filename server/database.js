import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

import { uniformesMigrations } from './schema.js';

export const migrations = uniformesMigrations;

export function openDatabase(path, definitions = migrations) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(path);
  try {
    database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
    applyMigrations(database, definitions);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

export function applyMigrations(database, definitions) {
  let previous = 0;
  for (const entry of definitions) {
    if (!Number.isSafeInteger(entry.version) || entry.version <= previous || typeof entry.sql !== 'string' || !entry.sql.trim()) {
      throw new Error('Migrações inválidas ou fora de ordem.');
    }
    previous = entry.version;
  }
  database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT;`);
  database.exec('BEGIN IMMEDIATE');
  try {
    const applied = database.prepare('SELECT version, checksum FROM schema_migrations ORDER BY version').all();
    const known = new Map(definitions.map((entry) => [entry.version, {
      ...entry, checksum: createHash('sha256').update(entry.sql).digest('hex')
    }]));
    for (const entry of applied) {
      if (!known.has(entry.version) || known.get(entry.version).checksum !== entry.checksum) {
        throw new Error('O histórico de migrações não corresponde a esta versão do servidor.');
      }
    }
    const appliedVersions = new Set(applied.map((entry) => entry.version));
    const record = database.prepare('INSERT INTO schema_migrations(version, checksum) VALUES (?, ?)');
    for (const entry of known.values()) {
      if (appliedVersions.has(entry.version)) continue;
      database.exec(entry.sql);
      record.run(entry.version, entry.checksum);
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
