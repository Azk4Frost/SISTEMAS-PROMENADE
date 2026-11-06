import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { openDatabase, applyMigrations } from '../server/database.js';
import { createApplication } from '../server/application.js';

const fixtureMigration = [{ version: 1, sql: 'CREATE TABLE test_records (id INTEGER PRIMARY KEY, label TEXT NOT NULL) STRICT;' }];

test('banco persiste entre aberturas e migração não apaga dados existentes', () => {
  const folder = mkdtempSync(join(tmpdir(), 'promenade-db-test-'));
  try {
    const file = join(folder, 'data', 'test.sqlite');
    const first = openDatabase(file, fixtureMigration);
    first.prepare('INSERT INTO test_records(label) VALUES (?)').run('Dado exclusivo de teste');
    first.close();
    const reopened = openDatabase(file, fixtureMigration);
    try {
      assert.equal(reopened.prepare('SELECT label FROM test_records').get().label, 'Dado exclusivo de teste');
      assert.equal(reopened.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count, 1);
      assert.equal(reopened.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    } finally { reopened.close(); }
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
test('migração inválida é revertida integralmente e pode ser corrigida sem reset', () => {
  const db = openDatabase(':memory:', []);
  try {
    assert.throws(() => applyMigrations(db, [{ version: 1, sql: 'CREATE TABLE partially_created(id INTEGER); INVALID SQL;' }]));
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name = 'partially_created'").get().count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count, 0);
    applyMigrations(db, fixtureMigration);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count, 1);
  } finally { db.close(); }
});
test('mudança de migração aplicada é recusada sem alterar os dados', () => {
  const db = openDatabase(':memory:', fixtureMigration);
  try {
    db.prepare('INSERT INTO test_records(label) VALUES (?)').run('Preservar');
    assert.throws(() => applyMigrations(db, [{ version: 1, sql: 'DROP TABLE test_records;' }]), /histórico/);
    assert.equal(db.prepare('SELECT label FROM test_records').get().label, 'Preservar');
  } finally { db.close(); }
});
test('arquivo inválido não é substituído por um banco vazio', () => {
  const folder = mkdtempSync(join(tmpdir(), 'promenade-corrupt-test-'));
  try {
    const file = join(folder, 'invalid.sqlite');
    writeFileSync(file, 'arquivo de teste que deve permanecer intacto');
    assert.throws(() => openDatabase(file));
    assert.equal(readFileSync(file, 'utf8'), 'arquivo de teste que deve permanecer intacto');
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('servidor atende frontend e saúde real, sem simular operações ou expor arquivos privados', async (t) => {
  const app = createApplication({ databasePath: ':memory:' });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(() => new Promise((resolve) => app.server.close(resolve)));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', uniformes: 'ready-local-no-login' });
  const directory = await fetch(`${base}/sistemas/gestao_de_uniforme?q=teste`, { redirect: 'manual' });
  assert.equal(directory.status, 308);
  assert.equal(directory.headers.get('location'), '/sistemas/gestao_de_uniforme/?q=teste');
  await directory.text();
  for (const name of ['', 'novo-emprestimo.html', 'enviar-lavanderia.html', 'receber-lavanderia.html', 'todos-emprestimos.html']) {
    const response = await fetch(`${base}/sistemas/gestao_de_uniforme/${name}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /<!DOCTYPE html>/i);
  }
  const module = await fetch(`${base}/js/services/uniformes-service.js`);
  assert.match(module.headers.get('content-type'), /text\/javascript/);
  await module.text();
  const head = await fetch(`${base}/index.html`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const mutation = await fetch(`${base}/api/uniformes/loans`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"test":true}' });
  assert.equal(mutation.status, 403);
  assert.equal((await mutation.json()).error.code, 'INVALID_ORIGIN');
  const invalidMethod = await fetch(`${base}/api/health`, { method: 'POST' });
  assert.equal(invalidMethod.status, 405);
  await invalidMethod.text();
  for (const path of ['/server/database.js', '/.data/promenade.sqlite', '/.git/config', '/%2e%2e%2fpackage.json', '/absent.html']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, path);
    const body = await response.text();
    assert.ok(!body.includes('node:sqlite') && !body.includes('BEGIN IMMEDIATE'));
  }
  const malformed = await fetch(`${base}/%ZZ`);
  assert.equal(malformed.status, 400);
  await malformed.text();
});
test('servidor não segue link simbólico que sai da pasta pública', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'promenade-web-test-'));
  const root = join(folder, 'public');
  mkdirSync(root);
  writeFileSync(join(folder, 'private.txt'), 'Conteúdo privado exclusivo do teste');
  symlinkSync(join(folder, 'private.txt'), join(root, 'escape.txt'));
  const app = createApplication({ databasePath: ':memory:', webRoot: root });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => app.server.close(resolve));
    rmSync(folder, { recursive: true, force: true });
  });
  const response = await fetch(`http://127.0.0.1:${app.server.address().port}/escape.txt`);
  assert.equal(response.status, 404);
  assert.ok(!(await response.text()).includes('Conteúdo privado'));
});

test('configuração não permite criar banco dentro da pasta pública ou por alias de diretório',()=>{
 const folder=mkdtempSync(join(tmpdir(),'promenade-private-db-'));
 const root=join(folder,'public');mkdirSync(root);
 try{
  const file=join(root,'operacional.sqlite');
  assert.throws(()=>createApplication({databasePath:file,webRoot:root}),/pasta pública/);
  symlinkSync(root,join(folder,'alias'),'dir');
  assert.throws(()=>createApplication({databasePath:join(folder,'alias','operacional.sqlite'),webRoot:root}),/pasta pública/);
  symlinkSync(join(root,'novo.sqlite'),join(folder,'dangling.sqlite'));
  assert.throws(()=>createApplication({databasePath:join(folder,'dangling.sqlite'),webRoot:root}));
 }finally{rmSync(folder,{recursive:true,force:true});}
});
