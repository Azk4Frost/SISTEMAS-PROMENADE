// Apenas para testes automatizados; não importar no servidor ou frontend de produção.
export function catalog(quantity=10) {
  return {sectors:[{id:'setor-teste',label:'Setor exclusivo de teste'}],employees:[{id:'pessoa-teste',name:'Pessoa exclusiva de teste',registration:'TESTE-001'}],responsibles:[{id:'operador-teste',label:'Operador exclusivo de teste'}],uniforms:[{id:'camisa-branca',label:'Camisa exclusiva de teste',icon:'shirt-white',variants:[{id:'variante-teste',color:'Cor de teste',size:'M',quantity}]}]};
}
export function loan(quantity=5) {
  return {date:'2026-11-06',employeeId:'pessoa-teste',sectorId:'setor-teste',responsibleId:'operador-teste',notes:'Observação exclusiva de teste',items:[{variantId:'variante-teste',quantity,conditionId:'limpo'}]};
}
