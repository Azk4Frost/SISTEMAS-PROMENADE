import { loadUniformesDashboard } from '../../js/services/uniformes-service.js';
import { filterLoans, isDateRangeValid } from '../../js/modules/uniformes-filters.js';
import { createNoticeDialog } from '../../js/components/dialog.js';

const $ = (selector) => document.querySelector(selector);
const body = $('#loans-body');
const panel = $('.loans-panel');
const filterForm = $('#extra-filters');
const filtersToggle = $('#toggle-filters');
const notice = createNoticeDialog($('#pending-dialog'));
const statusLabels = {
  'com-funcionario': ['Com Funcionário', 'tone-blue'],
  'em-devolucao': ['Em Devolução', 'tone-amber'],
  'na-lavanderia': ['Na Lavanderia', 'tone-purple'],
  'limpo-disponivel': ['Limpo / Disponível', 'tone-green']
};
let dashboard = null;
let loadingFailed = false;

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
};
const quantity = (value) => Number.isSafeInteger(value) && value >= 0 ? String(value).padStart(2, '0') : '—';

function getFilters() {
  return {
    query: $('#search').value,
    status: $('#status').value,
    uniform: $('#uniform').value,
    startDate: $('#start-date').value,
    endDate: $('#end-date').value
  };
}

function resetFilters() {
  const focusWillBeRemoved = body.contains(document.activeElement);
  for (const selector of ['#search', '#status', '#uniform', '#start-date', '#end-date']) $(selector).value = '';
  renderLoans();
  if (focusWillBeRemoved) $('#search').focus();
}

function showEmpty(title, description, { reset = false, retry = false } = {}) {
  const row = element('tr');
  const cell = element('td');
  cell.colSpan = 6;
  const content = element('div', 'empty-state');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '../../assets/icons/ui.svg#clipboard');
  svg.append(use);
  content.append(svg, element('h3', '', title), element('p', '', description));
  if (reset || retry) {
    const button = element('button', 'button button-secondary', retry ? 'Tentar novamente' : 'Limpar filtros');
    button.type = 'button';
    button.addEventListener('click', retry ? loadDashboard : resetFilters);
    content.append(button);
  }
  cell.append(content);
  row.append(cell);
  body.replaceChildren(row);
}

function renderLoan(loan) {
  const row = element('tr');
  const employee = loan.employee ?? {};
  row.append(element('td', 'cell-code', loan.code ?? '—'));
  const person = element('td');
  person.append(element('span', 'cell-primary', employee.name ?? '—'));
  const details = [employee.registration, employee.department].filter(Boolean).join(' · ');
  person.append(element('span', 'cell-secondary', details));
  const items = element('td');
  for (const item of loan.items ?? []) {
    const label = [item.label, item.size].filter(Boolean).join(' · ');
    items.append(element('span', 'cell-secondary', `${quantity(item.quantity)} × ${label || 'Uniforme'}`));
  }
  const status = element('td');
  const [label, color] = statusLabels[loan.status] ?? ['Status não informado', ''];
  status.append(element('span', `status-badge ${color}`, label));
  const updated = element('td');
  const date = loan.updatedAt ? new Date(loan.updatedAt) : null;
  updated.textContent = date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date) : '—';
  // Nenhuma operação ou transição é inferida antes da definição das regras.
  const actions = element('td', 'cell-secondary', 'Operações pendentes');
  row.append(person, items, status, updated, actions);
  return row;
}

function renderLoans() {
  const filters = getFilters();
  const validRange = isDateRangeValid(filters);
  $('#filter-error').hidden = validRange;
  $('#end-date').setAttribute('aria-invalid', String(!validRange));
  if (!validRange) $('#end-date').setAttribute('aria-describedby', 'filter-error');
  else $('#end-date').removeAttribute('aria-describedby');
  const activeFilters = Object.values(filters).some((value) => value.trim());
  const loans = dashboard?.loans ?? [];
  const filtered = filterLoans(loans, filters);
  $('#results-count').textContent = `Mostrando ${filtered.length} de ${loans.length} registros carregados`;
  if (loadingFailed) {
    showEmpty('Não foi possível carregar os dados', 'Tente novamente. Nenhum valor de estoque ou empréstimo foi presumido.', { retry: true });
  } else if (!validRange) {
    showEmpty('Revise o período informado', 'A data final deve ser igual ou posterior à data inicial.', { reset: true });
  } else if (dashboard?.connection !== 'ready') {
    showEmpty('Nenhum registro disponível', 'Os empréstimos serão exibidos após a integração com os dados operacionais do clube.', { reset: activeFilters });
  } else if (!loans.length) {
    showEmpty('Nenhum empréstimo cadastrado', 'Não há registros de empréstimos para exibir.', { reset: activeFilters });
  } else if (!filtered.length) {
    showEmpty('Nenhum resultado encontrado', 'Ajuste a pesquisa ou limpe os filtros para visualizar os registros.', { reset: true });
  } else {
    body.replaceChildren(...filtered.map(renderLoan));
  }
}

function renderSummary() {
  const connected = dashboard?.connection === 'ready';
  document.querySelectorAll('[data-uniform]').forEach((card) => {
    const stock = connected ? dashboard.inventory?.find((item) => item.id === card.dataset.uniform) : null;
    card.querySelector('[data-available]').textContent = quantity(stock?.available);
    card.querySelector('[data-total]').textContent = quantity(stock?.inStock);
    const total = card.querySelector('[data-garment-total]');
    if (total) total.textContent = quantity(stock?.total);
  });
  document.querySelectorAll('[data-indicator]').forEach((node) => {
    node.textContent = quantity(connected ? dashboard.indicators?.[node.dataset.indicator] : null);
  });
  $('#connection-label').textContent = loadingFailed ? 'Falha na consulta' : connected ? 'Dados consultados' : 'Integração de dados pendente';
  const message = loadingFailed ? 'Falha ao consultar os dados. Tente novamente.'
    : connected ? 'Dados carregados. Os filtros consultam os registros exibidos nesta página.'
    : 'Dados operacionais ainda não conectados. Os traços (—) indicam valores indisponíveis, não estoque zerado.';
  $('#data-notice span').textContent = message;
  $('#data-notice').classList.toggle('is-error', loadingFailed);
}

async function loadDashboard() {
  panel.setAttribute('aria-busy', 'true');
  loadingFailed = false;
  try {
    const result = await loadUniformesDashboard();
    if (!result || !['ready', 'not-configured'].includes(result.connection) || !Array.isArray(result.loans)) {
      throw new Error('Resposta de dados inválida');
    }
    dashboard = result;
  } catch {
    dashboard = null;
    loadingFailed = true;
  } finally {
    renderSummary();
    renderLoans();
    panel.setAttribute('aria-busy', 'false');
  }
}

filtersToggle.addEventListener('click', () => {
  const expanded = filtersToggle.getAttribute('aria-expanded') !== 'true';
  filtersToggle.setAttribute('aria-expanded', String(expanded));
  filtersToggle.querySelector('span').textContent = expanded ? 'Ocultar Filtros' : 'Ver Filtros';
  filterForm.hidden = !expanded;
});
for (const selector of ['#search', '#status', '#uniform', '#start-date', '#end-date']) {
  $(selector).addEventListener('input', renderLoans);
}
filterForm.addEventListener('submit', (event) => event.preventDefault());
filterForm.addEventListener('reset', (event) => { event.preventDefault(); resetFilters(); });
document.querySelectorAll('[data-pending]').forEach((button) => {
  button.title = `${button.dataset.pending}: página pendente de desenvolvimento`;
  button.addEventListener('click', () => notice.open({
    title: button.dataset.pending,
    description: 'Esta página de lavanderia ainda não foi desenvolvida. As operações dependem das próximas páginas e da integração com o backend.',
    origin: button
  }));
});

loadDashboard();
