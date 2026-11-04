import test from 'node:test';
import assert from 'node:assert/strict';
import { isLoanContext, isPositiveQuantity, validateLoanItem, buildLoanItem, validateLoanDetails, formItemTotals, loanPayload, uniformIcon } from '../PROMENADEHUB/js/modules/novo-emprestimo-model.js';
import { loadNewLoanContext, registerUniformesLoan, saveUniformesLoanDraft, UniformesIntegrationError } from '../PROMENADEHUB/js/services/uniformes-service.js';

// Fixtures exclusivas do runner de testes. Não são carregadas no frontend.
const context = {
  connection: 'ready',
  employees: [{ id: 'employee-test', name: 'Funcionário exclusivo de teste' }],
  sectors: [{ id: 'sector-test', label: 'Setor de teste' }],
  responsibles: [{ id: 'responsible-test', label: 'Responsável de teste' }],
  conditions: [{ id: 'condition-test', label: 'Condição de teste' }],
  uniforms: [{ id: 'uniform-test', label: 'Uniforme de teste', icon: 'shirt-white', variants: [
    { id: 'variant-m-test', color: 'Branco de teste', size: 'M' },
    { id: 'variant-g-test', color: 'Branco de teste', size: 'G' }
  ] }]
};
const values = { uniformId: 'uniform-test', color: 'Branco de teste', size: 'M', quantity: '2', conditionId: 'condition-test' };
const details = { date: '2026-11-03', employeeId: 'employee-test', sectorId: 'sector-test', responsibleId: 'responsible-test', notes: '  Observação de teste  ' };

test('contexto valida catálogo e rejeita resposta ambígua ou inválida', () => {
  assert.equal(isLoanContext(context), true);
  assert.equal(isLoanContext({ ...context, employees: null }), false);
  assert.equal(isLoanContext({ ...context, employees: [...context.employees, ...context.employees] }), false);
  const ambiguous = structuredClone(context);
  ambiguous.uniforms[0].variants.push({ id: 'other-test', color: 'Branco de teste', size: 'M' });
  assert.equal(isLoanContext(ambiguous), false);
});
test('quantidade rejeita vazio, zero, negativos, frações e perda de precisão', () => {
  for (const value of ['', ' ', 0, -1, 1.5, 'texto', Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(isPositiveQuantity(value), false);
  assert.equal(isPositiveQuantity('2'), true);
});
test('validação exige variação e condição existentes no catálogo', () => {
  assert.deepEqual(validateLoanItem(values, context), {});
  const errors = validateLoanItem({ ...values, color: 'Outra cor', conditionId: 'inexistente', quantity: '0' }, context);
  assert.deepEqual(Object.keys(errors).sort(), ['color', 'condition', 'quantity', 'size']);
  assert.throws(() => buildLoanItem({ ...values, size: 'X' }, context, 'item-test'), /Item inválido/);
});
test('item conserva IDs reais do catálogo e não modifica a origem', () => {
  const before = structuredClone(context);
  const item = buildLoanItem(values, context, 'item-test');
  assert.equal(item.variantId, 'variant-m-test');
  assert.equal(item.conditionId, 'condition-test');
  assert.equal(item.quantity, 2);
  assert.deepEqual(context, before);
  assert.equal(uniformIcon('https://example.com/icon.svg'), 'clipboard');
});
test('formulário valida data civil, cadastros obrigatórios e presença de itens', () => {
  const item = buildLoanItem(values, context, 'item-test');
  assert.deepEqual(validateLoanDetails(details, context, [item]), {});
  assert.ok(validateLoanDetails({ ...details, date: '2026-02-30' }, context, [item])['loan-date']);
  assert.equal(Object.keys(validateLoanDetails({}, context, [])).length, 5);
});
test('resumo conta somente os itens do formulário sem perder precisão', () => {
  assert.deepEqual(formItemTotals([]), { count: 0, quantity: '0' });
  assert.deepEqual(formItemTotals([{ quantity: 2 }, { quantity: 3 }]), { count: 2, quantity: '5' });
  assert.equal(formItemTotals([{ quantity: Number.MAX_SAFE_INTEGER }, { quantity: 1 }]).quantity, '9007199254740992');
});
test('payload exclui IDs temporários e rótulos de apresentação', () => {
  const item = buildLoanItem(values, context, 'somente-formulario');
  assert.deepEqual(loanPayload(details, [item]), {
    ...details, notes: 'Observação de teste',
    items: [{ variantId: 'variant-m-test', quantity: 2, conditionId: 'condition-test' }]
  });
});
test('sem integração: cadastros vazios e operações recusadas sem sucesso simulado', async () => {
  const result = await loadNewLoanContext();
  assert.equal(isLoanContext(result), true);
  assert.equal(result.connection, 'not-configured');
  assert.deepEqual(result.uniforms, []);
  for (const operation of [registerUniformesLoan, saveUniformesLoanDraft]) {
    await assert.rejects(operation(loanPayload(details, [])), (error) => error instanceof UniformesIntegrationError && error.code === 'BACKEND_NOT_CONFIGURED');
  }
});
