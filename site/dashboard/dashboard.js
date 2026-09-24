import { createClient } from '@supabase/supabase-js';
const supabaseUrl='https://fgkhrbvpsgvdoxqamnzi.supabase.co';
const publishableKey='sb_publishable_zXjCxp2htQ7zzEYoKx4oBg_4AUxIYeH';
const supabase=createClient(supabaseUrl,publishableKey,{auth:{flowType:'pkce',detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
let session=null, revokeId=null, lastFocus=null, generation=0;
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error)}
async function api(path,method='GET',body){
  const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw Error('Please sign in again.');
  const response=await fetch(`${supabaseUrl}/functions/v1/linkoi-accounts${path}`,{method,headers:{authorization:`Bearer ${data.session.access_token}`,apikey:publishableKey,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
  const result=await response.json();if(!response.ok)throw Error(result.error??'Could not complete the request.');return result;
}
const date=value=>value?new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Never';
function element(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el}
async function refresh(){
  const current=++generation;status('Loading your keys…');
  try{
    const [keys,usage]=await Promise.all([api('/keys'),api('/usage')]);if(current!==generation)return;
    $('used').textContent=usage.month_requests.toLocaleString();$('limit').textContent=` / ${usage.monthly_limit.toLocaleString()} requests`;$('rate').textContent=`${usage.minute_limit} requests / minute`;$('meter').max=usage.monthly_limit;$('meter').value=usage.month_requests;
    $('key-list').replaceChildren();
    if(!keys.keys.length)$('key-list').append(element('p','No keys yet. Name your first app above to get started.','empty'));
    for(const key of keys.keys){
      const row=element('article','','key-row'),name=element('div',''),meta=element('div','','key-meta');
      name.append(element('h3',key.name),element('code',`${key.prefix}…`));
      meta.append(element('p',`${key.requests_total.toLocaleString()} requests · Last used ${date(key.last_used_at)}`),element('p',`Created ${date(key.created_at)}`));row.append(name,meta);
      if(key.revoked_at)row.append(element('span','Revoked','muted'));else{const button=element('button','Revoke');button.setAttribute('aria-label',`Revoke ${key.name}`);button.onclick=()=>{revokeId=key.id;lastFocus=button;$('revoke-description').textContent=`${key.name} will stop working immediately. Update any apps using it before revoking.`;$('revoke-dialog').showModal()};row.append(button)}
      $('key-list').append(row);
    }
    status('');
  }catch(error){status(error.message,true)}
}
$('github').onclick=async()=>{ $('github').disabled=true;status('Opening GitHub…');const {error}=await supabase.auth.signInWithOAuth({provider:'github',options:{redirectTo:`${location.origin}/dashboard/`,scopes:'read:user user:email'}});if(error){status(error.message,true);$('github').disabled=false} };
$('signout').onclick=async()=>{const {error}=await supabase.auth.signOut();if(error)status(error.message,true)};
$('refresh').onclick=refresh;
$('create').onsubmit=async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{const data=await api('/keys','POST',{name:$('key-name').value});$('new-key').value=data.key;$('copy-status').textContent='';lastFocus=button;$('key-dialog').showModal();$('key-name').value='';await refresh()}catch(error){status(error.message,true)}finally{button.disabled=false}};
$('copy-key').onclick=async()=>{try{await navigator.clipboard.writeText($('new-key').value);$('copy-status').textContent='Copied. Store it as a server environment variable.'}catch{$('new-key').select();$('copy-status').textContent='Select and copy the key manually.'}};
$('close-key').onclick=()=>$('key-dialog').close();
$('key-dialog').onclose=()=>{$('new-key').value='';lastFocus?.focus()};
$('cancel-revoke').onclick=()=>$('revoke-dialog').close();
$('confirm-revoke').onclick=async()=>{$('confirm-revoke').disabled=true;try{await api(`/keys/${revokeId}`,'DELETE');$('revoke-dialog').close();await refresh();$('refresh').focus()}catch(error){status(error.message,true)}finally{$('confirm-revoke').disabled=false}};
$('revoke-dialog').onclose=()=>lastFocus?.focus();
function render(next){session=next;++generation;$('login').hidden=!!session;$('console').hidden=!session;$('signout').hidden=!session;if(session){$('identity').textContent=session.user.email??'Signed in with GitHub';void refresh()}else{$('key-list').replaceChildren();$('new-key').value='';$('key-dialog').close();status('')}}
// Do not await Supabase calls inside the auth callback.
supabase.auth.onAuthStateChange((_event,next)=>{setTimeout(()=>render(next),0)});
supabase.auth.getSession().then(({data,error})=>{if(error)status(error.message,true);else render(data.session)});
