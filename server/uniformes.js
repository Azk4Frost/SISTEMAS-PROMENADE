import { createHash } from 'node:crypto';

export class DomainError extends Error {
  constructor(message, status = 400, code = 'VALIDATION_ERROR') { super(message); this.status = status; this.code = code; }
}
const fail = (message, status = 400, code) => { throw new DomainError(message, status, code); };
const text = (value, label, max = 200) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) fail(`${label}: informe um texto válido (até ${max} caracteres).`);
  return value.trim();
};
const qty = (value) => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) fail('Informe uma quantidade inteira maior que zero.'); return value; };
const sum = (a,b) => { const value = a+b; if (!Number.isSafeInteger(value)) fail('Quantidade fora da precisão suportada.'); return value; };
const now = () => new Date().toISOString();
const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
const localDay=(value)=>{const parts=Object.fromEntries(dayFormatter.formatToParts(new Date(value)).map(part=>[part.type,part.value]));return `${parts.year}-${parts.month}-${parts.day}`;};
const civilDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T12:00:00Z`)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)!==value) fail('Data do empréstimo inválida.');
  return value;
};
const code = (id) => `EMP-${String(id).padStart(6,'0')}`;
const statuses = { held: ['com-funcionario','Com Funcionário','blue'], dirty: ['em-devolucao','Em Devolução','amber'], laundry: ['na-lavanderia','Na Lavanderia','purple'], clean: ['limpo-disponivel','Limpo / Disponível','green'] };

export function createUniformesStore(db) {
  const get = (sql,...args) => db.prepare(sql).get(...args);
  const all = (sql,...args) => db.prepare(sql).all(...args);
  const run = (sql,...args) => db.prepare(sql).run(...args);
  function mutate(operation, key, payload, action) {
    text(key,'Identificador da operação',128);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('Dados da operação inválidos.');
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      const cached = get('SELECT * FROM requests WHERE key=?',key);
      if (cached) {
        if (cached.operation!==operation || cached.hash!==hash) fail('Identificador já utilizado em outra operação.',409,'IDEMPOTENCY_CONFLICT');
        db.exec('COMMIT'); return JSON.parse(cached.result);
      }
      const result = action();
      run('INSERT INTO requests(key,operation,hash,result,created_at) VALUES(?,?,?,?,?)',key,operation,hash,JSON.stringify(result),now());
      db.exec('COMMIT'); return result;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function reference(table,id,label) {
    const value=text(id,label,128);
    if (!get(`SELECT id FROM ${table} WHERE id=?`,value)) fail(`${label} não cadastrado.`);
    return value;
  }
  function normalizedLoan(payload, strict) {
    const result={date:payload.date || '',employeeId:payload.employeeId || '',sectorId:payload.sectorId || '',responsibleId:payload.responsibleId || '',notes:payload.notes ?? '',items:[]};
    if (typeof result.notes!=='string' || result.notes.length>5000) fail('A observação deve ter até 5000 caracteres.');
    if (strict || result.date) civilDate(result.date);
    for (const [key,table,label] of [['employeeId','employees','Funcionário'],['sectorId','sectors','Setor'],['responsibleId','responsibles','Responsável']]) {
      if (strict || result[key]) result[key]=reference(table,result[key],label);
    }
    if (!Array.isArray(payload.items) || payload.items.length>500 || (strict && !payload.items.length)) fail('Adicione entre 1 e 500 itens ao empréstimo.');
    for (const item of payload.items) {
      if (!item || item.conditionId!=='limpo') fail('Somente peças limpas e disponíveis podem ser emprestadas.');
      result.items.push({variantId:reference('variants',item.variantId,'Variação do uniforme'),quantity:qty(item.quantity),conditionId:'limpo'});
    }
    return result;
  }
  function verifyDraft(payload) {
    if (payload.draftId===undefined || payload.draftId===null) return;
    const draft=get('SELECT * FROM drafts WHERE id=?',Number(payload.draftId));
    if (!draft) fail('Rascunho não encontrado.',404,'NOT_FOUND');
    if (draft.version!==payload.draftVersion) fail('O rascunho foi alterado em outra janela. Reabra-o antes de continuar.',409,'STALE_DATA');
  }
  const movement=(itemId,variantId,kind,quantity,at)=>run('INSERT INTO movements(item_id,variant_id,kind,quantity,happened_at) VALUES(?,?,?,?,?)',itemId,variantId,kind,quantity,at);
  function importCatalog(payload,key) {
    return mutate('catalog-import',key,payload,()=>{
      for (const [field,table,label,name] of [['sectors','sectors','Setor','label'],['employees','employees','Funcionário','name'],['responsibles','responsibles','Responsável','label']]) {
        if (!Array.isArray(payload[field])) fail(`${field} deve ser uma lista.`);
        for (const entry of payload[field]) {
          if(!entry || typeof entry!=='object') fail('Cadastro inválido.');
          const id=text(entry.id,`ID de ${label}`,128), value=text(entry[name],label);
          if (table==='employees') run('INSERT INTO employees(id,name,registration) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,registration=excluded.registration',id,value,text(entry.registration,'Matrícula',128));
          else run(`INSERT INTO ${table}(id,label) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label`,id,value);
        }
      }
      if (!Array.isArray(payload.uniforms)) fail('uniforms deve ser uma lista.');
      const at=now();
      for (const uniform of payload.uniforms) {
        if(!uniform || typeof uniform!=='object') fail('Modelo inválido.');
        const id=text(uniform.id,'ID do modelo',128), label=text(uniform.label,'Modelo');
        if (!['apron','shirt-yellow','shirt-white','pants'].includes(uniform.icon)) fail('Ícone do uniforme inválido.');
        run('INSERT INTO uniforms(id,label,icon) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,icon=excluded.icon',id,label,uniform.icon);
        if (!Array.isArray(uniform.variants)) fail('Informe as variações do uniforme.');
        for (const variant of uniform.variants) {
          if(!variant || typeof variant!=='object') fail('Variação inválida.');
          const variantId=text(variant.id,'ID da variação',128), color=text(variant.color,'Cor'), size=text(variant.size,'Tamanho');
          const quantity=variant.quantity===0?0:qty(variant.quantity);
          const existing=get('SELECT * FROM variants WHERE id=?',variantId);
          if (existing) {
            if (existing.uniform_id!==id || existing.color!==color || existing.size!==size) fail('Não é permitido alterar a identidade de uma variação existente.',409);
            if(quantity!==0) fail('Variação já cadastrada: use quantidade zero para atualizar o catálogo ou stock-add para repor estoque.',409);
            continue;
          }
          sum(get('SELECT COALESCE(SUM(total),0) AS total FROM variants').total,quantity);
          run('INSERT INTO variants(id,uniform_id,color,size,total,available) VALUES(?,?,?,?,?,?)',variantId,id,color,size,quantity,quantity);
          if(quantity) movement(null,variantId,'opening',quantity,at);
        }
      }
      return {imported:true};
    });
  }
  function addStock(payload,key) {
    return mutate('stock-add',key,payload,()=>{
      const id=reference('variants',payload.variantId,'Variação'),quantity=qty(payload.quantity);
      sum(get('SELECT COALESCE(SUM(total),0) AS total FROM variants').total,quantity);
      run('UPDATE variants SET total=total+?,available=available+? WHERE id=?',quantity,quantity,id);
      movement(null,id,'stock-add',quantity,now()); return {added:quantity};
    });
  }
  function registerLoan(payload,key) {
    return mutate('loan',key,payload,()=>{
      const value=normalizedLoan(payload,true); verifyDraft(payload);
      const totals=new Map(); for(const item of value.items) totals.set(item.variantId,sum(totals.get(item.variantId)??0,item.quantity));
      for(const [id,quantity] of totals) {
        if(!run('UPDATE variants SET available=available-? WHERE id=? AND available>=?',quantity,id,quantity).changes) fail('Estoque limpo insuficiente. Atualize os dados e revise as quantidades.',409,'INSUFFICIENT_STOCK');
      }
      const at=now();
      const id=Number(run('INSERT INTO loans(employee_id,sector_id,responsible_id,loan_date,notes,created_at) VALUES(?,?,?,?,?,?)',value.employeeId,value.sectorId,value.responsibleId,value.date,value.notes,at).lastInsertRowid);
      for(const item of value.items) {
        const lineId=Number(run('INSERT INTO loan_items(loan_id,variant_id,quantity,held,updated_at) VALUES(?,?,?,?,?)',id,item.variantId,item.quantity,item.quantity,at).lastInsertRowid);
        movement(lineId,item.variantId,'loan',item.quantity,at);
      }
      if(payload.draftId) run('DELETE FROM drafts WHERE id=?',Number(payload.draftId));
      return {id,code:code(id)};
    });
  }
  function saveDraft(payload,key) {
    return mutate('draft',key,payload,()=>{
      const value=normalizedLoan(payload,false); verifyDraft(payload); const at=now();
      let id=payload.draftId?Number(payload.draftId):null;
      if(id) run('UPDATE drafts SET payload=?,version=version+1,updated_at=? WHERE id=?',JSON.stringify(value),at,id);
      else id=Number(run('INSERT INTO drafts(payload,updated_at) VALUES(?,?)',JSON.stringify(value),at).lastInsertRowid);
      return {id,version:get('SELECT version FROM drafts WHERE id=?',id).version,updatedAt:at};
    });
  }
  function transition(kind,payload,key) {
    return mutate(kind,key,payload,()=>{
      if(!Array.isArray(payload.items) || !payload.items.length || payload.items.length>500) fail('Selecione entre 1 e 500 itens.');
      const seen=new Set(),at=now(); const [source,target] = {return:['held','dirty'],dispatch:['dirty','laundry'],receive:['laundry','clean']}[kind];
      for(const entry of payload.items) {
        if(!entry || typeof entry!=='object') fail('Item inválido.');
        const id=Number(entry.id),quantity=qty(entry.quantity);
        if(!Number.isSafeInteger(id) || id<=0 || seen.has(id)) fail('Item inválido ou duplicado.'); seen.add(id);
        const line=get('SELECT * FROM loan_items WHERE id=?',id);
        if(!line) fail('Item não encontrado.',404,'NOT_FOUND');
        if(entry.version!==line.version) fail('O item foi alterado em outra janela. Atualize a lista antes de continuar.',409,'STALE_DATA');
        if(line[source]<quantity) fail('A quantidade supera o saldo disponível nesta etapa do ciclo.',409,'INSUFFICIENT_BALANCE');
        run(`UPDATE loan_items SET ${source}=${source}-?,${target}=${target}+?,version=version+1,updated_at=?${kind==='dispatch'?',sent_at=?':''} WHERE id=?`,...([quantity,quantity,at,...(kind==='dispatch'?[at]:[]),id]));
        if(kind==='receive') run('UPDATE variants SET available=available+? WHERE id=?',quantity,line.variant_id);
        movement(id,line.variant_id,kind,quantity,at);
      }
      return {processed:payload.items.length};
    });
  }
  const rows = () => all(`SELECT li.*,l.employee_id,l.sector_id,l.loan_date,l.notes,e.name,e.registration,s.label AS department,
    v.uniform_id,v.color,v.size,u.label,u.icon FROM loan_items li JOIN loans l ON l.id=li.loan_id
    JOIN employees e ON e.id=l.employee_id JOIN sectors s ON s.id=l.sector_id
    JOIN variants v ON v.id=li.variant_id JOIN uniforms u ON u.id=v.uniform_id ORDER BY l.id DESC,li.id`);
  function dashboard() {
    const lines=rows(), loans=[];
    // Uma linha por parcela de estado: empréstimos parcialmente devolvidos podem aparecer em mais de um status.
    for(const line of lines) for(const [field,[status]] of Object.entries(statuses)) if(line[field]>0) loans.push({
      id:`${line.id}-${field}`,lineId:String(line.id),code:code(line.loan_id),employee:{id:line.employee_id,name:line.name,registration:line.registration,department:line.department},
      items:[{uniform:line.uniform_id,label:`${line.label} · ${line.color}`,size:line.size,quantity:line[field]}],status,
      loanDate:line.loan_date,updatedAt:line.updated_at,returnableQuantity:field==='held'?line.held:0,version:line.version
    });
    const inventory=all(`SELECT u.id,u.label,COALESCE(SUM(v.total),0) AS total,COALESCE(SUM(v.available),0) AS available FROM uniforms u LEFT JOIN variants v ON v.uniform_id=u.id GROUP BY u.id`).map(item=>({
      ...item,inStock:item.available+lines.filter(line=>line.uniform_id===item.id).reduce((n,line)=>n+line.dirty,0)
    }));
    const date=localDay(new Date());
    const returnsToday=all("SELECT quantity,happened_at FROM movements WHERE kind='return'").filter(row=>localDay(row.happened_at)===date).reduce((n,row)=>sum(n,row.quantity),0);
    return {connection:'ready',inventory,loans,indicators:{activeLoans:new Set(lines.filter(line=>line.held>0).map(line=>line.loan_id)).size,returnsToday,atLaundry:lines.reduce((n,line)=>n+line.laundry,0),totalStock:inventory.reduce((n,item)=>n+item.total,0)}};
  }
  function loanContext() {
    return {connection:'ready',employees:all('SELECT id,name,registration FROM employees ORDER BY name'),sectors:all('SELECT id,label FROM sectors ORDER BY label'),responsibles:all('SELECT id,label FROM responsibles ORDER BY label'),conditions:[{id:'limpo',label:'Limpo / Pronto para uso'}],
      uniforms:all('SELECT * FROM uniforms ORDER BY label').map(uniform=>({...uniform,available:get('SELECT COALESCE(SUM(available),0) AS available FROM variants WHERE uniform_id=?',uniform.id).available,variants:all('SELECT id,color,size,available FROM variants WHERE uniform_id=? ORDER BY color,size',uniform.id)}))};
  }
  function laundryContext(kind) {
    const field=kind==='dispatch'?'dirty':'laundry';
    return {connection:'ready',...(kind==='receive'?{afterReceiptStatus:{label:'Limpo / Disponível'}}:{}),items:rows().filter(line=>line[field]>0).map(line=>({
      id:String(line.id),loanCode:code(line.loan_id),employee:{id:line.employee_id,name:line.name,department:line.department},uniform:{id:line.uniform_id,label:`${line.label} · ${line.color}`,size:line.size,icon:line.icon},loanDate:line.loan_date,sentDate:line.sent_at?localDay(line.sent_at):null,
      status:{label:statuses[field][1],tone:statuses[field][2]},eligible:true,availableQuantity:line[field],version:line.version
    }))};
  }
  const listDrafts=()=>({drafts:all('SELECT id,payload,version,updated_at FROM drafts ORDER BY updated_at DESC').map(row=>({id:row.id,version:row.version,updatedAt:row.updated_at,employeeName:get('SELECT name FROM employees WHERE id=?',JSON.parse(row.payload).employeeId)?.name??'Funcionário não selecionado'}))});
  const readDraft=(id)=>{const row=get('SELECT * FROM drafts WHERE id=?',Number(id));if(!row)fail('Rascunho não encontrado.',404,'NOT_FOUND');return {id:row.id,version:row.version,...JSON.parse(row.payload)};};
  return {dashboard,loanContext,laundryContext,registerLoan,saveDraft,listDrafts,readDraft,importCatalog,addStock,transition};
}
