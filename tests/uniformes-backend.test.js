import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { get as httpGet } from 'node:http';
import { openDatabase } from '../server/database.js';
import { createUniformesStore } from '../server/uniformes.js';
import { createApplication } from '../server/application.js';
import { catalog,loan } from './fixtures/uniformes.js';
const setup=(quantity=10)=>{const db=openDatabase(':memory:');const store=createUniformesStore(db);store.importCatalog(catalog(quantity),'catalog-test');return{db,store};};
const stock=(db)=>db.prepare('SELECT * FROM variants WHERE id=?').get('variante-teste');
const line=(db)=>db.prepare('SELECT * FROM loan_items ORDER BY id LIMIT 1').get();
const move=(store,db,kind,quantity,key=randomUUID())=>{const row=line(db);return store.transition(kind,{items:[{id:String(row.id),quantity,version:row.version}]},key);};

test('ciclo parcial completo conserva peças e libera saldo somente após recebimento limpo',()=>{
 const {db,store}=setup();try{
  const result=store.registerLoan(loan(5),'borrow-test');assert.equal(result.code,'EMP-000001');assert.equal(stock(db).available,5);
  move(store,db,'return',2);assert.equal(line(db).held,3);assert.equal(line(db).dirty,2);assert.equal(stock(db).available,5);
  move(store,db,'dispatch',1);assert.equal(line(db).dirty,1);assert.equal(line(db).laundry,1);assert.equal(stock(db).available,5);
  move(store,db,'receive',1);assert.equal(stock(db).available,6);assert.equal(line(db).clean,1);
  move(store,db,'return',3);move(store,db,'dispatch',4);move(store,db,'receive',4);
  assert.equal(stock(db).available,10);assert.equal(stock(db).total,10);assert.equal(line(db).clean,5);
  assert.equal(store.dashboard().indicators.activeLoans,0);assert.equal(store.dashboard().indicators.atLaundry,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM movements').get().n,8);
 }finally{db.close();}
});
test('empréstimo sem estoque é revertido, incluindo linhas repetidas da mesma variação',()=>{
 const {db,store}=setup(4);try{
  const payload=loan(3);payload.items.push({...payload.items[0],quantity:2});
  assert.throws(()=>store.registerLoan(payload,'too-much'),/insuficiente/);
  assert.equal(stock(db).available,4);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM loans').get().n,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM requests WHERE key='too-much'").get().n,0);
 }finally{db.close();}
});
test('repetir a requisição confirmada não duplica empréstimo ou movimentação',()=>{
 const {db,store}=setup();try{
  const first=store.registerLoan(loan(5),'same-key');assert.deepEqual(store.registerLoan(loan(5),'same-key'),first);
  assert.equal(stock(db).available,5);assert.throws(()=>store.registerLoan(loan(2),'same-key'),/Identificador/);
  move(store,db,'return',2);const row=line(db);const payload={items:[{id:String(row.id),quantity:1,version:row.version}]};
  store.transition('dispatch',payload,'repeat-dispatch');store.transition('dispatch',payload,'repeat-dispatch');
  assert.equal(line(db).laundry,1);assert.equal(line(db).dirty,1);
 }finally{db.close();}
});
test('operações fora de ordem, quantidades inválidas e versões antigas são recusadas',()=>{
 const {db,store}=setup();try{
  store.registerLoan(loan(),'borrow');
  assert.throws(()=>move(store,db,'receive',1),/saldo/);
  assert.throws(()=>move(store,db,'dispatch',1),/saldo/);
  for(const q of [0,-1,1.5,'1',null])assert.throws(()=>move(store,db,'return',q));
  const old=line(db);move(store,db,'return',1);
  assert.throws(()=>store.transition('return',{items:[{id:String(old.id),quantity:1,version:old.version}]},'stale'),/outra janela/);
  assert.equal(line(db).dirty,1);
 }finally{db.close();}
});
test('lote com um item inválido reverte todos os itens, sem devolução parcial acidental',()=>{
 const {db,store}=setup();try{
  store.registerLoan(loan(),'borrow');const row=line(db);
  assert.throws(()=>store.transition('return',{items:[{id:String(row.id),quantity:1,version:row.version},{id:'999',quantity:1,version:1}]},'invalid-batch'),/não encontrado/);
  assert.equal(line(db).held,5);assert.equal(line(db).dirty,0);
  assert.throws(()=>store.transition('return',{items:[{id:String(row.id),quantity:1,version:1},{id:String(row.id),quantity:1,version:1}]},'duplicate-batch'),/duplicado/);
 }finally{db.close();}
});
test('rascunho persiste sem reservar estoque, detecta conflitos e só desaparece após registro',()=>{
 const {db,store}=setup();try{
  const draft=store.saveDraft({...loan(3),employeeId:''},'draft');assert.equal(stock(db).available,10);
  assert.equal(store.listDrafts().drafts.length,1);assert.equal(store.readDraft(draft.id).items[0].quantity,3);
  const updated=store.saveDraft({...loan(3),draftId:draft.id,draftVersion:draft.version},'update-draft');
  assert.throws(()=>store.saveDraft({...loan(3),draftId:draft.id,draftVersion:draft.version},'stale-draft'),/outra janela/);
  assert.throws(()=>store.registerLoan({...loan(30),draftId:draft.id,draftVersion:updated.version},'draft-over-stock'),/insuficiente/);
  assert.equal(store.listDrafts().drafts.length,1);
  store.registerLoan({...loan(3),draftId:draft.id,draftVersion:updated.version},'from-draft');
  assert.equal(store.listDrafts().drafts.length,0);assert.equal(stock(db).available,7);
 }finally{db.close();}
});
test('importação repetida e reposição têm idempotência e não sobrescrevem saldo existente',()=>{
 const {db,store}=setup();try{
  store.importCatalog(catalog(),'catalog-test');assert.equal(stock(db).total,10);
  assert.throws(()=>store.importCatalog(catalog(),'new-import'),/já cadastrada/);
  store.addStock({variantId:'variante-teste',quantity:2},'add-stock');store.addStock({variantId:'variante-teste',quantity:2},'add-stock');
  assert.equal(stock(db).total,12);assert.equal(stock(db).available,12);
 }finally{db.close();}
});
test('duas conexões não emprestam o mesmo saldo e dados persistem depois de reabrir',()=>{
 const folder=mkdtempSync(join(tmpdir(),'promenade-race-'));let first,second;
 try{
  const file=join(folder,'test.sqlite');first=openDatabase(file);second=openDatabase(file);
  const a=createUniformesStore(first),b=createUniformesStore(second);a.importCatalog(catalog(2),'catalog');
  a.registerLoan(loan(2),'a');assert.throws(()=>b.registerLoan(loan(2),'b'),/insuficiente/);
  first.close();second.close();first=null;second=null;
  const reopened=openDatabase(file);try{assert.equal(stock(reopened).available,0);assert.equal(line(reopened).held,2);}finally{reopened.close();}
 }finally{first?.close();second?.close();rmSync(folder,{recursive:true,force:true});}
});
test('API real rejeita origem externa e valida entradas; empréstimo e retorno parciais respondem dados reais',async(t)=>{
 const {server,database}=createApplication({databasePath:':memory:'});const store=createUniformesStore(database);store.importCatalog(catalog(),'catalog');
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const post=(path,body,extra={})=>fetch(base+'/api/uniformes'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Promenade-Request':'1','Idempotency-Key':randomUUID(),...extra},body:JSON.stringify(body)});
 let response=await post('/loans',loan(),{Origin:'https://external.example'});assert.equal(response.status,403);await response.text();
 const invalidHost=await new Promise((resolve,reject)=>{const req=httpGet(base+'/api/uniformes/dashboard',{headers:{Host:'external.example'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);});assert.equal(invalidHost,403);
 response=await post('/loans',loan());assert.equal(response.status,200);assert.equal((await response.json()).code,'EMP-000001');
 let state=await(await fetch(base+'/api/uniformes/dashboard')).json();assert.equal(state.inventory[0].available,5);
 response=await post('/returns',{items:[{id:state.loans[0].lineId,quantity:2,version:state.loans[0].version}]});assert.equal(response.status,200);await response.text();
 state=await(await fetch(base+'/api/uniformes/laundry/dispatch')).json();assert.equal(state.items[0].availableQuantity,2);
 assert.equal(state.items[0].status.label,'Em Devolução');
 const invalid=await post('/returns',{items:[null]});assert.equal(invalid.status,400);await invalid.text();
 const raw=await fetch(base+'/api/uniformes/loans',{method:'POST',headers:{'Content-Type':'application/json','X-Promenade-Request':'1','Idempotency-Key':randomUUID()},body:'not json'});assert.equal(raw.status,400);await raw.text();
});

test('datas de envio e devoluções do dia usam São Paulo, inclusive quando a data UTC já mudou',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-07T01:00:00Z')});
 const {db,store}=setup();try{
  store.registerLoan(loan(),'borrow-timezone');move(store,db,'return',1);move(store,db,'dispatch',1);
  assert.equal(store.laundryContext('receive').items[0].sentDate,'2026-11-06');
  assert.equal(store.dashboard().indicators.returnsToday,1);
  t.mock.timers.setTime(new Date('2026-11-07T04:00:00Z').getTime());
  assert.equal(store.dashboard().indicators.returnsToday,0);
 }finally{db.close();}
});
