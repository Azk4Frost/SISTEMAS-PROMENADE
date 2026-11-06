import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLoans, isDateRangeValid } from '../PROMENADEHUB/js/modules/uniformes-filters.js';

// Fixtures exclusivas de testes; não são importadas ou exibidas pela aplicação.
const loans = [
  { code: 'TEST-01', employee: { name: 'Funcionário de Teste Á', registration: '0091' }, status: 'com-funcionario', loanDate: '2026-11-01', items: [{ uniform: 'avental' }] },
  { code: 'TEST-02', employee: { name: 'Pessoa de Teste B', registration: '0092' }, status: 'na-lavanderia', loanDate: '2026-11-03', items: [{ uniform: 'camisa-branca' }, { uniform: 'calca-azul' }] },
  { code: 'TEST-03', employee: {}, status: 'em-devolucao', items: [] }
];

test('pesquisa por nome ignora caixa, acentos e espaços externos', () => {
  assert.deepEqual(filterLoans(loans, { query: '  FUNCIONARIO DE TESTE A  ' }).map((row) => row.code), ['TEST-01']);
});
test('pesquisa matrícula sem converter ou perder zeros iniciais', () => {
  assert.deepEqual(filterLoans(loans, { query: '0092' }).map((row) => row.code), ['TEST-02']);
});
test('combina pesquisa, status, uniforme e período de forma inclusiva', () => {
  const filters = { query: 'teste', status: 'na-lavanderia', uniform: 'calca-azul', startDate: '2026-11-03', endDate: '2026-11-03' };
  assert.deepEqual(filterLoans(loans, filters).map((row) => row.code), ['TEST-02']);
  assert.equal(filterLoans(loans, { ...filters, uniform: 'avental' }).length, 0);
});
test('período inválido não retorna registros; período aberto é aceito', () => {
  assert.equal(isDateRangeValid({ startDate: '2026-11-03', endDate: '2026-11-01' }), false);
  assert.equal(filterLoans(loans, { startDate: '2026-11-03', endDate: '2026-11-01' }).length, 0);
  assert.deepEqual(filterLoans(loans, { startDate: '2026-11-02' }).map((row) => row.code), ['TEST-02']);
  assert.deepEqual(filterLoans(loans, { endDate: '2026-11-01' }).map((row) => row.code), ['TEST-01']);
});
test('ausência de resultado e lista vazia são tratadas sem erros', () => {
  assert.deepEqual(filterLoans(loans, { query: '<img onerror=alert(1)>' }), []);
  assert.deepEqual(filterLoans([], { status: 'na-lavanderia' }), []);
});
test('limpar filtros preserva todos os registros sem modificar a origem', () => {
  const before = structuredClone(loans);
  assert.deepEqual(filterLoans(loans, {}), loans);
  assert.deepEqual(loans, before);
});
