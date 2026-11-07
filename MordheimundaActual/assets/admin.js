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
      ${adminCategoryBar('perf',en?'Speed for players':'Vitesse chez les joueurs',en?'Load times measured on players\' devices (anonymous)':'Temps de chargement mesurés chez les joueurs (anonyme)',adminOpenCategory==='perf')}
      ${adminOpenCategory==='perf'?`<div class="admin-category-body">${adminPerfMarkup()}</div>`:''}
      ${adminCategoryBar('errors',en?'Errors received':'Erreurs reçues',en?'Bugs sent by players who turned on automatic reports':'Bugs envoyés par les joueurs qui ont activé l’envoi automatique',adminOpenCategory==='errors')}
      ${adminOpenCategory==='errors'?`<div class="admin-category-body">${adminErrorsMarkup()}</div>`:''}
      ${adminCategoryBar('translate',en?'Automatic translation':'Traduction automatique',en?'Words never translated, usage of the free allowance':'Mots jamais traduits, consommation de la partie gratuite',adminOpenCategory==='translate')}
      ${adminOpenCategory==='translate'?`<div class="admin-category-body">${adminTranslateMarkup()}</div>`:''}
      ${adminCategoryBar('journal',en?'Change log':'Journal des modifications',en?'Who changed what, when — with Restore':'Qui a changé quoi, quand — avec Rétablir',adminOpenCategory==='journal')}
      ${adminOpenCategory==='journal'?`<div class="admin-category-body">${adminLogMarkup()}</div>`:''}
      ${adminCategoryBar('frmissing',en?'Rules without French text':'Règles sans texte français',en?'Rule pages still only in English (or machine-translated)':'Pages de règles encore seulement en anglais (ou traduites automatiquement)',adminOpenCategory==='frmissing')}
      ${adminOpenCategory==='frmissing'?`<div class="admin-category-body">${adminFrMissingMarkup()}</div>`:''}
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

// ---- Editors moved out of app.js (V-ADMINLAZY, part 2) ----
function openAdminWeaponEditFromRef(name){adminOpenCategory='gear';adminWeaponEditReturnToRef=name;openAdminWeaponEdit(name);}
function ruleTableEditorParseExisting(raw){
 return raw.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(line=>line.split('|').map(c=>{
  const t=c.trim();const hi=t.startsWith('*');
  return {text:hi?t.slice(1):t,hi};
 }));
}
function ruleTableEditorSerialize(){
 const lines=ruleTableEditorRows.map(row=>row.map(c=>(c.hi?'*':'')+c.text).join('|'));
 return `[TABLE]\n${lines.join('\n')}\n[/TABLE]`;
}
function openRuleTableEditor(){
 const en=siteLanguage==='en';
 const el=ruleEditTarget();if(!el)return;
 ruleTableEditorRows=null;ruleTableEditorSelRange=null;
 const start=el.selectionStart??0,end=el.selectionEnd??0;
 const selected=el.value.slice(start,end);
 let m=/^\[TABLE\]\s*\n([\s\S]*?)\n\s*\[\/TABLE\]$/.exec(selected.trim());
 if(m){
  ruleTableEditorRows=ruleTableEditorParseExisting(m[1]);
  ruleTableEditorSelRange={start,end};
 } else {
  // Nothing selected — but the cursor might still sit inside an existing
  // [TABLE]…[/TABLE] block further up/down the text; find the nearest
  // enclosing pair (if any) so clicking the toolbar button re-opens that
  // table for editing instead of always starting a blank one.
  const before=el.value.slice(0,start),after=el.value.slice(end);
  const openIdx=before.lastIndexOf('[TABLE]');
  const closeIdxBefore=before.lastIndexOf('[/TABLE]');
  const closeIdxRel=after.indexOf('[/TABLE]');
  if(openIdx>closeIdxBefore&&closeIdxRel!==-1){
   const blockStart=openIdx,blockEnd=end+closeIdxRel+'[/TABLE]'.length;
   const m2=/^\[TABLE\]\s*\n([\s\S]*?)\n\s*\[\/TABLE\]$/.exec(el.value.slice(blockStart,blockEnd));
   if(m2){ruleTableEditorRows=ruleTableEditorParseExisting(m2[1]);ruleTableEditorSelRange={start:blockStart,end:blockEnd};}
  }
 }
 if(!ruleTableEditorRows){
  ruleTableEditorRows=[[{text:'D6',hi:false},{text:en?'Result':'Résultat',hi:false}],
   ...[1,2,3,4,5,6].map(n=>[{text:String(n),hi:false},{text:(en?'Result '+n+'…':'Résultat '+n+'…'),hi:false}])];
 }
 renderRuleTableEditorOverlay();
}
function closeRuleTableEditor(){document.getElementById('ruleTableEditorOverlay')?.remove();ruleTableEditorRows=null;ruleTableEditorSelRange=null;}
function ruleTableEditorAddRow(){ruleTableEditorRows.push(ruleTableEditorRows[0].map(()=>({text:'',hi:false})));renderRuleTableEditorOverlay();}
function ruleTableEditorRemoveRow(i){if(ruleTableEditorRows.length<=1)return;ruleTableEditorRows.splice(i,1);renderRuleTableEditorOverlay();}
function ruleTableEditorAddCol(){ruleTableEditorRows.forEach(r=>r.push({text:'',hi:false}));renderRuleTableEditorOverlay();}
function ruleTableEditorCellInput(i,j,value){if(ruleTableEditorRows[i]&&ruleTableEditorRows[i][j])ruleTableEditorRows[i][j].text=value;}
function ruleTableEditorToggleHi(i,j){ruleTableEditorRows[i][j].hi=!ruleTableEditorRows[i][j].hi;renderRuleTableEditorOverlay();}
function ruleTableEditorInsert(){
 const el=ruleEditTarget();if(!el||!ruleTableEditorRows)return;
 // Cells update their own data on every keystroke via oninput, but a redraw
 // (add/remove row or column) rebuilds all the <input> elements, so pick up
 // whatever's live in the DOM right now too, just in case.
 document.querySelectorAll('#ruleTableEditorOverlay .rte-cell-input').forEach(inp=>{
  const i=Number(inp.dataset.row),j=Number(inp.dataset.col);
  if(ruleTableEditorRows[i]&&ruleTableEditorRows[i][j])ruleTableEditorRows[i][j].text=inp.value;
 });
 const block=ruleTableEditorSerialize();
 if(ruleTableEditorSelRange){
  const {start,end}=ruleTableEditorSelRange;
  el.value=el.value.slice(0,start)+block+el.value.slice(end);
  const pos=start+block.length;el.focus();el.setSelectionRange(pos,pos);
 } else {
  const start=el.selectionStart??el.value.length,end=el.selectionEnd??el.value.length;
  const before=el.value.slice(0,start),after=el.value.slice(end);
  const needsNL=before.length&&!/\n\n?$/.test(before);
  const prefix=needsNL?'\n\n':'';
  const suffix=(!after.length||!after.startsWith('\n'))?'\n':'';
  el.value=before+prefix+block+suffix+after;
  const pos=(before+prefix+block).length;el.focus();el.setSelectionRange(pos,pos);
 }
 closeRuleTableEditor();
}
function renderRuleTableEditorOverlay(){
 const en=siteLanguage==='en';
 let overlay=document.getElementById('ruleTableEditorOverlay');
 if(!overlay){overlay=document.createElement('div');overlay.id='ruleTableEditorOverlay';overlay.className='rte-overlay';document.body.appendChild(overlay);}
 const rows=ruleTableEditorRows;
 const gridRows=rows.map((row,i)=>`<tr>${row.map((c,j)=>`<td><input class="rte-cell-input" data-row="${i}" data-col="${j}" value="${esc(c.text)}" oninput="ruleTableEditorCellInput(${i},${j},this.value)"><button type="button" class="rte-hi-btn${c.hi?' on':''}" title="${en?'Highlight this cell':'Mettre en valeur cette cellule'}" onclick="ruleTableEditorToggleHi(${i},${j})">★</button></td>`).join('')}<td class="rte-rowbtn"><button type="button" title="${en?'Remove row':'Supprimer la ligne'}" onclick="ruleTableEditorRemoveRow(${i})">✕</button></td></tr>`).join('');
 overlay.innerHTML=`<div class="rte-panel">
   <div class="rte-head"><h3>${en?'Table builder':'Générateur de tableau'}</h3><button type="button" class="rte-close" onclick="closeRuleTableEditor()">✕</button></div>
   <p class="rte-hint">${en?'First row is the header. ★ marks a cell as highlighted (rule-table-hi style).':'La première ligne est l’en-tête. ★ met une cellule en valeur (style rule-table-hi).'}</p>
   <div class="rte-grid-wrap"><table class="rte-grid"><tbody>${gridRows}</tbody></table></div>
   <div class="rte-toolrow"><button type="button" class="button secondary" onclick="ruleTableEditorAddRow()">+ ${en?'Row':'Ligne'}</button><button type="button" class="button secondary" onclick="ruleTableEditorAddCol()">+ ${en?'Column':'Colonne'}</button></div>
   <div class="rte-actions"><button type="button" class="button secondary" onclick="closeRuleTableEditor()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" onclick="ruleTableEditorInsert()">${ruleTableEditorSelRange?(en?'Update table':'Mettre à jour le tableau'):(en?'Insert table':'Insérer le tableau')}</button></div>
 </div>`;
}
async function adminSupportSearchUI(ev){
  ev.preventDefault();const en=siteLanguage==='en',q=$('#adminSupportQuery')?.value.trim(),box=$('#adminSupportResult');if(!q||!box)return;
  box.innerHTML=`<p class="muted">${en?'Searching…':'Recherche…'}</p>`;
  try{
    const {users}=await window.MordheimundaAPI.adminSupportSearch(q);
    box.innerHTML=users.length?users.map(u=>`<div class="friend-row"><span class="friend-avatar">${esc((u.username||'?')[0].toUpperCase())}</span><strong>${esc(u.username)}</strong><span class="muted" style="font-size:11px">${esc(u.email||'')}</span><span class="friend-actions"><button class="button secondary tiny" onclick="adminSupportViewUI('${u.id}')">${en?'View (read-only)':'Consulter (lecture seule)'}</button></span></div>`).join(''):`<p class="muted">${en?'No match.':'Aucun résultat.'}</p>`;
  }catch(e){box.innerHTML=`<p class="muted">${authError(e,en)}</p>`}
}
async function adminSupportViewUI(userId){
  const en=siteLanguage==='en',box=$('#adminSupportResult');if(!box)return;
  box.innerHTML=`<p class="muted">${en?'Loading…':'Chargement…'}</p>`;
  try{
    const {user,data}=await window.MordheimundaAPI.adminSupportView(userId);
    const rosters=(data?.payload?.rosters||[]);
    box.innerHTML=`<div class="admin-support-view"><p><strong>${esc(user.username)}</strong> — ${esc(user.email||'')}</p>
      <p class="muted">${en?'This lookup has been logged; the user can see it was consulted.':'Cette consultation a été journalisée ; l’utilisateur peut voir qu’il a été consulté.'}</p>
      <p>${en?'Warbands':'Bandes'}: <strong>${rosters.length}</strong></p>
      <ul>${rosters.map(r=>`<li>${esc(r.name||(en?'Unnamed':'Sans nom'))} — ${(r.fighters||[]).length} ${en?'fighters':'combattants'}</li>`).join('')}</ul>
      <button class="button secondary tiny" onclick="loadFriendsPanel();$('#adminSupportResult').innerHTML=''">${en?'Close':'Fermer'}</button>
    </div>`;
  }catch(e){box.innerHTML=`<p class="muted">${authError(e,en)}</p>`}
}
function activeAdminEditData(){return adminRulesEditData||adminCatalogEditData}
function closeAdminWarbandRules(){adminRulesEditId=null;adminRulesEditData=null;adminWarbandSection='rules';adminEditingWarriorIdx=null;adminEditingEquipmentIdx=null;render('admin')}
function closeAdminCatalogEdit(){adminCatalogFactionId=null;adminCatalogEditData=null;adminWarbandSection='rules';adminEditingWarriorIdx=null;adminEditingEquipmentIdx=null;render('admin')}
async function saveAdminCatalogEdit(){
  const en=siteLanguage==='en';const d=adminCatalogEditData;if(!d||!adminCatalogFactionId)return;
  if(!d.warriors.length){toast(en?'A faction needs at least one fighter':'Une faction a besoin d’au moins un combattant');return}
  try{
    const bookName=D.factions.find(f=>f.id===adminCatalogFactionId)?.__catalogBookName||'';const newName=String(d.name||'').trim();
    await window.MordheimundaAPI.adminSaveCatalogOverride(adminCatalogFactionId,{displayName:newName&&newName!==bookName?newName:'',warriors:d.warriors,equipment:Array.isArray(d.equipment)?d.equipment:[],bandRuleNames:arr2(d.bandRuleNames),traits:arr2(d.traits),specialRules:arr2(d.specialRules),skillTrees:arr2(d.skillTrees),skills:arr2(d.skills),magicDomains:arr2(d.magicDomains),spells:arr2(d.spells)});
    await loadCatalogOverrides();
    toast(en?'Base catalog updated':'Catalogue de base mis à jour');
    // V-ADMINSAVESTAY: stay in the same editor instead of bouncing back to
    // the base Admin page (see saveAdminWarbandRules above).
    render('admin');
  }catch(e){toast(authError(e,en));}
}
function toggleAdminCatalogEquipment(el){
  const d=adminCatalogEditData;if(!d)return;
  const name=el?.dataset?.wname;if(!name)return;
  if(!Array.isArray(d.equipment))d.equipment=[];
  const i=d.equipment.findIndex(n=>normName(n)===normName(name));
  if(el.checked){if(i<0)d.equipment.push(name)}else if(i>=0)d.equipment.splice(i,1);
}
function adminDeletePublishedEquipment(enc){
  const en=siteLanguage==='en';const name=decodeURIComponent(enc);const holders=officialWarbandsHoldingEquipment(name);const mine=customEquipmentList().some(w=>normName(w.name)===normName(name));
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'DELETE FOR EVERYONE':'SUPPRESSION POUR TOUT LE MONDE'}</div><h2>${en?`Delete “${esc(name)}”?`:`Supprimer « ${esc(name)} » ?`}</h2><p>${en?'Removed from every official warband it was published into — for every account: Band Lists, Market, Référentiel. Fighters who already own it keep their copy.':'Retiré de toutes les bandes officielles où il a été publié — pour tous les comptes : Band Lists, Market, Référentiel. Les combattants qui le possèdent déjà gardent leur exemplaire.'}</p><p class="muted">${holders.map(f=>esc(f.displayName||f.name)).join(' · ')}</p>${mine?`<label class="toggle-line"><input id="delPubMine" type="checkbox" checked><span>${en?'Also delete it from my Custom library':'Le supprimer aussi de ma bibliothèque Custom'}</span></label>`:''}<button type="button" class="big-delete" onclick="confirmAdminDeletePublishedEquipment('${esc(enc)}')">${en?'DELETE FOR EVERYONE':'SUPPRIMER POUR TOUT LE MONDE'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`);
}
async function confirmAdminDeletePublishedEquipment(enc){
  const en=siteLanguage==='en';const name=decodeURIComponent(enc),n=normName(name);const alsoMine=!!$('#delPubMine')?.checked;const arr2=v=>Array.isArray(v)?v:[];let done=0,failed=0;
  for(const f of officialWarbandsHoldingEquipment(name)){
    const id=String(f.id).replace(/^official-/,'');
    try{const res=await window.MordheimundaAPI.adminGetWarband(id);const full=res?.warband||res;if(!full){failed++;continue}
      const d={name:full.name,warriors:arr2(full.warriors),equipment:arr2(full.equipment).filter(e=>normName(typeof e==='string'?e:e?.name)!==n),skillTrees:arr2(full.skillTrees),skills:arr2(full.skills),magicDomains:arr2(full.magicDomains),spells:arr2(full.spells),traits:arr2(full.traits),specialRules:arr2(full.specialRules),bandRuleNames:arr2(full.bandRuleNames),creatures:arr2(full.creatures)};
      await window.MordheimundaAPI.adminUpdateOfficialWarband(id,{...d,viaAdminEditor:true});done++}catch(e){failed++}
  }
  if(alsoMine){state.customEquipment=customEquipmentList().filter(w=>normName(w.name)!==n);save(true)}
  adminOfficialCache=null;try{await loadOfficialWarbands()}catch(e){}
  closeModal();renderCurrentRoute();
  toast(failed?(en?`${name}: removed from ${done} warband(s), ${failed} failed`:`${name} : retiré de ${done} bande(s), ${failed} échec(s)`):(en?`${name} deleted for everyone`:`${name} supprimé pour tout le monde`),3500);
}
function adminDeleteWeaponForAll(name){
  const en=siteLanguage==='en';
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'DELETE FOR EVERYONE':'SUPPRESSION POUR TOUT LE MONDE'}</div><h2>${en?`Delete “${esc(name)}”?`:`Supprimer « ${esc(name)} » ?`}</h2><p>${en?'Removed for every account: from the shared pool, every warband’s equipment list, the Market and the Référentiel. Fighters who already own it keep their copy. The book data is kept, so it can be restored later from Admin → Weapons & gear catalog → Deleted.':'Retiré pour tous les comptes : du pool partagé, de la liste d’équipement de chaque bande, du Marché et du Référentiel. Les combattants qui le possèdent déjà gardent leur exemplaire. Les données du livre sont conservées : tu peux le restaurer plus tard depuis Admin → Catalogue d’armes & équipement → Supprimés.'}</p><button type="button" class="big-delete" data-wname="${esc(name)}" onclick="confirmAdminDeleteWeaponForAll(this.dataset.wname)">${en?'DELETE FOR EVERYONE':'SUPPRIMER POUR TOUS'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`);
}
async function confirmAdminDeleteWeaponForAll(name){
  const en=siteLanguage==='en';
  const w=(D.weapons||[]).find(x=>x.name===name)||(D.__weaponsBaseline||[]).find(x=>x.name===name)||{name};
  const data={name:w.name,category:w.category||'Équipements divers',price:Number(w.price||0),availability:w.availability||'',market:false,band:false,hidden:true,deleted:true};
  try{
    await window.MordheimundaAPI.adminSaveWeaponOverride(w.name,data);
    await loadWeaponOverrides();
    if(adminWeaponEditName===name)adminWeaponEditName=null;
    closeModal();toast(en?`${name} deleted for everyone`:`${name} supprimé pour tout le monde`);render(parseAppRoute().view==='references'?'references':'admin');
  }catch(e){toast(authError(e,en));}
}
function openSkillTreeOverrideEditor(rawName){
  const en=siteLanguage==='en';
  const key=skillTreeOverrideKey(rawName);
  const o=domainOverrideMap.get(normName(key));
  const name=o?.name||rawName;
  openModal(`<div class="admin-live-editor"><div class="eyebrow">ADMIN</div><h2>${en?'Rename skill tree':'Renommer l’arbre de compétences'}</h2><p class="muted">${en?'Renames how this tree is shown in the Reference — the underlying skills/access are unaffected.':'Renomme l’affichage de cet arbre dans le Référentiel — les compétences/accès sous-jacents ne sont pas touchés.'}</p><label class="custom-field wide"><span>${en?'Displayed name':'Nom affiché'}</span><input id="skillTreeOverrideName" value="${esc(name)}"></label><div class="account-actions"><button class="button primary" type="button" onclick="saveSkillTreeOverrideUI('${esc(rawName).replace(/'/g,"\\'")}')">${en?'Save':'Enregistrer'}</button>${o?`<button class="button secondary" type="button" onclick="resetSkillTreeOverrideUI('${esc(rawName).replace(/'/g,"\\'")}')">${en?'Revert to book':'Revenir au livre'}</button>`:''}<button class="button secondary" type="button" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
function openDomainOverrideEditor(rawKey){
  const en=siteLanguage==='en';
  const o=domainOverrideMap.get(normName(rawKey));
  const name=o?.name||rawKey;
  const color=o?.color||spellDomainColor(rawKey);
  openModal(`<div class="admin-live-editor"><div class="eyebrow">ADMIN</div><h2>${en?'Edit domain':'Modifier le domaine'}</h2><p class="muted">${en?'Renames how this domain is shown in the Reference and sets its card color — the underlying game data (fighter access, spells) is unaffected.':'Renomme l’affichage de ce domaine dans le Référentiel et fixe la couleur de ses cartes — les données de jeu (accès des combattants, sorts) ne sont pas touchées.'}</p><label class="custom-field wide"><span>${en?'Displayed name':'Nom affiché'}</span><input id="domainOverrideName" value="${esc(name)}"></label><label class="custom-field"><span>${en?'Frame color':'Couleur du cadre'}</span><input id="domainOverrideColor" type="color" value="${esc(color)}"></label><label class="custom-field wide"><span>${en?'Category in the Reference menu':'Catégorie dans le menu du Référentiel'}</span><input id="domainOverrideGroup" list="domainGroupList" value="${esc(o?.group||'')}" placeholder="${en?'Empty = automatic (Base Magic or the warband’s race)':'Vide = automatique (Base Magic ou race de la bande)'}"><datalist id="domainGroupList">${[...new Set(['Base Magic',...[...domainOverrideMap.values()].map(x=>x.group).filter(Boolean)])].map(g=>`<option value="${esc(g)}">`).join('')}</datalist></label><div class="account-actions"><button class="button primary" type="button" onclick="saveDomainOverrideUI('${esc(rawKey).replace(/'/g,"\\'")}')">${en?'Save':'Enregistrer'}</button>${o?`<button class="button secondary" type="button" onclick="resetDomainOverrideUI('${esc(rawKey).replace(/'/g,"\\'")}')">${en?'Revert to book':'Revenir au livre'}</button>`:''}<button class="button secondary" type="button" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
function openRaceTagEditor(currentRace){
  const en=siteLanguage==='en';
  openModal(`<div class="admin-live-editor"><div class="eyebrow">${en?'EDIT':'ÉDITER'}</div><h2>${en?'Assign warbands to a race':'Assigner des warbands à une race'}</h2><p class="muted">${en?'Picking a race for a warband here just moves it between tiles on the Create page — nothing is duplicated or changed about the warband itself. Change as many as you like, then Save.':'Choisir une race ici déplace simplement la warband entre les cases de la page Créer — rien n’est dupliqué ni modifié dans la warband elle-même. Change autant de lignes que tu veux, puis Enregistre.'}</p><div id="raceTagEditorBody"></div><div class="account-actions"><button class="button primary" type="button" onclick="saveRaceTagEditor()">${en?'Save':'Enregistrer'}</button><button class="button secondary" type="button" onclick="closeModal()">${en?'Close':'Fermer'}</button></div></div>`);
  renderRaceTagEditor();
}
function renderRaceTagEditor(){
  const en=siteLanguage==='en',box=$('#raceTagEditorBody');if(!box)return;
  const list=D.factions.filter(f=>!f.packId&&!isContentPoolFaction(f)).slice().sort((a,b)=>(a.displayName||'').localeCompare(b.displayName||''));
  box.innerHTML=`<div class="custom-item-list" style="max-height:50vh;overflow:auto">${list.map(f=>{
    const current=raceTagMap.get(f.id)||'';
    return `<article class="custom-item-row"><div class="custom-item-main"><div><strong>${esc(f.displayName||f.name)}</strong><small>${f.__official?(en?'Official warband':'Warband officielle'):(en?'Book faction':'Faction du livre')}</small></div></div><div class="custom-item-actions"><select class="raceTagSelect" data-fid="${esc(f.id)}">${['',...RACE_CATEGORIES].map(r=>`<option value="${esc(r)}" ${current===r?'selected':''}>${r===''?(en?'— none —':'— aucune —'):esc(r)}</option>`).join('')}</select></div></article>`;
  }).join('')}</div>`;
}
async function saveRaceTagEditor(){
  const en=siteLanguage==='en';
  const rows=[...document.querySelectorAll('.raceTagSelect')];
  const changed=rows.filter(s=>(raceTagMap.get(s.dataset.fid)||'')!==s.value);
  if(!changed.length){toast(en?'Nothing changed':'Rien n’a changé');return}
  try{
    await Promise.all(changed.map(s=>s.value?window.MordheimundaAPI.adminSetRaceTag(s.dataset.fid,s.value):window.MordheimundaAPI.adminClearRaceTag(s.dataset.fid)));
    await loadRaceTags();
    renderRaceTagEditor();
    toast(en?`Saved — ${changed.length} updated`:`Enregistré — ${changed.length} modifiée${changed.length!==1?'s':''}`);
    render('create');
  }catch(e){toast(authError(e,en));}
}
function openFactionCategoryEditor(){
  const en=siteLanguage==='en';
  openModal(`<div class="admin-live-editor"><div class="eyebrow">${en?'EDIT':'ÉDITER'}</div><h2>${en?'Warband categories':'Catégories de warbands'}</h2><p class="muted">${en?'A category is an empty shell, scoped to one race, that groups several standalone warbands together on the directory (e.g. "Human Mercenaries" holding Averland, Middenheim…). It never has a roster of its own — it just groups existing warbands visually.':'Une catégorie est une coquille vide, propre à une race, qui regroupe plusieurs warbands indépendantes dans le répertoire (ex. « Human Mercenaries » avec Averland, Middenheim…). Elle n’a jamais de roster propre — elle regroupe juste des warbands existantes visuellement.'}</p>
  <div class="custom-form-grid" style="margin-bottom:10px">
    <label class="custom-field"><span>${en?'Race':'Race'}</span><select id="fcatNewRace">${RACE_CATEGORIES.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('')}</select></label>
    <label class="custom-field wide"><span>${en?'New category name':'Nom de la nouvelle catégorie'}</span><input id="fcatNewName" placeholder="${en?'e.g. Human Mercenaries':'ex. Human Mercenaries'}"></label>
  </div>
  <div class="custom-actions" style="margin-bottom:14px"><button class="button secondary" type="button" onclick="createFactionCategoryUI()">＋ ${en?'Add category':'Ajouter la catégorie'}</button></div>
  <div id="fcatListBody"></div>
  <hr style="border-color:var(--line);margin:16px 0">
  <h3 style="margin:0 0 8px">${en?'Assign warbands':'Assigner les warbands'}</h3>
  <div id="fcatAssignBody"></div>
  <div class="account-actions"><button class="button secondary" type="button" onclick="closeModal()">${en?'Close':'Fermer'}</button></div></div>`);
  renderFactionCategoryEditor();
}
function openRuleGroupsEditor(){
  const en=siteLanguage==='en';
  adminRuleGroupsEditData=RULES_NAV_GROUPS.map(g=>({...g,ids:g.ids.slice()}));
  openModal(`<div class="admin-live-editor"><div class="eyebrow">${en?'EDIT':'ÉDITER'}</div><h2>${en?'Rules page categories':'Catégories de la page Règles'}</h2><p class="muted">${en?'These are the theme cards on the Rules page. Rename, reorder, add, delete, or move a rule section between them, then Save.':'Ce sont les cartes-thèmes de la page Règles. Renomme, réordonne, ajoute, supprime, ou déplace une règle d’une catégorie à l’autre, puis Enregistre.'}</p><div id="ruleGroupsEditorBody"></div><div class="custom-actions" style="margin-top:10px"><button class="button secondary" type="button" onclick="addRuleGroupRow()">＋ ${en?'Add a category':'Ajouter une catégorie'}</button></div><div class="account-actions"><button class="button primary" type="button" onclick="saveRuleGroupsEditor()">${en?'Save':'Enregistrer'}</button><button class="button secondary" type="button" onclick="resetRuleGroupsEditor()">${en?'Reset to defaults':'Réinitialiser par défaut'}</button><button class="button secondary" type="button" onclick="closeModal()">${en?'Close':'Fermer'}</button></div></div>`);
  renderRuleGroupsEditor();
}
async function saveRuleGroupsEditor(){
  const en=siteLanguage==='en';
  syncRuleGroupsFromInputs();
  if(!adminRuleGroupsEditData.length){toast(en?'Add at least one category':'Ajoute au moins une catégorie');return}
  if(adminRuleGroupsEditData.some(g=>!g.fr.trim()||!g.en.trim())){toast(en?'Every category needs both labels':'Chaque catégorie a besoin des deux libellés');return}
  try{
    await window.MordheimundaAPI.adminSaveRuleNavGroups(adminRuleGroupsEditData);
    await loadRuleNavGroups();
    closeModal();
    toast(en?'Categories saved':'Catégories enregistrées');
    render('rules');
  }catch(e){toast(authError(e,en));}
}
async function resetRuleGroupsEditor(){
  const en=siteLanguage==='en';
  try{
    await window.MordheimundaAPI.adminResetRuleNavGroups();
    await loadRuleNavGroups();
    adminRuleGroupsEditData=RULES_NAV_GROUPS.map(g=>({...g,ids:g.ids.slice()}));
    renderRuleGroupsEditor();
    toast(en?'Reset to defaults':'Réinitialisé par défaut');
    render('rules');
  }catch(e){toast(authError(e,en));}
}
function openAdminWeaponEdit(name){adminWeaponEditName=name;const w=(D.weapons||[]).find(x=>x.name===name);const t=w?.profile?.traits;adminWeaponTraitDraft=Array.isArray(t)?t.slice():String(t||'').split(',').map(x=>x.trim()).filter(Boolean);skipAdminWeaponResetOnce=true;render('admin')}
function newAdminWeapon(){adminWeaponEditName='__new__';adminWeaponTraitDraft=[];skipAdminWeaponResetOnce=true;render('admin')}
function closeAdminWeaponEdit(){adminWeaponEditName=null;finishAdminWeaponEdit()}
function finishAdminWeaponEdit(){
  const returnName=adminWeaponEditReturnToRef;
  adminWeaponEditReturnToRef=null;
  if(returnName){
    render('references');
    setTimeout(()=>{
      const ge=equipmentGlossaryEntry(returnName);
      const target=ge?document.getElementById('ref-entry-'+ge.id):null;
      if(target)target.scrollIntoView({behavior:'smooth',block:'center'});
    },60);
  }else{
    render('admin');
  }
}
async function saveAdminWeapon(originalName){
  const en=siteLanguage==='en';
  const name=($('#awpName')?.value||'').trim();
  if(!name){toast(en?'Give the item a name':'Donne un nom à l’objet');return}
  const key=originalName==='__new__'?name:originalName;
  const data={
    name:key,
    category:$('#awpCategory')?.value||'Équipements divers',
    price:Number($('#awpPrice')?.value||0),
    availability:($('#awpAvailability')?.value||'').trim(),
    market:$('#awpMarket')?.checked!==false,
    band:$('#awpBand')?.checked!==false,
    hidden:$('#awpHidden')?.checked===true,
    factions:document.querySelector('input[name="awpScope"]:checked')?.value==='some'?[...document.querySelectorAll('.awpFaction:checked')].map(x=>x.dataset.faction):[],
    profile:{range:($('#awpRange')?.value||''),strength:($('#awpStrength')?.value||''),ap:($('#awpAp')?.value||''),damage:($('#awpDamage')?.value||''),traits:adminWeaponTraitDraft.join(', ')}
  };
  try{
    await window.MordheimundaAPI.adminSaveWeaponOverride(key,data);
    await loadWeaponOverrides();
    // V-WEAPONEDITMERGE: persist the free-text rules/description alongside
    // the structured profile — same override mechanism the old standalone
    // "✎" textarea editor used (ruleOverrides keyed by ref:equipment:<id>),
    // just saved from this unified form instead. Only attempted when the
    // item actually has a glossary/reference entry to attach text to; an
    // emptied field restores the original book text instead of saving blank.
    const ge=equipmentGlossaryEntry(key);
    if(ge){
      const sectionId=referenceOverrideSectionId('equipment',ge.id);
      const rulesText=($('#awpRulesText')?.value||'').trim();
      try{
        if(rulesText){
          await window.MordheimundaAPI.adminSaveRuleOverride(sectionId,0,rulesText);
          ruleOverridesCache=ruleOverridesCache||{};ruleOverridesCache[ruleOverrideKey(sectionId,0)]=rulesText;
        }else if(ruleHasOverride(sectionId,0)){
          await window.MordheimundaAPI.adminDeleteRuleOverride(sectionId,0);
          if(ruleOverridesCache)delete ruleOverridesCache[ruleOverrideKey(sectionId,0)];
        }
      }catch(e2){toast(authError(e2,en));}
    }
    toast(en?'Item saved':'Objet enregistré');
    adminWeaponEditName=null;
    finishAdminWeaponEdit();
  }catch(e){toast(authError(e,en));}
}
// V-WEAPONHIDE: lets an admin remove a buggy/undesirable BOOK item (one with
// no override yet, so resetAdminWeapon's 🗑 only offers "revert to book" —
// there's nothing to revert TO that would remove it) from every
// player-facing list site-wide — Market, Band List, Armoury, Référentiel —
// without touching data/catalog.js or breaking a fighter who already owns a
// copy (purchaseEquipment/refLink/etc. still resolve it by name via
// D.weapons, this only adds a `.hidden` flag that consumer-facing LISTS
// filter out; see equipmentPool/armory/renderArmory/referenceEntries/
// customFighterAllEquipment). Reuses the exact same weapon_overrides
// upsert as saveAdminWeapon — full row resend, never a partial patch — so an
// item with NO existing override yet is seeded from its live book values.
async function toggleAdminWeaponHidden(name){
  const en=siteLanguage==='en';
  const w=(D.weapons||[]).find(x=>x.name===name);if(!w)return;
  const data={name:w.name,category:w.category||'Équipements divers',price:Number(w.price||0),availability:w.availability||'',market:w.market!==false,band:w.band!==false,profile:w.profile?{...w.profile}:undefined,...(w.profile2?{profile2:{...w.profile2}}:{}),hidden:!w.hidden};
  try{
    await window.MordheimundaAPI.adminSaveWeaponOverride(name,data);
    await loadWeaponOverrides();
    toast(data.hidden?(en?`${name} hidden everywhere`:`${name} masqué partout`):(en?`${name} visible again`:`${name} de nouveau visible`));
    render('admin');
  }catch(e){toast(authError(e,en));}
}
async function resetAdminWeapon(name){
  const en=siteLanguage==='en';
  try{
    await window.MordheimundaAPI.adminResetWeaponOverride(name);
    await loadWeaponOverrides();
    toast(en?'Reverted to the book values':'Revenu aux valeurs du livre');
    render('admin');
  }catch(e){toast(authError(e,en));}
}
function adminWeaponFormMarkup(name){
  const en=siteLanguage==='en';
  const isNew=name==='__new__';
  const w=isNew?null:(D.weapons||[]).find(x=>x.name===name);
  const p=w?.profile||{};
  const cats=EQUIPMENT_CATEGORY_NAMES_FR;
  // V-WEAPONEDITMERGE: the item's free-text rules/description (previously
  // only reachable through a separate plain-textarea "✎" override editor)
  // now lives in this same form, right below the structured profile+traits
  // — one panel for everything, like the custom-weapon builder.
  if(ruleOverridesCache===null)loadRuleOverrides();
  const {ge,text:rulesText}=isNew?{ge:null,text:''}:equipmentEffectiveText(w?.name||name);
  return `<div class="custom-form-head"><div><div class="eyebrow">${isNew?(en?'NEW ITEM':'NOUVEL OBJET'):(en?'EDIT':'MODIFICATION')}</div><h3>${esc(w?.name||(en?'Add to the shared pool':'Ajouter au pool partagé'))}</h3></div></div>
  <p class="custom-field-help">${en?'Shared by every faction/warband — editing it here changes it everywhere it’s used. Per-faction access (who can buy it) is set from that faction’s Base catalog → Equipment tab instead.':'Partagé par toutes les factions/bandes — le modifier ici le change partout où il est utilisé. L’accès par faction (qui peut l’acheter) se règle depuis l’onglet Équipement du Catalogue de base de chaque faction.'}</p>
  <div class="custom-form-grid">
    <label class="custom-field wide"><span>${en?'Name':'Nom'}</span><input id="awpName" value="${esc(w?.name||'')}" ${isNew?'':'disabled'}></label>
    <label class="custom-field"><span>${en?'Category':'Sous-catégorie'}</span><select id="awpCategory">${cats.map(c=>`<option value="${esc(c)}" ${c===(w?.category||'Équipements divers')?'selected':''}>${c}</option>`).join('')}</select></label>
    <label class="custom-field"><span>${en?'Price (GC)':'Prix (GC)'}</span><input id="awpPrice" type="number" min="0" step="1" value="${Number(w?.price||0)}"></label>
    <label class="custom-field"><span>${en?'Availability':'Disponibilité'}</span><input id="awpAvailability" value="${esc(w?.availability||'')}"></label>
    <label class="custom-check"><input id="awpMarket" type="checkbox" ${w?.market!==false?'checked':''}><span>${en?'Sold on the open Market':'Vendu sur le Marché libre'}</span></label>
    <label class="custom-check"><input id="awpBand" type="checkbox" ${w?.band!==false?'checked':''}><span>${en?'Available as a Band List item':'Disponible dans la Liste de Bande'}</span></label>
    ${isNew?'':`<label class="custom-check"><input id="awpHidden" type="checkbox" ${w?.hidden===true?'checked':''}><span>${en?'Hidden — buggy or undesirable, removed from Market/Band List/Reference everywhere':'Masqué — bugué ou non désirable, retiré du Marché/Liste de Bande/Référentiel partout'}</span></label>`}
  </div>
  ${(()=>{const sel=Array.isArray(w?.factions)?w.factions:[];const some=sel.length>0;const opts=creatureScopeFactionOptions();return `<details class="custom-collapse"${some?' open':''}><summary><span>${en?'AVAILABILITY':'DISPONIBILITÉ'}</span><small>${some?`${sel.length} ${en?'warband'+(sel.length>1?'s':''):'bande'+(sel.length>1?'s':'')}`:(en?'All warbands':'Toutes les bandes')}</small></summary>
    <label class="custom-check"><input type="radio" name="awpScope" value="all" ${some?'':'checked'} onchange="this.closest('details').querySelector('.awp-faction-grid').style.display='none'"> <span><b>${en?'All warbands':'Toutes les bandes'}</b><small>${en?'Visible to every warband (according to the Market / Band List ticks above).':'Visible par toutes les bandes (selon les cases Marché / Liste de bande ci-dessus).'}</small></span></label>
    <label class="custom-check"><input type="radio" name="awpScope" value="some" ${some?'checked':''} onchange="this.closest('details').querySelector('.awp-faction-grid').style.display=''"> <span><b>${en?'Only the warbands ticked below':'Seulement les bandes cochées ci-dessous'}</b><small>${en?'Hidden from everyone else — Band List, Market, Unrestricted list and Trading Post. E.g. Wardogs for Human warbands only.':'Invisible pour les autres — Liste de bande, Marché, liste libre et Trading Post. Ex. : Wardogs réservés aux bandes humaines.'}</small></span></label>
    <div class="custom-faction-grid awp-faction-grid" style="${some?'':'display:none'}">${opts.map(o=>`<label class="custom-check"><input class="awpFaction" data-faction="${esc(o.id)}" type="checkbox" ${sel.includes(o.id)?'checked':''}><span>${esc(o.name)}</span></label>`).join('')}</div></details>`})()}
  <div class="custom-weapon-grid" id="awpProfileFields"><label class="custom-field"><span>${en?'Range':'Portée'}</span><input id="awpRange" value="${esc(p.range||'')}" oninput="refreshAdminWeaponPreview()"></label><label class="custom-field"><span>${en?'Strength':'Force'}</span><input id="awpStrength" value="${esc(p.strength||'')}" oninput="refreshAdminWeaponPreview()"></label><label class="custom-field"><span>AP</span><input id="awpAp" value="${esc(p.ap||'')}" oninput="refreshAdminWeaponPreview()"></label><label class="custom-field"><span>${en?'Damage':'Dégâts'}</span><input id="awpDamage" value="${esc(p.damage||'')}" oninput="refreshAdminWeaponPreview()"></label></div>
  ${traitPickerMarkup('adminWeapon')}
  <div class="custom-weapon-preview" id="awpWeaponPreview">${adminWeaponPreviewMarkup(w?.name||$('#awpName')?.value,p)}</div>
  <label class="custom-field wide"><span>${en?'Special rules / description (shown in the Reference tab)':'Règles spéciales / description (affiché dans l’onglet Référentiel)'}</span><textarea id="awpRulesText" class="wide-textarea" rows="6" placeholder="${en?'Optional — leave empty if this item has no extra rules text.':'Facultatif — laisse vide si cet objet n’a pas de texte de règle particulier.'}">${esc(rulesText||'')}</textarea></label>
  <div class="custom-actions"><button type="button" class="button secondary" data-orig="${esc(isNew?'__new__':name)}" onclick="closeAdminWeaponEdit()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" data-orig="${esc(isNew?'__new__':name)}" onclick="saveAdminWeapon(this.dataset.orig)">${en?'Save':'Enregistrer'}</button></div>`;
}
function setAdminWarbandSection(v){adminWarbandSection=v;adminEditingWarriorIdx=null;adminEditingEquipmentIdx=null;render('admin')}
function toggleAdminBandRule(kind,idx){
  // V151: was reading adminRulesEditData directly, so this silently no-op'd
  // in the base-catalog editor (adminCatalogEditData) even once that data
  // shape gained traits/specialRules/bandRuleNames — see activeAdminEditData.
  const d=activeAdminEditData();if(!d)return;
  if(!Array.isArray(d.bandRuleNames))d.bandRuleNames=[];
  const list=kind==='special'?d.specialRules:d.traits;
  const r=list?.[idx];if(!r)return;
  const set=new Set(d.bandRuleNames.map(normName));
  if(set.has(normName(r.name)))d.bandRuleNames=d.bandRuleNames.filter(n=>normName(n)!==normName(r.name));
  else d.bandRuleNames=[...d.bandRuleNames,r.name];
  render('admin');
}
function addAdminBandRule(kind){
  const en=siteLanguage==='en';
  const d=activeAdminEditData();if(!d)return;
  if(!Array.isArray(d.bandRuleNames))d.bandRuleNames=[];
  const nameId=kind==='special'?'adminNewSpecialName':'adminNewTraitName',textId=kind==='special'?'adminNewSpecialText':'adminNewTraitText';
  const name=($('#'+nameId)?.value||'').trim(),text=($('#'+textId)?.value||'').trim();
  if(!name){toast(en?'Give the rule a name':'Donne un nom à la règle');return}
  if(!Array.isArray(d.specialRules))d.specialRules=[];
  if(!Array.isArray(d.traits))d.traits=[];
  const list=kind==='special'?d.specialRules:d.traits;
  if(list.some(r=>normName(r.name)===normName(name))){toast(en?'A rule with this name already exists':'Une règle porte déjà ce nom');return}
  list.push({name,text});
  d.bandRuleNames=[...d.bandRuleNames,name];
  render('admin');
}
async function saveAdminWarbandRules(force){
  const en=siteLanguage==='en';
  const d=adminRulesEditData;if(!d||!adminRulesEditId)return;
  if(!String(d.name||'').trim()){toast(en?'Give the warband a name':'Donne un nom à la bande');return}
  // V-SAVEGUARD: a save that would drop most of the fighters or equipment
  // the editor originally loaded is far more likely to be an accident
  // (a partial/stale load, one delete click too many) than an intentional
  // mass-removal — confirm before it overwrites the live warband. Doesn't
  // fire on a real, deliberate cleanup (small/moderate drops, or when
  // there was nothing to lose in the first place).
  if(!force&&adminRulesOriginalCounts){
    const shrunkWarriors=adminRulesOriginalCounts.warriors>=3&&d.warriors.length<=Math.ceil(adminRulesOriginalCounts.warriors*0.4);
    const shrunkEquipment=adminRulesOriginalCounts.equipment>=3&&d.equipment.length<=Math.ceil(adminRulesOriginalCounts.equipment*0.4);
    if(shrunkWarriors||shrunkEquipment){
      const parts=[];
      if(shrunkWarriors)parts.push(en?`fighters: ${adminRulesOriginalCounts.warriors} → ${d.warriors.length}`:`combattants : ${adminRulesOriginalCounts.warriors} → ${d.warriors.length}`);
      if(shrunkEquipment)parts.push(en?`equipment: ${adminRulesOriginalCounts.equipment} → ${d.equipment.length}`:`équipement : ${adminRulesOriginalCounts.equipment} → ${d.equipment.length}`);
      openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'BIG DROP DETECTED':'GROSSE CHUTE DÉTECTÉE'}</div><h2>${en?'This save will remove most of this warband’s content':'Cet enregistrement va retirer la majorité du contenu de cette bande'}</h2><p>${esc(parts.join(' · '))}</p><p>${en?'If this isn’t intentional, go back and check before overwriting the live warband.':'Si ce n’est pas voulu, reviens en arrière et vérifie avant d’écraser la bande en ligne.'}</p><button type="button" class="big-delete" onclick="saveAdminWarbandRules(true);closeModal()">${en?'SAVE ANYWAY':'ENREGISTRER QUAND MÊME'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`);
      return;
    }
  }
  try{
    // V-WARBANDLOCK (Task #80): viaAdminEditor:true tells the server this
    // save came from the direct admin editor, not from the original
    // custom-warband owner's "Publier les modifications" republish — it
    // marks the warband as admin-locked (admin_edited_at) so that republish
    // path stops silently overwriting whatever gets added here.
    await window.MordheimundaAPI.adminUpdateOfficialWarband(adminRulesEditId,{name:d.name,warriors:d.warriors,equipment:d.equipment,skillTrees:d.skillTrees,skills:d.skills,magicDomains:d.magicDomains,spells:d.spells,traits:d.traits,specialRules:d.specialRules,bandRuleNames:d.bandRuleNames,viaAdminEditor:true});
    adminOfficialCache=null;
    await loadOfficialWarbands();
    toast(en?'Live warband updated':'Bande en ligne mise à jour');
    // V-ADMINSAVESTAY: previously called closeAdminWarbandRules() here, which
    // kicked the admin all the way back to the base Admin page on every save
    // — annoying when making several edits in a row. Now stays in the same
    // editor (adminRulesEditData/adminRulesEditId are left untouched) and
    // just re-renders in place.
    render('admin');
  }catch(e){toast(authError(e,en));}
}
function adminEditWarrior(idx){const d=activeAdminEditData();adminEditingWarriorIdx=idx;adminRuleDraft=(d?.warriors?.[idx]?.ruleNames||[]).slice();render('admin')}
async function adminClearWarriorDescriptions(){
  const en=siteLanguage==='en';const d=activeAdminEditData();if(!d)return;
  if(!await siteConfirm(en?'Clear every fighter description of this warband? Save the warband afterwards.':'Effacer toutes les descriptions des combattants de cette bande ? Enregistre ensuite la bande.'))return;
  (d.warriors||[]).forEach(w=>{if(w)w.description=''});render('admin');toast(en?'Descriptions cleared — save the warband':'Descriptions effacées — enregistre la bande');
}
function adminNewWarrior(){adminEditingWarriorIdx=-1;adminRuleDraft=[];render('admin')}
function adminCancelWarrior(){adminEditingWarriorIdx=null;adminRuleDraft=[];render('admin')}
function confirmAdminDeleteWarrior(idx){
  const en=siteLanguage==='en';
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'REMOVE FIGHTER':'RETIRER LE COMBATTANT'}</div><h2>${en?'Remove this fighter from the warband?':'Retirer ce combattant de la bande ?'}</h2><p>${en?'This only affects the definition — saving is still required to apply it.':'Ceci ne modifie que la fiche en cours d’édition — il faudra encore Enregistrer pour l’appliquer.'}</p><button type="button" class="big-delete" onclick="adminDeleteWarrior(${idx});closeModal()">${en?'REMOVE':'RETIRER'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`);
}
// Inserts a copy right after the original (new id, "(copy)" name) and opens
// it; nothing is sent until the warband is saved, like any other edit here.
function adminDuplicateWarrior(idx){
  const en=siteLanguage==='en';const d=activeAdminEditData();const src=d?.warriors?.[idx];if(!src)return;
  const copy=JSON.parse(JSON.stringify(src));
  const base=String(src.name||'').replace(/\s*\((?:copy|copie)(?: \d+)?\)$/i,'');const taken=new Set(d.warriors.map(w=>normName(w.name)));
  let name=`${base} (${en?'copy':'copie'})`,n=2;while(taken.has(normName(name))){name=`${base} (${en?'copy':'copie'} ${n})`;n++}
  copy.name=name;copy.id=(crypto.randomUUID?crypto.randomUUID():String(Date.now()));delete copy.customFighterId;
  d.warriors.splice(idx+1,0,copy);
  adminEditWarrior(idx+1);
  toast(en?`“${name}” added — edit it, then save the warband`:`« ${name} » ajouté — modifie-le puis enregistre la bande`);
}
function adminDeleteWarrior(idx){const d=activeAdminEditData();if(!d)return;d.warriors.splice(idx,1);adminEditingWarriorIdx=null;render('admin')}
// What the Equipment Access checklist starts from: the saved exact list, or
// (never edited yet) everything the fighter can buy today through the book's
// group access plus any item added explicitly.
function adminEffectiveEquipmentAccess(w){
  if(!w)return [];
  if(w.customFighterId||w.equipmentAccessExact)return Array.isArray(w.equipmentAccess)?w.equipmentAccess.slice():[];
  const fid=adminCatalogFactionId||(adminRulesEditId?'official-'+adminRulesEditId:null);
  const fac=D.factions.find(f=>f.id===fid)||D.factions.find(f=>f.id===adminCatalogFactionId)||null;
  try{return customFighterAllEquipment().filter(it=>warriorBandAllowed(it,w,fac)).map(it=>it.name)}catch(e){return Array.isArray(w.equipmentAccess)?w.equipmentAccess.slice():[]}
}
function saveAdminWarrior(idx){
  const en=siteLanguage==='en';const d=activeAdminEditData();if(!d)return;
  const name=($('#awName')?.value||'').trim();
  if(!name){toast(en?'Give the fighter a name':'Donne un nom au combattant');return}
  const profile=P.map((_,i)=>Number($('#awStat'+i)?.value||0));
  const maxRaw=($('#awMax')?.value||'').trim();
  const maxMode=$('#awMaxMode')?.value||'auto';
  const manualMaxProfile=maxMode==='manual'?P.map((_,i)=>{const n=Number($('#awMaxStat'+i)?.value);return Number.isFinite(n)?n:profile[i]||0}):null;
  const existingW=(idx===-1||idx==null||idx<0)?null:d.warriors[idx];
  const w={
    // V-ADMINKEEP: start from the existing record so fields this form
    // doesn't show (Hired Sword upkeep, who can hire it, its choices,
    // customFighterId…) survive an edit instead of being wiped.
    ...(existingW||{}),
    // V-NOWARRIORID: this editor used to build the warrior object with no
    // `id` at all — on a NEW fighter that meant it never had one, and on an
    // EDIT this whole object replaces d.warriors[idx], so even a fighter
    // that already had an id lost it silently the moment an admin touched
    // it here. Every recruitment mechanism (the pool's Recruter button,
    // owned-count matching, wid lookups) depends on that id existing — so a
    // fighter edited/added through this panel could never be recruited
    // again (the button's data-recruit-fighter ends up empty and its click
    // handler bails out silently, no error, no toast: exactly what looked
    // like "recruiting does nothing"). Keep the existing id when editing,
    // mint a real one when there wasn't one already (new fighter, or an
    // older one saved before this fix).
    id:d.warriors[idx]?.id||crypto.randomUUID(),
    name,type:$('#awType')?.value||'Henchman',
    cost:Number($('#awCost')?.value||0),
    race:($('#awRace')?.value||'Human').trim()||'Human',
    max:maxRaw===''?null:Number(maxRaw),
    profile,maxMode,manualMaxProfile,
    ruleNames:adminRuleDraft.slice(),
    defaultSkills:customFighterReadChecks('awDefaultSkills'),
    defaultEquipment:customFighterReadChecks('awDefaultEquipment'),
    equipmentAccess:customFighterReadChecks('awEquipmentAccess'),
    equipmentAccessExact:true,
    noEquipment:!!$('#awNoEquip')?.checked,
    noMisericordia:!!$('#awNoMiseri')?.checked,
    updatedAt:Date.now(),
    skillAccess:(()=>{const o={};document.querySelectorAll('.awSkillAccess').forEach(s=>{if(s.value)o[s.dataset.set]=s.value});return o})(),
    magicAccess:(()=>{const o={};document.querySelectorAll('.awMagicAccess').forEach(s=>{if(s.value)o[s.dataset.domain]=s.value});return o})(),
    // Book fighters commonly carry this as the STRING "ALL" (see
    // warriorBandAllowed's `if(groups==='ALL')return true`), not an array —
    // Array.isArray alone used to silently reset that to [] on every edit
    // through this panel, cutting the fighter off from all equipment. Keep
    // "ALL" as-is; only default to [] when there's truly nothing to carry
    // over (a brand-new fighter).
    equipmentAccessGroups:d.warriors[idx]?.equipmentAccessGroups==='ALL'?'ALL':Array.isArray(d.warriors[idx]?.equipmentAccessGroups)?d.warriors[idx].equipmentAccessGroups.slice():[],
    recruitOptions:recruitOptionsRead().filter(o=>o.name),
    bannedCategories:bannedCategoriesRead(),
    bannedExceptions:bannedExceptionsRead(),
    description:($('#awDescription')?.value||'')
  };
  w.rules=w.ruleNames.join(', ');
  if(w.type==='Hired Sword'){w.hiredSword=true;w.max=1;w.upkeep=Math.max(0,Number($('#awUpkeep')?.value||0))||0;}else{delete w.hiredSword;}
  if(idx===-1||idx==null||idx<0)d.warriors.push(w);else d.warriors[idx]=w;
  adminEditingWarriorIdx=null;
  render('admin');
}
function adminWarriorRow(w,i,total){
  const en=siteLanguage==='en';
  return `<article class="custom-item-row"><div class="custom-item-main"><div class="custom-item-icon">☠</div><div><strong>${esc(w.name)}</strong><small>${esc(w.type||'Henchman')} · ${esc(w.race||'Human')} · ${Number(w.cost||0)} GC</small></div></div><div class="custom-item-actions"><button type="button" class="equipment-action" title="${en?'Move up (appears earlier in recruitment)':'Monter (apparaît plus tôt en recrutement)'}" ${i===0?'disabled':''} onclick="moveAdminWarrior(${i},-1)">▲</button><button type="button" class="equipment-action" title="${en?'Move down':'Descendre'}" ${i===total-1?'disabled':''} onclick="moveAdminWarrior(${i},1)">▼</button><button type="button" class="equipment-action" title="${en?'Duplicate this fighter':'Dupliquer ce combattant'}" onclick="adminDuplicateWarrior(${i})">⧉</button><button type="button" class="equipment-action" onclick="adminEditWarrior(${i})">✎</button><button type="button" class="equipment-action remove" onclick="confirmAdminDeleteWarrior(${i})">🗑</button></div></article>`;
}
function moveAdminWarrior(i,dir){
  const d=activeAdminEditData();if(!d||!Array.isArray(d.warriors))return;
  const j=i+dir;if(j<0||j>=d.warriors.length)return;
  const tmp=d.warriors[i];d.warriors[i]=d.warriors[j];d.warriors[j]=tmp;
  render('admin');
}
function adminWarriorFormMarkup(w,idx){
  const en=siteLanguage==='en';
  const types=['Leader','Champion','Raw Recruit','Henchman','Hired Sword'];
  // V-ADMINHS: a Hired Sword edited here (e.g. in the content pool) keeps
  // its type; one already saved as a plain fighter by the old form is
  // recognized by name and offered back as a Hired Sword.
  const knownHS=new Set([...customFighterList().filter(isHiredSword).map(x=>normName(x.name)),...BOOK_HIRED_SWORDS.map(b=>normName(b.name))]);
  const awTypeValue=isHiredSword(w)||(w?.name&&knownHS.has(normName(w.name)))?'Hired Sword':(w?.type||'Henchman');
  const p=w?.profile||P.map(()=>1);
  // V-WARBANDSYNC (Task #37): customMergedSkillSets()/customMergedMagicDomains()
  // called with no faction only ever merge in the ADMIN'S OWN per-account
  // custom trees/domains — never this warband's own exclusive skill trees /
  // magic domains (d.skillTrees/d.magicDomains, e.g. a Vampire faction's
  // "Bloodline Powers" tree). That left no checkbox at all for those, so
  // saving this form — which builds skillAccess/magicAccess purely from the
  // <select> elements actually present — silently wiped any fighter's access
  // to their warband's own exclusive tree/domain on every admin edit. Union
  // in this warband's own d.skillTrees/d.magicDomains names explicitly.
  const d=activeAdminEditData();
  const skillSetNames=[...new Set([...Object.keys(customMergedSkillSets()),...(d?.skillTrees||[]).map(t=>t.name).filter(Boolean)])];
  const magicDomainNames=[...new Set([...Object.keys(customMergedMagicDomains()),...(d?.magicDomains||[]).map(t=>t.name).filter(Boolean)])];
  // Same gap for the DEFAULT SKILLS checklist below: customFighterSkillNames()
  // only lists skills from the account's own custom trees, not this
  // warband's own exclusive ones (d.skills) — union them in too.
  const defaultSkillNames=[...new Set([...customFighterSkillNames(),...(d?.skills||[]).map(s=>s.name).filter(Boolean)])].sort((a,b)=>a.localeCompare(b));
  // V-WARBANDSYNC2 (Task #55): the checkbox above only shows a tree/domain
  // whose name EXACTLY matches one of skillSetNames/magicDomainNames, and
  // whether it's pre-selected also compares the fighter's stored
  // skillAccess/magicAccess key by exact string. A fighter saved with a
  // slightly different spelling of its own tree/domain (the same
  // casing/whitespace drift fixed elsewhere for officializing/duplicating)
  // shows here as "Not allowed" even though it truly has that access — and
  // since saveAdminWarrior() below rebuilds skillAccess/magicAccess purely
  // from whatever the selects show, clicking Apply on ANY other field then
  // silently drops that access for good. Falling back to a normalized-name
  // lookup keeps the checkbox honest, and re-saves the CANONICAL key
  // (dataset.set/dataset.domain, not the drifted one) going forward.
  const skillAccessNorm={};Object.entries(w?.skillAccess||{}).forEach(([k,v])=>{skillAccessNorm[normName(k)]=v;});
  const magicAccessNorm={};Object.entries(w?.magicAccess||{}).forEach(([k,v])=>{magicAccessNorm[normName(k)]=v;});
  return `<div class="custom-form-head"><div><div class="eyebrow">${idx===-1?(en?'NEW FIGHTER':'NOUVEAU COMBATTANT'):(en?'EDIT FIGHTER':'MODIFICATION')}</div><h3>${esc(w?.name||(en?'Build a fighter':'Construire un combattant'))}</h3></div></div>
  <div class="custom-form-grid">
    <label class="custom-field wide"><span>${en?'Name':'Nom'}</span><input id="awName" value="${esc(w?.name||'')}" placeholder="${en?'e.g. Warlord':'Ex. Maître de guerre'}"></label>
    <label class="custom-field"><span>${en?'Role':'Sous-catégorie'}</span><select id="awType" onchange="const u=document.getElementById('awUpkeepField');if(u)u.style.display=this.value==='Hired Sword'?'':'none'">${types.map(t=>`<option value="${esc(t)}" ${t===awTypeValue?'selected':''}>${esc(t)}</option>`).join('')}</select></label>
    <label class="custom-field" id="awUpkeepField" style="${awTypeValue==='Hired Sword'?'':'display:none'}"><span>${en?'Upkeep (GC)':'Entretien (GC)'}</span><input id="awUpkeep" type="number" min="0" step="1" value="${Number(w?.upkeep||0)}"></label>
    <label class="custom-field"><span>${en?'Cost (GC)':'Valeur de base (GC)'}</span><input id="awCost" type="number" min="0" step="1" value="${Number(w?.cost||0)}"></label>
    <label class="custom-field"><span>${en?'Race':'Race'}</span><input id="awRace" value="${esc(w?.race||'Human')}"></label>
    <label class="custom-field"><span>${en?'Max in warband':'Limite'}</span><input id="awMax" type="number" min="0" step="1" value="${w?.max===null||w?.max===undefined?'':Number(w.max)}" placeholder="${en?'Blank = no limit':'Vide = aucune limite'}"></label>
    <label class="custom-field"><span>${en?'Stat maximums mode':'Mode des maximums'}</span><select id="awMaxMode"><option value="auto" ${(w?.maxMode||'auto')==='auto'?'selected':''}>${en?'Automatic (race + modifiers)':'Automatique (race + modificateurs)'}</option><option value="manual" ${(w?.maxMode||'auto')==='manual'?'selected':''}>${en?'Manual':'Manuel'}</option></select></label>
  </div>
  <details class="custom-collapse" open><summary><span>${en?'PROFILE':'CARACTÉRISTIQUES'}</span><small>12 ${en?'values':'valeurs'}</small></summary><table class="custom-stat-bar"><tr>${P.map((n,i)=>`<th title="${esc(P_FULL[i])}">${esc(n)}</th>`).join('')}</tr><tr>${P.map((n,i)=>`<td><input id="awStat${i}" type="number" step="1" value="${esc(p[i]??'')}"></td>`).join('')}</tr></table></details>
  <details class="custom-collapse" open><summary><span>${en?'STAT MAXIMUMS':'MAXIMUMS MANUELS'}</span><small>${en?'Used if mode is Manual':'Utilisés si mode manuel'}</small></summary><table class="custom-stat-bar"><tr>${P.map((n,i)=>`<th title="${esc(P_FULL[i])}">${esc(n)}</th>`).join('')}</tr><tr>${P.map((n,i)=>`<td><input id="awMaxStat${i}" type="number" min="0" step="1" value="${esc((w?.manualMaxProfile?.[i]??p[i]??0))}"></td>`).join('')}</tr></table></details>
  <details class="custom-collapse" open><summary><span>${en?'SPECIAL RULES':'RÈGLES SPÉCIALES'}</span><small>${adminRuleDraft.length} ${en?'linked':(adminRuleDraft.length!==1?'liées':'liée')}</small></summary><div class="custom-tag-editor"><div id="awRuleTags" class="custom-trait-tags">${adminRuleDraft.map((s,i)=>`<span class="custom-trait-tag">${refLink('special',s,s)}${isEditableParamTag('adminFighter',s)?`<button type="button" title="${en?'Edit value':'Modifier la valeur'}" class="trait-tag-edit" onclick="editTraitParamValue('adminFighter',${i})">✎</button>`:''}<button type="button" onclick="removeAdminWarriorRule(${i})">×</button></span>`).join('')||`<span class="custom-trait-empty">${en?'No special rules.':'Aucune règle spéciale.'}</span>`}</div><div class="custom-trait-add"><input id="awRuleInput" list="awRulesDatalist" placeholder="${en?'Search a special rule…':'Rechercher une règle spéciale…'}" onkeydown="handleAdminWarriorRuleKey(event)"><datalist id="awRulesDatalist">${[...new Set([...referenceEntries('special').filter(s=>!/^Race\s*\(/i.test(s.name)).map(s=>s.name),...(d?.specialRules||[]).map(s=>s?.name).filter(Boolean)])].map(n=>`<option value="${esc(n)}">`).join('')}</datalist><button type="button" class="button secondary" onclick="addAdminWarriorRule()">＋ ${en?'Add':'Ajouter'}</button></div></div></details>
  <details class="custom-collapse" open><summary><span>${en?'SKILL TREE ACCESS':'ARBRE DE COMPÉTENCES'}</span><small>${en?'Not allowed / Authorized / Primary / Secondary':'Non autorisé / Autorisé / Primary / Secondary'}</small></summary><div class="custom-skill-access-grid">${skillSetNames.map(set=>{const val=w?.skillAccess?.[set]??skillAccessNorm[normName(set)]??'';return `<label><span>${esc(set)}</span><select class="awSkillAccess" data-set="${esc(set)}"><option value="">${en?'Not allowed':'Non autorisé'}</option><option value="Access" ${val==='Access'?'selected':''}>${en?'Authorized':'Autorisé'}</option><option value="Primary" ${val==='Primary'?'selected':''}>Primary</option><option value="Secondary" ${val==='Secondary'?'selected':''}>Secondary</option></select></label>`}).join('')}</div></details>
  <details class="custom-collapse"><summary><span>${en?'MAGIC DOMAIN ACCESS':'SORTS / DOMAINES DE MAGIE'}</span><small>${en?'None / Primary / Secondary':'Non autorisé / Primary / Secondary'}</small></summary><div class="custom-skill-access-grid">${magicDomainNames.map(domain=>{const val=w?.magicAccess?.[domain]??magicAccessNorm[normName(domain)]??'';return `<label><span>${esc(domain)}</span><select class="awMagicAccess" data-domain="${esc(domain)}"><option value="">${en?'Not allowed':'Non autorisé'}</option><option value="Primary" ${val==='Primary'?'selected':''}>Primary</option><option value="Secondary" ${val==='Secondary'?'selected':''}>Secondary</option></select></label>`}).join('')}</div></details>
  <details class="custom-collapse"><summary><span>${en?'DEFAULT SKILLS':'COMPÉTENCES PAR DÉFAUT'}</span><small>${(w?.defaultSkills||[]).length}</small></summary><div class="custom-equipment-checks">${defaultSkillNames.map(s=>`<label><input class="awDefaultSkills" data-name="${esc(s)}" type="checkbox" ${(w?.defaultSkills||[]).some(n=>normName(n)===normName(s))?'checked':''}><span>${refLink('skills',s,s)}</span></label>`).join('')}</div></details>
  <details class="custom-collapse"><summary><span>${en?'DEFAULT EQUIPMENT':'ÉQUIPEMENT PAR DÉFAUT'}</span><small>${(w?.defaultEquipment||[]).length}</small></summary>${customFighterEquipmentChooser('awDefaultEquipment',w?.defaultEquipment||[],'default')}</details>
  <label class="custom-check no-equip-check"><input type="checkbox" id="awNoMiseri" ${w?.noMisericordia?'checked':''}><span>${en?'No weapon (Misericordia) — this fighter doesn’t carry the Misericordia every fighter has':'Pas d’arme (Misericordia) — ce combattant n’a pas la Misericordia que tout le monde porte'}</span></label>
  <label class="custom-check no-equip-check"><input type="checkbox" id="awNoEquip" ${w?.noEquipment?'checked':''}><span>${en?'Cannot receive equipment — buys nothing and gets no Stash items (starting gear stays)':'Ne peut pas recevoir d’équipement — n’achète rien et ne reçoit aucun objet de la réserve (l’équipement de départ reste)'}</span></label>
  ${(()=>{const acc=adminEffectiveEquipmentAccess(w);return `<details class="custom-collapse"><summary><span>${en?'EQUIPMENT ACCESS':'ACCÈS À L’ÉQUIPEMENT'}</span><small>${acc.length}</small></summary><p class="custom-field-help">${en?'The complete list of what this fighter can buy (its Band List). Ticked = allowed, unticked = not allowed — saving makes this list exact, the book’s group access is no longer added on top.':'La liste complète de ce que ce combattant peut acheter (sa Band List). Coché = autorisé, décoché = interdit — l’enregistrement rend cette liste exacte, l’accès par groupe du livre n’est plus ajouté par-dessus.'}</p>${customFighterEquipmentChooser('awEquipmentAccess',acc,'access')}</details>`})()}
  ${recruitOptionsEditorMarkup(w)}
  ${bannedCategoriesEditorMarkup(w)}
  <details class="custom-collapse"${String(w?.description||'').trim()?' open':''}><summary><span>DESCRIPTION</span><small>${String(w?.description||'').trim()?(en?'Shown on the profile':'Affichée sur le profil'):(en?'Empty':'Vide')}</small></summary>${customTextToolbarMarkup('awDescription')}<textarea id="awDescription" class="wide-textarea" rows="4">${esc(w?.description||'')}</textarea><button type="button" class="button secondary small desc-clear" onclick="const t=document.getElementById('awDescription');if(t)t.value=''">✕ ${en?'Clear the description':'Effacer la description'}</button></details>
  <div class="custom-actions"><button type="button" class="button secondary" onclick="adminCancelWarrior()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" onclick="saveAdminWarrior(${idx})">${en?'Apply':'Appliquer'}</button></div>`;
}
function adminNewEquipment(){adminEditingEquipmentIdx=-1;render('admin')}
function adminCancelEquipment(){adminEditingEquipmentIdx=null;render('admin')}
function confirmAdminDeleteEquipment(idx){
  const en=siteLanguage==='en';
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'REMOVE EQUIPMENT':'RETIRER L’ÉQUIPEMENT'}</div><h2>${en?'Remove this item from the warband?':'Retirer cet objet de la bande ?'}</h2><p>${en?'This only affects the definition — saving is still required to apply it.':'Ceci ne modifie que la fiche en cours d’édition — il faudra encore Enregistrer pour l’appliquer.'}</p><button type="button" class="big-delete" onclick="adminDeleteEquipment(${idx});closeModal()">${en?'REMOVE':'RETIRER'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`);
}
function adminDeleteEquipment(idx){const d=activeAdminEditData();if(!d)return;d.equipment.splice(idx,1);adminEditingEquipmentIdx=null;render('admin')}
function toggleAdminWeaponFields(){
  const box=$('#awWeaponFields');if(!box)return;
  const weapon=$('#aeType')?.value==='weapon';
  box.innerHTML=weapon?`<div class="custom-weapon-grid"><label class="custom-field"><span>${siteLanguage==='en'?'Range':'Portée'}</span><input id="aeRange" value=""></label><label class="custom-field"><span>${siteLanguage==='en'?'Strength':'Force'}</span><input id="aeStrength" value=""></label><label class="custom-field"><span>AP</span><input id="aeAp" value=""></label><label class="custom-field"><span>${siteLanguage==='en'?'Damage':'Dégâts'}</span><input id="aeDamage" value=""></label><label class="custom-field wide"><span>${siteLanguage==='en'?'Traits (comma-separated)':'Traits (séparés par des virgules)'}</span><input id="aeTraits" value=""></label></div>`:'';
}
function saveAdminEquipment(idx){
  const en=siteLanguage==='en';const d=activeAdminEditData();if(!d)return;
  const name=($('#aeName')?.value||'').trim();
  if(!name){toast(en?'Give the item a name':'Donne un nom à l’objet');return}
  const isWeapon=$('#aeType')?.value==='weapon';
  // V-ADMINEQUIPIDLOSS: this used to always build `e` from scratch with only
  // {name,category,rarity,price,rulesText,profile,traits} — on an EXISTING
  // item that meant customEquipmentId (and unrestricted/market/subcategory/
  // profile2/weaponSlotCost/customArmor/factions) was silently dropped on
  // every save, even for an item that already had a correct id — so editing
  // from here, including to FIX an id-less legacy item, re-broke it the
  // moment you saved. A brand-new item (idx===-1) never got an id at all
  // either. Starting from the existing record (if any) and healing a stable
  // id the same way mergeOfficialWarbandPackage does keeps every field this
  // form doesn't expose intact, and makes every item saved here resolvable
  // by officialCustomEquipmentList() going forward.
  const existing=(idx===-1||idx==null||idx<0)?null:d.equipment[idx];
  const e={
    ...(existing||{}),
    name,
    category:$('#aeCategory')?.value||'Équipements divers',
    rarity:($('#aeRarity')?.value||'').trim(),
    price:Number($('#aePrice')?.value||0),
    rulesText:($('#aeRulesText')?.value||''),
    profile:isWeapon?{range:($('#aeRange')?.value||''),strength:($('#aeStrength')?.value||''),ap:($('#aeAp')?.value||''),damage:($('#aeDamage')?.value||''),traits:($('#aeTraits')?.value||'')}:null,
    traits:isWeapon?($('#aeTraits')?.value||'').split(',').map(s=>s.trim()).filter(Boolean):[],
    ...readItemUseFields('aeUse'),
    bandValue:readBandValueField('aeBandValue'),
    type:isWeapon?'weapon':'equipment'
  };
  if(!isWeapon)e.profile2=null;
  if(!e.customEquipmentId)e.customEquipmentId='book-'+normName(name);
  // V-NOEQUIPUNRESTRICTED: same universal default as the mergeOfficialWarbandPackage
  // heal — every custom item is unrestricted:true in the normal creation
  // flow (saveCustomEquipment), never user-optional, so an item missing it
  // (an old broken officialize, or one created straight from this admin
  // form before this fix) should always get it rather than staying
  // invisible in the general equipment browser.
  if(e.unrestricted!==true)e.unrestricted=true;
  if(idx===-1||idx==null||idx<0)d.equipment.push(e);else d.equipment[idx]=e;
  adminEditingEquipmentIdx=null;
  render('admin');
}
function adminEquipmentRow(e,i){
  const weapon=!!e.profile;
  return `<article class="custom-item-row"><div class="custom-item-main"><div class="custom-item-icon">${weapon?'⚔':'◆'}</div><div><strong>${esc(e.name)}</strong><small>${esc(e.category||'')} · ${Number(e.price||0)} GC${e.rarity?' · '+esc(e.rarity):''}</small></div></div><div class="custom-item-actions"><button type="button" class="equipment-action" onclick="adminEditEquipment(${i})">✎</button><button type="button" class="equipment-action remove" onclick="confirmAdminDeleteEquipment(${i})">🗑</button></div></article>`;
}
function adminEquipmentFormMarkup(e,idx){
  const en=siteLanguage==='en';
  const weapon=!!e?.profile;
  const cats=EQUIPMENT_CATEGORY_NAMES_FR;
  const p=e?.profile||{};
  return `<div class="custom-form-head"><div><div class="eyebrow">${idx===-1?(en?'NEW ITEM':'NOUVEL ÉQUIPEMENT'):(en?'EDIT ITEM':'MODIFICATION')}</div><h3>${esc(e?.name||(en?'Build an item':'Construire un équipement'))}</h3></div></div>
  <div class="custom-form-grid">
    <label class="custom-field wide"><span>${en?'Name':'Nom'}</span><input id="aeName" value="${esc(e?.name||'')}"></label>
    <label class="custom-field"><span>${en?'Type':'Type'}</span><select id="aeType" onchange="toggleAdminWeaponFields()"><option value="equipment" ${!weapon?'selected':''}>${en?'Equipment':'Équipement'}</option><option value="weapon" ${weapon?'selected':''}>${en?'Weapon':'Arme'}</option></select></label>
    <label class="custom-field"><span>${en?'Category':'Sous-catégorie'}</span><select id="aeCategory">${cats.map(c=>`<option value="${esc(c)}" ${c===(e?.category||'Équipements divers')?'selected':''}>${c}</option>`).join('')}</select></label>
    <label class="custom-field"><span>${en?'Rarity':'Rareté'}</span><input id="aeRarity" value="${esc(e?.rarity||'')}"></label>
    <label class="custom-field"><span>${en?'Price (GC)':'Prix (GC)'}</span><input id="aePrice" type="number" min="0" step="1" value="${Number(e?.price??e?.value??0)}"></label>
    ${bandValueFieldMarkup(e,'aeBandValue')}
    <label class="custom-field wide"><span>${en?'Rules text':'Règles de l’équipement'}</span>${customTextToolbarMarkup('aeRulesText')}<textarea id="aeRulesText" class="wide-textarea" rows="3">${esc(e?.rulesText||'')}</textarea></label>
  </div>
  ${itemUseFieldsMarkup(e,'aeUse')}
  <div id="awWeaponFields">${weapon?`<div class="custom-weapon-grid"><label class="custom-field"><span>${en?'Range':'Portée'}</span><input id="aeRange" value="${esc(p.range||'')}"></label><label class="custom-field"><span>${en?'Strength':'Force'}</span><input id="aeStrength" value="${esc(p.strength||'')}"></label><label class="custom-field"><span>AP</span><input id="aeAp" value="${esc(p.ap||'')}"></label><label class="custom-field"><span>${en?'Damage':'Dégâts'}</span><input id="aeDamage" value="${esc(p.damage||'')}"></label><label class="custom-field wide"><span>${en?'Traits (comma-separated)':'Traits (séparés par des virgules)'}</span><input id="aeTraits" value="${esc((e?.traits||[]).join(', '))}"></label></div>`:''}</div>
  <div class="custom-actions"><button type="button" class="button secondary" onclick="adminCancelEquipment()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" onclick="saveAdminEquipment(${idx})">${en?'Apply':'Appliquer'}</button></div>`;
}
// V150: lets an admin retroactively turn an already-published official
// warband into a Supplement of another faction, or convert a Supplement back
// into an independent warband — the user's explicit request "Et me permetre
// de passe une warband deja existante en Supplément". Applies immediately via
// the dedicated PATCH endpoint (like Unpublish/Republish), independent of the
// Save button, which only ever touches name/definition.
function adminSupplementControlMarkup(d){
  const en=siteLanguage==='en';
  const selfFactionId=`official-${adminRulesEditId}`;
  const options=D.factions.filter(f=>!f.packId&&f.id!==selfFactionId&&!isContentPoolFaction(f)).map(f=>`<option value="${esc(f.id)}" ${d.supplementOf===f.id?'selected':''}>${esc(f.displayName)}</option>`).join('');
  const isSupplement=!!d.supplementOf;
  return `<section class="card admin-card" style="margin-bottom:14px">
    <div class="eyebrow">◈ ${en?'SUPPLEMENT':'SUPPLÉMENT'}</div>
    <p class="custom-field-help">${en?'A Supplement never shows its own tile in Create Warband — it appears as a selectable alternative under the base faction chosen here, replacing that faction’s rules when a player picks it.':'Un Supplément n’a jamais sa propre case dans Créer une bande — il apparaît comme alternative sélectionnable sous la faction de base choisie ici, et en remplace les règles si un joueur le sélectionne.'}</p>
    ${isSupplement?`<p><strong>${en?'Currently a Supplement of':'Actuellement un Supplément de'} ${esc(D.factions.find(f=>f.id===d.supplementOf)?.displayName||d.supplementOf)}</strong></p>`:''}
    <label class="custom-field wide"><span>${en?'Make it a Supplement of…':'En faire un Supplément de…'}</span><select id="adminSupplementBase"><option value="">${en?'— none (independent warband) —':'— aucune (bande indépendante) —'}</option>${options}</select></label>
    <div class="custom-actions"><button type="button" class="button secondary" onclick="applyAdminWarbandSupplement()">${en?'Apply':'Appliquer'}</button></div>
  </section>`;
}
async function applyAdminWarbandSupplement(){
  const en=siteLanguage==='en';
  if(!adminRulesEditId)return;
  const baseFactionId=$('#adminSupplementBase')?.value||null;
  try{
    await window.MordheimundaAPI.adminSetWarbandSupplement(adminRulesEditId,baseFactionId);
    adminOfficialCache=null;
    const supRes=await window.MordheimundaAPI.adminGetWarband(adminRulesEditId);
    const full=supRes?.warband||supRes;
    adminRulesEditData={...full,traits:arr2(full.traits),specialRules:arr2(full.specialRules),bandRuleNames:arr2(full.bandRuleNames).map(String),warriors:arr2(full.warriors),equipment:arr2(full.equipment),skillTrees:arr2(full.skillTrees),skills:arr2(full.skills),magicDomains:arr2(full.magicDomains),spells:arr2(full.spells)};
    await loadOfficialWarbands();
    toast(baseFactionId?(en?'Now a Supplement':'Devenue un Supplément'):(en?'Now an independent warband':'Redevenue indépendante'));
    render('admin');
  }catch(e){toast(authError(e,en));}
}
function adminWarbandRulesPanel(){
  const en=siteLanguage==='en',isCatalog=!!adminCatalogFactionId,d=activeAdminEditData();
  // V151 (Task #63): a base book/catalog faction now stores the exact same
  // bandRuleNames/traits/specialRules/skillTrees/skills/magicDomains/spells
  // shape an official warband already does (see openAdminCatalogEdit), so
  // the Rules and Skills/Magic tabs — previously hidden here in catalog mode
  // — apply unmodified; lazily default in case an older, not-yet-migrated
  // override row is missing one of the new fields.
  if(!Array.isArray(d.bandRuleNames))d.bandRuleNames=[];
  if(!Array.isArray(d.traits))d.traits=[];
  if(!Array.isArray(d.specialRules))d.specialRules=[];
  if(!Array.isArray(d.skillTrees))d.skillTrees=[];
  if(!Array.isArray(d.skills))d.skills=[];
  if(!Array.isArray(d.magicDomains))d.magicDomains=[];
  if(!Array.isArray(d.spells))d.spells=[];
  const bandSet=new Set(d.bandRuleNames.map(normName));
  const rowsFor=(kind,list)=>list.length?list.map((r,i)=>`<label class="custom-check"><input type="checkbox" ${bandSet.has(normName(r.name))?'checked':''} onchange="toggleAdminBandRule('${kind}',${i})"><span><b>${esc(r.name)}</b><small>${esc((r.text||'').slice(0,140))}</small></span></label>`).join(''):`<div class="empty compact">${en?'None yet.':'Aucune pour l’instant.'}</div>`;
  // Catalog mode's Equipment tab stays a name-membership picker into the
  // shared global weapon pool (D.weapons) — see the isCatalog branch below —
  // not the per-item object editor official warbands use; editing an item's
  // own stats/price is a separate tool (the weapon-pool card in Admin).
  const sections=[['rules',en?'RULES':'RÈGLES'],['warriors',en?'FIGHTERS':'COMBATTANTS'],['equipment',en?'EQUIPMENT':'ÉQUIPEMENT'],['skillsmagic',en?'SKILLS / SPELLS':'COMPÉTENCES / SORTS']];
  const tabs=`<div class="custom-warband-sections">${sections.map(([v,label])=>`<button type="button" class="${adminWarbandSection===v?'active':''}" onclick="setAdminWarbandSection('${v}')">${label}</button>`).join('')}</div>`;
  let body='';
  if(adminWarbandSection==='rules'){
    body=`<div class="admin-grid">
      <section class="card admin-card">
        <div class="eyebrow">✚ ${en?'SPECIAL RULES':'RÈGLES SPÉCIALES'}</div>
        <div class="custom-choice-list">${rowsFor('special',d.specialRules)}</div>
        <div class="custom-form-grid" style="margin-top:12px"><label class="custom-field"><span>${en?'New rule name':'Nom de la nouvelle règle'}</span><input id="adminNewSpecialName" placeholder="${en?'e.g. Undead don’t check Rout':'Ex. Les Morts-vivants ne testent pas la Déroute'}"></label><label class="custom-field"><span>${en?'Text':'Texte'}</span><input id="adminNewSpecialText" placeholder="${en?'Full rule text…':'Texte complet de la règle…'}"></label></div>
        <div class="custom-actions"><button type="button" class="button secondary" onclick="addAdminBandRule('special')">＋ ${en?'Add band-wide rule':'Ajouter une règle de bande'}</button></div>
      </section>
      <section class="card admin-card">
        <div class="eyebrow">◆ ${en?'TRAITS':'TRAITS'}</div>
        <div class="custom-choice-list">${rowsFor('traits',d.traits)}</div>
        <div class="custom-form-grid" style="margin-top:12px"><label class="custom-field"><span>${en?'New trait name':'Nom du nouveau trait'}</span><input id="adminNewTraitName" placeholder="${en?'Trait name…':'Nom du trait…'}"></label><label class="custom-field"><span>${en?'Text':'Texte'}</span><input id="adminNewTraitText" placeholder="${en?'Full trait text…':'Texte complet du trait…'}"></label></div>
        <div class="custom-actions"><button type="button" class="button secondary" onclick="addAdminBandRule('traits')">＋ ${en?'Add band-wide trait':'Ajouter un trait de bande'}</button></div>
      </section>
    </div>`;
  }else if(adminWarbandSection==='warriors'){
    if(adminEditingWarriorIdx!=null){
      body=`<section class="card admin-card">${adminWarriorFormMarkup(adminEditingWarriorIdx===-1?null:d.warriors[adminEditingWarriorIdx],adminEditingWarriorIdx)}</section>`;
    }else{
      body=`<section class="card admin-card"><p class="sheet-help">${en?'Use ▲/▼ to reorder — this is also the order fighters appear in the recruitment list.':'Utilise ▲/▼ pour réordonner — c’est aussi l’ordre d’apparition des combattants en recrutement.'}</p><div class="custom-item-list">${d.warriors.length?d.warriors.map((w,i)=>adminWarriorRow(w,i,d.warriors.length)).join(''):`<div class="empty">${en?'No fighters yet.':'Aucun combattant pour l’instant.'}</div>`}</div><div class="custom-actions" style="margin-top:12px"><button type="button" class="button secondary" onclick="adminNewWarrior()">＋ ${en?'Add fighter':'Ajouter un combattant'}</button>${(d.warriors||[]).some(w=>String(w?.description||'').trim())?`<button type="button" class="button secondary" onclick="adminClearWarriorDescriptions()">🧹 ${en?'Clear all fighter descriptions':'Effacer toutes les descriptions'}</button>`:''}</div></section>`;
    }
  }else if(adminWarbandSection==='equipment'){
    if(isCatalog){
      const list=(D.weapons||[]).slice().sort((a,b)=>a.name.localeCompare(b.name));
      // V-EQUIPCATSOURCE4: same canonicalization as the other equipment
      // choosers (see V-EQUIPCATSOURCE3 above) — this is the Band List
      // membership picker in a book faction's catalog editor.
      const groups={};list.forEach(w=>{const c=canonEquipmentCategory(equipmentCategory(w));(groups[c]||(groups[c]=[])).push(w)});
      const orderedCats=EQUIPMENT_SECTIONS.map(s=>s.cat).filter(c=>groups[c]);
      const set=new Set((d.equipment||[]).map(normName));
      body=`<section class="card admin-card">
        <p class="custom-field-help">${en?'Which items from the shared pool this faction can buy from the Band List. An item’s own stats/price are edited from the separate “Weapons & gear catalog” card in Admin.':'Quels objets du pool partagé cette faction peut acheter dans la Liste de Bande. Les caractéristiques/prix d’un objet se modifient depuis la carte « Catalogue d’armes & équipement » séparée, dans Admin.'}</p>
        <div class="custom-equipment-chooser">${orderedCats.map(cat=>{const items=groups[cat];return `<details class="custom-mini-collapse"><summary>${esc(cat)} <small>${items.length}</small></summary><div class="custom-equipment-checks">${items.map(w=>`<label><input type="checkbox" data-wname="${esc(w.name)}" ${set.has(normName(w.name))?'checked':''} onchange="toggleAdminCatalogEquipment(this)"><span>${esc(w.name)}<small>${Number(w.price||0)} GC</small></span></label>`).join('')}</div></details>`}).join('')}</div>
      </section>`;
    }else if(adminEditingEquipmentIdx!=null){
      body=`<section class="card admin-card">${adminEquipmentFormMarkup(adminEditingEquipmentIdx===-1?null:d.equipment[adminEditingEquipmentIdx],adminEditingEquipmentIdx)}</section>`;
    }else{
      body=`<section class="card admin-card"><div class="custom-item-list">${d.equipment.length?d.equipment.map((e,i)=>adminEquipmentRow(e,i)).join(''):`<div class="empty">${en?'No equipment yet.':'Aucun équipement pour l’instant.'}</div>`}</div><div class="custom-actions" style="margin-top:12px"><button type="button" class="button secondary" onclick="adminNewEquipment()">＋ ${en?'Add item':'Ajouter un équipement'}</button></div></section>`;
    }
  }else if(adminWarbandSection==='skillsmagic'){
    body=adminWarbandSkillsMagicMarkup(d,en);
  }
  const introText=isCatalog
    ?(en?'Edits the base M17 catalog directly — nothing touches data/catalog.js; the correction is stored separately and layered on top, so every account sees it immediately. "Revert to book" (in Admin) removes it and falls back to the original values.':'Modifie directement le catalogue de base M17 — rien ne touche à data/catalog.js ; la correction est stockée à part et appliquée par-dessus, visible immédiatement par tous les comptes. « Revenir au livre » (depuis Admin) la retire et restaure les valeurs d’origine.')
    :(en?'Edits the published warband directly — no draft or copy is ever created, and nothing shows up in your Custom tab. Saving pushes the whole definition back to the live warband at once.':'Modifie directement la bande publiée — aucun brouillon ni copie n’est jamais créé, et rien n’apparaît dans ton onglet Custom. Enregistrer renvoie la fiche complète vers la bande en ligne en une fois.');
  const supplementCard=isCatalog?'':adminSupplementControlMarkup(d);
  return `<div class="admin-page">
    <div class="page-intro"><div><div class="eyebrow">ADMIN / ${en?'GESTION':'GESTION'}${isCatalog?(en?' — BASE CATALOG':' — CATALOGUE DE BASE'):''}</div><label class="admin-wb-name-label" for="adminWbNameInput">✎ ${en?'Warband name':'Nom de la bande'}${isCatalog?` <small>(${en?'empty = book name':'vide = nom du livre'})</small>`:''}</label><h2><input type="text" class="admin-wb-name-input" id="adminWbNameInput" value="${esc(d.name)}" placeholder="${en?'Warband name':'Nom de la bande'}" oninput="activeAdminEditData().name=this.value" title="${en?'Rename this warband':'Renommer cette bande'}"></h2>${(()=>{const fid=isCatalog?adminCatalogFactionId:(adminRulesEditId?'official-'+adminRulesEditId:null);if(!fid)return '';const cur=Number(warbandSizeLimits[fid])||'';const fac=D.factions.find(x=>x.id===fid);const inh=!cur&&fac?warbandSizeLimitFor(fac):null;return `<label class="admin-wb-name-label" for="adminWbMaxSize">${en?'Maximum fighters':'Combattants max'} <small>(${en?'Hired Swords not counted, empty = no limit':'Hired Swords non compris, vide = pas de limite'}${inh?(en?` — currently ${inh} from the base warband`:` — actuellement ${inh} via la bande de base`):''})</small></label><input type="number" min="1" max="200" step="1" id="adminWbMaxSize" class="admin-wb-max-input" value="${cur}" placeholder="—" onchange="saveWarbandSizeLimit('${esc(fid)}',this.value)" style="max-width:120px"><div class="admin-hire-bans" style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px">${['hs','dp'].map(k=>{const own=!!(warbandHireRules[fid]||{})[k];const inhB=!own&&fac&&warbandHireBan(fac,k);return `<label class="toggle-line"><input type="checkbox" id="adminWbBan_${k}" ${own?'checked':''} onchange="saveWarbandHireRule('${esc(fid)}','${k}',this.checked)"><span>${k==='hs'?(en?'No Hired Swords':'Hired Swords interdits'):(en?'No Dramatis Personae':'Dramatis Personae interdits')}${inhB?` <small>(${en?'already, via the base warband':'déjà, via la bande de base'})</small>`:''}</span></label>`}).join('')}</div>`})()}<p>${introText}</p></div><button type="button" class="button secondary" onclick="${isCatalog?'closeAdminCatalogEdit()':'closeAdminWarbandRules()'}">← ${en?'Back to Admin':'Retour à Admin'}</button></div>
    ${supplementCard}
    ${tabs}
    ${body}
    <div class="custom-actions" style="margin-top:16px"><button type="button" class="button primary" onclick="${isCatalog?'saveAdminCatalogEdit()':'saveAdminWarbandRules()'}">${isCatalog?(en?'Save — override the book values':'Enregistrer — surcharger les valeurs du livre'):(en?'Save — update the live warband':'Enregistrer — mettre à jour la bande en ligne')}</button></div>
  </div>`;
}
function adminAddSkillTree(){
  const en=siteLanguage==='en';const d=activeAdminEditData();if(!d)return;
  const input=$('#adminNewSkillTreeName');const name=(input?.value||'').trim();
  if(!name){toast(en?'Give the tree a name':'Donne un nom à l’arbre');return}
  if(!Array.isArray(d.skillTrees))d.skillTrees=[];if(!Array.isArray(d.skills))d.skills=[];
  if(D.skillSets[name]||d.skillTrees.some(t=>normName(t.name)===normName(name))){toast(en?'A tree with this name already exists':'Un arbre porte déjà ce nom');return}
  d.skillTrees.push({name});input.value='';render('admin');
}
function adminDeleteSkillTree(i){
  const d=activeAdminEditData();if(!d)return;const t=d.skillTrees[i];if(!t)return;
  d.skillTrees.splice(i,1);d.skills=(d.skills||[]).filter(s=>normName(s.tree||'')!==normName(t.name));
  // V-ORPHANTREEACCESS: deleting a tree used to only ever touch d.skillTrees/
  // d.skills — never any warrior's own skillAccess object. Once the tree is
  // gone, its name no longer appears in the per-fighter "SKILL TREE ACCESS"
  // checklist (built from d.skillTrees, see adminWarriorFormMarkup), so there
  // is no checkbox left to uncheck it with — but the raw key stays in
  // w.skillAccess forever, and warbandExclusiveSkillTrees(f) (the Rules:
  // Warbands page) reads warriors' skillAccess keys directly, independent of
  // whether a tree definition still exists for them. The deleted tree kept
  // showing up there — "still active" with no fighter visibly granted it and
  // no way to remove it from the UI — even after the tree itself was gone.
  (d.warriors||[]).forEach(w=>{
    if(!w?.skillAccess)return;
    const key=Object.keys(w.skillAccess).find(k=>normName(k)===normName(t.name));
    if(key)delete w.skillAccess[key];
  });
  render('admin');
}
// V-ADMINRENAMESKILLTREE: mirrors openRenameSkillTree/confirmRenameSkillTree
// for the Custom page, but on the admin warband/catalog editor's own
// skillTrees array (adminRulesEditData/adminCatalogEditData, via
// activeAdminEditData()) — a warband's exclusive skill tree name is likewise
// only a plain string match against each skill's `tree` field, so a rename
// has to rewrite that on every skill filed under the old name too.
function adminRenameSkillTree(i){
  const d=activeAdminEditData();if(!d)return;const t=d.skillTrees[i];if(!t)return;
  const en=siteLanguage==='en';
  openModal(`<div class="purchase-dialog"><div class="eyebrow">${en?'RENAME':'RENOMMER'}</div><h2>${en?'Rename tree':'Renommer l’arbre'}</h2><label class="custom-field"><span>${en?'Tree name':'Nom de l’arbre'}</span><input id="adminRenameTreeInput" value="${esc(t.name)}"></label><div class="purchase-actions"><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" onclick="adminConfirmRenameSkillTree(${i})">${en?'Save':'Enregistrer'}</button></div></div>`);
}
function adminConfirmRenameSkillTree(i){
  const d=activeAdminEditData();if(!d)return;const t=d.skillTrees[i];if(!t)return;
  const en=siteLanguage==='en';
  const newName=($('#adminRenameTreeInput')?.value||'').trim();
  if(!newName){toast(en?'Give the tree a name':'Donne un nom à l’arbre');return}
  if(normName(newName)!==normName(t.name)&&(D.skillSets[newName]||d.skillTrees.some((x,xi)=>xi!==i&&normName(x.name)===normName(newName)))){toast(en?'A tree with this name already exists':'Un arbre porte déjà ce nom');return}
  const oldName=t.name;t.name=newName;
  (d.skills||[]).forEach(s=>{if(normName(s.tree||'')===normName(oldName))s.tree=newName;});
  adminRenameAccessKey(d,'skillAccess',oldName,newName);
  closeModal();render('admin');toast(en?'Tree renamed':'Arbre renommé');
}
// V-DOMAINRENAME: renames a warband's magic domain at its core — the domain,
// every spell filed under it and every fighter's magic access to it — so
// nothing is left pointing at the old name. Saved with the warband.
function adminRenameAccessKey(d,field,oldName,newName){(d.warriors||[]).forEach(w=>{const acc=w?.[field];if(!acc||typeof acc!=='object')return;const key=Object.keys(acc).find(k=>normName(k)===normName(oldName));if(key==null)return;const v=acc[key];delete acc[key];acc[newName]=v;})}
function adminRenameMagicDomain(i){
  const d=activeAdminEditData();if(!d)return;const dom=d.magicDomains?.[i];if(!dom)return;const en=siteLanguage==='en';
  openModal(`<div class="purchase-dialog"><div class="eyebrow">${en?'RENAME':'RENOMMER'}</div><h2>${en?'Rename domain':'Renommer le domaine'}</h2><p class="muted">${en?'Changes the domain itself: its spells and every fighter’s magic access follow. Save the warband afterwards.':'Change le domaine lui-même : ses sorts et l’accès magie de chaque combattant suivent. Enregistre la bande ensuite.'}</p><label class="custom-field"><span>${en?'Domain name':'Nom du domaine'}</span><input id="adminRenameDomainInput" value="${esc(dom.name)}"></label><div class="purchase-actions"><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" onclick="adminConfirmRenameMagicDomain(${i})">${en?'Save':'Enregistrer'}</button></div></div>`);
}
function adminConfirmRenameMagicDomain(i){
  const d=activeAdminEditData();if(!d)return;const dom=d.magicDomains?.[i];if(!dom)return;const en=siteLanguage==='en';
  const newName=($('#adminRenameDomainInput')?.value||'').trim();
  if(!newName){toast(en?'Give the domain a name':'Donne un nom au domaine');return}
  if(normName(newName)!==normName(dom.name)&&(MAGIC_DOMAINS[newName]||d.magicDomains.some((x,xi)=>xi!==i&&normName(x.name)===normName(newName)))){toast(en?'A domain with this name already exists':'Un domaine porte déjà ce nom');return}
  const oldName=dom.name;dom.name=newName;
  (d.spells||[]).forEach(s=>{if(normName(s.domain||'')===normName(oldName))s.domain=newName;});
  adminRenameAccessKey(d,'magicAccess',oldName,newName);
  closeModal();render('admin');toast(en?'Domain renamed — save the warband':'Domaine renommé — enregistre la bande');
}
function adminAddSkillToTree(treeName){
  const en=siteLanguage==='en';const d=activeAdminEditData();if(!d)return;
  const key='skill-'+refSlug(treeName);
  const name=($('#'+key+'-name')?.value||'').trim(),text=($('#'+key+'-text')?.value||'').trim();
  if(!name){toast(en?'Give the skill a name':'Donne un nom à la compétence');return}
  if(!Array.isArray(d.skills))d.skills=[];
  const count=d.skills.filter(s=>normName(s.tree||'')===normName(treeName)).length;
  if(count>=6){toast(en?'Maximum of 6 skills in this tree':'Maximum de 6 compétences dans cet arbre');return}
  if(d.skills.some(s=>normName(s.name)===normName(name))){toast(en?'A skill with this name already exists':'Une compétence porte déjà ce nom');return}
  d.skills.push({name,tree:treeName,text});render('admin');
}
function adminDeleteSkillFromTree(i){const d=activeAdminEditData();if(!d)return;d.skills.splice(i,1);render('admin')}
// V-ADMINEDITSKILLSPELL: this editor only ever offered Add/Delete for an
// individual skill or spell — there was no way to correct one in place, so
// "renaming" one meant adding a corrected copy and manually deleting the
// old one. That's exactly how a Dark Elf domain ended up with 8 spells
// instead of 6 (Soul Stealer/Word of Pain left behind after Soul Siphon/
// Tongue of Dolor were added to replace them — the delete step was easy to
// forget with no in-place edit to make the intent obvious). This adds a
// real edit-in-place for both, mirroring adminRenameSkillTree's modal.
function adminEditSkillInTree(i){
  const d=activeAdminEditData();if(!d)return;const s=d.skills[i];if(!s)return;
  const en=siteLanguage==='en';
  openModal(`<div class="purchase-dialog"><div class="eyebrow">${en?'EDIT':'MODIFIER'}</div><h2>${en?'Edit skill':'Modifier la compétence'}</h2><label class="custom-field"><span>${en?'Name':'Nom'}</span><input id="adminEditSkillName" value="${esc(s.name)}"></label><label class="custom-field"><span>${en?'Text':'Texte'}</span><textarea id="adminEditSkillText" class="wide-textarea" rows="5">${esc(s.text||'')}</textarea></label><div class="purchase-actions"><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" onclick="adminConfirmEditSkillInTree(${i})">${en?'Save':'Enregistrer'}</button></div></div>`);
}
function adminConfirmEditSkillInTree(i){
  const d=activeAdminEditData();if(!d)return;const s=d.skills[i];if(!s)return;
  const en=siteLanguage==='en';
  const name=($('#adminEditSkillName')?.value||'').trim(),text=($('#adminEditSkillText')?.value||'').trim();
  if(!name){toast(en?'Give the skill a name':'Donne un nom à la compétence');return}
  if(d.skills.some((x,xi)=>xi!==i&&normName(x.name)===normName(name))){toast(en?'A skill with this name already exists':'Une compétence porte déjà ce nom');return}
  s.name=name;s.text=text;closeModal();render('admin');toast(en?'Skill updated':'Compétence mise à jour');
}
function adminAddMagicDomain(){
  const en=siteLanguage==='en';const d=activeAdminEditData();if(!d)return;
  const input=$('#adminNewMagicDomainName');const name=(input?.value||'').trim();
  if(!name){toast(en?'Give the domain a name':'Donne un nom au domaine');return}
  if(!Array.isArray(d.magicDomains))d.magicDomains=[];if(!Array.isArray(d.spells))d.spells=[];
  if(MAGIC_DOMAINS[name]||d.magicDomains.some(t=>normName(t.name)===normName(name))){toast(en?'A domain with this name already exists':'Un domaine porte déjà ce nom');return}
  d.magicDomains.push({name});input.value='';render('admin');
}
function adminDeleteMagicDomain(i){
  const d=activeAdminEditData();if(!d)return;const dom=d.magicDomains[i];if(!dom)return;
  d.magicDomains.splice(i,1);d.spells=(d.spells||[]).filter(s=>normName(s.domain||'')!==normName(dom.name));
  // V-ORPHANTREEACCESS: same fix as adminDeleteSkillTree, for magic domains —
  // see that function's comment.
  (d.warriors||[]).forEach(w=>{
    if(!w?.magicAccess)return;
    const key=Object.keys(w.magicAccess).find(k=>normName(k)===normName(dom.name));
    if(key)delete w.magicAccess[key];
  });
  render('admin');
}
function adminAddSpellToDomain(domainName){
  const en=siteLanguage==='en';const d=activeAdminEditData();if(!d)return;
  const key='spell-'+refSlug(domainName);
  const name=($('#'+key+'-name')?.value||'').trim(),text=($('#'+key+'-text')?.value||'').trim();
  if(!name){toast(en?'Give the spell a name':'Donne un nom au sort');return}
  if(!Array.isArray(d.spells))d.spells=[];
  // V-DOMAINSPELLCAP: this used to hard-cap a domain at 6 spells, mirroring
  // the book's usual 6-spell lore layout — but that's a convention, not a
  // rule this editor needs to enforce, and it silently blocked adding any
  // spell past the 6th (a toast easy to miss admist everything else on this
  // screen) rather than refusing outright, which is what actually happened
  // to 2 of this warband's Dark Elf domain spells. Custom/admin content can
  // legitimately need more (a homebrew or supplement lore with 7-8 spells),
  // so this no longer refuses — it only still blocks an exact duplicate name.
  //
  // V-DOMAINSPELLDUP: the duplicate check itself used to compare against
  // EVERY spell being edited here, across every domain in this admin
  // session, not just this one — so a name already used by some other
  // domain's spell (which the real book does: several lores reuse common
  // spell names) got silently rejected as if it were a duplicate of THIS
  // domain, which is exactly how 2 of this warband's Dark Elf spells never
  // got saved. Scoping the check to this domain only is the actual fix.
  if(d.spells.some(s=>normName(s.domain||'')===normName(domainName)&&normName(s.name)===normName(name))){toast(en?'A spell with this name already exists in this domain':'Un sort porte déjà ce nom dans ce domaine');return}
  d.spells.push({name,domain:domainName,text});render('admin');
}
function adminDeleteSpellFromDomain(i){const d=activeAdminEditData();if(!d)return;d.spells.splice(i,1);render('admin')}
function adminEditSpellInDomain(i){
  const d=activeAdminEditData();if(!d)return;const s=d.spells[i];if(!s)return;
  const en=siteLanguage==='en';
  openModal(`<div class="purchase-dialog"><div class="eyebrow">${en?'EDIT':'MODIFIER'}</div><h2>${en?'Edit spell':'Modifier le sort'}</h2><label class="custom-field"><span>${en?'Name':'Nom'}</span><input id="adminEditSpellName" value="${esc(s.name)}"></label><label class="custom-field"><span>${en?'Text':'Texte'}</span><textarea id="adminEditSpellText" class="wide-textarea" rows="5">${esc(s.text||'')}</textarea></label><div class="purchase-actions"><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" onclick="adminConfirmEditSpellInDomain(${i})">${en?'Save':'Enregistrer'}</button></div></div>`);
}
function adminConfirmEditSpellInDomain(i){
  const d=activeAdminEditData();if(!d)return;const s=d.spells[i];if(!s)return;
  const en=siteLanguage==='en';
  const name=($('#adminEditSpellName')?.value||'').trim(),text=($('#adminEditSpellText')?.value||'').trim();
  if(!name){toast(en?'Give the spell a name':'Donne un nom au sort');return}
  if(d.spells.some((x,xi)=>xi!==i&&normName(x.domain||'')===normName(s.domain||'')&&normName(x.name)===normName(name))){toast(en?'A spell with this name already exists in this domain':'Un sort porte déjà ce nom dans ce domaine');return}
  s.name=name;s.text=text;closeModal();render('admin');toast(en?'Spell updated':'Sort mis à jour');
}
function adminWarbandSkillsMagicMarkup(d,en){
  if(!Array.isArray(d.skillTrees))d.skillTrees=[];if(!Array.isArray(d.skills))d.skills=[];
  if(!Array.isArray(d.magicDomains))d.magicDomains=[];if(!Array.isArray(d.spells))d.spells=[];
  const treeCards=d.skillTrees.map((t,ti)=>{
    const items=d.skills.map((s,i)=>({s,i})).filter(x=>normName(x.s.tree||'')===normName(t.name));
    const key='skill-'+refSlug(t.name);
    return `<section class="custom-tree-card open"><header class="custom-tree-card-head"><div><div class="eyebrow">${en?'SKILL TREE':'ARBRE DE COMPÉTENCES'}</div><h3>${esc(t.name)}</h3></div><div class="custom-tree-card-meta"><span>${items.length}/6</span><button type="button" class="equipment-action" title="${en?'Rename':'Renommer'}" onclick="adminRenameSkillTree(${ti})">✎</button><button type="button" class="equipment-action remove" title="${en?'Delete':'Supprimer'}" onclick="adminDeleteSkillTree(${ti})">🗑</button></div></header>
      <div class="custom-builder-items">${items.map(({s,i})=>`<div class="custom-builder-item"><div class="custom-builder-item-main"><div><strong>${esc(s.name)}</strong><p>${customTextMarkup(s.text||'')}</p></div></div><div class="custom-builder-item-actions"><button type="button" class="equipment-action" title="${en?'Edit':'Modifier'}" onclick="adminEditSkillInTree(${i})">✎</button><button type="button" class="equipment-action remove" title="${en?'Delete':'Supprimer'}" onclick="adminDeleteSkillFromTree(${i})">🗑</button></div></div>`).join('')||`<div class="custom-builder-empty">${en?'No skill in this tree yet.':'Aucune compétence dans cet arbre pour l’instant.'}</div>`}</div>
      ${items.length>=6?`<div class="custom-builder-limit">${en?'Maximum reached: 6 skills.':'Maximum atteint : 6 compétences.'}</div>`:`<div class="custom-inline-grid"><label class="custom-field"><span>${en?'Name':'Nom'}</span><input id="${key}-name" placeholder="${en?'Skill name…':'Nom de la compétence…'}"></label><label class="custom-field wide"><span>${en?'Text':'Texte'}</span><textarea id="${key}-text" class="wide-textarea" rows="4" placeholder="${en?'Full rule text…':'Texte complet de la règle…'}"></textarea></label></div><div class="custom-actions"><button type="button" class="button secondary" onclick="adminAddSkillToTree('${esc(t.name)}')">＋ ${en?'Add skill':'Ajouter une compétence'}</button></div>`}
    </section>`;
  }).join('');
  const domainCards=d.magicDomains.map((dom,di)=>{
    const items=d.spells.map((s,i)=>({s,i})).filter(x=>normName(x.s.domain||'')===normName(dom.name));
    const key='spell-'+refSlug(dom.name);
    return `<section class="custom-tree-card open"><header class="custom-tree-card-head"><div><div class="eyebrow">${en?'MAGIC DOMAIN':'DOMAINE DE MAGIE'}</div><h3>${esc(dom.name)}</h3></div><div class="custom-tree-card-meta"><span>${items.length}/6</span><button type="button" class="equipment-action" title="${en?'Rename':'Renommer'}" onclick="adminRenameMagicDomain(${di})">✎</button><button type="button" class="equipment-action remove" title="${en?'Delete':'Supprimer'}" onclick="adminDeleteMagicDomain(${di})">🗑</button></div></header>
      <div class="custom-builder-items">${items.map(({s,i})=>`<div class="custom-builder-item"><div class="custom-builder-item-main"><div><strong>${esc(s.name)}</strong><p>${customTextMarkup(s.text||'')}</p></div></div><div class="custom-builder-item-actions"><button type="button" class="equipment-action" title="${en?'Edit':'Modifier'}" onclick="adminEditSpellInDomain(${i})">✎</button><button type="button" class="equipment-action remove" title="${en?'Delete':'Supprimer'}" onclick="adminDeleteSpellFromDomain(${i})">🗑</button></div></div>`).join('')||`<div class="custom-builder-empty">${en?'No spell in this domain yet.':'Aucun sort dans ce domaine pour l’instant.'}</div>`}</div>
      ${items.length>=6?`<div class="custom-builder-limit">${en?'Maximum reached: 6 spells.':'Maximum atteint : 6 sorts.'}</div>`:`<div class="custom-inline-grid"><label class="custom-field"><span>${en?'Name':'Nom'}</span><input id="${key}-name" placeholder="${en?'Spell name…':'Nom du sort…'}"></label><label class="custom-field wide"><span>${en?'Text':'Texte'}</span><textarea id="${key}-text" class="wide-textarea" rows="4" placeholder="${en?'Full rule text…':'Texte complet de la règle…'}"></textarea></label></div><div class="custom-actions"><button type="button" class="button secondary" onclick="adminAddSpellToDomain('${esc(dom.name)}')">＋ ${en?'Add spell':'Ajouter un sort'}</button></div>`}
    </section>`;
  }).join('');
  return `<div class="admin-grid">
    <section class="card admin-card"><div class="eyebrow">★ ${en?'EXCLUSIVE SKILL TREES':'ARBRES DE COMPÉTENCES EXCLUSIFS'}</div><p class="custom-field-help">${en?'Skill trees brought in only by this warband — only fighters it grants access to can use them.':'Arbres de compétences propres à cette bande — seuls les combattants auxquels elle en donne accès peuvent les utiliser.'}</p>${treeCards||`<div class="empty">${en?'None yet.':'Aucun pour l’instant.'}</div>`}<div class="custom-tree-create" style="margin-top:12px"><input id="adminNewSkillTreeName" placeholder="${en?'New tree name…':'Nom du nouvel arbre…'}"><button type="button" class="button secondary" onclick="adminAddSkillTree()">＋ ${en?'Create tree':'Créer l’arbre'}</button></div></section>
    <section class="card admin-card"><div class="eyebrow">✦ ${en?'EXCLUSIVE MAGIC DOMAINS':'DOMAINES DE MAGIE EXCLUSIFS'}</div><p class="custom-field-help">${en?'Magic domains brought in only by this warband.':'Domaines de magie propres à cette bande.'}</p>${domainCards||`<div class="empty">${en?'None yet.':'Aucun pour l’instant.'}</div>`}<div class="custom-tree-create" style="margin-top:12px"><input id="adminNewMagicDomainName" placeholder="${en?'New domain name…':'Nom du nouveau domaine…'}"><button type="button" class="button secondary" onclick="adminAddMagicDomain()">＋ ${en?'Create domain':'Créer le domaine'}</button></div></section>
  </div>`;
}
function openHomeEventEditor(){
  const en=siteLanguage==='en';const ev=homeData?.event||{};
  const draw=()=>openModal(`<div class="wc-dialog"><div class="eyebrow">ADMIN · ${en?'HOME':'ACCUEIL'}</div><h2>${en?'Active event':'Événement en cours'}</h2><p class="sheet-help">${en?'Shown to every player on the Home page. Leave the title and text empty to remove it.':'Affiché à tous les joueurs sur l’accueil. Laisse le titre et le texte vides pour le retirer.'}</p><label class="custom-field"><span>${en?'Small heading':'Petit titre'}</span><input id="hevLabel" value="${esc(ev.label||'')}" placeholder="${en?'ACTIVE EVENT':'ÉVÉNEMENT EN COURS'}"></label><label class="custom-field"><span>${en?'Title':'Titre'}</span><input id="hevTitle" value="${esc(ev.title||'')}"></label><label class="custom-field"><span>${en?'Text':'Texte'}</span><textarea id="hevText" rows="5">${esc(ev.text||'')}</textarea></label><label class="custom-field"><span>${en?'Linked campaign':'Campagne liée'}</span><select id="hevCampaign"><option value="">—</option>${(homeCampaignOptions||[]).map(c=>`<option value="${esc(c.id)}" ${c.id===ev.campaignId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><label class="custom-field"><span>${en?'Or a link':'Ou un lien'}</span><input id="hevLink" value="${esc(ev.link||'')}" placeholder="/rules/scenarios/…"></label><div class="custom-actions"><button type="button" class="button primary" onclick="saveHomeEvent()">${en?'Save':'Enregistrer'}</button><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
  draw();
  if(homeCampaignOptions===null)window.MordheimundaAPI.adminCampaigns().then(d=>{homeCampaignOptions=(d?.campaigns||[]).map(c=>({id:c.id,name:c.name}));if(document.getElementById('hevCampaign')){const keep={label:$('#hevLabel').value,title:$('#hevTitle').value,text:$('#hevText').value,link:$('#hevLink').value};Object.assign(ev,keep);draw()}}).catch(()=>{homeCampaignOptions=[]});
}
function openHomeNewsEditor(){
  const en=siteLanguage==='en';
  openModal(`<div class="wc-dialog"><div class="eyebrow">ADMIN · ${en?'HOME':'ACCUEIL'}</div><h2>${en?'Add a news line':'Ajouter une nouveauté'}</h2><p class="sheet-help">${en?'Published warbands, Hired Swords, campaigns and scenarios are added automatically. Use this for anything else.':'Les warbands, Hired Swords, campagnes et scénarios publiés sont ajoutés automatiquement. Utilise ceci pour le reste.'}</p><label class="custom-field"><span>${en?'Text':'Texte'}</span><input id="hnTitle" maxlength="160"></label><label class="custom-field"><span>${en?'Type':'Type'}</span><select id="hnKind">${Object.entries(HOME_NEWS_LABELS).map(([k,l])=>`<option value="${k}" ${k==='update'?'selected':''}>${esc(en?l[0]:l[1])}</option>`).join('')}</select></label><label class="custom-field"><span>${en?'Link (optional)':'Lien (optionnel)'}</span><input id="hnLink" placeholder="/rules/warbands/…"></label><div class="custom-actions"><button type="button" class="button primary" onclick="saveHomeNews()">${en?'Add':'Ajouter'}</button><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
function openQuestScopeEditor(ti,qi){const t=adminQuestDraft?.trees?.[ti];const tgt=qi<0?t:t?.quests?.[qi];if(!tgt)return;questScopeEdit={ti,qi,draft:JSON.parse(JSON.stringify(tgt.scope||{factions:[],fighters:[]})),ignoreSkills:!!t.ignoreSkills,pick:questScopeEdit?.pick||''};renderQuestScopeEditor()}
function mapBuilderSetMPCount(n){
  const edges=MAP_BUILDER_MP_EDGE_DEFAULTS[n]||MAP_BUILDER_MP_EDGE_DEFAULTS[2];
  const prev=mapBuilderMPPlayers;
  mapBuilderMPPlayers=edges.map((edge,i)=>prev[i]?{...prev[i],edge:prev[i].edge||edge}:{edge,color:MAP_BUILDER_MP_COLOR_DEFAULTS[i]||'accent',c1:1,c2:0});
  render('admin');
}
function mapBuilderMPUpdate(i,field,value){
  if(!mapBuilderMPPlayers[i])return;
  mapBuilderMPPlayers[i][field]=value;
  render('admin');
}
// Centers for N circles spaced along one edge of the table, inset from the
// wall (so they sit just inside it, not overlapping) and from the corners
// (so two players on adjacent edges don't collide). Consecutive centers are
// at most 12" apart center-to-center — 3"+3" of radius plus the requested
// 6" max gap between the circles' own edges — packed tighter only when the
// edge is too short to fit that spacing.
function mapBuilderMPCirclePositions(side,n,w,h){
  if(n<=0)return[];
  const inset=4*DEPLOY_SCALE,cornerMargin=5*DEPLOY_SCALE,spacingMax=12*DEPLOY_SCALE;
  const vertical=side==='top'||side==='bottom';
  const span=(vertical?w:h)-2*cornerMargin;
  const mid=(vertical?w:h)/2;
  const step=n>1?Math.min(spacingMax,span/(n-1)):0;
  const start=mid-step*(n-1)/2;
  const fixed=side==='top'?inset:side==='bottom'?h-inset:side==='left'?inset:w-inset;
  const out=[];
  for(let i=0;i<n;i++){
    const along=start+step*i;
    out.push(vertical?{cx:along,cy:fixed}:{cx:fixed,cy:along});
  }
  return out;
}
function mapBuilderGenerateMultiplayer(){
  if(!adminMapBuilderData)return;
  const {w,h}=deploymentMapPx(adminMapBuilderData.shapes);
  const items=adminMapBuilderData.shapes.items;
  const m=1*DEPLOY_SCALE;
  const edgeLinePresets={
    top:{x1:m,y1:m,x2:w-m,y2:m},bottom:{x1:m,y1:h-m,x2:w-m,y2:h-m},
    left:{x1:m,y1:m,x2:m,y2:h-m},right:{x1:w-m,y1:m,x2:w-m,y2:h-m}
  };
  mapBuilderMPPlayers.forEach(p=>{
    const ep=edgeLinePresets[p.edge];if(!ep)return;
    items.push({type:'line',...ep,color:p.color,dash:false});
    const positions=mapBuilderMPCirclePositions(p.edge,(p.c1||0)+(p.c2||0),w,h);
    let pi=0;
    for(let k=0;k<(p.c1||0);k++,pi++)items.push({type:'circle',cx:positions[pi].cx,cy:positions[pi].cy,r:MAP_BUILDER_ARRIVAL_RADIUS_IN*DEPLOY_SCALE,color:p.color,label:'',marker:'turn1'});
    for(let k=0;k<(p.c2||0);k++,pi++)items.push({type:'circle',cx:positions[pi].cx,cy:positions[pi].cy,r:MAP_BUILDER_ARRIVAL_RADIUS_IN*DEPLOY_SCALE,color:p.color,label:'',marker:'turn2'});
  });
  mapBuilderSelectedIndex=-1;mapBuilderTool='select';
  render('admin');
}
function blankMapBuilderDraft(){return {name:'',shapes:blankMapShapes()}}
function openMapBuilder(id){
  if(!id){adminMapBuilderId=null;adminMapBuilderData=blankMapBuilderDraft();mapBuilderSelectedIndex=-1;mapBuilderTool='select';render('admin');return}
  const m=(DEPLOYMENT_MAPS_CACHE||[]).find(x=>x.id===id);
  if(!m)return;
  adminMapBuilderId=id;
  const loadedShapes=deploymentMapHasShapes(m)?JSON.parse(JSON.stringify(m.shapes)):blankMapShapes();
  // V-ARRIVALRADIUSFIX: arrival markers (①/②) are meant to always be a
  // fixed 3" radius — self-heal any that drifted away from it (e.g. from
  // an accidental drag on the (now removed) resize handle, before that
  // handle was blocked for marker circles) the moment the map is opened.
  (loadedShapes.items||[]).forEach(it=>{if(it.type==='circle'&&it.marker)it.r=MAP_BUILDER_ARRIVAL_RADIUS_IN*DEPLOY_SCALE;});
  adminMapBuilderData={name:m.name||'',shapes:mapShapesToLandscape(loadedShapes)};
  mapBuilderSelectedIndex=-1;mapBuilderTool='select';
  render('admin');
}
function closeMapBuilder(){adminMapBuilderId=null;adminMapBuilderData=null;mapBuilderSelectedIndex=-1;mapBuilderDrag=null;render('admin')}
function mapBuilderSetTool(t){mapBuilderTool=t;mapBuilderSelectedIndex=-1;render('admin')}
function mapBuilderSetColor(c){mapBuilderColor=c;render('admin')}
function mapBuilderSetTableSize(w,h){
  adminMapBuilderData.shapes=deploymentMapResizeShapes(adminMapBuilderData.shapes,w,h);
  render('admin');
}
// Snap to table center/quarter lines and to the table edges — within a ~0.8"
// catch radius — so zones land exactly where they visually should instead
// of a couple of pixels off. Always called before clamping to the table
// bounds, which is what lets a drag that overshoots past the frame still
// land exactly ON the edge (addresses "sortir de la zone avec ma souris
// pour bien coller mes zones au bord du cadre").
function mapBuilderSnap(v,max){
  const catchPx=DEPLOY_SCALE*0.8;
  const targets=[0,max*0.25,max*0.5,max*0.75,max];
  for(const t of targets)if(Math.abs(v-t)<=catchPx)return t;
  return v;
}
function mapBuilderClamp(v,max){return Math.max(-MAP_BUILDER_MARGIN_PX,Math.min(max+MAP_BUILDER_MARGIN_PX,v))}
// A circle counts as "anchored" when it lands exactly on one of the
// table-border snap points — a corner, an edge mid-point, or an edge
// quarter-point (the same 0/25/50/75/100% targets mapBuilderSnap already
// catches while dragging). An anchored circle is re-expressed as that SAME
// fraction of the new table size on a table-format change, instead of the
// fixed-inch wall-distance rule used for a freely-placed circle — so a
// marker dropped in a corner, or at the middle/quarter of a border, stays
// exactly there (proportionally upscaled) whatever table size is picked,
// which is the whole point of pinning it to the border in the first place.
// V-AXISANCHOR: an anchor is now PER AXIS, not just a border point — "les
// ancres pourraient aussi être sur un axe (comme l'axe du milieu)". Either
// fx or fy (or both) can be a locked fraction of the table; a null axis
// just keeps the old fixed-inch wall-distance behavior for that axis alone.
// A circle dropped exactly on the vertical center LINE (fx=0.5) but at some
// unremarkable height stays glued to that center line — upscaled — on any
// table-size change, even though its Y never matched a snap point.
function mapBuilderCircleAnchor(cx,cy,w,h){
  const fracs=[0,0.25,0.5,0.75,1],tol=DEPLOY_SCALE*0.2;
  let fx=null,fy=null;
  for(const f of fracs)if(Math.abs(cx-f*w)<=tol){fx=f;break}
  for(const f of fracs)if(Math.abs(cy-f*h)<=tol){fy=f;break}
  if(fx==null&&fy==null)return null;
  return {fx,fy};
}
// V-ANCHORBUTTON: "je voudrai pouvoir ancrer des points avec un bouton" —
// anchoring used to only happen by dragging a circle pixel-exact onto a
// corner/mid-point/quarter-point (mapBuilderCircleAnchor, called from the
// move-drag handler). This snaps the SELECTED circle to whichever of those
// border points it's currently closest to, in one click, without needing a
// precise drag — "ancrer de manière proportionnelle" still holds: it sets
// the same {fx,fy} fraction mapBuilderCircleAnchor would, so the circle
// stays locked to that same proportional spot (e.g. dead-center on the
// mid-point axis) through any later table-size change, exactly like a
// drag-anchored one already does.
function mapBuilderAnchorSelected(){
  if(!adminMapBuilderData||mapBuilderSelectedIndex<0)return;
  const it=adminMapBuilderData.shapes.items[mapBuilderSelectedIndex];
  if(!it||it.type!=='circle')return;
  const {w,h}=deploymentMapPx(adminMapBuilderData.shapes);
  const fracs=[0,0.25,0.5,0.75,1];
  let best=null,bestDist=Infinity;
  fracs.forEach(fx=>{
    fracs.forEach(fy=>{
      if(fx!==0&&fx!==1&&fy!==0&&fy!==1)return; // must sit on the table border itself
      const tx=fx*w,ty=fy*h,d=Math.hypot(it.cx-tx,it.cy-ty);
      if(d<bestDist){bestDist=d;best={fx,fy,tx,ty}}
    });
  });
  if(!best)return;
  it.cx=best.tx;it.cy=best.ty;it.anchor={fx:best.fx,fy:best.fy};
  render('admin');
}
// V-AXISANCHOR: per-axis anchor control — "les ancres pourraient aussi être
// sur un axe (comme l'axe du milieu)". Lets the admin lock just the X axis
// (e.g. to 50% = the vertical center line) or just the Y axis, independent
// of the other one, instead of only ever snapping both at once to a corner.
// frac=null frees that axis back to the fixed-inch wall-distance rule.
function mapBuilderSetAxisAnchor(axis,frac){
  if(!adminMapBuilderData||mapBuilderSelectedIndex<0)return;
  const it=adminMapBuilderData.shapes.items[mapBuilderSelectedIndex];
  if(!it||it.type!=='circle')return;
  const {w,h}=deploymentMapPx(adminMapBuilderData.shapes);
  const cur=it.anchor||{fx:null,fy:null};
  const next={fx:cur.fx,fy:cur.fy};
  if(axis==='x'){next.fx=frac;if(frac!=null)it.cx=Math.round(frac*w);}
  else{next.fy=frac;if(frac!=null)it.cy=Math.round(frac*h);}
  it.anchor=(next.fx==null&&next.fy==null)?null:next;
  render('admin');
}
// Per-axis quick-pick row for the anchor panel: Free + the 5 snap fracs,
// highlighting whichever one (if any) this axis is currently locked to.
function mapBuilderAxisAnchorButtons(sel,axis,en){
  const cur=sel.anchor?(axis==='x'?sel.anchor.fx:sel.anchor.fy):null;
  const opts=[{f:null,label:en?'Free':'Libre'},{f:0,label:'0%'},{f:0.25,label:'25%'},{f:0.5,label:en?'50% (center)':'50% (centre)'},{f:0.75,label:'75%'},{f:1,label:'100%'}];
  return opts.map(o=>`<button type="button" class="button secondary ${cur===o.f?'active':''}" style="padding:4px 9px;font-size:10.5px;${cur===o.f?'border-color:var(--accent);color:var(--accent)':''}" onclick="mapBuilderSetAxisAnchor('${axis}',${o.f===null?'null':o.f})">${o.label}</button>`).join('');
}
function mapBuilderAnchorLabel(a,en){
  if(!a||(a.fx==null&&a.fy==null))return '';
  const pct=f=>`${Math.round(f*100)}%`;
  if(a.fx!=null&&a.fy==null)return a.fx===0.5?(en?'Vertical center axis':'Axe central vertical'):(en?`X locked at ${pct(a.fx)}`:`X verrouillé à ${pct(a.fx)}`);
  if(a.fy!=null&&a.fx==null)return a.fy===0.5?(en?'Horizontal center axis':'Axe central horizontal'):(en?`Y locked at ${pct(a.fy)}`:`Y verrouillé à ${pct(a.fy)}`);
  const onX=a.fx===0||a.fx===1,onY=a.fy===0||a.fy===1;
  if(onX&&onY)return en?'Corner':'Coin';
  if(onX||onY){
    const f=onX?a.fy:a.fx;
    if(f===0.5)return en?'Edge mid-point':'Milieu de bord';
    return en?'Edge quarter-point':'Quart de bord';
  }
  if(a.fx===0.5&&a.fy===0.5)return en?'Table center':'Centre de la table';
  return en?`Point (${pct(a.fx)}, ${pct(a.fy)})`:`Point (${pct(a.fx)}, ${pct(a.fy)})`;
}
function mapBuilderLocalXY(evt){
  const svg=document.getElementById('mapBuilderCanvas');if(!svg||!adminMapBuilderData)return [0,0];
  const rect=svg.getBoundingClientRect();if(!rect.width||!rect.height)return [0,0];
  const sh=adminMapBuilderData.shapes;
  const {w,h}=deploymentMapPx(sh);
  const m=MAP_BUILDER_MARGIN_PX;
  if(deploymentMapRotated(sh)){
    // Canvas is displayed rotated 90° (viewBox is h×w, offset by -m -m to
    // show the margin strip — see deploymentMapCardSVG) — map the screen
    // point into that viewBox, then invert the rotation back to real
    // table-inch coordinates (see deploymentMapCardSVG for the forward map).
    const sx=(evt.clientX-rect.left)/rect.width*(h+2*m)-m;
    const sy=(evt.clientY-rect.top)/rect.height*(w+2*m)-m;
    return [sy,h-sx];
  }
  const x=(evt.clientX-rect.left)/rect.width*(w+2*m)-m;
  const y=(evt.clientY-rect.top)/rect.height*(h+2*m)-m;
  return [x,y];
}
function mapBuilderUpdateCoordReadout(x,y){
  const el=document.getElementById('mbCoord');if(!el||!adminMapBuilderData)return;
  el.textContent=`X: ${deployInches(x)}"  Y: ${deployInches(y)}"`;
}
function mapBuilderItemDown(evt,i){
  if(mapBuilderTool!=='select')return; // let it bubble to the canvas so a new shape can be drawn on top
  evt.stopPropagation();
  mapBuilderSelectedIndex=i;
  const it=adminMapBuilderData.shapes.items[i];
  const [x,y]=mapBuilderLocalXY(evt);
  if(it.type==='tri'){render('admin');return} // anchored to its corner — resize only, no move
  if(it.type==='line'){mapBuilderDrag={mode:'move-line',index:i,ox:x-it.x1,oy:y-it.y1,dx:it.x2-it.x1,dy:it.y2-it.y1};}
  else if(it.cx!=null){mapBuilderDrag={mode:'move-point',index:i,ox:x-it.cx,oy:y-it.cy};}
  else if(it.x!=null){mapBuilderDrag={mode:'move-rect',index:i,ox:x-it.x,oy:y-it.y};}
  render('admin');
}
function mapBuilderHandleDown(evt,handle){
  mapBuilderDrag={mode:'resize',handle,index:mapBuilderSelectedIndex};
}
function mapBuilderCanvasDown(evt){
  if(!adminMapBuilderData)return;
  const [x,y]=mapBuilderLocalXY(evt);
  const items=adminMapBuilderData.shapes.items;
  const tool=mapBuilderTool;
  if(tool==='select')return;
  if(tool==='circle'){items.push({type:'circle',cx:x,cy:y,r:1,color:mapBuilderColor,label:''});mapBuilderDrag={mode:'resize',handle:'r',index:items.length-1};}
  else if(tool==='rect'){items.push({type:'rect',x,y,w:1,h:1,color:mapBuilderColor,label:''});mapBuilderDrag={mode:'resize',handle:'se',index:items.length-1};}
  else if(tool.startsWith('tri-')){items.push({type:'tri',corner:tool.slice(4),size:1,color:mapBuilderColor,label:''});mapBuilderDrag={mode:'resize',handle:'size',index:items.length-1};}
  else if(tool==='line'){items.push({type:'line',x1:x,y1:y,x2:x,y2:y,color:mapBuilderColor,dash:false});mapBuilderDrag={mode:'resize',handle:'p2',index:items.length-1};}
  else if(tool==='token'){items.push({type:'token',cx:x,cy:y,color:mapBuilderColor,label:'',number:'',icon:'dot'});mapBuilderSelectedIndex=items.length-1;mapBuilderTool='select';render('admin');return;}
  else if(tool==='arrival1'||tool==='arrival2'){items.push({type:'circle',cx:x,cy:y,r:MAP_BUILDER_ARRIVAL_RADIUS_IN*DEPLOY_SCALE,color:mapBuilderColor,label:'',marker:tool==='arrival1'?'turn1':'turn2'});mapBuilderSelectedIndex=items.length-1;mapBuilderTool='select';render('admin');return;}
  else if(tool==='text'){items.push({type:'text',x,y,text:'Label',color:mapBuilderColor,size:11});mapBuilderSelectedIndex=items.length-1;mapBuilderTool='select';render('admin');return;}
  // Switch back to Select right away (the in-progress resize drag only
  // depends on mapBuilderDrag, never on the active tool, so this is safe
  // mid-drag) — otherwise the very next click on the canvas draws ANOTHER
  // shape instead of grabbing the one just placed, which made a freshly
  // drawn circle/rect/triangle/line impossible to reposition afterwards.
  mapBuilderSelectedIndex=items.length-1;
  mapBuilderTool='select';
  render('admin');
}
function mapBuilderDocMove(evt){
  if(!adminMapBuilderData)return;
  const [x,y]=mapBuilderLocalXY(evt);
  mapBuilderUpdateCoordReadout(x,y);
  if(!mapBuilderDrag)return;
  const {w,h}=deploymentMapPx(adminMapBuilderData.shapes);
  const it=adminMapBuilderData.shapes.items[mapBuilderDrag.index];if(!it)return;
  const d=mapBuilderDrag;
  const snapClampX=v=>mapBuilderClamp(mapBuilderSnap(v,w),w);
  const snapClampY=v=>mapBuilderClamp(mapBuilderSnap(v,h),h);
  if(d.mode==='move-point'){it.cx=snapClampX(x-d.ox);it.cy=snapClampY(y-d.oy);if(it.type==='circle')it.anchor=mapBuilderCircleAnchor(it.cx,it.cy,w,h);}
  else if(d.mode==='move-rect'){it.x=mapBuilderClamp(mapBuilderSnap(x-d.ox,w),w-it.w);it.y=mapBuilderClamp(mapBuilderSnap(y-d.oy,h),h-it.h);}
  else if(d.mode==='move-line'){const nx1=snapClampX(x-d.ox),ny1=snapClampY(y-d.oy);it.x1=nx1;it.y1=ny1;it.x2=mapBuilderClamp(nx1+d.dx,w);it.y2=mapBuilderClamp(ny1+d.dy,h);}
  else if(d.mode==='resize'){
    if(d.handle==='r'&&!it.marker)it.r=Math.max(4,Math.round(Math.hypot(snapClampX(x)-it.cx,snapClampY(y)-it.cy)));
    else if(d.handle==='se'){it.w=Math.max(4,snapClampX(x)-it.x);it.h=Math.max(4,snapClampY(y)-it.y);}
    else if(d.handle==='size'){const dx=it.corner==='nw'||it.corner==='sw'?snapClampX(x):w-snapClampX(x),dy=it.corner==='nw'||it.corner==='ne'?snapClampY(y):h-snapClampY(y);it.size=Math.max(4,Math.round(Math.max(dx,dy)));}
    else if(d.handle==='p1'){it.x1=snapClampX(x);it.y1=snapClampY(y);}
    else if(d.handle==='p2'){it.x2=snapClampX(x);it.y2=snapClampY(y);}
  }
  if(__mapBuilderMoveQueued)return;
  __mapBuilderMoveQueued=true;
  requestAnimationFrame(()=>{__mapBuilderMoveQueued=false;if(mapBuilderDrag)render('admin')});
}
function mapBuilderDocUp(){if(mapBuilderDrag){mapBuilderDrag=null;render('admin')}}
function mapBuilderSelectItem(i){mapBuilderSelectedIndex=i;mapBuilderTool='select';render('admin')}
function mapBuilderDeleteSelected(){
  if(!adminMapBuilderData||mapBuilderSelectedIndex<0)return;
  mapBuilderDeleteItem(mapBuilderSelectedIndex);
}
function mapBuilderDeleteItem(i){
  if(!adminMapBuilderData)return;
  adminMapBuilderData.shapes.items.splice(i,1);
  if(mapBuilderSelectedIndex===i)mapBuilderSelectedIndex=-1;
  else if(mapBuilderSelectedIndex>i)mapBuilderSelectedIndex--;
  render('admin');
}
function mapBuilderUpdateSelected(field,value){
  const it=adminMapBuilderData?.shapes?.items?.[mapBuilderSelectedIndex];if(!it)return;
  it[field]=value;render('admin');
}
// The inches value shown next to each "Wall distance shown" toggle, mirroring
// exactly what mapBuilderDimensionsMarkup would draw for that axis — same
// flush-wall branching — so typing a number there moves/resizes the shape
// consistently with what the dimension arrow on the canvas represents.
function mapBuilderCurrentDistIn(it,axis,w,h){
  const EPS=2;
  if(it.type==='circle'){
    if(axis==='x'){const nearX=(it.cx<=w/2)?0:w;return Math.abs(it.cx-nearX)/DEPLOY_SCALE;}
    const nearY=(it.cy<=h/2)?0:h;return Math.abs(it.cy-nearY)/DEPLOY_SCALE;
  }
  if(it.type==='rect'){
    if(axis==='x'){
      const flushL=it.x<=EPS,flushR=(w-(it.x+it.w))<=EPS;
      if(flushL)return (it.x+it.w)/DEPLOY_SCALE;
      if(flushR)return (w-it.x)/DEPLOY_SCALE;
      const cx=it.x+it.w/2,nearX=(cx<=w/2)?0:w;return Math.abs(cx-nearX)/DEPLOY_SCALE;
    }
    const flushT=it.y<=EPS,flushB=(h-(it.y+it.h))<=EPS;
    if(flushT)return (it.y+it.h)/DEPLOY_SCALE;
    if(flushB)return (h-it.y)/DEPLOY_SCALE;
    const cy=it.y+it.h/2,nearY=(cy<=h/2)?0:h;return Math.abs(cy-nearY)/DEPLOY_SCALE;
  }
  return 0;
}
// Typing a distance moves (free-floating shape) or resizes (wall-flush
// strip) the selected shape so the reading matches what was typed — the
// inverse of mapBuilderCurrentDistIn's branching.
function mapBuilderSetDist(axis,v){
  const it=adminMapBuilderData?.shapes?.items?.[mapBuilderSelectedIndex];if(!it)return;
  const inches=Number(v);if(!Number.isFinite(inches)||inches<0)return;
  const d=inches*DEPLOY_SCALE,EPS=2;
  const {w,h}=deploymentMapPx(adminMapBuilderData.shapes);
  if(it.type==='circle'){
    // Typing an explicit distance is a deliberate switch back to "fixed wall
    // distance" mode for THIS AXIS ONLY — otherwise the next table-size
    // change would snap it back to an old anchor instead of honoring the
    // distance just typed. The other axis's anchor (e.g. a 50% X lock) must
    // survive untouched, so this only ever clears fx or fy individually,
    // never the whole anchor object outright.
    if(axis==='x'){
      const nearX=(it.cx<=w/2)?0:w;it.cx=nearX===0?d:w-d;
      if(it.anchor){const fy=it.anchor.fy;it.anchor=fy==null?null:{fx:null,fy};}
    } else {
      const nearY=(it.cy<=h/2)?0:h;it.cy=nearY===0?d:h-d;
      if(it.anchor){const fx=it.anchor.fx;it.anchor=fx==null?null:{fx,fy:null};}
    }
  } else if(it.type==='rect'){
    if(axis==='x'){
      const flushL=it.x<=EPS,flushR=(w-(it.x+it.w))<=EPS;
      if(flushL&&!flushR)it.w=Math.max(DEPLOY_SCALE,d-it.x);
      else if(flushR&&!flushL){it.x=w-d;it.w=d;}
      else{const cx=it.x+it.w/2,nearX=(cx<=w/2)?0:w,newCx=nearX===0?d:w-d;it.x=newCx-it.w/2;}
    } else {
      const flushT=it.y<=EPS,flushB=(h-(it.y+it.h))<=EPS;
      if(flushT&&!flushB)it.h=Math.max(DEPLOY_SCALE,d-it.y);
      else if(flushB&&!flushT){it.y=h-d;it.h=d;}
      else{const cy=it.y+it.h/2,nearY=(cy<=h/2)?0:h,newCy=nearY===0?d:h-d;it.y=newCy-it.h/2;}
    }
  }
  render('admin');
}
// Quick presets: a full table-edge rectangle ("Half" / "Edge strip") or a
// full-span divider line — the fast path for "bords de rectangle entier
// comme Zone, [ou] la ligne" instead of hand-dragging to the exact edge.
function mapBuilderSetEdgeStrip(v){
  const n=Math.max(1,Math.min(48,Number(v)||12));
  mapBuilderEdgeStripIn=n;
}
function mapBuilderQuickZone(kind){
  const {w,h}=deploymentMapPx(adminMapBuilderData.shapes);
  const items=adminMapBuilderData.shapes.items;
  const strip=(mapBuilderEdgeStripIn||12)*DEPLOY_SCALE;
  const presets={
    'half-top':{x:0,y:0,w,h:h/2},'half-bottom':{x:0,y:h/2,w,h:h/2},
    'half-left':{x:0,y:0,w:w/2,h},'half-right':{x:w/2,y:0,w:w/2,h},
    'edge-n':{x:0,y:0,w,h:strip},'edge-s':{x:0,y:h-strip,w,h:strip},
    'edge-w':{x:0,y:0,w:strip,h},'edge-e':{x:w-strip,y:0,w:strip,h}
  };
  const p=presets[kind];if(!p)return;
  items.push({type:'rect',...p,color:mapBuilderColor,label:''});
  mapBuilderSelectedIndex=items.length-1;mapBuilderTool='select';render('admin');
}
function mapBuilderQuickDivider(axis){
  const {w,h}=deploymentMapPx(adminMapBuilderData.shapes);
  const items=adminMapBuilderData.shapes.items;
  const it=axis==='h'?{type:'line',x1:0,y1:h/2,x2:w,y2:h/2,color:mapBuilderColor,dash:false}:{type:'line',x1:w/2,y1:0,x2:w/2,y2:h,color:mapBuilderColor,dash:false};
  items.push(it);
  mapBuilderSelectedIndex=items.length-1;mapBuilderTool='select';render('admin');
}
// A whole table edge turned straight into a Zone line, inset by a small
// margin so it sits just inside the frame instead of exactly on top of
// it (otherwise it's hard to see and hard to click/select afterwards).
function mapBuilderQuickEdgeLine(side){
  const {w,h}=deploymentMapPx(adminMapBuilderData.shapes);
  const items=adminMapBuilderData.shapes.items;
  const m=1*DEPLOY_SCALE; // 1" inward margin
  const presets={
    top:{x1:m,y1:m,x2:w-m,y2:m},
    bottom:{x1:m,y1:h-m,x2:w-m,y2:h-m},
    left:{x1:m,y1:m,x2:m,y2:h-m},
    right:{x1:w-m,y1:m,x2:w-m,y2:h-m}
  };
  const p=presets[side];if(!p)return;
  items.push({type:'line',...p,color:mapBuilderColor,dash:false});
  mapBuilderSelectedIndex=items.length-1;mapBuilderTool='select';render('admin');
}
async function saveMapBuilder(){
  const en=siteLanguage==='en';
  const name=(adminMapBuilderData.name||document.getElementById('mbName')?.value||'').trim();
  if(!name){toast(en?'Give the map a name':'Donne un nom à la carte');return}
  if(!adminMapBuilderData.shapes.items.length){toast(en?'Add at least one shape':'Ajoute au moins une forme');return}
  const body={name,shapes:adminMapBuilderData.shapes};
  try{
    if(adminMapBuilderId)await window.MordheimundaAPI.adminUpdateDeploymentMap(adminMapBuilderId,body);
    else await window.MordheimundaAPI.adminCreateDeploymentMap(body);
    toast(en?'Map saved':'Carte enregistrée');
    await loadDeploymentMaps();
    closeMapBuilder();
  }catch(e){toast(en?'Save failed':'Échec de l’enregistrement');}
}
function bindMapBuilderStage(){
  // Bound once, at document level, for the lifetime of the page — not just
  // on the canvas element — so a drag keeps tracking the mouse (and a
  // zone/line can be pulled exactly to the table edge) even when the
  // cursor briefly leaves the SVG while moving fast, and so the release
  // always ends the drag no matter where the mouse is at the time.
  if(window.__mapBuilderDocBound)return;
  window.__mapBuilderDocBound=true;
  document.addEventListener('mousemove',mapBuilderDocMove);
  document.addEventListener('mouseup',mapBuilderDocUp);
}
function mapBuilderPanel(){
  const en=siteLanguage==='en';
  const sh=adminMapBuilderData.shapes;
  const {w:pxW0,h:pxH0}=deploymentMapPx(sh);
  const rot=deploymentMapRotated(sh);
  const pxW=rot?pxH0:pxW0,pxH=rot?pxW0:pxH0;
  const sel=mapBuilderSelectedIndex>=0?sh.items[mapBuilderSelectedIndex]:null;
  // V-BUILDERCOMPACT: "je dois remonter souvent" — at the old 760px width
  // the columns (toolbar+canvas on the left, selected-shape/all-shapes panel
  // on the right) almost never fit side by side on an ordinary window, so
  // the right column wrapped below the canvas and every trip to a toolbar
  // button meant scrolling back up past the whole canvas. position:sticky
  // was tried first but glitched (overlaid other content while scrolling),
  // so instead the toolbar+palette moved into their own narrow sidebar
  // column (to the LEFT of the canvas, not stacked above it) — using the
  // screen's width instead of its height — which is what actually frees up
  // the vertical room for the canvas and the right panel to sit side by
  // side without wrapping.
  const dispW=680,dispH=Math.round(dispW*(pxH+2*MAP_BUILDER_MARGIN_PX)/(pxW+2*MAP_BUILDER_MARGIN_PX));
  return `<div class="admin-page">
   <div class="page-intro"><div><div class="eyebrow">ADMIN / DEPLOYMENT MAPS</div><h2>${adminMapBuilderId?(en?'Edit map':'Modifier la carte'):(en?'New map':'Nouvelle carte')}</h2></div>
     <div style="display:flex;gap:8px"><button type="button" class="button secondary" onclick="closeMapBuilder()">${en?'Cancel':'Annuler'}</button><button type="button" class="dash-btn-primary" onclick="saveMapBuilder()">✓ ${en?'Save':'Enregistrer'}</button></div>
   </div>
   <div class="scn-row2" style="max-width:600px">
     <div class="scn-field"><label>${en?'Map name':'Nom de la carte'}</label><input id="mbName" value="${esc(adminMapBuilderData.name)}" placeholder="${en?'e.g. Opposite Corners':'ex. Coins opposés'}" oninput="if(adminMapBuilderData)adminMapBuilderData.name=this.value"></div>
     <div class="scn-field"><label>${en?'Table size':'Taille de la table'}</label><div style="display:flex;gap:6px">${DEPLOY_TABLE_SIZES.map(t=>`<button type="button" class="button secondary ${sh.tableInches.w===t.w&&sh.tableInches.h===t.h?'active':''}" style="${sh.tableInches.w===t.w&&sh.tableInches.h===t.h?'border-color:var(--accent);color:var(--accent)':''}" onclick="mapBuilderSetTableSize(${t.w},${t.h})">${t.w}"×${t.h}"</button>`).join('')}</div></div>
   </div>
   <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
     <div style="flex:0 0 auto;width:84px">
       <div class="map-builder-toolbar" style="max-width:none">${MAP_BUILDER_TOOLS.map(t=>`<button type="button" class="map-builder-tool ${mapBuilderTool===t.id?'active':''}" title="${esc(en?t.label.en:t.label.fr)}" onclick="mapBuilderSetTool('${t.id}')">${t.icon}</button>`).join('')}</div>
       <div class="map-builder-palette" style="max-width:none">${DEPLOY_PALETTE_KEYS.map(k=>`<button type="button" class="map-builder-swatch ${mapBuilderColor===k?'active':''}" style="background:${DEPLOY_PALETTE[k]}" title="${k}" onclick="mapBuilderSetColor('${k}')"></button>`).join('')}</div>
     </div>
     <div style="flex:0 0 auto">
       <div class="map-builder-quickrow">
         <span class="map-builder-quicklabel">${en?'Quick zones:':'Zones rapides :'}</span>
         <button type="button" class="button secondary" onclick="mapBuilderQuickZone('half-top')">${en?'Top half':'Moitié haut'}</button>
         <button type="button" class="button secondary" onclick="mapBuilderQuickZone('half-bottom')">${en?'Bottom half':'Moitié bas'}</button>
         <button type="button" class="button secondary" onclick="mapBuilderQuickZone('half-left')">${en?'Left half':'Moitié gauche'}</button>
         <button type="button" class="button secondary" onclick="mapBuilderQuickZone('half-right')">${en?'Right half':'Moitié droite'}</button>
       </div>
       <div class="map-builder-quickrow">
         <span class="map-builder-quicklabel">${en?'Edge strips, depth:':'Bandes de bord, profondeur :'}</span>
         <input type="number" min="1" max="48" step="1" value="${mapBuilderEdgeStripIn}" oninput="mapBuilderSetEdgeStrip(this.value)" style="width:48px;background:var(--bg);border:1px solid var(--line);border-radius:4px;color:var(--text);padding:5px 6px;font-size:12px;font-family:'IBM Plex Mono',monospace">
         <span class="map-builder-quicklabel">"</span>
         <button type="button" class="button secondary" onclick="mapBuilderQuickZone('edge-n')">N</button>
         <button type="button" class="button secondary" onclick="mapBuilderQuickZone('edge-s')">S</button>
         <button type="button" class="button secondary" onclick="mapBuilderQuickZone('edge-w')">W</button>
         <button type="button" class="button secondary" onclick="mapBuilderQuickZone('edge-e')">E</button>
         <span class="map-builder-quicklabel" style="margin-left:10px">${en?'Divider:':'Ligne de partage :'}</span>
         <button type="button" class="button secondary" onclick="mapBuilderQuickDivider('h')">↔</button>
         <button type="button" class="button secondary" onclick="mapBuilderQuickDivider('v')">↕</button>
       </div>
       <div class="map-builder-quickrow">
         <span class="map-builder-quicklabel">${en?'Edge as line (zone border):':'Bord en ligne (zone) :'}</span>
         <button type="button" class="button secondary" onclick="mapBuilderQuickEdgeLine('top')">${en?'Top':'Haut'}</button>
         <button type="button" class="button secondary" onclick="mapBuilderQuickEdgeLine('bottom')">${en?'Bottom':'Bas'}</button>
         <button type="button" class="button secondary" onclick="mapBuilderQuickEdgeLine('left')">${en?'Left':'Gauche'}</button>
         <button type="button" class="button secondary" onclick="mapBuilderQuickEdgeLine('right')">${en?'Right':'Droite'}</button>
       </div>
       <div class="map-builder-quickrow map-builder-mp" style="flex-direction:column;align-items:stretch;gap:7px">
         <div style="display:flex;align-items:center;gap:8px">
           <span class="map-builder-quicklabel">${en?'Multiplayer setup:':'Config. multijoueur :'}</span>
           <select onchange="mapBuilderSetMPCount(Number(this.value))" style="background:var(--bg);border:1px solid var(--line);border-radius:4px;color:var(--text);padding:5px 7px;font-size:11.5px">
             ${[2,3,4].map(n=>`<option value="${n}" ${mapBuilderMPPlayers.length===n?'selected':''}>${n} ${en?'players':'joueurs'}</option>`).join('')}
           </select>
         </div>
         ${mapBuilderMPPlayers.map((p,i)=>`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
           <span style="font:800 10px 'IBM Plex Sans';color:${DEPLOY_PALETTE[p.color]};min-width:22px">P${i+1}</span>
           <select onchange="mapBuilderMPUpdate(${i},'edge',this.value)" style="background:var(--bg);border:1px solid var(--line);border-radius:4px;color:var(--text);padding:4px 6px;font-size:11px">
             ${['top','bottom','left','right'].map(e=>`<option value="${e}" ${p.edge===e?'selected':''}>${en?e:{top:'Haut',bottom:'Bas',left:'Gauche',right:'Droite'}[e]}</option>`).join('')}
           </select>
           <div class="map-builder-palette">${DEPLOY_PALETTE_KEYS.map(k=>`<button type="button" class="map-builder-swatch ${p.color===k?'active':''}" style="background:${DEPLOY_PALETTE[k]}" title="${k}" onclick="mapBuilderMPUpdate(${i},'color','${k}')"></button>`).join('')}</div>
           <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted2)">① <input type="number" min="0" max="2" value="${p.c1}" style="width:40px;background:var(--bg);border:1px solid var(--line);border-radius:4px;color:var(--text);padding:4px" oninput="mapBuilderMPUpdate(${i},'c1',Math.max(0,Math.min(2,Number(this.value)||0)))"></label>
           <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted2)">② <input type="number" min="0" max="2" value="${p.c2}" style="width:40px;background:var(--bg);border:1px solid var(--line);border-radius:4px;color:var(--text);padding:4px" oninput="mapBuilderMPUpdate(${i},'c2',Math.max(0,Math.min(2,Number(this.value)||0)))"></label>
         </div>`).join('')}
         <div><button type="button" class="button primary" onclick="mapBuilderGenerateMultiplayer()">⚡ ${en?'Generate':'Générer'}</button> <span class="muted" style="font-size:10.5px">${en?'Adds each player\'s edge line + arrival circles, in their color — run it again any time.':'Ajoute la ligne de bord + les cercles d’arrivée de chaque joueur, dans sa couleur — à relancer à volonté.'}</span></div>
       </div>
       <div class="map-builder-canvas-wrap" style="width:${dispW}px;height:${dispH}px">${deploymentMapCardSVG(sh,{id:'mapBuilderCanvas',interactive:true,selectedIndex:mapBuilderSelectedIndex})}</div>
       <div id="mbCoord" class="map-builder-coord">X: —  Y: —</div>
       <p class="muted" style="font-size:11.5px;margin-top:4px">${en?'Pick a tool, click (or click-drag) on the table. In Select, drag a shape to move it, or drag its white handle to resize. Shapes snap to the center/quarter lines and the table edges.':'Choisis un outil, clique (ou clique-glisse) sur la table. En Sélection, glisse une forme pour la déplacer, ou sa poignée blanche pour la redimensionner. Les formes s’accrochent au centre, aux quarts et aux bords.'}</p>
     </div>
     <div style="flex:1;min-width:260px">
       ${sel?`<div class="card admin-card">
         <div class="eyebrow">${en?'SELECTED SHAPE':'FORME SÉLECTIONNÉE'} · ${sel.type.toUpperCase()}${deploymentMapItemSizeLabel(sel)?` · ${esc(deploymentMapItemSizeLabel(sel))}`:''}</div>
         <div class="scn-field"><label>${en?'Label':'Libellé'}</label><input value="${esc(sel.label||sel.text||'')}" oninput="mapBuilderUpdateSelected('${sel.type==='text'?'text':'label'}',this.value)"></div>
         ${sel.type==='token'?`<div class="scn-field"><label>${en?'Icon':'Icône'}</label><div class="map-builder-icons">${DEPLOY_TOKEN_ICONS.map(ic=>`<button type="button" class="map-builder-icon-btn ${sel.icon===ic.key?'active':''}" onclick="mapBuilderUpdateSelected('icon','${ic.key}')">${ic.glyph}</button>`).join('')}</div></div><div class="scn-field"><label>${en?'Number':'Numéro'}</label><input value="${esc(sel.number||'')}" oninput="mapBuilderUpdateSelected('number',this.value)"></div>`:''}
         ${sel.type==='circle'?`<div class="scn-field"><label>${en?'Arrival marker':'Marqueur d’arrivée'}</label><div class="map-builder-icons"><button type="button" class="map-builder-icon-btn ${!sel.marker?'active':''}" title="${en?'None':'Aucun'}" onclick="mapBuilderUpdateSelected('marker','')">—</button><button type="button" class="map-builder-icon-btn ${sel.marker==='turn1'?'active':''}" onclick="mapBuilderUpdateSelected('marker','turn1')">①</button><button type="button" class="map-builder-icon-btn ${sel.marker==='turn2'?'active':''}" onclick="mapBuilderUpdateSelected('marker','turn2')">②</button></div></div>`:''}
         ${sel.type==='circle'?`<div class="scn-field"><label>${en?'Border anchor':'Point d’ancrage'}</label><p class="muted" style="margin:0 0 6px;font-size:10.5px">${en?'Lock either axis independently — e.g. just the vertical center line — and it stays exactly there (proportionally upscaled) on any table-size change. A free axis keeps a fixed wall distance.':'Verrouille chaque axe indépendamment — par ex. juste l’axe vertical du centre — il y reste exactement (upscalé proportionnellement) à tout changement de format. Un axe libre garde une distance fixe au mur.'}</p><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span class="${sel.anchor?'chip':'muted'}" style="font-size:10.5px">${sel.anchor?'📍 '+mapBuilderAnchorLabel(sel.anchor,en):(en?'Not anchored — fixed wall distance':'Non ancré — distance fixe au mur')}</span>${!(sel.anchor&&sel.anchor.fx!=null&&sel.anchor.fy!=null)?`<button type="button" class="button secondary" style="padding:4px 10px;font-size:10.5px" onclick="mapBuilderAnchorSelected()">📍 ${en?'Anchor to nearest point':'Ancrer au point le plus proche'}</button>`:''}${sel.anchor?`<button type="button" class="button secondary" style="padding:4px 10px;font-size:10.5px" onclick="mapBuilderUpdateSelected('anchor',null)">${en?'Unpin all':'Tout libérer'}</button>`:''}</div><div style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span class="muted" style="font-size:10.5px;width:14px">X</span>${mapBuilderAxisAnchorButtons(sel,'x',en)}</div><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span class="muted" style="font-size:10.5px;width:14px">Y</span>${mapBuilderAxisAnchorButtons(sel,'y',en)}</div></div></div>`:''}
         ${sel.type==='text'?`<div class="scn-field"><label>${en?'Size':'Taille'}</label><input type="number" min="8" max="28" value="${sel.size||11}" oninput="mapBuilderUpdateSelected('size',Number(this.value)||11)"></div>`:''}
         ${sel.type==='line'?`<label class="theme-toggle-row"><span>${en?'Dashed':'Pointillés'}</span><span class="theme-switch"><input type="checkbox" ${sel.dash?'checked':''} onchange="mapBuilderUpdateSelected('dash',this.checked)"><i>╌</i></span></label>`:''}
         ${(sel.type==='circle'||sel.type==='rect')?`<div class="scn-field"><label>${en?'Wall distance shown':'Distance au bord affichée'}</label><p class="muted" style="margin:0 0 6px;font-size:10.5px">${en?'Turn off an axis when a zone is placed dead-center on it, so the number (which depends on the table size) isn\'t shown at all. Type a value to move (or resize, for an edge strip) the shape to that exact distance.':'Désactive un axe quand la zone est placée pile au centre sur cet axe, pour que le chiffre (qui dépend de la taille de table) ne s’affiche pas du tout. Tape une valeur pour déplacer (ou redimensionner, pour une bande de bord) la forme à cette distance exacte.'}</p><div class="theme-toggle-row" style="cursor:default"><span>X</span><input type="number" min="0" step="0.5" id="mbDistX" value="${mapBuilderCurrentDistIn(sel,'x',pxW0,pxH0).toFixed(1).replace(/\.0$/,'')}" style="width:56px;background:var(--bg);border:1px solid var(--line);border-radius:4px;color:var(--text);padding:4px 6px;font-size:11.5px;margin-right:8px" oninput="mapBuilderSetDist('x',this.value)"><label class="theme-switch"><input type="checkbox" ${sel.noDimX?'':'checked'} onchange="mapBuilderUpdateSelected('noDimX',!this.checked)"><i></i></label></div><div class="theme-toggle-row" style="cursor:default"><span>Y</span><input type="number" min="0" step="0.5" id="mbDistY" value="${mapBuilderCurrentDistIn(sel,'y',pxW0,pxH0).toFixed(1).replace(/\.0$/,'')}" style="width:56px;background:var(--bg);border:1px solid var(--line);border-radius:4px;color:var(--text);padding:4px 6px;font-size:11.5px;margin-right:8px" oninput="mapBuilderSetDist('y',this.value)"><label class="theme-switch"><input type="checkbox" ${sel.noDimY?'':'checked'} onchange="mapBuilderUpdateSelected('noDimY',!this.checked)"><i></i></label></div></div>`:''}
         ${sel.type==='circle'?`<label class="theme-toggle-row"><span>${en?'Show circle':'Afficher le cercle'}</span><span class="theme-switch"><input type="checkbox" ${sel.noCircle?'':'checked'} onchange="mapBuilderUpdateSelected('noCircle',!this.checked)"><i></i></span></label><p class="muted" style="margin:0 0 10px;font-size:10.5px">${en?'Turn off to show just the arrival marker, with no circle outline — e.g. for a marker without a drawn zone.':'Désactive pour n’afficher que le marqueur d’arrivée, sans le contour du cercle — par ex. pour un marqueur sans zone dessinée.'}</p>`:''}
         <div class="scn-field"><label>${en?'Color':'Couleur'}</label><div class="map-builder-palette">${DEPLOY_PALETTE_KEYS.map(k=>`<button type="button" class="map-builder-swatch ${sel.color===k?'active':''}" style="background:${DEPLOY_PALETTE[k]}" title="${k}" onclick="mapBuilderUpdateSelected('color','${k}')"></button>`).join('')}</div></div>
         <button type="button" class="equipment-action remove" onclick="mapBuilderDeleteSelected()">🗑 ${en?'Delete this shape':'Supprimer cette forme'}</button>
       </div>`:`<div class="empty compact">${en?'Nothing selected. Draw a shape with the tools on the left, or switch to Select and click one.':'Rien de sélectionné. Dessine une forme avec les outils à gauche, ou passe en Sélection et clique sur l’une d’elles.'}</div>`}
       <div class="card admin-card" style="margin-top:12px">
         <div class="eyebrow">${en?'ALL SHAPES':'TOUTES LES FORMES'} (${sh.items.length})</div>
         ${sh.items.length?`<div class="custom-item-list">${sh.items.map((it,i)=>`<article class="custom-item-row ${i===mapBuilderSelectedIndex?'is-active':''}" style="cursor:pointer" onclick="mapBuilderSelectItem(${i})"><div class="custom-item-main"><div><strong>${esc(it.type)}</strong><small>${esc(it.label||it.text||'')} · ${esc(deploymentMapItemSizeLabel(it))}</small></div></div><div class="custom-item-actions"><button type="button" class="equipment-action remove" onclick="event.stopPropagation();mapBuilderDeleteItem(${i})">🗑</button></div></article>`).join('')}</div>`:''}
       </div>
     </div>
   </div>
  </div>`;
}
async function openScenarioEditor(id){
  if(!id){adminScenarioEditId=null;adminScenarioEditData=blankScenarioDraft();render('admin');return}
  const en=siteLanguage==='en';
  try{
    const {scenario}=await window.MordheimundaAPI.adminGetScenario(id);
    adminScenarioEditId=id;adminScenarioEditData=scenario;
    render('admin');
  }catch(e){toast(en?'Could not load this scenario':'Impossible de charger ce scénario');}
}
function closeScenarioEditor(){adminScenarioEditId=null;adminScenarioEditData=null;render('admin')}
function initScenarioEditorAutoGrow(){document.querySelectorAll('.scn-autogrow').forEach(autoGrowTextarea);}
// V-SCNKEEP: every field of the open scenario editor, read from the form.
// Used by Save, and before any re-render of the editor (a ticked table size,
// a formula mode, a deployment map…) so text typed since the last render is
// kept in the draft instead of being wiped by the redraw.
function scenarioEditorCollect(){
  const v=id=>document.getElementById(id)?.value||'';
  syncScenarioFormulaFieldsToDraft();
  const categories=Array.from(document.querySelectorAll('.seCategoryCb:checked')).map(cb=>cb.value);
  const bf=adminScenarioEditData?.bandsFormula||{};
  return {
    name:v('seName').trim(),categories:categories.length?categories:['1v1'],summary:v('seSummary'),
    tableSizes:(Array.isArray(adminScenarioEditData?.tableSizes)&&adminScenarioEditData.tableSizes.length)?adminScenarioEditData.tableSizes:['48x48'],
    bandsMin:Number(v('seBandsMin'))||1,bandsMax:Number(v('seBandsMax'))||1,
    battlefield:{terrainType:v('seTerrain'),setupInstructions:v('seSetup')},
    roles:{attacker:v('seAttacker'),defender:v('seDefender')},
    preparation:{enabled:!!document.getElementById('sePrepEnabled')?.checked,text:v('sePrepText')},
    specialRules:v('seSpecialRules').trim(),
    bandsFormula:{mode:bf.mode||'custom',customText:bf.customText||'',adjacentText:bf.adjacentText||'',randomDiceCount:bf.randomDiceCount||1,randomDiceFaces:bf.randomDiceFaces||6,hybridBase:bf.hybridBase||0,hybridDieFaces:bf.hybridDieFaces||6},
    underdogBonus:v('seUnderdog').trim(),
    deployment:{tableEdgeRule:v('seTableEdge'),zones:linesToList(v('seZones')),mapIds:(adminScenarioEditData?.deployment?.mapIds)||[]},
    experience:linesToPairs(v('seExperience')).map(p=>({name:p.a,text:p.b})),
    objectives:{primary:v('seObjPrimary'),secondary:v('seObjSecondary')},
    endCondition:v('seEndCondition'),
    victory:{major:v('seVictoryMajor'),minor:v('seVictoryMinor'),draw:v('seVictoryDraw')},
    rewards:(t=>scenarioTextIsRich(t)?[t.trim()]:linesToList(t))(v('seRewards')),
    campaignSeries:{seriesId:'',seriesName:v('seSeriesName'),position:v('seSeriesPosition')},
    eventWindow:{start:v('seEventStart'),end:v('seEventEnd')},
    thumbnail:adminScenarioEditData?.thumbnail||'',
    thumbnailFocus:adminScenarioEditData?.thumbnailFocus||null
  };
}
function syncScenarioEditorFormToDraft(){if(!adminScenarioEditData||!document.getElementById('seName'))return;const {tableSizes,thumbnail,thumbnailFocus,...rest}=scenarioEditorCollect();rest.deployment.mapIds=adminScenarioEditData.deployment?.mapIds||[];Object.assign(adminScenarioEditData,rest)}
async function saveScenarioEditor(){
  const en=siteLanguage==='en';
  const v=id=>document.getElementById(id)?.value||'';
  const name=v('seName').trim();
  if(!name){toast(en?'Give the scenario a name':'Donne un nom au scénario');return}
  const body=scenarioEditorCollect();
  try{
    if(adminScenarioEditId)await window.MordheimundaAPI.adminUpdateScenario(adminScenarioEditId,body);
    else await window.MordheimundaAPI.adminCreateScenario(body);
    toast(en?'Scenario saved':'Scénario enregistré');
    adminScenariosCache=null;
    closeScenarioEditor();
    await loadAdminScenariosData();
    loadScenarios();
  }catch(e){toast(en?'Save failed':'Échec de l’enregistrement');}
}
function scenarioEditorPanel(){
  const en=siteLanguage==='en';
  const d=adminScenarioEditData||blankScenarioDraft();
  // V-MAPSIZEAGNOSTIC: a deployment map is available regardless of the
  // table size it was originally drawn at — deploymentMapResizeShapes
  // rescales its zones proportionally to whichever table size the scenario
  // (or the Play Mode session) actually uses, so a map drawn at 48x72
  // works fine attached to a 48x48-only scenario and vice versa. Used to
  // filter maps out here by their native size, which hid perfectly usable
  // maps from the picker for no real reason.
  const maps=DEPLOYMENT_MAPS_CACHE||[];
  const selectedMapIds=new Set(d.deployment?.mapIds||[]);
  const curTableSizes=(Array.isArray(d.tableSizes)&&d.tableSizes.length)?d.tableSizes:['48x48'];
  return `<div class="admin-page" onfocusin="scenarioFormatFocus(event)">
   <div class="page-intro"><div><div class="eyebrow">ADMIN / SCENARIOS</div><h2>${adminScenarioEditId?(en?'Edit scenario':'Modifier le scénario'):(en?'New scenario':'Nouveau scénario')}</h2></div>
     <div style="display:flex;gap:8px"><button type="button" class="button secondary" onclick="closeScenarioEditor()">${en?'Cancel':'Annuler'}</button><button type="button" class="dash-btn-primary" onclick="saveScenarioEditor()">✓ ${en?'Save':'Enregistrer'}</button></div>
   </div>

   <div class="scn-format-bar">${ruleEditToolbarMarkup('',en?'Same formatting as the rules: click in a text field, then use the buttons.':'Même mise en forme que les règles : clique dans un champ de texte, puis utilise les boutons.')}<div class="scn-format-target" id="scnFormatTarget">${en?'Click in a text field to format it':'Clique dans un champ de texte pour le mettre en forme'}</div></div>

   <section class="scn-sec"><div class="scn-sectitle">${en?'Identity & Category':'Identité & Catégorie'}</div>
     <div class="scn-row2">
       <div class="scn-field"><label>${en?'Scenario name':'Nom du scénario'}</label><input id="seName" value="${esc(d.name)}"></div>
       <div class="scn-row2" style="margin:0"><div class="scn-field"><label>${en?'Bands min':'Bandes min'}</label><input id="seBandsMin" type="number" min="1" max="10" value="${d.bandsMin}"></div><div class="scn-field"><label>${en?'Bands max':'Bandes max'}</label><input id="seBandsMax" type="number" min="1" max="10" value="${d.bandsMax}"></div></div>
     </div>
     <div class="scn-field"><label>${en?'Summary (shown on the list)':'Résumé (affiché sur la liste)'}</label><textarea id="seSummary" rows="2">${esc(d.summary)}</textarea></div>
     <div class="scn-field"><label>${en?'Card image':'Image de la carte'}</label><div class="scn-thumb-field" id="seThumbField">${scenarioThumbFieldInner(d)}</div></div>
     <div class="scn-field"><label>${en?'Categories (pick any that apply)':'Catégories (coche celles qui s’appliquent)'}</label><div class="scn-cat-checks">${['1v1','multiplayers','campaign','event','history'].map(c=>`<label class="scn-cat-check"><input type="checkbox" value="${c}" class="seCategoryCb" ${(d.categories||[d.category]).includes(c)?'checked':''}> ${scenarioCategoryLabel(c,en)}</label>`).join('')}</div></div>
     <div class="scn-field"><label>${en?'Allowed table size(s)':'Taille(s) de table autorisée(s)'}</label><p class="muted" style="margin:0 0 6px;font-size:10.5px">${en?'Check every size this scenario can be played on — the deployment map picker and Play mode\'s random generator only ever offer a size checked here.':'Coche chaque taille sur laquelle ce scénario peut se jouer — le sélecteur de carte et le générateur aléatoire de Jouer ne proposent que les tailles cochées ici.'}</p><div class="scn-cat-checks"><label class="scn-cat-check"><input type="checkbox" value="48x48" class="seTableSizeCb" ${curTableSizes.includes('48x48')?'checked':''} onchange="syncScenarioTableSizesToDraft()"> 48" × 48"</label><label class="scn-cat-check"><input type="checkbox" value="48x72" class="seTableSizeCb" ${curTableSizes.includes('48x72')?'checked':''} onchange="syncScenarioTableSizesToDraft()"> 48" × 72"</label></div></div>
     <div class="scn-row2">
       <div class="scn-field"><label>${en?'Campaign series name (if Campaign/History)':'Nom de la suite (si Campaign/History)'}</label><input id="seSeriesName" value="${esc(d.campaignSeries?.seriesName||'')}"></div>
       <div class="scn-field"><label>${en?'Position in series (e.g. 3/5)':'Position dans la suite (ex. 3/5)'}</label><input id="seSeriesPosition" value="${esc(d.campaignSeries?.position||'')}"></div>
     </div>
     <div class="scn-row2">
       <div class="scn-field"><label>${en?'Event window start (if Event)':'Début (si Event)'}</label><input id="seEventStart" value="${esc(d.eventWindow?.start||'')}" placeholder="2026-10-20"></div>
       <div class="scn-field"><label>${en?'Event window end':'Fin'}</label><input id="seEventEnd" value="${esc(d.eventWindow?.end||'')}" placeholder="2026-10-31"></div>
     </div>
   </section>

   <section class="scn-sec"><div class="scn-sectitle">01 · ${en?'Battlefield':'Champ de Bataille'}</div>
     <div class="scn-field"><label>${en?'Terrain type':'Type de terrain'}</label><input id="seTerrain" value="${esc(d.battlefield?.terrainType||'')}"></div>
     <div class="scn-field"><label>${en?'Setup instructions':'Instructions de mise en place'}</label><textarea id="seSetup" rows="3">${esc(d.battlefield?.setupInstructions||'')}</textarea></div>
   </section>

   <section class="scn-sec"><div class="scn-sectitle">02 · ${en?'Attacker & Defender':'Attaquant & Défenseur'}</div>
     <div class="scn-row2">
       <div class="scn-field"><label>${en?'Attacker rule':'Règle — Attaquant'}</label><textarea id="seAttacker" rows="2">${esc(d.roles?.attacker||'')}</textarea></div>
       <div class="scn-field"><label>${en?'Defender rule':'Règle — Défenseur'}</label><textarea id="seDefender" rows="2">${esc(d.roles?.defender||'')}</textarea></div>
     </div>
   </section>

   <section class="scn-sec"><div class="scn-sectitle">03 · ${en?'Preparation':'Préparation'}</div>
     <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted2);margin-bottom:10px"><input id="sePrepEnabled" type="checkbox" ${d.preparation?.enabled?'checked':''}> ${en?'Section enabled for this scenario':'Section activée pour ce scénario'}</label>
     <div class="scn-field"><label>${en?'Preparation text':'Texte de préparation'}</label><textarea id="sePrepText" rows="2">${esc(d.preparation?.text||'')}</textarea></div>
   </section>

   <section class="scn-sec"><div class="scn-sectitle">04 · ${en?'Special Scenario Rules':'Règles Spéciales de Scénario'}</div>
     <p class="muted" style="font-size:12px;margin:0 0 8px">${en?'Plain text explaining the scenario’s special rules — not a list, just write it out (as long as you need).':'Texte libre expliquant les règles spéciales du scénario — pas une liste, écris-le simplement (aussi long que nécessaire).'}</p>
     <div class="scn-field"><label>${en?'Special rules text':'Texte des règles spéciales'}</label><textarea id="seSpecialRules" class="scn-autogrow" rows="4" oninput="autoGrowTextarea(this)" placeholder="${en?'e.g. Once you have placed the terrain, put some Wyrdstone counters on the tabletop...':'ex. Une fois le terrain placé, dispose des jetons de Pierre-de-Sorcier...'}">${esc(scenarioSpecialRulesText(d))}</textarea></div>
   </section>

   <section class="scn-sec"><div class="scn-sectitle">05 · ${en?'Warbands — fighters per band':'Bandes — combattants par bande'}</div>
     <p class="muted" style="font-size:12px;margin:0 0 8px">${en?'How many fighters EACH warband fields in this scenario, decided per band.':'Combien de combattants CHAQUE bande engage dans ce scénario, décidé bande par bande.'}</p>
     <div class="scn-field"><label>${en?'Mode':'Mode'}</label><select id="seFormulaMode" onchange="updateScenarioFormulaMode(this.value)">
       <option value="custom" ${(d.bandsFormula?.mode||'custom')==='custom'?'selected':''}>${en?'Custom (you choose)':'Custom (tu choisis)'}</option>
       <option value="random" ${d.bandsFormula?.mode==='random'?'selected':''}>${en?'Random (dice formula)':'Random (formule de dé)'}</option>
       <option value="hybrid" ${d.bandsFormula?.mode==='hybrid'?'selected':''}>Hybrid</option>
     </select></div>
     ${(d.bandsFormula?.mode||'custom')==='custom'?`<div class="scn-field"><label>${en?'Value shown to players':'Valeur affichée aux joueurs'}</label>${customTextToolbarMarkup('seFormulaCustomText')}<textarea id="seFormulaCustomText" class="scn-autogrow" rows="2" oninput="autoGrowTextarea(this)" placeholder="${en?'e.g. 5 fighters / All of your warband':'ex. 5 combattants / Toute la bande'}">${esc(d.bandsFormula?.customText||'')}</textarea><small class="muted">${en?'Shown exactly as typed — never calculated. The house convention: select a fixed/custom-chosen part and color it green; select a random/dice part and color it yellow.':'Affiché tel que saisi — jamais calculé. Convention maison : sélectionne une partie fixe/choisie et mets-la en vert ; sélectionne une partie random/dé et mets-la en jaune.'}</small></div>`:''}
     ${d.bandsFormula?.mode==='random'?`<div class="scn-row2">
       <p class="muted" style="font-size:11.5px;margin:0 0 4px;width:100%">${en?'Shown to players with the dice notation colored yellow automatically.':'Affiché aux joueurs avec la notation de dé colorée en jaune automatiquement.'}</p>
       <div class="scn-field"><label>${en?'Number of dice':'Nombre de dés'}</label><input id="seFormulaDiceCount" type="number" min="1" max="10" value="${d.bandsFormula?.randomDiceCount??1}"></div>
       <div class="scn-field"><label>${en?'Die faces (D?)':'Faces du dé (D?)'}</label><input id="seFormulaDiceFaces" type="number" min="2" max="100" value="${d.bandsFormula?.randomDiceFaces??6}"></div>
     </div>`:''}
     ${d.bandsFormula?.mode==='hybrid'?`<div class="scn-row2">
       <div class="scn-field"><label>${en?'Fixed base (X)':'Chiffre fixe (X)'}</label><input id="seFormulaHybridBase" type="number" min="0" max="50" value="${d.bandsFormula?.hybridBase??0}"></div>
       <div class="scn-field"><label>${en?'+1 roll of (DY faces)':'+1 jet de (DY faces)'}</label><input id="seFormulaHybridDie" type="number" min="2" max="100" value="${d.bandsFormula?.hybridDieFaces??6}"></div>
     </div><p class="muted" style="font-size:11.5px;margin:4px 0 0">${en?'Plus half of that warband’s total fighters, automatically. Shown to players with the fixed base in green and the die roll in yellow, automatically.':'Plus la moitié du total de combattants de cette bande, automatiquement. Affiché aux joueurs avec le chiffre fixe en vert et le jet de dé en jaune, automatiquement.'}</p>`:''}
     <div class="scn-field"><label>${en?'Adjacent text (shown next to the box, not inside it)':'Texte adjacent (affiché à côté de l’encart, pas dedans)'}</label>${customTextToolbarMarkup('seFormulaAdjacentText')}<textarea id="seFormulaAdjacentText" class="scn-autogrow" rows="2" oninput="autoGrowTextarea(this)" placeholder="${en?'Optional — extra explanation or exceptions, e.g. \'The Lance may include 1 additional warrior for every 2 warriors in its warband size.\'':'Facultatif — explication ou exception supplémentaire, ex. « La Lance peut inclure 1 guerrier de plus pour 2 guerriers dans sa bande. »'}">${esc(d.bandsFormula?.adjacentText||'')}</textarea></div>
   </section>

   <section class="scn-sec"><div class="scn-sectitle">06 · ${en?'Underdog Bonus':'Underdogs Bonus'}</div>
     <p class="muted" style="font-size:12px;margin:0 0 8px">${en?'Plain text explaining the Underdog Bonus — not a list, just write it out (as long as you need).':'Texte libre expliquant l’Underdog Bonus — pas une liste, écris-le simplement (aussi long que nécessaire).'}</p>
     <div class="scn-field"><label>${en?'Underdog Bonus text':'Texte de l’Underdog Bonus'}</label><textarea id="seUnderdog" class="scn-autogrow" rows="3" oninput="autoGrowTextarea(this)" placeholder="${en?'e.g. Above 100 Rating in difference, use the Underdog Table...':'ex. Au-dessus de 100 points de différence, utilise la Table Underdog...'}">${esc(scenarioUnderdogBonusText(d))}</textarea></div>
   </section>

   <section class="scn-sec"><div class="scn-sectitle">07 · ${en?'Deployment':'Déploiement'}</div>
     <div class="scn-row2">
       <div class="scn-field"><label>${en?'Table edge rule':'Règle des bords de table'}</label><textarea id="seTableEdge" rows="2">${esc(d.deployment?.tableEdgeRule||'')}</textarea></div>
       <div class="scn-field"><label>${en?'Zones (one per line)':'Zones (une par ligne)'}</label><textarea id="seZones" rows="2">${esc(listToLines(d.deployment?.zones))}</textarea></div>
     </div>
     <div class="scn-field"><label>${en?'Deployment maps allowed for this scenario':'Cartes de déploiement autorisées'}</label>
       ${maps.length?`<div class="scn-maps-grid">${maps.map(m=>`<div class="scn-map-tile ${selectedMapIds.has(m.id)?'checked':''}" id="seMapTile-${esc(m.id)}" onclick="toggleScenarioMapSelection('${esc(m.id)}')">${deploymentMapPreviewMarkup(m)}<span class="scn-map-num">#${m.number}</span><span class="scn-map-cb ${selectedMapIds.has(m.id)?'on':''}" id="seMapCb-${esc(m.id)}">✓</span><div class="scn-map-name">${esc(m.name||'')}</div></div>`).join('')}</div>`:`<div class="empty compact">${en?'No deployment maps yet — add some from the Scenarios admin category.':'Aucune carte de déploiement — ajoutes-en depuis la catégorie admin Scénarios.'}</div>`}
     </div>
   </section>

   <section class="scn-sec"><div class="scn-sectitle">08 · ${en?'Experience — Obtention':'Expérience — Obtention'}</div>
     <div class="scn-field"><label>${en?'One per line: Name | Text':'Une par ligne : Nom | Texte'}</label><textarea id="seExperience" class="scn-autogrow" rows="3" oninput="autoGrowTextarea(this)">${esc(pairsToLines(d.experience,'name','text'))}</textarea><small class="muted">${en?'Add as many lines as you need — the box grows to fit, and the player page lays them out in a flexible grid.':'Ajoute autant de lignes que nécessaire — la zone s’agrandit, et la page joueur les affiche dans une grille flexible.'}</small></div>
   </section>

   <section class="scn-sec"><div class="scn-sectitle">09 · ${en?'Objectives':'Objectifs'}</div>
     <div class="scn-field"><label>${en?'Primary objective':'Objectif principal'}</label><textarea id="seObjPrimary" rows="2">${esc(d.objectives?.primary||'')}</textarea></div>
     <div class="scn-field"><label>${en?'Secondary objective':'Objectif secondaire'}</label><textarea id="seObjSecondary" rows="2">${esc(d.objectives?.secondary||'')}</textarea></div>
   </section>

   <section class="scn-sec"><div class="scn-sectitle">10 · ${en?'End of Game':'Fin de Partie'}</div>
     <div class="scn-field"><label>${en?'End condition':'Condition de fin'}</label><textarea id="seEndCondition" rows="2">${esc(d.endCondition||'')}</textarea></div>
   </section>

   <section class="scn-sec"><div class="scn-sectitle">11 · ${en?'Victory':'Victoire'}</div>
     <div class="scn-row3">
       <div class="scn-field"><label>${en?'Major':'Majeure'}</label><textarea id="seVictoryMajor" rows="2">${esc(d.victory?.major||'')}</textarea></div>
       <div class="scn-field"><label>${en?'Minor':'Mineure'}</label><textarea id="seVictoryMinor" rows="2">${esc(d.victory?.minor||'')}</textarea></div>
       <div class="scn-field"><label>${en?'Draw':'Match nul'}</label><textarea id="seVictoryDraw" rows="2">${esc(d.victory?.draw||'')}</textarea></div>
     </div>
   </section>

   <section class="scn-sec"><div class="scn-sectitle">12 · ${en?'Rewards':'Récompenses'}</div>
     <div class="scn-field"><label>${en?'One per line':'Une par ligne'}</label><textarea id="seRewards" rows="3">${esc(listToLines(d.rewards))}</textarea></div>
   </section>

   ${adminScenarioEditId&&adminScenarioEditData?.status?`<section class="scn-sec"><div class="scn-sectitle">${en?'Publishing':'Publication'}</div><div style="display:flex;gap:8px;align-items:center"><span class="chip">${adminScenarioEditData.status==='draft'?(en?'DRAFT':'BROUILLON'):(en?'PUBLISHED':'PUBLIÉ')}</span><button type="button" class="button secondary" onclick="setScenarioStatus('${esc(adminScenarioEditId)}','${adminScenarioEditData.status==='draft'?'published':'draft'}')">${adminScenarioEditData.status==='draft'?(en?'Publish':'Publier'):(en?'Unpublish':'Dépublier')}</button>${adminScenarioEditData.status==='draft'?`<button type="button" class="equipment-action remove" onclick="confirmDeleteScenario('${esc(adminScenarioEditId)}')">🗑 ${en?'Delete':'Supprimer'}</button>`:''}</div></section>`:''}

  </div>`;
}
function openHubEventEditor(cid,eid){
  const en=siteLanguage==='en';const c=campaignDetailCache.get(cid);if(!c)return;const e=(c.definition?.events||[]).find(x=>x.id===eid)||{title:'',when:'',text:''};
  openModal(`<div class="wc-dialog"><div class="eyebrow">${esc(c.name)} · ${en?'EVENT':'ÉVÉNEMENT'}</div><h2>${eid?esc(e.title):(en?'New event':'Nouvel événement')}</h2><label class="custom-field"><span>${en?'Title':'Titre'}</span><input id="evTitle" value="${esc(e.title)}"></label><label class="custom-field"><span>${en?'When (e.g. this round, until 12/11)':'Quand (ex. ce tour, jusqu’au 12/11)'}</span><input id="evWhen" value="${esc(e.when||'')}"></label><label class="custom-field"><span>${en?'What changes':'Ce qui change'}</span><textarea id="evText" rows="5">${esc(e.text||'')}</textarea></label><div class="custom-actions"><button type="button" class="button primary" onclick="saveHubEvent('${esc(cid)}','${esc(eid||'')}')">${en?'Save':'Enregistrer'}</button>${eid?`<button type="button" class="button danger" onclick="deleteHubEvent('${esc(cid)}','${esc(eid)}')">${en?'Delete':'Supprimer'}</button>`:''}<button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
function openHubFavoredEditor(cid){
  const en=siteLanguage==='en';const c=campaignDetailCache.get(cid);if(!c)return;const f=c.definition?.favoredScenario||{};
  openModal(`<div class="wc-dialog"><div class="eyebrow">${esc(c.name)}</div><h2>${en?'Favoured scenario':'Scénario favori'}</h2><label class="custom-field"><span>${en?'Scenario':'Scénario'}</span><select id="favId"><option value="">${en?'— none —':'— aucun —'}</option>${(SCENARIOS_CACHE||[]).map(s=>`<option value="${esc(s.id)}" ${s.id===f.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label class="custom-field"><span>${en?'Note (bonus, why…)':'Note (bonus, pourquoi…)'}</span><input id="favNote" value="${esc(f.note||'')}"></label><div class="custom-actions"><button type="button" class="button primary" onclick="saveHubFavored('${esc(cid)}')">${en?'Save':'Enregistrer'}</button><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
function openCampMapEditor(cid){const c=campaignDetailCache.get(cid);if(!c)return;const m=campMapOf(c);
  campMapEd={cid,map:m?JSON.parse(JSON.stringify({image:m.image,w:m.w,h:m.h,pins:m.pins||[],paths:m.paths||[]})):{image:'',w:4,h:3,pins:[],paths:[]},mode:'pins',sel:null,from:null,busy:false};
  openModal(`<div class="wc-dialog cmap-editor" id="cmapEd"></div>`);modalSticky=true;campMapEdRender()}
function campMapEdRender(){const box=document.getElementById('cmapEd');if(!box||!campMapEd)return;const en=siteLanguage==='en';const E=campMapEd;const c=campaignDetailCache.get(E.cid);if(!c)return;const m=E.map;
  const sts=c.definition?.settlements||[];const placed=new Map((m.pins||[]).filter(p=>p.sid).map(p=>[p.sid,p]));
  const head=`<div class="eyebrow">${esc(c.name)} · ${en?'MAP':'CARTE'}</div><div class="cmap-ed-bar"><label class="button secondary small cmap-file">🖼 ${m.image?(en?'Change the picture':'Changer l’image'):(en?'Choose the picture':'Choisir l’image')}<input type="file" accept="image/*" onchange="campMapEdImage(this)" hidden></label>${m.image?`<div class="cmap-modes"><button type="button" class="button ${E.mode==='pins'?'primary':'secondary'} small" onclick="campMapEdMode('pins')">📍 ${en?'Places':'Lieux'}</button><button type="button" class="button ${E.mode==='paths'?'primary':'secondary'} small" onclick="campMapEdMode('paths')">〰 ${en?'Paths':'Chemins'}</button></div>`:''}${E.busy?`<span class="muted">${en?'Preparing the picture…':'Préparation de l’image…'}</span>`:''}</div>`;
  if(!m.image){box.innerHTML=`${head}<div class="cmap-empty">${en?'Choose a picture of the map (JPG, PNG or WebP). It is resized and compressed automatically.':'Choisis une image de la carte (JPG, PNG ou WebP). Elle est redimensionnée et compressée automatiquement.'}</div><div class="custom-actions"><button type="button" class="button secondary" onclick="campMapEdClose()">${en?'Cancel':'Annuler'}</button></div>`;return}
  const pin=E.sel&&(m.pins||[]).find(p=>p.id===E.sel);const path=E.sel&&(m.paths||[]).find(p=>p.id===E.sel);
  const pinName=p=>p.sid?(sts.find(s=>s.id===p.sid)?.name||'?'):(p.name||'?');
  let side='';
  if(E.mode==='pins'){
    const help=E.sel&&!pin?`<p class="cmap-help on">${en?'Tap the map where this place goes.':'Touche la carte à l’endroit de ce lieu.'}</p>`:`<p class="cmap-help">${en?'Pick a place, then tap the map. Drag a pin to move it.':'Choisis un lieu, puis touche la carte. Fais glisser un repère pour le déplacer.'}</p>`;
    const rows=sts.map(s=>{const p=placed.get(s.id);const on=E.sel===(p?p.id:'new:'+s.id);return `<button type="button" class="cmap-row${on?' sel':''}" onclick="campMapEdSelect('${p?esc(p.id):'new:'+esc(s.id)}')"><span>🏘 ${esc(s.name)}</span><small>${p?(en?'placed ✓':'placé ✓'):(en?'to place':'à placer')}</small></button>`}).join('');
    const free=(m.pins||[]).filter(p=>!p.sid).map(p=>`<button type="button" class="cmap-row${E.sel===p.id?' sel':''}" onclick="campMapEdSelect('${esc(p.id)}')"><span>📍 ${esc(p.name||'?')}</span><small>${en?'other place':'autre lieu'}</small></button>`).join('');
    const pend=E.sel&&E.sel.startsWith('free:')?`<button type="button" class="cmap-row sel"><span>📍 ${esc(E.sel.slice(5))}</span><small>${en?'to place':'à placer'}</small></button>`:'';
    const detail=pin?`<div class="cmap-detail">${pin.sid?'':`<label class="custom-field"><span>${en?'Name':'Nom'}</span><input value="${esc(pin.name||'')}" oninput="campMapEdPinField('name',this.value)"></label>`}<label class="custom-field"><span>${en?'Note shown on tap (optional)':'Note affichée au toucher (optionnel)'}</span><input value="${esc(pin.note||'')}" oninput="campMapEdPinField('note',this.value)"></label><button type="button" class="button secondary small" onclick="campMapEdRemovePin()">${en?'Remove from the map':'Retirer de la carte'}</button></div>`:'';
    side=`${help}<div class="micro-label">${en?'SETTLEMENTS':'COLONIES'}</div>${rows||`<p class="muted">${en?'No settlement in this campaign yet.':'Aucune colonie dans cette campagne.'}</p>`}<div class="micro-label" style="margin-top:10px">${en?'OTHER PLACES':'AUTRES LIEUX'}</div>${free}${pend}<button type="button" class="button secondary small" onclick="campMapEdAddFree()">＋ ${en?'Other place (ruin, temple…)':'Autre lieu (ruine, temple…)'}</button>${detail}`;
  }else{
    const help=`<p class="cmap-help${E.from?' on':''}">${E.from?(en?`From ${esc(pinName((m.pins||[]).find(p=>p.id===E.from)||{}))}: tap the place to link it to.`:`Depuis ${esc(pinName((m.pins||[]).find(p=>p.id===E.from)||{}))} : touche le lieu à relier.`):(en?'Tap a place, then another one to draw a path between them.':'Touche un lieu, puis un autre pour tracer un chemin entre eux.')}</p>`;
    const rows=(m.paths||[]).map(p=>{const a=(m.pins||[]).find(x=>x.id===p.a),b=(m.pins||[]).find(x=>x.id===p.b);if(!a||!b)return '';return `<button type="button" class="cmap-row${E.sel===p.id?' sel':''}" onclick="campMapEdSelect('${esc(p.id)}')"><span>${esc(pinName(a))} — ${esc(pinName(b))}</span><small>${esc(CAMPMAP_PATH_STYLES[p.style]?.[en?0:1]||'')}${p.label?' · '+esc(p.label):''}</small></button>`}).join('');
    const detail=path?`<div class="cmap-detail"><label class="custom-field"><span>${en?'Kind':'Type'}</span><select onchange="campMapEdPathField('style',this.value)">${Object.entries(CAMPMAP_PATH_STYLES).map(([k,l])=>`<option value="${k}" ${path.style===k?'selected':''}>${l[en?0:1]}</option>`).join('')}</select></label><label class="custom-field"><span>${en?'Label (e.g. 2 days)':'Étiquette (ex. 2 jours)'}</span><input value="${esc(path.label||'')}" oninput="campMapEdPathField('label',this.value)"></label><label class="custom-field"><span>${en?'Curve':'Courbure'}</span><input type="range" min="-1" max="1" step="0.1" value="${Number(path.bend)||0}" oninput="campMapEdPathField('bend',Number(this.value))"></label><button type="button" class="button secondary small" onclick="campMapEdRemovePath()">${en?'Delete this path':'Supprimer ce chemin'}</button></div>`:'';
    side=`${help}<div class="micro-label">${en?'PATHS':'CHEMINS'}</div>${rows||`<p class="muted">${en?'No path yet.':'Aucun chemin pour l’instant.'}</p>`}${detail}`;
  }
  box.innerHTML=`${head}<div class="cmap-ed-body"><div class="cmap-ed-stage">${campMapMarkup(c,m,{edit:true,sel:E.sel,from:E.from})}</div><aside class="cmap-ed-side">${side}</aside></div><div class="custom-actions"><button type="button" class="button primary" onclick="campMapEdSave()">${en?'Save the map':'Enregistrer la carte'}</button>${campMapOf(c)?`<button type="button" class="button danger" onclick="campMapEdDelete()">${en?'Delete the map':'Supprimer la carte'}</button>`:''}<button type="button" class="button secondary" onclick="campMapEdClose()">${en?'Cancel':'Annuler'}</button></div>`;
  campMapEdBind()}
function campMapEdMode(k){if(!campMapEd)return;campMapEd.mode=k;campMapEd.sel=null;campMapEd.from=null;campMapEdRender()}
function campMapEdSelect(id){if(!campMapEd)return;campMapEd.sel=campMapEd.sel===id?null:id;campMapEdRender()}
async function campMapEdAddFree(){const en=siteLanguage==='en';const n=await sitePrompt(en?'Name of the place':'Nom du lieu','');const name=String(n||'').trim().slice(0,60);if(!name||!campMapEd)return;campMapEd.mode='pins';campMapEd.sel='free:'+name;campMapEdRender()}
function campMapEdPinField(k,v){const p=campMapEd&&(campMapEd.map.pins||[]).find(x=>x.id===campMapEd.sel);if(!p)return;p[k]=String(v).slice(0,k==='note'?200:60);const el=document.querySelector(`#cmapStage [data-pin="${CSS.escape(p.id)}"] .cmap-name`);if(el&&k==='name')el.textContent=p[k]}
function campMapEdPathField(k,v){const p=campMapEd&&(campMapEd.map.paths||[]).find(x=>x.id===campMapEd.sel);if(!p)return;p[k]=k==='label'?String(v).slice(0,40):v;if(k==='label'){clearTimeout(campMapEdPathField.t);campMapEdPathField.t=setTimeout(campMapEdRender,500)}else campMapEdRender()}
function campMapEdRemovePin(){const E=campMapEd;if(!E)return;const id=E.sel;E.map.pins=(E.map.pins||[]).filter(p=>p.id!==id);E.map.paths=(E.map.paths||[]).filter(p=>p.a!==id&&p.b!==id);E.sel=null;campMapEdRender()}
function campMapEdRemovePath(){const E=campMapEd;if(!E)return;E.map.paths=(E.map.paths||[]).filter(p=>p.id!==E.sel);E.sel=null;campMapEdRender()}
function campMapEdBind(){const stage=document.getElementById('cmapStage');if(!stage||!campMapEd)return;let drag=null;
  stage.addEventListener('pointerdown',ev=>{const E=campMapEd;if(!E)return;const pinEl=ev.target.closest('[data-pin]');
    if(E.mode==='paths'){if(!pinEl)return;ev.preventDefault();const id=pinEl.dataset.pin;if(!E.from||E.from===id){E.from=E.from===id?null:id;E.sel=null;campMapEdRender();return}
      const a=E.from,b=id;const ex=(E.map.paths||[]).find(p=>(p.a===a&&p.b===b)||(p.a===b&&p.b===a));if(ex){E.sel=ex.id}else{const np={id:'w'+Math.random().toString(36).slice(2,8),a,b,style:'road',label:'',bend:0};E.map.paths=[...(E.map.paths||[]),np];E.sel=np.id}E.from=null;campMapEdRender();return}
    if(pinEl){ev.preventDefault();const id=pinEl.dataset.pin;drag={id,el:pinEl,moved:false};E.sel=id;try{stage.setPointerCapture(ev.pointerId)}catch(e){}return}
    const s=E.sel;if(!s)return;const pos=campMapPct(stage,ev);
    if(s.startsWith('new:')){const sid=s.slice(4);const np={id:'s'+sid,sid,x:pos.x,y:pos.y};E.map.pins=[...(E.map.pins||[]).filter(p=>p.sid!==sid),np];E.sel=np.id}
    else if(s.startsWith('free:')){const np={id:'p'+Math.random().toString(36).slice(2,8),name:s.slice(5),note:'',x:pos.x,y:pos.y};E.map.pins=[...(E.map.pins||[]),np];E.sel=np.id}
    else{const p=(E.map.pins||[]).find(x=>x.id===s);if(p){p.x=pos.x;p.y=pos.y}}
    campMapEdRender()});
  stage.addEventListener('pointermove',ev=>{if(!drag||!campMapEd)return;const pos=campMapPct(stage,ev);const p=(campMapEd.map.pins||[]).find(x=>x.id===drag.id);if(!p)return;p.x=pos.x;p.y=pos.y;drag.moved=true;drag.el.style.left=pos.x+'%';drag.el.style.top=pos.y+'%'});
  const end=()=>{if(!drag)return;drag=null;campMapEdRender()};stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end)}
async function campMapEdImage(input){const en=siteLanguage==='en';const f=input?.files?.[0];if(!f||!campMapEd)return;campMapEd.busy=true;campMapEdRender();
  try{const raw=await campMapReadFile(f);let best=raw.length<=1400000&&/^data:image\/(webp|jpeg|png)/.test(raw)?raw:null;
    for(const [max,q] of [[2400,0.82],[2000,0.78],[1600,0.74],[1300,0.7]]){if(best&&best.length<=1400000&&best!==raw)break;const out=await imgShrink(best&&best!==raw?best:raw,max,q);if(out&&(!best||out.length<best.length))best=out;if(best&&best.length<=1400000)break}
    if(!best||best.length>1400000){toast(en?'This picture is too big even once compressed':'Cette image reste trop lourde une fois compressée');return}
    const sz=await campMapImgSize(best);if(!sz){toast(en?'Could not read this picture':'Impossible de lire cette image');return}
    campMapEd.map.image=best;campMapEd.map.w=sz.w;campMapEd.map.h=sz.h}
  catch(e){toast(en?'Could not read this picture':'Impossible de lire cette image')}
  finally{if(campMapEd){campMapEd.busy=false;campMapEdRender()}}}
function campMapEdClose(){campMapEd=null;modalSticky=false;closeModal()}
async function campMapEdSave(){const en=siteLanguage==='en';const E=campMapEd;if(!E||!E.map.image)return;const cid=E.cid;
  const map={image:E.map.image,w:Number(E.map.w)||4,h:Number(E.map.h)||3,pins:(E.map.pins||[]).map(p=>p.sid?{id:p.id,sid:p.sid,x:p.x,y:p.y,...(p.note?{note:p.note}:{})}:{id:p.id,name:p.name||'?',x:p.x,y:p.y,...(p.note?{note:p.note}:{})}),paths:(E.map.paths||[]).map(p=>({id:p.id,a:p.a,b:p.b,style:CAMPMAP_PATH_STYLES[p.style]?p.style:'road',...(p.label?{label:p.label}:{}),...(Number(p.bend)?{bend:Number(p.bend)}:{})}))};
  if(await campMapSaveDef(cid,def=>{def.map=map})){campMapEdClose();toast(en?'Map saved':'Carte enregistrée');renderCurrentRoute()}}
async function campMapEdDelete(){const en=siteLanguage==='en';const E=campMapEd;if(!E)return;if(!await siteConfirm(en?'Delete the map of this campaign?':'Supprimer la carte de cette campagne ?'))return;if(await campMapSaveDef(E.cid,def=>{delete def.map})){campMapEdClose();renderCurrentRoute()}}
async function hubAdminConfirm(bid){const en=siteLanguage==='en';const b=(campaignBattlesCache.get(currentHubId)||[]).find(x=>x.id===bid);if(!b)return;try{await window.MordheimundaAPI.adminCampaignBattleSave(currentHubId,bid,{...b,status:'confirmed'});campaignBattlesCache.delete(currentHubId);render('campaignHub')}catch(e){toast(authError(e,en))}}
async function importLustriaConditions(cid){const en=siteLanguage==='en';if(await saveCampaignDefinition(cid,def=>{const cd=ensureConditionsData(def);cd.enabled=true;if(!def.scenarioTable)def.scenarioTable={...JSON.parse(JSON.stringify(LUSTRIA_SCENARIO_TABLE)),enabled:true}}))toast(en?'Play conditions on':'Conditions en Play activées')}
// Admin: enable the Lustria chart on a campaign.
async function importLustriaExploration(cid){const en=siteLanguage==='en';if(await saveCampaignDefinition(cid,def=>{const ex=ensureExplorationData(def);ex.enabled=true}))toast(en?'Campaign post-battle on: Wyrdstone becomes Treasure for this campaign':'Post-bataille de campagne active : le Wyrdstone devient Treasure pour cette campagne')}
async function importLustriaRulePages(cid){const en=siteLanguage==='en';if(!await siteConfirm(en?'Load the Lustria rule pages? Pages with the same number are replaced by the Lustria text; your other pages are kept.':'Charger les pages de règles de Lustria ? Les pages de même numéro sont remplacées par le texte de Lustria ; tes autres pages sont conservées.'))return;if(await saveCampaignDefinition(cid,def=>applyLustriaRulePages(def,true)))toast(en?'Rule pages loaded':'Pages de règles chargées')}
function openExplorationEntryEditor(cid,k){
  const en=siteLanguage==='en';const c=campaignDetailCache.get(cid);if(!c)return;const list=campaignExplorationData(c)||lustriaExplorationDefaults();const e=list.find(x=>x.k===k)||{k:'',name:'',text:'',items:[]};const [t,f]=(e.k||'2-1').split('-');
  const sel=(idv,opts,v)=>`<select id="${idv}">${opts.map(([val,l])=>`<option value="${val}" ${String(val)===String(v)?'selected':''}>${l}</option>`).join('')}</select>`;
  openModal(`<div class="wc-dialog campaign-page-editor"><div class="eyebrow">${esc(c.name)} · ${en?'EXPLORATION CHART':'TABLE D’EXPLORATION'}</div><h2>${k?esc(e.name):(en?'New result':'Nouveau résultat')}</h2>
   <div class="form-grid"><label class="custom-field"><span>${en?'Multiple':'Multiple'}</span>${sel('exTier',CHART_TIERS.map(x=>[x[0],en?x[1]:x[2]]),t)}</label><label class="custom-field"><span>${en?'Face':'Face'}</span>${sel('exFace',[1,2,3,4,5,6].map(v=>[v,v]),f)}</label></div>
   <label class="custom-field"><span>${en?'Name':'Nom'}</span><input id="exName" value="${esc(e.name)}"></label>
   <label class="custom-field"><span>${en?'Rules text (what players read)':'Texte de règle (ce que lisent les joueurs)'}</span><textarea id="exText" rows="6">${esc(e.text||'')}</textarea></label>
   <div class="micro-label" style="margin:10px 0 4px">${en?'WHAT THE APP GIVES WHEN RESOLVED':'CE QUE L’APPLI DONNE À LA RÉSOLUTION'}</div>
   <label class="custom-field"><span>${en?'Items — one per line: Name | Base catalogue item | resale | quantity | note':'Objets — un par ligne : Nom | Objet de base du catalogue | revente | quantité | note'}</span><textarea id="exItems" rows="3" placeholder="Obsidian Shield | Shield | 4D6">${esc(chartItemsToLines(e.items))}</textarea></label>
   <label class="custom-field"><span>${en?'D6 table — one row per line: 1-2: Name | Base | resale | qty ; Name | …':'Table D6 — une ligne par résultat : 1-2: Nom | Base | revente | qté ; Nom | …'}</span><textarea id="exTable" rows="3" placeholder="1-2: Short bow | Short bow | | D3">${esc((e.table||[]).map(r=>`${r[0]===r[1]?r[0]:r[0]+'-'+r[1]}: ${(r[2]||[]).map(i=>chartItemsToLines([i])).join(' ; ')}`).join('\n'))}</textarea></label>
   <label class="custom-field"><span>${en?'Rolls needed — one per line: 4+: Name | Base | resale | qty   or   4+: Treasure D3':'Jets à réussir — un par ligne : 4+: Nom | Base | revente | qté   ou   4+: Treasure D3'}</span><textarea id="exChecks" rows="3" placeholder="5+: Duelling Pistol | Duelling Pistol">${esc((e.checks||[]).map(ch=>`${ch.need}+: ${ch.treasure?`Treasure ${ch.treasure}`:(ch.items||[]).map(i=>chartItemsToLines([i])).join(' ; ')}`).join('\n'))}</textarea></label>
   <div class="form-grid"><label class="custom-field"><span>${en?'Gold (formula, e.g. D6x10)':'Or (formule, ex. D6x10)'}</span><input id="exGold" value="${esc(e.gold||'')}"></label><label class="custom-field"><span>${en?'Treasure (formula, e.g. D3)':'Treasure (formule, ex. D3)'}</span><input id="exTreasure" value="${esc(e.treasure||'')}"></label></div>
   <div class="form-grid"><label class="custom-field"><span>${en?'Bonus kept by the warband (name)':'Bonus gardé par la bande (nom)'}</span><input id="exBonusLabel" value="${esc(e.bonus?.label||'')}"></label><label class="custom-field"><span>${en?'Bonus description':'Description du bonus'}</span><input id="exBonusText" value="${esc(e.bonus?.description||'')}"></label></div>
   <label class="custom-field"><span>${en?'Artifact rolls given by this result (0 = none)':'Jets d’artefact donnés par ce résultat (0 = aucun)'}</span><input id="exArtifacts" type="number" min="0" max="5" step="1" value="${Number(e.artifacts||0)}"></label>
   <label class="custom-check"><input type="checkbox" id="exTrap" ${e.trap?'checked':''}><span>${en?'Danger for the leading Hero (needs a leading Hero)':'Danger pour le Héros meneur (demande un Héros meneur)'}</span></label>
   <label class="custom-check"><input type="checkbox" id="exPool" ${e.pool?'checked':''}><span>${en?'Pool of Insight effect (+D6 XP once, Old Battle Wound, refusal roll next battle)':'Effet Pool of Insight (+D6 XP une fois, Old Battle Wound, jet de refus à la prochaine bataille)'}</span></label>
   <div class="custom-actions"><button type="button" class="button primary" onclick="saveExplorationEntry('${esc(cid)}','${esc(k||'')}')">${en?'Save':'Enregistrer'}</button>${k?`<button type="button" class="button danger" onclick="deleteExplorationEntry('${esc(cid)}','${esc(k)}')">${en?'Delete':'Supprimer'}</button>`:''}<button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
function openHazardEditor(cid,roll){
  const en=siteLanguage==='en';const c=campaignDetailCache.get(cid);if(!c)return;const list=campaignConditionsData(c)?.hazards||lustriaHazardDefaults();const h=list.find(x=>String(x.roll)===String(roll))||{roll:'',name:'',text:''};
  openModal(`<div class="wc-dialog campaign-page-editor"><div class="eyebrow">${esc(c.name)} · ${en?'HAZARDS':'DANGERS'}</div><h2>${roll?esc(h.name):(en?'New hazard':'Nouveau danger')}</h2>
   <div class="form-grid"><label class="custom-field"><span>3D6</span><input id="hzRoll" type="number" min="3" max="18" value="${esc(h.roll)}"></label><label class="custom-field"><span>${en?'Name':'Nom'}</span><input id="hzName" value="${esc(h.name)}"></label><label class="custom-field"><span>${en?'Number of creatures (formula, e.g. D3+1)':'Nombre de créatures (formule, ex. D3+1)'}</span><input id="hzCount" value="${esc(h.count||'')}"></label></div>
   <label class="custom-field"><span>${en?'Rules text':'Texte de règle'}</span><textarea id="hzText" rows="6">${esc(h.text||'')}</textarea></label>
   <label class="custom-field"><span>${en?'Profile M WS BS S T W I A Ld (Cl/Wil/Int = Ld) — empty if none':'Profil M WS BS S T W I A Ld (Cl/Wil/Int = Ld) — vide si aucun'}</span><input id="hzProfile" value="${esc((h.profile||[]).join(' '))}" placeholder="5 2 0 2 2 1 5 1 4"></label>
   <div class="custom-actions"><button type="button" class="button primary" onclick="saveHazard('${esc(cid)}','${esc(String(roll||''))}')">${en?'Save':'Enregistrer'}</button>${roll?`<button type="button" class="button danger" onclick="deleteHazard('${esc(cid)}','${esc(String(roll))}')">${en?'Delete':'Supprimer'}</button>`:''}<button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
function openWeatherEditor(cid,min){
  const en=siteLanguage==='en';const c=campaignDetailCache.get(cid);if(!c)return;const list=campaignConditionsData(c)?.weather||lustriaWeatherDefaults();const w=list.find(x=>String(x.min)===String(min))||{min:'',max:'',name:'',text:''};
  openModal(`<div class="wc-dialog campaign-page-editor"><div class="eyebrow">${esc(c.name)} · ${en?'WEATHER':'MÉTÉO'}</div><h2>${min?esc(w.name):(en?'New result':'Nouveau résultat')}</h2>
   <div class="form-grid"><label class="custom-field"><span>2D6 ${en?'from':'de'}</span><input id="wMin" type="number" min="2" max="12" value="${esc(w.min)}"></label><label class="custom-field"><span>${en?'to':'à'}</span><input id="wMax" type="number" min="2" max="12" value="${esc(w.max)}"></label><label class="custom-field"><span>${en?'Name':'Nom'}</span><input id="wName" value="${esc(w.name)}"></label></div>
   <label class="custom-field"><span>${en?'Rules text':'Texte de règle'}</span><textarea id="wText" rows="5">${esc(w.text||'')}</textarea></label>
   <label class="custom-field"><span>${en?'Extra D6 rolled by the app — one per line: 1-3: effect (empty if none)':'D6 supplémentaire lancé par l’appli — un par ligne : 1-3: effet (vide si aucun)'}</span><textarea id="wSub" rows="3">${esc((w.sub||[]).map(s=>`${s[0]===s[1]?s[0]:s[0]+'-'+s[1]}: ${s[2]}`).join('\n'))}</textarea></label>
   <div class="custom-actions"><button type="button" class="button primary" onclick="saveWeather('${esc(cid)}','${esc(String(min||''))}')">${en?'Save':'Enregistrer'}</button>${min?`<button type="button" class="button danger" onclick="deleteWeather('${esc(cid)}','${esc(String(min))}')">${en?'Delete':'Supprimer'}</button>`:''}<button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
function openScenarioTableEditor(cid){
  const en=siteLanguage==='en';const c=campaignDetailCache.get(cid);if(!c)return;const t=c.definition?.scenarioTable||LUSTRIA_SCENARIO_TABLE;const rows=Array.from({length:11},(_,i)=>i+2);
  openModal(`<div class="wc-dialog campaign-page-editor"><div class="eyebrow">${esc(c.name)} · ${en?'SCENARIO TABLES':'TABLES DE SCÉNARIOS'}</div><h2>${en?'Scenario tables (2D6)':'Tables de scénarios (2D6)'}</h2><p class="sheet-help">${en?'Write the exact name of a published scenario to link it (use " / " for a choice of two).':'Écris le nom exact d’un scénario publié pour le lier (« / » pour un choix entre deux).'}</p>
   <div class="rule-table-wrap"><table class="rule-table"><tr><th>2D6</th><th>${en?'Two players':'Deux joueurs'}</th><th>${en?'Multiplayer':'Multijoueur'}</th></tr>${rows.map(n=>`<tr><td>${n}</td><td><input class="sct-two" data-n="${n}" value="${esc(t.two?.[n]||'')}"></td><td><input class="sct-multi" data-n="${n}" value="${esc(t.multi?.[n]||'')}"></td></tr>`).join('')}</table></div>
   <div class="custom-actions"><button type="button" class="button primary" onclick="saveScenarioTable('${esc(cid)}')">${en?'Save':'Enregistrer'}</button><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
async function importLustriaScenarioTable(cid){await saveCampaignDefinition(cid,def=>{if(def.scenarioTable)def.scenarioTable.enabled=true;else def.scenarioTable={...JSON.parse(JSON.stringify(LUSTRIA_SCENARIO_TABLE)),enabled:true}})}
// V-CAMPAIGNPAGEEDIT: edit the presentation or one rule page in place.
function openCampaignPageEditor(cid,pid){
  const en=siteLanguage==='en';const c=campaignDetailCache.get(cid);if(!c)return;
  const isOverview=pid==='overview';const pg=isOverview?null:(c.definition?.pages||[]).find(p=>(p.id||'')===pid);
  if(!isOverview&&!pg)return;
  const text=isOverview?(c.definition?.description||''):(pg.text||'');
  openModal(`<div class="wc-dialog campaign-page-editor"><div class="eyebrow">${esc(c.name)}</div><h2>${isOverview?(en?'Presentation':'Présentation'):(en?'Edit page':'Modifier la page')}</h2>${isOverview?'':`<label class="custom-field"><span>${en?'Page title':'Titre de la page'}</span><input id="cpTitle" value="${esc(pg.title||'')}"></label>`}<label class="custom-field"><span>${en?'Text (same formatting as the rules: • bullets, [SUBHEAD]…, [TABLE]…, [ITEMS]…, [IMG]…)':'Texte (même mise en forme que les règles : • puces, [SUBHEAD]…, [TABLE]…, [ITEMS]…, [IMG]…)'}</span><p class="sheet-help">${en?'Tables used by the app are inserted with [CHART exploration], [CHART hazards], [CHART weather], [CHART scenarios] or [CHART settlements]. Edit their entries with the ✎ next to each one on the page: what you change there is what the app applies.':'Les tables utilisées par l’appli s’insèrent avec [CHART exploration], [CHART hazards], [CHART weather], [CHART scenarios] ou [CHART settlements]. Modifie leurs entrées avec le ✎ à côté de chacune sur la page : ce que tu changes là est ce que l’appli applique.'}</p>${ruleEditToolbarMarkup('',en?'Same tools as the rules editor. A line like 1. MAKE A WOUND ROLL becomes a numbered step title.':'Mêmes outils que l’éditeur de règles. Une ligne comme 1. MAKE A WOUND ROLL devient un titre d’étape numéroté.')}<textarea id="ruleEditTextarea" rows="18" style="width:100%;font-family:ui-monospace,monospace;font-size:12.5px">${esc(text)}</textarea></label><div class="custom-actions"><button type="button" class="button primary" onclick="saveCampaignPageEditor('${esc(cid)}','${esc(pid)}')">${en?'Save':'Enregistrer'}</button><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
async function saveCampaignPageEditor(cid,pid){
  const text=$('#ruleEditTextarea')?.value||'';const title=($('#cpTitle')?.value||'').trim();
  if(await saveCampaignDefinition(cid,def=>{if(pid==='overview'){def.description=text;return}def.pages=(def.pages||[]).map(p=>(p.id||'')===pid?{...p,title:title||p.title,text}:p)}))closeModal();
}
function openCampaignArtifactEditor(cid,aid){
  const en=siteLanguage==='en';const c=campaignDetailCache.get(cid);if(!c)return;
  const a=(c.definition?.artifacts||[]).find(x=>x.id===aid)||{table:'minor',roll:'',name:'',base:'',lore:'',rules:''};
  openModal(`<div class="wc-dialog"><div class="eyebrow">${en?'ARTIFACT':'ARTEFACT'}</div><h2>${aid?esc(a.name):(en?'New artifact':'Nouvel artefact')}</h2>
   <div class="form-grid"><label class="custom-field"><span>${en?'Table':'Table'}</span><select id="artTable"><option value="minor" ${a.table!=='major'?'selected':''}>${en?'Minor':'Mineur'}</option><option value="major" ${a.table==='major'?'selected':''}>${en?'Major':'Majeur'}</option></select></label><label class="custom-field"><span>4D6</span><input id="artRoll" value="${esc(a.roll||'')}" placeholder="10-11"></label></div>
   <label class="custom-field"><span>${en?'Name':'Nom'}</span><input id="artName" value="${esc(a.name||'')}"></label>
   <label class="custom-field"><span>${en?'Counts as (catalogue item — empty for a special item)':'Compte comme (objet du catalogue — vide pour un objet spécial)'}</span><input id="artBase" list="artBaseNames" value="${esc(a.base||'')}" placeholder="Sword, Heavy armour…"><datalist id="artBaseNames">${campaignArtifactBaseNames().map(n=>`<option value="${esc(n)}">`).join('')}</datalist></label>
   <label class="custom-field"><span>${en?'Story':'Histoire'}</span><textarea id="artLore" rows="3">${esc(a.lore||'')}</textarea></label>
   <label class="custom-field"><span>${en?'Rules (same formatting as rules text: • bullets, [TABLE]…)':'Règles (même mise en forme que les règles : • puces, [TABLE]…)'}</span><textarea id="artRules" rows="6">${esc(a.rules||'')}</textarea></label>
   <div class="custom-actions"><button type="button" class="button primary" onclick="saveCampaignArtifact('${esc(cid)}','${esc(aid||'')}')">${en?'Save':'Enregistrer'}</button>${aid?`<button type="button" class="button danger" onclick="deleteCampaignArtifact('${esc(cid)}','${esc(aid)}')">${en?'Delete':'Supprimer'}</button>`:''}<button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
async function saveCampaignArtifact(cid,aid){
  const en=siteLanguage==='en';const name=($('#artName')?.value||'').trim();if(!name){toast(en?'Give the artifact a name':'Donne un nom à l’artefact');return}
  const item={id:aid||crypto.randomUUID().slice(0,8),table:$('#artTable').value==='major'?'major':'minor',roll:($('#artRoll').value||'').trim(),name,base:($('#artBase').value||'').trim(),lore:$('#artLore').value||'',rules:$('#artRules').value||''};
  if(await saveCampaignDefinition(cid,def=>{def.artifacts=Array.isArray(def.artifacts)?def.artifacts:[];const i=def.artifacts.findIndex(x=>x.id===item.id);if(i>=0)def.artifacts[i]=item;else def.artifacts.push(item)})){closeModal();toast(en?'Artifact saved':'Artefact enregistré')}
}
async function saveCampaignArtifactsIntro(cid){const v=$('#artIntro')?.value||'';if(await saveCampaignDefinition(cid,def=>{def.artifactsIntro=v}))closeModal()}
async function importLustriaArtifacts(cid){
  const en=siteLanguage==='en';const c=campaignDetailCache.get(cid);if(!c)return;
  const have=new Set((c.definition?.artifacts||[]).map(a=>normName(a.name)));const todo=LUSTRIA_ARTIFACTS.filter(a=>!have.has(normName(a.name)));
  if(!todo.length){toast(en?'Every Lustria artifact is already here':'Tous les artefacts de Lustria sont déjà là');return}
  if(!await siteConfirm(en?`Add ${todo.length} Lustria artifacts to this campaign? You can edit each one afterwards.`:`Ajouter ${todo.length} artefacts de Lustria à cette campagne ? Tu pourras modifier chacun ensuite.`))return;
  if(await saveCampaignDefinition(cid,def=>{def.artifacts=[...(def.artifacts||[]),...todo.map(a=>({...a,id:crypto.randomUUID().slice(0,8)}))];if(!def.artifactsIntro)def.artifactsIntro=LUSTRIA_ARTIFACTS_INTRO}))toast(en?`${todo.length} artifacts imported`:`${todo.length} artefacts importés`);
}
function openSettlementEditor(cid,sid){
  const en=siteLanguage==='en';const c=campaignDetailCache.get(cid);if(!c)return;
  const st=(c.definition?.settlements||[]).find(x=>x.id===sid)||{name:'',excluded:[],newAllowed:true,tithe:0,market:{},hsUpkeep:{reduction:'',names:[]},notes:''};const m=st.market||{};const ex=new Set(st.excluded||[]);
  const num=(idv,label,v)=>`<label class="custom-field"><span>${label}</span><input id="${idv}" type="number" step="1" value="${Number(v||0)}"></label>`;
  const txt=(idv,label,v,ph)=>`<label class="custom-field"><span>${label}</span><input id="${idv}" value="${esc(v||'')}" placeholder="${esc(ph||'')}"></label>`;
  openModal(`<div class="wc-dialog campaign-page-editor"><div class="eyebrow">${esc(c.name)} · ${en?'SETTLEMENT':'COLONIE'}</div><h2>${sid?esc(st.name):(en?'New settlement':'Nouvelle colonie')}</h2>
   ${txt('stName',en?'Name':'Nom',st.name,'')}
   <div class="micro-label" style="margin:10px 0 6px">${en?'WHO MAY RESIDE HERE — unticked = excluded':'QUI PEUT RÉSIDER ICI — décoché = exclu'}</div>
   <div class="settle-checks">${campaignFactionOptions().map(o=>`<label class="custom-check"><input type="checkbox" class="stAllow" data-fid="${esc(o.id)}" ${ex.has(o.id)?'':'checked'}><span>${esc(o.name)}</span></label>`).join('')}</div>
   <label class="custom-check" style="margin-top:8px"><input type="checkbox" id="stNewAllowed" ${st.newAllowed===false?'':'checked'}><span>${en?'Warbands created later are allowed by default':'Les warbands créées plus tard sont autorisées par défaut'}</span></label>
   <div class="micro-label" style="margin:12px 0 6px">${en?'RESIDENTS\' MARKET':'MARCHÉ DES RÉSIDENTS'}</div>
   <div class="form-grid">${txt('stCommonPrice',en?'Common: price (e.g. -1D6)':'Common : prix (ex. -1D6)',m.commonPrice,'-1D6')}${num('stCommonFind',en?'Common: to find (roll modifier)':'Common : pour trouver (modif. du jet)',m.commonFind)}${txt('stRarePrice',en?'Rare: price (e.g. +D6x10)':'Rare : prix (ex. +D6x10)',m.rarePrice,'+D6x10')}${num('stRareFind',en?'Rare: to find (roll modifier)':'Rare : pour trouver (modif. du jet)',m.rareFind)}${num('stAllFind',en?'All items: to find':'Tous les objets : pour trouver',m.allFind)}${num('stTithe',en?'Tithe on each game\'s income (%)':'Dîme sur les revenus (%)',st.tithe)}</div>
   <div class="form-grid">${txt('stHsRed',en?'Hired Sword upkeep reduction (e.g. 1D6)':'Réduction d’entretien Hired Sword (ex. 1D6)',st.hsUpkeep?.reduction,'1D6')}${txt('stHsNames',en?'…for these Hired Swords (comma separated)':'…pour ces Hired Swords (séparés par des virgules)',(st.hsUpkeep?.names||[]).join(', '),'Pit Fighter, Ogre Bodyguard')}</div>
   <label class="custom-field"><span>${en?'Other rules (text)':'Autres règles (texte)'}</span><textarea id="stNotes" rows="4">${esc(st.notes||'')}</textarea></label>
   <div class="custom-actions"><button type="button" class="button primary" onclick="saveSettlement('${esc(cid)}','${esc(sid||'')}')">${en?'Save':'Enregistrer'}</button>${sid?`<button type="button" class="button danger" onclick="deleteSettlement('${esc(cid)}','${esc(sid)}')">${en?'Delete':'Supprimer'}</button>`:''}<button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
async function saveSettlement(cid,sid){
  const en=siteLanguage==='en';const name=($('#stName')?.value||'').trim();if(!name){toast(en?'Give the settlement a name':'Donne un nom à la colonie');return}
  const boxes=[...document.querySelectorAll('.stAllow')];const n=v=>Math.round(Number(v)||0);
  const item={id:sid||crypto.randomUUID().slice(0,8),name,excluded:boxes.filter(b=>!b.checked).map(b=>b.dataset.fid),known:boxes.map(b=>b.dataset.fid),newAllowed:!!$('#stNewAllowed')?.checked,tithe:Math.max(0,n($('#stTithe').value)),market:{commonPrice:($('#stCommonPrice').value||'').trim(),commonFind:n($('#stCommonFind').value),rarePrice:($('#stRarePrice').value||'').trim(),rareFind:n($('#stRareFind').value),allFind:n($('#stAllFind').value)},hsUpkeep:{reduction:($('#stHsRed').value||'').trim(),names:($('#stHsNames').value||'').split(',').map(x=>x.trim()).filter(Boolean)},notes:$('#stNotes').value||''};
  if(await saveCampaignDefinition(cid,def=>{def.settlements=Array.isArray(def.settlements)?def.settlements:[];const i=def.settlements.findIndex(x=>x.id===item.id);if(i>=0)def.settlements[i]=item;else def.settlements.push(item)})){closeModal();toast(en?'Settlement saved':'Colonie enregistrée')}
}
async function deleteSettlement(cid,sid){const en=siteLanguage==='en';if(!await siteConfirm(en?'Delete this settlement?':'Supprimer cette colonie ?'))return;if(await saveCampaignDefinition(cid,def=>{def.settlements=(def.settlements||[]).filter(x=>x.id!==sid)}))closeModal()}
function openOutsiderPenaltyEditor(cid){
  const en=siteLanguage==='en';const c=campaignDetailCache.get(cid);if(!c)return;const p=campaignOutsiderPenalty(c);
  openModal(`<div class="wc-dialog"><div class="eyebrow">${esc(c.name)}</div><h2>${en?'Warbands with no residence':'Bandes sans résidence'}</h2><p class="sheet-help">${en?'Applied to a warband that may reside in no settlement, when it buys from the campaign market. Common items count as Rare 4.':'Appliqué à une bande qui ne peut résider dans aucune colonie, quand elle achète au marché de la campagne. Les objets Common comptent comme Rare 4.'}</p><div class="form-grid"><label class="custom-field"><span>${en?'Availability penalty':'Pénalité de rareté'}</span><input id="penRarity" type="number" step="1" value="${p.rarity}"></label><label class="custom-field"><span>${en?'Price on purchases (%)':'Prix à l’achat (%)'}</span><input id="penPrice" type="number" step="1" value="${p.pricePct}"></label></div><div class="custom-actions"><button type="button" class="button primary" onclick="saveOutsiderPenalty('${esc(cid)}')">${en?'Save':'Enregistrer'}</button><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
async function importLustriaSettlements(cid){
  const en=siteLanguage==='en';const c=campaignDetailCache.get(cid);if(!c)return;
  const have=new Set((c.definition?.settlements||[]).map(x=>normName(x.name)));const todo=LUSTRIA_SETTLEMENTS.filter(x=>!have.has(normName(x.name)));
  if(!todo.length){toast(en?'Every Lustria settlement is already here':'Toutes les colonies de Lustria sont déjà là');return}
  const opts=campaignFactionOptions();
  const items=todo.map(t=>({id:crypto.randomUUID().slice(0,8),name:t.name,excluded:opts.filter(o=>t.excludeNames.some(k=>String(o.name).toLowerCase().includes(k))).map(o=>o.id),known:opts.map(o=>o.id),newAllowed:true,tithe:t.tithe,market:{...t.market},hsUpkeep:{reduction:t.hsUpkeep.reduction,names:t.hsUpkeep.names.slice()},notes:t.notes}));
  if(await saveCampaignDefinition(cid,def=>{def.settlements=[...(def.settlements||[]),...items];if(!def.outsiderPenalty)def.outsiderPenalty={rarity:4,pricePct:20}}))toast(en?`${items.length} settlements imported — check who may reside in each`:`${items.length} colonies importées — vérifie qui peut résider dans chacune`);
}
async function openCampaignEditor(id){
  const en=siteLanguage==='en';let c=null;
  if(id){try{c=(await window.MordheimundaAPI.adminCampaign(id))?.campaign}catch(e){toast(authError(e,en));return}}
  campaignEditorDraft={id:c?.id||null,pages:JSON.parse(JSON.stringify(Array.isArray(c?.definition?.pages)?c.definition.pages:[])),definition:c?.definition||{}};
  openModal(`<div class="admin-live-editor campaign-editor"><div class="eyebrow">${id?(en?'EDIT CAMPAIGN':'MODIFIER LA CAMPAGNE'):(en?'NEW CAMPAIGN':'NOUVELLE CAMPAGNE')}</div>
   <div class="custom-form-grid"><label class="custom-field wide"><span>${en?'Name':'Nom'}</span><input id="ceName" value="${esc(c?.name||'')}"></label><label class="custom-field"><span>${en?'Campaign colour':'Couleur de campagne'}</span><input id="ceColor" type="color" value="${esc(campaignColor(c))}"></label></div>
   <div class="camp-cover-edit"><div class="camp-cover-preview" id="ceCoverPreview">${campaignCoverEditPreview()}</div><div class="camp-cover-tools"><span class="micro-label">${en?'CAMPAIGN PICTURE · shown on Rules: Campaign':'IMAGE DE LA CAMPAGNE · affichée dans Règles : Campagne'}</span><div class="custom-actions" style="justify-content:flex-start"><button type="button" class="button secondary" onclick="pickCampaignCover()">🖼 ${en?'Choose a picture':'Choisir une image'}</button><button type="button" class="button secondary" onclick="clearCampaignCover()">${en?'Remove':'Retirer'}</button></div><label class="custom-field"><span>${en?'Part of the picture shown (top ↔ bottom)':'Partie de l’image affichée (haut ↔ bas)'}</span><input id="ceCoverPos" type="range" min="0" max="100" value="${Number(c?.definition?.cover?.pos??50)}" oninput="campaignCoverSetPos(this.value)"></label><label class="custom-check"><input type="checkbox" id="ceFeatured" ${c?.definition?.featured?'checked':''}><span>${en?'Feature it as the big card on Rules: Campaign':'La mettre en avant en grande carte dans Règles : Campagne'}</span></label></div></div>
   <label class="custom-field wide"><span>${en?'Presentation (overview page)':'Présentation (page d’accueil)'}</span><textarea id="ceDesc" class="wide-textarea" rows="5">${esc(c?.definition?.description||'')}</textarea></label>
   <div class="eyebrow" style="margin-top:12px">${en?'1 · OPTIONAL RULES — one page each':'1 · RÈGLES OPTIONNELLES — une page chacune'}</div><div id="cePages">${campaignEditorPagesMarkup()}</div>
   <button type="button" class="button secondary" onclick="campaignEditorAddPage()">＋ ${en?'Add a page':'Ajouter une page'}</button>
   <p class="sheet-help">${en?'Same formatting as Rules: The Game (ALL-CAPS lines become headings, [TABLE]…[/TABLE] blocks, etc.).':'Même mise en forme que Règles : Le Jeu (lignes EN MAJUSCULES = titres, blocs [TABLE]…[/TABLE], etc.).'}</p>
   <div class="custom-actions">${id&&c?.status==='draft'?`<button type="button" class="button danger-outline" onclick="deleteCampaign('${esc(id)}')">🗑 ${en?'Delete':'Supprimer'}</button>`:''}<button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" onclick="saveCampaignEditor()">${en?'Save':'Enregistrer'}</button></div></div>`);
}
function campaignEditorPagesMarkup(){const en=siteLanguage==='en';const pages=campaignEditorDraft?.pages||[];return pages.map((p,i)=>`<div class="campaign-editor-page" data-i="${i}"><div class="campaign-editor-page-head"><input class="cePageTitle" value="${esc(p.title||'')}" placeholder="${en?'Page title':'Titre de la page'}"><button type="button" class="equipment-action" title="${en?'Up':'Monter'}" onclick="campaignEditorMovePage(${i},-1)" ${i?'':'disabled'}>↑</button><button type="button" class="equipment-action" title="${en?'Down':'Descendre'}" onclick="campaignEditorMovePage(${i},1)" ${i<pages.length-1?'':'disabled'}>↓</button><button type="button" class="equipment-action remove" title="${en?'Remove':'Retirer'}" onclick="campaignEditorRemovePage(${i})">🗑</button></div><textarea class="cePageText wide-textarea" rows="6">${esc(p.text||'')}</textarea></div>`).join('')||`<p class="muted">${en?'No optional rule page yet.':'Aucune page de règle optionnelle.'}</p>`}
function campaignEditorSync(){if(!campaignEditorDraft)return;document.querySelectorAll('.campaign-editor-page').forEach(el=>{const p=campaignEditorDraft.pages[Number(el.dataset.i)];if(p){p.title=el.querySelector('.cePageTitle').value;p.text=el.querySelector('.cePageText').value}})}
function campaignEditorRefresh(){const box=$('#cePages');if(box)box.innerHTML=campaignEditorPagesMarkup()}
function campaignEditorAddPage(){campaignEditorSync();campaignEditorDraft.pages.push({id:crypto.randomUUID().slice(0,8),title:'',text:''});campaignEditorRefresh()}
function campaignEditorRemovePage(i){campaignEditorSync();campaignEditorDraft.pages.splice(i,1);campaignEditorRefresh()}
function campaignEditorMovePage(i,d){campaignEditorSync();const a=campaignEditorDraft.pages,j=i+d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];campaignEditorRefresh()}
async function saveCampaignEditor(){
  const en=siteLanguage==='en';campaignEditorSync();const d=campaignEditorDraft;if(!d)return;
  const name=($('#ceName')?.value||'').trim();if(!name){toast(en?'Give the campaign a name':'Donne un nom à la campagne');return}
  const definition={...(d.definition||{}),featured:!!$('#ceFeatured')?.checked,description:$('#ceDesc')?.value||'',pages:d.pages.filter(p=>(p.title||'').trim()||(p.text||'').trim()).map(p=>({id:p.id||crypto.randomUUID().slice(0,8),title:(p.title||'').trim(),text:p.text||''}))};
  const payload={name,color:$('#ceColor')?.value||'#ff8a3d',definition};
  try{const res=d.id?await window.MordheimundaAPI.adminUpdateCampaign(d.id,payload):await window.MordheimundaAPI.adminCreateCampaign(payload);const c=res?.campaign;closeModal();campaignsCache=null;campaignListStale=true;adminCampaignsCache=null;if(c){campaignDetailCache.delete(c.id);navigateApp('/rules/campaign/'+encodeURIComponent(c.id))}toast(en?'Campaign saved':'Campagne enregistrée')}catch(e){toast(authError(e,en))}
}
function openSpellWeaponProfileEditor(entryId,name){
  const p=spellWeaponProfileFor(entryId)||{};
  spellBookTraitDraft=Array.isArray(p.traits)?p.traits.slice():String(p.traits||'').split(',').map(x=>x.trim()).filter(Boolean);
  openModal(`<div class="custom-form-head"><div><div class="eyebrow">PROFIL D’ARME (ADMIN)</div><h3>${esc(name)}</h3></div></div>
    <p class="custom-field-help">Ce sort apparaîtra comme une arme sur la fiche de tout combattant qui le connaît.</p>
    <div class="custom-weapon-grid"><label class="custom-field"><span>Portée</span><input id="swpRange" value="${esc(p.range||'')}" placeholder="Melee 2 / 12\""></label><label class="custom-field"><span>Force</span><input id="swpStrength" value="${esc(p.strength||'')}" placeholder="S / S+1 / 2D6…"></label><label class="custom-field"><span>AP</span><input id="swpAp" value="${esc(p.ap||'')}" placeholder="- / -1 / +1…"></label><label class="custom-field"><span>Dégâts</span><input id="swpDamage" value="${esc(p.damage||'')}" placeholder="1 / 2 / D3…"></label></div>
    ${traitPickerMarkup('spellBook')}
    <div class="custom-actions">${spellWeaponProfileFor(entryId)?`<button type="button" class="button danger-outline" onclick="removeSpellWeaponProfile('${esc(entryId)}')">Retirer le profil</button>`:''}<button type="button" class="button secondary" onclick="closeModal()">Annuler</button><button type="button" class="button primary" onclick="saveSpellWeaponProfileEditor('${esc(entryId)}')">Enregistrer</button></div>`);
}
async function saveSpellWeaponProfileEditor(entryId){
  const range=($('#swpRange')?.value||'').trim(),strength=($('#swpStrength')?.value||'').trim(),ap=($('#swpAp')?.value||'').trim(),damage=($('#swpDamage')?.value||'').trim(),traits=spellBookTraitDraft.join(', ');
  if(!range&&!strength&&!ap&&!damage){toast(siteLanguage==='en'?'Fill in at least one profile field':'Renseigne au moins un champ du profil');return}
  const profile={range,strength,ap,damage,traits};
  try{
    await window.MordheimundaAPI.adminSaveSpellWeaponProfile(entryId,profile);
    spellWeaponProfileOverrideMap.set(entryId,profile);
    // Clean up any pre-fix local-only copy now that the shared version wins.
    delete spellWeaponProfileStore()[entryId];save(true);
    closeModal();renderCurrentRoute();toast(siteLanguage==='en'?'Weapon profile saved — visible to all accounts':'Profil d’arme enregistré — visible pour tous les comptes');
  }catch(e){toast(authError(e,siteLanguage==='en'));}
}
async function adminDeleteError(id){const en=siteLanguage==='en';if(id==='all'&&!confirm(en?'Remove every error received?':'Retirer toutes les erreurs reçues ?'))return;try{await window.MordheimundaAPI.adminDeleteError(id);adminErrorsData=null;render('admin')}catch(e){toast(authError(e,en))}}
async function adminConvertMedia(){const en=siteLanguage==='en';if(mediaConvertBusy)return;mediaConvertBusy=true;render('admin');let total=0,rows=0,rounds=0;const show=t=>{const el=document.getElementById('mediaProgress');if(el)el.textContent=t};
  try{for(;;){const r=await window.MordheimundaAPI.adminConvertMedia();total+=r.images||0;rows+=Object.values(r.updated||{}).reduce((a,b)=>a+b,0);rounds++;show(en?`${total} picture(s) moved, ${rows} item(s) updated…`:`${total} image(s) rangée(s), ${rows} élément(s) mis à jour…`);if(!r.more||rounds>200)break}
    toast(en?`Done — ${total} picture(s) moved to the store`:`Terminé — ${total} image(s) rangée(s)`)}
  catch(e){toast(authError(e,en))}finally{mediaConvertBusy=false;render('admin');setTimeout(()=>show(en?`${total} picture(s) moved, ${rows} item(s) updated.`:`${total} image(s) rangée(s), ${rows} élément(s) mis à jour.`),50)}}
// Admin editor — steps one per line; "| 20" at the end makes a counted step.
function openGreatQuestEditor(qi,asMain){
  if(!isAdminSession())return;const en=siteLanguage==='en';const r=activeRoster();if(!r)return;const q=qi>=0?greatQuestList(r)[qi]:null;
  const isMain=q?!!q.main:(asMain===undefined?!greatQuestMain(r):!!asMain);
  gqTrophyPick=q?.trophy||'';
  const steps=(q?.steps||[]).map(st=>Number(st.target)>0?`${st.text} | ${st.target}`:st.text).join('\n');
  openModal(`<div class="admin-live-editor"><div class="eyebrow">${en?'GREAT QUEST':'GRANDE QUÊTE'} · ${esc(r.name||'')}</div><h2>${q?(en?'Edit the Great Quest':'Modifier la Grande Quête'):(en?'New Great Quest':'Nouvelle Grande Quête')}</h2>
  <label class="custom-check"><input type="checkbox" id="gqMain" ${isMain?'checked':''}> <span><b>${en?'Main Great Quest — win condition':'Grande Quête principale — condition de victoire'}</b><small>${en?'Only one per warband: ticking it here makes any other main quest secondary.':'Une seule par bande : la cocher ici rend secondaire l’ancienne principale.'}</small></span></label>
  <label class="custom-field wide"><span>${en?'Name':'Nom'}</span><input id="gqName" value="${esc(q?.name||'')}"></label>
  <label class="custom-field wide"><span>${en?'Story / description':'Histoire / description'}</span><textarea id="gqText" rows="3">${esc(q?.text||'')}</textarea></label>
  <label class="custom-field wide"><span>${en?'Steps — one per line. End a line with “| 20” to count it (0 / 20)':'Étapes — une par ligne. Termine une ligne par « | 20 » pour la compter (0 / 20)'}</span><textarea id="gqSteps" rows="5">${esc(steps)}</textarea></label>
  ${gqTrophyPickerMarkup(q?.trophy||'')}
  <label class="custom-field gq-color-field"><span>${en?'Border colour in the Standings':'Couleur de la bordure dans le Classement'}</span><span class="gq-color-row"><input type="color" id="gqColor" value="${esc(gqColor(q?.color))}"><button type="button" class="button secondary small" onclick="document.getElementById('gqColor').value='#e8c25a'">${en?'Gold (default)':'Or (défaut)'}</button></span></label>
  <label class="custom-field wide"><span>${en?'Rewards — one per line (applied by hand)':'Récompenses — une par ligne (à appliquer à la main)'}</span><textarea id="gqRewards" rows="3">${esc(q?.rewards||'')}</textarea></label>
  <div class="custom-actions">${q?`<button type="button" class="button danger-outline" onclick="deleteGreatQuest(${qi})">🗑 ${en?'Delete':'Supprimer'}</button>`:''}<span style="flex:1"></span><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" onclick="saveGreatQuest(${qi})">${en?'Save':'Enregistrer'}</button></div></div>`)}
function addAdminWarriorRule(){
  const input=$('#awRuleInput'),v=(input?.value||'').trim();if(!v)return;
  // V-ORPHANRULETAG: a name typed here used to be accepted completely
  // verbatim when it matched no reference entry — creating a tag that shows
  // on the fighter card forever with no hover/text anywhere (a typo like
  // "Assasin" instead of "Assassin", or a rule just added under this same
  // editor's own RULES tab — d.specialRules — but not yet merged into
  // RULES.categories.special, which only happens after Save+reload). Also
  // matching against the in-session draft's own d.specialRules (by name)
  // catches the "just defined it, haven't saved yet" case and reuses its
  // exact spelling instead of free-typing it again; a true non-match now
  // warns instead of silently creating a dead tag.
  const d=activeAdminEditData();
  const draftMatch=(Array.isArray(d?.specialRules)?d.specialRules:[]).find(s=>normName(s?.name)===normName(v));
  const found=preferParamTemplate('special',referenceFind('special',v));
  const canonical=found?.name||draftMatch?.name||v;
  if(/^Race\s*\(/i.test(canonical)){if(input)input.value='';return}
  if(isTraitParamTemplate(canonical)){if(input)input.value='';openTraitParamPrompt('adminFighter',null,canonical);return}
  if(!found&&!draftMatch){
    const en=siteLanguage==='en';
    toast(en?`"${canonical}" matches no defined rule — it will show with no hover text until you add it under the RULES tab (Special Rules).`:`« ${canonical} » ne correspond à aucune règle définie — elle n’affichera aucun texte au survol tant qu’elle n’est pas ajoutée dans l’onglet RÈGLES (Règles spéciales).`);
  }
  if(!adminRuleDraft.some(x=>normName(x)===normName(canonical)))adminRuleDraft.push(canonical);
  if(input)input.value='';refreshAdminWarriorRuleTags();setTimeout(()=>$('#awRuleInput')?.focus(),20);
}
function handleAdminWarriorRuleKey(e){if(e.key==='Enter'){e.preventDefault();addAdminWarriorRule()}}
function removeAdminWarriorRule(i){adminRuleDraft.splice(i,1);refreshAdminWarriorRuleTags()}

// V-PERFSAMPLE: admin view of the timings players' devices sent.
let adminPerfData=null,adminPerfLoading=false;
async function loadAdminPerf(){if(adminPerfLoading)return;adminPerfLoading=true;try{adminPerfData=await window.MordheimundaAPI.adminPerf()}catch(e){adminPerfData={error:authError(e,siteLanguage==='en')}}finally{adminPerfLoading=false;if(currentViewName()==='admin')render('admin')}}
function adminPerfMarkup(){const en=siteLanguage==='en';const d=adminPerfData;if(!d){setTimeout(loadAdminPerf,0);return `<div class="card admin-card"><p class="muted">${en?'Loading…':'Chargement…'}</p></div>`}
  if(d.error)return `<div class="card admin-card"><p class="muted">${esc(d.error)}</p><button class="button secondary" onclick="adminPerfData=null;render('admin')">${en?'Retry':'Réessayer'}</button></div>`;
  const s=v=>v==null?'—':Number(v)<1000?Math.round(Number(v))+' ms':(Number(v)/1000).toFixed(1)+' s';const dev={phone:en?'Phone':'Téléphone',tablet:en?'Tablet':'Tablette',desktop:en?'Computer':'Ordinateur'};
  const rows=(d.days||[]).map(r=>`<tr><td>${esc(r.day)}</td><td>${dev[r.device]||esc(r.device)}</td><td>${r.n}</td><td><b>${s(r.first_p50)}</b></td><td>${s(r.first_p75)}</td><td>${s(r.load_p50)}</td><td>${s(r.view_p50)}</td></tr>`).join('');
  const builds=(d.builds||[]).map(r=>`<tr><td>${esc(r.build)}</td><td>${r.n}</td><td><b>${s(r.first_p50)}</b></td><td>${s(r.first_p75)}</td></tr>`).join('');
  return `<div class="card admin-card admin-perf"><div class="eyebrow">${en?'SPEED FOR PLAYERS':'VITESSE CHEZ LES JOUEURS'}</div><p class="muted">${en?'One visit in four sends its timings, anonymously. "First screen": time until the page shows something usable. "Half" = median, "3 in 4" = 75% of visits are faster. "Slowest change": slowest screen change in the first 30 s.':'Une visite sur quatre envoie ses temps, anonymement. « Premier écran » : temps avant que la page soit utilisable. « Moitié » = médiane, « 3 sur 4 » = 75 % des visites sont plus rapides. « Changement le plus lent » : le changement d’écran le plus lent des 30 premières secondes.'}</p>
  ${rows?`<div class="armory-wrap"><table class="armory-table"><thead><tr><th>${en?'Day':'Jour'}</th><th>${en?'Device':'Appareil'}</th><th>${en?'Visits':'Visites'}</th><th>${en?'First screen · half':'Premier écran · moitié'}</th><th>${en?'· 3 in 4':'· 3 sur 4'}</th><th>${en?'Full load':'Chargement complet'}</th><th>${en?'Slowest change':'Changement le plus lent'}</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<p class="muted">${en?'Nothing received yet.':'Rien de reçu pour l’instant.'}</p>`}
  ${builds?`<div class="micro-label" style="margin-top:12px">${en?'BY VERSION':'PAR VERSION'}</div><div class="armory-wrap"><table class="armory-table"><thead><tr><th>Version</th><th>${en?'Visits':'Visites'}</th><th>${en?'First screen · half':'Premier écran · moitié'}</th><th>${en?'· 3 in 4':'· 3 sur 4'}</th></tr></thead><tbody>${builds}</tbody></table></div>`:''}
  <div class="custom-actions"><button type="button" class="button secondary" onclick="adminPerfData=null;render('admin')">↻ ${en?'Refresh':'Actualiser'}</button></div></div>`}

// ---- V-RACELOOK: admin windows for race banners and warband logos ----
let rlDraft=null,rlMode=null,rlRace=null,rlPending=Promise.resolve(),rlCrop=null;
function rlClone(){return JSON.parse(JSON.stringify({races:raceLooks.races||{},factions:raceLooks.factions||{},packs:raceLooks.packs||{},cats:raceLooks.cats||{}}))}
function rlLook(r){const d=RACE_LOOK_DEFAULTS[r]||['#9dfa3c','plain','',''];const o=rlDraft.races[r]||{};const en=siteLanguage==='en';return {color:o.color||d[0],motif:o.motif||d[1],tagline:o.tagline!=null?o.tagline:d[en?2:3],image:o.image||'',focus:o.focus||null}}
function rlStyle(c){return `--rc:${c};--rc2:${hexMixWhite(c,.55)}`}
function rlPreview(img,fallback,color,focus){return `<span class="rl-preview" style="${rlStyle(color)}">${img?`<img src="${esc(img)}"${imageFocusStyle(focus)} alt="">`:esc(fallback)}</span>`}
// drop a picture on a row, or reframe it (centre point + zoom), V-RACELOOK
function rlDropAttrs(kind,key){return `ondragover="event.preventDefault();this.classList.add('drop')" ondragleave="this.classList.remove('drop')" ondrop="rlDrop(event,'${kind}','${esc(key)}')"`}
function rlDrop(ev,kind,key){ev.preventDefault();ev.currentTarget?.classList.remove('drop');const f=ev.dataTransfer?.files?.[0];if(f)rlPickImage({files:[f]},kind,key)}
function rlCropBtn(kind,key,has){return has?`<button type="button" class="button secondary small" onclick="rlToggleCrop('${kind}','${esc(key)}')">✥ ${siteLanguage==='en'?'Reframe':'Recadrer'}</button>`:''}
function rlToggleCrop(kind,key){rlCrop=rlCrop&&rlCrop.kind===kind&&rlCrop.key===key?null:{kind,key};rlRender()}
function rlCropPanel(kind,key){if(!rlCrop||rlCrop.kind!==kind||rlCrop.key!==key)return '';const o=rlDraft[kind][key]||{};if(!o.image)return '';const en=siteLanguage==='en';const f=o.focus||{x:.5,y:.5,zoom:1};const pct=v=>(v*100).toFixed(1)+'%';
  return `<div class="rl-crop"><div class="rl-crop-stage" id="rlCropStage"><img src="${esc(o.image)}" alt="" draggable="false"><span class="image-crop-marker" id="rlCropMarker" style="left:${pct(f.x)};top:${pct(f.y)}"></span></div><div class="rl-crop-side"><span class="rl-preview big" id="rlCropPrev">${`<img src="${esc(o.image)}"${imageFocusStyle(f)} alt="">`}</span><label class="custom-field"><span>Zoom <b id="rlCropZoomV">${Math.round(f.zoom*100)}%</b></span><input type="range" min="100" max="250" step="1" value="${Math.round(f.zoom*100)}" oninput="rlCropZoom(this.value)"></label><small class="muted">${en?'Tap or drag on the picture: that point stays in the middle of the round frame.':'Touche ou fais glisser sur l’image : ce point reste au centre du cadre rond.'}</small><button type="button" class="button primary small" onclick="rlCrop=null;rlRender()">${en?'Done':'Terminé'}</button></div></div>`}
function rlCropApply(){if(!rlCrop)return;const o=rlDraft[rlCrop.kind][rlCrop.key];if(!o)return;const f=o.focus;const pct=v=>(v*100).toFixed(1)+'%';const m=document.getElementById('rlCropMarker');if(m){m.style.left=pct(f.x);m.style.top=pct(f.y)}const im=document.querySelector('#rlCropPrev img');if(im){im.setAttribute('style',(imageFocusStyle(f).match(/style="([^"]*)"/)||[])[1]||'')}const zv=document.getElementById('rlCropZoomV');if(zv)zv.textContent=Math.round(f.zoom*100)+'%'}
function rlCropZoom(v){if(!rlCrop)return;const o=rlDraft[rlCrop.kind][rlCrop.key];if(!o)return;o.focus={...(o.focus||{x:.5,y:.5}),zoom:Math.max(1,Math.min(2.5,Number(v)/100||1))};rlCropApply()}
function rlBindCrop(){const st=document.getElementById('rlCropStage');if(!st||!rlCrop)return;let drag=false;const up=(e)=>{const r=st.getBoundingClientRect();const o=rlDraft[rlCrop.kind][rlCrop.key];if(!o||!r.width)return;o.focus={...(o.focus||{zoom:1}),x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};rlCropApply()};
  st.onpointerdown=e=>{drag=true;try{st.setPointerCapture(e.pointerId)}catch(x){}up(e)};st.onpointermove=e=>{if(drag)up(e)};st.onpointerup=st.onpointercancel=()=>{drag=false;rlRender()}}
function rlUpload(kind,key){return `<label class="button secondary small rl-file">🖼 ${siteLanguage==='en'?'Picture':'Image'}<input type="file" accept="image/*" hidden onchange="rlPickImage(this,'${kind}','${esc(key)}')"></label>`}
function rlRemoveBtn(kind,key,has){return has?`<button type="button" class="button secondary small" onclick="rlSet('${kind}','${esc(key)}','image','')">${siteLanguage==='en'?'Remove picture':'Retirer l’image'}</button>`:''}
function openRaceLooksEditor(){rlCrop=null;rlDraft=rlClone();rlMode='races';rlRace=null;openModal(`<div class="wc-dialog" id="rlEd"></div>`);rlRender()}
function openFactionLogosEditor(race){rlCrop=null;rlDraft=rlClone();rlMode='factions';rlRace=race;openModal(`<div class="wc-dialog" id="rlEd"></div>`);rlRender()}
function rlRender(){const box=document.getElementById('rlEd');if(!box||!rlDraft)return;const en=siteLanguage==='en';let body='';
  if(rlMode==='races'){
    body=`<div class="eyebrow">${en?'CREATE A WARBAND':'CRÉER UNE BANDE'}</div><h2>${en?'Races: colour, motif, emblem':'Races : couleur, motif, emblème'}</h2><p class="sheet-help">${en?'Shown on the race tiles. The emblem picture is also used by the race’s warbands that have no logo of their own.':'Affiché sur les cases de race. L’image d’emblème sert aussi aux warbands de la race qui n’ont pas leur propre logo.'}</p>`+
    RACE_CATEGORIES.map(r=>{const l=rlLook(r);return `<div class="rl-row" ${rlDropAttrs('races',r)}>${rlPreview(l.image,raceIcon(r),l.color,l.focus)}<div><b>${esc(r)}</b><div class="rl-fields"><input type="color" value="${esc(l.color)}" aria-label="${en?'Colour':'Couleur'}" onchange="rlSet('races','${esc(r)}','color',this.value)"><label class="custom-field"><span>${en?'Motif':'Motif'}</span><select onchange="rlSet('races','${esc(r)}','motif',this.value)">${RACE_LOOK_MOTIFS.map(([k,e,f])=>`<option value="${k}" ${l.motif===k?'selected':''}>${en?e:f}</option>`).join('')}</select></label><label class="custom-field"><span>${en?'Tagline':'Accroche'}</span><input value="${esc(l.tagline)}" maxlength="90" onchange="rlSet('races','${esc(r)}','tagline',this.value)"></label>${rlUpload('races',r)}${rlCropBtn('races',r,!!l.image)}${rlRemoveBtn('races',r,!!l.image)}</div>${rlCropPanel('races',r)}</div></div>`}).join('');
    body+=`<h3 style="margin:16px 0 4px">${en?'Categories apart (Rules: Warbands)':'Catégories à part (Règles : Warbands)'}</h3>`+Object.keys(WB_CAT_DEFAULTS).map(k=>{const o=rlDraft.cats?.[k]||{};const d=WB_CAT_DEFAULTS[k];const col=o.color||d.color;const tl=o.tagline!=null?o.tagline:helpT(d.tagline);return `<div class="rl-row" ${rlDropAttrs('cats',k)}>${rlPreview(o.image||'',d.icon,col,o.focus)}<div><b>${esc(helpT(d.title))}</b><div class="rl-fields"><input type="color" value="${esc(col)}" aria-label="${en?'Colour':'Couleur'}" onchange="rlSet('cats','${k}','color',this.value)"><label class="custom-field"><span>${en?'Tagline':'Accroche'}</span><input value="${esc(tl)}" maxlength="90" onchange="rlSet('cats','${k}','tagline',this.value)"></label>${rlUpload('cats',k)}${rlCropBtn('cats',k,!!o.image)}${rlRemoveBtn('cats',k,!!o.image)}</div>${rlCropPanel('cats',k)}</div></div>`}).join('');
  }else{
    const r=rlRace;const l=rlLook(r);const fs=(D.factions||[]).filter(f=>!f.packId&&!isContentPoolFaction(f)&&raceTagMap.get(f.id)===r);
    body=`<div class="eyebrow">${esc(r)}</div><h2>${en?'Warband and supplement logos':'Logos des warbands et suppléments'}</h2><p class="sheet-help">${en?'A warband without a logo shows its race’s emblem. A supplement logo appears next to its name when creating a warband.':'Une warband sans logo affiche l’emblème de sa race. Le logo d’un supplément s’affiche à côté de son nom à la création.'}</p>`+
    (fs.length?fs.map(f=>{const img=rlDraft.factions[f.id]?.image||'';const packs=availableSupplementsForFaction(f.id)||[];
      const fo=img?(rlDraft.factions[f.id]?.focus||null):l.focus;return `<div class="rl-row" ${rlDropAttrs('factions',f.id)}>${rlPreview(img||l.image,factionSigils[f.id]||raceIcon(r),l.color,fo)}<div><b>${esc(f.displayName)}</b><div class="rl-fields">${rlUpload('factions',f.id)}${rlCropBtn('factions',f.id,!!img)}${rlRemoveBtn('factions',f.id,!!img)}</div>${rlCropPanel('factions',f.id)}${packs.map(p=>{const pi=rlDraft.packs[p.id]?.image||'';return `<div class="rl-sub" ${rlDropAttrs('packs',p.id)}><div class="rl-fields">${pi?`<span class="supp-logo"><img src="${esc(pi)}"${imageFocusStyle(rlDraft.packs[p.id]?.focus)} alt=""></span>`:''}<span>↳ ${en?'Sub-faction':'Sous-faction'} · ${esc(p.name)}</span>${rlUpload('packs',p.id)}${rlCropBtn('packs',p.id,!!pi)}${rlRemoveBtn('packs',p.id,!!pi)}</div>${rlCropPanel('packs',p.id)}</div>`}).join('')}</div></div>`}).join(''):`<p class="muted">${en?'No warband in this race yet.':'Aucune warband dans cette race.'}</p>`);
  }
  box.innerHTML=body+`<div class="custom-actions"><button type="button" class="button primary" onclick="rlSave()">${en?'Save':'Enregistrer'}</button><button type="button" class="button secondary" onclick="rlDraft=null;closeModal()">${en?'Cancel':'Annuler'}</button></div>`;rlBindCrop()}
function rlSet(kind,key,field,val){if(!rlDraft)return;if(!rlDraft[kind])rlDraft[kind]={};const o=rlDraft[kind][key]||(rlDraft[kind][key]={});if(val===''||val==null){delete o[field];if(field==='image'){delete o.focus;if(rlCrop&&rlCrop.kind===kind&&rlCrop.key===key)rlCrop=null}}else o[field]=val;if(!Object.keys(o).length)delete rlDraft[kind][key];rlRender()}
function rlPickImage(input,kind,key){const p=rlPickImageRun(input,kind,key);rlPending=rlPending.then(()=>p);return p}
async function rlPickImageRun(input,kind,key){const en=siteLanguage==='en';const f=input?.files?.[0];if(!f)return;
  try{const raw=await new Promise((ok,ko)=>{const fr=new FileReader();fr.onload=()=>ok(String(fr.result||''));fr.onerror=()=>ko(fr.error);fr.readAsDataURL(f)});
    let out=await imgShrink(raw,256,.86);if(!out&&raw.length<150000&&/^data:image\/(webp|png|jpeg)/.test(raw))out=raw;
    if(!out||out.length>150000){toast(en?'This picture is too big':'Cette image est trop lourde');return}
    {if(!rlDraft[kind])rlDraft[kind]={};const o=rlDraft[kind][key]||(rlDraft[kind][key]={});o.image=out;delete o.focus;rlCrop={kind,key};rlRender()}}catch(e){toast(en?'Could not read this picture':'Impossible de lire cette image')}}
async function rlSave(){const en=siteLanguage==='en';try{await rlPending}catch(e){}if(!rlDraft)return;try{const res=await window.MordheimundaAPI.adminSaveRaceLooks(rlDraft);const l=res?.looks||rlDraft;raceLooks={races:l.races||{},factions:l.factions||{},packs:l.packs||{},cats:l.cats||{}};rlDraft=null;closeModal();toast(en?'Saved':'Enregistré');if(['create','rulesWarbands','rulesWarbandDetail'].includes(currentViewName()))renderCurrentRoute()}catch(e){toast(authError(e,en))}}
// V-HELPTEXTS: Admin › help texts — rewrite any help text (FR/EN) for everyone,
// and pick the factions shown as "Beginner" in the guided creation.
let helpEdTab='cards',helpEdDraft=null;
function helpEdClone(){return {texts:JSON.parse(JSON.stringify(helpOverrides.texts||{})),beginner:Array.isArray(helpOverrides.beginner)?helpOverrides.beginner.slice():helpBeginnerIds()}}
function openHelpTextsEditor(){helpEdDraft=helpEdClone();helpEdTab='cards';openModal(`<div class="help-ed">${helpEdMarkup()}</div>`)}
function helpEdMarkup(){const en=siteLanguage==='en';const tabs=[['cards',en?'Game in 2 min':'Le jeu en 2 min'],['pages',en?'“?” pages & tours':'Pages « ? » et visites'],['tips',en?'Tips':'Astuces'],['create',en?'Creation & reading':'Création et lecture'],['factions',en?'Factions':'Factions'],['news',en?'What’s new':'Nouveautés']];
 const items=helpAllTexts().filter(x=>x.g===helpEdTab);const all=(D.factions||[]).filter(f=>!f.packId&&!(typeof isContentPoolFaction==='function'&&isContentPoolFaction(f)));const beg=new Set(helpEdDraft.beginner||[]);
 return `<div class="eyebrow">ADMIN · ${en?'HELP':'AIDE'}</div><h2>${en?'Help texts':'Textes de l’aide'}</h2><p class="muted" style="margin:0 0 10px;font-size:12.5px">${en?'Your changes apply to everyone. A text you leave untouched keeps the app’s version.':'Tes changements s’appliquent à tout le monde. Un texte que tu ne touches pas garde la version de l’appli.'}</p>
 <div class="help-ed-tabs">${tabs.map(([k,l])=>`<button type="button" class="${helpEdTab===k?'on':''}" onclick="helpEdRead();helpEdTab='${k}';document.querySelector('.help-ed').innerHTML=helpEdMarkup()">${l}</button>`).join('')}</div>
 ${helpEdTab==='factions'?`<div class="help-ed-item"><b>${en?'“Beginner” factions':'Factions « Débutant »'}</b><div class="help-ed-begs">${all.map(f=>`<label><input type="checkbox" class="helpEdBeg" value="${esc(f.id)}" ${beg.has(f.id)?'checked':''}> ${esc(f.displayName||f.id)}</label>`).join('')}</div></div>`:''}
 <div class="help-ed-list">${items.map(x=>{const o=helpEdDraft.texts[x.key]||{};const mod=!!(o.fr||o.en);return `<div class="help-ed-item" data-key="${esc(x.key)}"><div class="help-ed-head"><b>${esc(x.label)}</b>${mod?`<span class="help-ed-mod">${en?'MODIFIED':'MODIFIÉ'}</span>`:''}</div><span class="help-ed-lang">FR</span><textarea class="helpEdFr" rows="2" placeholder="${esc(x.def[1]||'')}">${esc(o.fr||'')}</textarea><span class="help-ed-lang">EN</span><textarea class="helpEdEn" rows="2" placeholder="${esc(x.def[0]||'')}">${esc(o.en||'')}</textarea>${mod?`<button type="button" class="help-link" onclick="helpEdReset('${esc(x.key)}')">${en?'Restore the original text':'Rétablir le texte d’origine'}</button>`:''}</div>`}).join('')}</div>
 <p class="muted" style="font-size:11.5px">${en?'Empty field = the app’s text (shown in grey).':'Champ vide = texte de l’appli (affiché en gris).'}</p>
 <div class="custom-actions"><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" onclick="helpEdSave()">${en?'Save':'Enregistrer'}</button></div>`}
function helpEdRead(){document.querySelectorAll('.help-ed-item[data-key]').forEach(el=>{const k=el.dataset.key;const fr=el.querySelector('.helpEdFr')?.value.trim()||'',en=el.querySelector('.helpEdEn')?.value.trim()||'';if(fr||en)helpEdDraft.texts[k]={...(fr?{fr}:{}),...(en?{en}:{})};else delete helpEdDraft.texts[k]});const bs=[...document.querySelectorAll('.helpEdBeg')];if(bs.length)helpEdDraft.beginner=bs.filter(b=>b.checked).map(b=>b.value)}
function helpEdReset(k){helpEdRead();delete helpEdDraft.texts[k];document.querySelector('.help-ed').innerHTML=helpEdMarkup()}
async function helpEdSave(){const en=siteLanguage==='en';helpEdRead();try{const res=await window.MordheimundaAPI.adminSaveHelpTexts(helpEdDraft);const h=res?.help||helpEdDraft;helpOverrides={texts:h.texts||{},beginner:Array.isArray(h.beginner)?h.beginner:null};closeModal();toast(en?'Help texts saved':'Textes de l’aide enregistrés');renderCurrentRoute()}catch(e){toast(en?'Could not save':'Enregistrement impossible')}}

// V-FRMISSING: rule pages with no French text yet (bundle or admin correction)
function adminFrMissingMarkup(){const en=siteLanguage==='en';if(!(window.RULES_BOOK||[]).length||(siteLanguage==='fr'&&!frRulesBundle())){try{ensureRulesBook().then(()=>render('admin')).catch(()=>{})}catch(e){}try{ensureFrRules()}catch(e){}return `<div class="card admin-card"><p class="muted">${en?'Loading…':'Chargement…'}</p></div>`}
 if(siteLanguage!=='fr')return `<div class="card admin-card"><p class="muted">${en?'Switch the site to French to check the French texts.':'Passe le site en français pour vérifier les textes français.'}</p></div>`;
 const list=frMissingRulePages();const by=new Map();list.forEach(m=>{if(!by.has(m.id))by.set(m.id,{title:m.title,pages:[]});by.get(m.id).pages.push(m.page)});
 return `<div class="card admin-card"><p class="custom-field-help">${list.length?`${list.length} page(s) sans texte français. Ouvre la section puis « ✎ Modifier » pour écrire la traduction : elle est enregistrée pour le site en français.`:'Toutes les pages de règles ont un texte français. ✓'}</p>${[...by.entries()].map(([id,v])=>`<div class="custom-item-row"><div class="custom-item-main"><div><strong>${esc(v.title||id)}</strong><small>p. ${v.pages.map(esc).join(', ')}</small></div></div><div class="custom-item-actions"><button type="button" class="button secondary small" onclick="frMissingOpen('${esc(id)}')">${en?'Open to translate':'Ouvrir pour traduire'}</button></div></div>`).join('')}</div>`}

// V-ADMINLOG: Admin › Change log
let adminLogData=null,adminLogBusy=false;
const ADMIN_LOG_LABELS=[[/help-texts/,['Help texts','Textes de l’aide']],[/race-looks/,['Race looks & categories','Apparence des races et catégories']],[/price-rules/,['Special prices','Prix spéciaux']],[/warband-size-limits/,['Warband size limits','Limites de taille de bande']],[/warband-hire-rules/,['Hire rules','Règles d’embauche']],[/\/quests/,['Quests','Quêtes']],[/trophies/,['Trophies','Trophées']],[/translate-exclusions/,['Words never translated','Mots jamais traduits']],[/home\/event/,['Active event','Évènement en cours']],[/home|news/,['Home news','Nouvelles de l’accueil']],[/rules\/overrides/,['Rule text','Texte de règle']],[/rules\/nav-groups/,['Rules menu','Menu des règles']],[/rule-images/,['Rule picture','Image de règle']],[/catalog\/overrides/,['Warband catalogue','Catalogue de warband']],[/weapon-overrides/,['Weapon / item','Arme / objet']],[/race-tags/,['Faction race','Race d’une faction']],[/race-maximums/,['Racial maximums','Maximums raciaux']],[/faction-categor/,['Faction categories','Catégories de factions']],[/domain-overrides/,['Magic domain','Domaine de magie']],[/spell-weapon-profiles/,['Spell weapon profile','Profil d’arme de sort']],[/scenarios/,['Scenario','Scénario']],[/deployment-maps/,['Deployment map','Carte de déploiement']],[/campaigns/,['Campaign','Campagne']],[/\/warbands/,['Official warband','Warband officielle']],[/support/,['Player warband (support)','Bande d’un joueur (support)']],[/promote|demote/,['Admin accounts','Comptes admin']],[/sync-pause/,['Sync switch','Interrupteur de synchro']],[/errors/,['Error reports','Rapports d’erreurs']],[/translations/,['Translations','Traductions']],[/media|migrate/,['Maintenance','Maintenance']]];
function adminLogLabel(e){const en=siteLanguage==='en';const hit=ADMIN_LOG_LABELS.find(([re])=>re.test(e.path));const base=hit?hit[1][en?0:1]:e.path;const k=e.target?.key;const detail=!k?'':k.section_id!=null?`${String(k.section_id).replace(/^fr:/,'(FR) ')} · p. ${k.page}`:Object.values(k).map(v=>String(v)).join(' · ');return detail?`${base} — ${detail}`:base}
async function loadAdminLog(more){if(adminLogBusy)return;adminLogBusy=true;try{const before=more&&adminLogData?.entries?.length?adminLogData.entries[adminLogData.entries.length-1].id:null;const r=await window.MordheimundaAPI.adminLog(before);const list=r?.entries||[];adminLogData={entries:more&&adminLogData?[...adminLogData.entries,...list]:list,end:list.length<100}}catch(e){adminLogData={error:authError(e,siteLanguage==='en'),entries:[]}}finally{adminLogBusy=false;render('admin')}}
async function adminLogRestore(id){const en=siteLanguage==='en';const e=(adminLogData?.entries||[]).find(x=>x.id===id);if(!e)return;if(!(await siteConfirm(en?`Put back the value from before this change? (${adminLogLabel(e)})`:`Remettre la valeur d’avant cette modification ? (${adminLogLabel(e)})`)))return;try{await window.MordheimundaAPI.adminLogRestore(id);toast(en?'Restored — players see it within a minute':'Rétabli — visible par les joueurs d’ici une minute');adminLogData=null;loadAdminLog()}catch(err){toast(authError(err,en))}}
function adminLogMarkup(){const en=siteLanguage==='en';if(!adminLogData){setTimeout(()=>loadAdminLog(),0);return `<div class="card admin-card"><p class="muted">${en?'Loading…':'Chargement…'}</p></div>`}
 if(adminLogData.error)return `<div class="card admin-card"><p class="muted">${esc(adminLogData.error)}</p></div>`;
 const fmt=d=>{try{return new Date(d).toLocaleString(en?'en-GB':'fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(e){return ''}};
 const verb=m=>m==='RESTORE'?(en?'restored':'a rétabli'):m==='DELETE'?(en?'deleted':'a supprimé'):m==='POST'?(en?'added':'a ajouté'):(en?'changed':'a modifié');
 const rows=adminLogData.entries.map(e=>`<div class="adlog-row${e.restored_at?' done':''}"><div class="adlog-main"><b>${esc(adminLogLabel(e))}</b><small>${esc(fmt(e.at))} · ${esc(e.username||'?')} ${verb(e.method)}${e.restored_at?` · ${en?'restored by':'rétabli par'} ${esc(e.restored_by||'?')}`:''}</small></div>${e.restorable&&!e.restored_at?`<button type="button" class="button secondary small" onclick="adminLogRestore(${Number(e.id)})">↶ ${en?'Restore':'Rétablir'}</button>`:''}</div>`).join('');
 return `<div class="card admin-card"><p class="custom-field-help">${en?'Every admin change since this log was added. “Restore” puts back the value from just before that change (rules, catalogue, weapons, races, magic domains, help texts, looks, prices, limits, quests, trophies, event).':'Toutes les modifications admin depuis l’ajout de ce journal. « Rétablir » remet la valeur d’avant cette modification (règles, catalogue, armes, races, domaines de magie, textes de l’aide, apparences, prix, limites, quêtes, trophées, évènement).'}</p>${rows||`<p class="muted">${en?'Nothing yet.':'Rien pour l’instant.'}</p>`}<div class="custom-actions"><button type="button" class="button secondary" onclick="adminLogData=null;render('admin')">↻ ${en?'Refresh':'Actualiser'}</button>${adminLogData.end?'':`<button type="button" class="button secondary" onclick="loadAdminLog(true)">${en?'Older':'Plus ancien'}</button>`}</div></div>`}
