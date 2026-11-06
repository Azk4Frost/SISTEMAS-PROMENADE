export function isLaundrySelectionContext(context) {
  if (!context || !['ready', 'not-configured'].includes(context.connection) || !Array.isArray(context.items)) return false;
  const ids = new Set();
  for (const item of context.items) {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.eligible !== 'boolean' ||
        typeof item.employee?.id !== 'string' || !item.employee.id || typeof item.employee.name !== 'string' ||
        typeof item.uniform?.id !== 'string' || !item.uniform.id || typeof item.uniform.label !== 'string') return false;
    ids.add(item.id);
  }
  return true;
}
export const eligibleItems = (context) => context?.connection === 'ready' ? context.items.filter((item) => item.eligible) : [];
export function selectedLaundryItems(context, selectedIds) {
  return eligibleItems(context).filter((item) => selectedIds.has(item.id));
}
export function laundrySelectionSummary(context, selectedIds) {
  const selected = selectedLaundryItems(context, selectedIds);
  return {
    items: selected.length,
    types: new Set(selected.map((item) => item.uniform.id)).size,
    employees: new Set(selected.map((item) => item.employee.id)).size
  };
}
export function laundrySelectionPayload(context, selectedIds) {
  const selected = selectedLaundryItems(context, selectedIds);
  if (!selected.length) throw new Error('Selecione ao menos um item elegível.');
  return { itemIds: selected.map((item) => item.id) };
}
