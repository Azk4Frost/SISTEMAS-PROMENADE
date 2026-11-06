import { loadUniformesCatalog, saveUniformesCatalogRecord, openUniformesStock, addUniformesStock } from '../../js/services/uniformes-service.js';
import { createNoticeDialog } from '../../js/components/dialog.js';

const $=(selector)=>document.querySelector(selector);
const dialog=createNoticeDialog($('#catalog-dialog'));
const forms=[...document.querySelectorAll('.catalog-form')];
const baselines=new Map(),editing=new Map();
let catalog=null,holdings=[],editingHolding=null,resetting=false,busy=false,allowNavigation=false;
const titles={employees:'FUNCIONÁRIO',responsibles:'RESPONSÁVEL',sectors:'SETOR'};
const node=(tag,className,text)=>{const result=document.createElement(tag);if(className)result.className=className;if(text!==undefined)result.textContent=String(text);return result;};
function signature(form) {return JSON.stringify({values:[...form.querySelectorAll('input,select')].map(input=>[input.id,input.value]),...(form.id==='form-stock'?{holdings}:{})});}
const dirty=(form)=>baselines.has(form)&&baselines.get(form)!==signature(form);
const anyDirty=()=>forms.some(dirty);
function notice(message,error=false) {const output=$('#catalog-notice');output.textContent=message;output.classList.toggle('is-error',error);output.setAttribute('role',error?'alert':'status');}
function hideDialogFields() {$('#holding-fields').hidden=true;$('#replenish-fields').hidden=true;}
function showDialog(options) {hideDialogFields();dialog.open(options);}
function options(selector,records,placeholder) {
 const select=$(selector),previous=select.value;select.replaceChildren(new Option(placeholder,''));
 for(const record of records) select.append(new Option(record.name??record.label,record.id));
 if(records.some(record=>record.id===previous))select.value=previous;
}
function tab(kind,focus=false) {
 const key=['employees','responsibles','sectors','stock'].includes(kind)?kind:'employees';
 for(const button of document.querySelectorAll('[role="tab"]')) {
  const selected=button.id===`tab-${key}`;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
  document.getElementById(button.getAttribute('aria-controls')).hidden=!selected;
 }
 if(focus)$(`#tab-${key}`).focus();
 history.replaceState(null,'',`${window.location.pathname}${window.location.search}#${key}`);
}
for(const [index,button] of [...document.querySelectorAll('[role="tab"]')].entries()) {
 button.addEventListener('click',()=>tab(button.id.slice(4)));
 button.addEventListener('keydown',event=>{
  const buttons=[...document.querySelectorAll('[role="tab"]')];let next;
  if(event.key==='ArrowRight')next=(index+1)%buttons.length;
  if(event.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;
  if(event.key==='Home')next=0;if(event.key==='End')next=buttons.length-1;
  if(next!==undefined){event.preventDefault();tab(buttons[next].id.slice(4),true);}
 });
}
function emptyRow(target,columns,message) {const row=node('tr'),cell=node('td','catalog-empty',message);cell.colSpan=columns;row.append(cell);target.replaceChildren(row);}
function renderPeople(kind) {
 const target=$(`#${kind}-list`);target.replaceChildren();$('#'+kind+'-count').textContent=`${catalog[kind].length} registros`;
 if(!catalog[kind].length){emptyRow(target,kind==='employees'?3:2,'Nenhum cadastro nesta lista.');return;}
 for(const record of catalog[kind]) {
  const row=node('tr');row.append(node('td','',record.name??record.label));
  if(kind==='employees')row.append(node('td','',record.registration));
  const cell=node('td'),button=node('button','button button-secondary','Editar');button.type='button';button.setAttribute('aria-label',`Editar ${record.name??record.label}`);
  button.addEventListener('click',()=>{
   if(busy)return;
   const form=$(`#form-${kind}`);
   const fill=()=>{form.elements[kind==='employees'?'name':'label'].value=record.name??record.label;if(kind==='employees')form.elements.registration.value=record.registration;editing.set(kind,{id:record.id,version:record.version});$(`#${kind}-form-title`).textContent=`EDITAR ${titles[kind]}`;baselines.set(form,signature(form));form.querySelector('input').focus();};
   if(dirty(form))showDialog({title:'Descartar preenchimento?',description:'Este formulário tem alterações ainda não salvas. Deseja abrir o outro cadastro?',detail:'As alterações locais deste formulário serão descartadas.',confirmLabel:'Descartar e editar',origin:button,onConfirm:fill});else fill();
  });
  cell.append(button);row.append(cell);target.append(row);
 }
}
function toggleNewModel() {
 const active=$('#stock-model').value==='__new_model__';$('#new-model-fields').hidden=!active;
 for(const input of $('#new-model-fields').querySelectorAll('input,select'))input.disabled=!active;
}
function renderModels() {
 const select=$('#stock-model'),previous=select.value;
 select.replaceChildren(new Option('Selecione um modelo',''),...catalog.uniforms.map(model=>new Option(model.label,model.id)),new Option('+ Cadastrar novo modelo','__new_model__'));
 if([...select.options].some(option=>option.value===previous))select.value=previous;
 for(const option of $('#model-card').options)if(option.value)option.disabled=catalog.uniforms.some(model=>model.id===option.value);
 toggleNewModel();
}
function renderStock() {
 const target=$('#stock-list');target.replaceChildren();let count=0;
 for(const model of catalog.uniforms)for(const variant of model.variants) {
  count++;const row=node('tr'),identity=node('td');identity.append(node('span','cell-primary',model.label),node('span','cell-secondary',variant.color));row.append(identity);
  for(const value of [variant.size,variant.available,variant.held,variant.dirty,variant.laundry,variant.total])row.append(node('td','',value));
  const cell=node('td'),button=node('button','button button-secondary','Repor limpas');button.type='button';button.setAttribute('aria-label',`Repor peças limpas de ${model.label}, ${variant.color}, ${variant.size}`);
  button.addEventListener('click',()=>openReplenish(model,variant,button));cell.append(button);row.append(cell);target.append(row);
 }
 if(!count)emptyRow(target,8,'Nenhuma variação cadastrada. Informe o modelo, a cor, o tamanho e a contagem real abaixo.');
}
function renderHoldings() {
 const target=$('#holding-list');target.replaceChildren();
 for(const [index,entry] of holdings.entries()) {
  const row=node('tr'),person=node('td');
  person.append(node('span','cell-primary',catalog?.employees.find(record=>record.id===entry.employeeId)?.name??'Funcionário indisponível'),node('span','cell-secondary',`Entregou: ${catalog?.responsibles.find(record=>record.id===entry.responsibleId)?.label??'Não informado'}`));
  const actions=node('td'),group=node('div','catalog-holding-actions');
  for(const action of ['Editar','Remover']) {
   const button=node('button','button button-secondary',action);button.type='button';
   button.addEventListener('click',()=>action==='Editar'?openHolding(index):showDialog({title:'Remover saldo do preenchimento?',description:'Este saldo ainda não foi gravado. Removê-lo do formulário?',detail:'Nenhum saldo já cadastrado no banco será alterado.',confirmLabel:'Remover',origin:button,onConfirm:()=>{holdings.splice(index,1);renderHoldings();updateTotal();$('#add-holding').focus();}}));
   group.append(button);
  }
  actions.append(group);row.append(person,node('td','',entry.quantity),actions);target.append(row);
 }
 if(!holdings.length)emptyRow(target,3,'Nenhum saldo com funcionário adicionado ao preenchimento.');
 updateTotal();
}
function updateTotal() {
 const held=holdings.reduce((n,entry)=>n+entry.quantity,0);$('#stock-held').value=String(held);
 const values=['#stock-clean','#stock-dirty','#stock-laundry'].map(id=>Number($(id).value));
 const total=values.reduce((n,value)=>n+value,held);
 $('#stock-total').textContent=values.every(value=>Number.isSafeInteger(value)&&value>=0)&&Number.isSafeInteger(total)?String(total):'Revise as quantidades';
}
function resetForm(form) {
 resetting=true;form.reset();resetting=false;
 const kind=form.dataset.kind;
 if(kind){editing.delete(kind);$(`#${kind}-form-title`).textContent=`NOVO ${titles[kind]}`;}
 else {holdings=[];toggleNewModel();renderHoldings();}
 for(const input of form.querySelectorAll('input'))input.setCustomValidity('');
 baselines.set(form,signature(form));
}
async function loadCatalog({quiet=false}={}) {
 $('#reload-catalog').hidden=true;
 if(!catalog)forms.forEach(form=>form.inert=true);
 try {
  const result=await loadUniformesCatalog();
  if(!result||!['employees','responsibles','sectors','uniforms'].every(key=>Array.isArray(result[key])))throw Error('Resposta de cadastro inválida.');
  catalog=result;
  for(const kind of ['employees','responsibles','sectors'])renderPeople(kind);
  renderModels();renderStock();renderHoldings();
  forms.forEach(form=>{form.inert=false;if(!baselines.has(form))baselines.set(form,signature(form));});
  if(!quiet)notice('Cadastros consultados. Nenhum saldo foi alterado por esta consulta.');
  return true;
 } catch(error) {notice(error.message||'Não foi possível consultar os cadastros.',true);$('#reload-catalog').hidden=false;return false;}
}
for(const form of forms) {
 form.addEventListener('input',event=>{if(event.target.setCustomValidity)event.target.setCustomValidity('');if(form.id==='form-stock')updateTotal();});
 form.addEventListener('reset',event=>{
  if(resetting)return;event.preventDefault();
  if(dirty(form))showDialog({title:'Limpar preenchimento?',description:'Descartar os campos ainda não salvos deste formulário?',detail:'Os registros existentes no banco serão preservados.',confirmLabel:'Limpar',origin:form.querySelector('[type="reset"]'),onConfirm:()=>resetForm(form)});else resetForm(form);
 });
 if(form.dataset.kind)form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;
  const kind=form.dataset.kind,payload=Object.fromEntries(new FormData(form));Object.assign(payload,editing.get(kind)??{});
  busy=true;form.inert=true;
  try {
   const result=await saveUniformesCatalogRecord(kind,payload);if(!result?.id||!result.version)throw Error('A gravação não foi confirmada.');
   resetForm(form);const refreshed=await loadCatalog({quiet:true});
   if(refreshed)notice(`${titles[kind]} salvo no banco.`);
  } catch(error){notice(error.message,true);}
  finally{busy=false;form.inert=false;}
 });
}
function validQuantity(input,minimum=0) {
 const value=Number(input.value);input.setCustomValidity(input.value!==''&&Number.isSafeInteger(value)&&value>=minimum?'':`Informe uma quantidade inteira ${minimum?'maior que zero':'igual ou maior que zero'}.`);return input.reportValidity();
}
function openHolding(index=null) {
 if(busy)return;
 if(!catalog?.employees.length){showDialog({title:'Cadastre o funcionário primeiro',description:'Para registrar peças com funcionários, informe antes os nomes e matrículas de quem recebeu.',detail:'Não serão criados funcionários fictícios.',origin:$('#add-holding')});return;}
 editingHolding=index;
 hideDialogFields();$('#holding-fields').hidden=false;
 options('#holding-employee',catalog.employees,'Selecione quem recebeu');
 options('#holding-responsible',catalog.responsibles,'Não informado no saldo inicial');
 options('#holding-sector',catalog.sectors,'Não informado no saldo inicial');
 const value=index===null?{}:holdings[index];
 for(const [id,key] of [['holding-employee','employeeId'],['holding-responsible','responsibleId'],['holding-sector','sectorId'],['holding-date','date'],['holding-quantity','quantity']]){$('#'+id).value=value[key]??(key==='quantity'?'1':'');$('#'+id).setCustomValidity('');}
 dialog.open({title:index===null?'Adicionar saldo com funcionário':'Editar saldo com funcionário',description:'Informe os dados reais de uma quantidade que já está com o funcionário. Deixe informações originais desconhecidas em branco.',detail:'Este preenchimento só será gravado ao cadastrar a variação e o saldo inicial.',confirmLabel:'Adicionar ao preenchimento',origin:$('#add-holding'),
  validate:()=>$('#holding-employee').reportValidity()&&$('#holding-date').reportValidity()&&validQuantity($('#holding-quantity'),1),
  onConfirm:()=>{
   const entry={employeeId:$('#holding-employee').value,responsibleId:$('#holding-responsible').value||null,sectorId:$('#holding-sector').value||null,date:$('#holding-date').value||null,quantity:Number($('#holding-quantity').value)};
   if(editingHolding===null)holdings.push(entry);else holdings[editingHolding]=entry;
   renderHoldings();$('#holding-fields').hidden=true;
  }
 });
}
$('#add-holding').addEventListener('click',()=>openHolding());
$('#stock-model').addEventListener('change',toggleNewModel);
$('#form-stock').addEventListener('submit',event=>{
 event.preventDefault();const form=event.currentTarget;if(busy||!catalog||!form.reportValidity())return;
 for(const id of ['#stock-clean','#stock-dirty','#stock-laundry'])if(!validQuantity($(id)))return;
 const payload={color:$('#stock-color').value,size:$('#stock-size').value,cleanQuantity:Number($('#stock-clean').value),dirtyQuantity:Number($('#stock-dirty').value),laundryQuantity:Number($('#stock-laundry').value),holdings:structuredClone(holdings)};
 if($('#stock-model').value==='__new_model__')payload.newModel={label:$('#model-label').value,icon:$('#model-icon').value,cardId:$('#model-card').value||null};else payload.modelId=$('#stock-model').value;
 const total=payload.cleanQuantity+payload.dirtyQuantity+payload.laundryQuantity+holdings.reduce((n,entry)=>n+entry.quantity,0);
 if(!Number.isSafeInteger(total)){notice('A quantidade total supera a precisão suportada.',true);return;}
 showDialog({title:'Conferir saldo inicial',description:`Total: ${total} peças. Limpas disponíveis: ${payload.cleanQuantity}; com funcionários: ${holdings.reduce((n,entry)=>n+entry.quantity,0)}; sujas: ${payload.dirtyQuantity}; na lavanderia: ${payload.laundryQuantity}.`,detail:'Será criada uma nova variação. Informações anteriores desconhecidas não serão inventadas.',confirmLabel:'Confirmar cadastro',origin:form.querySelector('[type="submit"]'),onConfirm:async()=>{
  busy=true;form.inert=true;
  try {
   const result=await openUniformesStock(payload);if(!result?.id||result.total!==total)throw Error('A gravação do estoque não foi confirmada.');
   resetForm(form);const refreshed=await loadCatalog({quiet:true});
   if(refreshed){$('#stock-model').value=result.modelId;toggleNewModel();baselines.set(form,signature(form));notice(`Variação e saldo inicial salvos. Total: ${result.total}; limpas disponíveis: ${result.available}.`);}
  }catch(error){notice(error.message,true);}
  finally{busy=false;form.inert=false;}
 }});
});
function openReplenish(model,variant,origin) {
 if(busy)return;
 hideDialogFields();$('#replenish-fields').hidden=false;const input=$('#replenish-quantity');input.value='1';input.setCustomValidity('');
 dialog.open({title:'Repor peças limpas',description:`${model.label} · ${variant.color} · ${variant.size}. Informe somente novas peças limpas recebidas.`,detail:'A reposição será acrescentada aos saldos total e disponível existentes.',confirmLabel:'Registrar reposição',origin,validate:()=>validQuantity(input,1),onConfirm:async()=>{
  if(busy)return;busy=true;
  try {
   const result=await addUniformesStock({variantId:variant.id,quantity:Number(input.value)});if(!result?.added)throw Error('A reposição não foi confirmada.');
   if(await loadCatalog({quiet:true}))notice(`Reposição registrada: ${result.added} peças limpas.`);
  }catch(error){notice(error.message,true);}
  finally{busy=false;$('#replenish-fields').hidden=true;}
 }});
}
$('#reload-catalog').addEventListener('click',()=>loadCatalog());
document.addEventListener('click',event=>{
 const link=event.target.closest('a[href]');
 if(!link||link.getAttribute('href').startsWith('#')||!anyDirty()||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
 event.preventDefault();showDialog({title:'Descartar preenchimento?',description:'Há alterações nesta página que ainda não foram confirmadas. Deseja sair?',detail:'Cadastros já gravados permanecerão no banco.',confirmLabel:'Descartar e sair',origin:link,onConfirm:()=>{allowNavigation=true;window.location.assign(link.href);}});
});
window.addEventListener('beforeunload',event=>{if(anyDirty()&&!allowNavigation){event.preventDefault();event.returnValue='';}});
tab(window.location.hash.slice(1));loadCatalog();
