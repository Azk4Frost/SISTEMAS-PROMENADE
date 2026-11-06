/** API local real; nenhuma operação utiliza localStorage ou dados de demonstração. */
export class UniformesIntegrationError extends Error {
  constructor(message, code='NETWORK_ERROR') { super(message); this.name='UniformesIntegrationError'; this.code=code; }
}
const pendingRequests=new Map();
async function request(path,{payload}={}) {
  const key=payload===undefined?null:`${path}:${JSON.stringify(payload)}`;
  if(key&&!pendingRequests.has(key)) pendingRequests.set(key,crypto.randomUUID());
  let response;
  try {
    response=await fetch(`/api/uniformes${path}`,{
      method:key?'POST':'GET',credentials:'same-origin',cache:'no-store',
      headers:key?{'Content-Type':'application/json','X-Promenade-Request':'1','Idempotency-Key':pendingRequests.get(key)}:{},
      ...(key?{body:JSON.stringify(payload)}:{})
    });
  } catch {
    throw new UniformesIntegrationError('Não foi possível contatar o servidor. Verifique a conexão local e tente novamente. O resultado da operação ainda não foi confirmado.');
  }
  let data;
  try{data=await response.json();}catch{throw new UniformesIntegrationError('Resposta inválida do servidor. O resultado da operação ainda não foi confirmado.');}
  if(!response.ok) {
    if(key&&response.status<500) pendingRequests.delete(key);
    throw new UniformesIntegrationError(data?.error?.message??'Não foi possível concluir a operação.',data?.error?.code??'SERVER_ERROR');
  }
  if(key) pendingRequests.delete(key);
  return data;
}
export const loadUniformesDashboard=()=>request('/dashboard');
export const loadNewLoanContext=()=>request('/context');
export const registerUniformesLoan=(payload)=>request('/loans',{payload});
export const saveUniformesLoanDraft=(payload)=>request('/drafts',{payload});
export const listUniformesDrafts=()=>request('/drafts');
export const readUniformesDraft=(id)=>request(`/drafts/${encodeURIComponent(id)}`);
export const returnUniformes=(payload)=>request('/returns',{payload});
export const loadLaundryDispatchItems=()=>request('/laundry/dispatch');
export const dispatchUniformesToLaundry=(payload)=>request('/laundry/dispatch',{payload});
export const loadLaundryReceiptItems=()=>request('/laundry/receive');
export const receiveUniformesFromLaundry=(payload)=>request('/laundry/receive',{payload});
