/** Estado de edição do formulário; não representa empréstimos registrados. */
const allowedIcons = new Set(['apron', 'shirt-yellow', 'shirt-white', 'pants']);
export const uniformIcon = (icon) => allowedIcons.has(icon) ? icon : 'clipboard';
export const isPositiveQuantity = (value) => String(value).trim() !== '' && Number.isSafeInteger(Number(value)) && Number(value) > 0;
const findById = (list, id) => list.find((item) => item.id === id);

export function isLoanContext(context) {
  if (!context || !['ready', 'not-configured'].includes(context.connection)) return false;
  for (const key of ['employees', 'sectors', 'responsibles', 'conditions', 'uniforms']) {
    if (!Array.isArray(context[key])) return false;
    const ids = new Set();
    for (const item of context[key]) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) return false;
      ids.add(item.id);
      const label = key === 'employees' ? item.name : item.label;
      if (typeof label !== 'string' || !label.trim()) return false;
      if (key === 'uniforms') {
        if (!Array.isArray(item.variants)) return false;
        const variants = new Set();
        const combinations = new Set();
        for (const variant of item.variants) {
          if (!variant || typeof variant.id !== 'string' || !variant.id || variants.has(variant.id) ||
              typeof variant.color !== 'string' || !variant.color || typeof variant.size !== 'string' || !variant.size) return false;
          const combination = JSON.stringify([variant.color, variant.size]);
          if (combinations.has(combination)) return false;
          combinations.add(combination);
          variants.add(variant.id);
        }
      }
    }
  }
  return true;
}

export function validateLoanItem(values, context) {
  const errors = {};
  const uniform = findById(context.uniforms, values.uniformId);
  if (!uniform) errors['uniform-type'] = 'Selecione um tipo de uniforme cadastrado.';
  const variants = uniform?.variants ?? [];
  if (!values.color || !variants.some((variant) => variant.color === values.color)) errors.color = 'Selecione uma cor do catálogo.';
  if (!values.size || !variants.some((variant) => variant.color === values.color && variant.size === values.size)) errors.size = 'Selecione um tamanho desta peça.';
  if (!isPositiveQuantity(values.quantity)) errors.quantity = 'Informe uma quantidade inteira maior que zero.';
  if (!findById(context.conditions, values.conditionId)) errors.condition = 'Selecione uma condição cadastrada.';
  return errors;
}

export function buildLoanItem(values, context, id) {
  if (Object.keys(validateLoanItem(values, context)).length) throw new Error('Item inválido');
  const uniform = findById(context.uniforms, values.uniformId);
  const variant = uniform.variants.find((entry) => entry.color === values.color && entry.size === values.size);
  const condition = findById(context.conditions, values.conditionId);
  return {
    id, uniformId: uniform.id, variantId: variant.id, name: uniform.label,
    icon: uniformIcon(uniform.icon), color: variant.color, size: variant.size,
    quantity: Number(values.quantity), conditionId: condition.id, conditionLabel: condition.label
  };
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateLoanDetails(values, context, items) {
  const errors = {};
  if (!isCalendarDate(values.date ?? '')) errors['loan-date'] = 'Informe uma data válida para o empréstimo.';
  if (!findById(context.employees, values.employeeId)) errors.employee = 'Selecione um funcionário cadastrado.';
  if (!findById(context.sectors, values.sectorId)) errors.sector = 'Selecione um setor cadastrado.';
  if (!findById(context.responsibles, values.responsibleId)) errors.responsible = 'Selecione o responsável.';
  if (!items.length) errors.items = 'Adicione ao menos um item ao formulário.';
  return errors;
}

/** Apenas soma as quantidades digitadas; não calcula estoque ou regras do ciclo. */
export function formItemTotals(items) {
  return { count: items.length, quantity: items.reduce((sum, item) => sum + BigInt(item.quantity), 0n).toString() };
}

export function loanPayload(values, items) {
  return {
    date: values.date, employeeId: values.employeeId, sectorId: values.sectorId,
    responsibleId: values.responsibleId, notes: String(values.notes ?? '').trim(),
    items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity, conditionId: item.conditionId }))
  };
}
