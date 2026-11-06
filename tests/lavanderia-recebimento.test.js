import test from 'node:test';
import assert from 'node:assert/strict';
import { isLaundrySelectionContext, eligibleItems, laundrySelectionSummary, laundrySelectionPayload } from '../PROMENADEHUB/js/modules/lavanderia-selecao-model.js';
import { loadLaundryReceiptItems, receiveUniformesFromLaundry, UniformesIntegrationError } from '../PROMENADEHUB/js/services/uniformes-service.js';
// Fixtures exclusivas de teste; não são importadas no frontend.
const item = (id, eligible) => ({ id, employee: { id: 'person-test', name: 'Pessoa de teste' }, uniform: { id: 'uniform-test', label: 'Peça de teste' }, status: { label: 'Status não define elegibilidade' }, sentDate: '2026-11-06', eligible });
const context = { connection: 'ready', items: [item('return-test', true), item('other-test', false)], afterReceiptStatus: { label: 'Status posterior de teste' } };
test('recebimento sem integração não presume itens nem status posterior', async () => {
  assert.deepEqual(await loadLaundryReceiptItems(), { connection: 'not-configured', items: [], afterReceiptStatus: null });
  await assert.rejects(receiveUniformesFromLaundry({ itemIds: ['return-test'] }), UniformesIntegrationError);
});
test('seleção de retorno exige elegibilidade explícita, independentemente do rótulo do status', () => {
  assert.equal(isLaundrySelectionContext(context), true);
  assert.equal(eligibleItems(context).length, 1);
  assert.deepEqual(laundrySelectionPayload(context, new Set(['return-test', 'other-test'])), { itemIds: ['return-test'] });
  assert.throws(() => laundrySelectionPayload(context, new Set(['other-test'])), /Selecione/);
});
test('resumo do retorno não modifica os registros nem aplica o status posterior', () => {
  const before = structuredClone(context);
  assert.deepEqual(laundrySelectionSummary(context, new Set(['return-test'])), { items: 1, types: 1, employees: 1 });
  assert.deepEqual(context, before);
});
