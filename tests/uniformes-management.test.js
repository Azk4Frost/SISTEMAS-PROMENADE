import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync,rmSync,readFileSync,writeFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../server/database.js';
import { createUniformesStore } from '../server/uniformes.js';
import { catalog,loan } from './fixtures/uniformes.js';

test('CLI cria modelo vazio sem sobrescrever e importa dados com saldo preservado; backup é consistente e restaurável',()=>{
 const folder=mkdtempSync(join(tmpdir(),'promenade-manage-'));
 const file=join(folder,'catalog.json'),databasePath=join(folder,'source.sqlite'),copy=join(folder,'backup.sqlite');
 const run=(...args)=>spawnSync(process.execPath,['server/manage.js',...args],{cwd:resolve('.'),env:{...process.env,PROMENADE_DB_PATH:databasePath},encoding:'utf8'});
 try{
  assert.equal(run('template',file).status,0);
  const empty=JSON.parse(readFileSync(file,'utf8'));assert.deepEqual(empty.uniforms,[]);assert.deepEqual(empty.employees,[]);
  assert.notEqual(run('template',file).status,0);
  writeFileSync(file,JSON.stringify({...catalog(),operationId:empty.operationId}));
  assert.equal(run('import',file).status,0);assert.equal(run('import',file).status,0);
  const db=openDatabase(databasePath);try{createUniformesStore(db).registerLoan(loan(5),'borrow-before-backup');}finally{db.close();}
  assert.equal(run('backup',copy).status,0);
  const before=readFileSync(copy);assert.notEqual(run('backup',copy).status,0);assert.deepEqual(readFileSync(copy),before);
  const restored=openDatabase(copy);try{
   assert.equal(restored.prepare('PRAGMA quick_check').get().quick_check,'ok');
   assert.equal(createUniformesStore(restored).dashboard().inventory[0].available,5);
   assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM loans').get().n,1);
  }finally{restored.close();}
 }finally{rmSync(folder,{recursive:true,force:true});}
});
