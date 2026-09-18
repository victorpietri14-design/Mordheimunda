/* Single network boundary for authentication and cloud persistence. */
(function(){
  const cfg=()=>window.MORDHEIMUNDA_CONFIG||{};
  async function request(path,options={}){
    const configured=String(cfg().apiBaseUrl||'').replace(/\/$/,'');
    const base=configured || ((/^https?:$/.test(location.protocol))?location.origin:'');
    if(!base)throw new Error('API_NOT_CONFIGURED');
    const init={credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})},...options};
    if(options.keepalive===true) init.keepalive=true;
    const res=await fetch(base+path,init);let body=null;try{body=await res.json()}catch{}
    if(!res.ok){const e=new Error(body?.error||`HTTP_${res.status}`);e.status=res.status;throw e}return body;
  }
  window.MordheimundaAPI={request,health:()=>request('/api/health'),session:()=>request('/api/account/me'),register:p=>request('/api/auth/register',{method:'POST',body:JSON.stringify(p)}),login:p=>request('/api/auth/login',{method:'POST',body:JSON.stringify(p)}),logout:()=>request('/api/auth/logout',{method:'POST'}),recoverPassword:p=>request('/api/auth/forgot-password',{method:'POST',body:JSON.stringify(p)}),resetPassword:p=>request('/api/auth/reset-password',{method:'POST',body:JSON.stringify(p)}),recoverUsername:p=>request('/api/auth/forgot-username',{method:'POST',body:JSON.stringify(p)}),changePassword:p=>request('/api/account/change-password',{method:'POST',body:JSON.stringify(p)}),loadData:()=>request('/api/account/data'),dataRevision:()=>request('/api/account/data/revision'),saveData:(data,expectedRevision=null)=>request('/api/account/data',{method:'PUT',body:JSON.stringify({data,...(Number.isInteger(expectedRevision)?{expectedRevision}:{})})}),officialWarbands:()=>request('/api/warbands/official'),adminListWarbands:()=>request('/api/admin/warbands'),adminGetWarband:id=>request('/api/admin/warbands/'+encodeURIComponent(id)),adminOfficializeWarband:p=>request('/api/admin/warbands',{method:'POST',body:JSON.stringify(p)}),adminUpdateOfficialWarband:(id,p)=>request('/api/admin/warbands/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify(p)}),adminSetOfficialWarbandStatus:(id,status)=>request('/api/admin/warbands/'+encodeURIComponent(id)+'/status',{method:'PATCH',body:JSON.stringify({status})}),adminDeleteOfficialWarband:id=>request('/api/admin/warbands/'+encodeURIComponent(id),{method:'DELETE'}),adminListAdmins:()=>request('/api/admin/admins'),adminPromote:identifier=>request('/api/admin/promote',{method:'POST',body:JSON.stringify({identifier})}),adminDemote:identifier=>request('/api/admin/demote',{method:'POST',body:JSON.stringify({identifier})})};
})();
