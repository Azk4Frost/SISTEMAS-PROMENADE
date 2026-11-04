import { loadNewLoanContext, registerUniformesLoan, saveUniformesLoanDraft, UniformesIntegrationError } from '../../js/services/uniformes-service.js';
import { isLoanContext, validateLoanItem, buildLoanItem, validateLoanDetails, formItemTotals, loanPayload, uniformIcon } from '../../js/modules/novo-emprestimo-model.js';
import { createNoticeDialog } from '../../js/components/dialog.js';

const $ = (selector) => document.querySelector(selector);
const form = $('#loan-form');
const dialog = createNoticeDialog($('#loan-dialog'));
const itemFields = ['uniform-type', 'color', 'size', 'quantity', 'condition'];
const detailFields = ['loan-date', 'employee', 'sector', 'responsible'];
let context = null;
let items = [];
let editingId = null;
let nextItemId = 1;
let baseline = '';
let allowNavigation = false;
let saving = false;

function node(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = String(text);
  return result;
}
function icon(name, className = 'icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `../../assets/icons/ui.svg#${name}`);
  svg.append(use);
  return svg;
}
function options(selector, records, placeholder, emptyLabel = placeholder) {
  const select = $(selector);
  select.replaceChildren(new Option(records.length ? placeholder : emptyLabel, ''));
  for (const record of records) select.append(new Option(record.label, record.id));
  select.disabled = !records.length;
}
function getDetails() {
  return { date: $('#loan-date').value, employeeId: $('#employee').value, sectorId: $('#sector').value, responsibleId: $('#responsible').value, notes: $('#notes').value };
}
function getItemValues() {
  return { uniformId: $('#uniform-type').value, color: $('#color').value, size: $('#size').value, quantity: $('#quantity').value, conditionId: $('#condition').value };
}
const signature = () => JSON.stringify({ ...getDetails(), composer: getItemValues(), items });
const isDirty = () => baseline !== '' && signature() !== baseline;
function showNotice(title, description, origin) {
  dialog.open({ title, description, origin });
}
function missingContext(origin) {
  showNotice('Cadastros indisponíveis', 'Não é possível adicionar peças sem os cadastros de uniformes, variações e condições. A integração com os dados reais do clube ainda está pendente.', origin);
}
function clearErrors(ids) {
  for (const id of ids) {
    const control = $(`#${id}`);
    if (control) control.removeAttribute('aria-invalid');
    const error = $(`#${id}-error`);
    if (error) { error.hidden = true; error.textContent = ''; }
  }
}
function showErrors(errors) {
  for (const [id, message] of Object.entries(errors)) {
    const control = $(`#${id}`);
    if (control) control.setAttribute('aria-invalid', 'true');
    const error = $(`#${id}-error`);
    if (error) { error.hidden = false; error.textContent = message; }
  }
  const firstId = Object.keys(errors)[0];
  if (firstId === 'items') $('#add-item').focus();
  else $(`#${firstId}`)?.focus();
}
function selectedUniform() {
  return context?.uniforms.find((uniform) => uniform.id === $('#uniform-type').value);
}
function updateColors() {
  const colors = [...new Set((selectedUniform()?.variants ?? []).map((entry) => entry.color))];
  options('#color', colors.map((value) => ({ id: value, label: value })), 'Selecione');
  updateSizes();
}
function updateSizes() {
  const sizes = (selectedUniform()?.variants ?? []).filter((entry) => entry.color === $('#color').value).map((entry) => entry.size);
  options('#size', sizes.map((value) => ({ id: value, label: value })), 'Selecione');
}
function resetComposer() {
  editingId = null;
  $('#uniform-type').value = '';
  updateColors();
  $('#quantity').value = '1';
  $('#condition').value = '';
  $('#editing-notice').hidden = true;
  $('#add-item span').textContent = 'Adicionar Item';
  clearErrors(itemFields);
}
function updateSummary() {
  const details = getDetails();
  $('#summary-employee').textContent = context?.employees.find((entry) => entry.id === details.employeeId)?.name ?? 'Não selecionado';
  $('#summary-sector').textContent = context?.sectors.find((entry) => entry.id === details.sectorId)?.label ?? 'Não selecionado';
  const totals = formItemTotals(items);
  $('#summary-items').textContent = totals.count;
  $('#summary-quantity').textContent = totals.quantity;
  $('#summary-date').textContent = /^\d{4}-\d{2}-\d{2}$/.test(details.date) ? details.date.split('-').reverse().join('/') : '—';
}
function editItem(item) {
  editingId = item.id;
  $('#uniform-type').value = item.uniformId;
  updateColors();
  $('#color').value = item.color;
  updateSizes();
  $('#size').value = item.size;
  $('#quantity').value = String(item.quantity);
  $('#condition').value = item.conditionId;
  clearErrors(itemFields);
  $('#editing-notice').hidden = false;
  $('#add-item span').textContent = 'Salvar item';
  $('#uniform-type').focus();
  $('#form-status').textContent = 'Edição de item em andamento; nenhuma alteração foi registrada.';
}
function removeItem(item, origin) {
  dialog.open({
    title: 'Remover item?', description: `Remover “${item.name}” da lista deste formulário?`,
    detail: 'O formulário ainda não está registrado. Nenhuma movimentação de estoque será realizada.',
    confirmLabel: 'Remover item', origin,
    onConfirm() {
      items = items.filter((entry) => entry.id !== item.id);
      if (editingId === item.id) resetComposer();
      renderItems();
      updateSummary();
      $('#form-status').textContent = 'Item removido do formulário. Nenhuma movimentação de estoque foi realizada.';
      $('#add-item').focus();
    }
  });
}
function renderItems() {
  const tbody = $('#loan-items');
  tbody.replaceChildren();
  if (!items.length) {
    const row = node('tr'); const cell = node('td'); cell.colSpan = 5;
    const empty = node('div', 'loan-empty');
    empty.append(icon('clipboard'), node('strong', '', 'Nenhum item adicionado'), node('p', '', 'Selecione os dados da peça e clique em Adicionar Item.'));
    cell.append(empty); row.append(cell); tbody.append(row); return;
  }
  for (const item of items) {
    const row = node('tr');
    const name = node('td'); const nameContent = node('div', 'loan-item-name');
    const labels = node('span', '', item.name); labels.append(node('small', '', item.color));
    nameContent.append(icon(item.icon), labels); name.append(nameContent);
    const condition = node('td'); condition.append(node('span', 'loan-item-condition', item.conditionLabel));
    const actionsCell = node('td'); const actions = node('div', 'loan-row-actions');
    const edit = node('button', 'loan-icon-button'); edit.type = 'button'; edit.setAttribute('aria-label', `Editar ${item.name}`); edit.append(icon('edit')); edit.addEventListener('click', () => editItem(item));
    const remove = node('button', 'loan-icon-button is-remove'); remove.type = 'button'; remove.setAttribute('aria-label', `Remover ${item.name}`); remove.append(icon('trash')); remove.addEventListener('click', () => removeItem(item, remove));
    actions.append(edit, remove); actionsCell.append(actions);
    row.append(name, node('td', '', item.size), node('td', '', item.quantity), condition, actionsCell);
    tbody.append(row);
  }
}
function renderAvailability() {
  const target = $('#loan-availability'); target.replaceChildren();
  if (context?.connection !== 'ready' || !context.uniforms.length) {
    target.append(node('p', 'loan-sidebar-empty', context?.connection === 'ready' ? 'Nenhum uniforme cadastrado para consulta.' : 'Disponibilidade indisponível. Aguardando integração com o estoque.'));
    return;
  }
  for (const uniform of context.uniforms) {
    const line = node('div', 'loan-stock-line'); const label = node('span');
    label.append(icon(uniformIcon(uniform.icon)), node('span', '', uniform.label));
    const available = Number.isSafeInteger(uniform.available) && uniform.available >= 0 ? String(uniform.available) : '—';
    line.append(label, node('strong', '', `Disponível: ${available}`)); target.append(line);
  }
}
async function loadContext() {
  form.setAttribute('aria-busy', 'true');
  $('#retry-context').hidden = true;
  $('#loan-context-notice').classList.remove('is-error');
  $('#loan-context-notice span').textContent = 'Consultando cadastros e disponibilidade…';
  let failed = false;
  try {
    const result = await loadNewLoanContext();
    if (!isLoanContext(result)) throw new Error('Resposta de cadastros inválida');
    context = result;
  } catch {
    context = null; failed = true;
  }
  const connected = context?.connection === 'ready';
  options('#employee', connected ? context.employees.map((entry) => ({ id: entry.id, label: entry.registration ? `${entry.name} · ${entry.registration}` : entry.name })) : [], 'Selecione o funcionário', connected ? 'Nenhum funcionário cadastrado' : 'Cadastros indisponíveis');
  options('#sector', connected ? context.sectors : [], 'Selecione o setor', connected ? 'Nenhum setor cadastrado' : 'Cadastros indisponíveis');
  options('#responsible', connected ? context.responsibles : [], 'Selecione o responsável', connected ? 'Nenhum responsável cadastrado' : 'Cadastros indisponíveis');
  options('#uniform-type', connected ? context.uniforms : [], 'Selecione o tipo', connected ? 'Sem uniformes' : 'Sem catálogo');
  options('#condition', connected ? context.conditions : [], 'Selecione a condição', connected ? 'Nenhuma condição cadastrada' : 'Condições indisponíveis');
  updateColors();
  const message = failed ? 'Não foi possível consultar os cadastros. Tente novamente; nenhum dado foi salvo.' : connected ? 'Cadastros consultados. O preenchimento não reserva peças nem registra um empréstimo.' : 'Integração pendente. Cadastros e estoque indisponíveis; registrar e salvar rascunho ainda não estão disponíveis.';
  $('#loan-context-notice span').textContent = message;
  $('#loan-context-notice').classList.toggle('is-error', failed);
  $('#retry-context').hidden = !failed;
  $('#loan-connection').textContent = failed ? 'Falha na consulta' : connected ? 'Cadastros consultados' : 'Integração de dados pendente';
  renderAvailability(); updateSummary();
  form.setAttribute('aria-busy', 'false');
  if (!baseline) baseline = signature();
}

$('#add-item').addEventListener('click', () => {
  if (context?.connection !== 'ready') { missingContext($('#add-item')); return; }
  clearErrors([...itemFields, 'items']);
  const values = getItemValues();
  const errors = validateLoanItem(values, context);
  if (Object.keys(errors).length) { showErrors(errors); return; }
  const wasEditing = editingId !== null;
  const item = buildLoanItem(values, context, editingId ?? `form-item-${nextItemId++}`);
  if (wasEditing) items = items.map((entry) => entry.id === editingId ? item : entry);
  else items.push(item);
  resetComposer(); renderItems(); updateSummary();
  $('#form-status').textContent = wasEditing ? 'Item atualizado somente no formulário. Nenhum dado foi salvo.' : 'Item adicionado somente ao formulário. Nenhum dado foi salvo.';
  $('#add-item').focus();
});
$('#cancel-edit').addEventListener('click', () => {
  resetComposer(); $('#add-item').focus();
  $('#form-status').textContent = 'Edição cancelada. O item permanece sem alterações na lista do formulário.';
});
$('#uniform-type').addEventListener('change', updateColors);
$('#color').addEventListener('change', updateSizes);
form.addEventListener('input', (event) => {
  if (event.target.id) clearErrors([event.target.id]);
  updateSummary();
});
$('#retry-context').addEventListener('click', loadContext);

async function persist(mode, origin) {
  if (saving) return;
  clearErrors([...detailFields, 'items']);
  if (editingId !== null) {
    showNotice('Edição de item em andamento', 'Salve ou cancele a edição do item antes de continuar. Nenhum dado foi salvo.', origin); return;
  }
  const values = getDetails();
  if (mode === 'register' && context?.connection === 'ready') {
    const errors = validateLoanDetails(values, context, items);
    if (Object.keys(errors).length) { showErrors(errors); return; }
  }
  saving = true;
  $('#register-loan').disabled = true; $('#save-draft').disabled = true;
  try {
    const operation = mode === 'register' ? registerUniformesLoan : saveUniformesLoanDraft;
    await operation(loanPayload(values, items));
    // O serviço atual sempre rejeita: a integração e sua confirmação são uma etapa futura.
  } catch (error) {
    showNotice(error instanceof UniformesIntegrationError ? 'Integração pendente' : 'Não foi possível salvar', error instanceof UniformesIntegrationError ? error.message : 'Não foi possível concluir a operação. Os campos permanecem no formulário; nenhum salvamento foi confirmado.', origin);
  } finally {
    saving = false;
    $('#register-loan').disabled = false; $('#save-draft').disabled = false;
  }
}
form.addEventListener('submit', (event) => { event.preventDefault(); persist('register', $('#register-loan')); });
$('#save-draft').addEventListener('click', () => persist('draft', $('#save-draft')));

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link || link.getAttribute('href').startsWith('#') || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !isDirty()) return;
  event.preventDefault();
  dialog.open({
    title: 'Descartar preenchimento?', description: 'As alterações deste formulário ainda não foram salvas. Deseja descartá-las e sair desta página?',
    detail: 'Nenhum empréstimo foi registrado.', confirmLabel: 'Descartar e sair', origin: link,
    onConfirm() { allowNavigation = true; window.location.assign(link.href); }
  });
});
window.addEventListener('beforeunload', (event) => {
  if (isDirty() && !allowNavigation) { event.preventDefault(); event.returnValue = ''; }
});

// Data inicial no fuso da portaria; não impõe restrições de negócio sobre datas.
const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((part) => [part.type, part.value]));
$('#loan-date').value = `${parts.year}-${parts.month}-${parts.day}`;
loadContext();
