import { loadUniformesDashboard, returnUniformes } from '../../js/services/uniformes-service.js';
import { filterLoans, isDateRangeValid } from '../../js/modules/uniformes-filters.js';
import { createNoticeDialog } from '../../js/components/dialog.js';

const $ = (selector) => document.querySelector(selector);
const body = $('#loans-body');
const panel = $('.loans-panel');
const filterForm = $('#extra-filters');
const filtersToggle = $('#toggle-filters');
const returnDialog=createNoticeDialog($('#return-dialog'));
let returning=false;
const allRecordsView = document.body.dataset.loanView === 'all';
const previewLimit = 6;
const filterParameters = { search: 'q', status: 'status', uniform: 'uniform', 'start-date': 'start', 'end-date': 'end' };
const statusLabels = {
  'com-funcionario': ['Com Funcionário', 'tone-blue'],
  'em-devolucao': ['Em Devolução', 'tone-amber'],
  'na-lavanderia': ['Na Lavanderia', 'tone-purple'],
  'limpo-disponivel': ['Limpo / Disponível', 'tone-green']
};
let dashboard = null;
let loadingFailed = false;
let restoredCatalogFilter = false;

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
};
const quantity = (value) => Number.isSafeInteger(value) && value >= 0 ? String(value).padStart(2, '0') : '—';

function updateViewLink() {
  const destination = new URL(allRecordsView ? './index.html' : './todos-emprestimos.html', window.location.href);
  for (const [id, parameter] of Object.entries(filterParameters)) {
    const value = $(`#${id}`).value;
    if (value) destination.searchParams.set(parameter, value);
  }
  $('#loans-view-link').href = destination.href;
}

function restoreFiltersFromUrl() {
  const parameters = new URLSearchParams(window.location.search);
  for (const [id, parameter] of Object.entries(filterParameters)) {
    const value = parameters.get(parameter);
    if (value !== null) $(`#${id}`).value = id === 'search' ? value.slice(0, 120) : value;
  }
  if (['#uniform', '#start-date', '#end-date'].some((selector) => $(selector).value)) {
    filterForm.hidden = false;
    filtersToggle.setAttribute('aria-expanded', 'true');
    filtersToggle.querySelector('span').textContent = 'Ocultar Filtros';
  }
}

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
  if(loan.origin==='opening') person.append(element('span','cell-secondary','Saldo inicial · registro de abertura'));
  if(loan.responsibleName) person.append(element('span','cell-secondary',`Entregou: ${loan.responsibleName}`));
  else if(loan.origin==='opening') person.append(element('span','cell-secondary','Entrega original não informada'));
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
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date) : '—';
  const actions = element('td','cell-action-note');
  if(loan.returnableQuantity>0) {
    const button=element('button','button button-return','Devolver sujo'); button.type='button';
    button.addEventListener('click',()=>openReturn(loan,button)); actions.append(button);
  } else if(loan.status==='em-devolucao'||loan.status==='na-lavanderia') {
    const link=element('a','button button-secondary',loan.status==='em-devolucao'?'Enviar p/ Lavanderia':'Receber da Lavanderia');
    link.href=`./${loan.status==='em-devolucao'?'enviar':'receber'}-lavanderia.html?item=${encodeURIComponent(loan.lineId)}`;actions.append(link);
  } else actions.textContent='Ciclo concluído';
  row.append(person, items, status, updated, actions);
  return row;
}

function openReturn(loan,origin) {
  if(returning) return;
  const input=$('#return-quantity'); input.setCustomValidity(''); input.value=String(loan.returnableQuantity); input.max=String(loan.returnableQuantity);
  $('#return-quantity-fields').hidden=false;
  returnDialog.open({title:'Devolver uniforme sujo',description:`${loan.code}: informe quantas peças retornaram do funcionário. Saldo com o funcionário: ${loan.returnableQuantity}.`,detail:'Peças devolvidas sujas só voltam ao saldo disponível após a lavanderia.',confirmLabel:'Registrar devolução',origin,
    validate:()=>{const value=Number(input.value);input.setCustomValidity(Number.isSafeInteger(value)&&value>0&&value<=loan.returnableQuantity?'':`Informe uma quantidade inteira entre 1 e ${loan.returnableQuantity}.`);return input.reportValidity();},
    onConfirm:async()=>{
      returning=true; origin.disabled=true;
      try {
        const result=await returnUniformes({items:[{id:loan.lineId,quantity:Number(input.value),version:loan.version}]});
        if(result?.processed!==1) throw Error('Confirmação inválida');
        await loadDashboard(); $('#return-quantity-fields').hidden=true;
        panel.setAttribute('tabindex','-1');
        returnDialog.open({title:'Devolução registrada',description:'A devolução suja foi salva. As peças estão disponíveis para envio à lavanderia.',detail:'Dados salvos.',origin:panel});
      } catch(error) {
        $('#return-quantity-fields').hidden=true;
        returnDialog.open({title:'Devolução não confirmada',description:error.message||'Não foi possível confirmar a operação.',detail:'O resultado ainda não foi confirmado.',origin});
      } finally { returning=false; origin.disabled=false; }
    }
  });
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
  const visibleLoans = allRecordsView ? filtered : filtered.slice(0, previewLimit);
  $('#results-count').textContent = `Mostrando ${visibleLoans.length} de ${filtered.length} resultados (${loans.length} registros carregados)`;
  updateViewLink();
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
    body.replaceChildren(...visibleLoans.map(renderLoan));
  }
}

function renderSummary() {
  const connected = dashboard?.connection === 'ready';
  if(connected) {
    for(const item of dashboard.inventory??[]) {
      let option=[...$('#uniform').options].find(entry=>entry.value===item.id);
      if(!option) { option=new Option(item.label,item.id); $('#uniform').append(option); }
      else option.textContent=item.label;
    }
    if(!restoredCatalogFilter) {
      const requested=new URLSearchParams(window.location.search).get('uniform');
      if(requested&&[...$('#uniform').options].some(entry=>entry.value===requested)) {$('#uniform').value=requested;filterForm.hidden=false;filtersToggle.setAttribute('aria-expanded','true');filtersToggle.querySelector('span').textContent='Ocultar Filtros';}
      restoredCatalogFilter=true;
    }
  }
  document.querySelectorAll('[data-uniform]').forEach((card) => {
    const stock = connected ? dashboard.inventory?.find((item) => item.id === card.dataset.uniform) : null;
    if(stock?.label) card.querySelector('h2').textContent=stock.label.toLocaleUpperCase('pt-BR');
    card.title=stock?'Em estoque: peças limpas disponíveis mais peças devolvidas sujas na portaria.':'Modelo ainda não cadastrado.';
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
    : connected ? (dashboard.loans.some(loan=>loan.origin==='opening')?`Dados consultados. INICIAL identifica saldos de abertura, sem recriar empréstimos antigos. Saldo inicial com funcionários: ${dashboard.indicators?.openingHeldPieces??0} peças.`:'Dados carregados. Os filtros consultam os registros exibidos nesta página.')
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

restoreFiltersFromUrl();
loadDashboard();
