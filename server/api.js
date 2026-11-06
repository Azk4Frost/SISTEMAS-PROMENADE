import { DomainError } from './uniformes.js';

export async function handleApi(request, response, url, store, json) {
  const method=request.method;
  const port=request.socket.localPort;
  const hosts=[`127.0.0.1:${port}`,`localhost:${port}`,...(port===80?['127.0.0.1','localhost']:[])];
  const host=request.headers.host?.toLowerCase();
  if(!hosts.includes(host)) throw new DomainError('Acesso permitido somente pelo endereço local do servidor.',403,'LOCAL_ONLY');
  const routes={
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
    '/api/uniformes/loans':(body,key)=>store.registerLoan(body,key),
    '/api/uniformes/drafts':(body,key)=>store.saveDraft(body,key),
    '/api/uniformes/returns':(body,key)=>store.transition('return',body,key),
    '/api/uniformes/laundry/dispatch':(body,key)=>store.transition('dispatch',body,key),
    '/api/uniformes/laundry/receive':(body,key)=>store.transition('receive',body,key)
  };
  if(method!=='POST') throw new DomainError('Método não permitido.',405,'METHOD_NOT_ALLOWED');
  if(!writes[url.pathname]) throw new DomainError('Recurso da API não encontrado.',404,'NOT_FOUND');
  if(request.headers['x-promenade-request']!=='1' || (request.headers.origin && request.headers.origin!==`http://${host}`)) throw new DomainError('Origem da solicitação não permitida.',403,'INVALID_ORIGIN');
  if(request.headers['content-type']?.split(';')[0]!=='application/json') throw new DomainError('Envie dados em JSON.',415,'UNSUPPORTED_MEDIA_TYPE');
  const chunks=[]; let size=0;
  for await(const chunk of request) {
    size+=chunk.length;
    if(size>128*1024) throw new DomainError('Solicitação muito grande.',413,'PAYLOAD_TOO_LARGE');
    chunks.push(chunk);
  }
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new DomainError('JSON inválido.',400,'INVALID_JSON');}
  const result=writes[url.pathname](body,request.headers['idempotency-key']);
  return json(response,200,result,method);
}
