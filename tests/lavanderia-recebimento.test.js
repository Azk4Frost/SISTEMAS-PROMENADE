import test from 'node:test';
import assert from 'node:assert/strict';
import { isLaundrySelectionContext, eligibleItems, laundrySelectionSummary, laundrySelectionPayload } from '../PROMENADEHUB/js/modules/lavanderia-selecao-model.js';
// Fixtures exclusivas de teste; não são importadas no frontend.
const item = (id, eligible) => ({ id, employee: { id: 'person-test', name: 'Pessoa de teste' }, uniform: { id: 'uniform-test', label: 'Peça de teste' }, status: { label: 'Status não define elegibilidade' }, sentDate: '2026-11-06', availableQuantity: 1, version: 1, eligible });
const context = { connection: 'ready', items: [item('return-test', true), item('other-test', false)], afterReceiptStatus: { label: 'Status posterior de teste' } };
test('seleção de retorno exige elegibilidade explícita, independentemente do rótulo do status', () => {
  assert.equal(isLaundrySelectionContext(context), true);
  assert.equal(eligibleItems(context).length, 1);
  assert.deepEqual(laundrySelectionPayload(context, new Set(['return-test', 'other-test'])), { items: [{ id: 'return-test', quantity: 1, version: 1 }] });
  assert.throws(() => laundrySelectionPayload(context, new Set(['other-test'])), /Selecione/);
});
test('resumo do retorno não modifica os registros nem aplica o status posterior', () => {
  const before = structuredClone(context);
  assert.deepEqual(laundrySelectionSummary(context, new Set(['return-test'])), { items: 1, types: 1, employees: 1, pieces: 1, valid: true });
  assert.deepEqual(context, before);
});

test('quantidade parcial respeita saldo por item e é enviada com versão ao backend',()=>{
 const partial={...context,items:[{...context.items[0],availableQuantity:5}]};
 const ids=new Set(['return-test']);
 assert.deepEqual(laundrySelectionPayload(partial,ids,new Map([['return-test',2]])),{items:[{id:'return-test',quantity:2,version:1}]});
 for(const quantity of [0,-1,1.5,6]) assert.throws(()=>laundrySelectionPayload(partial,ids,new Map([['return-test',quantity]])),/válidas/);
 assert.equal(laundrySelectionSummary(partial,ids,new Map([['return-test',2]])).pieces,2);
});
