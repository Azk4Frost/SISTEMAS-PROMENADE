/**
 * Ponto único de integração do painel. Nenhuma API foi definida nesta etapa.
 * Não cria registros de demonstração nem usa armazenamento no navegador.
 *
 * Contrato de apresentação para a futura integração (não define regras do ciclo):
 * {
 *   connection: 'ready' | 'not-configured',
 *   inventory: [{ id, available, inStock, total }],
 *   indicators: { activeLoans, returnsToday, atLaundry, totalStock } | null,
 *   loans: [{ code, employee: { name, registration, department },
 *     items: [{ uniform, label, size, quantity }], status,
 *     loanDate: 'YYYY-MM-DD', updatedAt: 'ISO-8601' }]
 * }
 * Quantidades/indicadores devem vir do backend; não são calculados pela tela.
 * Autorização e transições do ciclo serão definidas na etapa de backend.
 */
export async function loadUniformesDashboard() {
  return {
    connection: 'not-configured',
    inventory: [],
    indicators: null,
    loans: []
  };
}

/**
 * Cadastros da página Novo Empréstimo. Dados reais e condições devem vir do backend.
 * Contrato de apresentação:
 * {
 *   connection: 'ready' | 'not-configured',
 *   employees: [{ id, name, registration }], sectors: [{ id, label }],
 *   responsibles: [{ id, label }], conditions: [{ id, label }],
 *   uniforms: [{ id, label, icon, available, variants: [{ id, color, size }] }]
 * }
 * Disponibilidade não é recalculada a partir do formulário. Não há reservas,
 * transições de ciclo, mesclagem de itens ou geração de códigos nesta etapa.
 */
export async function loadNewLoanContext() {
  return {
    connection: 'not-configured', employees: [], sectors: [],
    responsibles: [], conditions: [], uniforms: []
  };
}

export class UniformesIntegrationError extends Error {
  constructor(operation) {
    super(`${operation} indisponível: o backend e as regras operacionais ainda não foram integrados. Nenhum dado foi salvo.`);
    this.name = 'UniformesIntegrationError';
    this.code = 'BACKEND_NOT_CONFIGURED';
  }
}

// Pontos de integração explícitos: não enviam dados nem simulam persistência.
export async function registerUniformesLoan() {
  throw new UniformesIntegrationError('Registro de empréstimo');
}
export async function saveUniformesLoanDraft() {
  throw new UniformesIntegrationError('Salvar rascunho');
}
