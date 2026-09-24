const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store',...headers}});
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,OPTIONS','access-control-expose-headers':'x-ratelimit-limit,x-ratelimit-remaining,retry-after'};
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(request.method!=='GET')return json({error:'Method not allowed'},405,{...cors,allow:'GET, OPTIONS'});
    if(!['/','/health'].includes(url.pathname))return json({error:'Not found'},404,cors);
    const authorization=request.headers.get('authorization')??'';
    const token=/^Bearer (\S+)$/i.exec(authorization)?.[1];
    if(!token)return json({error:'API key required'},401,cors);
    if(url.pathname==='/'){
      try {const target=new URL(url.searchParams.get('url'));if(!['http:','https:'].includes(target.protocol))throw Error()}catch{return json({error:'A valid HTTP or HTTPS url is required'},400,cors)}
    }
    let quota;
    {
      try {
        const response=await fetch(`${env.ACCOUNTS_URL}/authorize?consume=${url.pathname==='/'}`,{method:'POST',headers:{authorization,apikey:env.SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(8000),redirect:'manual'});
        quota=await response.json();
        if(!response.ok)return json({error:response.status===401?'Invalid or revoked API key':quota.reason??'Account service unavailable'},[401,429].includes(response.status)?response.status:503,{...cors,...(response.headers.get('retry-after')?{'retry-after':response.headers.get('retry-after')}: {})});
      }catch(error){console.error('Account authorization failed',error instanceof Error?error.message:'Unknown error');return json({error:'Account service unavailable'},503,cors)}
    }
    if(!env.EXTRACTION_API_KEY)return json({error:'Extraction service unavailable'},503,cors);
    const upstream=new Request(request,{headers:{accept:'application/json',authorization:`Bearer ${env.EXTRACTION_API_KEY}`}});
    const response=await env.METADATA.fetch(upstream);
    const headers=new Headers(response.headers);for(const [k,v] of Object.entries(cors))headers.set(k,v);
    headers.set('cache-control','no-store');
    if(quota){headers.set('x-ratelimit-limit',String(quota.limit));headers.set('x-ratelimit-remaining',String(quota.remaining))}
    return new Response(response.body,{status:response.status,headers});
  }
};
