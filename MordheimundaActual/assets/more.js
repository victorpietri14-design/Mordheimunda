// V-MORECODE: pages most visits never open (Custom, Learn to play,
// References, Account, a campaign's page, the Play setup) live here, out
// of app.js, so the first load has less to download and read. app.js
// fetches this file a moment after the site opens, or at once when one of
// these pages is opened first (see ensureMoreCode in app.js). Everything here
// is plain global code, like app.js: it uses app.js's functions and state.
// Edit this file directly; node tools/build-min.mjs makes more.min.js.
let referenceGlossaryOpen=restoreUiState('refGlossaryOpen','1')!=='0';
function setReferenceSource(v){referenceSourceFilter=v;render('references')}
// Repainting #content (e.g. every background sync re-render) rebuilds the
// account page from its template, and a native <details> element doesn't
// remember its own open/closed state across that — it resets to closed by
// default, which on a phone (where the poll/re-render cycle runs often)
// made the diagnostics panel snap shut every couple of seconds while
// reading it. Track it explicitly like the other UI-open flags below.
let accountDiagOpen=false;
function toggleReferenceGlossary(){referenceGlossaryOpen=!referenceGlossaryOpen;persistUiState('refGlossaryOpen',referenceGlossaryOpen?'1':'0');render('references')}
// Traits/Special rules: alphabetical A→Z with a retractable glossary
// sidebar (letter jump links).
function referenceAlphaBodyMarkup(cat,q){
  const en=siteLanguage==='en';
  const filtered=referenceFilteredList(cat,q,referenceSourceFilter);
  if(!filtered.length)return `<div class="empty large"><strong>${en?'No entry.':'Aucune entrée.'}</strong><span>${en?'Try another search term.':'Essaie un autre terme de recherche.'}</span></div>`;
  const sorted=filtered.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const groups=new Map();
  sorted.forEach(e=>{const letter=(String(e.name||'#').trim().charAt(0).toUpperCase().match(/[A-Z]/)||['#'])[0];if(!groups.has(letter))groups.set(letter,[]);groups.get(letter).push(e);});
  const letters=[...groups.keys()].sort();
  const sidebarLinks=letters.map(l=>`<a href="#ref-letter-${cat}-${l}" onclick="scrollToRefAnchor(event,'ref-letter-${cat}-${l}')">${l}</a>`).join('');
  const sections=letters.map(l=>`<section class="ref-letter-group" id="ref-letter-${cat}-${l}"><div class="ref-letter-tag">${l}</div><div class="reference-list">${groups.get(l).map(e=>referenceEntryMarkup(e,cat)).join('')}</div></section>`).join('');
  const toggleBtn=`<button type="button" class="ref-glossary-toggle" onclick="toggleReferenceGlossary()">${referenceGlossaryOpen?(en?'‹ Hide A–Z':'‹ Masquer A-Z'):'A–Z ›'}</button>`;
  return `<div class="ref-alpha-shell${referenceGlossaryOpen?'':' collapsed'}">${toggleBtn}<aside class="ref-alpha-sidebar">${sidebarLinks}</aside><div class="ref-alpha-main">${sections}</div></div>`;
}
const EQUIPMENT_CATEGORY_NAMES_EN=EQUIPMENT_SECTIONS.map(s=>s.label);
function referenceArtifactsBodyMarkup(q){const en=siteLanguage==='en';const list=artifactAllList().filter(a=>!q||`${a.name} ${a.rules||''} ${a.base||''} ${a.campaign||''}`.toLowerCase().includes(q));
  if(!list.length)return `<p class="muted">${en?'No artifact.':'Aucun artefact.'}</p>`;return `<div class="art-ref">${artifactGroupsMarkup(list,{admin:isAdminEditUI()})}</div>`}
function referenceBodyMarkup(){
  const q=referenceSearch.trim().toLowerCase();
  if(referenceCategory==='equipment')return referenceEquipmentBodyMarkup(q)+coveringReferenceSection(q);
  if(referenceCategory==='artifacts')return referenceArtifactsBodyMarkup(q);
  if(referenceCategory==='skills'||referenceCategory==='spells')return referenceGroupedBodyMarkup(referenceCategory,q);
  if(referenceCategory==='traits'||referenceCategory==='special')return referenceAlphaBodyMarkup(referenceCategory,q);
  return '';
}
function references(){
  if(ruleOverridesCache===null)loadRuleOverrides();
  const en=siteLanguage==='en';
  const isEquip=referenceCategory==='equipment';
  const full=isEquip?referenceEquipmentPool():referenceEntries(referenceCategory);
  const totalBook=full.filter(e=>!e.custom).length,totalCustom=full.filter(e=>e.custom).length;
  $('#content').innerHTML=`<div class="ref-page">
<div class="rules-head"><h1 class="rules-page-title">${en?'Reference':'Référentiel'}</h1><p>${en?'All skills, spells, gear, special rules and traits — quick search by name, grouped by category. Use the ▤ button to browse categories.':'Toutes les compétences, sorts, objets, règles spéciales et traits — recherche rapide par nom, classées par catégorie. Utilise le bouton ▤ pour parcourir les catégories.'}</p></div>
<div class="ref-intro"><p>${en?'The Reference gathers everything ':'Le Référentiel regroupe tout ce qui est '}<b>${en?'official':'officiel'}</b>${en?': the core book rules and any custom rule officialized by an admin.':' : les règles du livre de base et toute règle personnalisée officialisée par un admin.'}</p></div>
<div class="ref-page-body">
${referenceSidebarMarkup()}
<div class="ref-main">
<input class="ref-search" type="text" value="${esc(referenceSearch)}" placeholder="${en?'Search an entry…':'Rechercher une entrée…'}" oninput="setReferenceSearch(this.value)">
<div class="ref-source-filters"><span class="lbl">${en?'Source':'Source'}</span><span class="ref-src-chip ${referenceSourceFilter==='all'?'active':''}" onclick="setReferenceSource('all')">${en?'All':'Tout'} (${full.length})</span><span class="ref-src-chip ${referenceSourceFilter==='book'?'active':''}" onclick="setReferenceSource('book')">${en?'Core book':'Livre de base'} (${totalBook})</span><span class="ref-src-chip ${referenceSourceFilter==='custom'?'active':''}" onclick="setReferenceSource('custom')">${en?'Custom':'Personnalisé'} (${totalCustom})</span></div>
<div class="reference-body" id="referenceBody">${referenceBodyMarkup()}</div>
</div>
</div>
<button type="button" class="rules-pages-nav-fab${referenceNavOpen?' open':''}" id="referenceNavFab" onclick="toggleReferenceNav()" aria-label="${en?'Browse categories':'Parcourir les catégories'}">▤</button>
${referenceNavPanelMarkup()}
</div>`;
}
let referenceSearchDebounce=null;
function setReferenceSearch(v){
  // V-SEARCHLAG: same fix as setEquipmentSearch — this rebuilt the entire
  // Référentiel gallery (every card in the active category, full text-search
  // filter included) on every single keystroke with no debounce, which
  // stutters badly once a category has more than a couple dozen entries.
  // The search input itself is untouched here (kept as a live, uncontrolled
  // field), only the expensive rebuild below is delayed briefly.
  referenceSearch=v;
  clearTimeout(referenceSearchDebounce);
  referenceSearchDebounce=setTimeout(()=>{
    const box=document.getElementById('referenceBody');if(box)box.innerHTML=referenceBodyMarkup();
  },160);
}
window.addEventListener('beforeprint',()=>printPrepare(null));
window.addEventListener('afterprint',()=>printCleanup());
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&String(e.key).toLowerCase()==='p'){e.preventDefault();openPrintPicker()}});
function accountDiagLocalMarkup(en){
  const m=state?.meta||{};
  const rows=[
    ['App build', APP_BUILD],
    [en?'Local revision':'Révision locale', toRev(m.cloudRevision)??'—'],
    [en?'Unsaved local edits':'Modifs locales non envoyées', m.cloudDirty?(en?'yes':'oui'):(en?'no':'non')],
    [en?'Save in progress':'Sauvegarde en cours', cloudSaveBusy?(en?'yes':'oui'):(en?'no':'non')],
    [en?'Retry pending':'Nouvelle tentative programmée', cloudRetryTimer?(en?'yes':'oui'):(en?'no':'non')],
    [en?'Last confirmed sync':'Dernière synchro confirmée', m.cloudUpdatedAt?new Date(m.cloudUpdatedAt).toLocaleString():'—'],
  ];
  const names=(arr,key)=>(arr||[]).map(x=>esc(x?.[key]||x?.name||x?.displayName||'?')).join(', ')||(en?'(none)':'(aucun)');
  const errBlock=lastCloudError?`<p class="diag-error"><b>${en?'Last sync error':'Dernière erreur de synchro'}</b>: [${esc(lastCloudError.where)}] ${esc(String(lastCloudError.status??'?'))} ${esc(lastCloudError.message)} — ${new Date(lastCloudError.at).toLocaleTimeString()}</p>`:'';
  return `<div class="diag-rows">${rows.map(([k,v])=>`<div class="account-data-row"><span>${esc(k)}</span><strong>${esc(String(v))}</strong></div>`).join('')}</div><div class="diag-lists"><p><b>${en?'Warbands':'Bandes'}</b>: ${names(state.rosters,'name')}</p><p><b>${en?'Custom warbands':'Warbands custom'}</b>: ${names(state.customWarbands,'displayName')}</p><p><b>${en?'Custom equipment':'Équipement custom'}</b>: ${names(state.customEquipment,'name')}</p><p><b>${en?'Custom fighters':'Combattants custom'}</b>: ${names(state.customFighters,'name')}</p>${errBlock}</div>`;
}
async function checkServerData(){
  const en=siteLanguage==='en';
  const box=$('#diagServerResult');
  if(box)box.innerHTML=`<p class="muted">${en?'Checking…':'Vérification…'}</p>`;
  try{
    // Read-only: fetches the server's current copy without touching local
    // state or pushing anything, so it's always safe to run mid-storm.
    const remote=await window.MordheimundaAPI.loadData();
    const p=remote?.payload||{};
    const names=(arr,key)=>(arr||[]).map(x=>esc(x?.[key]||x?.name||x?.displayName||'?')).join(', ')||(en?'(none)':'(aucun)');
    if(box)box.innerHTML=`<div class="account-data-row"><span>${en?'Server revision':'Révision serveur'}</span><strong>${esc(String(remote?.revision??'—'))}</strong></div><div class="diag-lists"><p><b>${en?'Warbands':'Bandes'}</b>: ${names(p.rosters,'name')}</p><p><b>${en?'Custom warbands':'Warbands custom'}</b>: ${names(p.customWarbands,'displayName')}</p><p><b>${en?'Custom equipment':'Équipement custom'}</b>: ${names(p.customEquipment,'name')}</p><p><b>${en?'Custom fighters':'Combattants custom'}</b>: ${names(p.customFighters,'name')}</p></div>`;
  }catch(e){if(box)box.innerHTML=`<p class="muted">${en?'Could not reach the server.':'Impossible de contacter le serveur.'}</p>`;}
}
function refreshAccountDiag(){const en=siteLanguage==='en';const box=$('#diagLocalResult');if(box)box.innerHTML=accountDiagLocalMarkup(en);}
function account(){
  const session=accountSession();const en=siteLanguage==='en';
  $('#content').innerHTML=`<div class="account-page"><div class="page-intro"><div><div class="eyebrow">ACCOUNT / PROFILE</div><h2>${en?'Account':'Compte'}</h2><p>${en?'Your account keeps your warbands and custom content available across devices.':'Votre compte conserve vos bandes et votre contenu personnalisé sur vos différents appareils.'}</p></div></div><div class="account-grid"><section class="card account-card"><div class="account-icon">◎</div><h3>${session?(en?'Signed in':'Connecté'):(en?'Not signed in':'Non connecté')}</h3>${session?`<p><strong>${esc(session.username||'')}</strong></p>${session.email?`<div class="account-email-row" data-testid="account-email-row"><span class="account-email-value">${esc(session.email)}</span>${session.emailVerified?`<span class="email-badge ok" data-testid="account-email-verified">✓ ${en?'Verified':'Confirmé'}</span>`:`<span class="email-badge warn" data-testid="account-email-unverified">${en?'Not confirmed':'Non confirmé'}</span><button type="button" class="text-button" data-testid="account-resend-verification-btn" onclick="resendVerificationUI()">${en?'Resend link':'Renvoyer le lien'}</button>`}</div>`:''}<div class="account-actions"><button class="button secondary" title="${en?'Use only if automatic sync is delayed or unavailable.':'À utiliser uniquement si la synchronisation automatique rencontre un problème.'}" onclick="syncCloudNow()">${en?'Force sync':'Synchroniser en cas de souci'}</button><button class="button secondary" onclick="logoutAccount()">${en?'Sign out':'Se déconnecter'}</button></div><details class="account-password"><summary>${en?'Change password':'Changer le mot de passe'}</summary><form onsubmit="changeAccountPassword(event)"><label>${en?'Current password':'Mot de passe actuel'}<input id="currentAccountPassword" type="password" minlength="10" required></label><label>${en?'New password':'Nouveau mot de passe'}<input id="newAccountPassword" type="password" minlength="10" required></label><button class="button secondary" type="submit">${en?'Change password':'Modifier le mot de passe'}</button></form></details><details class="account-password" data-testid="account-change-email"><summary>${en?'Change email':'Changer l’e-mail'}</summary><form onsubmit="changeAccountEmail(event)"><p class="muted" style="margin:0;font-size:12px">${en?'A confirmation link will be sent to the new address; your email will show as “not confirmed” until you click it.':'Un lien de confirmation sera envoyé à la nouvelle adresse ; l’e-mail apparaîtra « non confirmé » jusqu’au clic.'}</p><label>${en?'New email':'Nouvel e-mail'}<input id="newAccountEmail" type="email" autocomplete="email" required data-testid="new-email-input"></label><label>${en?'Current password':'Mot de passe actuel'}<input id="emailAccountPassword" type="password" autocomplete="current-password" required data-testid="email-password-input"></label><button class="button secondary" type="submit" data-testid="change-email-submit-btn">${en?'Change email':'Modifier l’e-mail'}</button></form></details>`:`<p>${en?'Sign in to synchronize your data between devices.':'Connectez-vous pour synchroniser vos données entre appareils.'}</p><div class="account-actions"><button class="button primary" onclick="openAccountAuth('login')">${en?'Sign in':'Se connecter'}</button><button class="button secondary" onclick="openAccountAuth('signup')">${en?'Create an account':'Créer un compte'}</button></div>`}</section><section class="card account-card"><div class="eyebrow">DATA</div><h3>${en?'Cloud storage':'Stockage cloud'}</h3><div class="account-data-row"><span>${en?'Local warbands':'Bandes locales'}</span><strong>${state.rosters.length}</strong></div><div class="account-data-row"><span>${en?'Custom content':'Contenu personnalisé'}</span><strong>${(state.customFighters||[]).length+(state.customEquipment||[]).length+(state.customSkills||[]).length+(state.customSpells||[]).length+(state.customWarbands||[]).length}</strong></div><p class="muted">${session?(en?'Changes are saved locally and synchronized to your account automatically.':'Les changements sont enregistrés localement puis synchronisés automatiquement avec votre compte.'):(en?'Your local data remains available without an account.':'Vos données locales restent disponibles sans compte.')}</p>${session?`<details class="account-diag" ${accountDiagOpen?'open':''} ontoggle="accountDiagOpen=this.open"><summary>${en?'Sync diagnostics':'Diagnostic de synchro'}</summary><div id="diagLocalResult">${accountDiagLocalMarkup(en)}</div><button type="button" class="button secondary" onclick="refreshAccountDiag()">${en?'Refresh (local)':'Rafraîchir (local)'}</button><hr><div id="diagServerResult"><p class="muted">${en?'Not checked yet.':'Pas encore vérifié.'}</p></div><button type="button" class="button secondary" onclick="checkServerData()">${en?'Check what the server has':'Vérifier ce que le serveur a'}</button></details>`:''}</section></div>
<div class="account-prefs card">
  <div class="eyebrow">${en?'PREFERENCES':'PRÉFÉRENCES'}</div><h3>${en?'Display':'Affichage'}</h3>
  <div class="acct-pref-row"><span>${en?'Help':'Aide'}<span class="acct-pref-sub">${en?'Tours, first steps, tips and what’s new':'Visites, premiers pas, astuces et nouveautés'}</span></span><button type="button" class="button secondary" onclick="openHelpMenu()">? ${en?'Open help':'Ouvrir l’aide'}</button></div>
  <div class="acct-pref-row"><span>${en?'Language':'Langue'}<span class="acct-pref-sub">${en?'':''}</span></span><select id="acctLanguageSelect" aria-label="Site language" onchange="setSiteLanguage(this.value)"><option value="en" ${siteLanguage==='en'?'selected':''}>English</option><option value="fr" ${siteLanguage==='fr'?'selected':''}>Français</option></select></div>
  <div class="acct-pref-row"><label style="display:flex;align-items:center;justify-content:space-between;width:100%;cursor:pointer"><span>${en?'Day mode':'Mode jour'}<span class="acct-pref-sub">${en?'White background, easier to read in bright light':'Fond blanc, plus lisible en plein soleil'}</span></span><span class="theme-switch"><input type="checkbox" class="theme-toggle-input" ${siteTheme==='light'?'checked':''}><i>☾</i></span></label></div><div class="acct-pref-row"><label style="display:flex;align-items:center;justify-content:space-between;width:100%;cursor:pointer"><span>${en?'Candle mode':'Mode bougie'}<span class="acct-pref-sub">${en?'Warm and dim, for evening games':'Chaud et tamisé, pour jouer le soir'}</span></span><span class="theme-switch"><input type="checkbox" class="candle-toggle-input" ${siteTheme==='candle'?'checked':''} onchange="toggleCandleTheme()"><i>✦</i></span></label></div>
  <div class="acct-pref-row"><label style="display:flex;align-items:center;justify-content:space-between;width:100%;cursor:pointer"><span>${en?'Candle mode in the evening':'Mode bougie le soir'}<span class="acct-pref-sub">${en?'Switches to Candle mode by itself from 8 pm to 7 am, and back in the morning. Only on this device.':'Passe tout seul en mode bougie de 20 h à 7 h, et revient le matin. Seulement sur cet appareil.'}</span></span><span class="theme-switch"><input type="checkbox" ${themeAutoOn()?'checked':''} onchange="setThemeAuto(this.checked)"><i>☾</i></span></label></div>
  <div class="acct-pref-row"><span>${en?'Animated background':'Fond animé'}<span class="acct-pref-sub">${en?'Drifting mist and rising embers over the city. Off in Day mode and when your phone asks for less motion. Only on this device.':'Brume qui dérive et cendres qui montent devant la ville. Coupé en mode Jour et si le téléphone demande moins d’animations. Seulement sur cet appareil.'}</span></span>${ambientSelectMarkup(en)}</div>
  <div class="acct-pref-row"><span>${en?'Interface size':'Taille de l’interface'}<span class="acct-pref-sub">${en?'Bigger text and buttons, for a phone that is hard to read. Only on this device.':'Textes et boutons plus grands, pour un téléphone difficile à lire. Seulement sur cet appareil.'}</span></span>${comfortSelectMarkup(en)}</div>
  <div class="acct-pref-row"><label style="display:flex;align-items:center;justify-content:space-between;width:100%;cursor:pointer"><span>${en?'Automatic translation':'Traduction automatique'}<span class="acct-pref-sub">${en?'In French, texts only written in English (rules, quests, scenarios…) are translated automatically':'En français, les textes écrits seulement en anglais (règles, quêtes, scénarios…) sont traduits automatiquement'}</span></span><span class="theme-switch"><input type="checkbox" aria-label="${en?'Automatic translation':'Traduction automatique'}" ${mtEnabled?'checked':''} onchange="setAutoTranslate(this.checked)"><i>文</i></span></label></div>
</div>
<div class="account-prefs card danger-zone">
  <div class="eyebrow">${en?'DATA':'DONNÉES'}</div><h3>${en?'Reset data':'Réinitialiser les données'}</h3>
  <p class="muted">${en?'Erases all your warbands. You will be asked to type a word to confirm.':'Efface toutes tes bandes. Il faudra taper un mot pour confirmer.'}</p>
  <button type="button" class="button danger" onclick="openResetData()">↻ ${en?'Reset data…':'Réinitialiser les données…'}</button>
</div>
<div class="account-friends card" ${session?'':'style="display:none"'}>
  <div class="eyebrow">SOCIAL</div><h3>${en?'Friends':'Amis'} <span class="new-badge">${en?'New':'Nouveau'}</span></h3>
  <p class="muted">${en?'A friend can never see your warbands or custom content — this is a contact list only.':'Un ami ne voit jamais tes bandes ni ton contenu personnalisé — c’est un simple carnet de contacts.'}</p>
  <form class="friend-search" onsubmit="sendFriendRequestUI(event)"><input id="friendIdentifier" placeholder="${en?'Username or email':'Pseudo ou e-mail'}" required><button class="button primary" type="submit">${en?'Send request':'Envoyer'}</button></form>
  <div id="friendsCardBody"><p class="muted">${en?'Loading…':'Chargement…'}</p></div>
</div>
${session&&isAdminSession()?`<div class="account-admin-support card">
  <div class="eyebrow">ADMIN</div><h3>${en?'Support access':'Support admin'} <span class="new-badge admin">${en?'New':'Nouveau'}</span></h3>
  <p class="muted">${en?'Read-only. Every lookup is logged and visible to the consulted user (Account → sync diagnostics).':'Lecture seule. Chaque consultation est journalisée et visible par l’utilisateur consulté (Compte → diagnostic de synchro).'}</p>
  <form class="friend-search" onsubmit="adminSupportSearchUI(event)"><input id="adminSupportQuery" placeholder="${en?'Search by username or email…':'Rechercher par pseudo ou e-mail…'}" required><button class="button secondary" type="submit">${en?'Search':'Rechercher'}</button></form>
  <div id="adminSupportResult"></div>
</div>
<div class="account-friends card account-admin-allusers">
  <div class="eyebrow">ADMIN</div><h3>${en?'All registered users':'Tous les utilisateurs'} <span class="new-badge admin">${en?'New':'Nouveau'}</span></h3>
  <p class="muted">${en?'Every account on the site. Click a name to open their warbands directly — this opens live-edit access (see Support access above) and is logged the same way.':'Tous les comptes du site. Cliquez sur un nom pour ouvrir directement ses bandes — cela ouvre un accès en édition live (voir Support admin ci-dessus) et est journalisé de la même façon.'}</p>
  <input id="allUsersFilter" placeholder="${en?'Filter…':'Filtrer…'}" oninput="renderAllUsersList()">
  <div id="allUsersListBody"><p class="muted">${en?'Loading…':'Chargement…'}</p></div>
</div>`:''}
${session?`<div class="account-access-log card">
  <div class="eyebrow">PRIVACY</div><h3>${en?'Who looked at my data':'Qui a consulté mes données'}</h3>
  <div id="accessLogBody"><p class="muted">${en?'Loading…':'Chargement…'}</p></div>
</div>`:''}
</div>`;
if(session){loadFriendsPanel();loadAccessLog();if(isAdminSession())loadAllUsersPanel();}
}
let allUsersCache=null;
async function loadAllUsersPanel(){
  const en=siteLanguage==='en',box=$('#allUsersListBody');if(!box)return;
  try{
    const {users}=await window.MordheimundaAPI.adminListAllUsers();
    allUsersCache=users;
    renderAllUsersList();
  }catch(e){allUsersCache=null;box.innerHTML=`<p class="muted">${authError(e,en)}</p>`}
}
function renderAllUsersList(){
  const en=siteLanguage==='en',box=$('#allUsersListBody');if(!box)return;
  if(!allUsersCache)return;
  const q=($('#allUsersFilter')?.value||'').trim().toLowerCase();
  const list=q?allUsersCache.filter(u=>(u.username||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q)):allUsersCache;
  box.innerHTML=`<p class="muted" style="margin:0 0 6px">${list.length}/${allUsersCache.length} ${en?'users':'utilisateurs'}</p>${list.length?list.map(u=>`<div class="friend-row"><span class="friend-avatar">${esc((u.username||'?')[0].toUpperCase())}</span><button class="text-button" style="font-weight:700" title="${en?'Open their warbands':'Ouvrir ses bandes'}" onclick="enterAdminForeignSession('${esc(u.id)}')">${esc(u.username)}</button><span class="muted" style="font-size:11px">${esc(u.email||'')}</span>${u.has_data?'':`<span class="muted" style="font-size:11px;font-style:italic">${en?'no data yet':'aucune donnée'}</span>`}</div>`).join(''):`<p class="muted">${en?'No match.':'Aucun résultat.'}</p>`}`;
}
async function changeAccountEmail(ev){
  ev.preventDefault();const en=siteLanguage==='en';
  try{
    const r=await window.MordheimundaAPI.changeEmail({newEmail:$('#newAccountEmail').value.trim(),currentPassword:$('#emailAccountPassword').value});
    if(r?.user)localStorage.setItem(ACCOUNT_SESSION_KEY,JSON.stringify(r.user));
    sessionStorage.removeItem('verifyBannerDismissed');
    render('account');
    toast(r.verificationSent?(en?'Email changed — check your inbox to confirm it':'E-mail modifié — consulte ta boîte pour le confirmer'):(en?'Email changed, but the confirmation mail failed. Use “Resend link”.':'E-mail modifié, mais l’envoi du lien a échoué. Utilise « Renvoyer le lien ».'));
  }catch(e){toast(authError(e,en));}
}
async function resendVerificationUI(){const en=siteLanguage==='en';try{const r=await window.MordheimundaAPI.resendVerification();if(r?.alreadyVerified){const s=accountSession();if(s){s.emailVerified=true;localStorage.setItem(ACCOUNT_SESSION_KEY,JSON.stringify(s));}render('account');toast(en?'Email already confirmed':'E-mail déjà confirmé');return;}toast(en?'Confirmation email sent':'E-mail de confirmation envoyé');}catch(e){toast(authError(e,en));}}
async function sendFriendRequestUI(ev){ev.preventDefault();const en=siteLanguage==='en',identifier=$('#friendIdentifier')?.value.trim();if(!identifier)return;try{await window.MordheimundaAPI.sendFriendRequest(identifier);$('#friendIdentifier').value='';toast(en?'Request sent':'Demande envoyée');loadFriendsPanel();}catch(e){toast(authError(e,en));}}
async function loadAccessLog(){
  const en=siteLanguage==='en',box=$('#accessLogBody');if(!box)return;
  try{
    const {entries}=await window.MordheimundaAPI.accountAccessLog();
    box.innerHTML=entries.length?`<ul class="access-log-list">${entries.map(e=>`<li>${esc(e.admin_username)} — ${e.action==='edit'?(en?'<b>edited</b>':'<b>a modifié</b>'):(en?'viewed':'a consulté')} — ${new Date(e.accessed_at).toLocaleString(en?'en-US':'fr-FR')}</li>`).join('')}</ul>`:`<p class="muted">${en?'No one has looked at your data.':'Personne n’a consulté tes données.'}</p>`;
  }catch(e){box.innerHTML='';}
}
async function logoutAccount(){await leaveForeignState();try{await window.MordheimundaAPI.logout()}catch{}stopCloudPolling();localStorage.removeItem(ACCOUNT_SESSION_KEY);refreshAdminNavVisibility();render('account');toast(siteLanguage==='en'?'Signed out':'Déconnecté');}
async function syncCloudNow(){
  const en=siteLanguage==='en';
  if(foreignStateOpen())return toast(en?'Exit the viewing mode first (banner at the top).':'Quitte d’abord le mode consultation (bandeau en haut).');
  try{
    // This used to trust `cloudDirty` to decide whether pulling-and-
    // overwriting local state was safe. That trust was misplaced two ways,
    // both reproduced live: (1) a push can fail silently in the background
    // (flushCloudSave swallows its own errors to retry later) while this
    // function had already moved on and overwritten local state; (2)
    // cloudDirty can be `false` — meaning "this device's last push
    // succeeded" — while the server no longer has that data, because
    // something else (another device, or the historical null-revision bug)
    // has since overwritten it server-side. In that second case the local
    // copy is the ONLY surviving copy, and a pull-and-overwrite destroys it
    // even though, from this device's point of view, nothing looked wrong.
    // So this no longer trusts any local flag at all: it always fetches
    // the server's current copy, unions it with whatever is here (a merge
    // can only add content, never remove it), and pushes that union back.
    // Content that only exists on this device can never be lost this way,
    // regardless of what cloudDirty claims before or after.
    const remote=await window.MordheimundaAPI.loadData();
    if(foreignStateOpen())return;
    const remoteData=remote?.payload||{};
    const remoteRevision=toRev(remote?.revision)??1;
    // V-PLAYSESSIONLOCK: see resolveCloudConflictAndRetry — keep this
    // device's own live Play Mode state out of the cross-device union.
    const keepPlaySession=state?.playSession||null;
    const merged=mergeAccountData(remoteData,state);
    merged.playSession=keepPlaySession;
    merged.meta={...(state.meta||{}),cloudRevision:remoteRevision,cloudDirty:true};
    state=window.MordheimundaStorage.save(merged);
    scheduleRemoteRerender();
    await flushCloudSave();
    startCloudPolling();render('account');
    toast(en?'Cloud synchronized':'Cloud synchronisé');
  }catch(e){recordCloudError('syncCloudNow',e);toast(authError(e,en));}
}
async function changeAccountPassword(ev){ev.preventDefault();const en=siteLanguage==='en';try{await window.MordheimundaAPI.changePassword({currentPassword:$('#currentAccountPassword').value,newPassword:$('#newAccountPassword').value});toast(en?'Password changed':'Mot de passe modifié');$('#currentAccountPassword').value='';$('#newAccountPassword').value='';}catch(e){toast(authError(e,en));}}
function publishedLocalItems(){
  const out=[];
  customFighterList().forEach(w=>out.push({kind:'fighters',w}));
  customEquipmentList().forEach(w=>out.push({kind:'equipment',w}));
  customCreatureList().forEach(w=>out.push({kind:'creatures',w}));
  ['traits','skills','spells','special'].forEach(k=>customContentList(k).forEach(w=>out.push({kind:k,w})));
  return out;
}
let publishedEditsPending=null;
async function openPublishEdits(){
  const en=siteLanguage==='en';
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'PUBLISH MY EDITS':'PUBLIER MES MODIFICATIONS'}</div><h2>${en?'Comparing with what is online…':'Comparaison avec le contenu en ligne…'}</h2></div>`);
  try{
    const targets=await publishedLoadTargets();const plan=publishedPlanFor(targets,publishedLocalItems());
    publishedEditsPending={targets,plan};
    const rows=plan.map((p,i)=>`<label class="custom-check"><input type="checkbox" class="pubEditCheck" data-i="${i}" checked> <span><b>${esc(customCleanupTypeLabel(p.kind))} · ${esc(p.w.name)}</b><small>${esc(p.targetName)}${p.status&&p.status!=='published'?` (${esc(p.status)})`:''}</small></span></label>`).join('');
    openModal(`<div class="delete-dialog" style="text-align:left"><div class="eyebrow">${en?'PUBLISH MY EDITS':'PUBLIER MES MODIFICATIONS'}</div><h2>${plan.length?(en?`${plan.length} published item${plan.length>1?'s':''} differ online`:`${plan.length} élément${plan.length>1?'s':''} publié${plan.length>1?'s':''} différent${plan.length>1?'s':''} en ligne`):(en?'Everything online is up to date':'Tout est à jour en ligne')}</h2><p class="muted">${en?'Your local Custom version replaces the online one, for every player. Untick anything you edited directly online (Admin → Manage) and want to keep.':'Ta version locale (Custom) remplace celle en ligne, pour tous les joueurs. Décoche ce que tu as modifié directement en ligne (Admin → Gestion) et veux garder.'}</p>${plan.length?`<div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow:auto;margin:10px 0">${rows}</div><button type="button" class="big-delete" style="background:var(--accent,#9dfa3c);color:#132007" onclick="confirmPublishEdits()">⇪ ${en?'PUBLISH':'PUBLIER'}</button>`:''}<button type="button" class="button secondary full" onclick="closeModal()">${en?'Close':'Fermer'}</button></div>`);
  }catch(e){openModal(`<div class="delete-dialog"><p>${authError(e,en)}</p><button type="button" class="button secondary full" onclick="closeModal()">OK</button></div>`)}
}
async function confirmPublishEdits(){
  const en=siteLanguage==='en';const pend=publishedEditsPending;if(!pend)return closeModal();
  const keep=new Set([...document.querySelectorAll('.pubEditCheck:checked')].map(x=>Number(x.dataset.i)));
  const plan=pend.plan.filter((_,i)=>keep.has(i));
  try{const n=await publishedApplyPlan(pend.targets,plan);publishedEditsPending=null;adminOfficialCache=null;await loadOfficialWarbands();closeModal();render('custom');toast(en?`⇪ ${n} update${n!==1?'s':''} published`:`⇪ ${n} mise${n!==1?'s':''} à jour publiée${n!==1?'s':''}`)}
  catch(e){toast(authError(e,en))}
}
// V-WARBANDDRAFTIMPORT: bring a warband package (fighters, equipment,
// special rules, warband rules) into Custom so it can be checked and
// translated before use. Same conversion as importOfficialWarbandForEditing,
// fed from a bundled draft (data/drafts) or a .json file instead of the API.
// Rules and equipment already in Custom are reused by name, never duplicated.
function importCustomWarbandPackage(pkg){
  const en=siteLanguage==='en';
  if(!pkg||!Array.isArray(pkg.warriors)){toast(en?'This file is not a warband package':'Ce fichier n’est pas une bande à importer');return null}
  if(!Array.isArray(state.customFighters))state.customFighters=[];
  if(!Array.isArray(state.customEquipment))state.customEquipment=[];
  customWarbandList();
  const cwId=crypto.randomUUID();
  const specialEntries=(pkg.specialRules||[]).map(r=>{const e=ensureCustomContent('special',r);if(e&&!e.text&&r.text)e.text=r.text;return e}).filter(Boolean);
  const traitEntries=(pkg.traits||[]).map(r=>ensureCustomContent('traits',r)).filter(Boolean);
  const equipmentIds=(pkg.equipment||[]).map(e=>{const found=customEquipmentList().find(x=>normName(x.name)===normName(e.name));if(found)return found.customEquipmentId;const d=equipmentToCustomDraft(e);if(e.rarity)d.rarity=e.rarity;d.market=e.market!==false;state.customEquipment.push(d);return d.customEquipmentId}).filter(Boolean);
  const fighterIds=pkg.warriors.map(w=>{const d=warriorToCustomFighterDraft(w,cwId);d.maxMode='auto';d.manualMaxProfile=null;state.customFighters.push(d);return d.customFighterId});
  const bandNames=new Set((pkg.bandRuleNames||[]).map(normName));
  const pick=list=>list.filter(e=>!bandNames.size||bandNames.has(normName(e.name))).map(e=>e.customContentId);
  let name=String(pkg.name||'Imported warband').trim();const taken=new Set(customWarbandList().map(c=>normName(c.name)));if(taken.has(normName(name))){let k=2;while(taken.has(normName(`${name} ${k}`)))k++;name=`${name} ${k}`}
  const cw={id:cwId,name,description:String(pkg.description||''),choices:pkg.choices&&typeof pkg.choices==='object'?JSON.parse(JSON.stringify(pkg.choices)):null,fighterIds,equipmentIds,fighterRefs:fighterIds.map(id=>`custom:${id}`),equipmentRefs:equipmentIds.map(id=>`custom:${id}`),specialRuleIds:pick(specialEntries),traitIds:pick(traitEntries)};
  state.customWarbands.push(cw);
  save(true);
  customArea='warband';customContentTab='warband';customWarbandEditId=cwId;customWarbandCreating=false;customWarbandSection='fighters';
  render('custom');
  toast(en?`${name} imported into Custom: ${fighterIds.length} fighters, ${equipmentIds.length} items, ${specialEntries.length} rules`:`${name} importée dans Custom : ${fighterIds.length} combattants, ${equipmentIds.length} objets, ${specialEntries.length} règles`,3500);
  return cw;
}
async function openImportWarbandPicker(){
  const en=siteLanguage==='en';let drafts=[];
  try{const res=await fetch('/data/drafts/index.json',{cache:'no-store'});if(res.ok)drafts=await res.json()}catch(e){}
  openModal(`<div class="skill-dialog"><div class="eyebrow">${en?'CUSTOM · IMPORT':'CUSTOM · IMPORT'}</div><h2>${en?'Import a warband':'Importer une warband'}</h2><p class="sheet-help">${en?'Adds the fighters, equipment and rules to Custom so you can check and edit them. Nothing is published.':'Ajoute les combattants, l’équipement et les règles dans Custom pour que tu puisses les vérifier et les modifier. Rien n’est publié.'}</p>${Array.isArray(drafts)&&drafts.length?`<div class="eyebrow" style="margin-top:12px">${en?'DRAFTS READY TO REVIEW':'BROUILLONS À VÉRIFIER'}</div><div class="custom-item-list">${drafts.map(d=>`<button type="button" class="skill-modal-skill" style="width:100%;text-align:left" onclick="importBundledWarbandDraft('${esc(d.file)}')"><strong>${esc(d.name)}</strong><small>${esc(d.source||'')}</small></button>`).join('')}</div>`:''}<div class="custom-actions" style="margin-top:14px"><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" onclick="pickWarbandPackageFile()">${en?'Import a .json file':'Importer un fichier .json'}</button></div></div>`);
}
async function importBundledWarbandDraft(file){
  const en=siteLanguage==='en';if(!/^[a-z0-9-]+\.json$/i.test(String(file)))return;
  try{const res=await fetch('/data/drafts/'+file,{cache:'no-store'});if(!res.ok)throw new Error(res.status);const pkg=await res.json();closeModal();importCustomWarbandPackage(pkg)}
  catch(e){toast(en?'Could not load this draft':'Impossible de charger ce brouillon')}
}
function pickWarbandPackageFile(){
  const en=siteLanguage==='en';const input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.style.display='none';
  input.onchange=()=>{const f=input.files?.[0];input.remove();if(!f)return;const rd=new FileReader();rd.onload=()=>{try{const pkg=JSON.parse(String(rd.result||''));closeModal();importCustomWarbandPackage(pkg)}catch(e){toast(en?'Invalid JSON file':'Fichier JSON invalide')}};rd.readAsText(f)};
  document.body.appendChild(input);input.click();
}
function setAutoTranslate(on){mtEnabled=!!on;try{localStorage.setItem(MT_OFF_KEY,on?'0':'1')}catch(e){}renderCurrentRoute()}
let playPickerCategoryFilter='all';
function setPlayPickerCategoryFilter(c){playPickerCategoryFilter=c;render('playMode')}
function playPickerCardMarkup(s,en){
  const bandsCount=s.bandsMin===s.bandsMax?s.bandsMin:`${s.bandsMin}–${s.bandsMax}`;
  const playable=(s.bandsMax||1)>=2;
  return `<div class="scn-card" style="display:flex;flex-direction:column;gap:10px;padding:16px${playable?'':';opacity:.6'}">${s.thumbnail?`<div class="pp-banner"><img src="${esc(imgSrc(s.thumbnail))}"${imageFocusStyle(s.thumbnailFocus)} alt="" loading="lazy" decoding="async"></div>`:''}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <h3 style="margin:0;font:700 16px 'Cinzel'">${esc(s.name)}</h3>
      ${scenarioCategoryTagsMarkup(s,en,true)}
    </div>
    <p style="margin:0;font-size:12.5px;color:var(--muted2);line-height:1.6;flex:1">${esc(s.summary||'')}</p>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span class="chip">👥 ${bandsCount}</span>
      ${playable?`<button type="button" class="dash-btn-primary" onclick="playStartScenario('${esc(s.id)}')">▶ ${en?'Play':'Jouer'}</button>`:`<span class="muted" style="font-size:11px;font-style:italic">${en?'no multiplayer deployment':'pas de déploiement multijoueur'}</span>`}
    </div>
  </div>`;
}
function playPickerMarkup(){
  const en=siteLanguage==='en';
  const cats=['all','1v1','multiplayers','campaign','event','history'];
  const list=SCENARIOS_CACHE.filter(s=>playPickerCategoryFilter==='all'||scenarioCategoriesOf(s).includes(playPickerCategoryFilter));
  return `<div class="rules-shell-wrap">
    <div class="page-intro"><div><div class="eyebrow">PLAY MODE</div><h2>${en?'Choose a game':'Choisis une partie'}</h2><p>${en?'Pick the scenario you’re about to play — its full sheet shows below, then warband/alliance assignment, then the generated deployment.':'Sélectionne le scénario que vous allez jouer — sa fiche complète s’affiche ensuite, suivie de l’assignation des bandes et alliances, puis du déploiement généré.'}</p></div></div>
    <div class="scn-filters">${cats.map(c=>`<button type="button" class="scn-filter ${playPickerCategoryFilter===c?'active':''}" onclick="setPlayPickerCategoryFilter('${c}')">${c==='all'?(en?'All':'Tous'):scenarioCategoryLabel(c,en)}</button>`).join('')}</div>
    ${list.length?`<div class="scn-grid">${list.map(s=>playPickerCardMarkup(s,en)).join('')}</div>`:`<div class="empty compact">${en?'No scenarios published yet.':'Aucun scénario publié pour l’instant.'}</div>`}
  </div>`;
}
function playMode(){
  if(state.playSession?.shared){playShareLastCheck=Math.min(playShareLastCheck,Date.now()-10000);setTimeout(()=>{try{playShareCheck(false)}catch(e){}},0)}
  $('#content').innerHTML=state.playSession?playSessionMarkup():playKind==='skirmish'?playSkirmishMarkup():playKind==='campaign'?playCampaignSetupMarkup():playChoiceMarkup();
}
// ===== V-PLAYKIND: Play Mode starts with a choice — Campaign or Skirmish =====
// Skirmish = the scenario picker as before. Campaign = pick one of your
// campaigns, its warbands, a scenario (favoured / 2D6 table / any); the
// game then carries ps.campaignId so the campaign's conditions (weather,
// hazards) apply and are rolled at the start, and the result goes to the
// campaign's Battles.
let playKind=null,playCampDraft=null;
function setPlayKind(k){playKind=k;if(k==='campaign'&&!playCampDraft)playCampDraft={cid:null,picks:[],scenarioId:null,roll:null};render('playMode')}
function playMyCampaigns(){const by=new Map();(state.rosters||[]).filter(r=>r.campaignId).forEach(r=>{if(!by.has(r.campaignId))by.set(r.campaignId,{id:r.campaignId,name:r.campaignName||'',color:r.campaignColor,rosters:[]});by.get(r.campaignId).rosters.push(r)});return [...by.values()]}
function playChoiceMarkup(){
  const en=siteLanguage==='en';const camps=playMyCampaigns();const c0=camps[0]?campaignDetailCached(camps[0].id):null;
  const li=t=>`<li>${esc(t)}</li>`;
  return `<div class="ref-page play-choice"><div class="rules-head"><div class="eyebrow">${en?'WARBAND MANAGER':'GESTION DE BANDE'}</div><h1 class="rules-page-title">Play Mode</h1><p>${en?'What kind of game are you setting up?':'Quel type de partie prépares-tu ?'}</p></div>${playInvitesMarkup()}
   <div class="pk-grid">
    <button type="button" class="pk-card camp" style="--cc:${campaignColor(c0||camps[0]||null)}" onclick="setPlayKind('campaign')">${c0&&!c0.missing?campaignCoverMarkup(c0,'pk-img'):`<div class="pk-img camp-cover-empty" aria-hidden="true"></div>`}<div class="pk-over">${camps.length?`<span class="pk-flag">${camps.length} ${en?(camps.length>1?'CAMPAIGNS':'CAMPAIGN'):(camps.length>1?'CAMPAGNES':'CAMPAGNE')}</span>`:''}<span class="pk-kicker">${en?'PLAY FOR':'JOUER EN'}</span><h2>${en?'Campaign':'Campagne'}</h2></div>
     <div class="pk-body"><p>${en?'A game that counts. Pick the campaign — its rules switch on by themselves:':'Une partie qui compte. Choisis la campagne — ses règles s’activent toutes seules :'}</p><ul>${[en?'Only that campaign’s warbands':'Seulement les bandes de cette campagne',en?'Scenario: favoured one, or roll on the campaign table':'Scénario : le favori, ou 2D6 sur la table de la campagne',en?'Weather and hazards rolled at the start':'Météo et dangers lancés au début',en?'Exploration chart and Treasure in post-battle':'Table d’exploration et Trésor en post-bataille',en?'The result is sent to the campaign’s Battles':'Le résultat part dans les Batailles de la campagne'].map(li).join('')}</ul><span class="button primary pk-btn">${en?'Play a campaign game':'Jouer une partie de campagne'} ▸</span></div></button>
    <button type="button" class="pk-card" onclick="setPlayKind('skirmish')"><div class="pk-img pk-img-sk" aria-hidden="true"></div><div class="pk-over"><span class="pk-kicker">${en?'PLAY FOR':'JOUER EN'}</span><h2>${en?'Skirmish':'Escarmouche'}</h2></div>
     <div class="pk-body"><p>${en?'A one-off game with any warbands — the Play Mode you know:':'Une partie isolée avec n’importe quelles bandes — le Play Mode habituel :'}</p><ul>${[en?'Any of your warbands, or friends’':'Tes bandes ou celles d’amis',en?'Any scenario':'N’importe quel scénario',en?'Basic market and post-battle':'Marché et post-bataille de base',en?'Nothing is recorded in a campaign':'Rien n’est enregistré en campagne'].map(li).join('')}</ul><span class="button secondary pk-btn">${en?'Play a skirmish':'Jouer une escarmouche'} ▸</span></div></button>
   </div></div>`;
}
function playBackToChoice(){playKind=null;render('playMode')}
function playSkirmishMarkup(){const en=siteLanguage==='en';return `<div class="pk-back"><a href="#" onclick="playBackToChoice();return false;">← Play Mode</a></div>`+playPickerMarkup()}
// --- campaign setup
function playCampPick(cid){const d=playCampDraft;d.cid=cid;d.picks=(state.rosters||[]).filter(r=>r.campaignId===cid).slice(0,1).map(r=>r.id);d.scenarioId=null;d.roll=null;render('playMode')}
function playCampToggle(rid){const d=playCampDraft;const i=d.picks.indexOf(rid);if(i>=0)d.picks.splice(i,1);else d.picks.push(rid);render('playMode')}
function playCampScenario(sid){playCampDraft.scenarioId=sid;render('playMode')}
function playCampRoll(){const d=playCampDraft;const c=campaignDetailCache.get(d.cid);if(!campaignFeatureOn(c,'scenarioTable'))return;const kind=d.picks.length>2?'multi':'two';const t=c.definition.scenarioTable[kind];if(!t)return;const dice=[postBattleRoll(),postBattleRoll()];const name=t[dice[0]+dice[1]]||'—';d.roll={kind,dice,total:dice[0]+dice[1],name};const m=campaignScenarioMatches(name);d.scenarioId=m[0]?.id||d.scenarioId;render('playMode')}
// V-SCNPIC: the chosen scenario as a card with its picture (if it has one)
function playChosenScenarioMarkup(sel,en){return `<div class="pc-chosen-card${sel.thumbnail?' has-img':''}">${sel.thumbnail?`<div class="pc-chosen-img"><img src="${esc(sel.thumbnail)}"${imageFocusStyle(sel.thumbnailFocus)} alt="" decoding="async"></div>`:''}<div class="pc-chosen-body"><span class="micro-label">${en?'CHOSEN SCENARIO':'SCÉNARIO CHOISI'}</span><b>${esc(sel.name)}</b>${sel.summary?`<small>${esc(sel.summary)}</small>`:''}<a href="#" onclick="navigateApp('/rules/scenarios/'+encodeURIComponent('${esc(sel.id)}'));return false;">${en?'Read the scenario →':'Lire le scénario →'}</a></div></div>`}
function playCampaignSetupMarkup(){
  const en=siteLanguage==='en';const d=playCampDraft;const camps=playMyCampaigns();
  if(!d.cid&&camps.length===1)d.cid=camps[0].id,d.picks=camps[0].rosters.slice(0,1).map(r=>r.id);
  const head=`<div class="pk-back"><a href="#" onclick="playBackToChoice();return false;">← Play Mode</a></div><div class="rules-head"><div class="eyebrow">${en?'PLAY FOR CAMPAIGN':'JOUER EN CAMPAGNE'}</div><h1 class="rules-page-title">${en?'New campaign game':'Nouvelle partie de campagne'}</h1></div>`;
  if(!camps.length)return `<div class="ref-page">${head}<div class="mc-none"><strong>${en?'None of your warbands is in a campaign yet.':'Aucune de tes bandes n’est encore en campagne.'}</strong><p>${en?'Join one from My Campaigns, or play a skirmish.':'Rejoins-en une depuis Mes campagnes, ou joue une escarmouche.'}</p><div class="custom-actions" style="justify-content:center"><button type="button" class="button primary" onclick="navigateApp('/campaigns')">${en?'My Campaigns':'Mes campagnes'}</button><button type="button" class="button secondary" onclick="setPlayKind('skirmish')">${en?'Play a skirmish':'Jouer une escarmouche'}</button></div></div></div>`;
  const campCards=camps.map(c=>{const det=campaignDetailCached(c.id);if(!det)loadCampaignDetail(c.id,'playMode');const full=det&&!det.missing?det:c;const on=d.cid===c.id;const feats=det&&!det.missing?[campaignFeatureOn(det,'conditions')&&(en?'weather & hazards':'météo & dangers'),campaignFeatureOn(det,'exploration')&&(en?'exploration':'exploration'),det.definition?.settlements?.length&&(en?'residences':'résidences')].filter(Boolean).join(' · '):'';
    return `<button type="button" class="pc-camp${on?' on':''}" style="--cc:${campaignColor(full)}" onclick="playCampPick('${esc(c.id)}')">${campaignCoverMarkup(full,'pc-camp-img')}<span class="pc-camp-body"><b>${esc(full.name||c.name)}</b><small>${esc(campaignMembersLabel(full))}${feats?` · ${esc(feats)}`:''}</small>${on?`<span class="pc-on">✓ ${en?'CHOSEN':'CHOISIE'}</span>`:''}</span></button>`}).join('');
  let rest='';
  if(d.cid){
    const c=campaignDetailCached(d.cid);const col=campaignColor(c||camps.find(x=>x.id===d.cid));
    if(!c||c.missing)rest=`<p class="muted">${en?'Loading the campaign…':'Chargement de la campagne…'}</p>`;
    else{
      const mineIds=new Set((state.rosters||[]).filter(r=>r.campaignId===c.id).map(r=>r.id));
      const members=(c.members||[]).filter(m=>!m.leftAt);(state.rosters||[]).filter(r=>r.campaignId===c.id&&!members.some(m=>m.rosterId===r.id)).forEach(r=>members.unshift({rosterId:r.id,rosterName:r.name,faction:faction(r)?.name||''}));
      const setts=c.definition?.settlements||[];
      const bands=members.map(m=>{const on=d.picks.includes(m.rosterId);const r=(state.rosters||[]).find(x=>x.id===m.rosterId);const resId=r?.campaignResidence||m.stats?.residence;const res=setts.find(x=>x.id===resId);return `<button type="button" class="pc-band${on?' on':''}" onclick="playCampToggle('${esc(m.rosterId)}')" aria-pressed="${on}"><i aria-hidden="true">${on?'✓':''}</i><span><b>${esc(m.rosterName||'—')}</b><small>${esc(m.faction||'')}${mineIds.has(m.rosterId)?` · ${en?'you':'toi'}`:m.username?` · ${esc(m.username)}`:''}</small></span><em>${res?esc(res.name):(en?'no residence':'sans résidence')}</em></button>`}).join('');
      const fav=c.definition?.favoredScenario;const favS=fav?.id?SCENARIOS_CACHE.find(x=>x.id===fav.id):fav?.name?campaignScenarioMatches(fav.name)[0]:null;
      const sel=SCENARIOS_CACHE.find(x=>x.id===d.scenarioId);const tableOn=campaignFeatureOn(c,'scenarioTable');
      const scn=`${favS?`<button type="button" class="pc-fav${d.scenarioId===favS.id?' on':''}${favS.thumbnail?' has-img':''}" onclick="playCampScenario('${esc(favS.id)}')">${favS.thumbnail?`<img class="pc-fav-img" src="${esc(favS.thumbnail)}"${imageFocusStyle(favS.thumbnailFocus)} alt="" loading="lazy" decoding="async">`:''}<span class="pc-fav-txt"><span class="micro-label">★ ${en?'FAVOURED THIS ROUND':'FAVORI DE LA MANCHE'}</span><b>${esc(favS.name)}</b>${fav.note?`<small>${esc(fav.note)}</small>`:''}</span></button>`:''}
        ${tableOn?`<div class="pc-roll"><button type="button" class="button secondary" onclick="playCampRoll()">🎲 ${en?'Roll 2D6 on the campaign table':'Lancer 2D6 sur la table de la campagne'}</button>${d.roll?`<span class="pc-roll-res"><span class="cpb-art-dice">${d.roll.dice.map(v=>`<i>${v}</i>`).join('')}</span><b>${d.roll.total} · ${esc(d.roll.name)}</b></span>`:''}</div><small class="muted">${en?'2 warbands use the “two players” table, 3 or more the “multiplayer” one.':'2 bandes : table « deux joueurs », 3 ou plus : table « multijoueur ».'}</small>`:''}
        <label class="custom-field"><span>${en?'Or choose any scenario':'Ou choisis n’importe quel scénario'}</span><select onchange="playCampScenario(this.value)"><option value="">—</option>${SCENARIOS_CACHE.map(x=>`<option value="${esc(x.id)}" ${x.id===d.scenarioId?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
        ${sel?playChosenScenarioMarkup(sel,en):''}`;
      const condOn=campaignFeatureOn(c,'conditions'),explOn=campaignFeatureOn(c,'exploration');
      const rules=[[en?'Weather':'Météo',condOn,en?'START · 2D6':'DÉBUT · 2D6',en?'Rolled once on the campaign weather chart; shown on the game screen.':'Lancée une fois sur la table météo de la campagne ; affichée pendant la partie.'],[en?'Hazards':'Dangers',condOn,en?'START · D6 EACH':'DÉBUT · D6 CHACUN',en?'One D6 per fighter taking part: every 1 is a hazard (3D6).':'Un D6 par combattant qui prend part : chaque 1 est un danger (3D6).'],[en?'Residence':'Résidence',setts.length>0,en?'ALWAYS':'TOUJOURS',en?'Each warband’s settlement bonuses apply to its fighters and its market.':'Les bonus de la colonie de chaque bande s’appliquent à ses combattants et à son marché.'],[en?'Exploration':'Exploration',explOn,en?'POST-BATTLE':'POST-BATAILLE',en?'The campaign’s exploration chart replaces the basic one.':'La table d’exploration de la campagne remplace celle de base.'],[en?'Market':'Marché',true,en?'POST-BATTLE':'POST-BATAILLE',en?'Shared campaign stock; Band List purchases arrive after the next game.':'Stock partagé de la campagne ; les achats Band List arrivent après la partie suivante.'],[en?'Result':'Résultat',true,en?'END':'FIN',en?'Recorded in the campaign’s Battles for the other players to confirm.':'Enregistré dans les Batailles de la campagne, à confirmer par les autres joueurs.']];
      const ready=d.picks.length>=2&&sel;
      rest=`<div class="pc-two"><section class="hub-panel"><div class="hub-panel-head"><h2>2 · ${en?'Warbands':'Bandes'}</h2><small>${d.picks.length} ${en?'chosen':'choisie(s)'}</small></div><small class="muted">${en?'Only the warbands entered in this campaign.':'Seulement les bandes inscrites dans cette campagne.'}</small>${bands}</section>
        <section class="hub-panel"><div class="hub-panel-head"><h2>3 · ${en?'Scenario':'Scénario'}</h2></div>${scn}</section></div>
        <section class="hub-panel pc-rules" style="--cc:${col}"><div class="hub-panel-head"><h2>4 · ${en?'Campaign rules for this game':'Règles de campagne pour cette partie'}</h2><small>${en?'switched on by the campaign':'activées par la campagne'}</small></div><div class="pc-rules-grid">${rules.map(([t,on,when,txt])=>`<div class="pc-rule${on?'':' off'}"><div><b>${esc(t)}</b><span>${on?esc(when):(en?'OFF':'INACTIF')}</span></div><small>${esc(txt)}</small></div>`).join('')}</div></section>
        <div class="pc-start"><small class="muted">${ready?'':(en?'Choose at least 2 warbands and a scenario.':'Choisis au moins 2 bandes et un scénario.')}</small><button type="button" class="button primary pc-go" ${ready?'':'disabled'} onclick="playCampStart()">${en?'Start the game':'Lancer la partie'} ▸</button></div>`;
    }
  }
  return `<div class="ref-page play-camp">${head}<section class="hub-panel"><div class="hub-panel-head"><h2>1 · ${en?'Campaign':'Campagne'}</h2></div><div class="pc-camps">${campCards}</div></section>${rest}</div>`;
}
function playCampStart(){
  const d=playCampDraft;const c=campaignDetailCache.get(d.cid);const s=SCENARIOS_CACHE.find(x=>x.id===d.scenarioId);if(!c||!s||d.picks.length<2)return;
  const ps=blankPlaySession();ps.scenarioId=s.id;ps.campaignId=c.id;const sizes=(Array.isArray(s.tableSizes)&&s.tableSizes.length)?s.tableSizes:['48x48','48x72'];ps.tableSize=sizes[0];ps.numBands=d.picks.length;
  const members=c.members||[];ps.slots=d.picks.map((rid,i)=>{const r=(state.rosters||[]).find(x=>x.id===rid);if(r)return {...playSlotDefault(i),source:'own',rosterId:r.id,rosterName:r.name};const m=members.find(x=>x.rosterId===rid)||{};return {...playSlotDefault(i),source:'campaign',rosterId:rid,friendWarbandName:m.rosterName||'',friendUsername:m.username||''}});
  state.playSession=ps;playCondTab='scenario';save();
  // Weather is rolled at once; hazards too when every warband's fighters are known here (other players' warbands need their Hero/Henchman count typed in first).
  if(campaignFeatureOn(c,'conditions')){rollPlayWeather();if(ps.slots.every(sl=>playSlotRoster(sl)))rollPlayHazards()}
  render('playMode');
}
async function disableCampaignConditions(cid){const en=siteLanguage==='en';if(!await siteConfirm(en?'Turn off the conditions in Play? Your tables are kept.':'Désactiver les conditions en Play ? Tes tables sont conservées.'))return;await saveCampaignDefinition(cid,def=>{if(def.conditions)def.conditions.enabled=false})}
async function disableCampaignExploration(cid){const en=siteLanguage==='en';if(!await siteConfirm(en?'Use the book post-battle again for this campaign? Your chart is kept.':'Revenir à la post-bataille du livre pour cette campagne ? Ta table est conservée.'))return;await saveCampaignDefinition(cid,def=>{if(def.exploration)def.exploration.enabled=false})}
function campaignSections(c){const en=siteLanguage==='en';const d=c?.definition||{};const pages=(Array.isArray(d.pages)?d.pages:[]).map((p,i)=>({p,i})).sort((a,b)=>cmpCampaignPages(a.p,b.p));const arts=Array.isArray(d.artifacts)?d.artifacts:[];const st=d.settlements||[];const admin=isAdminEditUI();
  const out=[{id:'overview',label:en?'Presentation':'Présentation'}];let artsDone=false,stDone=false;
  const artsSec={id:'artifacts',label:`5. ${en?'Artifacts':'Artefacts'}`+(arts.length?` · ${arts.length}`:'')};stDone=true;const stSec={id:'settlements',label:`↳ ${en?'Settlement sheets':'Fiches des colonies'}`+(st.length?` · ${st.length}`:''),sub:true};
  pages.forEach(({p,i})=>{const o=campaignPageOrder(p.title);if(!artsDone&&(arts.length||admin)&&o[0]>5&&o[0]!==999){out.push(artsSec);artsDone=true}out.push({id:'rule-'+(p.id||i),label:p.title||(en?'Untitled':'Sans titre'),page:p,sub:o.length>1});if(!stDone&&(st.length||admin)&&/^1\.2\b/.test(String(p.title||'').trim())){out.push(stSec);stDone=true}});
  if(!artsDone&&(arts.length||admin))out.push(artsSec);if(!stDone&&(st.length||admin))out.push({...stSec,label:(en?'Settlements':'Colonies')+(st.length?` · ${st.length}`:''),sub:false});
  if(admin)out.push({id:'settlements',label:(en?'⚙ Settlements (admin)':'⚙ Colonies (admin)')+(st.length?` · ${st.length}`:'')});
  if(admin)out.push({id:'mechanics',label:en?'⚙ Setup (admin)':'⚙ Configuration (admin)'});
  return out}
const campaignNavOpen=new Map();
function toggleCampaignNavGroup(key,wasOpen){campaignNavOpen.set(key,!wasOpen);render('campaignDetail')}
function campaignDetail(){
  const en=siteLanguage==='en';const id=currentCampaignId;const c=campaignDetailCached(id);if(c&&!campaignDetailFresh.has(id))loadCampaignDetail(id,'campaignDetail');
  if(!c){loadCampaignDetail(id,'campaignDetail');$('#content').innerHTML=`<div class="empty large">${en?'Loading…':'Chargement…'}</div>`;return}
  if(c.missing){$('#content').innerHTML=`<div class="empty large"><strong>${en?'Campaign not found.':'Campagne introuvable.'}</strong><span><a href="#" onclick="navigateApp('/rules/campaign');return false;">${en?'← Back to Rules: Campaign':'← Retour à Règles : Campagne'}</a></span></div>`;return}
  const col=campaignColor(c);const secs=campaignSections(c);const cur=secs.find(x=>x.id===currentCampaignPage)||secs[0];const admin=isAdminEditUI();
  const members=(c.members||[]).filter(m=>!m.leftAt);
  const body=cur.id==='mechanics'?campaignMechanicsMarkup(c,admin):cur.id==='settlements'?campaignSettlementsMarkup(c,admin):cur.id==='artifacts'?campaignArtifactsMarkup(c,admin):cur.id==='overview'?`<div class="campaign-overview">${admin?`<button type="button" class="button primary setup-cta" onclick="currentCampaignPage='mechanics';render('campaignDetail')">⚙ ${en?'Campaign setup — turn features on':'Configuration de la campagne — activer les fonctions'} · ${campaignMechanicsList(c).filter(m=>m.on).length}/${campaignMechanicsList(c).length}</button>`:''}${admin?`<div class="campaign-page-edit"><button type="button" class="button secondary small" onclick="openCampaignPageEditor('${esc(c.id)}','overview')">✎ ${en?'Edit the presentation':'Modifier la présentation'}</button></div>`:''}${c.definition?.description?`<div class="rules-article-body campaign-text">${ruleTextMarkup(c.definition.description,{noTitle:true})}</div>`:`<p class="muted">${en?'No presentation yet.':'Pas encore de présentation.'}</p>`}
     <h3 class="campaign-h3">${en?'Warbands in this campaign':'Bandes dans cette campagne'} <small>${members.length}</small></h3>
     ${members.length?`<div class="campaign-members">${members.slice().sort((a,b)=>campaignStandingValue(b,campaignStandingKey(c))-campaignStandingValue(a,campaignStandingKey(c))).map((m,i)=>`<div class="campaign-member"><b>${i+1}. ${esc(m.rosterName||'—')}</b><small>${esc(m.faction||'')}${m.username?` · ${esc(m.username)}`:''}</small><span>${campaignStandingValue(m,campaignStandingKey(c))} ${esc(campaignStandingUnit(campaignStandingKey(c)))} <small class="muted">${esc(campaignStandingLabel(campaignStandingKey(c)))}</small></span></div>`).join('')}</div>`:`<p class="muted">${en?'No warband has joined yet.':'Aucune bande n’a encore rejoint.'}</p>`}</div>`
    :`<div class="rules-article-body campaign-text"><h2 class="campaign-page-title">${esc(cur.page.title||'')}${admin?` <button type="button" class="rule-edit-btn" title="${en?'Edit this page':'Modifier cette page'}" onclick="openCampaignPageEditor('${esc(c.id)}','${esc(cur.page.id||'')}')">✎</button>`:''}</h2>${campaignPageTextMarkup(cur.page.text||'',c,admin)}</div>`;
  // V-CAMPSTYLE: same frame as Rules: The Game (rules-shell, rules-nav,
  // crumb, rules-title), so a campaign reads like the rest of the rules.
  const split=l=>{const m=String(l||'').match(/^(?:↳\s*)?(\d+(?:\.\d+)*)\.?\s+(.*)$/);return m?{num:m[1]+(m[1].includes('.')?'':'.'),name:m[2]}:{num:'',name:String(l||'').replace(/^↳\s*/,'')}};
  const go=sid=>`event.preventDefault();currentCampaignPage='${esc(sid)}';render('campaignDetail')`;
  const item=sx=>{const t=split(String(sx.label));return `<a href="#" class="rn-item${sx.id===cur.id?' active':''}" onclick="${go(sx.id)}">${t.num?`<span class="rt-num">${esc(t.num)}</span>`:''}<span class="rt-name">${esc(t.name)}</span></a>`};
  // Groups like Rules: The Game — one per top number (1. with 1.1, 1.2 …),
  // collapsible; the group holding the open page starts open.
  const groups=[];const loose=[];secs.forEach(sx=>{const t=split(String(sx.label));const top=t.num?t.num.split('.')[0]:'';if(!top||sx.id==='overview'||sx.id==='mechanics'){loose.push(sx);return}let g=groups.find(x=>x.top===top);if(!g){g={top,head:t.num.includes('.')&&t.num.split('.')[1]?'':String(sx.label).replace(/\s·\s\d+$/,''),items:[]};groups.push(g)}if(!g.head&&!(t.num.split('.')[1]))g.head=String(sx.label).replace(/\s·\s\d+$/,'');g.items.push(sx)});
  const navItems=loose.filter(sx=>sx.id==='overview').map(item).join('')+groups.map(g=>{if(g.items.length===1)return item(g.items[0]);const key=c.id+':'+g.top;const active=g.items.some(sx=>sx.id===cur.id);const open=campaignNavOpen.has(key)?campaignNavOpen.get(key):active;return `<div class="rn-group${active?' active':''}"><button type="button" class="rn-head${open?' open':''}" aria-expanded="${open}" onclick="toggleCampaignNavGroup('${esc(key)}',${open})"><span class="chev">▾</span><span>${esc(g.head||g.top+'.')}</span></button>${open?`<div class="rn-items">${g.items.map(item).join('')}</div>`:''}</div>`}).join('')+loose.filter(sx=>sx.id!=='overview').map(item).join('');
  const curT=split(String(cur.label).replace(/\s·\s\d+$/,''));
  const editBtn=admin&&cur.page?`<button type="button" class="rule-edit-btn" title="${en?'Edit this page':'Modifier cette page'}" onclick="openCampaignPageEditor('${esc(c.id)}','${esc(cur.page.id||'')}')">✎ ${en?'Edit':'Modifier'}</button>`:admin&&cur.id==='overview'?`<button type="button" class="rule-edit-btn" onclick="openCampaignPageEditor('${esc(c.id)}','overview')">✎ ${en?'Edit':'Modifier'}</button>`:'';
  const pageBody=cur.page?`<div class="rules-article-body campaign-text"><section class="rule-page-block"><div class="rule-page-text">${campaignPageTextMarkup(cur.page.text||'',c,admin)}</div></section></div>`:body.replace(/<h2 class="campaign-page-title">[\s\S]*?<\/h2>/,'').replace('<div class="campaign-page-edit"><button type="button" class="button secondary small" onclick="openCampaignPageEditor(\''+esc(c.id)+'\',\'overview\')">✎ '+(en?'Edit the presentation':'Modifier la présentation')+'</button></div>','');
  const mobileNav=`<label class="camp-mobile-nav"><span>${en?'Page':'Page'}</span><select onchange="currentCampaignPage=this.value;render('campaignDetail')">${secs.map(sx=>`<option value="${esc(sx.id)}" ${sx.id===cur.id?'selected':''}>${esc(sx.label)}</option>`).join('')}</select></label>`;
  $('#content').innerHTML=`<div class="rules-shell-wrap campaign-page" style="--cc:${col}">
   <div class="rules-head"><h1 class="rules-page-title">${esc(c.name)}</h1><p class="camp-head-line"><span class="campaign-tag">${en?'CAMPAIGN':'CAMPAGNE'}</span>${c.status!=='published'?`<span class="campaign-tag draft">${en?'DRAFT — only admins see it':'BROUILLON — visible des admins seulement'}</span>`:''}<span>${members.length} ${en?'warband'+(members.length!==1?'s':''):'bande'+(members.length!==1?'s':'')}</span>${admin&&c.joinCode?`<span class="campaign-code">${en?'Join code':'Code'} <b>${esc(c.joinCode)}</b> <button type="button" class="equipment-action" title="${en?'New code':'Nouveau code'}" onclick="newCampaignCode('${esc(c.id)}')">↻</button></span>`:''}</p>
    <div class="camp-head-actions">${c.status==='published'?`<button type="button" class="button primary" onclick="openJoinCampaign('${esc(c.id)}')">⚑ ${en?'Enter a warband':'Inscrire une bande'}</button>`:''}${admin?`<button type="button" class="button secondary" onclick="openCampaignEditor('${esc(c.id)}')">✎ ${en?'Edit':'Modifier'}</button><button type="button" class="button secondary" onclick="setCampaignStatus('${esc(c.id)}','${c.status==='published'?'draft':'published'}')">${c.status==='published'?(en?'Unpublish':'Dépublier'):(en?'Publish':'Publier')}</button>`:''}</div></div>
   ${mobileNav}
   <div class="rules-shell campaign-shell">${campaignNavCollapsed?`<nav class="rules-nav camp-nav collapsed"><button type="button" class="camp-nav-toggle" title="${en?'Show the menu':'Afficher le menu'}" aria-label="${en?'Show the menu':'Afficher le menu'}" onclick="toggleCampaignNav()">»</button><span class="camp-nav-vlabel">${en?'MENU':'MENU'}</span></nav>`:`<nav class="rules-nav camp-nav"><button type="button" class="camp-nav-toggle" title="${en?'Hide the menu':'Masquer le menu'}" aria-label="${en?'Hide the menu':'Masquer le menu'}" onclick="toggleCampaignNav()">« <span>${en?'Hide':'Masquer'}</span></button>${navItems}</nav>`}
    <div class="rules-main"><div class="site-crumbs"><button type="button" class="button secondary rules-back" aria-label="${en?'Back':'Retour'}" onclick="navigateApp('/rules/campaign')">←</button><div class="rules-crumb"><a href="/rules/campaign" data-app-route="1" onclick="event.preventDefault();navigateApp('/rules/campaign')">${en?'Rules: Campaign':'Règles : Campagne'}</a><span class="sep">›</span><a href="#" onclick="${go('overview')}">${esc(c.name)}</a>${cur.id!=='overview'?`<span class="sep">›</span><span class="cur">${esc(curT.name)}</span>`:''}</div></div>
     <div class="title-row"><h1 class="rules-title">${curT.num?`<span class="rt-num">${esc(curT.num)}</span>`:''}<span class="rt-name">${esc(curT.name)}</span></h1>${editBtn}</div>
     ${pageBody}</div></div></div>`;
}
function chartOffNote(c,admin,key){const en=siteLanguage==='en';if(campaignFeatureOn(c,key))return '';return admin?`<div class="chart-off">${en?'Not applied by the app yet — turn it on in ⚙ Setup. You can already edit it.':'Pas encore appliqué par l’appli — active-le dans ⚙ Configuration. Tu peux déjà le modifier.'}</div>`:''}
function explorationChipLine(e){const en=siteLanguage==='en';const chips=[];(e.items||[]).forEach(i=>{if(i.b&&normName(i.b)!==normName(i.n))chips.push(`${esc(i.n)} → ${en?'counts as':'compte comme'} <b>${esc(i.b)}</b>`);if(i.sell)chips.push(`${esc(i.n)}: ${en?'resale':'revente'} <b class="gold">${esc(i.sell)} gc</b>`)});if(e.gold)chips.push(`+<b class="gold">${esc(e.gold)} gc</b>`);if(e.treasure)chips.push(`+<b class="gold">${esc(e.treasure)} Treasure</b>`);if(e.bonus)chips.push(`${esc(e.bonus.icon||'★')} ${esc(e.bonus.label)}`);if(e.pool)chips.push(en?'Leading Hero: +D6 XP (once), Old Battle Wound':'Héros meneur : +D6 XP (une fois), Old Battle Wound');if(e.trap)chips.push(en?'Danger for the leading Hero':'Danger pour le Héros meneur');return chips.length?`<div class="chart-chips">${chips.map(x=>`<span>${x}</span>`).join('')}</div>`:''}
function chartEditBtn(fn){return `<button type="button" class="rule-edit-btn" title="${siteLanguage==='en'?'Edit':'Modifier'}" onclick="${fn}">✎</button>`}
function campaignChartMarkup(kind,c,admin){
  const en=siteLanguage==='en';const id=esc(c.id);
  if(kind==='exploration'){
    const list=campaignExplorationData(c)||lustriaExplorationDefaults();
    return `<div class="live-chart">${chartOffNote(c,admin,'exploration')}${admin?`<div class="chart-admin"><button type="button" class="button secondary small" onclick="openExplorationEntryEditor('${id}','')">＋ ${en?'Add a result':'Ajouter un résultat'}</button></div>`:''}${CHART_TIERS.map(([n,enL,frL])=>{const rows=list.filter(e=>Number(String(e.k).split('-')[0])===n).sort((a,b)=>Number(a.k.split('-')[1])-Number(b.k.split('-')[1]));if(!rows.length)return '';return `<h3 class="chart-tier">${esc(en?enL:frL)}</h3>${rows.map(e=>{const [t,f]=e.k.split('-');return `<div class="chart-entry${e.trap?' trap':''}"><div class="chart-entry-head"><span class="chart-dice">${String(f).repeat(Number(t)).split('').map(v=>`<i>${v}</i>`).join('')}</span><b>${esc(e.name)}</b>${admin?chartEditBtn(`openExplorationEntryEditor('${id}','${esc(e.k)}')`):''}</div>${ruleTextMarkup(e.text||'',{noTitle:true})}${explorationChipLine(e)}</div>`}).join('')}`}).join('')}</div>`;
  }
  if(kind==='hazards'){
    const list=(campaignConditionsData(c)?.hazards||lustriaHazardDefaults()).slice().sort((a,b)=>a.roll-b.roll);
    return `<div class="live-chart">${chartOffNote(c,admin,'conditions')}${admin?`<div class="chart-admin"><button type="button" class="button secondary small" onclick="openHazardEditor('${id}','')">＋ ${en?'Add a hazard':'Ajouter un danger'}</button></div>`:''}<div class="rule-table-wrap"><table class="rule-table"><tr><th>3D6</th><th>${en?'Hazard':'Danger'}</th></tr>${list.map(h=>`<tr><td>${h.roll}</td><td>${esc(h.name)}</td></tr>`).join('')}</table></div><h3 class="chart-tier">${en?'Hazard descriptions':'Description des dangers'}</h3>${list.map(h=>`<div class="chart-entry"><div class="chart-entry-head"><span class="chart-num">${h.roll}</span><b>${esc(h.name)}</b>${h.count?`<small class="muted">${en?'number':'nombre'}: ${esc(h.count)}</small>`:''}${admin?chartEditBtn(`openHazardEditor('${id}','${h.roll}')`):''}</div>${ruleTextMarkup(h.text||'',{noTitle:true})}${(h.rules||[]).length?`<div class="chart-chips">${h.rules.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}${h.gear?`<small>${en?'Equipment':'Équipement'}: ${esc(h.gear)}</small>`:''}${h.profile?hazardProfileTable(h.profile):''}</div>`).join('')}</div>`;
  }
  if(kind==='weather'){
    const list=(campaignConditionsData(c)?.weather||lustriaWeatherDefaults()).slice().sort((a,b)=>a.min-b.min);const rng=w=>w.min===w.max?w.min:`${w.min}–${w.max}`;
    return `<div class="live-chart">${chartOffNote(c,admin,'conditions')}${admin?`<div class="chart-admin"><button type="button" class="button secondary small" onclick="openWeatherEditor('${id}','')">＋ ${en?'Add a result':'Ajouter un résultat'}</button></div>`:''}<div class="rule-table-wrap"><table class="rule-table"><tr><th>2D6</th><th>${en?'Weather':'Météo'}</th></tr>${list.map(w=>`<tr><td>${rng(w)}</td><td>${esc(w.name)}</td></tr>`).join('')}</table></div>${list.map(w=>`<div class="chart-entry"><div class="chart-entry-head"><span class="chart-num">${rng(w)}</span><b>${esc(w.name)}</b>${(w.sub||[]).length?`<small class="muted">${en?'+ D6 rolled by the app':'+ D6 lancé par l’appli'}</small>`:''}${admin?chartEditBtn(`openWeatherEditor('${id}','${w.min}')`):''}</div>${ruleTextMarkup(w.text||'',{noTitle:true})}</div>`).join('')}</div>`;
  }
  if(kind==='scenarios'){
    const t=c?.definition?.scenarioTable||LUSTRIA_SCENARIO_TABLE;const rows=Array.from({length:11},(_,i)=>i+2);
    const linked=name=>{const m=campaignScenarioMatches(name);return m.length?m.map(s=>`<a href="/rules/scenarios/${encodeURIComponent(s.id)}" data-app-route="1" class="rule-scenario-link">${esc(s.name)}</a>`).join(' / '):esc(name)};
    return `<div class="live-chart">${chartOffNote(c,admin,'scenarioTable')}${admin?`<div class="chart-admin"><button type="button" class="button secondary small" onclick="openScenarioTableEditor('${id}')">✎ ${en?'Edit the tables':'Modifier les tables'}</button></div>`:''}<div class="chart-two"><div><h3 class="chart-tier">${en?'Two-player scenarios':'Scénarios à deux joueurs'}</h3><div class="rule-table-wrap"><table class="rule-table"><tr><th>2D6</th><th>${en?'Scenario':'Scénario'}</th></tr>${rows.map(n=>`<tr><td>${n}</td><td>${linked(t.two?.[n]||'—')}</td></tr>`).join('')}</table></div></div><div><h3 class="chart-tier">${en?'Multi-player scenarios':'Scénarios multijoueurs'}</h3><div class="rule-table-wrap"><table class="rule-table"><tr><th>2D6</th><th>${en?'Scenario':'Scénario'}</th></tr>${rows.map(n=>`<tr><td>${n}</td><td>${linked(t.multi?.[n]||'—')}</td></tr>`).join('')}</table></div></div></div></div>`;
  }
  if(kind==='settlements')return `<div class="live-chart">${campaignSettlementsMarkup(c,admin,true)}</div>`;
  return '';
}
// Page text with its [CHART …] blocks.
function campaignPageTextMarkup(text,c,admin){
  // The settlement sheets are applied in the campaign game, not shown in the rules.
  text=String(text||'').replace(/\n*\s*SETTLEMENT SHEETS\s*\n\s*\[CHART\s+settlements\]/gi,'').replace(/\[CHART\s+settlements\]/gi,'');
  const parts=String(text||'').split(/\[CHART\s+(\w+)\]/);let out='';
  for(let i=0;i<parts.length;i++){if(i%2===0){if(parts[i].trim())out+=ruleTextMarkup(parts[i],{noTitle:true})}else out+=campaignChartMarkup(parts[i].toLowerCase(),c,admin)}
  return out;
}
// V-SETUP: admin panel on the "In the app" page — every campaign feature with
// its state and the button that turns it on (or imports its Lustria data).
async function enableAllLustria(cid){
  const en=siteLanguage==='en';const c=campaignDetailCache.get(cid);if(!c)return;
  if(!await siteConfirm(en?'Turn on every Lustria feature for this campaign (settlements, post-battle, artifacts, Play conditions, scenario table)? Existing settlements and artifacts are kept.':'Activer toutes les fonctions de Lustria pour cette campagne (colonies, post-bataille, artefacts, conditions en Play, table de scénarios) ? Les colonies et artefacts existants sont conservés.'))return;
  const opts=campaignFactionOptions();
  const ok=await saveCampaignDefinition(cid,def=>{
    const haveS=new Set((def.settlements||[]).map(x=>normName(x.name)));
    def.settlements=[...(def.settlements||[]),...LUSTRIA_SETTLEMENTS.filter(t=>!haveS.has(normName(t.name))).map(t=>({id:crypto.randomUUID().slice(0,8),name:t.name,excluded:opts.filter(o=>t.excludeNames.some(k=>String(o.name).toLowerCase().includes(k))).map(o=>o.id),known:opts.map(o=>o.id),newAllowed:true,tithe:t.tithe,market:{...t.market},hsUpkeep:{reduction:t.hsUpkeep.reduction,names:t.hsUpkeep.names.slice()},notes:t.notes}))];
    if(!def.outsiderPenalty)def.outsiderPenalty={rarity:4,pricePct:20};
    ensureExplorationData(def).enabled=true;
    const haveA=new Set((def.artifacts||[]).map(a=>normName(a.name)));def.artifacts=[...(def.artifacts||[]),...LUSTRIA_ARTIFACTS.filter(a=>!haveA.has(normName(a.name))).map(a=>({...a,id:crypto.randomUUID().slice(0,8)}))];if(!def.artifactsIntro)def.artifactsIntro=LUSTRIA_ARTIFACTS_INTRO;
    ensureConditionsData(def).enabled=true;
    if(def.scenarioTable)def.scenarioTable.enabled=true;else def.scenarioTable={...JSON.parse(JSON.stringify(LUSTRIA_SCENARIO_TABLE)),enabled:true};
    applyLustriaRulePages(def,false);
  });
  if(ok)toast(en?'Lustria features turned on — now stock the shared market':'Fonctions de Lustria activées — approvisionne maintenant le marché partagé',5000);
}
async function disableCampaignScenarioTable(cid){await saveCampaignDefinition(cid,def=>{if(def.scenarioTable)def.scenarioTable.enabled=false})}
function campaignSetupMarkup(c){
  const en=siteLanguage==='en';const d=c.definition||{};const id=esc(c.id);const m=campaignMarketCache.get(c.id);if(!m)loadCampaignMarket(c.id,'campaignDetail');
  const row=(on,icon,title,detail,btn)=>`<div class="setup-row${on?' on':''}"><span class="setup-dot">${on?'✓':'○'}</span><div><b>${icon} ${esc(title)}</b><small>${detail}</small></div><div class="setup-btns">${btn}</div></div>`;
  const b=(fn,label,primary)=>`<button type="button" class="button ${primary?'primary':'secondary'} small" onclick="${fn}">${label}</button>`;
  const st=d.settlements||[],arts=d.artifacts||[];const stocked=m?.stock?Object.keys(m.stock).length:0;
  return `<section class="setup-panel"><div class="setup-head"><div><span class="micro-label">${en?'ADMIN · CAMPAIGN SETUP':'ADMIN · CONFIGURATION DE LA CAMPAGNE'}</span><small>${en?'Players only get a feature once it is turned on here.':'Les joueurs n’ont une fonction qu’une fois activée ici.'}</small></div>${b(`enableAllLustria('${id}')`,`⚡ ${en?'Turn on everything for Lustria':'Tout activer pour Lustria'}`,true)}</div>
   ${row((d.pages||[]).length>0,'📜',en?'Rule pages (what players read)':'Pages de règles (ce que lisent les joueurs)',(d.pages||[]).length?(en?`${d.pages.length} page(s)`:`${d.pages.length} page(s)`):(en?'None yet':'Aucune'),b(`importLustriaRulePages('${id}')`,`📖 ${en?'Load the Lustria texts':'Charger les textes de Lustria'}`))}
   ${row(st.length>0,'🏘',en?'Settlements':'Colonies',st.length?(en?`${st.length} settlement(s)`:`${st.length} colonie(s)`):(en?'None yet':'Aucune'),b(`importLustriaSettlements('${id}')`,`📖 ${en?'Import Lustria':'Importer Lustria'}`)+b(`navigateApp('/rules/campaign/${encodeURIComponent(c.id)}/settlements')`,en?'Edit':'Modifier'))}
   ${row(campaignFeatureOn(c,'exploration'),'🧭',en?'Campaign post-battle (exploration chart, Treasure)':'Post-bataille de campagne (exploration, Treasure)',campaignFeatureOn(c,'exploration')?(en?`${d.exploration.entries?.length||0} results`:`${d.exploration.entries?.length||0} résultats`):(en?'Book post-battle':'Post-bataille du livre'),campaignFeatureOn(c,'exploration')?b(`disableCampaignExploration('${id}')`,en?'Turn off':'Désactiver'):b(`importLustriaExploration('${id}')`,en?'Turn on':'Activer'))}
   ${row(arts.length>0,'✦',en?'Artifacts':'Artefacts',arts.length?(en?`${arts.length} artifacts`:`${arts.length} artefacts`):(en?'None (the Lustria list is used by default for rolls)':'Aucun (la liste de Lustria est utilisée par défaut pour les jets)'),b(`importLustriaArtifacts('${id}')`,`📖 ${en?'Import Lustria':'Importer Lustria'}`))}
   ${row(stocked>0,'🏪',en?'Shared market':'Marché partagé',stocked?(en?`${stocked} items in stock${m.stockedAt?` · ${new Date(m.stockedAt).toLocaleDateString()}`:''}`:`${stocked} objets en stock${m.stockedAt?` · ${new Date(m.stockedAt).toLocaleDateString()}`:''}`):(m?.failed?(en?'Server not reachable':'Serveur injoignable'):(en?'Not stocked: warbands use the basic Trading Post':'Pas approvisionné : les bandes utilisent le Trading Post de base')),b(`stockCampaignMarket('${id}')`,stocked?(en?'Restock':'Réapprovisionner'):(en?'Stock it':'Approvisionner')))}
   ${row(campaignFeatureOn(c,'conditions'),'🌦',en?'Play conditions (weather, hazards)':'Conditions en Play (météo, dangers)',campaignFeatureOn(c,'conditions')?(en?'Conditions tab in Play':'Onglet Conditions en Play'):(en?'Off':'Désactivé'),campaignFeatureOn(c,'conditions')?b(`disableCampaignConditions('${id}')`,en?'Turn off':'Désactiver'):b(`importLustriaConditions('${id}')`,en?'Turn on':'Activer'))}
   ${row(campaignFeatureOn(c,'scenarioTable'),'🎲',en?'Scenario table (2D6)':'Table de scénarios (2D6)',campaignFeatureOn(c,'scenarioTable')?(en?'Roll in the warband’s Campaign tab':'Jet dans l’onglet Campagne de la bande'):(en?'Off':'Désactivée'),campaignFeatureOn(c,'scenarioTable')?b(`disableCampaignScenarioTable('${id}')`,en?'Turn off':'Désactiver'):b(`importLustriaScenarioTable('${id}')`,en?'Turn on':'Activer'))}
   ${row(true,'🏆',en?'Standings':'Classement',en?'Resource used to rank the warbands':'Ressource utilisée pour classer les bandes',`<select class="setup-select" onchange="setCampaignStandings('${id}',this.value)">${CAMPAIGN_STANDING_KEYS.map(k=>`<option value="${k}" ${campaignStandingKey(c)===k?'selected':''}>${esc(campaignStandingLabel(k))}</option>`).join('')}</select>`)}
  </section>`;
}
function campaignMechanicsMarkup(c,admin){
  const en=siteLanguage==='en';const d=c.definition||{};const list=campaignMechanicsList(c);
  const cards=list.map(m=>`<article class="mech-card${m.on?'':' off'}"><div class="mech-head"><span class="mech-icon">${m.icon}</span><b>${esc(m.title)}</b><span class="mech-state">${m.on?(m.onLabel?esc(m.onLabel):(en?'ACTIVE':'ACTIF')):(en?'OFF':'INACTIF')}</span></div><p>${esc(m.text)}</p><small>📍 ${esc(m.where)}</small>${m.link?`<a href="#" onclick="navigateApp('/rules/campaign/${encodeURIComponent(c.id)}/${m.link}');return false;">${en?'See the page →':'Voir la page →'}</a>`:''}</article>`).join('');
  const tbl=(head,rows)=>`<div class="rule-table-wrap"><table class="rule-table"><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr>${rows.map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</table></div>`;
  const tier=k=>{const [n,f]=k.split('-');return String(f).repeat(Number(n)).split('').join(' ')};
  const sections=[];
  if(d.exploration?.entries?.length)sections.push(`<details class="mech-ref"><summary>${en?'Exploration chart':'Table d’exploration'} <small>${d.exploration.entries.length}</small></summary>${tbl([en?'Dice':'Dés',en?'Result':'Résultat',en?'What you get':'Ce que tu obtiens'],d.exploration.entries.map(e=>[`<b>${tier(e.k)}</b>`,`<b>${esc(e.name)}</b>`,esc(e.text)]))}</details>`);
  if(d.conditions?.weather?.length)sections.push(`<details class="mech-ref"><summary>${en?'Weather (2D6)':'Météo (2D6)'}</summary>${tbl(['2D6',en?'Weather':'Météo',en?'Effect':'Effet'],d.conditions.weather.map(w=>[w.min===w.max?w.min:`${w.min}–${w.max}`,`<b>${esc(w.name)}</b>`,esc(w.text)]))}</details>`);
  if(d.conditions?.hazards?.length)sections.push(`<details class="mech-ref"><summary>${en?'Hazards (3D6)':'Dangers (3D6)'}</summary><div class="mech-hz">${d.conditions.hazards.map(h=>`<div class="mech-hz-row"><div><b>${h.roll} · ${esc(h.name)}</b>${h.count?` <small>(${esc(h.count)})</small>`:''}<p>${esc(h.text)}</p>${(h.rules||[]).length?`<small>${h.rules.map(esc).join(' · ')}</small>`:''}${h.gear?`<small>${en?'Equipment':'Équipement'}: ${esc(h.gear)}</small>`:''}</div>${h.profile?hazardProfileTable(h.profile):''}</div>`).join('')}</div></details>`);
  if(d.scenarioTable)sections.push(`<details class="mech-ref"><summary>${en?'Scenario table (2D6)':'Table de scénarios (2D6)'}</summary>${tbl(['2D6',en?'Two players':'Deux joueurs',en?'Multiplayer':'Multijoueur'],Array.from({length:11},(_,i)=>i+2).map(n=>[n,esc(d.scenarioTable.two?.[n]||'—'),esc(d.scenarioTable.multi?.[n]||'—')]))}</details>`);
  return `<div class="rules-article-body campaign-text"><h2 class="campaign-page-title">${en?'In the app':'Dans l’appli'}</h2>${admin?campaignSetupMarkup(c):''}<p class="sheet-help">${en?'What this campaign applies automatically for the warbands entered in it, and where. The rule pages remain the reference text.':'Ce que cette campagne applique automatiquement aux bandes inscrites, et où. Les pages de règles restent le texte de référence.'}</p><div class="mech-grid">${cards}</div>${sections.length?`<h3 class="campaign-h3">${en?'Reference tables used by the app':'Tables utilisées par l’appli'}</h3>${sections.join('')}`:''}</div>`;
}
function campaignArtifactsMarkup(c,admin){
  const en=siteLanguage==='en';const id=esc(c.id);
  const list=(Array.isArray(c.definition?.artifacts)?c.definition.artifacts:[]).slice().sort((a,b)=>campaignArtifactRollKey(a)-campaignArtifactRollKey(b));
  const intro=c.definition?.artifactsIntro||'';
  const bar=admin?`<div class="custom-actions" style="justify-content:flex-start;margin-bottom:12px"><button type="button" class="button primary" onclick="openCampaignArtifactEditor('${id}','')">＋ ${en?'Add an artifact':'Ajouter un artefact'}</button><button type="button" class="button secondary" onclick="editCampaignArtifactsIntro('${id}')">✎ ${en?'Intro text':'Texte d’intro'}</button><button type="button" class="button secondary" onclick="importLustriaArtifacts('${id}')">📖 ${en?'Import the Lustria artifacts':'Importer les artefacts de Lustria'}</button></div>`:'';
  if(!list.length)return `<div class="rules-article-body campaign-text"><h2 class="campaign-page-title">${en?'Artifacts':'Artefacts'}</h2>${bar}${intro?ruleTextMarkup(intro,{noTitle:true}):''}<p class="muted">${en?'No artifact yet.':'Aucun artefact pour l’instant.'}</p></div>`;
  const section=(table,title)=>{
    const rows=list.filter(a=>a.table===table);if(!rows.length)return '';
    const summary=`<div class="rule-table-wrap"><table class="rule-table artifact-summary"><thead><tr><th>4D6</th><th>${en?'Artifact':'Artefact'}</th><th>${en?'Counts as':'Compte comme'}</th></tr></thead><tbody>${rows.map(a=>{const w=campaignArtifactBaseItem(a.base);return `<tr><td>${esc(a.roll||'')}</td><td><a href="#art-${esc(a.id)}" onclick="event.preventDefault();document.getElementById('art-${esc(a.id)}')?.scrollIntoView({behavior:'smooth',block:'start'})">${esc(a.name)}</a></td><td>${w?refLink('equipment',w.name,w.name):(a.base?esc(a.base):'—')}</td></tr>`}).join('')}</tbody></table></div>`;
    const cards=rows.map(a=>{const w=campaignArtifactBaseItem(a.base);const base=a.base?`<div class="artifact-base">${en?'Counts as':'Compte comme'} ${w?refLink('equipment',w.name,w.name):`<span class="artifact-missing" title="${en?'Not found in the catalogue':'Introuvable dans le catalogue'}">${esc(a.base)} ⚠</span>`}${w&&w.price!=null?` · ${esc(String(w.price))} gc`:''}</div>`:'';
      return `<article class="artifact-card" id="art-${esc(a.id)}"><div class="artifact-head"><span class="artifact-roll">${esc(a.roll||'')}</span><h3>${esc(a.name)}</h3>${admin?`<button type="button" class="rule-edit-btn" title="${en?'Edit':'Modifier'}" onclick="openCampaignArtifactEditor('${id}','${esc(a.id)}')">✎</button>`:''}</div>${base}${a.lore?`<p class="artifact-lore">${esc(a.lore)}</p>`:''}${a.rules?`<div class="artifact-rules">${ruleTextMarkup(a.rules,{noTitle:true})}</div>`:''}</article>`}).join('');
    return `<h3 class="campaign-h3">${title} <small>${rows.length}</small></h3>${summary}<div class="artifact-grid">${cards}</div>`;
  };
  return `<div class="rules-article-body campaign-text"><h2 class="campaign-page-title">${en?'Artifacts':'Artefacts'}</h2>${bar}${intro?ruleTextMarkup(intro,{noTitle:true}):''}${section('minor',en?'Minor artifacts':'Artefacts mineurs')}${section('major',en?'Major artifacts':'Artefacts majeurs')}</div>`;
}
function editCampaignArtifactsIntro(cid){
  const en=siteLanguage==='en';const c=campaignDetailCache.get(cid);if(!c)return;
  openModal(`<div class="wc-dialog"><div class="eyebrow">${en?'ARTIFACTS':'ARTEFACTS'}</div><h2>${en?'Intro text':'Texte d’intro'}</h2><textarea id="artIntro" rows="8" style="width:100%">${esc(c.definition?.artifactsIntro||'')}</textarea><div class="custom-actions"><button type="button" class="button primary" onclick="saveCampaignArtifactsIntro('${esc(cid)}')">${en?'Save':'Enregistrer'}</button><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
function campaignSettlementsMarkup(c,admin,embedded){
  const en=siteLanguage==='en';const id=esc(c.id);const list=c.definition?.settlements||[];const pen=campaignOutsiderPenalty(c);const opts=campaignFactionOptions();
  const bar=admin?`<div class="custom-actions" style="justify-content:flex-start;flex-wrap:wrap;margin-bottom:12px"><button type="button" class="button primary" onclick="openSettlementEditor('${id}','')">＋ ${en?'Add a settlement':'Ajouter une colonie'}</button><button type="button" class="button secondary" onclick="openCampMapEditor('${id}')">🗺 ${campMapOf(c)?(en?'Edit the map':'Modifier la carte'):(en?'Create the map':'Créer la carte')}</button><button type="button" class="button secondary" onclick="openOutsiderPenaltyEditor('${id}')">⚖ ${en?'Penalty for warbands with no residence':'Pénalité des bandes sans résidence'}</button><button type="button" class="button secondary" onclick="importLustriaSettlements('${id}')">📖 ${en?'Import the Lustria settlements':'Importer les colonies de Lustria'}</button><button type="button" class="button secondary" onclick="navigateApp('/rules/campaign/${encodeURIComponent(c.id)}/mechanics')">⚙ ${en?'Campaign setup':'Configuration de la campagne'}</button></div>`:'';
  const head=`${embedded?'':`<h2 class="campaign-page-title">${en?'Settlements':'Colonies'}</h2>`}${bar}<p class="sheet-help">${en?`One market for the whole campaign: each warband buys with the modifiers of the settlement it resides in. A warband that may reside nowhere buys with availability +${pen.rarity} (Common counts as Rare 4) and +${pen.pricePct}% on purchases. A warband picks its settlement once when it joins, then may move once after each game, before its post-battle actions.`:`Un seul marché pour toute la campagne : chaque bande achète avec les modificateurs de sa colonie de résidence. Une bande qui ne peut résider nulle part achète avec rareté +${pen.rarity} (Common compte comme Rare 4) et +${pen.pricePct} % à l’achat. Une bande choisit sa colonie une fois en entrant, puis peut déménager une fois après chaque partie, avant ses actions d’après-bataille.`}</p>`;
  if(!list.length)return `<div class="rules-article-body campaign-text">${head}<p class="muted">${en?'No settlement yet.':'Aucune colonie pour l’instant.'}</p></div>`;
  return `<div class="rules-article-body campaign-text">${head}<div class="settle-grid">${list.map(st=>{const ex=(st.excluded||[]).map(fid=>opts.find(o=>o.id===fid)?.name||fid);return `<article class="settle-card"><div class="artifact-head"><h3>${esc(st.name)}</h3>${admin?`<button type="button" class="rule-edit-btn" title="${en?'Edit':'Modifier'}" onclick="openSettlementEditor('${id}','${esc(st.id)}')">✎</button>`:''}</div>${settlementEffectsMarkup(st,en)}${st.notes?settlementNotesBox(st.notes,en):''}${settlementWhoMarkup(st,en)}</article>`}).join('')}</div></div>`;
}
async function setCampaignStandings(cid,k){if(!CAMPAIGN_STANDING_KEYS.includes(k))return;await saveCampaignDefinition(cid,def=>{def.standings=k})}
async function setCampaignStatus(id,status){const en=siteLanguage==='en';try{await window.MordheimundaAPI.adminSetCampaignStatus(id,status);campaignDetailCache.delete(id);campaignsCache=null;campaignListStale=true;renderCurrentRoute();toast(status==='published'?(en?'Campaign published':'Campagne publiée'):(en?'Campaign back to draft':'Campagne repassée en brouillon'))}catch(e){toast(authError(e,en))}}
async function newCampaignCode(id){const en=siteLanguage==='en';if(!await siteConfirm(en?'Make a new join code? The old one stops working.':'Créer un nouveau code ? L’ancien ne marchera plus.'))return;try{await window.MordheimundaAPI.adminNewCampaignCode(id);campaignDetailCache.delete(id);renderCurrentRoute()}catch(e){toast(authError(e,en))}}
function hiredSwordMergeTwin(w){return hiredSwordMergeCopies(hiredSwordCopiesOf(w),w.customFighterId)||w}
/* V-BOOKHS: the Hired Swords of the rulebook (pp. 151–158) as ready-made
   Custom → Hired Swords profiles, created in the account's own library so
   they can be edited and published (☆) like any other. "Hired by" uses the
   book's table; groups map to this site's warbands. */
const BOOK_HS_GROUPS={M:['averland','middenheim','ostland','reikland'],WH:['witchhunters'],SoS:['sisters'],P:['possessed'],Sk:['skaven'],U:['undead','blood-dragons'],O:['orcs'],D:['dwarfs']};
function bookHiredSwordItem(b){
  const resolve=n=>(D.weapons||[]).find(e=>normName(e.name)===normName(n))?.name||customEquipmentByName(n)?.name||n;
  const ruleNames=[`Race (${b.race})`,'Hired Sword',...(b.rules||[])];
  return {customFighterId:crypto.randomUUID(),name:b.name,type:'Hired Sword',hiredSword:true,factionId:'',customWarbandId:null,cost:b.cost,upkeep:b.upkeep,max:1,maxMode:'auto',manualMaxProfile:null,profile:b.profile.slice(),race:b.race,ruleNames,rules:ruleNames.join(', '),skillAccess:{...b.access},magicAccess:{...(b.magic||{})},defaultSkills:(b.skills||[]).slice(),defaultEquipment:(b.gear||[]).map(resolve),equipmentAccess:[],hsFactions:[...new Set(b.hire.split(' ').flatMap(g=>BOOK_HS_GROUPS[g]||[]))],hsChoices:(b.choices||[]).map(g=>({label:g.label,count:g.count,options:g.options.map(o=>hiredSwordOptionParts(o).map(resolve).join(' + '))})),hsRandomSkill:b.random||'',description:`${b.text} (Rulebook p. ${b.page})`,archived:false};
}
function importBookHiredSwords(){
  const en=siteLanguage==='en';
  const have=new Set([...customFighterList(),...hiredSwordRawList()].filter(isHiredSword).map(w=>normName(w.name)));
  const todo=BOOK_HIRED_SWORDS.filter(b=>!have.has(normName(b.name)));
  if(!todo.length){toast(en?'Every Hired Sword of the book is already in your library':'Tous les Hired Swords du livre sont déjà dans ta bibliothèque');return}
  openModal(`<div class="wc-dialog"><div class="eyebrow">CUSTOM · HIRED SWORDS</div><h2>${en?'Import the book’s Hired Swords':'Importer les Hired Swords du livre'}</h2><p class="sheet-help">${en?`Rulebook pp. 151–158. ${todo.length} will be added to your library, where you can edit them, then publish them with ☆. Those you already have (same name) are skipped.`:`Livre de règles p. 151–158. ${todo.length} seront ajoutés à ta bibliothèque, où tu peux les modifier, puis les publier avec ☆. Ceux que tu as déjà (même nom) sont ignorés.`}</p><div class="hs-import-list">${todo.map(b=>`<span class="hs-choice-chip">${esc(b.name)} · ${b.cost} GC</span>`).join('')}</div><div class="custom-actions"><button type="button" class="button primary" onclick="confirmImportBookHiredSwords()">${en?`Import ${todo.length}`:`Importer ${todo.length}`}</button><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
function confirmImportBookHiredSwords(){
  const en=siteLanguage==='en';
  const have=new Set([...customFighterList(),...hiredSwordRawList()].filter(isHiredSword).map(w=>normName(w.name)));
  const items=BOOK_HIRED_SWORDS.filter(b=>!have.has(normName(b.name))).map(bookHiredSwordItem);
  if(!Array.isArray(state.customFighters))state.customFighters=[];
  items.forEach(it=>state.customFighters.push(it));
  save(true);closeModal();render('custom');
  toast(en?`${items.length} Hired Swords imported — edit them, then ☆ to publish`:`${items.length} Hired Swords importés — modifie-les, puis ☆ pour publier`);
}
function deleteCustomEquipment(id){const en=siteLanguage==='en';const w=customEquipmentList().find(x=>x.customEquipmentId===id);if(!w)return;openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'DELETE CUSTOM EQUIPMENT':'SUPPRESSION D’ÉQUIPEMENT CUSTOM'}</div><h2>${en?'Delete “':'Supprimer « '}${esc(w.name)}${en?'”?':' » ?'}</h2><p>${en?'The item will be removed from the custom library. Copies already bought by fighters remain on their sheets.':'L’équipement sera retiré de la bibliothèque custom. Les copies déjà achetées par des combattants restent présentes dans leurs fiches.'}</p><button type="button" class="big-delete" onclick="confirmDeleteCustomEquipment('${id}')">${en?'DELETE EQUIPMENT':'SUPPRIMER L’ÉQUIPEMENT'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`)}
function confirmDeleteCustomEquipment(id){const en=siteLanguage==='en';markDeleted('customEquipment',id);state.customEquipment=customEquipmentList().filter(w=>w.customEquipmentId!==id);if(customEquipmentEditId===id)customEquipmentEditId=null;save(true);closeModal();render('custom');toast(en?'Custom equipment deleted':'Équipement custom supprimé')}
function customEquipmentForm(w){
  const en=siteLanguage==='en';
  // V-WEAPONTYPE: items saved from Admin or brought back from a published
  // warband can carry a weapon profile without type:'weapon' — opening them
  // as plain equipment hid the profile and saving wiped it.
  const covering=isCovering(w);
  const weapon=!covering&&(w?.type==='weapon'||!!w?.profile);
  const traits=customEquipmentTraitDraft.length?customEquipmentTraitDraft:(w?.traits||[]);
  const factions=Array.isArray(w?.factions)?w.factions:[];
  const cats=en?EQUIPMENT_CATEGORY_NAMES_EN:EQUIPMENT_CATEGORY_NAMES_FR;
  const catsFr=EQUIPMENT_CATEGORY_NAMES_FR;
  const exclusiveCw=customWarbandCreateContextId?customWarbandById(customWarbandCreateContextId):null;
  const exclusiveBanner=exclusiveCw?`<div class="official-draft-notice"><span class="official-draft-tag">${en?'EXCLUSIVE':'EXCLUSIF'}</span><p>${en?`This equipment will be exclusive to <b>${esc(exclusiveCw.name)}</b> — automatically checked for this warband, it will no longer appear in the general Generic Custom list. <a href="#" onclick="returnToWarbandEditor('equipment');return false;">← Back to the warband without saving</a>`:`Cet équipement sera exclusif à <b>${esc(exclusiveCw.name)}</b> — coché automatiquement pour cette warband, il n’apparaîtra plus dans la liste générale de Custom Générique. <a href="#" onclick="returnToWarbandEditor('equipment');return false;">← Retour à la warband sans enregistrer</a>`}</p></div>`:'';
  return `${exclusiveBanner}<div id="customEquipForm" class="${covering?'custom-form-covering':''}"><div class="custom-form-head"><div><div class="eyebrow">${w?(en?'EDIT':'MODIFICATION'):(en?'NEW EQUIPMENT':'NOUVEL ÉQUIPEMENT')}</div><h3>${esc(w?.name||(en?'Build equipment':'Construire un équipement'))}</h3></div>${w?`<button type="button" class="button secondary" onclick="newCustomEquipment()">＋ ${en?'New':'Nouveau'}</button>`:''}</div>
  <div class="custom-form-grid">
    <label class="custom-field wide"><span>${en?'Name':'Nom'}</span><input id="customName" value="${esc(w?.name||'')}" placeholder="${en?'E.g. Waaagh! Axe':'Ex. Hache du Waaagh!'}"></label>
    <label class="custom-field"><span>${en?'Type':'Type'}</span><select id="customType" onchange="refreshCustomForm()"><option value="equipment" ${!weapon&&!covering?'selected':''}>${en?'Equipment':'Équipement'}</option><option value="weapon" ${weapon?'selected':''}>${en?'Weapon':'Arme'}</option><option value="covering" ${covering?'selected':''}>${en?'Weapon covering':'Revêtement d’arme'}</option></select></label>
    <label class="custom-field" data-covering-hide><span>${en?'Subcategory':'Sous-catégorie'}</span><select id="customCategory">${cats.map((c,i)=>`<option value="${esc(catsFr[i])}" ${catsFr[i]===(w?.category||'Équipements divers')?'selected':''}>${c}</option>`).join('')}</select></label>
    <label class="custom-field"><span>${en?'Rarity':'Rareté'}</span><input id="customRarity" value="${esc(w?.rarity||'')}" placeholder="Common / Rare 7 / etc."></label>
    <label class="custom-field" data-covering-hide><span>${en?'Price (GC)':'Prix (GC)'}</span><input id="customPrice" type="number" min="0" step="1" value="${Number(w?.price||0)}"></label>
    <div data-covering-hide class="custom-field-wrap">${bandValueFieldMarkup(w,'customBandValue')}</div>
    <label class="custom-field wide"><span>${en?'Equipment rules':'Règles de l’équipement'}</span>${customTextToolbarMarkup('customRules')}<textarea id="customRules" class="wide-textarea custom-rules-textarea" rows="4" placeholder="${en?`E.g. This armour grants a 5+ save.
Rules written here can be interpreted by the system when they match a recognized game value.`:`Ex. Cette armure donne une sauvegarde de 5+.
Les règles écrites ici peuvent être interprétées par le système lorsqu’elles correspondent à une valeur de jeu reconnue.`}">${esc(w?.rulesText||'')}</textarea><small class="custom-field-help">${en?'You can write the rules freely. Some recognized values, like “5+ save”, are automatically taken into account on the fighter’s sheet. Avoid cutting a recognized value in the middle of its formatting.':'Tu peux écrire les règles librement. Certaines valeurs reconnues, comme « sauvegarde de 5+ », sont automatiquement prises en compte dans la fiche du combattant. Évite de couper une valeur reconnue au milieu d’une mise en forme.'}</small></label>
  </div>
  <div data-covering-hide>${itemUseFieldsMarkup(w,'customUse')}</div>
  <div id="customWeaponFields">${weapon?customWeaponEditor(w):covering?customCoveringEditor(w):''}</div>
  <div class="custom-section"><div class="custom-section-head"><div><span class="micro-label">${en?'AVAILABILITY':'DISPONIBILITÉ'}</span><strong>${en?'Lists the equipment is added to':'Listes auxquelles l’équipement est ajouté'}</strong></div><small>${en?'Assigning it to a band does not remove the item from the Unrestricted List.':'Une affectation à une bande n’enlève pas l’objet de l’Unrestricted List.'}</small></div>
    <label class="custom-check unrestricted-check"><input id="customUnrestricted" type="checkbox" checked disabled> <span><b>Unrestricted List</b><small>${en?'Always available in the general list. The factions selected below also add the item to their Band List.':'Toujours disponible dans la liste générale. Les factions choisies ci-dessous ajoutent aussi l’objet à leur Band List.'}</small></span></label>
    <label class="custom-check market-check"><input id="customMarketList" type="checkbox" ${w?.market?'checked':''}> <span><b>Market List</b><small>${en?'Also adds the item to the Market List, accessible to every band during post-battle purchases.':'Ajoute aussi l’objet à la Market List, accessible à toutes les bandes lors des achats post-bataille.'}</small></span></label>
    <small class="custom-field-help covering-scope-note" data-covering-show>${en?'Covering: Band List only for the warbands ticked below (publishing it ★ “for every warband” doesn’t change that) · Market List and Trading Post only if “Market List” is ticked · always in the Unrestricted List · in a campaign market (via [ITEMS]) any warband can buy it.':'Revêtement : Band List seulement pour les bandes cochées ci-dessous (le publier ★ « pour toutes les bandes » n’y change rien) · Market List et Trading Post seulement si « Market List » est coché · toujours dans l’Unrestricted List · dans un marché de campagne (via [ITEMS]) toutes les bandes peuvent l’acheter.'}</small>
    <div class="custom-faction-grid">${D.factions.map(f=>`<label class="custom-check"><input class="customFaction" data-faction="${esc(f.id)}" type="checkbox" ${factions.includes(f.id)?'checked':''}><span>${esc(f.displayName)}</span></label>`).join('')}</div>
  </div>
  <div class="custom-actions"><button type="button" class="button secondary" onclick="resetCustomForm()">${en?'Reset':'Réinitialiser'}</button><button type="button" class="button primary" onclick="saveCustomEquipment()">${w?(en?'Save changes':'Enregistrer les modifications'):(en?'Create equipment':'Créer l’équipement')}</button></div></div>`
}
function customCoveringEditor(w){
  const en=siteLanguage==='en';const c=w?.covering||{};const ex=new Set((Array.isArray(c.excluded)?c.excluded:[]).map(normName));const bases=coveringBaseCandidates();
  const num=(id,label,v,hint)=>`<label class="custom-field"><span>${label}</span><input id="${id}" type="number" step="1" value="${Number(v)||''}" placeholder="0" oninput="refreshCoveringPreview()"><small class="custom-field-help">${hint}</small></label>`;
  const pick=bases.find(b=>normName(b.name)==='sword')||bases[0];
  return `<div class="custom-section covering-builder"><div class="custom-section-head"><div><span class="micro-label">${en?'WEAPON COVERING':'REVÊTEMENT D’ARME'}</span><strong>${en?'Added to the weapon’s own profile':'Ajouté au profil de l’arme'}</strong></div><small>${en?'Covered name: “covering + weapon”, e.g. Ithilmar Sword. One covering per weapon.':'Nom couvert : « revêtement + arme », ex. Ithilmar Sword. Un seul revêtement par arme.'}</small></div>
    <div class="custom-weapon-grid covering-mods"><label class="custom-field"><span>${en?'Price multiplier':'Multiplicateur de prix'}</span><input id="customCovMult" type="number" min="0" step="0.1" value="${w?coveringMult(w):2}" oninput="refreshCoveringPreview()"><small class="custom-field-help">Sword 25 GC × 2 = 50 GC</small></label><label class="custom-field"><span>${en?'Fixed surcharge (GC)':'Supplément fixe (GC)'}</span><input id="customCovFlat" type="number" step="1" value="${coveringFlat(w)||''}" placeholder="0" oninput="refreshCoveringPreview()"><small class="custom-field-help">${en?'Added after the multiplier: Axe 20 × 1 + 20 = 40':'Ajouté après le multiplicateur : Axe 20 × 1 + 20 = 40'}</small></label>
    ${num('customCovRange',en?'Range (Melee)':'Portée (Melee)',c.range,'Melee 2 +1 → Melee 3')}${num('customCovStrength',en?'Strength':'Force',c.strength,'S+2 +1 → S+3')}${num('customCovAp','AP',c.ap,'- −1 → -1')}${num('customCovDamage',en?'Damage':'Dégâts',c.damage,'1 +1 → 2 · D3 +1 → D3+1')}</div>
    <label class="custom-check covering-heroes"><input id="customCovHeroes" type="checkbox" ${w?(c.heroesOnly?'checked':''):'checked'}> <span><b>${en?'Heroes only':'Héros seulement'}</b><small>${en?'Henchmen can’t buy, equip or be given a weapon with this covering (promoted Veterans can).':'Les Henchmen ne peuvent ni acheter, ni équiper, ni recevoir une arme avec ce revêtement (les Veterans promus le peuvent).'}</small></span></label>
    <div class="custom-trait-editor"><div class="custom-section-head"><div><span class="micro-label">TRAITS</span><strong>${en?'Traits added to the weapon':'Traits ajoutés à l’arme'}</strong></div></div><div id="customTraitTags" class="custom-trait-tags">${customTraitTagsMarkup()}</div><div class="custom-trait-add"><input id="customTraitInput" list="customTraitDatalist" placeholder="${en?'Search a trait…':'Rechercher un trait…'}" onkeydown="handleCustomTraitKey(event)"><datalist id="customTraitDatalist">${referenceEntries('traits').map(t=>`<option value="${esc(t.name)}">`).join('')}</datalist><button type="button" class="button secondary" onclick="addCustomTrait()">＋ ${en?'Add':'Ajouter'}</button></div></div>
    <div class="custom-section-head covering-weapons-head"><div><span class="micro-label">${en?'COVERED WEAPONS':'ARMES CONCERNÉES'}</span><strong>${en?'Untick the weapons it can’t cover':'Décoche les armes exclues'}</strong></div><span class="covering-weapon-actions"><button type="button" class="button secondary" onclick="setCoveringWeapons(true)">${en?'All':'Tout'}</button><button type="button" class="button secondary" onclick="setCoveringWeapons(false)">${en?'None':'Aucune'}</button></span></div>
    <div class="custom-faction-grid covering-weapons">${bases.map(b=>`<label class="custom-check"><input class="customCovWeapon" data-name="${esc(b.name)}" type="checkbox" ${ex.has(normName(b.name))?'':'checked'}><span>${esc(b.name)}</span></label>`).join('')}</div>
    <div class="custom-section-head covering-preview-head"><div><span class="micro-label">${en?'PREVIEW':'APERÇU'}</span></div><select id="customCovPreviewBase" aria-label="${en?'Preview weapon':'Arme de l’aperçu'}" onchange="refreshCoveringPreview()">${bases.map(b=>`<option value="${esc(b.name)}" ${b===pick?'selected':''}>${esc(b.name)}</option>`).join('')}</select></div>
    <div id="customCoveringPreview" class="custom-weapon-preview">${coveringPreviewMarkup(w,pick,false)}</div>
  </div>`;
}
function setCoveringWeapons(on){document.querySelectorAll('.customCovWeapon').forEach(x=>{x.checked=on})}
function refreshCustomForm(){const en=siteLanguage==='en';const type=$('#customType')?.value;const box=$('#customWeaponFields');if(!box)return;$('#customEquipForm')?.classList.toggle('custom-form-covering',type==='covering');if(type==='covering'){box.innerHTML=customCoveringEditor(null);return}box.innerHTML=type==='weapon'?customWeaponEditor({name:$('#customName')?.value||(en?'New weapon':'Nouvelle arme'),profile:{range:$('#customRange')?.value||'',strength:$('#customStrength')?.value||'',ap:$('#customAp')?.value||'',damage:$('#customDamage')?.value||''},traits:customEquipmentTraitDraft}):''}
function resetCustomForm(){customEquipmentEditId=null;customEquipmentTraitDraft=[];customEquipmentTraitDraft2=[];render('custom')}
function toggleCustomEquipmentArchive(id){const en=siteLanguage==='en';const w=customEquipmentList().find(x=>x.customEquipmentId===id);if(!w)return;w.archived=!w.archived;save(true);render('custom');toast(w.archived?(en?'Equipment archived':'Équipement archivé'):(en?'Equipment unarchived':'Équipement désarchivé'))}
function customEquipmentRow(w){
  const en=siteLanguage==='en';
  // Library rows are a picklist, not a fiche: just enough to identify the
  // item (name / catégorie / prix). Faction access and rule text are shown
  // once, in the editor itself (✎), not duplicated here — same principle
  // as the custom fighter and traits/rules rows.
  return `<article class="custom-item-row${w.archived?' is-archived':''}"><div class="custom-item-main"><div class="custom-item-icon">${isCovering(w)?'◈':w.type==='weapon'||w.profile?'⚔':'◆'}</div><div><strong>${esc(w.name)}</strong><small>${w.archived?`<span class="archived-tag">${en?'ARCHIVED':'ARCHIVÉ'}</span> · `:''}${isCovering(w)?`${en?'Weapon covering':'Revêtement d’arme'} · ${en?'price':'prix'} ${coveringPriceLabel(w)}${coveringHeroesOnly(w)?(en?' · Heroes only':' · Héros seulement'):''}`:`${esc(w.category)} · ${Number(w.price||0)} GC`}${w.rarity?' · '+esc(w.rarity):''}</small></div></div><div class="custom-item-actions">${officializeBtnMarkup('equipment',w.customEquipmentId,w.officialWarbandId)}<button type="button" class="equipment-action" title="${w.archived?(en?'Unarchive':'Désarchiver'):(en?'Archive':'Archiver')}" onclick="toggleCustomEquipmentArchive('${w.customEquipmentId}')">${w.archived?'⇤':'🗄'}</button><button type="button" class="equipment-action" onclick="editCustomEquipment('${w.customEquipmentId}')">✎</button><button type="button" class="equipment-action remove" onclick="deleteCustomEquipment('${w.customEquipmentId}')">🗑</button></div></article>`}
// Same idea, for custom fighter profiles (Custom > Profils): those are
// tracked on the warband via cw.fighterIds, same as equipment, so this
// mirrors officializedEquipmentIdSet exactly.
function officializedFighterIdSet(){
  const ids=new Set();
  customWarbandList().forEach(cw=>{if(cw.officialId)(cw.fighterIds||[]).forEach(id=>ids.add(id));});
  customFighterList().forEach(w=>{if(w.officialWarbandId)ids.add(w.customFighterId);});
  try{customOnlineCopyIds('fighters').forEach(id=>ids.add(id))}catch(e){}
  return ids;
}
$('#modalClose').onclick=closeModal;$('#modal').onclick=e=>{if(e.target.id==='modal'&&!modalSticky)closeModal()};// V-TABBAR: "Reset data" lives in Account now, behind a typed confirmation.
function openResetData(){
  const en=siteLanguage==='en';
  if(adminViewingUserId){toast(en?'Exit admin viewing mode first (banner at the top).':'Quitte d’abord le mode consultation admin (bandeau en haut).');return}
  const word=en?'RESET':'EFFACER';const signedIn=cloudIsSignedIn();
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'PERMANENT':'DÉFINITIF'}</div><h2>${en?'Reset all data?':'Réinitialiser toutes les données ?'}</h2><p>${signedIn?(en?'This erases all your warbands, here and in your account, on every device. It cannot be undone.':'Ceci efface toutes tes bandes, ici et dans ton compte, sur tous tes appareils. Impossible à annuler.'):(en?'This erases all the warbands stored on this device. It cannot be undone.':'Ceci efface toutes les bandes enregistrées sur cet appareil. Impossible à annuler.')}</p><p>${en?`Type <b>${word}</b> to confirm.`:`Tape <b>${word}</b> pour confirmer.`}</p><input id="resetDataConfirm" autocomplete="off" oninput="document.getElementById('resetDataGo').disabled=this.value.trim().toUpperCase()!=='${word}'"><div class="custom-actions"><button type="button" class="button secondary" onclick="closeModal()">${en?'Cancel':'Annuler'}</button><button type="button" class="button danger" id="resetDataGo" disabled onclick="closeModal();resetAllData()">${en?'Erase everything':'Tout effacer'}</button></div></div>`);
  setTimeout(()=>$('#resetDataConfirm')?.focus(),20);
}
function resetAllData(){
  // V-ADMINFOREIGNSAVE (Task #47): while an admin is viewing/editing another
  // player's account through the admin support panel, `state` holds THAT
  // player's data, not the admin's own — clearing localStorage here would
  // permanently wipe the admin's own real data (the key this button clears
  // is the same one their own account lives under) for a single misclick.
  // Exiting first restores the admin's own state, where this button is safe.
  if(adminViewingUserId){toast(siteLanguage==='en'?'Exit admin viewing mode first (banner at the top).':'Quitte d’abord le mode consultation admin (bandeau en haut).');return}
  const signedIn=cloudIsSignedIn();
  const keepMeta=signedIn?{accountUserId:state?.meta?.accountUserId,cloudRevision:state?.meta?.cloudRevision}:null;
  window.MordheimundaStorage.clear();
  state=window.MordheimundaStorage.load();
  if(keepMeta){state.meta=state.meta||{};Object.assign(state.meta,keepMeta);state=window.MordheimundaStorage.save(state);}
  navigateApp('/');toast(siteLanguage==='en'?'Data reset':'Données réinitialisées');
  if(signedIn)queueCloudSave();
}
function newCustomCreature(){customCreatureEditId=null;customCreatureRuleDraft=[];customCreatureWeaponDraft=[];customCreatureNewKind='animal';render('custom');setTimeout(()=>$('#ccName')?.focus(),30)}
function setCustomCreatureKind(v){customCreatureNewKind=v==='mount'?'mount':'animal';render('custom')}
function resetCustomCreatureForm(){newCustomCreature()}
function toggleCustomCreatureArchive(id){const en=siteLanguage==='en';const w=customCreatureById(id);if(!w)return;w.archived=!w.archived;save(true);render('custom');toast(w.archived?(en?'Profile archived':'Profil archivé'):(en?'Profile unarchived':'Profil désarchivé'))}
function addCustomCreatureRule(){
  const input=$('#ccRuleInput'),v=(input?.value||'').trim();if(!v)return;
  const found=preferParamTemplate('special',referenceFind('special',v)),canonical=found?.name||v;
  if(isTraitParamTemplate(canonical)){if(input)input.value='';openTraitParamPrompt('creature',null,canonical);return}
  if(!customCreatureRuleDraft.some(x=>normName(x)===normName(canonical)))customCreatureRuleDraft.push(canonical);
  if(input)input.value='';refreshCustomCreatureTags();setTimeout(()=>$('#ccRuleInput')?.focus(),20);
}
function handleCustomCreatureRuleKey(e){if(e.key==='Enter'){e.preventDefault();addCustomCreatureRule()}}
function saveCustomCreature(){
  const en=siteLanguage==='en';
  const name=($('#ccName')?.value||'').trim();
  const kind=$('#ccKind')?.value==='mount'?'mount':'animal';
  if(!name){toast(en?'Give it a name':'Donne-lui un nom');return}
  const cost=Math.max(0,Number($('#ccCost')?.value||0));
  if(!Number.isFinite(cost)){toast(en?'Invalid cost':'Coût invalide');return}
  const profile=P.map((_,i)=>{const raw=($('#ccStat'+i)?.value??'').trim();if(raw==='')return null;const n=Number(raw);return Number.isFinite(n)?n:null});
  const sv=($('#ccSv')?.value||'').trim();
  const ruleNames=customCreatureRuleDraft.slice();
  const naturalWeapons=kind==='animal'?(document.querySelector('.ccNaturalWeapons')?customFighterReadChecks('ccNaturalWeapons'):customCreatureWeaponDraft.slice()):[];
  const prevSkills=customCreatureById(customCreatureEditId)?.skills||[];
  const skills=document.querySelector('.ccSkills')?customFighterReadChecks('ccSkills'):prevSkills.slice();
  const prev=customCreatureById(customCreatureEditId);
  const limited=document.querySelector('input[name="ccScope"]')?document.querySelector('input[name="ccScope"]:checked')?.value==='some':!!(prev?.factions||[]).length;
  const factions=limited?(document.querySelector('.ccFaction')?[...document.querySelectorAll('.ccFaction:checked')].map(x=>x.dataset.faction):(prev?.factions||[]).slice()):[];
  const market=kind==='mount'?($('#ccMarket')?$('#ccMarket').checked:prev?.market!==false):false;
  const item={customCreatureId:customCreatureEditId||crypto.randomUUID(),kind,name,cost,profile,sv,ruleNames,rules:ruleNames.join(', '),naturalWeapons,skills,factions,market};
  const existing=customCreatureById(item.customCreatureId);item.archived=existing?.archived||false;
  const idx=customCreatureList().findIndex(w=>w.customCreatureId===item.customCreatureId);
  // Keep fields the form doesn't edit (e.g. officialWarbandId) instead of
  // dropping them on every save.
  if(idx>=0)state.customCreatures[idx]={...existing,...item};else state.customCreatures.push(item);
  customCreatureEditId=item.customCreatureId;save(true);
  render('custom');toast(idx>=0?(en?'Profile updated':'Profil modifié'):(en?'Profile created':'Profil créé'));
  if(idx>=0)autoPushPublishedEdit('creatures',item.customCreatureId);
}
function customCreatureForm(w){
  const en=siteLanguage==='en';
  const editing=!!customCreatureEditId;
  const kind=editing?(w?.kind||'animal'):customCreatureNewKind;
  const isMount=kind==='mount';
  const rules=editing?customCreatureRuleDraft:(w?.ruleNames||[]);
  const p=w?.profile||[];
  const sv=w?.sv||'';
  return `<div class="custom-form-head"><div><div class="eyebrow">${w?(en?'EDIT':'MODIFICATION'):(en?'NEW PROFILE':'NOUVEAU PROFIL')}</div><h3>${esc(w?.name||(en?'Build an animal or mount':'Construire un animal ou une monture'))}</h3></div>${w?`<button type="button" class="button secondary" onclick="newCustomCreature()">＋ ${en?'New':'Nouveau'}</button>`:''}</div>
  <div class="custom-form-grid">
    <label class="custom-field wide"><span>${en?'Name':'Nom'}</span><input id="ccName" value="${esc(w?.name||'')}" placeholder="${en?'E.g. Wolf, Warhorse…':'Ex. Loup, Cheval de guerre…'}"></label>
    <label class="custom-field"><span>${en?'Kind':'Type'}</span><select id="ccKind" onchange="setCustomCreatureKind(this.value)"><option value="animal" ${!isMount?'selected':''}>${en?'Animal — full profile':'Animal — profil complet'}</option><option value="mount" ${isMount?'selected':''}>${en?'Mount — attaches to a fighter':'Monture — s’intègre à un combattant'}</option></select></label>
    <label class="custom-field"><span>${en?'Cost (GC)':'Coût (GC)'}</span><input id="ccCost" type="number" min="0" step="1" value="${Number(w?.cost||0)}"></label>
  </div>
  <details class="custom-collapse" open><summary><span>${en?'CHARACTERISTICS':'CARACTÉRISTIQUES'}</span><small>${en?'Same columns as a fighter':'Mêmes colonnes qu’un combattant'}</small></summary><table class="custom-stat-bar"><tr>${P.map((n,i)=>`<th title="${esc(P_FULL[i])}">${esc(n)}</th>`).join('')}<th title="${en?'Armour Save':'Sauvegarde d’armure'}">Sv</th></tr><tr>${P.map((n,i)=>`<td><input id="ccStat${i}" type="number" step="1" value="${p[i]===null||p[i]===undefined?'':esc(p[i])}" placeholder="—"></td>`).join('')}<td><input id="ccSv" value="${esc(sv)}" placeholder="${en?'e.g. 5+':'ex. 5+'}"></td></tr></table><p class="muted" style="font-size:11px;margin:8px 0 0">${en?'Leave any cell empty to show “—” (e.g. BS on a mount).':'Laisse une case vide pour afficher « — » (ex. BS sur une monture).'}</p></details>
  <details class="custom-collapse" open><summary><span>${en?'SPECIAL RULES':'RÈGLES SPÉCIALES'}</span><small>${rules.length} ${en?'linked':(rules.length>1?'liées':'liée')}</small></summary><div class="custom-tag-editor"><div id="ccRuleTags" class="custom-trait-tags">${rules.map((s,i)=>`<span class="custom-trait-tag">${refLink('special',s,s)}${isEditableParamTag('creature',s)?`<button type="button" title="${en?'Edit value':'Modifier la valeur'}" class="trait-tag-edit" onclick="editTraitParamValue('creature',${i})">✎</button>`:''}<button type="button" onclick="removeCustomCreatureRule(${i})">×</button></span>`).join('')||`<span class="custom-trait-empty">${en?'No special rules.':'Aucune règle spéciale.'}</span>`}</div><div class="custom-trait-add"><input id="ccRuleInput" list="ccRuleDatalist" placeholder="${en?'Search a special rule…':'Rechercher une règle spéciale…'}" onkeydown="handleCustomCreatureRuleKey(event)"><datalist id="ccRuleDatalist">${referenceEntries('special').filter(s=>!/^Race\s*\(/i.test(s.name)).map(s=>`<option value="${esc(s.name)}">`).join('')}</datalist><button type="button" class="button secondary" onclick="addCustomCreatureRule()">＋ ${en?'Add':'Ajouter'}</button></div></div></details>
  ${(()=>{const own=Array.isArray(w?.skills)?w.skills:[];const all=[...new Set([...customFighterSkillNames(),...own])].sort((a,b)=>a.localeCompare(b));return `<details class="custom-collapse"${own.length?' open':''}><summary><span>${en?'SKILLS':'COMPÉTENCES'}</span><small>${own.length}</small></summary><p class="sheet-help">${isMount?(en?'Shown with the mount on its rider’s sheet.':'Affichées avec la monture sur la fiche de son cavalier.'):(en?'Given to this animal when recruited, like a fighter’s default skills.':'Données à cet animal quand il est recruté, comme les compétences par défaut d’un combattant.')}</p><input class="search" placeholder="${en?'Filter skills…':'Filtrer les compétences…'}" oninput="const q=this.value.toLowerCase();this.nextElementSibling.querySelectorAll('label').forEach(l=>l.style.display=l.textContent.toLowerCase().includes(q)?'':'none')"><div class="custom-equipment-checks" style="max-height:240px;overflow:auto">${all.map(sn=>`<label><input class="ccSkills" data-name="${esc(sn)}" type="checkbox" ${own.some(n=>normName(n)===normName(sn))?'checked':''}><span>${refLink('skills',sn,sn)}</span></label>`).join('')}</div></details>`})()}
  ${isMount?'':`<details class="custom-collapse"${customCreatureWeaponDraft.length?' open':''}><summary><span>${en?'NATURAL WEAPONS':'ARMES NATURELLES'}</span><small>${customCreatureWeaponDraft.length} ${en?'item'+(customCreatureWeaponDraft.length!==1?'s':''):'objet'+(customCreatureWeaponDraft.length!==1?'s':'')}</small></summary><p class="sheet-help">${en?'Given free to this animal when recruited (claws, bite…). Create a weapon in Custom → Equipment first if it doesn’t exist yet.':'Données gratuitement à cet animal quand il est recruté (griffes, morsure…). Crée d’abord l’arme dans Custom → Équipements si elle n’existe pas encore.'}</p><div onchange="customCreatureWeaponDraft=customFighterReadChecks('ccNaturalWeapons')">${customFighterEquipmentChooser('ccNaturalWeapons',customCreatureWeaponDraft,'default')}</div></details>`}
  ${(()=>{const sel=Array.isArray(w?.factions)?w.factions:[];const some=sel.length>0;const opts=creatureScopeFactionOptions();return `<details class="custom-collapse"${some?' open':''}><summary><span>${en?'AVAILABILITY':'DISPONIBILITÉ'}</span><small>${some?`${sel.length} ${en?'warband'+(sel.length>1?'s':''):'bande'+(sel.length>1?'s':'')}`:(en?'All warbands':'Toutes les bandes')}</small></summary>
    <label class="custom-check"><input type="radio" name="ccScope" value="all" ${some?'':'checked'} onchange="this.closest('details').querySelector('.cc-faction-grid').style.display='none'"> <span><b>${en?'All warbands':'Toutes les bandes'}</b><small>${isMount?(en?'In the general equipment list of every warband.':'Dans la liste d’équipement générale de toutes les bandes.'):(en?'Recruitable by every warband.':'Recrutable par toutes les bandes.')}</small></span></label>
    <label class="custom-check"><input type="radio" name="ccScope" value="some" ${some?'checked':''} onchange="this.closest('details').querySelector('.cc-faction-grid').style.display=''"> <span><b>${en?'Only the warbands ticked below':'Seulement les bandes cochées ci-dessous'}</b><small>${isMount?(en?'Only in their Band List.':'Seulement dans leur Liste de bande.'):(en?'Only they can recruit it.':'Seules elles peuvent le recruter.')}</small></span></label>
    <div class="custom-faction-grid cc-faction-grid" style="${some?'':'display:none'}">${opts.map(o=>`<label class="custom-check"><input class="ccFaction" data-faction="${esc(o.id)}" type="checkbox" ${sel.includes(o.id)?'checked':''}><span>${esc(o.name)}</span></label>`).join('')}</div>
    ${isMount?`<label class="custom-check market-check"><input id="ccMarket" type="checkbox" ${w?.market===false?'':'checked'}> <span><b>${en?'Market (Trading Post)':'Marché (Trading Post)'}</b><small>${en?'Also buyable by every warband at the Trading Post, whatever is ticked above.':'Aussi achetable par toutes les bandes au Trading Post, quelles que soient les bandes cochées.'}</small></span></label>`:''}
  </details>`})()}
  <div class="custom-actions"><button type="button" class="button secondary" onclick="resetCustomCreatureForm()">${en?'Reset':'Réinitialiser'}</button><button type="button" class="button primary" onclick="saveCustomCreature()">${w?(en?'Save changes':'Enregistrer les modifications'):(en?'Create profile':'Créer le profil')}</button></div>`;
}
function customCreatureRow(w){
  const en=siteLanguage==='en';
  const isMount=w.kind==='mount';
  const kindLabel=isMount?(en?'Mount':'Monture'):(en?'Animal':'Animal');
  return `<article class="custom-item-row${w.archived?' is-archived':''}"><div class="custom-item-main"><div class="custom-item-icon">${isMount?'🐎':'🐾'}</div><div><strong>${esc(w.name)}</strong><small>${w.archived?`<span class="archived-tag">${en?'ARCHIVED':'ARCHIVÉ'}</span> · `:''}${w.officialWarbandId?`<span class="archived-tag official-tag">${en?'OFFICIALIZED':'OFFICIALISÉ'}</span> · `:''}${kindLabel} · ${Number(w.cost||0)} GC</small></div></div><div class="custom-item-actions">${officializeBtnMarkup('creature',w.customCreatureId,w.officialWarbandId)}<button type="button" class="equipment-action" title="${w.archived?(en?'Unarchive':'Désarchiver'):(en?'Archive':'Archiver')}" onclick="toggleCustomCreatureArchive('${w.customCreatureId}')">${w.archived?'⇤':'🗄'}</button><button type="button" class="equipment-action" onclick="editCustomCreature('${w.customCreatureId}')">✎</button><button type="button" class="equipment-action remove" onclick="deleteCustomCreature('${w.customCreatureId}')">🗑</button></div></article>`}
function openCustomArea(area){
  customArea=area;
  if(area==='warband'){customContentTab='warband';customWarbandEditId=null;customWarbandCreating=false;customWarbandSection='fighters';}
  else if(customContentTab==='warband'||!customContentTab){customContentTab='traits';}
  customContentSearch='';customBuilderResetComposer();
  // V-WARBANDEXCLUSIVE: navigating here through the normal landing/back
  // links (rather than returnToWarbandEditor, which clears this itself on
  // its own way out) abandons any in-progress "create exclusive to warband
  // X" — without this, an unrelated equipment/content creation right after
  // could silently get tagged exclusive to a warband the person already
  // left.
  customWarbandCreateContextId=null;
  render('custom');
}
function backToCustomLanding(){customArea=null;customWarbandCreateContextId=null;render('custom');}
function customContentTypeLabel(k){const en=siteLanguage==='en';return (en?{traits:'Weapon trait',skills:'Skill',spells:'Spell',special:'Special rule'}:{traits:'Trait d’arme',skills:'Compétence',spells:'Sort',special:'Règle spéciale'})[k]||k}
function customContentForm(kind,w){
  const en=siteLanguage==='en';
  const draft=customContentDraftItems;
  const isSkill=kind==='skills',isSpell=kind==='spells';
  const trees=Object.keys(customMergedSkillSets()),domains=Object.keys(customMergedMagicDomains());
  const exclusiveCw=customWarbandCreateContextId?customWarbandById(customWarbandCreateContextId):null;
  const exclusiveBanner=exclusiveCw?(kind==='special'?`<div class="official-draft-notice"><span class="official-draft-tag">${en?'EXCLUSIVE':'EXCLUSIF'}</span><p>${en?`This special rule will be exclusive to <b>${esc(exclusiveCw.name)}</b> — automatically checked for this warband, it will no longer appear in the general Generic Custom list. <a href="#" onclick="returnToWarbandEditor('special');return false;">← Back to the warband without saving</a>`:`Cette règle spéciale sera exclusive à <b>${esc(exclusiveCw.name)}</b> — cochée automatiquement pour cette warband, elle n’apparaîtra plus dans la liste générale de Custom Générique. <a href="#" onclick="returnToWarbandEditor('special');return false;">← Retour à la warband sans enregistrer</a>`}</p></div>`:`<div class="official-draft-notice"><span class="official-draft-tag">WARBAND</span><p>${en?`This trait will be automatically checked for <b>${esc(exclusiveCw.name)}</b> — it otherwise remains reusable for any other warband via Generic Custom. <a href="#" onclick="returnToWarbandEditor('traits');return false;">← Back to the warband without saving</a>`:`Ce trait sera coché automatiquement pour <b>${esc(exclusiveCw.name)}</b> — il reste par ailleurs réutilisable pour n’importe quelle autre warband via Custom Générique. <a href="#" onclick="returnToWarbandEditor('traits');return false;">← Retour à la warband sans enregistrer</a>`}</p></div>`):'';
  return `${exclusiveBanner}<div class="custom-form-head"><div><div class="eyebrow">${w?(en?'EDIT':'MODIFICATION'):(en?'NEW ENTRY':'NOUVELLE ENTRÉE')}</div><h3>${esc(w?.name||(en?'Create '+customContentTypeLabel(kind).toLowerCase():'Créer '+customContentTypeLabel(kind).toLowerCase()))}</h3></div>${w?`<button type="button" class="button secondary" onclick="newCustomContent('${kind}')">＋ ${en?'New':'Nouveau'}</button>`:''}</div>
  <div class="custom-form-grid"><label class="custom-field wide"><span>${en?'Name':'Nom'}</span><input id="ccName" value="${esc(w?.name||'')}" placeholder="${en?'Name of the '+customContentTypeLabel(kind).toLowerCase():'Nom de la '+customContentTypeLabel(kind).toLowerCase()}"></label>
  ${isSkill?`<label class="custom-field"><span>${en?'Skill tree':'Arbre de compétences'}</span><select id="ccTree"><option value="">${en?'Choose a tree…':'Choisir un arbre…'}</option>${trees.map(t=>`<option value="${esc(t)}" ${w?.tree===t?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`:''}
  ${isSpell?`<label class="custom-field"><span>${en?'Magic domain':'Domaine de magie'}</span><select id="ccDomain"><option value="">${en?'Choose a domain…':'Choisir un domaine…'}</option>${domains.map(t=>`<option value="${esc(t)}" ${w?.domain===t?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`:''}</div>
  ${isSkill?customSkillTreePanel():''}${isSpell?customMagicDomainPanel():''}
  ${isSpell?`<label class="custom-check"><input id="ccHasWeaponProfile" type="checkbox" ${w?.profile?'checked':''} onchange="toggleSpellWeaponProfile()"> <span><b>${en?'This spell has a weapon profile':'Ce sort a un profil d’arme'}</b><small>${en?'The spell then appears as a weapon on the fighter’s sheet — but only for fighters who know this spell.':'Le sort apparaît alors comme une arme sur la fiche du combattant — mais seulement pour les combattants qui connaissent ce sort.'}</small></span></label><div id="ccWeaponFields">${w?.profile?customWeaponEditor(w):''}</div>`:''}
  <details class="custom-collapse" open><summary><span>${en?'TEXT / RULE':'TEXTE / RÈGLE'}</span><small>${en?'Shown in the Reference':'Affiché dans le Référentiel'}</small></summary>${customTextToolbarMarkup('ccText')}<textarea id="ccText" class="wide-textarea" rows="7" placeholder="${en?'Full rule text…':'Texte complet de la règle…'}">${esc(w?.text||'')}</textarea></details>
  <div class="custom-actions"><button type="button" class="button secondary" onclick="resetCustomContentForm('${kind}')">${en?'Reset':'Réinitialiser'}</button><button type="button" class="button primary" onclick="saveCustomContent('${kind}')">${w?(en?'Save changes':'Enregistrer les modifications'):(en?'Create':'Créer')}</button></div>`;
}
// Mirrors refreshCustomForm's weapon-fields toggle (equipment editor), for a
// spell's OPTIONAL weapon profile (V-SPELLWEAPON): a checkbox rather than a
// forced type field, since a spell is a spell first and only sometimes also
// behaves like a weapon (see ownedFighterCard's spellWeapons).
function toggleSpellWeaponProfile(){const box=$('#ccWeaponFields');if(!box)return;const checked=!!$('#ccHasWeaponProfile')?.checked;box.innerHTML=checked?customWeaponEditor({profile:{}}):''}
function deleteCustomContent(kind,id){const en=siteLanguage==='en';const w=customContentById(kind,id);if(!w)return;openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'DELETE':'SUPPRESSION'}</div><h2>${en?'Delete “':'Supprimer « '}${esc(w.name)}${en?'”?':' » ?'}</h2><p>${en?'Profiles and fighters already saved are not retroactively modified.':'Les profils et combattants déjà enregistrés ne sont pas modifiés rétroactivement.'}</p><button type="button" class="big-delete" onclick="confirmDeleteCustomContent('${kind}','${id}')">${en?'DELETE':'SUPPRIMER'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`)}
function confirmDeleteCustomContent(kind,id){const en=siteLanguage==='en';const map={traits:'customTraits',skills:'customSkills',spells:'customSpells',special:'customSpecialRules'};const key=map[kind];markDeleted(key,id);state[key]=customContentList(kind).filter(x=>x.customContentId!==id);customContentEditId=null;save(true);closeModal();render('custom');toast(en?'Entry deleted':'Entrée supprimée')}
function saveCustomContent(kind){
  const en=siteLanguage==='en';
  const name=($('#ccName')?.value||'').trim(),text=($('#ccText')?.value||'').trim();
  if(!name){toast(en?'Give the entry a name':'Donne un nom à l’entrée');return}
  if(!text){toast(en?'Add the rule text':'Ajoute le texte de la règle');return}
  const item={customContentId:customContentEditId||crypto.randomUUID(),name,text};
  if(kind==='skills')item.tree=($('#ccTree')?.value||'').trim();
  if(kind==='spells'){
    item.domain=($('#ccDomain')?.value||'').trim();
    // V-SPELLWEAPON: only ever set from this checkbox+fields, never inferred
    // from the rule text — see the module comment above toggleSpellWeaponProfile.
    if($('#ccHasWeaponProfile')?.checked){
      item.profile={range:($('#customRange')?.value||'').trim(),strength:($('#customStrength')?.value||'').trim(),ap:($('#customAp')?.value||'').trim(),damage:($('#customDamage')?.value||'').trim(),traits:customEquipmentTraitDraft.join(', ')};
    }else item.profile=null;
  }
  if(kind==='skills'&&item.tree&&customSkillTreeList().some(t=>t.name===item.tree)){const cur=customContentList('skills').find(x=>x.customContentId===item.customContentId);const count=customContentList('skills').filter(x=>x.tree===item.tree&&x.customContentId!==item.customContentId).length;if(count>=6){toast(en?'This custom tree already has 6 skills':'Cet arbre custom contient déjà 6 compétences');return}}
  // V-DOMAINSPELLCAP: no longer refuses past a 6th spell in a custom domain
  // — see the matching comment on adminAddSpellToDomain for why.
  const map={traits:'customTraits',skills:'customSkills',spells:'customSpells',special:'customSpecialRules'},key=map[kind],arr=customContentList(kind),idx=arr.findIndex(x=>x.customContentId===item.customContentId);const oldName=idx>=0?arr[idx].name:null;item.archived=idx>=0?!!arr[idx].archived:false;const prevExclusiveWarbandId=idx>=0?(arr[idx].exclusiveWarbandId||null):null;if(idx>=0)['officialWarbandId','officialWarbandIds','bookFactionIds'].forEach(k=>{if(arr[idx][k]!==undefined)item[k]=arr[idx][k]});if(idx>=0){if(state[key][idx]&&'addedAt' in state[key][idx])item.addedAt=state[key][idx].addedAt;state[key][idx]=item}else state[key].push(item);
  // V-CUSTOMSKILLRENAME: renaming an entry HERE (typing a new name in the
  // Custom-tab form) changes the entry's own .name directly — unlike the
  // Référentiel's ✎ Title button, which only overlays a display title and
  // leaves .name untouched, so every by-name lookup still resolves it.
  // Without this cascade, a fighter who already owns the skill/spell (its
  // NAME is what's stored on x.skills/x.spells, not an id) kept showing the
  // stale old name forever — every OTHER place (the Référentiel, warband
  // Rules pages, the add-skill picker) re-reads the current entry list and
  // so already picked up the rename, but an already-acquired copy never
  // did. Re-pointing every stored occurrence to the new name fixes that.
  if(oldName&&oldName!==name)cascadeRenameCustomContentName(kind,oldName,name);
  // V-WARBANDEXCLUSIVE: special rules created from inside a warband's own
  // section get tagged exclusive (hidden from Custom Générique — see the
  // filter in custom()); traits stay global. Either way, auto-check the new
  // entry into the warband it was created from so there's nothing left to
  // go back and tick by hand.
  if(kind==='special')item.exclusiveWarbandId=customWarbandCreateContextId||prevExclusiveWarbandId;
  if(customWarbandCreateContextId&&(kind==='special'||kind==='traits')){
    const cw=customWarbandById(customWarbandCreateContextId);
    if(cw){const key2=kind==='special'?'specialRuleIds':'traitIds';cw[key2]=Array.isArray(cw[key2])?cw[key2]:[];if(!cw[key2].includes(item.customContentId))cw[key2].push(item.customContentId);}
  }
  customContentEditId=item.customContentId;save(true);
  if(idx>=0&&!(oldName&&oldName!==name))autoPushPublishedEdit(kind,item.customContentId);
  if((kind==='special'||kind==='traits')&&returnToWarbandEditor(kind)){toast(idx>=0?(en?'Entry updated':'Entrée modifiée'):(en?(kind==='special'?'Exclusive rule created — checked for this warband':'Trait created — checked for this warband'):(kind==='special'?'Règle exclusive créée — cochée pour cette warband':'Trait créé — coché pour cette warband')));return;}
  render('custom');toast(idx>=0?(en?'Entry updated':'Entrée modifiée'):(en?'Entry created':'Entrée créée'))
}
function cascadeRenameCustomContentName(kind,oldName,newName){
  if(!oldName||!newName||oldName===newName)return;
  if(kind==='skills'){
    (state.rosters||[]).forEach(r=>(r.fighters||[]).forEach(x=>{
      if(Array.isArray(x.skills)){const i=x.skills.indexOf(oldName);if(i>=0)x.skills[i]=newName;}
    }));
    (state.customFighters||[]).forEach(cf=>{
      if(Array.isArray(cf.defaultSkills)){const i=cf.defaultSkills.indexOf(oldName);if(i>=0)cf.defaultSkills[i]=newName;}
    });
  }else if(kind==='spells'){
    (state.rosters||[]).forEach(r=>(r.fighters||[]).forEach(x=>{
      if(Array.isArray(x.spells)){const i=x.spells.indexOf(oldName);if(i>=0)x.spells[i]=newName;}
    }));
  }
}
function resetCustomContentForm(kind){customContentEditId=null;customContentDraftItems=[];render('custom')}
function toggleCustomContentArchive(kind,id){const en=siteLanguage==='en';const w=customContentById(kind,id);if(!w)return;w.archived=!w.archived;save(true);render('custom');toast(w.archived?(en?'Entry archived':'Entrée archivée'):(en?'Entry unarchived':'Entrée désarchivée'))}
function customContentLibraryRow(kind,w,isOfficial){const en=siteLanguage==='en';const place=w.tree||w.domain||'';
  // Library rows are a picklist, not a fiche: just enough to identify the
  // entry (name / type / arbre-domaine). The full rule text is shown once,
  // in the editor itself (✎), not duplicated here — same principle as the
  // custom fighter rows.
  return `<article class="custom-item-row${w.archived?' is-archived':''}"><div class="custom-item-main"><div class="custom-item-icon">${kind==='traits'?'◆':kind==='skills'?'★':kind==='spells'?'✦':'✚'}</div><div><strong>${esc(w.name)}</strong><small>${w.archived?`<span class="archived-tag">${en?'ARCHIVED':'ARCHIVÉ'}</span> · `:''}${isOfficial?`<span class="archived-tag official-tag">${en?'OFFICIALIZED':'OFFICIALISÉ'}</span> · `:''}${esc(customContentTypeLabel(kind))}${place?' · '+esc(place):''}</small></div></div><div class="custom-item-actions">${officializeBtnMarkup(kind,w.customContentId,w.officialWarbandId)}<button type="button" class="equipment-action" title="${w.archived?(en?'Unarchive':'Désarchiver'):(en?'Archive':'Archiver')}" onclick="toggleCustomContentArchive('${kind}','${w.customContentId}')">${w.archived?'⇤':'🗄'}</button><button type="button" class="equipment-action" onclick="editCustomContent('${kind}','${w.customContentId}')">✎</button><button type="button" class="equipment-action remove" onclick="deleteCustomContent('${kind}','${w.customContentId}')">🗑</button></div></article>`}
function customBuilderItemById(kind,id){return customContentById(kind,id)}
function customBuilderOpenNew(kind,parentId){customTreeComposer={kind,parentId,itemId:null};if(kind==='spells')customEquipmentTraitDraft=[];render('custom')}
function customBuilderOpenEdit(kind,parentId,itemId){customTreeComposer={kind,parentId,itemId};if(kind==='spells'){const w=customBuilderItemById(kind,itemId);customEquipmentTraitDraft=Array.isArray(w?.profile?.traits)?w.profile.traits:String(w?.profile?.traits||'').split(',').map(x=>x.trim()).filter(Boolean)}render('custom')}
function customBuilderDelete(kind,id){
  const en=siteLanguage==='en';
  const w=customBuilderItemById(kind,id); if(!w)return;
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'DELETE':'SUPPRESSION'}</div><h2>${en?'Delete “':'Supprimer « '}${esc(w.name)}${en?'”?':' » ?'}</h2><p>${en?'This custom entry will be removed from its tree/domain.':'Cette entrée custom sera retirée de son arbre/domaine.'}</p><button type="button" class="big-delete" onclick="confirmCustomBuilderDelete('${kind}','${id}')">${en?'DELETE':'SUPPRIMER'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`)
}
function confirmCustomBuilderDelete(kind,id){
  const en=siteLanguage==='en';
  const map={skills:'customSkills',spells:'customSpells'}; const key=map[kind];
  if(!key)return; markDeleted(key,id); state[key]=customContentList(kind).filter(x=>x.customContentId!==id);
  customBuilderResetComposer(); save(true); closeModal(); render('custom'); toast(kind==='skills'?(en?'Skill deleted':'Compétence supprimée'):(en?'Spell deleted':'Sort supprimé'))
}
function toggleCustomTreeCard(kind,parentId){
  const key=`${kind}:${parentId}`;
  if(customTreeCardsOpen.has(key))customTreeCardsOpen.delete(key);else customTreeCardsOpen.add(key);
  render('custom');
}
function customSkillSpellBuilder(kind){
  const en=siteLanguage==='en';
  // V-OFFICIALIZEHIDE (Task #83): once officialized, an entry drops out of
  // Custom entirely — same rule as fighters/equipment/traits/special
  // (officializedFighterIdSet/officializedEquipmentIdSet/officializedContentIdSets)
  // — it's published, live for everyone, and still editable from Admin →
  // Gestion, so a copy here was just clutter. A tree/domain officialized as
  // a WHOLE (parent.officialWarbandId set — see the ☆ button below) drops
  // out entirely, same as an officialized custom warband; one officialized
  // item-by-item still shows its tree/domain (other entries may remain
  // unpublished) but disappears from that tree/domain's own item list.
  const officialIds=officializedContentIdSets()[kind];
  const isSkill=kind==='skills';
  const field=isSkill?'tree':'domain';
  // V-OFFICIALIZEHIDE-EMPTYTREE: a tree/domain officialized item-by-item
  // (rather than via the ☆ "whole tree/domain" button, which does flag
  // parent.officialWarbandId directly) never got that flag itself, so once
  // EVERY one of its skills/spells had been officialized one at a time, it
  // was left behind looking broken — still listed, but with "no custom
  // entry in this tree" (every child hidden, nothing to show) even though
  // it's fully published. A tree/domain that never had any content stays
  // visible (so there's still something to click "+ Add" on); one that had
  // content and lost every entry to officializing now drops out too, same
  // as if it had been officialized as a whole.
  const allOfficializedAway=p=>{
    const all=customContentList(kind).filter(x=>normName(x[field]||'')===normName(p.name));
    return all.length>0&&all.every(x=>officialIds.has(x.customContentId));
  };
  const parents=customBuilderParentList(kind).filter(p=>!p.officialWarbandId&&!allOfficializedAway(p));
  const composer=customTreeComposer.kind===kind?customTreeComposer:null;
  const title=en?(isSkill?'SKILL TREES':'MAGIC DOMAINS'):(isSkill?'ARBRES DE COMPÉTENCES':'DOMAINES DE MAGIE');
  const label=en?(isSkill?'tree':'domain'):(isSkill?'arbre':'domaine');
  const itemLabel=en?(isSkill?'skill':'spell'):(isSkill?'compétence':'sort');
  const createId=isSkill?'newSkillTreeName':'newMagicDomainName', descId=isSkill?'newSkillTreeDesc':'newMagicDomainDesc';
  const createFn=isSkill?'createCustomSkillTree':'createCustomMagicDomain';
  const cards=parents.map(parent=>{
    const items=customBuilderItems(kind,parent).filter(x=>!officialIds.has(x.customContentId)),active=composer&&composer.parentId===parent.id;
    const editItem=active&&composer.itemId?customBuilderItemById(kind,composer.itemId):null;
    // Adding/editing an entry inside a tree needs that tree's body visible,
    // so the composer being open for it counts as "open" even if the user
    // never explicitly expanded the card.
    const isOpen=active||customTreeCardsOpen.has(`${kind}:${parent.id}`);
    return `<section class="custom-tree-card${isOpen?' open':''}">
      <header class="custom-tree-card-head" onclick="toggleCustomTreeCard('${kind}','${parent.id}')"><div><div class="eyebrow">${isSkill?(en?'SKILL TREE':'ARBRE DE COMPÉTENCES'):(en?'MAGIC DOMAIN':'DOMAINE DE MAGIE')}</div><h3>${esc(parent.name)}${parent.officialWarbandId?` <span class="archived-tag official-tag">${en?'OFFICIALIZED':'OFFICIALISÉ'}</span>`:''}</h3></div><div class="custom-tree-card-meta"><span>${items.length}/6</span>${isAdminEditUI()?`<button type="button" class="equipment-action" title="${parent.officialWarbandId?(en?'Already attached — attach elsewhere / update':'Déjà rattaché — rattacher ailleurs / mettre à jour'):(en?'Officialize this whole tree/domain (with its skills/spells) — attach to an official warband':'Officialiser tout cet arbre/domaine (avec ses compétences/sorts) — rattacher à une bande officielle')}" onclick="event.stopPropagation();openOfficializeItemPicker('${isSkill?'skillTree':'magicDomain'}','${parent.id}')">${parent.officialWarbandId?'★':'☆'}</button>`:''}<button type="button" class="equipment-action remove" title="${en?'Delete':'Supprimer'}" onclick="event.stopPropagation();${isSkill?'deleteCustomSkillTree':'deleteCustomMagicDomain'}('${parent.id}')">🗑</button><span class="custom-tree-card-chev">${isOpen?'▾':'▸'}</span></div></header>
      ${isOpen?`<div class="custom-builder-items">${items.map((item,i)=>`<div class="custom-builder-item"><div class="custom-builder-item-main"><span class="custom-builder-index">${i+1}</span><div><strong>${refLink(isSkill?'skills':'spells',item.name,item.name)}</strong><p>${customTextMarkup(item.text||'')}</p></div></div><div class="custom-builder-item-actions"><button type="button" class="equipment-action" title="${en?'Edit':'Modifier'}" onclick="customBuilderOpenEdit('${kind}','${parent.id}','${item.customContentId}')">✎</button><button type="button" class="equipment-action remove" title="${en?'Delete':'Supprimer'}" onclick="customBuilderDelete('${kind}','${item.customContentId}')">🗑</button></div></div>`).join('')||`<div class="custom-builder-empty">${en?'No custom entry in this':'Aucune entrée custom dans cet'} ${label}.</div>`}</div>
      ${active?customBuilderComposerMarkup(kind,parent,editItem):items.length>=6?`<div class="custom-builder-limit">${en?'Maximum reached: 6':'Maximum atteint : 6'} ${itemLabel}${en?'s':'s'}.</div>`:`<button type="button" class="custom-add-slot" onclick="customBuilderOpenNew('${kind}','${parent.id}')"><span>＋</span> ${en?'Add a':'Ajouter un'} ${itemLabel}</button>`}`:''}
    </section>`
  }).join('');
  return `<div class="custom-tree-builder"><div class="custom-builder-intro"><div><div class="eyebrow">FORGE / ${isSkill?'SKILLS':(en?'MAGIC':'MAGIE')}</div><h3>${title}</h3><p>${en?`First create a ${label}. Once created, a`:`Crée d’abord un ${label}. Une fois créé, un emplacement`} <b>＋</b> ${en?`slot lets you add up to 6 ${itemLabel}s directly inside it.`:`permet d’ajouter jusqu’à 6 ${itemLabel}s directement dans celui-ci.`}</p></div><span class="custom-builder-rule">6 MAX.</span></div><div class="custom-tree-create custom-tree-create-v2"><input id="${createId}" placeholder="${en?`New ${label} name…`:`Nom du nouvel ${label}…`}"><input id="${descId}" placeholder="${en?'Description (optional)':'Description (facultatif)'}"><button type="button" class="button secondary" onclick="${createFn}()">＋ ${en?`Create ${label}`:`Créer le ${label}`}</button></div><div class="custom-tree-cards">${cards||`<div class="custom-builder-empty large">${en?`No custom ${label}. Create the first one above.`:`Aucun ${label} custom. Crée le premier ci-dessus.`}</div>`}</div></div>`
}
// Grouped by tree/domain rather than one flat row per skill/spell: a full
// tree or domain (up to 6 entries) is one thing conceptually, so the library
// shows it as a single collapsed folder — "Tree Name · 4/6" — that opens to
// reveal its individual entries, instead of 6 separate rows each claiming
// their own slot in the list (they still work as 6 independent skills/spells
// underneath; only the library's presentation is grouped).
function customBuilderLibrary(kind){
  const en=siteLanguage==='en';
  const isSkill=kind==='skills';
  const field=isSkill?'tree':'domain';
  // V-OFFICIALIZEHIDE (Task #83): see the matching comment in
  // customSkillSpellBuilder — officialized entries (individually, or via a
  // whole officialized tree/domain) drop out of this library too.
  const officialIds=officializedContentIdSets()[kind];
  const parents=customBuilderParentList(kind).filter(p=>!p.officialWarbandId);
  const q=(customContentSearch||'').toLowerCase();
  const matches=w=>!q||((w.name+' '+(w.text||'')+' '+(w[field]||'')).toLowerCase().includes(q));
  const notOfficialized=w=>!officialIds.has(w.customContentId);
  const all=customContentList(kind).filter(notOfficialized);
  const filteredTotal=all.filter(matches).length;
  const rowFn=w=>customContentLibraryRow(kind,w,false);
  const groupMarkup=(name,items,isOrphan)=>{
    if(!items.length)return '';
    return `<details class="custom-collapse custom-content-group${isOrphan?' custom-content-group-orphan':''}"${q?' open':''}><summary><span>${esc(name)}</span><small>${items.length}${isOrphan?'':'/6'}</small></summary><div class="custom-item-list">${items.map(rowFn).join('')}</div></details>`;
  };
  const knownNames=new Set(parents.map(p=>normName(p.name)));
  const body=parents.map(parent=>groupMarkup(parent.name,customBuilderItems(kind,parent).filter(w=>matches(w)&&notOfficialized(w)))).join('')
    +groupMarkup(en?(isSkill?'No tree':'No domain'):(isSkill?'Sans arbre':'Sans domaine'),all.filter(w=>matches(w)&&!knownNames.has(normName(w[field]||''))),true);
  return `<aside class="card custom-library"><div class="custom-library-head"><div><div class="eyebrow">${en?'LIBRARY':'BIBLIOTHÈQUE'}</div><h3>${en?'Custom '+(isSkill?'skills':'spells'):(isSkill?'Compétences':'Sorts')+' custom'}</h3></div><span>${filteredTotal}</span></div><input class="search" value="${esc(customContentSearch)}" placeholder="${en?'Search…':'Rechercher…'}" oninput="customContentSearch=this.value;render('custom')"><div class="custom-item-list">${body||`<div class="empty large"><strong>${en?'No custom entry.':'Aucune entrée custom.'}</strong><span>${en?'Create it directly inside its tree/domain.':'Crée-la directement dans son arbre/domaine.'}</span></div>`}</div></aside>`
}
// Custom's front door — two big choices instead of a flat tab bar that mixed
// standalone content in with warband management. Kept as plain markup (no
// new CSS classes) reusing .card/.button/.custom-page so it fits the rest of
// the app without a separate stylesheet pass.
function customLandingMarkup(){
  const en=siteLanguage==='en';
  return `<div class="custom-page"><div class="page-intro"><div><div class="eyebrow">FORGE / CUSTOM CONTENT</div><h2>${en?'What do you want to create?':'Que veux-tu créer ?'}</h2><p>${en?'Two separate paths — no more back-and-forth between a standalone sheet and the warband editor.':'Deux chemins séparés — plus besoin de faire l’aller-retour entre une fiche isolée et l’éditeur de warband.'}</p></div></div>
  <div class="custom-workspace" style="grid-template-columns:1fr 1fr">
    <section class="card" style="padding:24px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;align-items:center;gap:12px"><div style="width:40px;height:40px;border-radius:9px;background:var(--panel2);border:1px solid var(--chip-border);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--accent)">✦</div><div><strong style="font:800 17px 'Cinzel'">${en?'Generic Custom':'Custom Générique'}</strong><div class="muted" style="font-size:10px">${en?'Standalone content, usable anywhere':'Contenu isolé, réutilisable où tu veux'}</div></div></div>
      <p class="muted" style="font-size:11.5px;line-height:1.6">${en?'For a player’s custom weapon, a skill tree, a magic domain to give to every warband (or just one) — traits, skills, spells, special rules, equipment and fighter profiles.':'Pour une arme custom d’un joueur, un arbre de compétences, un domaine de sort à donner à toutes les warbands (ou à une seule) — traits, compétences, sorts, règles spéciales, équipement et profils de combattants.'}</p>
      <div style="display:flex;flex-wrap:wrap;gap:7px">${(en?['Traits','Skills','Spells','Special Rules','Equipment','Hired Swords']:['Traits','Skills','Sorts','Règles spéciales','Équipement','Hired Swords']).map(t=>`<span class="tag" style="font-size:10px">${t}</span>`).join('')}</div>
      <div style="flex-grow:1"></div>
      <button type="button" class="button primary" onclick="openCustomArea('generic')" style="align-self:flex-start">${en?'Open Generic Custom →':'Ouvrir Custom Générique →'}</button>
    </section>
    <section class="card" style="padding:24px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;align-items:center;gap:12px"><div style="width:40px;height:40px;border-radius:9px;background:var(--panel2);border:1px solid var(--chip-border);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--accent)">⚑</div><div><strong style="font:800 17px 'Cinzel'">${en?'Create a Warband':'Créer une Warband'}</strong><div class="muted" style="font-size:10px">${en?'All of a band’s content, in one place':'Tout le contenu d’une bande, au même endroit'}</div></div></div>
      <p class="muted" style="font-size:11.5px;line-height:1.6">${en?'New warband, or a duplicate of one (as a base, optionally as a Supplement) — one setup for its fighters, traits and its exclusive special rules/equipment.':'Nouvelle warband, ou duplicata d’une existante (comme base, avec l’option d’en faire un Supplément) — un seul setup pour ses combattants, traits et son équipement/règles spéciales exclusifs.'}</p>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-size:10.5px;color:var(--muted2)">＋ ${en?'New warband — start from scratch':'Nouvelle warband — partir de zéro'}</div>
        <div style="font-size:10.5px;color:var(--muted2)">⧉ ${en?'Duplicate — reuse an existing warband as a base, optionally as a Supplement':'Dupliquer — reprendre une warband existante comme base, avec l’option d’en faire un Supplément'}</div>
      </div>
      <div style="flex-grow:1"></div>
      <button type="button" class="button primary" onclick="openCustomArea('warband')" style="align-self:flex-start">${en?'Open Warband setup →':'Ouvrir le setup de warband →'}</button>
    </section>
  </div>
  <p class="muted" style="font-size:10.5px;line-height:1.6;margin-top:8px">${en?'Either way, “Officialize” turns everything concerned (fighters, traits, skills, spells, rules, equipment) into official content at once — nothing to attach piece by piece.':'Dans les deux cas, « Officialiser » transforme tout le contenu concerné (combattants, traits, skills, sorts, règles, équipement) en contenu officiel d’un coup — plus besoin de rattacher chaque pièce une par une.'}</p>
  </div>`;
}
// V-WARBANDFULLPAGE: once a specific warband is being created or edited,
// render it as its own full-width page — same shape as Admin → Gestion's
// warband editor (adminWarbandRulesPanel: page-intro header with the
// warband's own name/description and action buttons, no side library —
// instead of squeezed into the generic two-column Custom workspace
// (editor + library aside) that only makes sense for the picker/list state.
function customWarbandFullPage(){
  const en=siteLanguage==='en';
  const creating=customWarbandCreating;
  const cw=!creating&&customWarbandEditId?customWarbandById(customWarbandEditId):null;
  if(!creating&&!cw){customWarbandEditId=null;customContentSearch='';return null;}
  const backLink=`<a href="#" onclick="customWarbandEditId=null;customWarbandCreating=false;render('custom');return false;" style="font-size:10.5px;color:var(--muted2);display:inline-block;margin-bottom:10px">← ${en?'My warbands':'Mes warbands'}</a>`;
  const title=creating?(en?'New warband':'Nouvelle warband'):esc(cw.name);
  const desc=creating?(en?'Give it a name to get started — add fighters, traits, and exclusive equipment/special rules once it’s saved.':'Donne-lui un nom pour commencer — ajoute combattants, traits, et équipement/règles spéciales exclusifs une fois sauvegardée.'):(en?'One page for this warband’s fighters, traits, and its exclusive equipment/special rules.':'Une seule page pour les combattants, traits, et l’équipement/règles spéciales exclusifs de cette warband.');
  const actions=(!creating&&cw&&!cw.officialId)?`<button type="button" class="button primary" onclick="officializeCustomWarband('${esc(cw.id)}')">⬆ ${en?'Officialize the whole warband':'Officialiser toute la warband'}</button><button type="button" class="button secondary" onclick="deleteCustomWarband('${esc(cw.id)}')">🗑 ${en?'Delete':'Supprimer'}</button>`:'';
  const body=creating?customWarbandCreateForm():customWarbandEditor(cw);
  return `<div class="custom-page">${backLink}<div class="page-intro"><div><div class="eyebrow">CUSTOM / WARBAND</div><h2>${title}</h2><p>${desc}</p></div>${actions}</div>${body}</div>`;
}
function custom(){
  const en=siteLanguage==='en';
  if(!customArea){$('#content').innerHTML=customLandingMarkup();return}
  if(customContentTab==='warband'&&(customWarbandCreating||customWarbandEditId)){
    const page=customWarbandFullPage();
    if(page){$('#content').innerHTML=page;return}
  }
  const inWarbandArea=customArea==='warband';
  const tabs=inWarbandArea?[]:(en?[['traits','◆ Traits'],['skills','★ Skills'],['spells','✦ Spells'],['special','✚ Special Rules'],['fighters','⚔ Fighters'],['hiredswords','🗡 Hired Swords'],['creatures','🐾 Animals & Mounts'],['equipment','◇ Equipment']]:[['traits','◆ Traits'],['skills','★ Compétences'],['spells','✦ Sorts'],['special','✚ Règles spéciales'],['fighters','⚔ Combattants'],['hiredswords','🗡 Hired Swords'],['creatures','🐾 Animaux & Montures'],['equipment','◇ Équipements']]);
  if(!inWarbandArea&&isAdminSession())tabs.splice(4,0,['mutations','🧬 Mutations']);
  if(!inWarbandArea&&isAdminSession())tabs.push(['artifacts',en?'◈ Artifacts':'◈ Artefacts']);
  if((customContentTab==='mutations'||customContentTab==='artifacts')&&!isAdminSession())customContentTab='traits';
  let title,createLabel,action,editor,library;
  if(customContentTab==='artifacts'){
    title=en?'Artifacts':'Artefacts';createLabel='';action='';editor=customArtifactsMarkup();library='';
  }else if(customContentTab==='mutations'){
    title='Mutations';createLabel=en?'New mutation':'Nouvelle mutation';action='newMutation()';editor=mutationEditorMarkup();library=mutationLibraryAside();
  }else if(customContentTab==='warband'){
    const list=customWarbandList(); title=en?'Create a Warband':'Créer une Warband'; createLabel=en?'New Warband':'Nouvelle Warband'; action='newCustomWarband()'; editor=customWarbandEditorPanel();
    const q=(customContentSearch||'').trim().toLowerCase(); const matches=w=>!q||(w.name+' '+(w.description||'')).toLowerCase().includes(q);
    // A warband that's been officialized drops out of Custom entirely — it's
    // published, live for every player, and still fully editable from Admin
    // Gestion (its own direct-edit tool), so keeping a copy here too was
    // just clutter. (Its custom fighters/equipment still exist underneath —
    // deleting them isn't safe, they may be shared/relied on — but the
    // warband entry itself is no longer listed.)
    const active=list.filter(w=>!w.officialId&&matches(w));
    library=`<aside class="card custom-library"><div class="custom-library-head"><div><div class="eyebrow">${en?'LIBRARY':'BIBLIOTHÈQUE'}</div><h3>${en?'Custom warbands':'Warbands custom'}</h3></div><span>${active.length}</span></div><input class="search" value="${esc(customContentSearch)}" placeholder="${en?'Search…':'Rechercher…'}" oninput="customContentSearch=this.value;render('custom')"><div class="custom-item-list">${active.length?active.map(customWarbandSummaryRow).join(''):`<div class="empty large"><strong>${en?'No custom Warband.':'Aucune Warband custom.'}</strong><span>${en?'Create the first one with the button above.':'Crée la première avec le bouton ci-dessus.'}</span></div>`}</div></aside>`;
  }else if(customContentTab==='skills'||customContentTab==='spells'){
    const isSkill=customContentTab==='skills'; title=en?(isSkill?'Custom skills':'Custom spells'):(isSkill?'Compétences personnalisées':'Sorts personnalisés'); createLabel=''; action=''; editor=customSkillSpellBuilder(customContentTab); library=customBuilderLibrary(customContentTab);
  }else if(customContentTab==='creatures'){
    // V-CREATURES: a lightweight profile builder for Animals and Mounts —
    // deliberately separate from the full Fighter builder above (no max
    // mode, no skill tree/equipment/magic access: just a name, its stats on
    // the same P/P_FULL column set as a fighter's own CHARACTERISTICS table
    // so the two line up visually, a free-text Sv (no armour system to
    // derive it from here), and special rules). Animal = a complete
    // standalone profile (cost included, meant to be recruited on its own,
    // e.g. a Wolf). Mount = no cost here — it's meant to attach onto an
    // existing fighter's own card (see the Mounted Combat mockup); wiring
    // that attachment to a purchasable item is a separate follow-up.
    const list=customCreatureList();
    const q=(customContentSearch||'').trim().toLowerCase();
    const filtered=list.filter(w=>!q||(w.name+' '+(w.kind||'')).toLowerCase().includes(q));
    const active=filtered.filter(w=>!w.archived);
    const archived=filtered.filter(w=>w.archived);
    const editingC=customCreatureEditId?customCreatureById(customCreatureEditId):null;
    editor=customCreatureForm(editingC);
    title=en?'Animals & Mounts':'Animaux & Montures';
    createLabel=en?'New animal/mount':'Nouvel animal/monture';
    action='newCustomCreature()';
    library=`<aside class="card custom-library"><div class="custom-library-head"><div><div class="eyebrow">${en?'LIBRARY':'BIBLIOTHÈQUE'}</div><h3>${esc(title)}</h3></div><span>${filtered.length}</span></div><input class="search" value="${esc(customContentSearch)}" placeholder="${en?'Search…':'Rechercher…'}" oninput="customContentSearch=this.value;render('custom')"><div class="custom-item-list">${active.length?active.map(customCreatureRow).join(''):(archived.length?'':`<div class="empty large"><strong>${en?'No custom entry.':'Aucune entrée custom.'}</strong><span>${en?'Create the first one with the button above.':'Crée la première avec le bouton ci-dessus.'}</span></div>`)}</div>${archived.length?`<details class="custom-collapse custom-item-archive"${q?' open':''}><summary><span>${en?'ARCHIVED':'ARCHIVÉES'}</span><small>${archived.length}</small></summary><div class="custom-item-list">${archived.map(customCreatureRow).join('')}</div></details>`:''}</aside>`;
  }else{
    const rawList=customContentTab==='fighters'?customFighterList().filter(w=>!!w.hiredSword===!!customFighterHSMode):customContentTab==='equipment'?customEquipmentList():customContentList(customContentTab);
    // V-WARBANDEXCLUSIVE: equipment/special rules created from inside a
    // warband's own setup are exclusive to it — see saveCustomEquipment /
    // saveCustomContent — so Custom Générique's own library no longer lists
    // them at all; they only ever show up (and get edited) from inside that
    // warband's Équipement/Règles spéciales section.
    const list=(customContentTab==='equipment'||customContentTab==='special')?rawList.filter(w=>!w.exclusiveWarbandId):rawList;
    const q=(customContentSearch||'').toLowerCase();
    const filtered=list.filter(w=>{
      if(!q)return true;
      const haystack=customContentTab==='fighters'?(w.name+' '+(w.type||'')+' '+(w.race||'')):customContentTab==='equipment'?(w.name+' '+(w.category||'')+' '+(w.subcategory||'')+' '+(w.rulesText||'')):(w.name+' '+(w.text||'')+' '+(w.tree||'')+' '+(w.domain||''));
      return haystack.toLowerCase().includes(q);
    });
    // Archived entries (manually tucked away to free up visible space) stay
    // searchable but sit collapsed under their own section — auto-expanded
    // whenever a search matches inside it.
    const officialFighterIds=customContentTab==='fighters'?officializedFighterIdSet():null;
    const officialEqIds=customContentTab==='equipment'?officializedEquipmentIdSet():null;
    const officialContentSets=(customContentTab==='traits'||customContentTab==='special')?officializedContentIdSets():null;
    const isOfficialized=w=>{
      if(officialFighterIds)return officialFighterIds.has(w.customFighterId);
      if(officialEqIds)return officialEqIds.has(w.customEquipmentId);
      if(officialContentSets)return officialContentSets[customContentTab].has(w.customContentId);
      return false;
    };
    // V-OFFICIALIZEREACH: entries already bundled into a published/
    // officialized warband used to drop out of this list ENTIRELY — they're
    // published, live for every player, still editable from Admin Gestion,
    // so a copy here was "just clutter". But that also meant the ★ button
    // that RE-publishes an item (picking up a stats edit, or a corrected
    // push after a bug fix — exactly what happened with a dual-profile
    // weapon losing its second profile and another item not reaching other
    // accounts at all) lived only on this now-hidden row, with no other way
    // to trigger it short of first un-officializing. Kept visible in their
    // own collapsed section instead, same shape as Archived, so ★ stays
    // reachable for as long as the item exists.
    const shown=filtered.filter(w=>!isOfficialized(w));
    const official=filtered.filter(isOfficialized);
    const active=shown.filter(w=>!w.archived);
    const archived=shown.filter(w=>w.archived);
    const rowFn=w=>customContentTab==='fighters'?customFighterRow(w,false):customContentTab==='equipment'?customEquipmentRow(w):customContentLibraryRow(customContentTab,w);
    if(customContentTab==='fighters'){let editingF=customFighterEditId?customFighterById(customFighterEditId):null;if(editingF&&isHiredSword(editingF))editingF=hiredSwordMergeTwin(editingF);editor=customFighterForm(editingF)} else if(customContentTab==='equipment'){const editingEq=customEquipmentEditId?state.customEquipment.find(x=>x.customEquipmentId===customEquipmentEditId):null;editor=customEquipmentForm(editingEq)} else {const editing=customContentEditId?customContentById(customContentTab,customContentEditId):null;editor=customContentForm(customContentTab,editing)}
    title=en?(customContentTab==='fighters'?(customFighterHSMode?'Hired Swords':'Fighter profiles'):customContentTab==='equipment'?'Custom equipment':'Custom '+customContentTypeLabel(customContentTab).toLowerCase()+'s'):(customContentTab==='fighters'?(customFighterHSMode?'Hired Swords':'Profils de combattants'):customContentTab==='equipment'?'Équipements personnalisés':customContentTypeLabel(customContentTab)+'s personnalisés');
    createLabel=en?(customContentTab==='fighters'?(customFighterHSMode?'New Hired Sword':'New fighter'):customContentTab==='equipment'?'New equipment':'New '+customContentTypeLabel(customContentTab).toLowerCase()):(customContentTab==='fighters'?(customFighterHSMode?'Nouveau Hired Sword':'Nouveau combattant'):customContentTab==='equipment'?'Nouvel équipement':'Nouvelle '+customContentTypeLabel(customContentTab).toLowerCase());
    action=customContentTab==='fighters'?'newCustomFighter()':customContentTab==='equipment'?'newCustomEquipment()':`newCustomContent('${customContentTab}')`;
    library=`<aside class="card custom-library"><div class="custom-library-head"><div><div class="eyebrow">${en?'LIBRARY':'BIBLIOTHÈQUE'}</div><h3>${esc(title)}</h3></div><span>${shown.length}</span></div><input class="search" value="${esc(customContentSearch)}" placeholder="${en?'Search…':'Rechercher…'}" oninput="customContentSearch=this.value;render('custom')"><div class="custom-item-list">${active.length?active.map(rowFn).join(''):(archived.length?'':`<div class="empty large"><strong>${en?'No custom entry.':'Aucune entrée custom.'}</strong><span>${en?'Create the first one with the button above.':'Crée la première avec le bouton ci-dessus.'}</span></div>`)}</div>${archived.length?`<details class="custom-collapse custom-item-archive"${q?' open':''}><summary><span>${en?'ARCHIVED':'ARCHIVÉES'}</span><small>${archived.length}</small></summary><div class="custom-item-list">${archived.map(rowFn).join('')}</div></details>`:''}${official.length?`<details class="custom-collapse custom-item-archive"${q?' open':''}><summary><span>${en?'OFFICIALIZED':'OFFICIALISÉES'}</span><small>${official.length}</small></summary><p class="muted" style="font-size:10.5px;margin:0 0 8px">${en?'Already published — live for every player. Click ★ again to re-push after editing, or to pick up a fix.':'Déjà publiées — visibles par tous les joueurs. Reclique sur ★ pour republier après une modification, ou pour appliquer un correctif.'}</p><div class="custom-item-list">${official.map(rowFn).join('')}</div></details>`:''}</aside>`;
  }
  const orphanFighterCount=customContentTab==='fighters'?orphanCustomFighterIds().length:0;
  const introButton=(customContentTab==='skills'||customContentTab==='spells')?'':(action?`<button class="button primary" onclick="${action}">＋ ${esc(createLabel)}</button>`:'')+(customContentTab==='fighters'&&customFighterHSMode?`<button class="button secondary" type="button" onclick="importBookHiredSwords()">📖 ${en?'Import the book’s Hired Swords':'Importer les Hired Swords du livre'}</button>`:'')+(customContentTab==='warband'?`<button class="button secondary" type="button" onclick="openDuplicateWarbandPicker()">⧉ ${en?'Duplicate an existing warband':'Dupliquer une warband existante'}</button><button class="button secondary" type="button" onclick="openImportWarbandPicker()">⇪ ${en?'Import a warband':'Importer une warband'}</button>`:'')+(orphanFighterCount?`<button class="button secondary" type="button" onclick="cleanupOrphanCustomFighters()">🧹 ${en?`Clean up ${orphanFighterCount} orphan profile${orphanFighterCount>1?'s':''}`:`Nettoyer ${orphanFighterCount} profil${orphanFighterCount>1?'s':''} orphelin${orphanFighterCount>1?'s':''}`}</button>`:'')+(customContentTab==='mutations'?'':customCleanupButtonsMarkup());
  const description=customContentTab==='artifacts'?(en?'Artifacts belong to a campaign. Each one is an item like the others: a weapon (its profile) or equipment, with its description and its story. Players find them in the post-battle and see them in References › Artifacts.':'Les artefacts appartiennent à une campagne. Chacun est un objet comme les autres : une arme (son profil) ou un équipement, avec sa description et son histoire. Les joueurs les trouvent dans l’après-bataille et les voient dans Références › Artefacts.'):customContentTab==='mutations'?(en?'One list for the whole site. A profile chooses whether it can mutate (its editor, MUTATIONS block); players buy them at recruitment or through a skill listed below.':'Une seule liste pour tout le site. Un profil choisit s’il peut muter (son éditeur, bloc MUTATIONS) ; les joueurs les achètent au recrutement ou par une compétence listée ci-dessous.'):customContentTab==='warband'?(en?'New warband, or a duplicate of an existing one — one place for its fighters, traits, and its exclusive equipment/special rules. Once picked or created, click Edit to set everything up on a single page.':'Nouvelle warband ou duplicata d’une existante — un seul endroit pour ses combattants, traits, et son équipement/règles spéciales exclusifs. Une fois choisie ou créée, clique Modifier pour tout configurer sur une seule page.'):(customContentTab==='skills'||customContentTab==='spells')?(customContentTab==='skills'?(en?'Create a skill tree before adding its skills. Each tree can hold up to 6 custom skills.':'Crée un arbre de compétences avant d’ajouter ses compétences. Chaque arbre peut contenir jusqu’à 6 compétences custom.'):(en?'Create a magic domain before adding its spells.':'Crée un domaine de magie avant d’ajouter ses sorts.')):customContentTab==='creatures'?(en?'A simple profile — stats and special rules only. An Animal is a complete, recruitable profile; a Mount still costs GC and counts toward the warband’s value, but attaches onto an existing fighter instead of its own roster slot — it shows up in the Equipment Market/Band List under “Mounts”.':'Un profil simple — juste les stats et les règles spéciales. Un Animal est un profil complet et recrutable ; une Monture coûte toujours des PO et compte dans la valeur de la bande, mais s’intègre à un combattant existant au lieu d’occuper son propre emplacement — elle apparaît dans le Marché/Liste de bande sous « Montures ».'):(en?'Create custom content without modifying the M17 catalog. Entries are linked to the Reference.':'Crée du contenu personnalisé sans modifier le catalogue M17. Les entrées sont reliées au Référentiel.');
  // V-CUSTOMTABCOUNTS: these used to show a count next to each tab
  // (customFighterList().length etc.) — always the RAW total, counting
  // officialized entries that are already hidden everywhere else in this
  // page (see the isOfficialized filtering below and V-OFFICIALIZEHIDE),
  // so the number never matched what was actually visible in the tab.
  // Dropped entirely per explicit request rather than fixed to filter
  // correctly — the count wasn't wanted either way.
  const backLink=`<a href="#" onclick="backToCustomLanding();return false;" style="font-size:10.5px;color:var(--muted2);display:inline-block;margin-bottom:10px">← Custom</a>`;
  // V-WARBANDSKILLSNAV: openWarbandSkillsBuilder keeps customWarbandCreateContextId
  // set across several saves (a tree/domain can hold multiple items), so this
  // banner is the person's own way back — nothing auto-returns them here.
  const warbandReturnCw=(customContentTab==='skills'||customContentTab==='spells')&&customWarbandCreateContextId?customWarbandById(customWarbandCreateContextId):null;
  const warbandReturnBanner=warbandReturnCw?`<div class="official-draft-notice"><span class="official-draft-tag">WARBAND</span><p>${en?`You came from <b>${esc(warbandReturnCw.name)}</b>.`:`Tu es venu·e depuis <b>${esc(warbandReturnCw.name)}</b>.`} <a href="#" onclick="returnToWarbandEditor('skills');return false;">← ${en?'Back to the warband':'Retour à la warband'}</a></p></div>`:'';
  const tabBar=tabs.length?`<div class="custom-top-tabs">${tabs.map(([id,label])=>`<button type="button" class="custom-top-tab ${(id==='hiredswords'?(customContentTab==='fighters'&&customFighterHSMode):(customContentTab===id&&!(id==='fighters'&&customFighterHSMode)))?'active':''}" onclick="setCustomTab('${id}')">${label}</button>`).join('')}</div>`:'';
  $('#content').innerHTML=`<div class="custom-page">${backLink}${warbandReturnBanner}<div class="page-intro"><div><div class="eyebrow">FORGE / CUSTOM CONTENT</div><h2>${esc(title)}</h2><p>${description}</p></div>${introButton}</div>${tabBar}<div class="custom-workspace"><section class="card custom-editor">${editor}</section>${library}</div></div>`;
}
function customWarbandEditorPanel(){
  const en=siteLanguage==='en';
  if(customWarbandCreating)return customWarbandCreateForm();
  if(customWarbandEditId){const cw=customWarbandById(customWarbandEditId);if(cw)return customWarbandEditor(cw);customWarbandEditId=null;}
  return `<div class="custom-warband-empty"><div class="eyebrow">${en?'CUSTOM WARBAND':'WARBAND CUSTOM'}</div><h3>${en?'Forge your own Warband':'Forge ta propre Warband'}</h3><p>${en?'First create its name and description. Once saved, use <b>Edit</b> in the library to link fighters, equipment, special rules and traits.':'Crée d’abord son nom et sa description. Une fois sauvegardée, utilise <b>Modifier</b> dans la bibliothèque pour associer les combattants, l’équipement, les règles spéciales et les traits.'}</p><button type="button" class="button primary" onclick="newCustomWarband()">＋ ${en?'New Warband':'Nouvelle Warband'}</button></div>`;
}
/* ================= DUPLICATE AN EXISTING WARBAND (V149) ===================
   "Un duplicata du gang de base que je peux modifier pour faire une
   nouvelle warband": picks any book faction or published official warband
   and copies every one of its fighters into brand-new, independent custom
   fighter profiles (not live references) attached to a brand-new custom
   warband — so every copied fighter can be freely edited, removed, or
   added to, with zero link back to the source. Officializing the result
   afterward (same button as any other custom warband) is what turns it
   into a real, generally selectable warband. */
function openDuplicateWarbandPicker(){
  const en=siteLanguage==='en';
  const options=D.factions.filter(f=>!f.packId&&!isContentPoolFaction(f)).map(f=>`<option value="${esc(f.id)}">${esc(f.displayName)}${f.__official?' · '+(en?'official':'officielle'):''}</option>`).join('');
  openModal(`<div class="admin-live-editor"><div class="eyebrow">${en?'DUPLICATE':'DUPLIQUER'}</div><h2>${en?'Start a new warband from an existing one':'Démarrer une nouvelle warband à partir d’une existante'}</h2><p class="muted">${en?'Copies every fighter as an independent custom profile you can freely edit, remove or add to — nothing stays linked to the source. Once you’re happy with it, officialize it like any other custom warband to publish it.':'Copie chaque combattant en profil custom indépendant, librement modifiable, supprimable ou complétable — rien ne reste lié à la source. Une fois satisfait·e, officialise-la comme n’importe quelle autre warband custom pour la publier.'}</p><label class="custom-field wide"><span>${en?'Source warband':'Warband source'}</span><select id="dupWarbandSource">${options}</select></label><label class="custom-field wide"><span>${en?'New name':'Nouveau nom'}</span><input id="dupWarbandName" placeholder="${en?'e.g. My warband — supplement':'Ex. Ma bande — supplément'}"></label><label class="custom-check"><input type="checkbox" id="dupAsSupplement"> <span><b>${en?'Make it a Supplement of the source warband':'En faire un supplément de la warband d’origine'}</b><small>${en?'Replaces the source’s rules when a player picks it instead of showing its own tile in Create Warband — set at publish time; leave unchecked for an independent warband.':'Remplace les règles de la bande source quand un joueur la choisit, au lieu d’avoir sa propre case dans Créer une bande — ce choix est appliqué au moment de publier ; laisse décoché pour une bande indépendante.'}</small></span></label><div class="account-actions"><button class="button primary" type="button" onclick="confirmDuplicateWarband()">${en?'Duplicate':'Dupliquer'}</button><button class="button secondary" type="button" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></div>`);
}
// Resolves which of `f`'s equipment items a source warrior `sw` should keep
// access to once copied out as an independent custom fighter — same
// group-tag logic as warriorBandAllowed, but against the warband being
// duplicated FROM rather than whatever roster happens to be open (there
// usually isn't one, from the Custom tab). No group info at all (most
// official-warband fighters) defaults to the whole faction list, same
// spirit as the "ALL" shorthand — better to over-grant than to hand back a
// fighter with no equipment options, which is trivial to trim afterward.
function duplicateWarriorEquipmentAccess(sw,f){
  const names=(f.equipment||[]).filter(e=>!isCovering(e)).map(e=>typeof e==='string'?e:e?.name).filter(Boolean);
  const groups=sw?.equipmentAccessGroups;
  if(groups==null||equipmentGroupsMeansAll(groups))return names.slice();
  if(!Array.isArray(groups))return names.slice();
  const out=[];
  names.forEach(name=>{
    if(groups.includes('Natural Weapons')&&name==='Natural Weapons'){out.push(name);return}
    const key=Object.keys(f.equipmentItemGroups||{}).find(k=>normName(k)===normName(name));
    const memberships=key?(f.equipmentItemGroups[key]||[]):[];
    if(groups.some(g=>memberships.includes(g)))out.push(name);
  });
  return out;
}
// Copies a source warband's OWN band-wide content — traits, special rules,
// exclusive skill trees/skills, exclusive magic domains/spells — into new,
// independent custom entries attached to the duplicate, so "dupliquer" is a
// full copy (not just the fighter list). Book factions have none of this
// (their rules are the shared rulebook, not band-specific), so every `||[]`
// here is simply empty and this is a no-op for them. Renames a tree/domain
// that collides with something already existing globally (most often: the
// same source duplicated more than once) rather than merging into it, so
// each duplicate stays independently editable. Returns the old→new name
// maps so the caller can keep each copied fighter's skillAccess/magicAccess
// pointing at the right (possibly renamed) tree/domain.
function duplicateWarbandBandContent(f,cw){
  (f.traits||[]).forEach(t=>{
    if(!t?.name)return;
    const item={customContentId:crypto.randomUUID(),name:t.name,text:t.text||''};
    customContentList('traits').push(item);
    cw.traitIds.push(item.customContentId);
  });
  (f.specialRules||[]).forEach(r=>{
    if(!r?.name)return;
    const item={customContentId:crypto.randomUUID(),name:r.name,text:r.text||''};
    customContentList('special').push(item);
    cw.specialRuleIds.push(item.customContentId);
  });
  // V-DUPBANDRULENAMES (Task #79): f.bandRuleNames is a SEPARATE mechanism
  // from f.specialRules above — it's a list of bare NAME "keyword" tags an
  // admin toggled on for this warband via Gestion (adminWarbandRulesPanel),
  // each one pointing at an EXISTING book Référentiel special-rule entry
  // (e.g. "Frenzy", "Undead") rather than carrying its own custom text. A
  // custom warband (cw) has no equivalent field to hold a bare reference —
  // only specialRuleIds, which point at full custom content items — so
  // duplicating used to silently drop every one of these keyword tags.
  // Fixed by baking each one into its own independent custom special-rule
  // item (name + the book entry's own text, copied verbatim), same as any
  // other band-wide content copied here — skips a name already covered by
  // f.specialRules above so it isn't duplicated.
  const specialNamesSoFar=new Set((f.specialRules||[]).map(r=>normName(r?.name||'')));
  (f.bandRuleNames||[]).forEach(name=>{
    const n=normName(name);
    if(!name||specialNamesSoFar.has(n))return;
    specialNamesSoFar.add(n);
    const ref=referenceFind('special',name);
    const item={customContentId:crypto.randomUUID(),name:ref?.name||name,text:ref?.text||''};
    customContentList('special').push(item);
    cw.specialRuleIds.push(item.customContentId);
  });
  // V-OFFICIALSPELLDOMAINDRIFT (Task #54): a warband published before the
  // matching fix in bundleCustomContentForOfficialize/mergeOfficialWarbandPackage
  // can still carry a skill/spell whose own tree/domain field differs from
  // the tree/domain's canonical name by casing/whitespace. Treating every
  // spelling as its own separate tree/domain here would create a redundant
  // near-duplicate for each variant AND still leave the skill/spell
  // unattached wherever its exact spelling wasn't one already collected
  // from f.skillTrees/f.exclusiveSkillSets. Instead: collect every variant
  // encountered, create exactly ONE new tree/domain per normalized name,
  // and map every variant (plus, as a last-resort fallback, a normalized
  // lookup) onto that same copy — remapKeys() below still looks fighters'
  // skillAccess/magicAccess up by their own exact original key, which this
  // keeps satisfying since every variant is mapped, not just one.
  const treeNameMap=new Map(),treeCanonical=new Map();
  [...(f.skillTrees||[]).map(t=>t.name),...Object.keys(f.exclusiveSkillSets||{})].filter(Boolean).forEach(name=>{
    const nk=normName(name);
    if(!treeCanonical.has(nk)){
      const finalName=customTreeNameExists(name)?name+' (copie)':name;
      customSkillTreeList().push({id:crypto.randomUUID(),name:finalName,description:''});
      treeCanonical.set(nk,finalName);
    }
    treeNameMap.set(name,treeCanonical.get(nk));
  });
  (f.skills||[]).forEach(s=>{
    if(!s?.name||!s?.tree)return;
    customContentList('skills').push({customContentId:crypto.randomUUID(),name:s.name,text:s.text||'',tree:treeNameMap.get(s.tree)||treeCanonical.get(normName(s.tree))||s.tree});
  });
  const domainNameMap=new Map(),domainCanonical=new Map();
  [...(f.magicDomains||[]).map(d=>d.name),...Object.keys(f.exclusiveMagicDomains||{})].filter(Boolean).forEach(name=>{
    const nk=normName(name);
    if(!domainCanonical.has(nk)){
      const finalName=customDomainNameExists(name)?name+' (copie)':name;
      customMagicDomainList().push({id:crypto.randomUUID(),name:finalName,description:''});
      domainCanonical.set(nk,finalName);
    }
    domainNameMap.set(name,domainCanonical.get(nk));
  });
  (f.spells||[]).forEach(s=>{
    if(!s?.name||!s?.domain)return;
    customContentList('spells').push({customContentId:crypto.randomUUID(),name:s.name,text:s.text||'',domain:domainNameMap.get(s.domain)||domainCanonical.get(normName(s.domain))||s.domain});
  });
  return {treeNameMap,domainNameMap};
}
function confirmDuplicateWarband(){
  const en=siteLanguage==='en';
  const fid=$('#dupWarbandSource')?.value;
  const f=D.factions.find(x=>x.id===fid&&!x.packId);
  if(!f){toast(en?'Pick a source warband':'Choisis une warband source');return}
  const name=($('#dupWarbandName')?.value||'').trim()||(en?`${f.displayName} — copy`:`${f.displayName} — copie`);
  // V-WARBANDEXCLUSIVE: "make it a Supplement" checkbox on the duplicate
  // modal just pre-records the intent (supplementOfFactionId) — the actual
  // Supplement relationship is only ever created server-side at publish
  // time (adminOfficializeWarband's supplementOf param), see
  // officializeCustomWarband below, which reads this back to preselect it.
  const asSupplement=!!$('#dupAsSupplement')?.checked;
  const cw={id:crypto.randomUUID(),name,description:f.description||'',choices:f.choices&&typeof f.choices==='object'?JSON.parse(JSON.stringify(f.choices)):null,fighterIds:[],equipmentIds:[],fighterRefs:[],equipmentRefs:[],specialRuleIds:[],traitIds:[],supplementOfFactionId:asSupplement?f.id:null};
  customWarbandList().push(cw);
  const {treeNameMap,domainNameMap}=duplicateWarbandBandContent(f,cw);
  const remapKeys=(obj,map)=>{const out={};Object.entries(obj||{}).forEach(([k,v])=>{out[map.get(k)||k]=v});return out};
  (f.warriors||[]).forEach(sw=>{
    const item={
      customFighterId:crypto.randomUUID(),
      name:sw.name,type:sw.type||'Henchman',factionId:'',customWarbandId:cw.id,
      cost:Number(sw.cost||0),
      max:sw.max===undefined?null:sw.max,
      maxMode:sw.maxMode||'auto',
      manualMaxProfile:Array.isArray(sw.manualMaxProfile)?sw.manualMaxProfile.slice():null,
      profile:Array.isArray(sw.profile)?sw.profile.slice():P.map(()=>1),
      race:sw.race||'Human',
      ruleNames:Array.isArray(sw.ruleNames)?sw.ruleNames.slice():[],
      rules:sw.rules||(Array.isArray(sw.ruleNames)?sw.ruleNames.join(', '):''),
      skillAccess:remapKeys(sw.skillAccess,treeNameMap),
      magicAccess:remapKeys(sw.magicAccess,domainNameMap),
      defaultSkills:Array.isArray(sw.defaultSkills)?sw.defaultSkills.slice():[],
      defaultEquipment:Array.isArray(sw.defaultEquipment)?sw.defaultEquipment.slice():[],
      equipmentAccess:duplicateWarriorEquipmentAccess(sw,f),
      description:sw.description||''
    };
    customFighterList().push(item);
    cw.fighterIds.push(item.customFighterId);
    cw.fighterRefs.push(`custom:${item.customFighterId}`);
  });
  save(true);
  closeModal();
  customArea='warband';customContentTab='warband';customWarbandEditId=cw.id;customWarbandCreating=false;customWarbandSection='fighters';
  render('custom');
  const extra=cw.traitIds.length+cw.specialRuleIds.length+treeNameMap.size+domainNameMap.size;
  toast(en?`Duplicated — ${(f.warriors||[]).length} fighters${extra?` + ${extra} band rules/skill trees/magic domains`:''} copied, ready to edit`:`Dupliquée — ${(f.warriors||[]).length} combattants${extra?` + ${extra} règles/arbres/domaines de bande`:''} copiés, prêts à modifier`);
}
function newCustomWarband(){customWarbandEditId=null;customWarbandCreating=true;customWarbandSection='fighters';render('custom');setTimeout(()=>$('#cwName')?.focus(),0)}
function editCustomWarband(id){if(!customWarbandById(id))return;customWarbandEditId=id;customWarbandCreating=false;customWarbandSection='fighters';render('custom')}
function deleteCustomWarband(id){const en=siteLanguage==='en';const cw=customWarbandById(id);if(!cw)return;openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'DELETE':'SUPPRESSION'}</div><h2>${en?'Delete “':'Supprimer « '}${esc(cw.name)}${en?'”?':' » ?'}</h2><button type="button" class="big-delete" onclick="confirmDeleteCustomWarband('${id}')">${en?'DELETE':'SUPPRIMER'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`)}
// V-ORPHANFIGHTERS: retroactive cleanup for fighters already left dangling by
// a custom warband deleted BEFORE the fix in confirmDeleteCustomWarband below
// existed — a fighter whose customWarbandId points at a warband that no
// longer exists in customWarbandList(). customFighterRow can't resolve that
// id to a name, so its origin label falls through to '—': exactly the
// unlabeled "ghost" profiles cluttering Custom > Combattants. Never touches
// a fighter that's been individually officialized (officialWarbandId set) —
// that's still the live editable source for published content regardless of
// what happened to the custom warband record.
function orphanCustomFighterIds(){
  const liveIds=new Set(customWarbandList().map(cw=>cw.id));
  return customFighterList().filter(w=>w.customWarbandId&&!liveIds.has(w.customWarbandId)&&!w.officialWarbandId).map(w=>w.customFighterId);
}
function cleanupOrphanCustomFighters(){
  const en=siteLanguage==='en';
  const ids=orphanCustomFighterIds();
  if(!ids.length){toast(en?'No orphan profile to clean up':'Aucun profil orphelin à nettoyer');return}
  const names=ids.map(id=>customFighterById(id)?.name||id).slice(0,12);
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'CLEANUP':'NETTOYAGE'}</div><h2>${en?`Delete ${ids.length} orphan profile${ids.length>1?'s':''}?`:`Supprimer ${ids.length} profil${ids.length>1?'s':''} orphelin${ids.length>1?'s':''} ?`}</h2><p>${en?'These custom fighters belonged to a warband that was already deleted and no longer serve any purpose.':'Ces combattants custom appartenaient à une warband déjà supprimée et ne servent plus à rien.'}</p><div class="muted" style="text-align:left;margin:10px 0;max-height:160px;overflow:auto">${names.map(n=>esc(n)).join('<br>')}${ids.length>names.length?`<br>… +${ids.length-names.length}`:''}</div><button type="button" class="big-delete" onclick="confirmCleanupOrphanCustomFighters()">${en?'DELETE':'SUPPRIMER'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`);
}
function confirmCleanupOrphanCustomFighters(){
  const en=siteLanguage==='en';
  const ids=orphanCustomFighterIds();
  ids.forEach(id=>markDeleted('customFighters',id));
  state.customFighters=customFighterList().filter(w=>!ids.includes(w.customFighterId));
  save(true);closeModal();render('custom');
  toast(en?`${ids.length} orphan profile${ids.length>1?'s':''} deleted`:`${ids.length} profil${ids.length>1?'s':''} orphelin${ids.length>1?'s':''} supprimé${ids.length>1?'s':''}`);
}
// V-CUSTOMCLEANUP: two library-wide cleanups next to the orphan one.
// Both only ever touch this account's LOCAL Custom copies (state.custom*):
// published/official content lives in its own server-side definition and is
// only written by an explicit Officialize / Publish / Admin save, never by
// these, so what is online stays exactly as it is.
const CUSTOM_CLEANUP_KINDS=[
  {tab:'fighters',stateKey:'customFighters',idKey:'customFighterId',list:()=>customFighterList()},
  {tab:'equipment',stateKey:'customEquipment',idKey:'customEquipmentId',list:()=>customEquipmentList()},
  {tab:'creatures',stateKey:'customCreatures',idKey:'customCreatureId',list:()=>customCreatureList()},
  {tab:'traits',stateKey:'customTraits',idKey:'customContentId',list:()=>customContentList('traits')},
  {tab:'skills',stateKey:'customSkills',idKey:'customContentId',list:()=>customContentList('skills')},
  {tab:'spells',stateKey:'customSpells',idKey:'customContentId',list:()=>customContentList('spells')},
  {tab:'special',stateKey:'customSpecialRules',idKey:'customContentId',list:()=>customContentList('special')}
];
const CUSTOM_CLEANUP_VOLATILE=new Set(['customFighterId','customEquipmentId','customCreatureId','customContentId','updatedAt','archived','officialWarbandId']);
function customCleanupSignature(x){const o={};Object.keys(x||{}).sort().forEach(k=>{if(!CUSTOM_CLEANUP_VOLATILE.has(k))o[k]=x[k]});return JSON.stringify(o)}
function customRosterFighterIds(){const ids=new Set();(state.rosters||[]).forEach(r=>(r.fighters||[]).forEach(x=>{if(x?.customFighterId)ids.add(x.customFighterId)}));return ids}
// Exact copies only (same name AND same content), e.g. from importing or
// duplicating twice. Per group, the copy that is published, else used by a
// warband/roster, else the first one is kept; references to the removed
// copies are re-pointed to it.
function customDuplicatePlan(){
  const official={fighters:officializedFighterIdSet(),equipment:officializedEquipmentIdSet(),...officializedContentIdSets()};
  const used=new Set();customWarbandList().forEach(cw=>['fighterIds','equipmentIds','specialRuleIds','traitIds'].forEach(k=>(cw[k]||[]).forEach(id=>used.add(id))));
  customRosterFighterIds().forEach(id=>used.add(id));
  const plan=[];
  CUSTOM_CLEANUP_KINDS.forEach(k=>{
    const groups=new Map();
    k.list().forEach(x=>{const sig=customCleanupSignature(x);if(!groups.has(sig))groups.set(sig,[]);groups.get(sig).push(x)});
    groups.forEach(g=>{
      if(g.length<2)return;
      const off=official[k.tab]||new Set();
      const keep=g.find(x=>off.has(x[k.idKey]))||g.find(x=>used.has(x[k.idKey]))||g[0];
      g.forEach(x=>{if(x!==keep&&!off.has(x[k.idKey]))plan.push({kind:k,id:x[k.idKey],keepId:keep[k.idKey],name:x.name||'—'})});
    });
  });
  return plan;
}
function customPublishedPlan(){
  const online=customOnlineSets();
  const rosterCw=new Set((state.rosters||[]).map(r=>r.customWarbandId).filter(Boolean));
  const rosterFighters=customRosterFighterIds();
  const all=customWarbandList();
  // Only a warband whose official version is actually live (published, so
  // merged into D.factions) counts: one sent back to draft/archived online
  // keeps its local copy, the only one players could get it back from.
  const liveOfficial=new Set((D.factions||[]).filter(f=>f.__official).map(f=>String(f.id||'').replace(/^official-/,'')));
  const cws=all.filter(cw=>cw.officialId&&liveOfficial.has(String(cw.officialId))&&!rosterCw.has(cw.id));
  const remaining=all.filter(cw=>!cws.includes(cw));
  // Anything a warband that stays (not published, or still used by a
  // roster) relies on is kept, so that warband keeps working.
  const keepIds=new Set(),keepNames={equipment:new Set(),traits:new Set(),skills:new Set(),spells:new Set(),special:new Set()};
  remaining.forEach(cw=>{
    ['fighterIds','equipmentIds','specialRuleIds','traitIds'].forEach(k=>(cw[k]||[]).forEach(id=>keepIds.add(id)));
    let b;try{b=bundleCustomContentForOfficialize(cw,customWarbandFaction(cw))}catch(e){return}
    (b.equipment||[]).forEach(e=>keepNames.equipment.add(normName(e.name)));
    (b.traits||[]).forEach(e=>keepNames.traits.add(normName(e.name)));
    (b.skills||[]).forEach(e=>keepNames.skills.add(normName(e.name)));
    (b.spells||[]).forEach(e=>keepNames.spells.add(normName(e.name)));
    (b.specialRules||[]).forEach(e=>keepNames.special.add(normName(e.name)));
  });
  const official={fighters:officializedFighterIdSet(),equipment:officializedEquipmentIdSet(),...officializedContentIdSets()};
  // Which published warband each published item came with, so an item that
  // has to stay (still used elsewhere) keeps its published status once that
  // warband's local copy is gone, instead of popping back into the list.
  const origin=new Map();
  cws.forEach(cw=>{
    ['fighterIds','equipmentIds','specialRuleIds','traitIds'].forEach(k=>(cw[k]||[]).forEach(id=>{if(!origin.has(id))origin.set(id,cw.officialId)}));
    let b;try{b=bundleCustomContentForOfficialize(cw,customWarbandFaction(cw))}catch(e){return}
    const byName=(tab,list)=>(list||[]).forEach(e=>{const k=CUSTOM_CLEANUP_KINDS.find(q=>q.tab===tab);const x=k&&k.list().find(q=>sameContent(tab,q,e));if(x&&!origin.has(x[k.idKey]))origin.set(x[k.idKey],cw.officialId)});
    byName('equipment',b.equipment);byName('traits',b.traits);byName('skills',b.skills);byName('spells',b.spells);byName('special',b.specialRules);
  });
  const items=[],flag=[],kept=[];
  CUSTOM_CLEANUP_KINDS.forEach(k=>{
    const off=official[k.tab];if(!off)return;
    k.list().forEach(x=>{const id=x[k.idKey];
      const isOnline=k.tab==='fighters'||k.tab==='equipment'?online[k.tab].has(id):(online[k.tab]&&contentOnline(online[k.tab],k.tab,x));
      if(!off.has(id)&&!isOnline)return;
      const keep=keepIds.has(id)||(k.tab==='fighters'&&rosterFighters.has(id))||(keepNames[k.tab]&&keepNames[k.tab].has(normName(x.name)))
        // A published item that belongs to a published warband still kept
        // locally (used by a roster) stays with it.
        ||(k.tab==='fighters'&&x.customWarbandId&&all.some(cw=>cw.id===x.customWarbandId&&!cws.includes(cw)));
      const onlineOid=k.tab==='fighters'||k.tab==='equipment'?online[k.tab]?.origin.get(id):online[k.tab]?.origin.get(normName(x.name));
      if(keep){if(!x.officialWarbandId&&(origin.get(id)||onlineOid))flag.push({kind:k,id,officialId:origin.get(id)||onlineOid});kept.push(`${customCleanupTypeLabel(k.tab)} · ${x.name||'—'}`);return}
      items.push({kind:k,id,name:x.name||'—'})});
  });
  // Trees/domains: published as a whole, or left with nothing but deleted
  // entries, and not offered by a profile that stays.
  const delIds=new Set(items.map(x=>x.id));
  const parents=[];
  [['skills','skillAccess'],['spells','magicAccess']].forEach(([kind,acc])=>{
    const list=kind==='skills'?customSkillTreeList():customMagicDomainList();
    list.forEach(pt=>{
      const its=customBuilderItems(kind,pt);
      const left=its.filter(x=>!delIds.has(x.customContentId));
      const live=(kind==='skills'?online.trees:online.domains).has(normName(pt.name));
      const goes=(pt.officialWarbandId||live)?!left.length:(its.length>0&&!left.length);
      if(!goes)return;
      const n=normName(pt.name);
      const offered=customFighterList().some(w=>!delIds.has(w.customFighterId)&&!official.fighters.has(w.customFighterId)&&Object.keys(w?.[acc]||{}).some(q=>normName(q)===n));
      if(offered)return;
      parents.push({kind,id:pt.id,name:pt.name});
    });
  });
  return {cws,items,parents,flag,kept};
}
// V-CUSTOMUNUSED: everything local Custom content is referenced by — custom
// warbands (their full officialize bundle: fighters' default/accessible
// equipment, skill trees, magic domains, rules), standalone custom
// fighters, choice options, and the fighters of every roster. Names are
// normalised; ids cover what is linked by id.
function customUsageIndex(){
  const names={equipment:new Set(),traits:new Set(),skills:new Set(),spells:new Set(),special:new Set(),trees:new Set(),domains:new Set()};
  const ids=new Set();
  const addBundle=b=>{(b.equipment||[]).forEach(e=>names.equipment.add(normName(e.name)));(b.traits||[]).forEach(e=>names.traits.add(normName(e.name)));(b.skills||[]).forEach(e=>names.skills.add(normName(e.name)));(b.spells||[]).forEach(e=>names.spells.add(normName(e.name)));(b.specialRules||[]).forEach(e=>names.special.add(normName(e.name)))};
  const addAccess=w=>{Object.keys(w?.skillAccess||{}).forEach(k=>names.trees.add(normName(k)));Object.keys(w?.magicAccess||{}).forEach(k=>names.domains.add(normName(k)))};
  customWarbandList().forEach(cw=>{
    ['fighterIds','equipmentIds','specialRuleIds','traitIds'].forEach(k=>(cw[k]||[]).forEach(id=>ids.add(id)));
    try{addBundle(bundleCustomContentForOfficialize(cw,customWarbandFaction(cw)))}catch(e){}
    (cw.choices?.groups||[]).forEach(g=>(g.options||[]).forEach(o=>{[...(o.ruleNames||[]),...(o.recruitRuleNames||[])].forEach(n=>names.special.add(normName(n)));(o.magicDomains||[]).forEach(n=>names.domains.add(normName(n)))}));
  });
  const fighters=customFighterList();
  fighters.forEach(addAccess);
  try{const fx={id:'custom-all',warriors:fighters.map(w=>customFighterAsWarrior(w)),equipment:[]};addBundle(bundleCustomContentForOfficialize({id:'custom-all',specialRuleIds:[],traitIds:[]},fx))}catch(e){}
  (state.rosters||[]).forEach(r=>(r.fighters||[]).forEach(x=>{
    if(x?.customFighterId)ids.add(x.customFighterId);
    [...(x.skills||[])].forEach(n=>names.skills.add(normName(typeof n==='string'?n:n?.name)));
    [...(x.spells||[])].forEach(n=>names.spells.add(normName(typeof n==='string'?n:n?.name)));
    [...(x.extraRuleNames||[]),...(x.rules||[]),...(x.specialRules||[])].forEach(n=>names.special.add(normName(typeof n==='string'?n:n?.name)));
    [...(x.equipmentSelected||[]),...(x.equipmentStash||[])].forEach(e=>names.equipment.add(normName(e?.name)));
    (x.unlockedMagicDomains||[]).forEach(n=>names.domains.add(normName(n)));
  }));
  // Equipment that stays keeps its own traits.
  customEquipmentList().forEach(e=>{if(names.equipment.has(normName(e.name))||ids.has(e.customEquipmentId)){[e.profile?.traits,e.traits,...(Array.isArray(e.profiles)?e.profiles.map(q=>q?.traits):[])].flatMap(t=>Array.isArray(t)?t:String(t||'').split(',')).forEach(n=>{n=String(n||'').replace(/\s*\(.*$/,'').trim();if(n)names.traits.add(normName(n))})}});
  return {names,ids};
}
// Unused + not published: candidates for "Remove unused items". Fighters
// and creatures are left out on purpose (a profile is a creation in itself).
function customUnusedPlan(){
  const u=customUsageIndex();
  const official={equipment:officializedEquipmentIdSet(),...officializedContentIdSets()};
  const items=[];
  CUSTOM_CLEANUP_KINDS.filter(k=>['equipment','traits','skills','spells','special'].includes(k.tab)).forEach(k=>{
    k.list().forEach(x=>{const id=x[k.idKey];if(official[k.tab]?.has(id)||u.ids.has(id))return;
      if(u.names[k.tab].has(normName(x.name)))return;
      if(k.tab==='skills'&&u.names.trees.has(normName(x.tree||'')))return;
      if(k.tab==='spells'&&u.names.domains.has(normName(x.domain||'')))return;
      items.push({kind:k,id,name:x.name||'—',place:x.tree||x.domain||''})});
  });
  const del=new Set(items.map(x=>x.id));const parents=[];
  [['skills','trees'],['spells','domains']].forEach(([kind,nk])=>{
    (kind==='skills'?customSkillTreeList():customMagicDomainList()).forEach(pt=>{
      if(pt.officialWarbandId||u.names[nk].has(normName(pt.name)))return;
      if(customBuilderItems(kind,pt).every(x=>del.has(x.customContentId)))parents.push({kind,id:pt.id,name:pt.name});
    });
  });
  return {items,parents};
}
function cleanupCustomUnused(){
  const en=siteLanguage==='en';const p=customUnusedPlan();const n=p.items.length+p.parents.length;
  if(!n){toast(en?'No unused item':'Aucun élément inutilisé');return}
  const row=(val,label)=>`<label class="cwc-check" style="display:flex;gap:6px;text-align:left"><input type="checkbox" class="cuPick" value="${esc(val)}" checked> ${esc(label)}</label>`;
  const rows=[...p.parents.map(x=>row(`p:${x.kind}:${x.id}`,`${x.kind==='skills'?(en?'Skill tree':'Arbre de compétences'):(en?'Magic domain':'Domaine de magie')} · ${x.name}`)),...p.items.map(x=>row(`i:${x.kind.tab}:${x.id}`,`${customCleanupTypeLabel(x.kind.tab)} · ${x.name}${x.place?` (${x.place})`:''}`))];
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'CLEANUP':'NETTOYAGE'}</div><h2>${en?`Remove unused items?`:`Supprimer les éléments inutilisés ?`}</h2><p>${en?'Not published, and used by none of your custom warbands, custom profiles, choices or warbands. Untick what you want to keep (e.g. something you just created). Only local Custom data is changed.':'Ni publiés, ni utilisés par tes warbands custom, tes profils custom, tes choix ou tes bandes. Décoche ce que tu veux garder (par ex. une création toute récente). Seules tes données Custom locales changent.'}</p><div style="max-height:260px;overflow:auto;margin:10px 0;display:grid;gap:4px">${rows.join('')}</div><button type="button" class="big-delete" onclick="confirmCleanupCustomUnused()">${en?'DELETE SELECTED':'SUPPRIMER LA SÉLECTION'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`);
}
function confirmCleanupCustomUnused(){
  const en=siteLanguage==='en';
  const picked=[...document.querySelectorAll('.cuPick:checked')].map(i=>i.value);
  const p=customUnusedPlan();
  const items=p.items.filter(x=>picked.includes(`i:${x.kind.tab}:${x.id}`));
  const parents=p.parents.filter(x=>picked.includes(`p:${x.kind}:${x.id}`));
  // A tree/domain only goes if none of its entries were unticked.
  const keptItems=new Set(p.items.filter(x=>!items.includes(x)).map(x=>x.id));
  const goParents=parents.filter(pt=>customBuilderItems(pt.kind,(pt.kind==='skills'?customSkillTreeById(pt.id):customMagicDomainById(pt.id))).every(x=>!keptItems.has(x.customContentId)));
  items.forEach(x=>markDeleted(x.kind.stateKey,x.id));
  CUSTOM_CLEANUP_KINDS.forEach(k=>{const del=new Set(items.filter(x=>x.kind===k).map(x=>x.id));if(del.size)state[k.stateKey]=k.list().filter(x=>!del.has(x[k.idKey]))});
  goParents.forEach(pt=>{const key=pt.kind==='skills'?'customSkillTrees':'customMagicDomains';markDeleted(key,pt.id);state[key]=(pt.kind==='skills'?customSkillTreeList():customMagicDomainList()).filter(x=>x.id!==pt.id)});
  const n=items.length+goParents.length;
  save(true);closeModal();render('custom');
  toast(en?`${n} unused item${n>1?'s':''} removed`:`${n} élément${n>1?'s':''} inutilisé${n>1?'s':''} supprimé${n>1?'s':''}`);
}
// V-CUSTOMCOMPARE: "is my Custom content really online?" Fetches the live
// official warbands (published only, what every player gets) and, for an
// admin, every official warband with its status, then sorts each local
// Custom item into: live online / only in an official warband that is not
// published (draft) / online but with a different text / not published at
// all. Read-only: nothing is changed, locally or online.
function cmpNorm(t){return String(t||'').replace(/\s+/g,' ').trim()}
async function openCustomCompare(){
  const en=siteLanguage==='en';
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'COMPARE':'COMPARAISON'}</div><h2>${en?'Comparing with what is online…':'Comparaison avec le contenu en ligne…'}</h2></div>`);
  let live=[],adminRows=null;const full=new Map();
  try{const r=await window.MordheimundaAPI.officialWarbands();live=Array.isArray(r?.warbands)?r.warbands:[]}catch(e){}
  if(isAdminSession()){try{const r=await window.MordheimundaAPI.adminListWarbands();adminRows=Array.isArray(r?.warbands)?r.warbands:(Array.isArray(r)?r:null)}catch(e){}}
  const liveIds=new Set(live.map(w=>String(w.id||'').replace(/^official-/,'')));
  live.forEach(w=>full.set(String(w.id||'').replace(/^official-/,''),{name:w.displayName||w.name,status:'published',def:w}));
  if(adminRows){for(const row of adminRows){const id=String(row.id);if(full.has(id)){full.get(id).status=row.status||'published';continue}
    try{const r=await window.MordheimundaAPI.adminGetWarband(id);const w=r?.warband||r;full.set(id,{name:row.name,status:row.status||'draft',def:w?.definition||w||{}})}catch(e){full.set(id,{name:row.name,status:row.status||'draft',def:{}})}}}
  const idx={fighters:new Map(),equipment:new Map(),traits:new Map(),skills:new Map(),spells:new Map(),special:new Map(),trees:new Map(),domains:new Map()};
  const put=(k,key,id,text)=>{if(!key)return;const a=idx[k].get(key)||[];a.push({id,text});idx[k].set(key,a)};
  full.forEach((w,id)=>{const d=w.def||{};
    (d.warriors||[]).forEach(x=>put('fighters',x?.customFighterId,id));
    (d.equipment||[]).forEach(x=>put('equipment',x?.customEquipmentId,id));
    (d.traits||[]).forEach(x=>put('traits',normName(x?.name),id,x?.text));
    (d.skills||[]).forEach(x=>put('skills',normName(x?.name),id,x?.text));
    (d.spells||[]).forEach(x=>put('spells',normName(x?.name),id,x?.text));
    (d.specialRules||[]).forEach(x=>put('special',normName(x?.name),id,x?.text));
    (d.skillTrees||[]).forEach(x=>put('trees',normName(x?.name||x),id));
    (d.magicDomains||[]).forEach(x=>put('domains',normName(x?.name||x),id));
  });
  const usedBy=item=>customWarbandList().filter(cw=>{try{const b=bundleCustomContentForOfficialize(cw,customWarbandFaction(cw));return [...(b.equipment||[]),...(b.traits||[]),...(b.skills||[]),...(b.spells||[]),...(b.specialRules||[])].some(e=>normName(e.name)===normName(item))||customWarbandWarriors(cw).some(w=>normName(w.name)===normName(item))}catch(e){return false}}).map(cw=>cw.name);
  const groups={live:[],draft:[],diff:[],none:[]};
  const sortItem=(label,name,hits,localText)=>{
    const liveHits=(hits||[]).filter(h=>liveIds.has(h.id));
    const row=`${label} · ${name}`;
    if(liveHits.length){if(localText!=null&&liveHits.every(h=>h.text!=null&&cmpNorm(h.text)!==cmpNorm(localText)))groups.diff.push(`${row} — ${liveHits.map(h=>full.get(h.id)?.name).join(', ')}`);else groups.live.push(row);return}
    if((hits||[]).length){groups.draft.push(`${row} — ${hits.map(h=>`${full.get(h.id)?.name} (${full.get(h.id)?.status})`).join(', ')}`);return}
    const u=usedBy(name);groups.none.push(`${row}${u.length?` — ${en?'used by':'utilisé par'} ${u.join(', ')}`:''}`);
  };
  customFighterList().forEach(w=>sortItem(customCleanupTypeLabel('fighters'),w.name,idx.fighters.get(w.customFighterId),null));
  customEquipmentList().forEach(w=>sortItem(customCleanupTypeLabel('equipment'),w.name,idx.equipment.get(w.customEquipmentId),null));
  ['traits','skills','spells','special'].forEach(k=>customContentList(k).forEach(x=>sortItem(customCleanupTypeLabel(k),x.name,idx[k].get(normName(x.name)),x.text||'')));
  customSkillTreeList().forEach(t=>sortItem(en?'Skill tree':'Arbre de compétences',t.name,idx.trees.get(normName(t.name)),null));
  customMagicDomainList().forEach(t=>sortItem(en?'Magic domain':'Domaine de magie',t.name,idx.domains.get(normName(t.name)),null));
  const cwRows=customWarbandList().map(cw=>{const o=cw.officialId?full.get(String(cw.officialId)):null;
    const st=!cw.officialId?(en?'not officialized':'non officialisée'):!o?(adminRows?(en?'⚠ officialized here but NOT FOUND online (deleted?)':'⚠ officialisée ici mais INTROUVABLE en ligne (supprimée ?)'):(en?'not live (draft/archived, or deleted)':'pas en ligne (brouillon/archivée, ou supprimée)')):o.status==='published'?(en?'✓ live':'✓ en ligne'):`⚠ ${o.status} — ${en?'not visible to players':'invisible pour les joueurs'}`;
    return `${cw.name} — ${st}`});
  const sec=(title,rows,open)=>`<details class="custom-collapse"${open?' open':''} style="text-align:left"><summary><span>${title}</span><small>${rows.length}</small></summary>${rows.length?customCleanupListMarkup(rows):`<p class="muted">—</p>`}</details>`;
  openModal(`<div class="delete-dialog" style="text-align:left"><div class="eyebrow">${en?'COMPARE · READ ONLY':'COMPARAISON · LECTURE SEULE'}</div><h2>${en?'Your Custom library vs online':'Ta bibliothèque Custom vs en ligne'}</h2><p class="muted">${en?`${liveIds.size} published official warband${liveIds.size>1?'s':''} online`:`${liveIds.size} warband${liveIds.size>1?'s':''} officielle${liveIds.size>1?'s':''} publiée${liveIds.size>1?'s':''} en ligne`}${adminRows?` · ${full.size-liveIds.size} ${en?'not published (draft/archived)':'non publiée(s) (brouillon/archivée)'}`:''}. ${en?'Nothing is changed.':'Rien n’est modifié.'}</p>
   ${sec(en?'Your custom warbands':'Tes warbands custom',cwRows,true)}
   ${sec(en?'⚠ Online but with a different text':'⚠ En ligne mais avec un texte différent',groups.diff,true)}
   ${sec(en?'⚠ Only in an official warband that is not published':'⚠ Seulement dans une warband officielle non publiée',groups.draft,true)}
   ${sec(en?'Not published (only on your account)':'Non publiés (seulement sur ton compte)',groups.none,true)}
   ${sec(en?'✓ Live online':'✓ En ligne',groups.live,false)}
   <button type="button" class="button secondary full" onclick="closeModal()">${en?'Close':'Fermer'}</button></div>`);
}
function openRestoreOfficial(){
  const en=siteLanguage==='en';const list=officialMissingLocal();
  if(!list.length){toast(en?'Every published item already has its Custom copy':'Tous les éléments publiés ont déjà leur copie Custom');return}
  const rows=list.map((m,i)=>`<label class="cwc-check" style="display:flex;gap:6px;text-align:left"><input type="checkbox" class="roPick" value="${i}" checked> ${esc(customCleanupTypeLabel(m.tab))} · ${esc(m.name)} <span class="muted">— ${esc(m.host)}</span></label>`);
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'RESTORE':'RÉCUPÉRER'}</div><h2>${en?'Bring published items back into Custom':'Remettre les éléments publiés dans Custom'}</h2><p>${en?'These are live online but have no copy in your Custom library, so they can’t be edited from there. A copy is rebuilt from the published version (same id, linked to its official warband): edit it, then ★ to republish. Nothing online changes until you republish.':'Ils sont en ligne mais n’ont plus de copie dans ta bibliothèque Custom, donc impossible de les modifier. Une copie est recréée depuis la version publiée (même identifiant, rattachée à sa warband officielle) : modifie-la, puis ★ pour republier. Rien ne change en ligne tant que tu ne republies pas.'}</p><div style="max-height:280px;overflow:auto;margin:10px 0;display:grid;gap:4px">${rows.join('')}</div><button type="button" class="button primary full" onclick="confirmRestoreOfficial()">${en?'RESTORE SELECTED':'RÉCUPÉRER LA SÉLECTION'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`);
}
function confirmRestoreOfficial(){
  const en=siteLanguage==='en';const list=officialMissingLocal();
  const picked=new Set([...document.querySelectorAll('.roPick:checked')].map(i=>Number(i.value)));
  let n=0;list.forEach((m,i)=>{if(picked.has(i)&&restoreOfficialItem(m))n++});
  save(true);closeModal();render('custom');
  toast(en?`${n} item${n>1?'s':''} restored to Custom (in the OFFICIALIZED folder)`:`${n} élément${n>1?'s':''} récupéré${n>1?'s':''} dans Custom (dossier OFFICIALISÉS)`);
}
function customCleanupButtonsMarkup(){
  const en=siteLanguage==='en';let dup=0,pub=0;
  try{dup=customDuplicatePlan().length}catch(e){}
  try{const p=customPublishedPlan();pub=p.cws.length+p.items.length+p.parents.length}catch(e){}
  let unused=0;try{const p=customUnusedPlan();unused=p.items.length+p.parents.length}catch(e){}
  let missing=0;try{missing=officialMissingLocal().length}catch(e){}
  return (missing?`<button class="button secondary" type="button" onclick="openRestoreOfficial()">↺ ${en?`Restore ${missing} published item${missing>1?'s':''} to edit`:`Récupérer ${missing} élément${missing>1?'s':''} publié${missing>1?'s':''} pour les modifier`}</button>`:'')+`<button class="button secondary" type="button" onclick="openCustomCompare()">🔍 ${en?'Compare with online':'Comparer avec le publié'}</button>`+(isAdminEditUI()?`<button class="button secondary" type="button" onclick="openPublishEdits()">⇪ ${en?'Publish my edits':'Publier mes modifications'}</button>`:'')+(dup?`<button class="button secondary" type="button" onclick="cleanupCustomDuplicates()">🧹 ${en?`Remove ${dup} duplicate${dup>1?'s':''}`:`Supprimer ${dup} doublon${dup>1?'s':''}`}</button>`:'')
    +(pub?`<button class="button secondary" type="button" onclick="cleanupCustomPublished()">🧹 ${en?`Remove ${pub} published local cop${pub>1?'ies':'y'}`:`Supprimer ${pub} copie${pub>1?'s':''} locale${pub>1?'s':''} officialisée${pub>1?'s':''}`}</button>`:'')
    +(unused?`<button class="button secondary" type="button" onclick="cleanupCustomUnused()">🧹 ${en?`Remove unused items (${unused})`:`Supprimer les éléments inutilisés (${unused})`}</button>`:'');
}
function customCleanupTypeLabel(tab){const en=siteLanguage==='en';const m={fighters:en?'Fighter':'Profil',equipment:en?'Equipment':'Équipement',creatures:en?'Creature':'Créature',traits:'Trait',skills:en?'Skill':'Compétence',spells:en?'Spell':'Sort',special:en?'Special rule':'Règle spéciale'};return m[tab]||tab}
function cleanupCustomDuplicates(){
  const en=siteLanguage==='en';const plan=customDuplicatePlan();
  if(!plan.length){toast(en?'No duplicate to remove':'Aucun doublon à supprimer');return}
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'CLEANUP':'NETTOYAGE'}</div><h2>${en?`Remove ${plan.length} duplicate${plan.length>1?'s':''}?`:`Supprimer ${plan.length} doublon${plan.length>1?'s':''} ?`}</h2><p>${en?'Exact copies (same name and same content). One copy of each is kept, and warbands using a removed copy are switched to the kept one. Nothing published online is changed.':'Copies identiques (même nom et même contenu). Une copie de chaque est gardée, et les warbands qui utilisaient une copie supprimée passent sur celle gardée. Rien de ce qui est en ligne n’est modifié.'}</p>${customCleanupListMarkup(plan.map(x=>`${customCleanupTypeLabel(x.kind.tab)} · ${x.name}`))}<button type="button" class="big-delete" onclick="confirmCleanupCustomDuplicates()">${en?'DELETE':'SUPPRIMER'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`);
}
function confirmCleanupCustomDuplicates(){
  const en=siteLanguage==='en';const plan=customDuplicatePlan();
  const remap=new Map(plan.map(x=>[x.id,x.keepId]));
  const swap=arr=>Array.isArray(arr)?[...new Set(arr.map(id=>remap.get(id)||id))]:arr;
  const swapRef=arr=>Array.isArray(arr)?[...new Set(arr.map(r=>typeof r==='string'&&r.startsWith('custom:')&&remap.has(r.slice(7))?'custom:'+remap.get(r.slice(7)):r))]:arr;
  customWarbandList().forEach(cw=>{['fighterIds','equipmentIds','specialRuleIds','traitIds'].forEach(k=>{if(cw[k])cw[k]=swap(cw[k])});['fighterRefs','equipmentRefs'].forEach(k=>{if(cw[k])cw[k]=swapRef(cw[k])})});
  (state.rosters||[]).forEach(r=>(r.fighters||[]).forEach(x=>{if(x?.customFighterId&&remap.has(x.customFighterId))x.customFighterId=remap.get(x.customFighterId)}));
  plan.forEach(x=>markDeleted(x.kind.stateKey,x.id));
  CUSTOM_CLEANUP_KINDS.forEach(k=>{const del=new Set(plan.filter(x=>x.kind===k).map(x=>x.id));if(del.size)state[k.stateKey]=k.list().filter(x=>!del.has(x[k.idKey]))});
  save(true);closeModal();render('custom');
  toast(en?`${plan.length} duplicate${plan.length>1?'s':''} removed`:`${plan.length} doublon${plan.length>1?'s':''} supprimé${plan.length>1?'s':''}`);
}
function cleanupCustomPublished(){
  const en=siteLanguage==='en';const p=customPublishedPlan();const n=p.cws.length+p.items.length+p.parents.length;
  if(!n){toast(en?'No published local copy to remove':'Aucune copie locale officialisée à supprimer');return}
  const rows=[...p.cws.map(cw=>`Warband · ${cw.name}`),...p.parents.map(x=>`${x.kind==='skills'?(en?'Skill tree':'Arbre de compétences'):(en?'Magic domain':'Domaine de magie')} · ${x.name}`),...p.items.map(x=>`${customCleanupTypeLabel(x.kind.tab)} · ${x.name}`)];
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'CLEANUP':'NETTOYAGE'}</div><h2>${en?`Remove ${n} published local cop${n>1?'ies':'y'}?`:`Supprimer ${n} copie${n>1?'s':''} locale${n>1?'s':''} officialisée${n>1?'s':''} ?`}</h2><p>${en?'Only the copies kept in your Custom library are removed. <b>The published versions stay online, unchanged, for every player</b>, and remain editable in Admin → Manage. You will no longer be able to re-publish them from Custom (★ / Publish changes). Anything an unpublished creation or one of your warbands still uses is kept.':'Seules les copies gardées dans ta bibliothèque Custom sont supprimées. <b>Les versions officialisées restent en ligne, inchangées, pour tous les joueurs</b>, et restent modifiables dans Admin → Gestion. Tu ne pourras plus les republier depuis Custom (★ / Publier les modifications). Tout ce qu’une création non publiée ou une de tes bandes utilise encore est gardé.'}</p>${customCleanupListMarkup(rows)}${p.kept.length?`<p class="muted">${en?`Kept because an unpublished custom warband, a custom profile or one of your warbands still uses them (${p.kept.length}):`:`Gardés car une warband custom non publiée, un profil custom ou une de tes bandes les utilise encore (${p.kept.length}) :`}</p>${customCleanupListMarkup(p.kept)}`:''}<button type="button" class="big-delete" onclick="confirmCleanupCustomPublished()">${en?'DELETE':'SUPPRIMER'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`);
}
function confirmCleanupCustomPublished(){
  const en=siteLanguage==='en';const p=customPublishedPlan();const n=p.cws.length+p.items.length+p.parents.length;
  const cwIds=new Set(p.cws.map(cw=>cw.id));
  p.flag.forEach(f=>{const x=f.kind.list().find(q=>q[f.kind.idKey]===f.id);if(x&&!x.officialWarbandId)x.officialWarbandId=f.officialId});
  p.parents.forEach(pt=>{const key=pt.kind==='skills'?'customSkillTrees':'customMagicDomains';markDeleted(key,pt.id);state[key]=(pt.kind==='skills'?customSkillTreeList():customMagicDomainList()).filter(x=>x.id!==pt.id)});
  cwIds.forEach(id=>markDeleted('customWarbands',id));
  state.customWarbands=customWarbandList().filter(cw=>!cwIds.has(cw.id));
  p.items.forEach(x=>markDeleted(x.kind.stateKey,x.id));
  CUSTOM_CLEANUP_KINDS.forEach(k=>{const del=new Set(p.items.filter(x=>x.kind===k).map(x=>x.id));if(del.size)state[k.stateKey]=k.list().filter(x=>!del.has(x[k.idKey]))});
  if(customWarbandEditId&&cwIds.has(customWarbandEditId))customWarbandEditId=null;
  save(true);closeModal();render('custom');
  toast(en?`${n} published local cop${n>1?'ies':'y'} removed — online versions unchanged`:`${n} copie${n>1?'s':''} locale${n>1?'s':''} supprimée${n>1?'s':''} — versions en ligne inchangées`);
}
function confirmDeleteCustomWarband(id){
  const en=siteLanguage==='en';
  const cw=customWarbandById(id);
  markDeleted('customWarbands',id);state.customWarbands=customWarbandList().filter(x=>x.id!==id);
  // V-ORPHANFIGHTERS: a custom fighter created FOR this warband (its
  // customWarbandId set at creation — warriorToCustomFighterDraft on
  // duplicate/import, or customFighterForm when saved with this warband
  // picked — with factionId left empty, it only makes sense attached here)
  // used to survive the warband's own deletion with a now-dangling
  // customWarbandId. customFighterRow's bandLabel couldn't resolve that id
  // to anything, so it fell through to '—': an unlabeled "ghost" profile
  // stuck forever in Custom > Combattants with no visible origin. Unlike
  // equipment (shared/reusable, no per-warband ownership field), these
  // fighters aren't reused elsewhere, so it's safe to remove them with the
  // warband instead of leaving them behind. Never touches one already
  // officialized (officialWarbandId set) — that copy is still the live
  // editable source for a published warband regardless of this custom
  // record's fate.
  const orphanFighterIds=(cw?.fighterIds||[]).filter(fid=>{
    const w=customFighterById(fid);
    return w&&w.customWarbandId===id&&!w.officialWarbandId;
  });
  orphanFighterIds.forEach(fid=>markDeleted('customFighters',fid));
  if(orphanFighterIds.length)state.customFighters=customFighterList().filter(w=>!orphanFighterIds.includes(w.customFighterId));
  if(customWarbandEditId===id)customWarbandEditId=null;
  save(true);closeModal();render('custom');
  toast(orphanFighterIds.length?(en?`Custom warband deleted (+${orphanFighterIds.length} fighter${orphanFighterIds.length>1?'s':''} that ${orphanFighterIds.length>1?'were':'was'} exclusive to it)`:`Warband custom supprimée (+${orphanFighterIds.length} combattant${orphanFighterIds.length>1?'s':''} qui lui ${orphanFighterIds.length>1?'étaient':'était'} exclusif${orphanFighterIds.length>1?'s':''})`):(en?'Custom warband deleted':'Warband custom supprimée'));
}
function saveCustomWarbandMeta(){const en=siteLanguage==='en';const name=($('#cwName')?.value||'').trim(),description=($('#cwDescription')?.value||'').trim();if(!name){toast(en?'Give the Warband a name':'Donne un nom à la Warband');return}let cw=customWarbandById(customWarbandEditId);const isNew=!cw;if(!cw){cw={id:crypto.randomUUID(),name:'',description:'',fighterIds:[],equipmentIds:[],fighterRefs:[],equipmentRefs:[],specialRuleIds:[],traitIds:[]};state.customWarbands.push(cw)}cw.name=name;cw.description=description;{const m=Math.round(Number($('#cwMaxWarriors')?.value));if(m>=1)cw.maxWarriors=Math.min(200,m);else delete cw.maxWarriors}customWarbandEditId=null;customWarbandCreating=false;save(true);render('custom');toast(isNew?(en?'Warband created — use Edit to configure it':'Warband créée — utilise Modifier pour la configurer'):(en?'Warband saved':'Warband sauvegardée'))}
function customWarbandSummaryRow(cw){const en=siteLanguage==='en';return `<article class="custom-item-row"><div class="custom-item-main"><div class="custom-item-icon">⚔</div><div><strong>${esc(cw.name)}</strong>${cw.officialId?`<small><span class="official-draft-tag">${en?'OFFICIAL EDITION':'ÉDITION OFFICIELLE'}</span></small>`:''}</div></div><div class="custom-item-actions"><button type="button" class="equipment-action" onclick="editCustomWarband('${cw.id}')">✎</button><button type="button" class="equipment-action" title="${en?'Duplicate (e.g. to make a sub-warband)':'Dupliquer (ex. pour une sous-bande)'}" aria-label="${en?'Duplicate':'Dupliquer'} ${esc(cw.name)}" onclick="duplicateCustomWarband('${cw.id}')">⧉</button><button type="button" class="equipment-action remove" onclick="deleteCustomWarband('${cw.id}')">🗑</button></div></article>`}
// Copy a custom warband: its own fighter profiles are copied (so they can be
// changed independently), equipment and rules stay shared library items,
// choices are copied (untick options in ⚙ Choices to restrict the copy).
function duplicateCustomWarband(id){
  const en=siteLanguage==='en';const src=customWarbandById(id);if(!src)return;
  const copy=JSON.parse(JSON.stringify(src));copy.id=crypto.randomUUID();delete copy.officialId;
  const taken=new Set(customWarbandList().map(c=>normName(c.name)));let name=`${src.name} — ${en?'copy':'copie'}`;let k=2;while(taken.has(normName(name))){name=`${src.name} — ${en?'copy':'copie'} ${k++}`}copy.name=name;
  const idMap=new Map();
  (src.fighterIds||[]).forEach(fid=>{const f=customFighterList().find(x=>x.customFighterId===fid);if(!f)return;const nf=JSON.parse(JSON.stringify(f));nf.customFighterId=crypto.randomUUID();nf.customWarbandId=copy.id;delete nf.officialWarbandId;state.customFighters.push(nf);idMap.set(fid,nf.customFighterId)});
  copy.fighterIds=(src.fighterIds||[]).map(f=>idMap.get(f)).filter(Boolean);
  copy.fighterRefs=(src.fighterRefs||[]).map(r=>{const m=String(r).match(/^custom:(.+)$/);return m&&idMap.has(m[1])?`custom:${idMap.get(m[1])}`:r});
  customWarbandList().push(copy);save(true);
  customArea='warband';customContentTab='warband';customWarbandEditId=copy.id;customWarbandCreating=false;customWarbandSection=copy.choices?'choices':'fighters';render('custom');
  toast(en?`${name} created`:`${name} créée`);
}
function customWarbandCreateForm(){const en=siteLanguage==='en';return `<section class="card custom-warband-create-form"><div class="eyebrow">${en?'NEW WARBAND':'NOUVELLE WARBAND'}</div><h3>${en?'Create a custom Warband':'Créer une Warband custom'}</h3><label class="custom-field"><span>${en?'Name':'Nom'}</span><input id="cwName" placeholder="${en?'Warband name':'Nom de la Warband'}"></label><label class="custom-field"><span>${en?'Maximum fighters (optional, Hired Swords not counted)':'Combattants max (facultatif, Hired Swords non compris)'}</span><input id="cwMaxWarriors" type="number" min="1" max="200" step="1" placeholder="—"></label><label class="custom-field"><span>${en?'Description (optional)':'Description (facultatif)'}</span>${customTextToolbarMarkup('cwDescription')}<textarea id="cwDescription" class="wide-textarea" rows="4" placeholder="${en?'Band description…':'Description de la bande…'}"></textarea></label><div class="custom-actions"><button type="button" class="button secondary" onclick="customWarbandCreating=false;render('custom')">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" onclick="saveCustomWarbandMeta()">${en?'Save':'Sauvegarder'}</button></div></section>`}
function mutationFactionLabel(m){const en=siteLanguage==='en';const ids=m.factions||[];if(!ids.length)return '';const names=ids.map(id=>{if(String(id).startsWith('custom-warband-'))return customWarbandById(String(id).slice(15))?.name||'';const f=(D.factions||[]).find(x=>x.id===id);return f?(f.displayName||f.name):''}).filter(Boolean);return names.length?names.join(', ')+(en?' only':' seulement'):''}

// --- Custom › Mutations (admin)
let mutEditId=null;
function newMutation(){mutEditId=null;render('custom');setTimeout(()=>document.getElementById('mutName')?.focus(),60)}
function editMutation(id){mutEditId=id;render('custom');setTimeout(()=>document.getElementById('mutName')?.scrollIntoView({block:'center'}),60)}
function mutationFactionOptions(){const off=(D.factions||[]).filter(f=>!f.packId&&!isContentPoolFaction(f)).map(f=>[f.id,f.displayName||f.name]);const cus=customWarbandList().filter(c=>!c.officialId).map(c=>['custom-warband-'+c.id,c.name+' (custom)']);return [...off,...cus].sort((a,b)=>String(a[1]).localeCompare(String(b[1])))}
function mutationEditorMarkup(){const en=siteLanguage==='en';const m=mutEditId?mutationById(mutEditId):null;const a=m?.attack||null;const fac=m?.factions||[];
  return `<div class="mut-editor"><div class="eyebrow">${m?(en?'EDIT MUTATION':'MODIFIER LA MUTATION'):(en?'NEW MUTATION':'NOUVELLE MUTATION')}</div>
  <label class="custom-field wide"><span>${en?'Name':'Nom'}</span><input id="mutName" maxlength="80" value="${esc(m?.name||'')}"></label>
  <div class="custom-form-grid"><label class="custom-field"><span>${en?'Cost (gc)':'Coût (gc)'}</span><input id="mutCost" type="number" min="0" step="5" inputmode="numeric" value="${Number(m?.cost)||0}"></label>
  <details class="custom-field mut-fac"><summary><span>${en?'Warbands':'Bandes'}</span> <b id="mutFacSum">${fac.length?fac.length:(en?'All':'Toutes')}</b></summary><small class="muted">${en?'None ticked = all warbands.':'Aucune cochée = toutes les bandes.'}</small><div class="mut-fac-list">${mutationFactionOptions().map(([id,n])=>`<label class="custom-check"><input type="checkbox" class="mutFac" value="${esc(id)}" ${fac.includes(id)?'checked':''} onchange="const n=document.querySelectorAll('.mutFac:checked').length;document.getElementById('mutFacSum').textContent=n||'${en?'All':'Toutes'}'"> <span>${esc(n)}</span></label>`).join('')}</div></details></div>
  <label class="custom-field wide"><span>${en?'Rule text':'Texte de la règle'}</span><textarea id="mutText" class="wide-textarea" rows="4" maxlength="4000">${esc(m?.text||'')}</textarea></label>
  <small class="custom-field-help">${en?'Changes like “+1 Movement” in the text are applied on their own.':'Les changements du type « +1 Movement » dans le texte s’appliquent tout seuls.'}</small>
  <label class="custom-field wide"><span>${en?'Special rules given (optional)':'Règles spéciales données (facultatif)'}</span><input id="mutRules" value="${esc((m?.rules||[]).join(', '))}" placeholder="Fear"></label>
  <label class="custom-check"><input type="checkbox" id="mutAtk" ${a?'checked':''} onchange="document.getElementById('mutAtkBox').hidden=!this.checked"> <span>${en?'Natural attack (not a weapon, no slot)':'Attaque naturelle (pas une arme, pas d’emplacement)'}</span></label>
  <div class="mut-atk" id="mutAtkBox" ${a?'':'hidden'}><label class="custom-field"><span>${en?'Range':'Portée'}</span><input id="mutRange" value="${esc(a?.range||'Melee')}"></label><label class="custom-field"><span>${en?'Strength':'Force'}</span><input id="mutStr" value="${esc(a?.strength||'S')}"></label><label class="custom-field"><span>AP</span><input id="mutAp" value="${esc(a?.ap||'-')}"></label><label class="custom-field"><span>${en?'Dmg':'Dég.'}</span><input id="mutDmg" value="${esc(a?.damage||'1')}"></label><label class="custom-field wide"><span>Traits</span><input id="mutTraits" value="${esc(a?.traits||'')}"></label></div>
  <div class="custom-actions">${m?`<button type="button" class="button secondary" onclick="deleteMutationEntry('${esc(m.id)}')">🗑 ${en?'Delete':'Supprimer'}</button>`:''}<button type="button" class="button secondary" onclick="newMutation()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" onclick="saveMutationEntry()">${en?'Save':'Enregistrer'}</button></div></div>`}
function mutationLibraryAside(){const en=siteLanguage==='en';const q=(customContentSearch||'').toLowerCase();const list=(mutationLibrary.mutations||[]).filter(m=>!q||(m.name+' '+(m.text||'')).toLowerCase().includes(q)).slice().sort((a,b)=>a.name.localeCompare(b.name));
  const skillNames=[...new Set((referenceEntries('skills')||[]).map(e=>e.name))].sort();
  return `<aside class="card custom-library"><div class="custom-library-head"><div><div class="eyebrow">${en?'LIBRARY':'BIBLIOTHÈQUE'}</div><h3>${en?'My mutations':'Mes mutations'}</h3></div><span>${list.length}</span></div><input class="search" value="${esc(customContentSearch)}" placeholder="${en?'Search…':'Rechercher…'}" oninput="customContentSearch=this.value;render('custom')"><div class="custom-item-list">${list.length?list.map(m=>`<button type="button" class="mut-lib-row${m.id===mutEditId?' on':''}" onclick="editMutation('${esc(m.id)}')"><span><b>${esc(m.name)}</b><small>${esc([mutationEffects(m),mutationFactionLabel(m)].filter(Boolean).join(' · '))}</small></span><span class="mut-val">${Number(m.cost)||0} gc</span></button>`).join(''):`<div class="empty large"><strong>${en?'No mutation yet.':'Aucune mutation.'}</strong></div>`}</div>
  <div class="mut-grant-ed"><label class="custom-field wide"><span>${en?'Skills that give 1 free mutation (chosen; the skill pays, no value added)':'Compétences qui donnent 1 mutation gratuite (au choix ; la compétence paie, aucune valeur ajoutée)'}</span><input id="mutGrantSkills" list="mutSkillList" value="${esc((mutationLibrary.grantSkills||[]).join(', '))}" placeholder="${en?'e.g. Mutation':'ex. Mutation'}"></label><datalist id="mutSkillList">${skillNames.map(n=>`<option value="${esc(n)}">`).join('')}</datalist><button type="button" class="button secondary small" onclick="saveMutationGrantSkills()">${en?'Save':'Enregistrer'}</button></div></aside>`}
async function saveMutationLibrary(next,msg){const en=siteLanguage==='en';try{const res=await window.MordheimundaAPI.adminSaveMutations(next);const l=res?.library||next;mutationLibrary={mutations:l.mutations||[],grantSkills:l.grantSkills||[]};toast(msg||(en?'Saved':'Enregistré'));return true}catch(e){toast(authError(e,en));return false}}
async function saveMutationEntry(){const en=siteLanguage==='en';const name=String(document.getElementById('mutName')?.value||'').trim();if(!name){toast(en?'Give it a name':'Donne-lui un nom');return}
  const atk=document.getElementById('mutAtk')?.checked?{range:document.getElementById('mutRange').value.trim()||'Melee',strength:document.getElementById('mutStr').value.trim()||'S',ap:document.getElementById('mutAp').value.trim()||'-',damage:document.getElementById('mutDmg').value.trim()||'1',traits:document.getElementById('mutTraits').value.trim()}:null;
  const id=mutEditId||('mut-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6));
  const entry={id,name,cost:Math.max(0,Number(document.getElementById('mutCost')?.value)||0),factions:[...document.querySelectorAll('.mutFac:checked')].map(c=>c.value),text:String(document.getElementById('mutText')?.value||'').trim(),rules:String(document.getElementById('mutRules')?.value||'').split(',').map(t=>t.trim()).filter(Boolean),attack:atk};
  const list=(mutationLibrary.mutations||[]).filter(m=>m.id!==id);const i=(mutationLibrary.mutations||[]).findIndex(m=>m.id===id);if(i>=0)list.splice(i,0,entry);else list.push(entry);
  if(await saveMutationLibrary({mutations:list,grantSkills:mutationLibrary.grantSkills||[]})){mutEditId=id;render('custom')}}
function deleteMutationEntry(id){const en=siteLanguage==='en';const m=mutationById(id);if(!m)return;openModal(`<div class="delete-dialog"><div class="eyebrow">MUTATION</div><h2>${en?`Delete "${esc(m.name)}"?`:`Supprimer « ${esc(m.name)} » ?`}</h2><p>${en?'Fighters who already have it keep their copy.':'Les combattants qui l’ont déjà gardent leur copie.'}</p><button type="button" class="big-delete" onclick="confirmDeleteMutationEntry('${esc(id)}')">${en?'DELETE':'SUPPRIMER'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`)}
async function confirmDeleteMutationEntry(id){closeModal();if(await saveMutationLibrary({mutations:(mutationLibrary.mutations||[]).filter(m=>m.id!==id),grantSkills:mutationLibrary.grantSkills||[]})){mutEditId=null;render('custom')}}
async function saveMutationGrantSkills(){const v=String(document.getElementById('mutGrantSkills')?.value||'').split(',').map(t=>t.trim()).filter(Boolean);if(await saveMutationLibrary({mutations:mutationLibrary.mutations||[],grantSkills:v}))render('custom')}
(function(){const order=LEARN_CHAPTERS.flatMap(c=>c.lessons);LEARN_LESSONS.sort((a,b)=>{const i=order.indexOf(a.id),j=order.indexOf(b.id);return (i<0?99:i)-(j<0?99:j)})})();
function learnChapterOf(id){return LEARN_CHAPTERS.find(c=>c.lessons.includes(id))||null}
function learnTx(l,f){return hx(`learn.${l.id}.${f}`,l[f])}
function learnFormat(t){const lines=String(t||'').split('\n');let out='',ul=false;const fmt=s=>esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>');
  lines.forEach(line=>{const m=line.match(/^\s*[•\-]\s*(.*)$/);if(m){if(!ul){out+='<ul>';ul=true}out+=`<li>${fmt(m[1])}</li>`}else{if(ul){out+='</ul>';ul=false}if(line.trim())out+=`<p>${fmt(line)}</p>`}});if(ul)out+='</ul>';return out}
function learnDone(){return new Set(Array.isArray(learnState().done)?learnState().done:[])}
function learnRuleGo(id){rulesOpen=id;try{persistUiState('rulesOpen',id)}catch(e){}navigateApp(APP_ROUTES.rules)}
function learn(){const en=siteLanguage==='en';const id=parseAppRoute().lesson||'';if(id==='train'){$('#content').innerHTML=trainMarkup();return}if(id==='guide'){$('#content').innerHTML=guideMarkup();return}const i=LEARN_LESSONS.findIndex(l=>l.id===id);
  if(i<0){learnUi.id=null;$('#content').innerHTML=learnListMarkup();return}
  if(learnUi.id!==id)learnUi={id,pick:null,roll:null};
  $('#content').innerHTML=learnLessonMarkup(i)}
function learnChapterDone(c,done){return c.lessons.length?c.lessons.every(id=>done.has(id)):!!learnState().train}
function learnListMarkup(){const en=siteLanguage==='en';const done=learnDone();const chs=LEARN_CHAPTERS;const k=chs.filter(c=>learnChapterDone(c,done)).length;const cur=chs.find(c=>!learnChapterDone(c,done));const tx=(c,f)=>hx(`learn.ch.${c.id}.${f}`,c[f]);
  const row=(c,j)=>{const dn=learnChapterDone(c,done);const isCur=cur&&cur.id===c.id;const n=c.lessons.filter(id=>done.has(id)).length;const first=c.lessons.find(id=>!done.has(id))||c.lessons[0];
    const go=c.train?`learnTrainGo()`:`learnOpen('${first}')`;
    const sub=isCur&&c.lessons.length>1?`<div class="learn-sub">${c.lessons.map(id=>{const l=LEARN_LESSONS.find(x=>x.id===id);return l?`<button type="button" class="learn-subrow${done.has(id)?' done':''}" onclick="learnOpen('${id}')">${done.has(id)?'✓':'·'} ${esc(learnTx(l,'title'))}</button>`:''}).join('')}</div>`:'';
    return `<div class="learn-ch${dn?' done':''}${isCur?' cur':''}"><button type="button" class="learn-row" onclick="${go}"><span class="learn-num">${dn?'✓':j+1}</span><span class="learn-row-tx"><b>${esc(tx(c,'title'))}</b><small>${esc(tx(c,'sub'))}</small></span><span class="learn-go">${c.lessons.length?`${n}/${c.lessons.length}`:''}${isCur?` · ${en?'GO':'GO'}`:''} ›</span></button>${sub}</div>`};
  return `<div class="learn-page"><div class="rules-crumb"><a href="#" onclick="navigateApp(APP_ROUTES.rules);return false;">${en?'Rules':'Règles'}</a><span class="sep">›</span><span class="cur">${en?'Learn to play':'Apprendre à jouer'}</span></div>
  <button type="button" class="guide-banner" onclick="guideOpen(null)">🧭 <span><b>${en?'New to the game? The player’s guide':'Nouveau ? Le guide du joueur'}</b><small>${en?'Everything step by step, from zero to your first game.':'Tout, étape par étape, de zéro à ta première partie.'}</small></span> ›</button><h1 class="learn-title">${en?'Learn to play':'Apprendre à jouer'}</h1><p class="learn-intro">${en?`A path in ${chs.length} chapters. Each lesson takes 3 minutes and ends with a question and a dice to roll. All chapters stay open: the order is only a suggestion.`:`Un parcours en ${chs.length} chapitres. Chaque leçon prend 3 minutes et finit par une question et un dé à lancer. Tous les chapitres restent ouverts : l’ordre est seulement conseillé.`}</p>
  <div class="learn-progress"><div class="learn-bar"><i style="width:${Math.round(k/chs.length*100)}%"></i></div><span>${en?`${k} of ${chs.length} chapters`:`${k} chapitre${k>1?'s':''} sur ${chs.length}`}${k?` · 🏅 ${k}`:''}</span></div>
  <div class="learn-list">${chs.map(row).join('')}</div>
  ${done.size||learnState().train?`<button type="button" class="button secondary small learn-reset" onclick="learnSave({done:[],train:false});learn()">${en?'Start again':'Tout recommencer'}</button>`:''}</div>`}
function guideStepDone(s){return s.todo.every(t=>t.done)}
function guideMarkup(){const en=siteLanguage==='en';const steps=guideSteps();const T=v=>helpT(v);
  if(guideStep==='camp')return guideCampMarkup();
  if(guideStep!=null&&steps[guideStep])return guideStepMarkup(steps,guideStep);
  const k=steps.filter(guideStepDone).length;const cur=steps.findIndex(s=>!guideStepDone(s));
  const row=(s,i)=>{const d=guideStepDone(s),c=i===cur;return `<button type="button" class="guide-step${d?' done':''}${c?' cur':''}" onclick="guideOpen(${i})"><span class="learn-num">${d?'✓':i+1}</span><span class="learn-row-tx"><b>${esc(T(s.title))}</b><small>${esc(T(s.sub))}</small></span><span class="learn-go">${c?'GO ›':'›'}</span></button>`};
  const more=(ic,t,sub,run)=>`<button type="button" class="guide-more" onclick="${run}"><span class="gm-ic">${ic}</span><span class="learn-row-tx"><b>${t}</b><small>${sub}</small></span><span class="learn-go">›</span></button>`;
  return `<div class="learn-page guide-page"><div class="rules-crumb"><a href="#" onclick="learnOpen('');return false;">${en?'Learn to play':'Apprendre à jouer'}</a><span class="sep">›</span><span class="cur">${en?'Player’s guide':'Guide du joueur'}</span></div>
  <h1 class="learn-title">${en?'The player’s guide':'Le guide du joueur'}</h1>
  <section class="guide-start"><div class="guide-kick"><span>${en?'TO GET STARTED · ~15 MIN':'POUR TE LANCER · ~15 MIN'}</span><span>${k} / ${steps.length}</span></div><p class="guide-lead">${en?'Just what you need to play your first game. In order.':'Juste ce qu’il faut pour jouer ta première partie. Dans l’ordre.'}</p><div class="learn-bar"><i style="width:${Math.round(k/steps.length*100)}%"></i></div><div class="guide-steps">${steps.map(row).join('')}</div>${k===steps.length?`<div class="learn-why ok">🏅 ${en?'You know the essentials. Go further whenever you like.':'Tu connais l’essentiel. Va plus loin quand tu veux.'}</div>`:''}</section>
  <div class="guide-kick muted-kick"><span>${en?'GOING FURTHER · À LA CARTE':'POUR ALLER PLUS LOIN · À LA CARTE'}</span></div>
  <div class="guide-mores">${more('🎓',en?'Learn to play':'Apprendre à jouer',en?'9 chapters, lessons + dice, training game':'9 chapitres, leçons + dés, partie d’entraînement',"learnOpen('')")}${more('🗺',en?'Campaigns':'Les campagnes',en?'How it works, join one, after each game':'Comment ça marche, rejoindre, après chaque partie',"guideOpen('camp')")}${more('⚒',en?'Create content':'Créer du contenu',en?'Custom fighter, item, warband':'Combattant, objet, warband custom',"navigateApp(APP_ROUTES.custom)")}${more('📖',en?'The full rules':'Les règles complètes',en?'Read, search, bookmarks':'Lire, chercher, favoris',"navigateApp(APP_ROUTES.rules)")}</div></div>`}
// V-GUIDECAMP: "Going further › Campaigns" — the same shape as a step
// (the essential, then boxes that tick themselves), for players who have
// played a game and want to keep their warband from one game to the next.
function guideCampMarkup(){const en=siteLanguage==='en';const t=guideCampTopic();const T=v=>helpT(v);
  return `<div class="learn-page guide-page"><div class="rules-crumb"><a href="#" onclick="guideOpen(null);return false;">${en?'Player’s guide':'Guide du joueur'}</a><span class="sep">›</span><span class="cur">${en?'Going further':'Pour aller plus loin'}</span></div>
  <h1 class="learn-title">${esc(T(t.title))}</h1><p class="guide-lead">${esc(T(t.sub))}</p>
  <div class="guide-essential"><div class="guide-kick"><span>${en?'THE ESSENTIAL':'L’ESSENTIEL'}</span></div>${t.pts.map(p=>`<div class="ge-pt"><span>•</span><span>${esc(T(p))}</span></div>`).join('')}</div>
  <div class="guide-kick muted-kick"><span>${en?'AFTER EACH GAME, IN ORDER':'APRÈS CHAQUE PARTIE, DANS L’ORDRE'}</span></div>
  <ol class="guide-camp-order">${t.order.map(o=>`<li><b>${esc(T(o[0]))}</b> <span>${esc(T(o[1]))}</span></li>`).join('')}</ol>
  <div class="guide-kick muted-kick"><span>${en?'TO DO':'À FAIRE'}</span></div>
  <div class="guide-todo">${t.todo.map(x=>`<div class="gt-row${x.done?' done':''}"><span class="gt-dot">${x.done?'✓':''}</span><span>${esc(T(x.t))}</span><button type="button" class="gt-go" onclick="${x.run}">${esc(T(x.btn))} ›</button></div>`).join('')}</div>
  <p class="muted guide-note">${en?'These boxes tick themselves as you go.':'Ces cases se cochent toutes seules quand tu avances.'}</p>
  <button type="button" class="guide-deep" onclick="${t.deep.run}">📚 <b>${en?'Go deeper':'Approfondir'}</b> ${en?'(optional):':'(facultatif) :'} ${esc(T(t.deep.t))} ›</button>
  <div class="guide-nav"><button type="button" class="button secondary" onclick="guideOpen(null)">‹ ${en?'The guide':'Le guide'}</button></div></div>`}
function guideStepMarkup(steps,i){const en=siteLanguage==='en';const s=steps[i];const T=v=>helpT(v);
  return `<div class="learn-page guide-page"><div class="rules-crumb"><a href="#" onclick="guideOpen(null);return false;">${en?'Player’s guide':'Guide du joueur'}</a><span class="sep">›</span><span class="cur">${en?'Getting started':'Pour te lancer'} · ${i+1}</span></div>
  <h1 class="learn-title">${esc(T(s.title))}</h1>
  <div class="guide-essential"><div class="guide-kick"><span>${en?'THE ESSENTIAL':'L’ESSENTIEL'}</span></div>${s.pts.map(p=>`<div class="ge-pt"><span>•</span><span>${esc(T(p))}</span></div>`).join('')}</div>
  <div class="guide-kick muted-kick"><span>${en?'TO DO':'À FAIRE'}</span></div>
  <div class="guide-todo">${s.todo.map(t=>`<div class="gt-row${t.done?' done':''}"><span class="gt-dot">${t.done?'✓':''}</span><span>${esc(T(t.t))}</span><button type="button" class="gt-go" onclick="${t.run}">${esc(T(t.btn))} ›</button></div>`).join('')}</div>
  <p class="muted guide-note">${en?'These boxes tick themselves as you go.':'Ces cases se cochent toutes seules quand tu avances.'}</p>
  <button type="button" class="guide-deep" onclick="${s.deep.run}">📚 <b>${en?'Go deeper':'Approfondir'}</b> ${en?'(optional):':'(facultatif) :'} ${esc(T(s.deep.t))} ›</button>
  <div class="guide-nav">${i>0?`<button type="button" class="button secondary" onclick="guideOpen(${i-1})">‹ ${en?'Step':'Étape'} ${i}</button>`:`<button type="button" class="button secondary" onclick="guideOpen(null)">‹ ${en?'The guide':'Le guide'}</button>`}${i<steps.length-1?`<button type="button" class="button primary" onclick="guideOpen(${i+1})">${en?'Step':'Étape'} ${i+2} ›</button>`:`<button type="button" class="button primary" onclick="guideOpen(null)">${en?'Back to the guide':'Retour au guide'} ›</button>`}</div></div>`}
function learnPlayFirstGame(){try{coachToggle(true)}catch(e){}navigateApp(APP_ROUTES.playMode);toast(siteLanguage==='en'?'“My first game” is on: it guides you turn by turn.':'« Ma première partie » est activé : il te guide tour par tour.')}
function trainD6(){return 1+Math.floor(Math.random()*6)}
function trainInjury(d){return d<=2?'flesh':d<=5?'down':'ooa'}
function trainInjTx(st,en){return st==='flesh'?(en?'Flesh Wound: it stays up, −1 Toughness':'Blessure légère : il reste debout, −1 Endurance'):st==='down'?(en?'Seriously Injured: it falls to the ground':'Gravement blessé : il tombe au sol'):(en?'Out of Action: it is taken off the board':'Hors de combat : il est retiré du plateau')}
function trainBoard(){const t=trainUi;const S=14;const fig=(x,y,label,col,state)=>state==='ooa'?`<g opacity=".25"><circle cx="${x*S}" cy="${y*S}" r="11" fill="${col}"/><text x="${x*S}" y="${y*S+4}" font-size="10" text-anchor="middle" fill="#111" font-weight="700">${label}</text></g>`:`<g${state==='down'?' transform="rotate(90 '+x*S+' '+y*S+')"':''}><circle cx="${x*S}" cy="${y*S}" r="11" fill="${col}" ${state==='down'?'stroke="#fff" stroke-dasharray="3 2"':''}/><text x="${x*S}" y="${y*S+4}" font-size="10" text-anchor="middle" fill="#111" font-weight="700">${label}</text></g>`;
  const en=siteLanguage==='en';const g='#9dfa3c',r='#e06f6f';
  return `<svg class="train-board" viewBox="0 0 ${24*S} ${16*S}" role="img" aria-label="${en?'Training board':'Plateau d’entraînement'}"><rect width="${24*S}" height="${16*S}" fill="var(--panel)" stroke="var(--line)"/>
   <rect x="${8*S}" y="${7*S}" width="${2*S}" height="${1.2*S}" fill="#4a4945"/><text x="${9*S}" y="${6.6*S}" font-size="9" fill="var(--muted)" text-anchor="middle">${en?'wall':'mur'}</text>
   <rect x="${14*S}" y="${2*S}" width="${4*S}" height="${3*S}" fill="#2a3520" stroke="#3f6b17"/><text x="${16*S}" y="${5.8*S}" font-size="9" fill="var(--muted)" text-anchor="middle">${en?'ruin':'ruine'}</text>
   ${t.step===2?`<line x1="${3*S}" y1="${4*S}" x2="${11*S}" y2="${10*S}" stroke="#e0b04a" stroke-dasharray="5 4" stroke-width="2"/>`:''}
   ${fig(t.capPos[0],t.capPos[1],en?'L':'C',g,'ok')}${fig(3,4,en?'S':'T',g,t.shooter)}${fig(11,10,'B',r,t.brute)}${fig(16,10,'A',r,t.archer)}</svg>
   <div class="train-legend"><span><i style="background:${g}"></i>${en?'L Captain · S Shooter (yours)':'C Capitaine · T Tireur (à toi)'}</span><span><i style="background:${r}"></i>${en?'B Brute · A Archer (enemy)':'B Brute · A Archer (ennemis)'}</span></div>`}
function trainAns(k,v){trainUi.ans[k]=v;learn()}
function trainRoll(k,n){trainUi.rolls[k]=Array.from({length:n||1},trainD6);trainApply(k);learn()}
function trainNext(){trainUi.step++;window.scrollTo({top:0});learn()}
function trainApply(k){const t=trainUi,r=t.rolls[k];
  if(k==='shot'){const hit=r[0]!==1&&r[0]>=5;t.shotHit=hit}
  if(k==='shotWound'){t.shotWound=r[0]>=3}
  if(k==='shotInj'){t.brute=trainInjury(r[0])}
  if(k==='fight'){t.fightHits=r.filter(d=>d!==1&&d>=3).length}
  if(k==='fightWound'){t.fightWounds=r.filter(d=>d>=(t.fightNeed||4)).length}
  if(k==='fightInj'){t.brute=trainInjury(r[0])}
  if(k==='enemyShot'){t.enemyHit=r[0]!==1&&r[0]>=4}
  if(k==='enemyWound'){t.enemyWound=r[0]>=4}
  if(k==='enemyInj'){t.shooter=trainInjury(r[0])}}
function trainDice(k,label,n){const en=siteLanguage==='en';const r=trainUi.rolls[k];return r?`<div class="learn-dice">${r.map(d=>`<span class="learn-die">${d}</span>`).join('')}</div>`:`<button type="button" class="button primary learn-roll-btn" onclick="trainRoll('${k}',${n||1})">🎲 ${label}</button>`}
function trainQ(k,q,opts,right,why){const en=siteLanguage==='en';const a=trainUi.ans[k];const done=a!=null;return `<div class="learn-ex"><div class="learn-q">${esc(q)}</div><div class="learn-opts n${opts.length}">${opts.map((o,j)=>`<button type="button" class="learn-opt${done?(j===right?' right':j===a?' wrong':' dim'):''}" ${done&&a===right?'disabled':''} onclick="trainAns('${k}',${j})">${esc(o)}${done&&j===right?' ✓':''}</button>`).join('')}</div>${done?`<div class="learn-why ${a===right?'ok':'ko'}"><b>${a===right?(en?'Right!':'Bonne réponse !'):(en?'Not quite.':'Pas tout à fait.')}</b> ${esc(why)}</div>`:''}</div>`}
function trainStepMarkup(){const en=siteLanguage==='en';const t=trainUi;const ok=k=>t.ans[k]!=null&&t.ans[k]===t.right?.[k];const next=(label)=>`<button type="button" class="button primary learn-next" onclick="trainNext()">${label||(en?'Next ›':'Suite ›')}</button>`;t.right=t.right||{};
  const P=(x)=>`<div class="learn-body"><p>${x}</p></div>`;
  switch(t.step){
  case 0:return [en?'Your first game':'Ta première partie',P(en?'Two of your fighters against two enemies. You play one turn, step by step, with real dice. Your <b>Captain</b> (WS 4, 2 Attacks, sword) and your <b>Shooter</b> (BS 3, crossbow S 4) face a <b>Brute</b> (WS 3, T 3, 1 Wound) and an <b>Archer</b>.':'Deux de tes combattants contre deux ennemis. Tu joues un tour, étape par étape, avec de vrais dés. Ton <b>Capitaine</b> (CC 4, 2 Attaques, épée) et ton <b>Tireur</b> (CT 3, arbalète F 4) font face à une <b>Brute</b> (CC 3, E 3, 1 PV) et à un <b>Archer</b>.'),next(en?'Start ›':'Commencer ›')];
  case 1:{const r=t.prio;const body=r?`<div class="learn-dice"><span class="learn-die">${r[0]}</span><span class="learn-vs">${en?'vs':'contre'}</span><span class="learn-die">${r[1]}</span></div><div class="learn-why ${r[0]>r[1]?'ok':'ko'}">${r[0]===r[1]?(en?'Tie: both roll again.':'Égalité : on relance.'):r[0]>r[1]?(en?'You take Priority: you activate first.':'Tu prends la Priorité : tu actives en premier.'):(en?'Your opponent takes Priority: the Brute moves first and comes 7" from your Captain. Then it is your turn.':'Ton adversaire prend la Priorité : la Brute avance d’abord et arrive à 7" de ton Capitaine. Puis c’est à toi.')}</div>`:'';
    return [en?'1 · Priority':'1 · Priorité',P(en?'Each player rolls 1 dice: the highest activates first. Every fighter is Ready.':'Chaque joueur lance 1 dé : le plus haut active en premier. Tous les combattants sont Prêts.')+body,(!r||r[0]===r[1])?`<button type="button" class="button primary learn-roll-btn" onclick="trainUi.prio=[trainD6(),trainD6()];learn()">🎲 ${r?(en?'Roll again':'Relancer'):(en?'Roll for Priority':'Lancer pour la Priorité')}</button>`:next()]}
  case 2:{t.right.target=0;t.right.cover=2;const q1=trainQ('target',en?'Your Shooter activates and shoots. Which target?':'Ton Tireur s’active et tire. Quelle cible ?',[en?'The Brute (the closest)':'La Brute (la plus proche)',en?'The Archer':'L’Archer'],0,en?'You shoot the closest enemy you can see; another one needs a Cool check first.':'On tire sur l’ennemi visible le plus proche ; un autre demande d’abord un test de Calme.');
    const q2=ok('target')?trainQ('cover',en?'The Brute is behind the wall (partial cover). With BS 3, what do you need?':'La Brute est derrière le mur (couvert partiel). Avec CT 3, que faut-il ?',['3+','4+','5+'],2,en?'BS 3 hits on 4+, and cover gives −1: 5+.':'CT 3 touche sur 4+, et le couvert donne −1 : 5+.'):'';
    let res='';if(ok('cover')){res+=trainDice('shot',en?'Shoot (5+)':'Tirer (5+)');const r=t.rolls.shot;if(r){res+=`<div class="learn-why ${t.shotHit?'ok':'ko'}">${t.shotHit?(en?'Hit!':'Touché !'):(r[0]===1?(en?'A 1 always misses.':'Un 1 rate toujours.'):(en?'Missed: you needed 5 or more.':'Raté : il fallait 5 ou plus.'))}</div>`;
      if(t.shotHit){res+=`<p class="learn-body">${en?'To wound: crossbow S 4 against T 3 → 3+.':'Blesser : arbalète F 4 contre E 3 → 3+.'}</p>`+trainDice('shotWound',en?'Wound (3+)':'Blesser (3+)');const w=t.rolls.shotWound;if(w){res+=`<div class="learn-why ${t.shotWound?'ok':'ko'}">${t.shotWound?(en?'Wounded! No armour: the Brute loses its only Wound. Roll the Injury dice.':'Blessé ! Pas d’armure : la Brute perd son seul PV. Lance le dé de blessure.'):(en?'Not wounded.':'Pas blessé.')}</div>`;if(t.shotWound){res+=trainDice('shotInj',en?'Injury dice':'Dé de blessure');if(t.rolls.shotInj)res+=`<div class="learn-why ko">${esc(trainInjTx(t.brute,en))}.</div>`}}}}}
    const finished=t.rolls.shot&&(!t.shotHit||(t.rolls.shotWound&&(!t.shotWound||t.rolls.shotInj)));
    return [en?'2 · Shooting':'2 · Tirer',q1+q2+res,finished?next():'']}
  case 3:{t.capPos=t.capPos||[4,10];if(t.brute==='ooa'){t.right.reach=1;const q=trainQ('reach',en?'The Brute is out. The Archer is 12" from your Captain (M 4). Can he charge it?':'La Brute est sortie. L’Archer est à 12" de ton Capitaine (M 4). Peut-il le charger ?',[en?'Yes':'Oui',en?'No':'Non'],1,en?'A Charge goes up to 2 × M = 8": 12" is too far. He moves 4" closer instead.':'Une Charge va jusqu’à 2 × M = 8" : 12" c’est trop loin. Il avance plutôt de 4".');if(ok('reach'))t.capPos=[8,10];return [en?'3 · Your Captain':'3 · Ton Capitaine',q,ok('reach')?next():'']}
    t.right.charge=0;const q=trainQ('charge',en?'The Brute is 7" from your Captain (M 4). Can he charge?':'La Brute est à 7" de ton Capitaine (M 4). Peut-il charger ?',[en?'Yes':'Oui',en?'No':'Non'],0,en?'A Charge goes up to 2 × M = 8": 7" is enough. It uses both actions and gives a free Fight.':'Une Charge va jusqu’à 2 × M = 8" : 7" suffit. Elle prend ses 2 actions et donne un Combat gratuit.');
    if(!ok('charge'))return [en?'3 · Charge':'3 · Charger',q,''];t.capPos=[10,10];
    if(t.brute==='down')return [en?'3 · Charge':'3 · Charger',q+`<div class="learn-why ok">${en?'The Brute is Seriously Injured on the ground: in contact, your Captain finishes it with a <b>Coup de grâce</b>. It is Out of Action.':'La Brute est gravement blessée au sol : au contact, ton Capitaine l’achève d’un <b>Coup de grâce</b>. Elle est hors de combat.'}</div>`,`<button type="button" class="button primary learn-next" onclick="trainUi.brute='ooa';trainNext()">${en?'Next ›':'Suite ›'}</button>`];
    const bt=t.brute==='flesh'?2:3;t.fightNeed=diceWound(3,bt);let res=`<p class="learn-body">${en?'Fight: 2 Attacks, WS 4 against WS 3 → hits on 3+.':'Combat : 2 Attaques, CC 4 contre CC 3 → touche sur 3+.'}</p>`+trainDice('fight',en?'Roll 2 dice to hit (3+)':'Lancer 2 dés pour toucher (3+)',2);
    if(t.rolls.fight){res+=`<div class="learn-why ${t.fightHits?'ok':'ko'}">${t.fightHits?(en?`${t.fightHits} hit(s).`:`${t.fightHits} touche(s).`):(en?'No hit.':'Aucune touche.')}</div>`;
      if(t.fightHits){res+=`<p class="learn-body">${en?`Wound: sword S 3 against T ${bt}${bt<3?' (Flesh Wound)':''} → ${t.fightNeed}+.`:`Blesser : épée F 3 contre E ${bt}${bt<3?' (blessure légère)':''} → ${t.fightNeed}+.`}</p>`+trainDice('fightWound',en?`Roll ${t.fightHits} dice to wound (${t.fightNeed}+)`:`Lancer ${t.fightHits} dé(s) pour blesser (${t.fightNeed}+)`,t.fightHits);
        if(t.rolls.fightWound){res+=`<div class="learn-why ${t.fightWounds?'ok':'ko'}">${t.fightWounds?(en?'Wounded! Roll the Injury dice.':'Blessé ! Lance le dé de blessure.'):(en?'Not wounded.':'Pas blessé.')}</div>`;if(t.fightWounds){res+=trainDice('fightInj',en?'Injury dice':'Dé de blessure');if(t.rolls.fightInj)res+=`<div class="learn-why ko">${esc(trainInjTx(t.brute,en))}.</div>`}}}}
    const finished=t.rolls.fight&&(!t.fightHits||(t.rolls.fightWound&&(!t.fightWounds||t.rolls.fightInj)));
    return [en?'3 · Charge and fight':'3 · Charger et combattre',q+res,finished?next():'']}
  case 4:{let res=P(en?'Now the enemy activates. Its Archer (BS 3, bow S 3) shoots your Shooter, in the open: 4+ to hit, then S 3 against T 3: 4+ to wound.':'L’ennemi active maintenant. Son Archer (CT 3, arc F 3) tire sur ton Tireur, à découvert : 4+ pour toucher, puis F 3 contre E 3 : 4+ pour blesser.')+trainDice('enemyShot',en?'Roll for the enemy (4+)':'Lancer pour l’ennemi (4+)');
    if(t.rolls.enemyShot){res+=`<div class="learn-why ${t.enemyHit?'ko':'ok'}">${t.enemyHit?(en?'Your Shooter is hit.':'Ton Tireur est touché.'):(en?'Missed!':'Raté !')}</div>`;if(t.enemyHit){res+=trainDice('enemyWound',en?'Wound (4+)':'Blesser (4+)');if(t.rolls.enemyWound){res+=`<div class="learn-why ${t.enemyWound?'ko':'ok'}">${t.enemyWound?(en?'Wounded: roll the Injury dice for your Shooter.':'Blessé : lance le dé de blessure de ton Tireur.'):(en?'Not wounded.':'Pas blessé.')}</div>`;if(t.enemyWound){res+=trainDice('enemyInj',en?'Injury dice':'Dé de blessure');if(t.rolls.enemyInj)res+=`<div class="learn-why ko">${esc(trainInjTx(t.shooter,en))}.</div>`}}}}
    const finished=t.rolls.enemyShot&&(!t.enemyHit||(t.rolls.enemyWound&&(!t.enemyWound||t.rolls.enemyInj)));return [en?'4 · The enemy’s turn':'4 · Le tour ennemi',res,finished?next():'']}
  case 5:{const down=[t.brute,t.archer].filter(x=>x==='down'||x==='ooa').length;if(!down)return [en?'5 · End of the turn':'5 · Fin du tour',P(en?'Nobody is down in the enemy warband: no Rout test this turn. The game goes on to turn 2, with a new Priority roll.':'Personne n’est tombé chez l’ennemi : pas de test de déroute ce tour. La partie continue au tour 2, avec un nouveau jet de Priorité.'),next()];
    let res=P(en?`The enemy started with 2 fighters and has ${down} down. Rout test: 1 dice + ${down}. Over 2, the enemy warband flees.`:`L’ennemi a commencé à 2 et a ${down} combattant tombé. Test de déroute : 1 dé + ${down}. Au-dessus de 2, la bande ennemie fuit.`)+trainDice('rout',en?'Roll the Rout test':'Lancer le test de déroute');
    if(t.rolls.rout){const tot=t.rolls.rout[0]+down;t.won=tot>2;res+=`<div class="learn-why ${t.won?'ok':'ko'}">${t.rolls.rout[0]} + ${down} = ${tot}${t.won?(en?': over 2, the enemy flees. You win!':' : au-dessus de 2, l’ennemi fuit. Tu gagnes !'):(en?': not over 2, the enemy holds. The game goes on.':' : pas au-dessus de 2, l’ennemi tient. La partie continue.')}</div>`}
    return [en?'5 · End of the turn: Rout test':'5 · Fin du tour : test de déroute',res,t.rolls.rout?next():'']}
  default:{learnSave({train:true});return [en?'Training done':'Entraînement terminé',P(en?'You played a whole turn: Priority, shooting the closest target in cover, charging and fighting (or a coup de grâce), the enemy’s turn and the Rout test. In a real game, fighters taken Out of Action roll for Lasting Injuries after the battle.':'Tu as joué un tour complet : Priorité, tir sur la cible la plus proche à couvert, charge et combat (ou coup de grâce), tour ennemi et test de déroute. Dans une vraie partie, les combattants hors de combat lancent pour les blessures durables après la bataille.')+`<div class="learn-why ok">🏅 ${en?'Chapter 9 done.':'Chapitre 9 terminé.'}</div>`,`<div class="train-end"><button type="button" class="button primary" onclick="learnPlayFirstGame()">${en?'Play a real game with the guide ›':'Jouer une vraie partie avec le guide ›'}</button><button type="button" class="button secondary" onclick="trainReset();learn()">${en?'Train again':'Recommencer l’entraînement'}</button><button type="button" class="button secondary" onclick="learnOpen('')">${en?'Back to the path':'Retour au parcours'}</button></div>`]}}}
function trainMarkup(){const en=siteLanguage==='en';if(!trainUi)trainReset();const [title,body,foot]=trainStepMarkup();const total=6;const k=Math.min(trainUi.step,total);
  return `<div class="learn-page train-page"><div class="rules-crumb"><a href="#" onclick="learnOpen('');return false;">${en?'Learn to play':'Apprendre à jouer'}</a><span class="sep">›</span><span class="cur">${en?'Training game':'Partie d’entraînement'}</span></div>
  <div class="learn-progress"><div class="learn-bar"><i style="width:${Math.round(k/total*100)}%"></i></div><span>${k} / ${total}</span></div>
  <h1 class="learn-title">${title}</h1>${trainBoard()}${body}${foot||''}</div>`}
function learnLessonMarkup(i){const en=siteLanguage==='en';const l=learnEff(LEARN_LESSONS[i]);const n=LEARN_LESSONS.length;const prev=LEARN_LESSONS[i-1],next=LEARN_LESSONS[i+1];const rule=(typeof RULES_BOOK!=='undefined'?RULES_BOOK:[]).find(s=>s.id===l.rule);
  const opt=o=>Array.isArray(o)?helpT(o):String(o);const picked=learnUi.pick;const answered=picked!=null;const right=answered&&picked===l.a;
  const opts=l.opts.map((o,j)=>{const cls=answered?(j===l.a?' right':j===picked?' wrong':' dim'):'';return `<button type="button" class="learn-opt${cls}" ${answered&&right?'disabled':''} onclick="learnPick(${j})">${esc(opt(o))}${answered&&j===l.a?' ✓':''}</button>`}).join('');
  const verdict=answered?`<div class="learn-why ${right?'ok':'ko'}"><b>${right?(en?'Right!':'Bonne réponse !'):(en?'Not quite.':'Pas tout à fait.')}</b> ${esc(learnTx(l,'why'))}</div>`:'';
  const rollBox=l.roll&&right?`<div class="learn-roll">${learnUi.roll?learnRollMarkup(l):''}<button type="button" class="button ${learnUi.roll?'secondary':'primary'} learn-roll-btn" onclick="learnRoll()">🎲 ${learnUi.roll?(en?'Roll again':'Relancer'):(en?'Roll the dice':'Lancer le dé')}</button></div>`:'';
  return `<div class="learn-page"><div class="rules-crumb"><a href="#" onclick="learnOpen('');return false;">${en?'Learn to play':'Apprendre à jouer'}</a><span class="sep">›</span>${(()=>{const c=learnChapterOf(l.id);return c?`<span class="sep">›</span><span>${en?'Chapter':'Chapitre'} ${LEARN_CHAPTERS.indexOf(c)+1} · ${esc(hx(`learn.ch.${c.id}.title`,c.title))}</span>`:''})()}<span class="sep">›</span><span class="cur">${en?'Lesson':'Leçon'} ${i+1} / ${n}</span></div>
  <h1 class="learn-title">${esc(learnTx(l,'title'))}</h1>${l.svg||''}
  <div class="learn-body">${learnFormat(learnTx(l,'body'))}</div>
  ${rule?`<button type="button" class="learn-rule" onclick="learnRuleGo('${esc(rule.id)}')">${en?'Read the full rule':'Lire la règle complète'} : ${esc(rule.title)}</button>`:''}
  <div class="learn-ex"><div class="learn-kick">${en?'TRY IT':'ESSAIE'}</div><div class="learn-q">${esc(learnTx(l,'q'))}</div><div class="learn-opts n${l.opts.length}">${opts}</div>${verdict}${rollBox}</div>
  ${right?`<button type="button" class="button primary learn-next" onclick="learnOpen('${next?next.id:''}')">${next?`${en?'Next lesson':'Leçon suivante'} : ${esc(learnTx(next,'title'))} ›`:(en?'All lessons done — back to the list':'Toutes les leçons faites — retour à la liste')}</button>`:''}
  <div class="learn-nav">${prev?`<a href="#" onclick="learnOpen('${prev.id}');return false;">‹ ${esc(learnTx(prev,'title'))}</a>`:'<span></span>'}${next?`<a href="#" onclick="learnOpen('${next.id}');return false;">${esc(learnTx(next,'title'))} ›</a>`:''}</div></div>`}
function learnPick(j){const l=learnEff(LEARN_LESSONS.find(x=>x.id===learnUi.id));if(!l)return;learnUi.pick=j;learnUi.roll=null;if(j===l.a){const d=learnDone();d.add(l.id);learnSave({done:[...d]})}learn()}
function learnD6(){return 1+Math.floor(Math.random()*6)}
function learnRoll(){const l=learnEff(LEARN_LESSONS.find(x=>x.id===learnUi.id));if(!l?.roll)return;learnUi.roll=l.roll.k==='priority'?{a:learnD6(),b:learnD6()}:l.roll.k==='check'&&l.roll.dice===2?{a:learnD6(),b:learnD6()}:{a:learnD6()};learn()}
function learnRollMarkup(l){const en=siteLanguage==='en';const r=learnEff(l).roll,v=learnUi.roll;const die=n=>`<span class="learn-die">${n}</span>`;let res='',ok=true,steps=[];
  if(r.k==='priority'){ok=v.a>v.b;steps=[en?`You roll ${v.a}, your opponent ${v.b}.`:`Tu fais ${v.a}, ton adversaire ${v.b}.`,v.a===v.b?(en?'Tie: both players roll again.':'Égalité : les deux joueurs relancent.'):(en?`The highest roll takes Priority: ${ok?'you':'your opponent'}.`:`Le plus haut prend la Priorité : ${ok?'toi':'ton adversaire'}.`)];res=v.a===v.b?(en?'Tie':'Égalité'):ok?(en?'You have Priority':'Tu as la Priorité'):(en?'Your opponent has it':'Ton adversaire l’a');return `<div class="learn-dice">${die(v.a)}<span class="learn-vs">${en?'vs':'contre'}</span>${die(v.b)}<div class="learn-res ${v.a===v.b?'':ok?'ok':'ko'}">${res}</div></div><ol class="learn-steps">${steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`}
  if(r.k==='check'){const two=r.dice===2;const t=two?v.a+v.b:v.a;const nm=helpT(r.name);ok=t<=r.v&&!(!two&&v.a===6&&/initiative/i.test(nm));steps=[two?(en?`2 dice: ${v.a} + ${v.b} = ${t}.`:`2 dés : ${v.a} + ${v.b} = ${t}.`):(en?`The dice gives ${t}.`:`Le dé donne ${t}.`),en?`${nm} ${r.v}: ${t} ${t<=r.v?'is equal or lower':'is higher'}.`:`${nm} ${r.v} : ${t} ${t<=r.v?'est égal ou plus bas':'est plus haut'}.`];res=ok?(en?'Check passed':'Test réussi'):(en?'Check failed':'Test raté');return `<div class="learn-dice">${die(v.a)}${two?die(v.b):''}<div class="learn-res ${ok?'ok':'ko'}">${esc(res)}</div></div><ol class="learn-steps">${steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`}
  if(r.k==='rout'){const t=v.a+r.down;ok=t<=r.crew;steps=[en?`The dice gives ${v.a}.`:`Le dé donne ${v.a}.`,en?`Add the ${r.down} fighters down: ${v.a} + ${r.down} = ${t}.`:`On ajoute les ${r.down} combattants tombés : ${v.a} + ${r.down} = ${t}.`,en?`Started with ${r.crew}: ${t} ${ok?'is not higher':'is higher'}.`:`Départ à ${r.crew} : ${t} ${ok?'ne dépasse pas':'dépasse'}.`];res=ok?(en?'The warband holds':'La bande tient'):(en?'The warband flees':'La bande fuit')}
  else{const t=v.a+(r.mod||0);ok=v.a!==1&&t>=r.need;steps=[en?`The dice gives ${v.a}.`:`Le dé donne ${v.a}.`];if(v.a===1)steps.push(en?'A 1 always fails.':'Un 1 rate toujours.');else{if(r.mod)steps.push(`${en?'Modifier':'Modificateur'} (${helpT(r.modWhy||['',''])}) : ${r.mod>0?'+':''}${r.mod} → ${t}.`);steps.push(en?`You need ${r.need} or more: ${t} ${ok?'is enough':'is not enough'}.`:`Il faut ${r.need} ou plus : ${t} ${ok?'suffit':'ne suffit pas'}.`)}res=helpT(ok?r.ok:r.ko)}
  return `<div class="learn-dice">${die(v.a)}<div class="learn-res ${ok?'ok':'ko'}">${esc(res)}</div></div><ol class="learn-steps">${steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`}

function coveringReferenceSection(q){const en=siteLanguage==='en';if(referenceSourceFilter==='book')return '';const list=coveringReferenceEntries().filter(e=>!q||normName(e.name).includes(normName(q))||normName(e.text).includes(normName(q)));if(!list.length)return '';
 return `<section class="ref-cov-section" id="ref-coverings"><h2 class="ref-cov-title">◈ ${en?'Coverings':'Revêtements'} <small>${list.length}</small></h2><p class="muted" style="margin:0 0 10px;font-size:12.5px">${en?'A covering is applied to a close-combat weapon (e.g. an Ithilmar sword): it changes its profile and its price.':'Un revêtement s’applique à une arme de corps à corps (ex. une épée en ithilmar) : il modifie son profil et son prix.'}</p>${list.map(e=>referenceEntryMarkup(e,'equipment')).join('')}</section>`}
window.MORE_CODE_READY=true;
