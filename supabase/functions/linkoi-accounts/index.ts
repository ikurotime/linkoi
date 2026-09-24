import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
import { accountHandler } from '../../../packages/accounts/src/handler.ts';
const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const fields='id,name,prefix,created_at,revoked_at,last_used_at,requests_total';
function checked<T>({data,error}:{data:T;error:unknown}):T {if(error)throw error;return data}
Deno.serve(accountHandler({
  async user(token){const {data,error}=await client.auth.getUser(token);return error?null:data.user?.id??null},
  async list(user){return checked(await client.from('linkoi_api_keys').select(fields).eq('user_id',user).order('created_at',{ascending:false}))??[]},
  async usage(user){
    const a=checked(await client.from('linkoi_accounts').select('monthly_limit,minute_limit,month_start,month_requests').eq('user_id',user).maybeSingle());
    const month=new Date().toISOString().slice(0,7)+'-01';
    return {monthly_limit:a?.monthly_limit??1000,minute_limit:a?.minute_limit??60,month_start:month,month_requests:a?.month_start===month?a.month_requests:0};
  },
  async issue(user,name,hash,prefix){return checked(await client.rpc('linkoi_issue_key',{p_user:user,p_name:name,p_hash:hash,p_prefix:prefix}))},
  async revoke(user,id){return (checked(await client.from('linkoi_api_keys').update({revoked_at:new Date().toISOString()}).eq('user_id',user).eq('id',id).is('revoked_at',null).select('id'))??[]).length===1},
  async authorize(hash,consume){return checked(await client.rpc('linkoi_authorize',{p_hash:hash,p_consume:consume}))},
}));
