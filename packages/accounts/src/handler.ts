export interface Store {
  user(token: string): Promise<string | null>;
  list(user: string): Promise<unknown[]>;
  usage(user: string): Promise<unknown>;
  issue(user: string, name: string, hash: string, prefix: string): Promise<Record<string, unknown>>;
  revoke(user: string, id: string): Promise<boolean>;
  authorize(hash: string, consume: boolean): Promise<{status: number; remaining?: number; limit?: number; retry_after?: number; reason?: string}>;
}
export async function digest(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2,'0')).join('');
}
function newKey() { return 'lk_live_' + Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join(''); }
export function accountHandler(store: Store) {
  return async (req: Request): Promise<Response> => {
    const origin=req.headers.get('origin');
    const headers: Record<string,string> = {'content-type':'application/json','cache-control':'no-store','vary':'Origin'};
    if(origin==='https://linkoi.dev'||origin==='http://127.0.0.1:4323') headers['access-control-allow-origin']=origin;
    headers['access-control-allow-headers']='authorization,apikey,content-type,x-client-info';
    headers['access-control-allow-methods']='GET,POST,DELETE,OPTIONS';
    const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    const token=/^Bearer (\S+)$/i.exec(req.headers.get('authorization')??'')?.[1];
    if(!token)return json({error:'Unauthorized'},401);
    const path=new URL(req.url).pathname.split('/linkoi-accounts')[1]||'/';
    try {
      if(path==='/authorize' && req.method==='POST') {
        if(!/^lk_live_[0-9a-f]{64}$/.test(token)) return json({error:'Invalid API key'},401);
        const consume=new URL(req.url).searchParams.get('consume')!=='false';
        const result=await store.authorize(await digest(token),consume);
        if(result.retry_after)headers['retry-after']=String(result.retry_after);
        return json(result,result.status);
      }
      const user=await store.user(token);
      if(!user)return json({error:'Unauthorized'},401);
      if(path==='/keys' && req.method==='GET')return json({keys:await store.list(user)});
      if(path==='/usage' && req.method==='GET')return json(await store.usage(user));
      if(path==='/keys' && req.method==='POST') {
        const text=await req.text();
        if(text.length>1024)return json({error:'Request too large'},413);
        let body;try{body=JSON.parse(text)}catch{return json({error:'Invalid JSON'},400)}
        const name=typeof body?.name==='string'?body.name.trim():'';
        if(!name||name.length>64)return json({error:'Use a name between 1 and 64 characters'},400);
        const key=newKey();
        const record=await store.issue(user,name,await digest(key),key.slice(0,16));
        if(record.error==='key_limit')return json({error:'You can have up to 10 active keys'},409);
        return json({...record,key},201);
      }
      const id=/^\/keys\/([0-9a-f-]{36})$/.exec(path)?.[1];
      if(id && req.method==='DELETE')return await store.revoke(user,id)?json({revoked:true}):json({error:'Key not found'},404);
      return json({error:'Not found'},404);
    } catch { return json({error:'Account service unavailable'},503); }
  };
}
