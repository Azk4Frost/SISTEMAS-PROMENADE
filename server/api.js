import { DomainError } from './uniformes.js';

export async function handleApi(request, response, url, store, json) {
  const method=request.method;
  const port=request.socket.localPort;
  const hosts=[`127.0.0.1:${port}`,`localhost:${port}`,...(port===80?['127.0.0.1','localhost']:[])];
  const host=request.headers.host?.toLowerCase();
  if(!hosts.includes(host)) throw new DomainError('Acesso permitido somente pelo endereço local do servidor.',403,'LOCAL_ONLY');
  const routes={
    '/api/uniformes/catalog':()=>store.catalog(),
    '/api/uniformes/dashboard':()=>store.dashboard(),
    '/api/uniformes/context':()=>store.loanContext(),
    '/api/uniformes/laundry/dispatch':()=>store.laundryContext('dispatch'),
    '/api/uniformes/laundry/receive':()=>store.laundryContext('receive'),
    '/api/uniformes/drafts':()=>store.listDrafts()
  };
  const draft=/^\/api\/uniformes\/drafts\/(\d+)$/.exec(url.pathname);
  if(['GET','HEAD'].includes(method)) {
    const operation=routes[url.pathname] ?? (draft?()=>store.readDraft(draft[1]):null);
    if(!operation) throw new DomainError('Recurso da API não encontrado.',404,'NOT_FOUND');
    return json(response,200,operation(),method);
  }
  const writes={
    '/api/uniformes/catalog/employees':(body,key)=>store.saveCatalogRecord('employees',body,key),
    '/api/uniformes/catalog/responsibles':(body,key)=>store.saveCatalogRecord('responsibles',body,key),
    '/api/uniformes/catalog/sectors':(body,key)=>store.saveCatalogRecord('sectors',body,key),
    '/api/uniformes/stock/open':(body,key)=>store.openStock(body,key),
    '/api/uniformes/stock/add':(body,key)=>store.addStock(body,key),
    '/api/uniformes/loans':(body,key)=>store.registerLoan(body,key),
    '/api/uniformes/drafts':(body,key)=>store.saveDraft(body,key),
    '/api/uniformes/returns':(body,key)=>store.transition('return',body,key),
    '/api/uniformes/laundry/dispatch':(body,key)=>store.transition('dispatch',body,key),
    '/api/uniformes/laundry/receive':(body,key)=>store.transition('receive',body,key)
  };
  if(method!=='POST') throw new DomainError('Método não permitido.',405,'METHOD_NOT_ALLOWED');
  if(!writes[url.pathname]) throw new DomainError('Recurso da API não encontrado.',404,'NOT_FOUND');
  if(request.headers['x-promenade-request']!=='1' || (request.headers.origin && request.headers.origin!==`http://${host}`)) throw new DomainError('Origem da solicitação não permitida.',403,'INVALID_ORIGIN');
  if(request.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json') throw new DomainError('Envie dados em JSON.',415,'UNSUPPORTED_MEDIA_TYPE');
  const body=await new Promise((resolve,reject)=>{
    const chunks=[];let size=0,settled=false;
    request.on('data',chunk=>{
      if(settled)return;
      size+=chunk.length;
      if(size>128*1024){settled=true;chunks.length=0;request.resume();reject(new DomainError('Solicitação muito grande.',413,'PAYLOAD_TOO_LARGE'));return;}
      chunks.push(chunk);
    });
    request.once('end',()=>{
      if(settled)return;settled=true;
      try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}
      catch{reject(new DomainError('JSON inválido.',400,'INVALID_JSON'));}
    });
    const interrupted=()=>{if(!settled){settled=true;reject(new DomainError('A solicitação foi interrompida.',400,'INCOMPLETE_REQUEST'));}};
    request.once('error',interrupted);request.once('aborted',interrupted);
  });
  const result=writes[url.pathname](body,request.headers['idempotency-key']);
  return json(response,200,result,method);
}
