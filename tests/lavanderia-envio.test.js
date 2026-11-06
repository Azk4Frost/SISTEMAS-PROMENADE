import test from 'node:test';
import assert from 'node:assert/strict';
import { isDispatchContext, eligibleItems, selectedDispatchItems, dispatchSummary, dispatchPayload } from '../PROMENADEHUB/js/modules/lavanderia-envio-model.js';
import { loadLaundryDispatchItems, dispatchUniformesToLaundry, UniformesIntegrationError } from '../PROMENADEHUB/js/services/uniformes-service.js';
// Dados exclusivos do teste, nunca carregados pela aplicação.
const row = (id, person, type, eligible) => ({ id, employee: { id: person, name: 'Pessoa de teste' }, uniform: { id: type, label: 'Peça de teste' }, eligible });
const context = { connection: 'ready', items: [row('1', 'a', 'x', true), row('2', 'a', 'y', true), row('3', 'b', 'x', true), row('4', 'c', 'z', false)] };
test('valida contexto e rejeita IDs duplicados, elegibilidade ausente e dados incompletos', () => {
  assert.equal(isDispatchContext(context), true);
  assert.equal(isDispatchContext({ ...context, items: [...context.items, context.items[0]] }), false);
  assert.equal(isDispatchContext({ ...context, items: [{ ...context.items[0], eligible: undefined }] }), false);
  assert.equal(isDispatchContext({ ...context, items: [{ id: '1', eligible: true }] }), false);
});
test('elegibilidade não é inferida a partir do status', () => {
  assert.equal(eligibleItems(context).length, 3);
  assert.equal(eligibleItems({ ...context, connection: 'not-configured' }).length, 0);
  assert.equal(selectedDispatchItems(context, new Set(['4', 'inexistente'])).length, 0);
});
test('resumo distingue itens, tipos e funcionários por identidade, sem somar nomes iguais', () => {
  assert.deepEqual(dispatchSummary(context, new Set(['1', '2', '3', '4'])), { items: 3, types: 2, employees: 2 });
  assert.deepEqual(dispatchSummary(context, new Set()), { items: 0, types: 0, employees: 0 });
});
test('payload contém somente IDs elegíveis e rejeita seleção vazia', () => {
  assert.deepEqual(dispatchPayload(context, new Set(['1', '4', 'inexistente'])), { itemIds: ['1'] });
  assert.throws(() => dispatchPayload(context, new Set(['4'])), /Selecione/);
});
test('serviço sem backend não fabrica registros nem confirma envio', async () => {
  assert.deepEqual(await loadLaundryDispatchItems(), { connection: 'not-configured', items: [] });
  await assert.rejects(dispatchUniformesToLaundry({ itemIds: ['1'] }), UniformesIntegrationError);
});
