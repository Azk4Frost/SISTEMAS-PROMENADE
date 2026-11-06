export function isLaundrySelectionContext(context) {
  if(!context||!['ready','not-configured'].includes(context.connection)||!Array.isArray(context.items)) return false;
  const ids=new Set();
  for(const item of context.items) {
    if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id)||typeof item.eligible!=='boolean'||!((typeof item.employee?.id==='string'&&item.employee.id)||(item.origin==='opening'&&item.employee?.id===null))||typeof item.employee.name!=='string'||typeof item.uniform?.id!=='string'||!item.uniform.id||typeof item.uniform.label!=='string'||!Number.isSafeInteger(item.availableQuantity)||item.availableQuantity<0||(item.eligible&&item.availableQuantity===0)||!Number.isSafeInteger(item.version)||item.version<1) return false;
    ids.add(item.id);
  }
  return true;
}
export const eligibleItems=(context)=>context?.connection==='ready'?context.items.filter(item=>item.eligible&&item.availableQuantity>0):[];
export const selectedLaundryItems=(context,ids)=>eligibleItems(context).filter(item=>ids.has(item.id));
export function laundrySelectionSummary(context,ids,quantities=new Map()) {
  const selected=selectedLaundryItems(context,ids);
  const valid=selected.every(item=>{const q=quantities.get(item.id)??item.availableQuantity;return Number.isSafeInteger(q)&&q>0&&q<=item.availableQuantity;});
  return {items:selected.length,types:new Set(selected.map(item=>item.uniform.id)).size,employees:new Set(selected.map(item=>item.employee.id).filter(Boolean)).size,pieces:valid?selected.reduce((n,item)=>n+(quantities.get(item.id)??item.availableQuantity),0):0,valid};
}
export function laundrySelectionPayload(context,ids,quantities=new Map()) {
  const selected=selectedLaundryItems(context,ids);
  if(!selected.length||!laundrySelectionSummary(context,ids,quantities).valid) throw Error('Selecione itens e quantidades válidas.');
  return {items:selected.map(item=>({id:item.id,quantity:quantities.get(item.id)??item.availableQuantity,version:item.version}))};
}
