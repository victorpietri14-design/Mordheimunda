/* Admin panel code, loaded on demand by ensureAdminCode() in app.js (V-ADMINLAZY).
   Shares app.js's globals: it must load after app.js. */
function adminCurrentSection(){return (adminOpenCategory&&adminGroupOf(adminOpenCategory))||adminSection}
function setAdminSection(k){if(!ADMIN_GROUPS[k])return;adminSection=k;adminOpenCategory=null;try{localStorage.setItem('mu_ui_adminSection',k)}catch(e){}render('admin')}
function adminSectionTabsMarkup(){const en=siteLanguage==='en',cur=adminCurrentSection();const L={site:en?'Site':'Gestion du site',content:en?'Content':'Gestion du contenu',players:en?'Players':'Joueurs'},H={site:en?'Admins, traffic, translation, backup':'Admins, trafic, traduction, sauvegarde',content:en?'Warbands, gear, rules, scenarios, quests, trophies':'Warbands, équipement, règles, scénarios, quêtes, trophées',players:en?'Players’ warbands (support)':'Bandes des joueurs (support)'};
  return `<div class="admin-section-tabs" style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px">${Object.keys(ADMIN_GROUPS).map(k=>`<button type="button" class="button ${k===cur?'primary':'secondary'}" style="flex:1 1 160px;text-align:left;padding:10px 14px" onclick="setAdminSection('${k}')"><strong>${L[k]}</strong><br><small style="opacity:.75;font-weight:400">${H[k]}</small></button>`).join('')}</div>`}
function setAdminOpenCategory(id){adminOpenCategory=(adminOpenCategory===id)?null:id;const g=adminGroupOf(id);if(g){adminSection=g;try{localStorage.setItem('mu_ui_adminSection',g)}catch(e){}}render('admin')}
function adminCategoryBar(id,label,hint,open){
  if(adminGroupOf(id)&&adminGroupOf(id)!==adminCurrentSection())return '';
  label=String(label).replace(/^(Gestion|Manage) · /,''); // the page title already says it
  return `<button type="button" class="admin-category-bar${open?' open':''}" onclick="setAdminOpenCategory('${id}')"><span class="admin-category-label"><strong>${esc(label)}</strong>${hint?`<small>${esc(hint)}</small>`:''}</span><span class="admin-category-chevron">${open?'▾':'▸'}</span></button>`;
}
async function loadAdminData(){
  if(adminLoading)return;adminLoading=true;
  try{
    const[a,w]=await Promise.all([window.MordheimundaAPI.adminListAdmins(),window.MordheimundaAPI.adminListWarbands()]);
    adminAdminsCache=a.admins||[];adminOfficialCache=w.warbands||[];
  }catch(e){
    adminAdminsCache=adminAdminsCache||[];adminOfficialCache=adminOfficialCache||[];
    toast(authError(e,siteLanguage==='en'));
  }
  adminLoading=false;
  if(parseAppRoute().view==='admin')render('admin');
}
function adminReal(){
  const en=siteLanguage==='en';
  if(!isAdminSession()){$('#content').innerHTML=`<div class="empty large"><strong>${en?'Admins only':'Réservé aux administrateurs'}</strong></div>`;return}
  if((adminRulesEditId&&adminRulesEditData)||(adminCatalogFactionId&&adminCatalogEditData)){$('#content').innerHTML=adminWarbandRulesPanel();return}
  if(adminScenarioEditData){syncScenarioEditorFormToDraft();$('#content').innerHTML=scenarioEditorPanel();setTimeout(initScenarioEditorAutoGrow,0);return}
  if(adminMapBuilderData){$('#content').innerHTML=mapBuilderPanel();setTimeout(bindMapBuilderStage,30);return}
  if(adminWeaponEditName){$('#content').innerHTML=adminWeaponEditPage();return}
  if(adminAdminsCache===null||adminOfficialCache===null){
    $('#content').innerHTML=`<div class="admin-page"><div class="page-intro"><div><div class="eyebrow">ADMIN / CONTROL</div><h2>Admin</h2></div></div><div class="empty compact">${en?'Loading…':'Chargement…'}</div></div>`;
    loadAdminData();
    return;
  }
  const admins=adminAdminsCache,officials=adminOfficialCache,customs=customWarbandList();
  // Already-officialized warbands must not be re-offered here — they're the
  // ones this same list would otherwise let an admin click "Make official"
  // on again, which creates a brand-new official_warbands row and silently
  // orphans the previous one instead of updating it. Editing/unpublishing
  // an already-official warband happens from the PUBLISHED list below.
  const customsToOfficialize=customs.filter(cw=>!cw.officialId);
  $('#content').innerHTML=`<div class="admin-page">
    <div class="page-intro"><div><div class="eyebrow">ADMIN / CONTROL</div><h2>${en?'Admin':'Admin'}</h2><p>${en?'Grant admin access and turn one of your custom warbands into an official warband available to every account.':'Accorde le statut admin et transforme une de tes warbands custom en bande officielle disponible pour tous les comptes.'}</p></div></div>
    <div class="ad-strip"><span class="dot"></span><b>${en?'Admins only':'Accès admin uniquement'}</b><span class="d">${en?'— this page is hidden for any account without the Admin role.':'— cette page est masquée pour tout compte sans le rôle Admin.'}</span></div>
    ${trafficAlertMarkup()}
    ${adminSectionTabsMarkup()}
    <div class="admin-categories">
      ${adminCategoryBar('accounts',en?'Admin accounts':'Comptes admin',en?`${admins.length} admin${admins.length!==1?'s':''}`:`${admins.length} admin${admins.length!==1?'s':''}`,adminOpenCategory==='accounts')}
      ${adminOpenCategory==='accounts'?`<div class="admin-category-body">
      <section class="card admin-card">
        <div class="eyebrow">${en?'ADMINS':'ADMINS'}</div>
        <h3>${en?'Admin accounts':'Comptes admin'}</h3>
        <div class="custom-item-list">${admins.length?admins.map(a=>`<article class="custom-item-row"><div class="custom-item-main"><div><strong>${esc(a.username)}</strong><small>${esc(a.email||'—')}</small></div></div><div class="custom-item-actions"><button type="button" class="equipment-action remove" onclick="confirmDemoteAdmin('${encodeURIComponent(a.username)}')">${en?'Revoke':'Retirer'}</button></div></article>`).join(''):`<div class="empty compact">${en?'No admin accounts yet.':'Aucun compte admin pour l’instant.'}</div>`}</div>
        <form class="admin-inline-form" onsubmit="promoteAdmin(event)"><label>${en?'Account email or username':'E-mail ou pseudo du compte'}<input id="adminPromoteEmail" required placeholder="joueur@example.com ${en?'or':'ou'} pseudo"></label><button class="button primary" type="submit">${en?'Grant admin':'Rendre admin'}</button></form>
      </section>
      </div>`:''}
      ${adminCategoryBar('warband',en?'Manage · Warbands':'Gestion · Warbands',en?'Officialize, publish, edit fighters, base M17 factions':'Officialiser, publier, éditer les combattants, factions M17 de base',adminOpenCategory==='warband')}
      ${adminOpenCategory==='warband'?`<div class="admin-category-body">
      <section class="card admin-card">
        <div class="eyebrow">${en?'OFFICIALIZE':'OFFICIALISER'}</div>
        <h3>${en?'Your custom warbands':'Tes warbands custom'}</h3>
        <p class="muted">${en?'Officializing keeps every fighter/equipment access restriction you defined and bundles along any custom skill, spell, trait or special rule the warband uses — all of it becomes available to every account, with the starting treasury set to the standard 1000 GC.':'Officialiser conserve toutes les restrictions d’accès (combattants/équipement) que tu as définies et embarque toute compétence, sort, trait ou règle spéciale custom utilisé par la bande — tout devient disponible pour tous les comptes, avec un trésor de départ standard de 1000 GC.'}</p>
        <div class="custom-item-list">${customsToOfficialize.length?customsToOfficialize.map(cw=>`<article class="custom-item-row"><div class="custom-item-main"><div><strong>${esc(cw.name)}</strong><small>${(cw.fighterIds||[]).length} ${en?'fighters':'combattants'}</small></div></div><div class="custom-item-actions"><button type="button" class="button secondary" onclick="officializeCustomWarband('${esc(cw.id)}')">${en?'Make official':'Rendre officielle'}</button></div></article>`).join(''):`<div class="empty compact">${customs.length?(en?'Every custom warband is already official — unpublish one to bring it back here.':'Toutes tes warbands custom sont déjà officielles — dépublie-en une pour la faire revenir ici.'):(en?'No custom warband yet — create one from the Custom tab first.':'Aucune warband custom — crées-en une depuis l’onglet Custom.')}</div>`}</div>
      </section>
      <section class="card admin-card">
        <div class="eyebrow">${en?'GESTION':'GESTION'}</div>
        <h3>${en?'Official warbands':'Bandes officielles'}</h3>
        <p class="muted">${en?'Every warband is managed here the same way, book (M17) or player-published — no separate “base catalog” bucket. Edit changes the live warband directly — fighters (profiles, max, point cost), equipment and band-wide rules — with no draft copy ever created in Custom, and no need to unpublish first. A book faction’s Manage edits its fighter profiles and Band List access the same way, layered on top of data/catalog.js without touching it, and Revert restores the original book values. Unpublish pulls a player-published warband back from every account for corrections without deleting it; permanent deletion is only possible once such a warband is a draft, and requires typing its name.':'Chaque bande se gère ici de la même façon, qu’elle vienne du livre (M17) ou d’un joueur — plus de case « catalogue de base » à part. Éditer modifie directement la bande en ligne — combattants (profils, maximum, coût en points), équipement et règles de bande — sans jamais créer de copie dans Custom, et sans besoin de dépublier au préalable. Pour une faction du livre, Gérer modifie ses profils de combattants et son accès à la Liste de Bande de la même façon, appliqué par-dessus data/catalog.js sans y toucher, et Réinitialiser restaure les valeurs d’origine du livre. Dépublier retire une bande publiée par un joueur de tous les comptes pour la corriger sans la supprimer ; la suppression définitive n’est possible qu’une fois la bande en brouillon, et demande de taper son nom.'}</p>
        <div class="custom-item-list">${
          [
            ...officials.map(w=>{const isDraft=w.status==='draft';return `<article class="custom-item-row"><div class="custom-item-main"><div><strong>${esc(w.name)}</strong>${w.supplement_of?`<span class="supplement-active">${en?'SUPPLEMENT':'SUPPLÉMENT'}</span>`:''}<small>${isDraft?`<span class="official-status-draft">${en?'DRAFT — hidden':'BROUILLON — masquée'}</span> · `:''}${en?'by':'par'} ${esc(w.created_by_username||'—')} · ${new Date(w.created_at).toLocaleDateString()}</small></div></div><div class="custom-item-actions"><button type="button" class="button secondary" title="${en?'Edit this warband directly — fighters/equipment/rules, applied immediately on save, no Custom copy':'Modifie directement cette bande — combattants/équipement/règles, appliqué immédiatement à l’enregistrement, sans copie dans Custom'}" onclick="openAdminWarbandRules('${esc(w.id)}')">✎ ${en?'Manage':'Gérer'}</button><button type="button" class="button secondary" onclick="setOfficialWarbandStatus('${esc(w.id)}','${isDraft?'published':'draft'}')">${isDraft?(en?'Republish':'Republier'):(en?'Unpublish':'Dépublier')}</button>${isDraft?`<button type="button" class="equipment-action remove" title="${en?'Delete permanently':'Supprimer définitivement'}" onclick="confirmDeleteOfficialWarband('${esc(w.id)}')">🗑</button>`:''}</div></article>`}),
            ...D.factions.filter(f=>!f.__official).map(f=>`<article class="custom-item-row"><div class="custom-item-main"><div><strong>${esc(f.displayName||f.name)}</strong><small>${f.__catalogOverridden?`<span class="official-draft-tag">${en?'MODIFIED':'MODIFIÉ'}</span> · `:''}${en?'Core book':'Livre de base'} · ${(f.warriors||[]).length} ${en?'fighters':'combattants'}</small></div></div><div class="custom-item-actions"><button type="button" class="button secondary" onclick="openAdminCatalogEdit('${esc(f.id)}')">✎ ${en?'Manage':'Gérer'}</button>${f.__catalogOverridden?`<button type="button" class="equipment-action remove" title="${en?'Revert to the book values':'Revenir aux valeurs du livre'}" onclick="resetAdminCatalogFaction('${esc(f.id)}')">↺</button>`:''}</div></article>`)
          ].join('')||`<div class="empty compact">${en?'No official warband published yet.':'Aucune bande officielle publiée pour l’instant.'}</div>`
        }</div>
      </section>
      </div>`:''}
      ${adminCategoryBar('gear',en?'Manage · Weapons & Gear':'Gestion · Armes & équipement',en?'Shared weapon/gear pool used by every faction':'Pool d’armes/équipement partagé par toutes les factions',adminOpenCategory==='gear')}
      ${adminOpenCategory==='gear'?`<div class="admin-category-body">${adminWeaponCatalogCardMarkup()}</div>`:''}
      ${adminCategoryBar('pricerules',en?'Special prices':'Prix spéciaux',en?'An item cheaper (or dearer) and worth less for one warband or one fighter type':'Un objet moins cher (ou plus cher) et de moindre valeur pour une bande ou un type de combattant',adminOpenCategory==='pricerules')}
      ${adminOpenCategory==='pricerules'?`<div class="admin-category-body">${adminPriceRulesMarkup()}</div>`:''}
      ${adminCategoryBar('racerules',en?'Manage · Rules by race':'Gestion · Règles par race',en?'Add or remove a special rule / default skill on every fighter of a race':'Ajouter ou retirer une règle spéciale / compétence par défaut sur tous les combattants d’une race',adminOpenCategory==='racerules')}
      ${adminOpenCategory==='racerules'?`<div class="admin-category-body">${adminRaceRulesCardMarkup()}</div>`:''}
      ${adminCategoryBar('racemax',en?'Manage · Racial maximums':'Gestion · Maximums raciaux',en?'Stat maximums for every fighter of a race (Automatic mode)':'Maximums de caractéristiques pour tous les combattants d’une race (mode Automatique)',adminOpenCategory==='racemax')}
      ${adminOpenCategory==='racemax'?`<div class="admin-category-body">${adminRaceMaxCardMarkup()}</div>`:''}
      ${adminCategoryBar('scenarios',en?'Manage · Scenarios':'Gestion · Scénarios',en?'Battle plans + deployment map library':'Plans de bataille + bibliothèque de cartes',adminOpenCategory==='scenarios')}
      ${adminOpenCategory==='scenarios'?`<div class="admin-category-body">${adminScenariosSectionMarkup(en)}</div>`:''}
      ${adminCategoryBar('quests',en?'Manage · Quests':'Gestion · Quêtes',en?'Quest trees and XP for Heroes, Veterans and Hired Swords':'Arbres de quêtes et XP des Héros, Vétérans et Hired Swords',adminOpenCategory==='quests')}
      ${adminOpenCategory==='quests'?`<div class="admin-category-body">${adminQuestsMarkup()}</div>`:''}
      ${adminCategoryBar('traffic',en?'Server traffic':'Trafic serveur',en?'What uses the transfer allowance, daily ceilings, emergency sync switch':'Ce qui consomme le transfert, plafonds quotidiens, interrupteur d’urgence de la synchro',adminOpenCategory==='traffic')}
      ${adminOpenCategory==='traffic'?`<div class="admin-category-body">${adminTrafficMarkup()}</div>`:''}
      ${adminCategoryBar('errors',en?'Errors received':'Erreurs reçues',en?'Bugs sent by players who turned on automatic reports':'Bugs envoyés par les joueurs qui ont activé l’envoi automatique',adminOpenCategory==='errors')}
      ${adminOpenCategory==='errors'?`<div class="admin-category-body">${adminErrorsMarkup()}</div>`:''}
      ${adminCategoryBar('translate',en?'Automatic translation':'Traduction automatique',en?'Words never translated, usage of the free allowance':'Mots jamais traduits, consommation de la partie gratuite',adminOpenCategory==='translate')}
      ${adminOpenCategory==='translate'?`<div class="admin-category-body">${adminTranslateMarkup()}</div>`:''}
      ${adminCategoryBar('backup',en?'Backup · Export everything':'Sauvegarde · Tout exporter',en?'One file with everything created on the site':'Un fichier avec tout ce qui a été créé sur le site',adminOpenCategory==='backup')}
      ${adminOpenCategory==='backup'?`<div class="admin-category-body">${adminBackupMarkup()}</div>`:''}
      ${adminCategoryBar('trophies',en?'Manage · Trophies':'Gestion · Trophées',en?'Pictures for completed Great Quests in campaign Standings':'Images des Grandes Quêtes accomplies dans le Classement de campagne',adminOpenCategory==='trophies')}
      ${adminOpenCategory==='trophies'?`<div class="admin-category-body">${adminTrophiesMarkup()}</div>`:''}
      ${adminCategoryBar('support',en?'Support · Player warbands':'Support · Bandes des joueurs',en?'Search an account and live-edit their data':'Rechercher un compte et éditer ses données en direct',adminOpenCategory==='support')}
      ${adminOpenCategory==='support'?`<div class="admin-category-body">
      <div class="admin-live-rosters card">
        <div class="eyebrow">${en?'SUPPORT / LIVE EDIT':'SUPPORT / ÉDITION EN DIRECT'}</div>
        <h3>${en?'Player warbands (live edit)':'Warbands des joueurs (édition en direct)'}</h3>
        <p class="muted">${en?'Search an account and open it — you get the exact same interface that player sees on their own warbands, just pointed at theirs. Everything you view or change there applies immediately to that player’s account, and is logged and visible to them (Account → who looked at my data).':'Recherche un compte et ouvre-le — tu obtiens exactement la même interface que ce joueur voit sur ses propres bandes, simplement pointée sur les siennes. Tout ce que tu consultes ou modifies s’applique immédiatement sur le compte du joueur, et c’est journalisé et visible par lui (Compte → qui a consulté mes données).'}</p>
        <form class="friend-search" onsubmit="adminLiveSearchUI(event)"><input id="adminLiveQuery" placeholder="${en?'Username or email… (empty = recent accounts)':'Pseudo ou e-mail… (vide = comptes récents)'}"><button class="button secondary" type="submit">${en?'Search':'Rechercher'}</button></form>
        <div id="adminLiveResult"></div>
      </div>
      </div>`:''}
    </div>
  </div>`;
}
async function adminLiveSearchUI(ev){
  if(ev&&ev.preventDefault)ev.preventDefault();
  const en=siteLanguage==='en',q=$('#adminLiveQuery')?.value.trim()||'',box=$('#adminLiveResult');if(!box)return;
  box.innerHTML=`<p class="muted">${en?'Searching…':'Recherche…'}</p>`;
  try{
    const {users}=await window.MordheimundaAPI.adminSupportSearch(q);
    box.innerHTML=users.length?`<div class="custom-item-list">${users.map(u=>`<article class="custom-item-row"><div class="custom-item-main"><div><strong>${esc(u.username)}</strong><small>${esc(u.email||'')}</small></div></div><div class="custom-item-actions"><button type="button" class="button primary tiny" onclick="enterAdminForeignSession('${esc(u.id)}')">${en?'Open as this player':'Ouvrir comme ce joueur'}</button></div></article>`).join('')}</div>`:`<p class="muted">${en?'No match.':'Aucun résultat.'}</p>`;
  }catch(e){box.innerHTML=`<p class="muted">${authError(e,en)}</p>`}
}
async function adminLiveOpenUser(userId){
  const en=siteLanguage==='en',box=$('#adminLiveResult');if(!box)return;
  box.innerHTML=`<p class="muted">${en?'Loading…':'Chargement…'}</p>`;
  try{
    const {user,data}=await window.MordheimundaAPI.adminSupportView(userId);
    adminLiveUserId=userId;adminLiveUserInfo=user;adminLiveUserData=data;
    renderAdminLiveUser();
  }catch(e){box.innerHTML=`<p class="muted">${authError(e,en)}</p>`}
}
function renderAdminLiveUser(){
  const en=siteLanguage==='en',box=$('#adminLiveResult');if(!box||!adminLiveUserData)return;
  const rosters=(adminLiveUserData?.payload?.rosters||[]);
  box.innerHTML=`<div class="admin-support-view">
    <p><strong>${esc(adminLiveUserInfo.username)}</strong> — ${esc(adminLiveUserInfo.email||'')} · ${en?'server revision':'révision serveur'} ${esc(String(adminLiveUserData.revision??'—'))}</p>
    <div class="custom-item-list">${rosters.length?rosters.map((r,i)=>`<article class="custom-item-row"><div class="custom-item-main"><div><strong>${esc(r.name||(en?'Unnamed':'Sans nom'))}</strong><small>${(r.fighters||[]).length} ${en?'fighters':'combattants'} · ${r.gold??0} GC · ${en?'rep.':'rép.'} ${r.reputation??0}</small></div></div><div class="custom-item-actions"><button type="button" class="button secondary tiny" onclick="adminLiveEditRoster(${i})">✎ ${en?'Edit':'Éditer'}</button></div></article>`).join(''):`<div class="empty compact">${en?'No warband.':'Aucune bande.'}</div>`}</div>
    <button class="button secondary tiny" type="button" onclick="adminLiveUserData=null;adminLiveUserId=null;adminLiveUserInfo=null;$('#adminLiveResult').innerHTML=''">${en?'Close':'Fermer'}</button>
  </div>`;
}
function adminLiveEditRoster(idx){
  const en=siteLanguage==='en';const r=(adminLiveUserData?.payload?.rosters||[])[idx];if(!r)return;
  openModal(`<div class="admin-live-editor">
    <div class="eyebrow">${en?'LIVE EDIT':'ÉDITION EN DIRECT'}</div>
    <h2>${esc(r.name||(en?'Unnamed':'Sans nom'))}</h2>
    <p class="muted">${en?'Full warband data as JSON. Saving applies immediately to this player’s account.':'Données complètes de la bande en JSON. L’enregistrement s’applique immédiatement au compte du joueur.'}</p>
    <textarea id="adminLiveEditorText" class="admin-live-editor-text" spellcheck="false" rows="20">${esc(JSON.stringify(r,null,2))}</textarea>
    <div class="account-actions"><button class="button primary" type="button" onclick="adminLiveSaveRoster(${idx})">${en?'Save':'Enregistrer'}</button><button class="button secondary" type="button" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>
  </div>`);
}
async function adminLiveSaveRoster(idx){
  const en=siteLanguage==='en';const ta=$('#adminLiveEditorText');if(!ta||!adminLiveUserData)return;
  let parsed;try{parsed=JSON.parse(ta.value);}catch(e){toast(en?'Invalid JSON.':'JSON invalide.');return;}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)){toast(en?'Invalid JSON.':'JSON invalide.');return;}
  const payload={...(adminLiveUserData.payload||{})};
  const rosters=[...(payload.rosters||[])];rosters[idx]=parsed;payload.rosters=rosters;
  try{
    const res=await window.MordheimundaAPI.adminSupportSaveData(adminLiveUserId,payload,adminLiveUserData.revision);
    adminLiveUserData={...adminLiveUserData,payload,revision:res.revision,updated_at:res.updatedAt};
    closeModal();toast(en?'Saved.':'Enregistré.');renderAdminLiveUser();
  }catch(e){
    if(e.status===409){toast(en?'This account changed since it was loaded — reloading the latest version, please redo your edit.':'Ce compte a changé depuis le chargement — rechargement de la dernière version, refais ta modification.');closeModal();await adminLiveOpenUser(adminLiveUserId);}
    else toast(authError(e,en));
  }
}
async function promoteAdmin(ev){ev.preventDefault();const en=siteLanguage==='en';const identifier=$('#adminPromoteEmail')?.value.trim();if(!identifier)return;try{await window.MordheimundaAPI.adminPromote(identifier);adminAdminsCache=null;toast(en?'Admin granted':'Statut admin accordé');render('admin');}catch(e){toast(authError(e,en));}}
function confirmDemoteAdmin(encoded){
  const en=siteLanguage==='en';
  let username=encoded;try{username=decodeURIComponent(encoded)}catch(err){}
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'REVOKE ADMIN':'RETRAIT ADMIN'}</div><h2>${en?`Revoke admin access for “${esc(username)}”?`:`Retirer le statut admin de « ${esc(username)} » ?`}</h2><p>${en?'This account will immediately lose access to the Admin page.':'Ce compte perdra immédiatement l’accès à la page Admin.'}</p><button type="button" class="big-delete" onclick="demoteAdmin('${encoded}')">${en?'REVOKE ADMIN':'RETIRER LE STATUT ADMIN'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`);
}
async function demoteAdmin(identifier){
  if(!identifier)return;const en=siteLanguage==='en';
  let username=identifier;try{username=decodeURIComponent(identifier)}catch(err){}
  try{await window.MordheimundaAPI.adminDemote(username);adminAdminsCache=null;closeModal();toast(en?'Admin revoked':'Statut admin retiré');render('admin');}catch(e){toast(authError(e,en));}
}
async function resetAdminCatalogFaction(factionId){
  const en=siteLanguage==='en';
  try{
    await window.MordheimundaAPI.adminResetCatalogOverride(factionId);
    await loadCatalogOverrides();
    toast(en?'Reverted to the book values':'Revenu aux valeurs du livre');
    render('admin');
  }catch(e){toast(authError(e,en));}
}
async function adminRestoreDeletedWeapon(name){
  const en=siteLanguage==='en';
  const baseline=(D.__weaponsBaseline||[]).some(w=>normName(w.name)===normName(name));
  try{
    // A book item goes back to its book values; an admin-added item can't
    // be "un-deleted" to anything but its last data, so drop the flag only.
    if(baseline)await window.MordheimundaAPI.adminResetWeaponOverride(name);
    else{const o={...(weaponOverrideMap.get(name)||{name})};delete o.deleted;o.hidden=false;await window.MordheimundaAPI.adminSaveWeaponOverride(name,o)}
    await loadWeaponOverrides();toast(en?`${name} restored — reload the page to see it back in every list`:`${name} restauré — recharge la page pour le revoir dans toutes les listes`);render('admin');
  }catch(e){toast(authError(e,en));}
}
function adminRaceMaxRaces(){
  const fromProfiles=[...(D.factions||[]).flatMap(f=>(f.warriors||[]).map(warriorRaceName)),...customFighterList().map(w=>w.race||'')].filter(Boolean);
  const all=[...fromProfiles,...raceMaximumsNames.values(),...adminRaceMaxExtra];
  const seen=new Set(),out=[];all.forEach(r=>{const k=normName(r);if(!k||seen.has(k))return;seen.add(k);out.push(r)});
  return out.sort((a,b)=>a.localeCompare(b));
}
function adminRaceMaxCardMarkup(){
  const en=siteLanguage==='en';const races=adminRaceMaxRaces();
  const bookFor=r=>{const k=Object.keys(MAX_RACE).find(n=>normName(n)===normName(r));return k?MAX_RACE[k]:null};
  return `<div class="admin-live-rosters card"><div class="eyebrow">${en?'RACIAL MAXIMUMS':'MAXIMUMS RACIAUX'}</div>
   <p class="muted">${en?'Stat maximums for every fighter of a race whose profile is in “Automatic” maximums mode. An empty cell keeps the automatic cap (base + usual bonus) for that stat. A profile set to “Manual” (e.g. Vampires) keeps its own maximums. Applies live to every warband, already-recruited fighters included.':'Maximums de caractéristiques pour tous les combattants d’une race dont le profil est en mode des maximums « Automatique ». Une case vide garde le maximum automatique (base + bonus habituel) pour cette caractéristique. Un profil en mode « Manuel » (ex. Vampires) garde ses propres maximums. S’applique en direct à toutes les bandes, combattants déjà recrutés compris.'}</p>
   <div style="overflow:auto"><table class="custom-stat-bar race-max-table"><tr><th style="text-align:left">${en?'Race':'Race'}</th>${P.map((n,i)=>`<th title="${esc(P_FULL[i])}">${esc(n)}</th>`).join('')}<th></th></tr>
   ${races.map(r=>{const cur=raceMaximumsMap.get(normName(r))||[];const book=bookFor(r);return `<tr class="raceMaxRow" data-race="${esc(r)}"><td style="text-align:left;white-space:nowrap"><b>${esc(r)}</b>${cur.some(v=>v!==null&&v!==undefined)?' <span class="archived-tag official-tag">✓</span>':''}</td>${P.map((n,i)=>`<td><input class="raceMaxCell" data-i="${i}" type="number" min="0" step="1" value="${cur[i]===null||cur[i]===undefined?'':esc(cur[i])}" placeholder="${book?esc(book[i]):'—'}"></td>`).join('')}<td style="white-space:nowrap">${book?`<button type="button" class="equipment-action" title="${en?'Fill with the book values (placeholders)':'Remplir avec les valeurs du livre (grisées)'}" onclick="adminRaceMaxFillBook(this)">📖</button>`:''}<button type="button" class="equipment-action remove" title="${en?'Clear this race':'Vider cette race'}" onclick="this.closest('tr').querySelectorAll('.raceMaxCell').forEach(x=>x.value='')">✕</button></td></tr>`}).join('')}
   </table></div>
   <div class="custom-trait-add" style="margin-top:10px"><input id="raceMaxNew" placeholder="${en?'Add a race…':'Ajouter une race…'}"><button type="button" class="button secondary" onclick="adminRaceMaxAddRace()">＋ ${en?'Add':'Ajouter'}</button></div>
   <div class="custom-actions"><button type="button" class="button primary" onclick="saveAdminRaceMaximums()">${en?'Save racial maximums':'Enregistrer les maximums raciaux'}</button></div>
  </div>`;
}
function adminRaceMaxFillBook(btn){btn.closest('tr').querySelectorAll('.raceMaxCell').forEach(x=>{if(x.placeholder&&x.placeholder!=='—')x.value=x.placeholder})}
function adminRaceMaxAddRace(){const v=($('#raceMaxNew')?.value||'').trim();if(!v)return;if(!adminRaceMaxRaces().some(r=>normName(r)===normName(v)))adminRaceMaxExtra.push(v);render('admin')}
async function saveAdminRaceMaximums(){
  const en=siteLanguage==='en';const ops=[];
  document.querySelectorAll('.raceMaxRow').forEach(tr=>{
    const race=tr.dataset.race;const vals=[...tr.querySelectorAll('.raceMaxCell')].map(x=>x.value.trim()===''?null:Math.max(0,Number(x.value)));
    const cur=raceMaximumsMap.get(normName(race))||null;const empty=vals.every(v=>v===null||!Number.isFinite(v));
    const norm=vals.map(v=>v===null||!Number.isFinite(v)?null:v);
    if(empty){if(cur)ops.push(window.MordheimundaAPI.adminClearRaceMaximums(race));return}
    if(!cur||JSON.stringify(cur.map(v=>v===undefined?null:v))!==JSON.stringify(norm))ops.push(window.MordheimundaAPI.adminSetRaceMaximums(race,norm));
  });
  if(!ops.length){toast(en?'Nothing changed':'Rien n’a changé');return}
  try{await Promise.all(ops);await loadRaceMaximums();adminRaceMaxExtra=[];render('admin');toast(en?`Saved — ${ops.length} race${ops.length>1?'s':''} updated`:`Enregistré — ${ops.length} race${ops.length>1?'s':''} mise${ops.length>1?'s':''} à jour`)}
  catch(e){toast(authError(e,en))}
}
function setAdminWeaponSearch(v){adminWeaponSearch=v;render('admin')}
function adminRaceRulesCardMarkup(){
  const en=siteLanguage==='en';
  const races=[...new Set([...(D.factions||[]).flatMap(f=>(f.warriors||[]).map(warriorRaceName)),...customFighterList().map(w=>w.race||'')].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const rules=referenceEntries('special').map(e=>e.name).filter(Boolean).sort((a,b)=>a.localeCompare(b));
  const plan=adminRaceRulesPlan;
  return `<div class="admin-live-rosters card"><div class="eyebrow">${en?'RULES BY RACE':'RÈGLES PAR RACE'}</div>
   <p class="muted">${en?'Writes the change into every profile of that race (Base catalog, official warbands, your Custom profiles), as if done by hand in each editor — so you can edit or remove it there later. Already-recruited fighters follow their profile.':'Écrit le changement dans chaque profil de cette race (catalogue de base, warbands officielles, tes profils Custom), comme si tu le faisais à la main dans chaque éditeur — tu peux donc le modifier ou l’enlever plus tard au même endroit. Les combattants déjà recrutés suivent leur profil.'}</p>
   <div class="custom-form-grid">
    <label class="custom-field"><span>${en?'Race':'Race'}</span><select id="rrRace">${races.map(r=>`<option ${normName(r)==='dwarf'?'selected':''}>${esc(r)}</option>`).join('')}</select></label>
    <label class="custom-field"><span>${en?'Action':'Action'}</span><select id="rrMode"><option value="add">${en?'Add the rule':'Ajouter la règle'}</option><option value="remove">${en?'Remove the rule':'Retirer la règle'}</option></select></label>
    <label class="custom-field wide"><span>${en?'Special rule':'Règle spéciale'}</span><input id="rrRule" list="rrRuleList" placeholder="${en?'e.g. Dwarfen Resilience':'ex. Dwarfen Resilience'}"><datalist id="rrRuleList">${rules.map(r=>`<option value="${esc(r)}">`).join('')}</datalist></label>
    <label class="custom-field wide"><span>${en?'Also remove this default skill (optional)':'Retirer aussi cette compétence par défaut (optionnel)'}</span><input id="rrSkill" list="rrSkillList" placeholder="${en?'e.g. True Grit':'ex. True Grit'}"><datalist id="rrSkillList">${customFighterSkillNames().map(r=>`<option value="${esc(r)}">`).join('')}</datalist></label>
   </div>
   <div class="custom-actions"><button type="button" class="button secondary" onclick="previewAdminRaceRules()">${en?'Preview':'Aperçu'}</button>${plan&&plan.total?`<button type="button" class="button primary" onclick="applyAdminRaceRules()">${en?`Apply to ${plan.total} profile${plan.total>1?'s':''}`:`Appliquer à ${plan.total} profil${plan.total>1?'s':''}`}</button>`:''}</div>
   ${plan?`<div class="muted" style="margin-top:8px">${plan.total?customCleanupListMarkup(plan.rows):(en?'Nothing to change.':'Rien à changer.')}</div>`:''}
  </div>`;
}
async function adminRaceRulesCollect(op){
  // Fresh copies of every editable definition, with the change applied.
  const targets=[];
  (D.factions||[]).filter(f=>!f.__official&&!String(f.id||'').startsWith('custom-warband-')&&(f.warriors||[]).length).forEach(f=>{
    const d=bookCatalogDefinition(f.id);if(!d)return;const names=[];
    d.warriors.forEach(w=>{if(normName(warriorRaceName(w))===normName(op.race)&&applyRaceRuleToWarrior(w,op))names.push(w.name)});
    if(names.length)targets.push({kind:'book',id:f.id,label:`${en2('Base','Base')} · ${f.displayName||f.id}`,names,d});
  });
  try{
    const {warbands}=await window.MordheimundaAPI.adminListWarbands();
    for(const row of (warbands||[])){
      if(isContentPoolWarband(row))continue;
      const res=await window.MordheimundaAPI.adminGetWarband(row.id);const full=res?.warband||res;if(!full)continue;
      const d={name:full.name,warriors:arr2(full.warriors),equipment:arr2(full.equipment),skillTrees:arr2(full.skillTrees),skills:arr2(full.skills),magicDomains:arr2(full.magicDomains),spells:arr2(full.spells),traits:arr2(full.traits),specialRules:arr2(full.specialRules),bandRuleNames:arr2(full.bandRuleNames),creatures:arr2(full.creatures)};
      const names=[];d.warriors.forEach(w=>{if(normName(warriorRaceName(w))===normName(op.race)&&applyRaceRuleToWarrior(w,op))names.push(w.name)});
      if(names.length)targets.push({kind:'official',id:row.id,label:row.name+(row.status&&row.status!=='published'?` (${row.status})`:''),names,d});
    }
  }catch(e){}
  const customs=customFighterList().filter(w=>normName(w.race||'')===normName(op.race)).filter(w=>applyRaceRuleToWarrior(JSON.parse(JSON.stringify(w)),op));
  if(customs.length)targets.push({kind:'custom',id:'custom',label:'Custom',names:customs.map(w=>w.name),ids:customs.map(w=>w.customFighterId)});
  return targets;
}
function adminRaceRulesReadOp(){return {race:$('#rrRace')?.value||'',mode:$('#rrMode')?.value||'add',rule:($('#rrRule')?.value||'').trim(),dropSkill:($('#rrSkill')?.value||'').trim()}}
async function previewAdminRaceRules(){
  const en=siteLanguage==='en';const op=adminRaceRulesReadOp();
  if(!op.race||(!op.rule&&!op.dropSkill)){toast(en?'Pick a race and a rule (or a skill)':'Choisis une race et une règle (ou une compétence)');return}
  const targets=await adminRaceRulesCollect(op);
  adminRaceRulesPlan={op,targets,total:targets.reduce((n,t)=>n+t.names.length,0),rows:targets.map(t=>`${t.label} — ${t.names.join(', ')}`)};
  render('admin');
  const keep=()=>{const set=(id,v)=>{const el=$(id);if(el)el.value=v};set('#rrRace',op.race);set('#rrMode',op.mode);set('#rrRule',op.rule);set('#rrSkill',op.dropSkill)};keep();
}
async function applyAdminRaceRules(){
  const en=siteLanguage==='en';const plan=adminRaceRulesPlan;if(!plan)return;
  // Re-collect right before writing, so nothing edited meanwhile is lost.
  const targets=await adminRaceRulesCollect(plan.op);let n=0;
  try{
    for(const t of targets){
      if(t.kind==='book'){const d=t.d;await window.MordheimundaAPI.adminSaveCatalogOverride(t.id,{warriors:d.warriors,equipment:d.equipment,bandRuleNames:d.bandRuleNames,traits:d.traits,specialRules:d.specialRules,skillTrees:d.skillTrees,skills:d.skills,magicDomains:d.magicDomains,spells:d.spells})}
      else if(t.kind==='official')await window.MordheimundaAPI.adminUpdateOfficialWarband(t.id,{...t.d,viaAdminEditor:true});
      else t.ids.forEach(id=>{const w=customFighterById(id);if(w)applyRaceRuleToWarrior(w,plan.op)});
      n+=t.names.length;
    }
    save(true);
    try{await loadCatalogOverrides();adminOfficialCache=null;await loadOfficialWarbands()}catch(e){}
    adminRaceRulesPlan=null;toast(en?`${n} profile${n>1?'s':''} updated`:`${n} profil${n>1?'s':''} mis à jour`);render('admin');
  }catch(e){toast(authError(e,en));}
}
function adminWeaponEditPage(){
  const en=siteLanguage==='en';
  return `<div class="admin-page"><div class="page-intro"><div><div class="eyebrow">ADMIN</div><h2>${en?'Weapons & gear catalog':'Catalogue d’armes & équipement'}</h2></div><button type="button" class="button secondary" onclick="closeAdminWeaponEdit()">← ${en?'Back to Admin':'Retour à Admin'}</button></div><section class="card admin-card">${adminWeaponFormMarkup(adminWeaponEditName)}</section></div>`;
}
function adminWeaponCatalogCardMarkup(){
  const en=siteLanguage==='en';
  const q=(adminWeaponSearch||'').trim().toLowerCase();
  let list=(D.weapons||[]).slice().sort((a,b)=>a.name.localeCompare(b.name));
  if(q)list=list.filter(w=>(w.name||'').toLowerCase().includes(q)||(equipmentCategory(w)||'').toLowerCase().includes(q));
  const baselineNames=new Set((D.__weaponsBaseline||D.weapons).map(w=>normName(w.name)));
  return `<div class="admin-live-rosters card">
    <div class="eyebrow">${en?'GESTION':'GESTION'} — ${en?'WEAPONS & GEAR CATALOG':'CATALOGUE D’ARMES & ÉQUIPEMENT'}</div>
    <h3>${en?'Shared pool':'Pool partagé'}</h3>
    <p class="muted">${en?'The single shared list every faction and warband draws its equipment from. Editing an item here changes it everywhere it’s used; a faction’s own access to it is set from its Base catalog → Equipment tab above.':'La liste partagée unique dont proviennent les équipements de toutes les factions et bandes. Modifier un objet ici le change partout où il est utilisé ; l’accès d’une faction à cet objet se règle depuis l’onglet Équipement de son Catalogue de base ci-dessus.'}</p>
    <div class="custom-form-grid" style="margin-bottom:10px"><label class="custom-field wide"><span>${en?'Search':'Recherche'}</span><input class="admin-weapon-search" value="${esc(adminWeaponSearch||'')}" oninput="setAdminWeaponSearch(this.value)" placeholder="${en?'Filter by name or category…':'Filtrer par nom ou sous-catégorie…'}"></label></div>
    <div class="custom-item-list" style="max-height:420px;overflow:auto">${list.map(w=>{const isBaseline=baselineNames.has(normName(w.name)),overridden=weaponOverrideMap.has(w.name);return `<article class="custom-item-row${w.hidden?' is-archived':''}"><div class="custom-item-main"><div class="custom-item-icon">${w.profile?'⚔':'◆'}</div><div><strong>${esc(w.name)}</strong><small>${esc(equipmentCategory(w))} · ${Number(w.price||0)} GC${w.hidden?` · <span class="archived-tag">${en?'HIDDEN':'MASQUÉ'}</span>`:''}${overridden&&!w.hidden?` · <span class="official-draft-tag">${isBaseline?(en?'MODIFIED':'MODIFIÉ'):(en?'ADDED':'AJOUTÉ')}</span>`:''}</small></div></div><div class="custom-item-actions"><button type="button" class="equipment-action" data-wname="${esc(w.name)}" onclick="openAdminWeaponEdit(this.dataset.wname)">✎</button><button type="button" class="equipment-action${w.hidden?'':' remove'}" title="${w.hidden?(en?'Unhide — show again everywhere':'Réafficher partout'):(en?'Hide — buggy or undesirable, remove from Market/Band List/Reference':'Masquer — bugué ou non désirable, retirer du Marché/Liste de bande/Référentiel')}" data-wname="${esc(w.name)}" onclick="toggleAdminWeaponHidden(this.dataset.wname)">${w.hidden?'👁':'🚫'}</button><button type="button" class="equipment-action remove" title="${en?'Delete for everyone':'Supprimer pour tout le monde'}" data-wname="${esc(w.name)}" onclick="adminDeleteWeaponForAll(this.dataset.wname)">🗑</button>${overridden&&!w.hidden?`<button type="button" class="equipment-action remove" title="${isBaseline?(en?'Revert to the book values':'Revenir aux valeurs du livre'):(en?'Delete':'Supprimer')}" data-wname="${esc(w.name)}" onclick="resetAdminWeapon(this.dataset.wname)">${isBaseline?'↺':'🗑'}</button>`:''}</div></article>`}).join('')||`<div class="empty compact">${en?'No match.':'Aucun résultat.'}</div>`}</div>
    ${(()=>{const del=[...weaponOverrideMap.entries()].filter(([,o])=>o&&o.deleted).map(([n])=>n).sort((a,b)=>a.localeCompare(b));return del.length?`<details class="custom-collapse" style="margin-top:10px"><summary><span>${en?'DELETED FOR EVERYONE':'SUPPRIMÉS POUR TOUT LE MONDE'}</span><small>${del.length}</small></summary><div class="custom-item-list">${del.map(n=>`<article class="custom-item-row is-archived"><div class="custom-item-main"><div class="custom-item-icon">🗑</div><div><strong>${esc(n)}</strong></div></div><div class="custom-item-actions"><button type="button" class="equipment-action" title="${en?'Restore':'Restaurer'}" data-wname="${esc(n)}" onclick="adminRestoreDeletedWeapon(this.dataset.wname)">↺</button></div></article>`).join('')}</div></details>`:''})()}
    <div class="custom-actions" style="margin-top:12px"><button type="button" class="button secondary" onclick="newAdminWeapon()">＋ ${en?'Add a new item':'Ajouter un objet'}</button></div>
  </div>`;
}
function toggleAdminViewMode(){setAdminViewMode(adminViewMode==='player'?'admin':'player');}
function adminQuestsMarkup(){
  const en=siteLanguage==='en';
  if(questLibraryState!=='ok')return `<div class="card admin-card"><div class="eyebrow">QUESTS</div><p class="custom-field-help">${questLibraryState==='loading'?(en?'Loading the saved quest library…':'Chargement de la bibliothèque de quêtes…'):(en?'The saved quest library could not be loaded — editing is locked so nothing gets overwritten.':'La bibliothèque de quêtes enregistrée n’a pas pu être chargée — l’édition est bloquée pour ne rien écraser.')}</p><div class="custom-actions"><button type="button" class="button secondary" onclick="questLibraryState='loading';render('admin');loadQuestLibrary().then(()=>render('admin'))">↻ ${en?'Retry':'Réessayer'}</button></div></div>`;
  if(!adminQuestDraft)adminQuestDraft=JSON.parse(JSON.stringify(questLibrary()));
  const d=adminQuestDraft;if(!Array.isArray(d.universalXp))d.universalXp=JSON.parse(JSON.stringify(UNIVERSAL_XP_BASE));
  const uxp=`<details class="custom-collapse"${d.__uxOpen?' open':''} ontoggle="adminQuestDraft.__uxOpen=this.open"><summary><span>★ ${en?'Universal experience':'Expérience universelle'}</span><small>${d.universalXp.length} ${en?'lines · every fighter, every game':'lignes · tous les combattants, toutes les parties'}</small></summary>
   <p class="custom-field-help">${en?'Shown in Play Mode → XP & Quests for every fighter who can earn experience, before the scenario’s own Experience lines. “Each” lines are counted with − / +.':'Affiché dans Play Mode → XP & Quêtes pour chaque combattant qui peut gagner de l’expérience, avant les lignes Expérience du scénario. Les lignes « chacun » se comptent avec − / +.'}</p>
   ${d.universalXp.map((l,i)=>`<div class="qa-quest qa-ux"><input value="${esc(l.name||'')}" placeholder="${en?'What earns it':'Ce qui la rapporte'}" onchange="adminUxSet(${i},'name',this.value)"><input type="number" min="0" max="10" value="${Number(l.xp||0)}" title="XP" onchange="adminUxSet(${i},'xp',this.value)"><button type="button" class="button secondary" title="${en?'Remove':'Retirer'}" onclick="adminUxRemove(${i})">🗑</button><label class="qa-chip${l.repeatable?' on':''}"><input type="checkbox" ${l.repeatable?'checked':''} onchange="adminUxSet(${i},'repeatable',this.checked)"> <span>${en?'Each (counted with − / +)':'Chacun (compté avec − / +)'}</span></label></div>`).join('')}
   <div class="custom-actions"><button type="button" class="button secondary" onclick="adminUxAdd()">＋ ${en?'Add a line':'Ajouter une ligne'}</button></div></details>`;
  const trees=d.trees.map((t,ti)=>`<details class="custom-collapse"${t.__open?' open':''} ontoggle="adminQuestDraft.trees[${ti}].__open=this.open"><summary><span>${esc(t.icon||'◆')} ${esc(t.name||'—')}</span><small>${questLeaderOnly(t)?`<b class="qa-excl">${en?'Leader only':'Chef uniquement'}</b> · `:''}${questScopeEmpty(t.scope)?'':`<b class="qa-excl">${esc(questScopeLabel(t.scope,en))}</b> · `}${(t.quests||[]).length} quests · ${t.caster?(en?'Wizard / Priest':'Wizard / Prêtre'):esc((t.skillTrees||[]).join(t.requireAll?' + ':', ')||'—')}</small></summary>
   <div class="custom-form-grid"><label class="custom-field"><span>${en?'Name':'Nom'}</span><input value="${esc(t.name||'')}" onchange="adminQuestSet(${ti},-1,'name',this.value)"></label><label class="custom-field"><span>${en?'Icon':'Icône'}</span><input value="${esc(t.icon||'')}" maxlength="3" onchange="adminQuestSet(${ti},-1,'icon',this.value)"></label><label class="custom-field"><span>${en?'Colour':'Couleur'}</span><input type="color" value="${esc(t.color||'#99d65d')}" onchange="adminQuestSet(${ti},-1,'color',this.value)"></label><label class="custom-field"><span>${en?'Who':'Qui'}</span><label class="qa-chip${questLeaderOnly(t)?' on':''}"><input type="checkbox" ${questLeaderOnly(t)?'checked':''} onchange="adminQuestSet(${ti},-1,'leaderOnly',this.checked);render('admin')"> <span>${en?'Leader only':'Chef uniquement'}</span></label></label>
   <div class="custom-field wide"><span>${en?'Linked skill trees — Primary or Secondary unlocks it':'Arbres de compétences liés — Primary ou Secondary le débloque'}</span>
    <div class="qa-mode"><label><input type="radio" name="qamode${ti}" ${t.requireAll?'':'checked'} onchange="adminQuestSet(${ti},-1,'requireAll',false)"> ${en?'Any one of them is enough':'Un seul suffit'}</label><label><input type="radio" name="qamode${ti}" ${t.requireAll?'checked':''} onchange="adminQuestSet(${ti},-1,'requireAll',true)"> ${en?'Combination — all of them needed':'Combinaison — tous sont nécessaires'}</label></div>
    <div class="qa-trees">${questSkillTreeOptions(t.skillTrees).map(n=>{const on=(t.skillTrees||[]).some(x=>normName(x)===normName(n));return `<label class="qa-chip${on?' on':''}"><input type="checkbox" ${on?'checked':''} onchange="adminQuestToggleSkill(${ti},'${esc(n).replace(/'/g,"\\'")}',this.checked)"> <span>${esc(skillTreeDisplayName(n))}</span></label>`}).join('')}</div></div>
   <div class="custom-field wide"><span>${en?'Who can take it':'Qui peut le prendre'}</span><div class="qa-scope-row"><button type="button" class="button secondary" onclick="openQuestScopeEditor(${ti},-1)">${esc(questScopeLabel(t.scope,en))} ▾</button>${t.ignoreSkills&&!questScopeEmpty(t.scope)?`<span class="qa-tag">${en?'Skill trees ignored':'Arbres de compétences ignorés'}</span>`:''}</div></div>
   <label class="custom-check"><input type="checkbox" ${t.caster?'checked':''} onchange="adminQuestSet(${ti},-1,'caster',this.checked)"> <span><b>${en?'Spellcasters':'Lanceurs de sorts'}</b><small>${en?'Unlocked by a Wizard / Priest or any magic domain':'Débloqué par Wizard / Prêtre ou un domaine de magie'}</small></span></label></div>
   ${(t.quests||[]).map((q,qi)=>`<div class="qa-quest"><input value="${esc(q.name||'')}" placeholder="${en?'Quest name':'Nom de la quête'}" onchange="adminQuestSet(${ti},${qi},'name',this.value)"><input type="number" min="0" max="10" value="${Number(q.xp||0)}" title="XP" onchange="adminQuestSet(${ti},${qi},'xp',this.value)"><button type="button" class="button secondary" title="${en?'Remove':'Retirer'}" onclick="adminQuestRemove(${ti},${qi})">🗑</button><button type="button" class="qa-scope-btn${questScopeEmpty(q.scope)?'':' on'}" onclick="openQuestScopeEditor(${ti},${qi})">${esc(questScopeLabel(q.scope,en))} ▾</button><textarea rows="2" placeholder="${en?'What the fighter must do':'Ce que le combattant doit faire'}" onchange="adminQuestSet(${ti},${qi},'text',this.value)">${esc(q.text||'')}</textarea></div>`).join('')}
   <div class="custom-actions"><button type="button" class="button secondary" onclick="adminQuestAdd(${ti})">＋ ${en?'Add a quest':'Ajouter une quête'}</button><button type="button" class="button danger-outline" onclick="adminQuestRemoveTree(${ti})">${en?'Delete this tree':'Supprimer cet arbre'}</button></div></details>`).join('');
  return `<div class="card admin-card"><div class="eyebrow">QUESTS</div>${uxp}<p class="custom-field-help">${en?'Quest trees for Heroes, Veterans and Hired Swords. A fighter can pick a tree when one of its linked skill trees is Primary or Secondary for him. Changes apply for every player once saved.':'Arbres de quêtes des Héros, Vétérans et Hired Swords. Un combattant peut prendre un arbre si un de ses arbres de compétences liés est Primary ou Secondary pour lui. Les changements s’appliquent à tous les joueurs une fois enregistrés.'}</p>${trees}
  <div class="custom-actions"><button type="button" class="button secondary" onclick="adminQuestAddTree()">＋ ${en?'Add a tree':'Ajouter un arbre'}</button><button type="button" class="button secondary" onclick="adminQuestRestoreBackup()">↶ ${en?'Previous save':'Sauvegarde précédente'}</button><button type="button" class="button secondary" onclick="adminQuestReset()">↺ ${en?'Back to the base set':'Revenir au set de base'}</button><button type="button" class="button primary" onclick="adminQuestSave()">${en?'Save for everyone':'Enregistrer pour tous'}</button></div></div>`;
}
function adminQuestToggleSkill(ti,name,on){if(adminQuestDraft)adminQuestDraft.__dirty=true;const t=adminQuestDraft?.trees?.[ti];if(!t)return;t.skillTrees=(t.skillTrees||[]).filter(x=>normName(x)!==normName(name));if(on)t.skillTrees.push(name);t.__open=true;render('admin')}
function adminQuestSet(ti,qi,field,v){if(adminQuestDraft)adminQuestDraft.__dirty=true;const t=adminQuestDraft?.trees?.[ti];if(!t)return;if(qi<0){if(field==='skillTrees')t.skillTrees=String(v).split(',').map(s=>s.trim()).filter(Boolean);else if(field==='caster'||field==='requireAll'||field==='leaderOnly')t[field]=!!v;else t[field]=String(v)}else{const q=t.quests?.[qi];if(!q)return;q[field]=field==='xp'?Math.max(0,Math.min(10,Math.round(Number(v)||0))):String(v)}if(field==='name'||field==='icon'||field==='caster'||field==='skillTrees'||field==='requireAll'){t.__open=true;render('admin')}}
function adminQuestAdd(ti){if(adminQuestDraft)adminQuestDraft.__dirty=true;const t=adminQuestDraft.trees[ti];t.quests=t.quests||[];t.quests.push({id:'q-'+crypto.randomUUID().slice(0,8),name:'',text:'',xp:1});t.__open=true;render('admin')}
function adminQuestRemove(ti,qi){if(adminQuestDraft)adminQuestDraft.__dirty=true;const t=adminQuestDraft.trees[ti];t.quests.splice(qi,1);t.__open=true;render('admin')}
function adminQuestAddTree(){if(adminQuestDraft)adminQuestDraft.__dirty=true;adminQuestDraft.trees.push({id:'t-'+crypto.randomUUID().slice(0,8),name:siteLanguage==='en'?'New tree':'Nouvel arbre',icon:'◆',color:'#99d65d',skillTrees:[],quests:[],__open:true});render('admin')}
async function adminQuestRemoveTree(ti){if(adminQuestDraft)adminQuestDraft.__dirty=true;const en=siteLanguage==='en';const t=adminQuestDraft.trees[ti];if(!await siteConfirm(en?`Delete the tree “${t.name}”?`:`Supprimer l’arbre « ${t.name} » ?`))return;adminQuestDraft.trees.splice(ti,1);render('admin')}
async function adminQuestRestoreBackup(){const en=siteLanguage==='en';try{const r=await window.MordheimundaAPI.adminQuestsBackup();if(!r?.library||!Array.isArray(r.library.trees))return toast(en?'No previous save yet':'Pas encore de sauvegarde précédente');if(!await siteConfirm(en?`Load the library as it was before the last save (${r.library.trees.length} trees)? Nothing changes until you save.`:`Charger la bibliothèque telle qu’avant le dernier enregistrement (${r.library.trees.length} arbres) ? Rien ne change tant que tu n’enregistres pas.`))return;adminQuestDraft={...JSON.parse(JSON.stringify(r.library)),__dirty:true};render('admin');toast(en?'Previous save loaded — save to apply it':'Sauvegarde précédente chargée — enregistre pour l’appliquer')}catch(e){toast(authError(e,en))}}
async function adminQuestReset(){const en=siteLanguage==='en';if(!await siteConfirm(en?'Replace every tree with the base set? Your own trees will be lost once you save.':'Remplacer tous les arbres par le set de base ? Tes propres arbres seront perdus à l’enregistrement.'))return;adminQuestDraft={...JSON.parse(JSON.stringify(QUEST_BASE)),universalXp:JSON.parse(JSON.stringify(UNIVERSAL_XP_BASE)),__dirty:true};render('admin');toast(siteLanguage==='en'?'Base set loaded — save to apply it':'Set de base chargé — enregistre pour l’appliquer')}
function adminUxSet(i,f,v){if(adminQuestDraft)adminQuestDraft.__dirty=true;const l=adminQuestDraft?.universalXp?.[i];if(!l)return;l[f]=f==='xp'?Math.max(0,Math.min(10,Math.round(Number(v)||0))):f==='repeatable'?!!v:String(v);adminQuestDraft.__uxOpen=true;if(f==='repeatable')render('admin')}
function adminUxAdd(){if(adminQuestDraft)adminQuestDraft.__dirty=true;adminQuestDraft.universalXp.push({id:'ux-'+crypto.randomUUID().slice(0,8),name:'',xp:1,repeatable:false});adminQuestDraft.__uxOpen=true;render('admin')}
function adminUxRemove(i){if(adminQuestDraft)adminQuestDraft.__dirty=true;adminQuestDraft.universalXp.splice(i,1);adminQuestDraft.__uxOpen=true;render('admin')}
async function adminQuestSave(){const en=siteLanguage==='en';if(questLibraryState!=='ok'||!adminQuestDraft)return toast(en?'Quest library not loaded — nothing saved':'Bibliothèque non chargée — rien n’a été enregistré');const lib={universalXp:(adminQuestDraft.universalXp||[]).filter(l=>l.name),trees:adminQuestDraft.trees.map(({__open,...t})=>({...t,quests:(t.quests||[]).filter(q=>q.name)}))};try{const r=await window.MordheimundaAPI.adminSaveQuests(lib,questLibraryStamp);questLibraryOverride=r?.library||lib;questLibraryStamp=r?.updatedAt||questLibraryStamp;adminQuestDraft=null;render('admin');toast(en?'Quests saved for everyone':'Quêtes enregistrées pour tous')}catch(e){if(e?.status===409){toast(en?'The quest library changed elsewhere — reloaded, redo your change':'La bibliothèque de quêtes a changé ailleurs — rechargée, refais ta modification');adminQuestDraft=null;await loadQuestLibrary();render('admin');return}toast(authError(e,en))}}
function adminScenariosSectionMarkup(en){
  if(adminScenariosCache===null){loadAdminScenariosData();return `<div class="empty compact">${en?'Loading…':'Chargement…'}</div>`}
  const list=adminScenariosCache,maps=DEPLOYMENT_MAPS_CACHE||[];
  return `
    <section class="card admin-card">
      <div class="eyebrow">${en?'SCENARIOS':'SCÉNARIOS'}</div>
      <h3>${en?'Scenarios':'Scénarios'}</h3>
      <p class="muted">${en?'Shown on Rules > Scenarios once published. Draft scenarios stay admin-only.':'Affichés sur Règles > Scénarios une fois publiés. Les brouillons restent réservés aux admins.'}</p>
      <button type="button" class="button secondary" onclick="openScenarioEditor(null)" style="margin-bottom:12px">+ ${en?'New scenario':'Nouveau scénario'}</button>
      <div class="custom-item-list">${list.length?list.map(s=>{const isDraft=s.status==='draft';return `<article class="custom-item-row"><div class="custom-item-main"><div><strong>${esc(s.name)}</strong><small>${isDraft?`<span class="official-status-draft">${en?'DRAFT':'BROUILLON'}</span> · `:''}${scenarioCategoriesOf(s).map(c=>scenarioCategoryLabel(c,en)).join(', ')}</small></div></div><div class="custom-item-actions"><button type="button" class="button secondary" onclick="openScenarioEditor('${esc(s.id)}')">✎ ${en?'Manage':'Gérer'}</button><button type="button" class="button secondary" onclick="setScenarioStatus('${esc(s.id)}','${isDraft?'published':'draft'}')">${isDraft?(en?'Publish':'Publier'):(en?'Unpublish':'Dépublier')}</button>${isDraft?`<button type="button" class="equipment-action remove" onclick="confirmDeleteScenario('${esc(s.id)}')">🗑</button>`:''}</div></article>`}).join(''):`<div class="empty compact">${en?'No scenario yet.':'Aucun scénario pour l’instant.'}</div>`}</div>
    </section>
    <section class="card admin-card">
      <div class="eyebrow">${en?'DEPLOYMENT MAPS':'CARTES DE DÉPLOIEMENT'}</div>
      <h3>${en?'Deployment map library':'Bibliothèque de cartes de déploiement'}</h3>
      <p class="muted">${en?'Each map gets a fixed number. Check which maps apply to a scenario from its own Deployment section.':'Chaque carte reçoit un numéro fixe. Coche les cartes qui s’appliquent à un scénario depuis sa propre section Déploiement.'}</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap"><button type="button" class="dash-btn-primary" onclick="openMapBuilder(null)">✎ ${en?'Build a map':'Construire une carte'}</button><button type="button" class="button secondary" onclick="pickDeploymentMapImage()">+ ${en?'Import an image (legacy)':'Importer une image (ancien)'}</button></div>
      ${maps.length?`<div class="scn-maps-grid">${maps.map(m=>`<div class="scn-map-tile"><div onclick="openMapBuilder('${esc(m.id)}')" style="cursor:pointer">${deploymentMapPreviewMarkup(m)}<span class="scn-map-num">#${m.number}</span></div><button type="button" class="scn-map-cb" style="cursor:pointer" title="${en?'Delete':'Supprimer'}" onclick="event.stopPropagation();confirmDeleteDeploymentMap('${esc(m.id)}')">✕</button><div class="scn-map-name">${esc(m.name||'')}</div></div>`).join('')}</div>`:`<div class="empty compact">${en?'No deployment maps yet.':'Aucune carte de déploiement.'}</div>`}
    </section>`;
}
function adminTrophiesMarkup(){const en=siteLanguage==='en';const lib=trophyLibraryData.trophies||[];
  return `<div class="card admin-card"><div class="eyebrow">TROPHIES</div><p class="custom-field-help">${en?'Pictures for completed Great Quests, shown in the campaign Standings. Use a <b>transparent PNG</b>, square, about 256–512 px (JPG has no transparency). Pick the trophy in each warband’s Great Quest editor.':'Images pour les Grandes Quêtes accomplies, affichées dans le Classement de la campagne. Utilise un <b>PNG transparent</b>, carré, environ 256–512 px (le JPG n’a pas de transparence). Choisis le trophée dans l’éditeur de Grande Quête de chaque bande.'}</p>
  <div class="trophy-admin-grid">${lib.map((t,i)=>`<div class="trophy-admin-item"><div class="trophy-admin-pic">${trophyMarkup('lib:'+t.id,72)}</div><input value="${esc(t.name||'')}" placeholder="${en?'Name':'Nom'}" onchange="adminTrophyRename(${i},this.value)"><button type="button" class="button danger-outline small" onclick="adminTrophyDelete(${i})">🗑</button></div>`).join('')||`<p class="muted">${en?'No custom trophy yet.':'Aucun trophée personnalisé.'}</p>`}</div>
  <div class="custom-actions"><button type="button" class="button primary" ${trophyAdminBusy?'disabled':''} onclick="adminTrophyUpload()">＋ ${en?'Upload a trophy (PNG)':'Importer un trophée (PNG)'}</button></div>
  <details class="custom-collapse"><summary><span>${en?'Built-in trophies':'Trophées intégrés'}</span><small>${TROPHY_BUILTIN.length}</small></summary><div class="trophy-admin-grid">${TROPHY_BUILTIN.map(t=>`<div class="trophy-admin-item"><div class="trophy-admin-pic">${trophyMarkup('builtin:'+t.id,72)}</div><small>${esc(t.name)}</small></div>`).join('')}</div></details></div>`}
function adminTrophyUpload(){const en=siteLanguage==='en';const input=document.createElement('input');input.type='file';input.accept='image/png,image/webp,image/jpeg';
  input.onchange=async()=>{const file=input.files&&input.files[0];if(!file)return;if(file.type==='image/jpeg')toast(en?'JPG has no transparency — the background will show':'Le JPG n’a pas de transparence — le fond sera visible');trophyAdminBusy=true;render('admin');
    try{const dataUrl=await trophyFileToDataUrl(file);const up=await window.MordheimundaAPI.adminUploadRuleImage(dataUrl);if(!up?.id)throw new Error('UPLOAD_FAILED');trophyLibraryData.trophies=[...(trophyLibraryData.trophies||[]),{id:'t-'+crypto.randomUUID().slice(0,8),name:String(file.name||'').replace(/\.[a-z0-9]+$/i,'').slice(0,80),imageId:up.id}];await saveTrophyLibrary();toast(en?'Trophy added':'Trophée ajouté')}catch(e){toast(authError(e,en))}finally{trophyAdminBusy=false;render('admin')}};input.click()}
async function adminTrophyRename(i,v){const t=trophyLibraryData.trophies?.[i];if(!t)return;t.name=String(v||'').slice(0,80);try{await saveTrophyLibrary()}catch(e){toast(authError(e,siteLanguage==='en'))}}
async function adminTrophyDelete(i){const en=siteLanguage==='en';const t=trophyLibraryData.trophies?.[i];if(!t||!await siteConfirm(en?`Delete the trophy “${t.name}”? Quests using it fall back to 🏆.`:`Supprimer le trophée « ${t.name} » ? Les quêtes qui l’utilisent reviennent à 🏆.`))return;trophyLibraryData.trophies.splice(i,1);try{await saveTrophyLibrary()}catch(e){toast(authError(e,en))}render('admin')}
async function loadAdminErrors(){if(adminErrorsLoading)return;adminErrorsLoading=true;try{adminErrorsData=await window.MordheimundaAPI.adminErrors()}catch(e){adminErrorsData={error:authError(e,siteLanguage==='en')}}finally{adminErrorsLoading=false;if(currentViewName()==='admin')render('admin')}}
function adminErrorsMarkup(){const en=siteLanguage==='en';const d=adminErrorsData;if(!d){setTimeout(loadAdminErrors,0);return `<div class="card admin-card"><p class="muted">${en?'Loading…':'Chargement…'}</p></div>`}
  if(d.error)return `<div class="card admin-card"><p class="muted">${esc(d.error)}</p><button class="button secondary" onclick="adminErrorsData=null;render('admin')">${en?'Retry':'Réessayer'}</button></div>`;
  const rows=d.errors||[];const dt=v=>new Date(v).toLocaleString(en?'en-GB':'fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  return `<div class="card admin-card admin-errors"><div class="eyebrow">${en?'ERRORS RECEIVED':'ERREURS REÇUES'}</div><p class="muted">${en?'Anonymous. Same error, same version = one line with a counter. Kept 30 days.':'Anonyme. Même erreur, même version = une ligne avec un compteur. Gardé 30 jours.'}</p>
  ${rows.length?`<div class="errlog-list">${rows.map(r=>`<div class="errlog-row"><b>${esc(r.msg)} <i>×${r.hits}</i></b><small>${esc(r.build)} · ${esc(r.route||'—')} · ${en?'after':'après'} ${esc(r.action||'—')} · ${dt(r.last_at)}</small><small>${esc(r.src||'')} · ${esc(r.device||'')}</small><button type="button" class="button secondary small" onclick="adminDeleteError(${Number(r.id)})">${en?'Fixed — remove':'Corrigé — retirer'}</button></div>`).join('')}</div>`:`<p class="muted">${en?'Nothing received.':'Rien de reçu.'}</p>`}
  <div class="custom-actions"><button type="button" class="button secondary" onclick="adminErrorsData=null;render('admin')">↻ ${en?'Refresh':'Actualiser'}</button>${rows.length?`<button type="button" class="button secondary" onclick="adminDeleteError('all')">${en?'Clear all':'Tout effacer'}</button>`:''}</div></div>`}
function adminTrafficMarkup(){const en=siteLanguage==='en';const d=trafficAdminData;if(!d){return `<div class="card admin-card"><p class="muted">${en?'Loading…':'Chargement…'}</p></div>`}if(d.error)return `<div class="card admin-card"><p class="muted">${esc(d.error)}</p><button class="button secondary" onclick="trafficAdminData=null;render('admin')">${en?'Retry':'Réessayer'}</button></div>`;
  const used=(d.today.in||0)+(d.today.out||0),cap=d.limits.siteDailyMb*1024*1024,pct=Math.min(100,Math.round(used/cap*100));
  const maxDay=Math.max(1,...(d.days||[]).map(x=>x.bytes));
  return `<div class="card admin-card"><div class="eyebrow">${en?'SERVER TRAFFIC':'TRAFIC SERVEUR'}</div>
  <div class="mt-usage"><div><b>${en?'Today':'Aujourd’hui'}</b><span>${fmtBytes(used)} / ${fmtBytes(cap)} · ${d.today.calls.toLocaleString()} ${en?'calls':'appels'}</span><i style="--p:${pct}%"></i></div><div><b>${en?'This month':'Ce mois-ci'}</b><span>${fmtBytes(d.month.in+d.month.out)} · ${d.month.calls.toLocaleString()} ${en?'calls':'appels'}</span></div></div>
  <p class="custom-field-help">${en?`Ceilings: ${d.limits.accountDailyMb} MB per account per day, ${d.limits.siteDailyMb} MB for the whole site per day. Past them, heavy saves wait (changes stay on the device) — the allowance can never run out.`:`Plafonds : ${d.limits.accountDailyMb} Mo par compte et par jour, ${d.limits.siteDailyMb} Mo pour tout le site par jour. Au-delà, les grosses sauvegardes attendent (les modifications restent sur l’appareil) : le quota ne peut jamais être épuisé.`}</p>
  <div style="display:flex;gap:3px;align-items:flex-end;height:60px;margin:8px 0">${(d.days||[]).map(x=>`<span title="${esc(x.day)} · ${fmtBytes(x.bytes)}" style="flex:1;background:var(--accent,#c9a35a);opacity:.85;height:${Math.max(3,Math.round(x.bytes/maxDay*100))}%"></span>`).join('')}</div>
  <h4>${en?'What used the most data today':'Ce qui a le plus consommé aujourd’hui'}</h4>${trafficCatSummary(d.routes)}<table style="width:100%;font-size:12px">${d.routes.slice(0,10).map(trafficRouteRow).join('')||`<tr><td class="muted">—</td></tr>`}</table>
  ${trafficAccountsMarkup()}
  <div class="custom-actions"><button type="button" class="button ${d.paused?'primary':'secondary'}" onclick="adminToggleSyncPause(${d.paused?'false':'true'})">${d.paused?(en?'▶ Turn sync back on':'▶ Réactiver la synchro'):(en?'⏸ Emergency: pause sync for everyone':'⏸ Urgence : mettre la synchro en pause pour tous')}</button><button type="button" class="button secondary" onclick="trafficAdminData=null;loadTrafficAdmin();loadTrafficAccounts()">↻ ${en?'Refresh':'Actualiser'}</button></div>
  ${d.paused?`<p class="custom-field-help">${en?'Sync is paused: players keep playing on their own copy; their changes go out when you turn it back on.':'Synchro en pause : les joueurs continuent sur leur copie ; leurs modifications partiront quand tu la réactiveras.'}</p>`:''}</div>`}
async function adminToggleSyncPause(on){const en=siteLanguage==='en';if(on&&!await siteConfirm(en?'Pause sync for every player? They keep playing locally; changes are sent when you turn it back on.':'Mettre la synchro en pause pour tous les joueurs ? Ils continuent en local ; les modifications partiront quand tu la réactiveras.'))return;try{await window.MordheimundaAPI.adminSetSyncPause(on);trafficAdminData=null;loadTrafficAdmin();toast(on?(en?'Sync paused':'Synchro en pause'):(en?'Sync back on':'Synchro réactivée'))}catch(e){toast(authError(e,en))}}
function adminPriceRulesMarkup(){const en=siteLanguage==='en';const facs=[...(D.factions||[])].sort((a,b)=>String(a.displayName).localeCompare(String(b.displayName)));if(!prFactionSel&&facs[0])prFactionSel=String(facs[0].id);
  const fac=facs.find(f=>String(f.id)===prFactionSel);const book=n=>D.weapons.find(w=>normName(w.name)===normName(n));
  const groups=new Map();priceRules.forEach((r,i)=>{const k=r.factionId;if(!groups.has(k))groups.set(k,[]);groups.get(k).push({r,i})});
  return `<div class="card admin-card"><div class="eyebrow">${en?'SPECIAL PRICES':'PRIX SPÉCIAUX'}</div>
  <p class="custom-field-help">${en?'Give a warband — or one fighter type of it — its own price and value for an item. The price only applies to its Band List (the market keeps market prices). The value applies to the item whenever a fighter of that warband carries it, however it was bought, including items already owned; items in the warband stash keep their normal value. Leave a field empty to keep the normal number.':'Donne à une bande — ou à un type de combattant de cette bande — son propre prix et sa propre valeur pour un objet. Le prix ne s’applique qu’à sa Band List (le marché garde ses prix). La valeur s’applique à l’objet dès qu’un combattant de cette bande le porte, peu importe où il a été acheté, y compris pour les objets déjà possédés ; les objets dans la réserve de bande gardent leur valeur normale. Laisse un champ vide pour garder le nombre normal.'}</p>
  <div class="custom-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;align-items:end">
   <label class="custom-field"><span>${en?'Warband':'Bande'}</span><select id="prFaction" onchange="prFactionSel=this.value;render('admin')">${facs.map(f=>`<option value="${esc(f.id)}" ${String(f.id)===prFactionSel?'selected':''}>${esc(f.displayName)}</option>`).join('')}</select></label>
   <label class="custom-field"><span>${en?'Fighter':'Combattant'}</span><select id="prWarrior"><option value="">${en?'Whole warband':'Toute la bande'}</option>${(fac?.warriors||[]).map(w=>`<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}</select></label>
   <label class="custom-field"><span>${en?'Item':'Objet'}</span><input id="prItem" list="prItemList" placeholder="${en?'e.g. Full plate armour':'ex. Full plate armour'}"><datalist id="prItemList">${prItemNames().map(n=>`<option value="${esc(n)}">`).join('')}</datalist></label>
   <label class="custom-field"><span>${en?'Price (GC)':'Prix (CO)'}</span><input id="prPrice" type="number" min="0" step="1"></label>
   <label class="custom-field"><span>${en?'Value (GC, optional)':'Valeur (CO, facultatif)'}</span><input id="prValue" type="number" min="0" step="1"></label>
   <button type="button" class="button primary" onclick="addPriceRule()">＋ ${en?'Add':'Ajouter'}</button>
  </div>
  <div class="eyebrow" style="margin-top:14px">${en?'DISCOUNT ON ALL EQUIPMENT':'RÉDUCTION SUR TOUT L’ÉQUIPEMENT'}</div>
  <p class="custom-field-help">${en?'Cut every item’s Band List price and/or value by a percentage for the chosen warband (or one fighter type of it), optionally only for a rarity range (Common = 0, Rare 8 = 8). A special price set above for one item wins over the percentage.':'Réduit d’un pourcentage le prix (Band List) et/ou la valeur de tous les objets pour la bande choisie (ou un type de combattant), éventuellement seulement pour une plage de rareté (Commun = 0, Rare 8 = 8). Un prix spécial défini ci-dessus pour un objet reste prioritaire.'}</p>
  <div class="custom-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;align-items:end">
   <label class="custom-field"><span>${en?'Fighter':'Combattant'}</span><select id="prPctWarrior"><option value="">${en?'Whole warband':'Toute la bande'}</option>${(fac?.warriors||[]).map(w=>`<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}</select></label>
   <label class="custom-field"><span>${en?'Rarity from (empty = Common)':'Rareté de (vide = Commun)'}</span><input id="prPctRarMin" type="number" min="0" max="20" step="1" placeholder="${en?'Common':'Commun'}"></label>
   <label class="custom-field"><span>${en?'Rarity to (empty = all)':'Rareté à (vide = toutes)'}</span><input id="prPctRarMax" type="number" min="0" max="20" step="1" placeholder="${en?'all':'toutes'}"></label>
   <label class="custom-field"><span>${en?'Price −%':'Prix −%'}</span><input id="prPctPrice" type="number" min="0" max="100" step="1" placeholder="ex. 20"></label>
   <label class="custom-field"><span>${en?'Value −% (empty = same as price)':'Valeur −% (vide = comme le prix)'}</span><input id="prPctValue" type="number" min="0" max="100" step="1" placeholder="${en?'= price':'= prix'}"></label>
   <button type="button" class="button primary" onclick="addPricePctRule()">＋ ${en?'Apply to':'Appliquer à'} ${esc(fac?.displayName||'')}</button>
  </div>
  ${groups.size?[...groups.entries()].sort((a,b)=>String(prFactionName(a[0])).localeCompare(String(prFactionName(b[0])))).map(([fid,list])=>`<details class="custom-collapse" style="margin-top:8px"${prOpenFactions.has(fid)?' open':''} ontoggle="if(this.open)prOpenFactions.add('${esc(fid)}');else prOpenFactions.delete('${esc(fid)}')"><summary><span>${esc(prFactionName(fid))}</span><small>${list.length} ${en?(list.length>1?'rules':'rule'):(list.length>1?'règles':'règle')}</small></summary><table style="width:100%;font-size:12.5px">${list.map(({r,i})=>{if(r.item==='*')return `<tr><td>${esc(r.warriorId?prWarriorName(fid,r.warriorId):(en?'Whole warband':'Toute la bande'))}</td><td><b>${en?'All equipment':'Tout l’équipement'}</b>${r.rarityMin!=null||r.rarityMax!=null?` <small class="muted">(${en?'rarity':'rareté'} ${r.rarityMin==null?(en?'Common':'Commun'):r.rarityMin}–${r.rarityMax==null?'∞':r.rarityMax})</small>`:''}</td><td>${r.pricePct!=null?(en?'price':'prix')+' −'+r.pricePct+' %':'—'}</td><td>${pctValueOf(r)!=null?(en?'value':'valeur')+' −'+pctValueOf(r)+' %':'—'}</td><td style="text-align:right"><button type="button" class="button secondary tiny" onclick="deletePriceRule(${i})">✕</button></td></tr>`;const b=book(r.item);return `<tr><td>${esc(r.warriorId?prWarriorName(fid,r.warriorId):(en?'Whole warband':'Toute la bande'))}</td><td><b>${esc(r.item)}</b>${b?` <small class="muted">(${en?'normally':'normalement'} ${b.price} GC)</small>`:''}</td><td>${r.price!=null?r.price+' GC':'—'}</td><td>${en?'value':'valeur'} ${r.value!=null?r.value:(r.price!=null?r.price:'—')} GC</td><td style="text-align:right"><button type="button" class="button secondary tiny" onclick="deletePriceRule(${i})">✕</button></td></tr>`}).join('')}</table></details>`).join(''):`<p class="muted" style="margin-top:12px">${en?'No special price yet.':'Aucun prix spécial pour l’instant.'}</p>`}
  </div>`}
async function loadMtAdmin(){if(mtAdminLoading)return;mtAdminLoading=true;try{mtAdminData=await window.MordheimundaAPI.adminTranslateSettings()}catch(e){mtAdminData={error:authError(e,siteLanguage==='en')}}finally{mtAdminLoading=false;render('admin')}}
function adminTranslateMarkup(){const en=siteLanguage==='en';if(!mtAdminData){loadMtAdmin();return `<div class="card admin-card"><p class="muted">${en?'Loading…':'Chargement…'}</p></div>`}if(mtAdminData.error)return `<div class="card admin-card"><p class="muted">${esc(mtAdminData.error)}</p></div>`;
  const u=mtAdminData.usage||{};const pct=(a,b)=>b?Math.min(100,Math.round(a/b*100)):0;
  return `<div class="card admin-card"><div class="eyebrow">${en?'AUTOMATIC TRANSLATION':'TRADUCTION AUTOMATIQUE'}</div>
  ${mtAdminData.enabled?'':`<p class="custom-field-help">⚠ ${en?'No translation key on the server (GOOGLE_TRANSLATE_API_KEY): automatic translation is off.':'Aucune clé de traduction sur le serveur (GOOGLE_TRANSLATE_API_KEY) : la traduction automatique est éteinte.'}</p>`}
  <div class="mt-usage"><div><b>${en?'Today':'Aujourd’hui'}</b><span>${(u.today||0).toLocaleString()} / ${(u.dailyLimit||0).toLocaleString()} ${en?'characters':'caractères'}</span><i style="--p:${pct(u.today,u.dailyLimit)}%"></i></div><div><b>${en?'This month':'Ce mois-ci'}</b><span>${(u.month||0).toLocaleString()} / ${(u.monthlyLimit||0).toLocaleString()} ${en?'characters':'caractères'}</span><i style="--p:${pct(u.month,u.monthlyLimit)}%"></i></div><div><b>${en?'Texts in memory':'Textes en mémoire'}</b><span>${(mtAdminData.cached||0).toLocaleString()}</span></div></div>
  <label class="custom-field wide"><span>${en?'Words never translated — one per line (game terms, names…)':'Mots jamais traduits — un par ligne (termes de jeu, noms…)'}</span><textarea id="mtTerms" rows="8" placeholder="Warband&#10;Wyrdstone&#10;Hired Sword">${esc((mtAdminData.terms||[]).join('\n'))}</textarea></label>
  <p class="custom-field-help">${en?'Whole words, capitals ignored. When you add a word, the texts that contain it are translated again (your own corrections are kept).':'Mots entiers, majuscules ignorées. Quand tu ajoutes un mot, les textes qui le contiennent sont retraduits (tes propres corrections sont conservées).'}</p>
  <div class="custom-actions"><button type="button" class="button primary" onclick="saveMtExclusions()">${en?'Save':'Enregistrer'}</button></div></div>`}
async function adminExportAll(light=false){
  const en=siteLanguage==='en';if(exportBusy)return;exportBusy=true;render('admin');
  try{const out={app:'Mordheimunda',build:typeof APP_BUILD!=='undefined'?APP_BUILD:'',exportedAt:new Date().toISOString(),...(light?{kind:'game-content'}:{}),tables:{}};
    const list=(await window.MordheimundaAPI.adminExport())?.tables||[];let n=0;
    for(const t of list){if(light&&LIGHT_EXPORT_SKIP.has(t.table))continue;out.tables[t.table]=[];let off=0;for(;;){const pg=await window.MordheimundaAPI.adminExport(t.table,off);out.tables[t.table].push(...(light?lightExportScrub(pg.rows||[]):(pg.rows||[])));off+=(pg.rows||[]).length;const el=document.getElementById('exportProgress');if(el)el.textContent=`${t.table} · ${out.tables[t.table].length}`;if(pg.done||!(pg.rows||[]).length)break}n++}
    const blob=new Blob([JSON.stringify(out)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`mordheimunda-${light?'game-content':'backup'}-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);
    toast(en?`Backup downloaded — ${n} tables`:`Sauvegarde téléchargée — ${n} tables`)}catch(e){toast(authError(e,en))}finally{exportBusy=false;render('admin')}}
function adminBackupMarkup(){const en=siteLanguage==='en';return `<div class="card admin-card"><div class="eyebrow">BACKUP</div><p class="custom-field-help">${en?'Downloads everything created on the site in one file: every account’s warbands and custom content, official warbands, rules edits, quests, trophies, scenarios, maps, campaigns and pictures. Passwords and sessions are never included. Keep the file somewhere safe.':'Télécharge tout ce qui a été créé sur le site dans un seul fichier : les bandes et contenus custom de chaque compte, les bandes officielles, les règles modifiées, quêtes, trophées, scénarios, cartes, campagnes et images. Les mots de passe et sessions ne sont jamais inclus. Garde le fichier en lieu sûr.'}</p><div class="custom-actions"><button type="button" class="button primary" ${exportBusy?'disabled':''} onclick="adminExportAll()">⬇ ${exportBusy?(en?'Exporting…':'Export en cours…'):(en?'Download a full backup':'Télécharger une sauvegarde complète')}</button><button type="button" class="button secondary" ${exportBusy?'disabled':''} onclick="adminExportAll(true)" title="${en?'Official warbands, catalog, scenarios, maps, campaigns, rules and settings — no accounts, no players’ warbands, no pictures (~1 MB, for an analysis)':'Bandes officielles, catalogue, scénarios, cartes, campagnes, règles et réglages — sans comptes, sans bandes des joueurs, sans images (~1 Mo, pour une analyse)'}">⬇ ${en?'Game content only (light)':'Contenu de jeu seulement (léger)'}</button><small id="exportProgress" class="muted"></small></div></div><div class="card admin-card"><div class="eyebrow">${en?'PICTURES':'IMAGES'}</div><p class="custom-field-help">${en?'Moves every picture still written inside the data (players’ accounts, scenarios, maps, official warbands…) to the picture store, leaving a link in its place. Nothing is deleted: each account is saved in its version history first. Everyone keeps seeing the same pictures; saves become much lighter.':'Range toutes les images encore écrites dans les données (comptes des joueurs, scénarios, cartes, bandes officielles…) dans le stockage d’images et laisse un lien à la place. Rien n’est supprimé : chaque compte est d’abord sauvegardé dans son historique de versions. Tout le monde voit les mêmes images ; les sauvegardes deviennent beaucoup plus légères.'}</p><div class="custom-actions"><button type="button" class="button primary" ${mediaConvertBusy?'disabled':''} onclick="adminConvertMedia()">🖼 ${mediaConvertBusy?(en?'Converting…':'Conversion en cours…'):(en?'Convert pictures':'Convertir les images')}</button><small id="mediaProgress" class="muted"></small></div></div>`}
