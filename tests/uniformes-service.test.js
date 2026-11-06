import test from 'node:test';
import assert from 'node:assert/strict';
import { registerUniformesLoan, loadUniformesDashboard, UniformesIntegrationError } from '../PROMENADEHUB/js/services/uniformes-service.js';
test('cliente HTTP consulta a API real e não fabrica um dashboard quando o servidor falha',async(t)=>{
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(url,'/api/uniformes/dashboard');assert.equal(options.method,'GET');assert.equal(options.cache,'no-store');
  return new Response(JSON.stringify({connection:'ready',loans:[],inventory:[],indicators:{activeLoans:0}}));
 });
 assert.equal((await loadUniformesDashboard()).connection,'ready');
 globalThis.fetch.mock.mockImplementation(async()=>{throw Error('Falha de rede exclusiva de teste');});
 await assert.rejects(loadUniformesDashboard(),UniformesIntegrationError);
});
test('retry após falha de rede reutiliza chave; próxima operação confirmada usa chave nova',async(t)=>{
 const keys=[];let attempts=0;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(options.headers['X-Promenade-Request'],'1');assert.equal(options.headers['Content-Type'],'application/json');
  keys.push(options.headers['Idempotency-Key']);attempts++;
  if(attempts===1) throw Error('Resposta perdida exclusiva de teste');
  return new Response(JSON.stringify({id:1,code:'TESTE-001'}));
 });
 const payload={notes:'Idempotência exclusiva de teste',items:[]};
 await assert.rejects(registerUniformesLoan(payload),/não foi confirmado/);
 await registerUniformesLoan(payload);await registerUniformesLoan(payload);
 assert.equal(keys[0],keys[1]);assert.notEqual(keys[1],keys[2]);
});
test('erros da API preservam código e mensagem de validação do servidor',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({error:{code:'INSUFFICIENT_STOCK',message:'Saldo insuficiente de teste'}}),{status:409}));
 await assert.rejects(registerUniformesLoan({notes:'Erro de teste',items:[]}),error=>error.code==='INSUFFICIENT_STOCK'&&error.message==='Saldo insuficiente de teste');
});
