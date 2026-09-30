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
  window.MordheimundaAPI={request,health:()=>request('/api/health'),session:()=>request('/api/account/me'),register:p=>request('/api/auth/register',{method:'POST',body:JSON.stringify(p)}),login:p=>request('/api/auth/login',{method:'POST',body:JSON.stringify(p)}),logout:()=>request('/api/auth/logout',{method:'POST'}),
  /* Local-dev only — see localDevAdmin in server.js. 403 on the live site. */
  devAdminLogin:()=>request('/api/auth/dev-admin',{method:'POST'}),recoverPassword:p=>request('/api/auth/forgot-password',{method:'POST',body:JSON.stringify(p)}),resetPassword:p=>request('/api/auth/reset-password',{method:'POST',body:JSON.stringify(p)}),verifyEmail:p=>request('/api/auth/verify-email',{method:'POST',body:JSON.stringify(p)}),resendVerification:()=>request('/api/auth/resend-verification',{method:'POST'}),recoverUsername:p=>request('/api/auth/forgot-username',{method:'POST',body:JSON.stringify(p)}),changePassword:p=>request('/api/account/change-password',{method:'POST',body:JSON.stringify(p)}),loadData:()=>request('/api/account/data'),dataRevision:()=>request('/api/account/data/revision'),saveData:(data,expectedRevision=null)=>request('/api/account/data',{method:'PUT',body:JSON.stringify({data,...(Number.isInteger(expectedRevision)?{expectedRevision}:{})})}),officialWarbands:()=>request('/api/warbands/official'),adminListWarbands:()=>request('/api/admin/warbands'),adminGetWarband:id=>request('/api/admin/warbands/'+encodeURIComponent(id)),adminOfficializeWarband:p=>request('/api/admin/warbands',{method:'POST',body:JSON.stringify(p)}),adminUpdateOfficialWarband:(id,p)=>request('/api/admin/warbands/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify(p)}),adminSetOfficialWarbandStatus:(id,status)=>request('/api/admin/warbands/'+encodeURIComponent(id)+'/status',{method:'PATCH',body:JSON.stringify({status})}),adminSetWarbandSupplement:(id,baseFactionId)=>request('/api/admin/warbands/'+encodeURIComponent(id)+'/supplement',{method:'PATCH',body:JSON.stringify({baseFactionId:baseFactionId||null})}),adminDeleteOfficialWarband:id=>request('/api/admin/warbands/'+encodeURIComponent(id),{method:'DELETE'}),adminListAdmins:()=>request('/api/admin/admins'),adminPromote:identifier=>request('/api/admin/promote',{method:'POST',body:JSON.stringify({identifier})}),adminDemote:identifier=>request('/api/admin/demote',{method:'POST',body:JSON.stringify({identifier})}),
  /* Friends (V89) — contact list only, never grants warband/custom-content access. */
  friends:()=>request('/api/friends'),
  sendFriendRequest:identifier=>request('/api/friends/requests',{method:'POST',body:JSON.stringify({identifier})}),
  acceptFriendRequest:id=>request('/api/friends/requests/'+encodeURIComponent(id)+'/accept',{method:'POST'}),
  declineFriendRequest:id=>request('/api/friends/requests/'+encodeURIComponent(id)+'/decline',{method:'POST'}),
  cancelFriendRequest:id=>request('/api/friends/requests/'+encodeURIComponent(id),{method:'DELETE'}),
  removeFriend:userId=>request('/api/friends/'+encodeURIComponent(userId),{method:'DELETE'}),
  /* Admin support (V89, write added V146) — lookup and direct edit of
     another account's data. Every call is logged server-side (view vs edit). */
  adminSupportSearch:q=>request('/api/admin/support/search?q='+encodeURIComponent(q||'')),
  adminSupportView:userId=>request('/api/admin/support/'+encodeURIComponent(userId)),
  adminSupportSaveData:(userId,data,expectedRevision=null)=>request('/api/admin/support/'+encodeURIComponent(userId)+'/data',{method:'PUT',body:JSON.stringify({data,...(Number.isInteger(expectedRevision)?{expectedRevision}:{})})}),
  accountAccessLog:()=>request('/api/account/access-log'),
  /* Rulebook text overrides (V145) — public read, admin-only write. Lets an
     admin correct a page of the built-in rulebook (baked into RULES_BOOK in
     app.js) from the Règles tab itself, without editing code/redeploying. */
  ruleOverrides:()=>request('/api/rules/overrides'),
  adminSaveRuleOverride:(sectionId,page,text)=>request('/api/admin/rules/overrides',{method:'PUT',body:JSON.stringify({sectionId,page,text})}),
  adminDeleteRuleOverride:(sectionId,page)=>request('/api/admin/rules/overrides/'+encodeURIComponent(sectionId)+'/'+encodeURIComponent(page),{method:'DELETE'}),
  /* Base M17 catalog overrides (V147) — public read, admin-only write. Lets
     an admin correct a book faction's fighter profiles/equipment (baked into
     data/catalog.js) from the site itself, without editing code/redeploying. */
  catalogOverrides:()=>request('/api/catalog/overrides'),
  adminSaveCatalogOverride:(factionId,p)=>request('/api/admin/catalog/overrides/'+encodeURIComponent(factionId),{method:'PUT',body:JSON.stringify(p)}),
  adminResetCatalogOverride:factionId=>request('/api/admin/catalog/overrides/'+encodeURIComponent(factionId),{method:'DELETE'}),
  /* Shared weapon/gear pool overrides (V148) — public read, admin-only
     write. Lets an admin correct or add to the D.weapons pool every
     faction/warband draws from, without editing data/catalog.js. */
  weaponOverrides:()=>request('/api/catalog/weapon-overrides'),
  adminSaveWeaponOverride:(name,data)=>request('/api/admin/catalog/weapon-overrides/'+encodeURIComponent(name),{method:'PUT',body:JSON.stringify({data})}),
  adminResetWeaponOverride:name=>request('/api/admin/catalog/weapon-overrides/'+encodeURIComponent(name),{method:'DELETE'}),
  /* Race-category tags for the "Create warband" picker (V149) — public
     read, admin-only write. */
  raceTags:()=>request('/api/catalog/race-tags'),
  adminSetRaceTag:(factionId,race)=>request('/api/admin/catalog/race-tags/'+encodeURIComponent(factionId),{method:'PUT',body:JSON.stringify({race})}),
  adminClearRaceTag:factionId=>request('/api/admin/catalog/race-tags/'+encodeURIComponent(factionId),{method:'DELETE'}),
  /* Rules-page nav categories (V151) — public read, admin-only write. Lets
     an admin rename/reorder/add/delete the Règles topic-grid theme groups
     and move sections between them, from the site itself. */
  ruleNavGroups:()=>request('/api/rules/nav-groups'),
  adminSaveRuleNavGroups:groups=>request('/api/admin/rules/nav-groups',{method:'PUT',body:JSON.stringify({groups})}),
  adminResetRuleNavGroups:()=>request('/api/admin/rules/nav-groups',{method:'DELETE'}),
  /* Official magic-domain display overrides (Task #56) — admin-only rename
     + frame color for a book domain/prayer list, shown in the Reference.
     Public read, admin-only write. */
  domainOverrides:()=>request('/api/catalog/domain-overrides'),
  adminSaveDomainOverride:(domainKey,data)=>request('/api/admin/catalog/domain-overrides/'+encodeURIComponent(domainKey),{method:'PUT',body:JSON.stringify(data)}),
  adminResetDomainOverride:domainKey=>request('/api/admin/catalog/domain-overrides/'+encodeURIComponent(domainKey),{method:'DELETE'}),
  /* Admin-attached weapon profile for a BOOK spell (V-SPELLWEAPON-BOOK, made
     shared in Task #84) — public read, admin-only write. Previously stored
     only in the admin's own account data, so it never showed up for any
     other player. */
  spellWeaponProfiles:()=>request('/api/catalog/spell-weapon-profiles'),
  adminSaveSpellWeaponProfile:(entryId,data)=>request('/api/admin/catalog/spell-weapon-profiles/'+encodeURIComponent(entryId),{method:'PUT',body:JSON.stringify({data})}),
  adminDeleteSpellWeaponProfile:entryId=>request('/api/admin/catalog/spell-weapon-profiles/'+encodeURIComponent(entryId),{method:'DELETE'})};
})();
