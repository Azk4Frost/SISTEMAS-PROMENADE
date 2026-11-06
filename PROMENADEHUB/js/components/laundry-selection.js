import { UniformesIntegrationError } from '../services/uniformes-service.js';
import { isLaundrySelectionContext, eligibleItems, selectedLaundryItems, laundrySelectionSummary, laundrySelectionPayload } from '../modules/lavanderia-selecao-model.js';
import { uniformIcon } from '../modules/novo-emprestimo-model.js';
import { createNoticeDialog } from './dialog.js';

/** Comportamento comum às páginas independentes de envio e recebimento. */
export function mountLaundrySelection({ prefix, action, dateKey, load, submit, onSummary = () => {} }) {
  const $ = (selector) => document.querySelector(selector);
  const part = (name) => document.getElementById(`${prefix}-${name}`);
  const confirm = $(`#confirm-${prefix}`);
  const retry = $(`#retry-${prefix}`);
  const dialog = createNoticeDialog(part('dialog'));
  const selectedIds = new Set();
  const quantities = new Map();
  let context = null;
  let submitting = false;
  let allowNavigation = false;
  function node(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = String(text);
    return result;
  }
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon'); svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `../../assets/icons/ui.svg#${name}`); svg.append(use); return svg;
  }
  function updateSelection() {
    const summary = laundrySelectionSummary(context, selectedIds, quantities);
    $('#summary-items').textContent = summary.items;
    if ($('#summary-types')) $('#summary-types').textContent = summary.types;
    if ($('#summary-employees')) $('#summary-employees').textContent = summary.employees;
    $('#selected-count').textContent = `${summary.items} ${summary.items===1?'item selecionado':'itens selecionados'} · ${summary.pieces} ${summary.pieces===1?'peça':'peças'}`;
    const eligible = eligibleItems(context);
    const eligibleIds = new Set(eligible.map((item) => item.id));
    const all = $('#select-all');
    all.disabled = submitting || !eligible.length;
    all.checked = eligible.length > 0 && summary.items === eligible.length;
    all.indeterminate = summary.items > 0 && summary.items < eligible.length;
    confirm.disabled = submitting || !summary.items || !summary.valid;
    part('help').textContent = !summary.valid ? 'Informe quantidades inteiras, maiores que zero e dentro do saldo de cada item.' : summary.items ? 'Confira as quantidades antes de confirmar a movimentação.' : 'Selecione ao menos um item elegível para habilitar a confirmação.';
    document.querySelectorAll('[data-item-id]').forEach((checkbox) => {
      checkbox.checked = selectedIds.has(checkbox.dataset.itemId);
      checkbox.disabled = submitting || !eligibleIds.has(checkbox.dataset.itemId);
      checkbox.closest('tr').classList.toggle('is-selected', checkbox.checked);
      const amount = checkbox.closest('tr').querySelector('[data-quantity]');
      if(amount) { amount.disabled=submitting||!checkbox.checked; amount.setAttribute('aria-invalid',String(checkbox.checked&&!amount.checkValidity())); }
    });
    onSummary(summary, context);
  }
  function renderEmpty(title, description) {
    const row = node('tr'); const cell = node('td'); cell.colSpan = 6;
    const content = node('div', 'dispatch-empty');
    content.append(icon('washer'), node('h3', '', title), node('p', '', description));
    cell.append(content); row.append(cell); part('items').replaceChildren(row);
  }
  function renderRows() {
    const tbody = part('items'); tbody.replaceChildren();
    for (const item of context.items) {
      const row = node('tr', item.eligible ? '' : 'is-ineligible');
      const selectCell = node('td'); const checkbox = node('input'); checkbox.type = 'checkbox';
      checkbox.dataset.itemId = item.id;
      checkbox.setAttribute('aria-label', `Selecionar ${item.uniform.label}, ${item.employee.name}, empréstimo ${item.loanCode ?? 'sem código'}`);
      if (!item.eligible) { checkbox.disabled = true; checkbox.title = `Item indisponível para ${action} conforme os dados do sistema.`; }
      checkbox.addEventListener('change', () => {
        if (!item.eligible || submitting) return;
        if (checkbox.checked) selectedIds.add(item.id); else selectedIds.delete(item.id);
        updateSelection();
      });
      selectCell.append(checkbox);
      const employee = node('td'); employee.append(node('span', 'cell-primary', item.employee.name), node('span', 'cell-secondary', item.employee.department ?? ''));
      const uniform = node('td'); const label = node('div', 'dispatch-item-name');
      label.append(icon(uniformIcon(item.uniform.icon)), node('span', '', [item.uniform.label, item.uniform.size].filter(Boolean).join(' · '))); uniform.append(label);
      const quantityLabel=node('label','laundry-quantity',`Quantidade (saldo: ${item.availableQuantity})`);
      const amount=node('input'); amount.type='number'; amount.min='1'; amount.max=String(item.availableQuantity); amount.step='1'; amount.value=String(item.availableQuantity); amount.dataset.quantity=item.id; amount.required=true;
      amount.setAttribute('aria-label',`Quantidade de ${item.uniform.label}, empréstimo ${item.loanCode}`);
      amount.addEventListener('input',()=>{quantities.set(item.id,Number(amount.value));updateSelection();});
      quantities.set(item.id,item.availableQuantity); quantityLabel.append(amount); uniform.append(quantityLabel);
      const rawDate = item[dateKey];
      const date = typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate.split('-').reverse().join('/') : '—';
      const status = node('td');
      const tone = ['blue', 'purple', 'green', 'amber'].includes(item.status?.tone) ? item.status.tone : 'neutral';
      status.append(node('span', `dispatch-status tone-${tone}`, item.status?.label || 'Status não informado'));
      if (!item.eligible) status.append(node('span', 'cell-secondary', `Indisponível para ${action}`));
      row.append(selectCell, node('td', 'cell-code', item.loanCode ?? '—'), employee, uniform, node('td', '', date), status);
      tbody.append(row);
    }
  }
  async function loadItems() {
    part('panel').setAttribute('aria-busy', 'true');
    retry.hidden = true;
    part('notice').querySelector('span').textContent = `Consultando os itens disponíveis para ${action}…`;
    part('notice').classList.remove('is-error');
    selectedIds.clear(); quantities.clear(); context = null; updateSelection();
    try {
      const result = await load();
      if (!isLaundrySelectionContext(result)) throw new Error('Resposta inválida');
      context = result;
      if (context.connection !== 'ready') {
        renderEmpty('Nenhum item disponível para consulta', 'Os itens serão exibidos após a integração com os dados operacionais do clube.');
        part('notice').querySelector('span').textContent = `Integração pendente. Nenhum empréstimo ou saldo real está conectado; o ${action} ainda não pode ser registrado.`;
        part('connection').textContent = 'Integração de dados pendente';
      } else {
        if (!context.items.length) renderEmpty('Nenhum item para exibir', 'A consulta não retornou itens para esta página.');
        else {
          renderRows();
          const requested=new URLSearchParams(window.location.search).get('item');
          if(requested&&eligibleItems(context).some(item=>item.id===requested)) selectedIds.add(requested);
        }
        part('notice').querySelector('span').textContent = eligibleItems(context).length ? `Selecione os itens para preparar o ${action}. Nenhuma movimentação é realizada ao selecionar.` : 'Nenhum item está disponível para seleção nos dados consultados.';
        part('connection').textContent = 'Dados consultados';
      }
    } catch {
      context = null;
      renderEmpty('Não foi possível consultar os itens', 'Não foi possível atualizar a lista. Verifique o servidor e tente novamente.');
      part('notice').querySelector('span').textContent = 'Falha na consulta dos dados. Tente novamente.';
      part('notice').classList.add('is-error');
      part('connection').textContent = 'Falha na consulta';
      retry.hidden = false;
    } finally {
      const count = context?.connection === 'ready' ? context.items.length : 0;
      part('results').textContent = `Mostrando ${count} ${count === 1 ? 'registro' : 'registros'}`;
      updateSelection(); part('panel').setAttribute('aria-busy', 'false');
    }
  }
  $('#select-all').addEventListener('change', (event) => {
    selectedIds.clear();
    if (event.target.checked) eligibleItems(context).forEach((item) => selectedIds.add(item.id));
    updateSelection();
  });
  retry.addEventListener('click', loadItems);
  confirm.addEventListener('click', async () => {
    if (submitting || !selectedLaundryItems(context, selectedIds).length) return;
    submitting = true; updateSelection();
    try {
      const payload=laundrySelectionPayload(context,selectedIds,quantities);
      const result=await submit(payload);
      if(result?.processed!==payload.items.length) throw Error('Confirmação inválida');
      await loadItems();
      part('panel').setAttribute('tabindex','-1');
      dialog.open({title:action==='envio'?'Envio registrado':'Recebimento registrado',description:'A movimentação foi gravada no banco e os saldos foram atualizados.',detail:'Dados salvos.',origin:part('panel')});
    } catch (error) {
      dialog.open({
        title: `${action === 'envio' ? 'Envio' : 'Recebimento'} não confirmado`,
        description: error instanceof UniformesIntegrationError ? error.message : `Não foi possível confirmar o ${action}. A seleção foi preservada; nenhuma alteração foi confirmada.`,
        detail: 'O resultado não foi confirmado. A seleção foi preservada.',
        origin: confirm
      });
    } finally { submitting = false; updateSelection(); }
  });
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || link.getAttribute('href').startsWith('#') || !selectedIds.size || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    dialog.open({
      title: 'Descartar seleção?', description: 'A seleção desta página ainda não foi confirmada. Deseja descartá-la e sair?',
      detail: 'A seleção atual será descartada desta página. Confira os registros no painel.', confirmLabel: 'Descartar e sair', origin: link,
      onConfirm() { allowNavigation = true; window.location.assign(link.href); }
    });
  });
  window.addEventListener('beforeunload', (event) => {
    if (selectedIds.size && !allowNavigation) { event.preventDefault(); event.returnValue = ''; }
  });
  loadItems();
}
