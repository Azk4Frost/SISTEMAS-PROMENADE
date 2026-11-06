import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { openDatabase } from '../server/database.js';
import { uniformesMigrations } from '../server/schema.js';
import { createUniformesStore } from '../server/uniformes.js';
import { createApplication } from '../server/application.js';
import { catalog,loan } from './fixtures/uniformes.js';
const setup=()=>{const db=openDatabase(':memory:');const store=createUniformesStore(db);store.importCatalog(catalog(0),'catalog');return {db,store};};
const opening=()=>({modelId:'camisa-branca',color:'Outra cor exclusiva de teste',size:'G',cleanQuantity:3,dirtyQuantity:2,laundryQuantity:1,holdings:[{employeeId:'pessoa-teste',quantity:4,responsibleId:null,sectorId:null,date:null}]});
const move=(store,context,quantity,kind,key=randomUUID())=>{const row=context.items[0];return store.transition(kind,{items:[{id:row.id,quantity,version:row.version}]},key);};

test('cadastros reais recebem IDs, edição preserva vínculos e versões antigas são recusadas',()=>{
 const {db,store}=setup();try{
  const created=store.saveCatalogRecord('employees',{name:'Pessoa adicional exclusiva de teste',registration:'TESTE-002'},'create-person');
  assert.equal(created.version,1);assert.equal(store.catalog().employees.length,2);
  const updated=store.saveCatalogRecord('employees',{id:created.id,version:1,name:'Nome corrigido de teste',registration:'TESTE-002'},'edit-person');
  assert.equal(updated.id,created.id);assert.equal(updated.version,2);
  assert.throws(()=>store.saveCatalogRecord('employees',{id:created.id,version:1,name:'Não deve substituir',registration:'TESTE-002'},'stale-person'),/outra janela/);
  assert.equal(store.catalog().employees.find(row=>row.id===created.id).name,'Nome corrigido de teste');
  assert.throws(()=>store.saveCatalogRecord('employees',{name:'Matrícula repetida',registration:'TESTE-001'},'duplicate-person'));
  assert.equal(store.catalog().employees.length,2);
 }finally{db.close();}
});
test('saldo inicial total inclui limpas, funcionários, sujas e lavanderia, sem inventar empréstimos ou pessoas',()=>{
 const {db,store}=setup();try{
  const result=store.openStock(opening(),'open');assert.equal(result.total,10);assert.equal(result.available,3);
  const variant=store.catalog().uniforms[0].variants.find(row=>row.id===result.id);
  assert.equal(variant.available+variant.held+variant.dirty+variant.laundry,variant.total);
  assert.deepEqual([variant.available,variant.held,variant.dirty,variant.laundry],[3,4,2,1]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM loans').get().n,0);
  assert.equal(store.catalog().employees.length,1);assert.equal(store.catalog().responsibles.length,1);
  const held=store.dashboard().loans.find(row=>row.status==='com-funcionario');
  assert.match(held.code,/^INICIAL-/);assert.equal(held.responsibleName,null);assert.equal(held.loanDate,null);
  assert.equal(held.employee.id,'pessoa-teste');assert.equal(store.dashboard().indicators.activeLoans,0);
  assert.equal(store.dashboard().indicators.openingHeldPieces,4);
  const received=store.laundryContext('receive').items[0];assert.equal(received.employee.id,null);assert.equal(received.sentDate,null);
 }finally{db.close();}
});
test('saldos iniciais seguem o ciclo parcial e conservam a quantidade física total',()=>{
 const {db,store}=setup();try{
  const result=store.openStock(opening(),'open');
  move(store,store.laundryContext('receive'),1,'receive');
  assert.equal(store.catalog().uniforms[0].variants.find(row=>row.id===result.id).available,4);
  const held=store.dashboard().loans.find(row=>row.status==='com-funcionario');
  store.transition('return',{items:[{id:held.lineId,quantity:4,version:held.version}]},'return-opening');
  const dispatch=store.laundryContext('dispatch');
  store.transition('dispatch',{items:dispatch.items.map(row=>({id:row.id,quantity:row.availableQuantity,version:row.version}))},'dispatch-opening');
  const receive=store.laundryContext('receive');
  store.transition('receive',{items:receive.items.map(row=>({id:row.id,quantity:row.availableQuantity,version:row.version}))},'receive-opening');
  const variant=store.catalog().uniforms[0].variants.find(row=>row.id===result.id);
  assert.equal(variant.available,10);assert.equal(variant.total,10);assert.equal(variant.held+variant.dirty+variant.laundry,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM movements WHERE opening_lot_id IS NOT NULL").get().n,6);
 }finally{db.close();}
});
test('abertura e reposição não duplicam o saldo em retry nem substituem variação existente',()=>{
 const {db,store}=setup();try{
  const first=store.openStock(opening(),'same-opening');assert.deepEqual(store.openStock(opening(),'same-opening'),first);
  assert.throws(()=>store.openStock(opening(),'different-opening'),/já estão cadastrados/);
  assert.equal(store.catalog().uniforms[0].variants.length,2);
  const payload={variantId:first.id,quantity:2};store.addStock(payload,'same-add');store.addStock(payload,'same-add');
  const variant=store.catalog().uniforms[0].variants.find(row=>row.id===first.id);assert.equal(variant.total,12);assert.equal(variant.available,5);
 }finally{db.close();}
});
test('abertura inválida reverte modelo, variação e contagens, incluindo funcionário ausente',()=>{
 const {db,store}=setup();try{
  const payload={...opening(),modelId:undefined,newModel:{cardId:'avental',label:'Modelo de teste',icon:'apron'},holdings:[{employeeId:'inexistente',quantity:1}]};
  assert.throws(()=>store.openStock(payload,'invalid-holder'),/não cadastrado/);
  assert.equal(store.catalog().uniforms.length,1);
  assert.throws(()=>store.openStock({...opening(),dirtyQuantity:-1},'negative'));
  assert.throws(()=>store.openStock({...opening(),laundryQuantity:1.5},'fraction'));
  assert.throws(()=>store.openStock({...opening(),holdings:[{employeeId:'pessoa-teste',quantity:1,date:'2026-02-30'}]},'bad-date'));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM opening_lots').get().n,0);
 }finally{db.close();}
});
test('datas e responsáveis originais só são registrados quando informados',()=>{
 const {db,store}=setup();try{
  const payload=opening();payload.holdings[0]={employeeId:'pessoa-teste',quantity:4,responsibleId:'operador-teste',sectorId:'setor-teste',date:'2026-10-20'};
  store.openStock(payload,'known-history');const row=store.dashboard().loans.find(row=>row.status==='com-funcionario');
  assert.equal(row.loanDate,'2026-10-20');assert.equal(row.responsibleName,'Operador exclusivo de teste');
  assert.equal(row.employee.department,'Setor exclusivo de teste');
 }finally{db.close();}
});
test('cadastro de uma variação nova não impede empréstimo normal nem afeta o saldo de outras variações',()=>{
 const {db,store}=setup();try{
  store.openStock(opening(),'open');const variant=store.catalog().uniforms[0].variants.find(row=>row.color==='Outra cor exclusiva de teste');
  const payload=loan(2);payload.items[0].variantId=variant.id;store.registerLoan(payload,'regular-loan');
  assert.equal(store.catalog().uniforms[0].variants.find(row=>row.id===variant.id).available,1);
  assert.equal(store.dashboard().indicators.activeLoans,1);assert.equal(store.dashboard().indicators.openingHeldPieces,4);
 }finally{db.close();}
});
test('migração da versão 1 mantém estoque e dados existentes sem recriar histórico',()=>{
 const directory=mkdtempSync(join(tmpdir(),'promenade-v1-'));
 try{
  const path=join(directory,'test.sqlite');const db=openDatabase(path,[uniformesMigrations[0]]);
  db.exec("INSERT INTO sectors VALUES('s','Setor de teste'); INSERT INTO employees VALUES('e','Pessoa de teste','TESTE'); INSERT INTO responsibles VALUES('r','Responsável de teste'); INSERT INTO uniforms VALUES('u','Modelo de teste','apron'); INSERT INTO variants VALUES('v','u','Cor de teste','M',10,8); INSERT INTO loans VALUES(1,'e','s','r','2026-11-01','Teste','2026-11-01T12:00:00Z'); INSERT INTO loan_items(id,loan_id,variant_id,quantity,held,updated_at) VALUES(1,1,'v',2,2,'2026-11-01T12:00:00Z');");db.close();
  const upgraded=openDatabase(path);try{
   const store=createUniformesStore(upgraded);assert.equal(store.dashboard().inventory[0].available,8);assert.equal(store.dashboard().indicators.activeLoans,1);
   assert.equal(upgraded.prepare('SELECT COUNT(*) AS n FROM opening_lots').get().n,0);assert.equal(store.catalog().employees[0].version,1);
  }finally{upgraded.close();}
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('rotas de cadastro usam as mesmas restrições locais e gravação transacional da API',async(t)=>{
 const {server}=createApplication({databasePath:':memory:'});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}/api/uniformes`;
 const initial=await(await fetch(base+'/catalog')).json();assert.deepEqual(initial.employees,[]);
 const payload={name:'Pessoa API exclusiva de teste',registration:'API-TESTE'};
 let response=await fetch(base+'/catalog/employees',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});assert.equal(response.status,403);await response.text();
 response=await fetch(base+'/catalog/employees',{method:'POST',headers:{'Content-Type':'application/json','X-Promenade-Request':'1','Idempotency-Key':randomUUID()},body:JSON.stringify(payload)});assert.equal(response.status,200);const saved=await response.json();assert.ok(saved.id);
 assert.equal((await(await fetch(base+'/catalog')).json()).employees.length,1);
 const oversized=await fetch(base+'/catalog/employees',{method:'POST',headers:{'Content-Type':'application/json','X-Promenade-Request':'1','Idempotency-Key':randomUUID()},body:JSON.stringify({name:'x'.repeat(140000),registration:'TOO-LARGE-TEST'})});assert.equal(oversized.status,413);assert.equal((await oversized.json()).error.code,'PAYLOAD_TOO_LARGE');
 assert.equal((await(await fetch(base+'/catalog')).json()).employees.length,1);
});
