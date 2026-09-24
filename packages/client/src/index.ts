export interface Metadata {
  url: string; title: string|null; description: string|null; image: string|null;
  logo: string|null; publisher: string|null; author: string|null; date: string|null; lang: string|null; source: 'fast'|'fallback';
}
export interface MetadataResponse {status:'success';data:Metadata;cache:'hit'|'stale'|'miss'|'bypass'}
export class LinkoiError extends Error {
  constructor(message:string,public readonly status:number,public readonly retryAfter:number|null=null){super(message);this.name='LinkoiError'}
}
/** Keep API keys in server-side code. No network requests occur until resolve is called. */
export function createClient(options:{apiKey:string;baseUrl?:string;timeoutMs?:number;fetch?:typeof fetch}) {
  if(!options.apiKey.trim())throw new TypeError('apiKey is required');
  const base=new URL(options.baseUrl??'https://api.linkoi.dev/');
  if(base.username||base.password||base.search||base.hash)throw new TypeError('baseUrl must not contain credentials, query parameters, or a fragment');
  if(base.protocol!=='https:' && !(base.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(base.hostname)))throw new TypeError('baseUrl must use HTTPS');
  const timeout=options.timeoutMs??15000;
  if(!Number.isFinite(timeout)||timeout<=0)throw new TypeError('timeoutMs must be positive');
  const request=options.fetch??globalThis.fetch;
  return {
    async resolve(url:string|URL,opts:{fresh?:boolean;signal?:AbortSignal}={}):Promise<MetadataResponse>{
      const target=new URL(url.toString());
      if(!['http:','https:'].includes(target.protocol))throw new TypeError('Only HTTP and HTTPS URLs are supported');
      const endpoint=new URL(base);endpoint.searchParams.set('url',target.href);
      if(opts.fresh)endpoint.searchParams.set('fresh','true');
      const timeoutSignal=AbortSignal.timeout(timeout);
      const response=await request(endpoint,{method:'GET',headers:{authorization:`Bearer ${options.apiKey}`,accept:'application/json'},redirect:'manual',signal:opts.signal?AbortSignal.any([opts.signal,timeoutSignal]):timeoutSignal});
      const body=await response.json().catch(()=>null) as any;
      if(!response.ok){const retry=Number(response.headers.get('retry-after'));throw new LinkoiError(body?.error??body?.reason??'Linkoi request failed',response.status,retry>0?retry:null)}
      if(body?.status!=='success'||typeof body?.data?.url!=='string')throw new LinkoiError('Invalid Linkoi response',502);
      return body as MetadataResponse;
    }
  };
}
