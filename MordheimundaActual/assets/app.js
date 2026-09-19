// Keep this in sync with index.html's app.js?v= query string on every
// deploy. Shown in the account diagnostics panel so a stale service worker
// or browser cache is visible at a glance instead of a guess.
const APP_BUILD='110.0164.0';
const D=window.NECROHEIM_CATALOG;
const KEY='necroheim_roster_v4';
let state=window.MordheimundaStorage.load();
if(!Array.isArray(state.customEquipment))state.customEquipment=[];if(!Array.isArray(state.customWarbands))state.customWarbands=[];
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const P=D.profileNames;
const P_FULL=['Mouvement','Capacité de combat','Capacité de tir','Force','Endurance','Blessures','Initiative','Attaques','Commandement','Calme','Volonté','Intelligence'];
let gangTab='roster';
let postBattleSubtab='income';
let editingIndex=null;

/* Stable browser routes: refreshes stay on the current page and normal links
   support right-click / Ctrl-click / Cmd-click to open additional tabs. */
const APP_ROUTES={dashboard:'/',rosters:'/warbands',create:'/warbands/new',rules:'/rules',references:'/reference',custom:'/custom',account:'/account',armory:'/armory',codex:'/rules/book',admin:'/admin'};
function appPath(path){const raw=String(path||'/').split('#')[0].split('?')[0]||'/';return raw.length>1?raw.replace(/\/+$/,''):raw}
function warbandPath(id){return '/warbands/'+encodeURIComponent(String(id))}
function fighterPath(rosterId,instance){return warbandPath(rosterId)+'/fighter/'+encodeURIComponent(String(instance))}
function routeForView(view){
  if(view==='builder'){const r=Array.isArray(state?.rosters)?state.rosters.find(x=>String(x?.id)===String(state?.active)):null;return r?warbandPath(r.id):APP_ROUTES.rosters}
  if(view==='fighter'){const r=Array.isArray(state?.rosters)?state.rosters.find(x=>String(x?.id)===String(state?.active)):null;const x=r?.fighters?.[editingIndex];return r&&x?fighterPath(r.id,x.instance||x.wid||editingIndex):routeForView('builder')}
  return APP_ROUTES[view]||'/'
}
function parseAppRoute(path=location.pathname){
  const p=appPath(path);
  if(p==='/')return {view:'dashboard'};
  if(p==='/warbands')return {view:'rosters'};
  if(p==='/warbands/new')return {view:'create'};
  if(p==='/rules')return {view:'rules'};
  if(p==='/reference')return {view:'references'};
  if(p==='/custom')return {view:'custom'};
  if(p==='/account')return {view:'account'};
  if(p==='/armory')return {view:'armory'};
  if(p==='/rules/book')return {view:'codex'};
  if(p==='/admin')return {view:'admin'};
  const fm=p.match(/^\/warbands\/([^/]+)\/fighter\/([^/]+)$/);
  if(fm)return {view:'fighter',rosterId:decodeURIComponent(fm[1]),fighterInstance:decodeURIComponent(fm[2])};
  const wm=p.match(/^\/warbands\/([^/]+)$/);
  if(wm)return {view:'builder',rosterId:decodeURIComponent(wm[1])};
  return {view:'dashboard',invalid:true};
}
function applyRouteState(route){
  if(route?.rosterId){
    const r=Array.isArray(state?.rosters)?state.rosters.find(x=>String(x?.id)===String(route.rosterId)):null;
    if(!r)return {view:'rosters',fallback:true};
    state.active=r.id;
    if(route.view==='fighter'){
      const idx=Array.isArray(r.fighters)?r.fighters.findIndex(x=>String(x?.instance||x?.wid||'')===String(route.fighterInstance)):-1;
      if(idx<0)return {view:'builder',fallback:true};
      editingIndex=idx;
    }else if(route.view==='builder'){
      editingIndex=null;
    }
  }
  return route;
}
// Scrolling is intentionally NOT reset on every repaint — only when the
// actual page/route changes. A re-render of the SAME page (toggling a
// checkbox, adding a fighter, a background cloud sync…) must never yank the
// scroll position back to the top while someone is working further down the
// page; only navigating to a genuinely different page should land at the top.
let lastRenderedRoutePath=null;
function renderCurrentRoute(){
  const route=applyRouteState(parseAppRoute());
  renderOriginal(route.view);
  applySiteLanguage();
  const path=appPath(location.pathname);
  if(path!==lastRenderedRoutePath)window.scrollTo({top:0,left:0,behavior:'auto'});
  lastRenderedRoutePath=path;
  return route;
}
function navigateApp(path,{replace=false}={}){const next=appPath(path);if(next!==appPath(location.pathname)){history[replace?'replaceState':'pushState']({mordheimunda:true},'',next)}return renderCurrentRoute()}
window.addEventListener('popstate',()=>renderCurrentRoute());
let equipmentTab='band';
let loadoutView='loadout';
let injuryPickerOpen=false;
let lastInjuryRoll=null;
let equipmentCategoryFilter='all';
let equipmentSearch='';
let equipmentOpen=false;
let skillCategory='all';
let fighterTab='skills';
let statsOpen=false;
let progressionOpen=false;
let progressionSubtab='stats';
let magicDomain='all';
let dragFighterIndex=null;
const MAGIC_DOMAINS={
  'Chaos Rituals':['Vision of Torment','Eye of God','Dark Blood','Lure of Chaos','Wings of Darkness','Word of Pain'],
  'Prayers of Sigmar':["Sigmar’s Fiery Hammer",'Beacon of Righteous Virtue','Soulfire','Shield of Faith','Healing Hand','Armour of Righteousness'],
  'Necromancy':['Soul Stealer','Invocation of Nehek','Hellish Vigour','Gaze of Nagash',"Vanhel’s Danse Macabre",'Spell of Awakening'],
  'Lesser Magic':["Fires of U’Zhul",'Flight of Zimmeran','Dread of Aramar','Silver Arrows of Arha','Luck of Shemtek','Flaming Sword of Rhuin'],
  'Magic of the Horned Rat':['Warp Lightning','Skitterleap','Vermintide','Black Fury','Eye of the Warp',"Sorcerer’s Curse"],
  'Prayers of Ulric':["Winter’s Chill",'Ice Blast','Battle Fury',"Ulric’s Gift",'Heart of the Wolf','Call of Ulric'],
  'Prayers of Taal':["Stags Leap",'Blessed Ale','Bears Paw','Earth shudder','Tanglefoot','Summon Squirels'],
  'Power of da Waaagh!':["‘Ere we go!",'The Hand of Gork','Brain Bursta','Fooled Ya!','Fists of Gork','Gaze of Mork']
};
const MAGIC_ACCESS={
  possessed:{'Magister':['Chaos Rituals']},
  witchhunters:{'Witch Hunters':['Prayers of Sigmar'],'Priest of Sigmar':['Prayers of Sigmar']},
  sisters:{'*':['Prayers of Sigmar']},
  undead:{'Necromancer':['Necromancy']},
  skaven:{'Apprentice Greyseer':['Magic of the Horned Rat']},
  orcs:{'Shaman':['Power of da Waaagh!']},
  'blood-dragons':{'Necromancer':['Necromancy']},
  middenheim:{'Priest of Ulric':['Prayers of Ulric']},
  ostland:{'Priest of Taal':['Prayers of Taal']}
};
const factionSigils={reikland:'♜',middenheim:'☽',averland:'⚜',ostland:'♞',possessed:'☿',witchhunters:'†',sisters:'✠',undead:'☠',skaven:'☣',orcs:'☄',dwarfs:'⚒','blood-dragons':'🩸'};
const PROJECT_NAME='Mordheimunda 26';
const RULES=window.MORDHEIMUNDA_RULES||{categories:{skills:[],traits:[],special:[],spells:[],equipment:[]}};
const REFERENCE_CATEGORIES={skills:'Compétences',traits:'Traits d’armes',special:'Règles spéciales',spells:'Sorts & prières',equipment:'Équipement'};
const REFERENCE_CATEGORIES_EN={skills:'Skills',traits:'Weapon traits',special:'Special rules',spells:'Spells & prayers',equipment:'Equipment'};
function referenceCategoryLabel(c){return siteLanguage==='en'?(REFERENCE_CATEGORIES_EN[c]||REFERENCE_CATEGORIES[c]):REFERENCE_CATEGORIES[c];}
let referenceCategory='skills';
let referenceSearch='';
let referenceSourceFilter='all';
function setReferenceSource(v){referenceSourceFilter=v;render('references')}
// Repainting #content (e.g. every background sync re-render) rebuilds the
// account page from its template, and a native <details> element doesn't
// remember its own open/closed state across that — it resets to closed by
// default, which on a phone (where the poll/re-render cycle runs often)
// made the diagnostics panel snap shut every couple of seconds while
// reading it. Track it explicitly like the other UI-open flags below.
let accountDiagOpen=false;
let customEquipmentEditId=null;
let customEquipmentSearch='';
let rulesSearch='';
let rulesOpen='prebattle';
// Which nav theme-groups are collapsed, by group id (see RULES_NAV_GROUPS
// below) — a group is expanded by default, so this only ever holds groups
// the admin/player explicitly closed. The group containing the currently
// open section always renders expanded regardless of this set.
let rulesNavCollapsed=new Set();
// Groups the 14 real RULES_BOOK sections by theme for the Règles nav —
// nothing invented, just the existing sections bucketed so the sidebar
// reads as a handful of themes instead of one long flat list (approved
// "Option B" mockup). Order here is the nav's display order.
const RULES_NAV_GROUPS=[
  {id:'g-prebattle',fr:'1. Séquence de pré-bataille',en:'1. Pre-Battle Sequence',ids:['prebattle'],icon:'⚔',pages:'p.143'},
  {id:'g-structure',fr:'2.1 – 2.3 Structure de partie',en:'2.1 – 2.3 Game Structure',ids:['structure','priority','actionphase','types','actions','movement','endphase'],icon:'☷',pages:'p.11–17, 27'},
  {id:'g-combat',fr:'2.2.4 – 2.2.7 Tir & Corps à corps',en:'2.2.4 – 2.2.7 Shooting & Close Combat',ids:['terrain','shooting','combat','resolve'],icon:'🎯',pages:'p.18–25'},
  {id:'g-psychology',fr:'2.2.8 Psychologie',en:'2.2.8 Psychology',ids:['psychology'],icon:'◎',pages:'p.26'},
  {id:'g-magic',fr:'2.2.9 Magie',en:'2.2.9 Magic',ids:['magic'],icon:'✦',pages:'p.32–42'},
];
// The 8 dice/result tables added to the rulebook (see ruleTableMarkup),
// listed once here so the pinned "quick access" strip at the top of the
// Règles page can jump straight to any of them regardless of which theme
// they live under.
const RULES_QUICK_TABLES=[
  {id:'prebattle',page:143,fr:'Détermination du scénario',en:'Determine Scenario'},
  {id:'terrain',page:19,fr:'Chute (Falling)',en:'Falling'},
  {id:'shooting',page:20,fr:'Tir — BS du tireur',en:'Shooting — BS of Shooter'},
  {id:'combat',page:22,fr:'Corps à corps — jet pour toucher',en:'Close Combat — Hit Roll'},
  {id:'resolve',page:24,fr:'Jet pour blesser',en:'Make Wound Roll'},
  {id:'resolve',page:25,fr:'Table des blessures',en:'Injury Dice Chart'},
  {id:'resolve',page:25,fr:'Blessures durables',en:'Lasting Injuries'},
  {id:'magic',page:34,fr:'Ratés magiques',en:'Magical Miscasts'},
];
function toggleRulesNavGroup(groupId){
  if(rulesNavCollapsed.has(groupId))rulesNavCollapsed.delete(groupId);else rulesNavCollapsed.add(groupId);
  render('rules');
}
function rulesQuickTablesMarkup(en){
  return `<div class="cheat-strip"><div class="cheat-strip-head"><b>⚡ ${en?'Quick access to tables':'Accès rapide aux tableaux'}</b><span>${en?'— jumps straight to the table, wherever it lives':'— saute directement au tableau, où qu’il se trouve'}</span></div><div class="cheat-chips">${RULES_QUICK_TABLES.map(t=>`<button type="button" class="cheat-chip" onclick="jumpToTable('${t.id}',${t.page})"><i>▦</i>${esc(en?t.en:t.fr)}</button>`).join('')}</div></div>`;
}
function jumpToTable(sectionId,page){
  rulesOpen=sectionId;render('rules');
  setTimeout(()=>{const el=document.getElementById('rule-page-'+page);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},60);
}
// Admin-editable corrections layered over the baked-in RULES_BOOK text (see
// /api/rules/overrides). Keyed by "sectionId:page" -> override text. Loaded
// once (lazily, on first visit to Règles) and cached like adminAdminsCache.
let ruleOverridesCache=null,ruleOverridesLoading=false,ruleOverridesEditKey=null;
let customEquipmentTraitDraft=[];
let activeRulePeek=null;
let rulePeekTimer=null;
function refNorm(v){return String(v||'').toLowerCase().replace(/[’‘`]/g,"'").replace(/[^a-z0-9]+/g,'');}
function referenceFind(category,name){const list=referenceEntries(category);const raw=String(name||'').trim();const n=refNorm(raw);let exact=list.find(e=>refNorm(e.name)===n);if(exact)return exact;if(/^Race\s*\(/i.test(raw)){const race=list.find(e=>/^Race\s*\(X\)$/i.test(String(e.name||'')));if(race)return race;}const base=n.replace(/\([^)]*\)/g,'');exact=list.find(e=>refNorm(e.name).replace(/\([^)]*\)/g,'')===base);if(exact)return exact;return list.find(e=>refNorm(e.name).replace(/\([^)]*\)/g,'').startsWith(base)||base.startsWith(refNorm(e.name).replace(/\([^)]*\)/g,'')))||null;}
function referenceCategoryForEquipment(name){return referenceFind('equipment',name)?'equipment':null;}
function refLink(category,name,display=name){const e=referenceFind(category,name);if(!e)return esc(display);const safeCat=esc(category),safeId=esc(e.id);return `<span class="rule-ref" tabindex="0" data-ref-category="${safeCat}" data-ref-id="${safeId}" onmouseenter="showRulePeek(this)" onmouseleave="scheduleHideRulePeek()" onfocus="showRulePeek(this)" onblur="scheduleHideRulePeek()" onclick="toggleRulePeek(this,event)">${esc(display)}</span>`;}
function refLinkByName(name,preferred){if(preferred)return refLink(preferred,name);for(const c of Object.keys(REFERENCE_CATEGORIES)){const e=referenceFind(c,name);if(e)return refLink(c,name)}return esc(name);}
function refInfo(category,name){const e=referenceFind(category,name);if(!e)return '';return `<button type="button" class="rule-ref-info" aria-label="Voir la règle ${esc(e.name)}" data-ref-category="${esc(category)}" data-ref-id="${esc(e.id)}" onmouseenter="showRulePeek(this)" onmouseleave="scheduleHideRulePeek()" onfocus="showRulePeek(this)" onblur="scheduleHideRulePeek()" onclick="toggleRulePeek(this,event)">ⓘ</button>`;}
function rulePeekSummary(rawText){const lines=stripCustomTextMarkup(String(rawText||'')).split(/\n+/).map(x=>x.trim()).filter(Boolean);let text=lines.slice(0,5).join(' ');if(text.length>430)text=text.slice(0,427).replace(/\s+\S*$/,'')+'…';return text||'Aucun texte de règle enregistré.';}
function rulePeekTitle(cat){return REFERENCE_CATEGORIES[cat]||'Référence';}
function positionRulePeek(el){const pop=$('#rulePeek');if(!pop)return;const r=el.getBoundingClientRect(),pw=Math.min(420,window.innerWidth-24),ph=pop.offsetHeight;let left=Math.min(Math.max(12,r.left),window.innerWidth-pw-12),top=r.bottom+10;if(top+ph>window.innerHeight-12)top=r.top-ph-10;if(top<12)top=12;pop.style.left=left+'px';pop.style.top=top+'px';pop.style.width=pw+'px';}
function showRulePeek(el){clearTimeout(rulePeekTimer);activeRulePeek=el;const cat=el.dataset.refCategory,id=el.dataset.refId,e=referenceEntries(cat).find(x=>x.id===id);if(!e)return;
  // Same override layer as the Règles/Référentiel tabs (referenceEntryMarkup) —
  // without this, a fighter-card hover/click peek always showed the stale
  // baked-in RULES_BOOK text even after an admin corrected the rule, since
  // this popup used to read e.text directly and never consulted overrides.
  if(ruleOverridesCache===null)loadRuleOverrides();
  const sectionId=referenceOverrideSectionId(cat,id);
  const override=ruleEffectiveText(sectionId,0);
  const text=override!=null?override:e.text;
  let pop=$('#rulePeek');if(!pop){pop=document.createElement('div');pop.id='rulePeek';pop.className='rule-peek';pop.onmouseenter=cancelHideRulePeek;pop.onmouseleave=scheduleHideRulePeek;document.body.appendChild(pop)}pop.innerHTML=`<div class="rule-peek-kicker">${esc(rulePeekTitle(cat))}</div><strong>${esc(e.name)}</strong><p>${esc(rulePeekSummary(text))}</p><button type="button" class="rule-peek-open" onclick="openReferenceFromPeek(event)">${e.lines>5?'Voir la règle complète →':'Ouvrir dans le référentiel →'}</button>`;pop.classList.add('visible');requestAnimationFrame(()=>positionRulePeek(el));}
function toggleRulePeek(el,event){event?.stopPropagation();if(window.matchMedia?.('(hover: none)').matches){showRulePeek(el);return}if(activeRulePeek===el&&$('#rulePeek')?.classList.contains('visible')){const pop=$('#rulePeek');pop.classList.remove('visible');activeRulePeek=null;return}showRulePeek(el);}
function cancelHideRulePeek(){clearTimeout(rulePeekTimer)}
function scheduleHideRulePeek(){if(window.matchMedia?.('(hover: none)').matches)return;clearTimeout(rulePeekTimer);rulePeekTimer=setTimeout(()=>{const pop=$('#rulePeek');if(pop)pop.classList.remove('visible');activeRulePeek=null},180)}
function openReferenceFromPeek(event){event?.stopPropagation();const el=activeRulePeek;if(!el)return;openReference(el.dataset.refCategory,el.dataset.refId);}
function openReference(category='skills',id=''){referenceCategory=category;referenceSearch='';const pop=$('#rulePeek');if(pop)pop.classList.remove('visible');render('references');setTimeout(()=>{const target=id?document.getElementById('ref-entry-'+id):null;if(target)target.scrollIntoView({behavior:'smooth',block:'start'});},60)}
// Lightweight inline formatting for the Custom tab's own text fields (fighter
// / warband descriptions, custom skill·spell·special-rule text, custom
// equipment rules text): a small **bold**/*italic*/size/color syntax, with a
// toolbar (below) that inserts it so nobody has to type it by hand. Colors
// are drawn straight from the site's own palette (the action-card status
// colors plus the green accent and the admin orange) so anything typed here
// reads as native to the site rather than an arbitrary rich-text color.
const CUSTOM_TEXT_COLORS=[
  {id:'blue',hex:'#4a9dff',fr:'Bleu',en:'Blue'},
  {id:'yellow',hex:'#e8c547',fr:'Jaune',en:'Yellow'},
  {id:'red',hex:'#ff4d6d',fr:'Rouge',en:'Red'},
  {id:'violet',hex:'#c23fd6',fr:'Violet',en:'Violet'},
  {id:'green',hex:'#9dfa3c',fr:'Vert',en:'Green'},
  {id:'orange',hex:'#e0895a',fr:'Orange',en:'Orange'}
];
function customTextMarkup(text){
  const raw=String(text||'');
  if(!raw.trim())return '';
  let safe=esc(raw);
  // Color spans first, so **bold** etc. can still be nested inside them.
  CUSTOM_TEXT_COLORS.forEach(c=>{
    const re=new RegExp(`\\{\\{${c.id}\\}\\}([\\s\\S]*?)\\{\\{/${c.id}\\}\\}`,'g');
    safe=safe.replace(re,(m,inner)=>`<span class="ctm-color" style="color:${c.hex}">${inner}</span>`);
  });
  safe=safe.replace(/\{\{big\}\}([\s\S]*?)\{\{\/big\}\}/g,'<span class="ctm-big">$1</span>');
  safe=safe.replace(/\{\{small\}\}([\s\S]*?)\{\{\/small\}\}/g,'<span class="ctm-small">$1</span>');
  safe=safe.replace(/\*\*([\s\S]+?)\*\*/g,'<strong>$1</strong>');
  safe=safe.replace(/\*([^*\n]+?)\*/g,'<em>$1</em>');
  return safe.replace(/\r?\n/g,'<br>');
}
// For compact single-line previews (armory table row, search haystacks)
// where full markup would either be noise or has already been stripped by
// esc() escaping — drop the syntax tokens instead of rendering them.
function stripCustomTextMarkup(text){
  return String(text||'').replace(/\{\{\/?[a-z]+\}\}/g,'').replace(/\*\*?/g,'');
}
function referenceTextMarkup(text){return customTextMarkup(text);}
// Shared quick-formatting toolbar for every Custom-tab text field (fighter/
// warband descriptions, custom skill·spell·special-rule text, custom
// equipment rules). One generic textarea-id-driven insert function powers
// all of them, mirroring insertRuleEditToken's wrap-the-selection approach
// used for the Règles tab editor.
function customTextToolbarMarkup(textareaId){
  const en=siteLanguage==='en';
  const swatches=CUSTOM_TEXT_COLORS.map(c=>`<button type="button" class="ctm-tool ctm-swatch" style="--sw:${c.hex}" onclick="insertCustomTextToken('${textareaId}','color','${c.id}')" title="${esc(en?c.en:c.fr)}"></button>`).join('');
  return `<div class="ctm-toolbar">
   <button type="button" class="ctm-tool ctm-tool-bold" onclick="insertCustomTextToken('${textareaId}','bold')" title="${en?'Bold':'Gras'}">G</button>
   <button type="button" class="ctm-tool ctm-tool-italic" onclick="insertCustomTextToken('${textareaId}','italic')" title="${en?'Italic':'Italique'}">I</button>
   <button type="button" class="ctm-tool ctm-tool-big" onclick="insertCustomTextToken('${textareaId}','big')" title="${en?'Larger text':'Texte plus grand'}">A+</button>
   <button type="button" class="ctm-tool ctm-tool-small" onclick="insertCustomTextToken('${textareaId}','small')" title="${en?'Smaller text':'Texte plus petit'}">A−</button>
   <span class="ctm-sep"></span>
   ${swatches}
   <span class="ctm-hint">${en?'Select text, then click a button to format it.':'Sélectionne du texte puis clique sur un bouton pour le mettre en forme.'}</span>
  </div>`;
}
function insertCustomTextToken(textareaId,kind,colorId){
  const el=document.getElementById(textareaId);
  if(!el)return;
  const start=el.selectionStart??el.value.length,end=el.selectionEnd??el.value.length;
  const before=el.value.slice(0,start),after=el.value.slice(end);
  const en=siteLanguage==='en';
  const selected=el.value.slice(start,end)||(en?'text':'texte');
  let open,close;
  if(kind==='bold'){open='**';close='**';}
  else if(kind==='italic'){open='*';close='*';}
  else if(kind==='big'){open='{{big}}';close='{{/big}}';}
  else if(kind==='small'){open='{{small}}';close='{{/small}}';}
  else if(kind==='color'&&colorId){open=`{{${colorId}}}`;close=`{{/${colorId}}}`;}
  else return;
  el.value=before+open+selected+close+after;
  el.focus();
  el.setSelectionRange(before.length+open.length,before.length+open.length+selected.length);
}
// Reference entries (skills, spells, gear, special rules, traits) are keyed
// by category+id rather than section+page, but reuse the exact same
// rule_overrides table/API as the Règles tab's paragraph edits — a synthetic
// sectionId ('ref:<cat>:<id>', page 0) keeps the two namespaces from ever
// colliding while sharing one cache, one save/restore flow and one bit of
// backend code.
function referenceOverrideSectionId(cat,id){return `ref:${cat}:${id}`}
function referenceEntryMarkup(e,cat){const short=e.lines<=5;const sectionId=referenceOverrideSectionId(cat,e.id);const override=ruleEffectiveText(sectionId,0);const text=override!=null?override:e.text;const canEdit=isAdminSession();const isEditing=canEdit&&ruleOverridesEditKey===ruleOverrideKey(sectionId,0);const editBtn=canEdit?`<button type="button" class="rule-edit-btn" title="Modifier cette entrée (admin)" onclick="openRuleEdit('${esc(sectionId)}',0);event.stopPropagation()">✎ ${override!=null?'Modifié':'Modifier'}</button>`:'';return `<article class="ref-entry" id="ref-entry-${esc(e.id)}"><div class="rh"><span class="rname">${esc(e.name)}</span>${e.category?`<span class="rtree">${esc(e.category)}</span>`:''}${override!=null?'<span class="rule-override-tag">CORRIGÉ</span>':''}${editBtn}<button type="button" class="reference-peek-button" onclick="openReference('${cat}','${e.id}');event.stopPropagation()">ⓘ</button></div>${isEditing?ruleEditFormMarkup(sectionId,0,text):`<div class="rtext">${referenceTextMarkup(text)}</div>`}<div class="rsource">${e.custom?'<span class="tag offi">Personnalisé</span>':'<span class="tag book">Livre de base</span>'}${e.source?esc(e.source):''}</div>${!short?`<div class="reference-entry-meta">Règle complète · ${e.lines} lignes dans la source</div>`:''}</article>`;}
function referenceFilteredList(cat,q,src){let list=referenceEntries(cat);if(src==='book')list=list.filter(e=>!e.custom);else if(src==='custom')list=list.filter(e=>e.custom);if(q)list=list.filter(e=>(e.name+' '+e.text).toLowerCase().includes(q));return list;}
// Spell cards — the "spells" category was a wall of small, unbroken
// paragraphs (the source PDF extraction runs several spells' text together
// with no separation), which made it hard to scan. Compact cards, one per
// spell, in the same visual family as the Actions cards: a colored tag per
// magic domain/prayer-list (derived from the existing `category` field,
// already used for Référentiel's domain badge), the casting value pulled out
// of the source text into its own badge, and the description cleaned of the
// duplicate "<value> <name>" line the raw text always starts with.
const SPELL_DOMAIN_PALETTE=['#9dfa3c','#4a9dff','#e8c547','#ff4d6d','#c23fd6','#e0895a','#79b890','#6fb8ff','#f0a868','#8fd6c2'];
function spellDomainColor(domain){
  const s=String(domain||'');let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
  return SPELL_DOMAIN_PALETTE[h%SPELL_DOMAIN_PALETTE.length];
}
function spellCastValue(sp){const m=String(sp?.text||'').match(/^\s*(\d+)\s+/);return m?m[1]:'';}
function spellDifficultyLabel(sp){const m=String(sp?.text||'').match(/Difficulty\s*[+-]?\d+[^\n,.]*/i);return m?m[0].trim():'';}
function spellCardDescription(sp){
  const lines=String(sp?.text||'').split(/\r?\n/);
  // Drop the leading "<value> <name>" duplicate line, and a following bare
  // difficulty line (already surfaced as its own badge), if present.
  if(lines.length&&normName(lines[0]).includes(normName(sp?.name||'')))lines.shift();
  if(lines.length&&/^Difficulty\s*[+-]?\d+/i.test(lines[0].trim()))lines.shift();
  return lines.join('\n').trim();
}
function spellCardMarkup(e,cat){
  const en=siteLanguage==='en';
  const sectionId=referenceOverrideSectionId(cat,e.id);
  const override=ruleEffectiveText(sectionId,0);
  const rawText=override!=null?override:e.text;
  const canEdit=isAdminSession();
  const isEditing=canEdit&&ruleOverridesEditKey===ruleOverrideKey(sectionId,0);
  const editBtn=canEdit?`<button type="button" class="rule-edit-btn" title="${en?'Edit this entry (admin)':'Modifier cette entrée (admin)'}" onclick="openRuleEdit('${esc(sectionId)}',0);event.stopPropagation()">✎ ${override!=null?(en?'Edited':'Modifié'):(en?'Edit':'Modifier')}</button>`:'';
  const value=spellCastValue(e);
  const difficulty=spellDifficultyLabel(e);
  const domain=e.category||'';
  const color=spellDomainColor(domain);
  const desc=customTextMarkup(spellCardDescription({...e,text:rawText}));
  return `<article class="spell-card" id="ref-entry-${esc(e.id)}" style="--sc:${color}" data-name="${esc(String(e.name||'').toLowerCase())}" data-domain="${esc(String(domain||'').toLowerCase())}">
    <div class="sc-head"><span class="sc-name">${esc(e.name)}</span>${value?`<span class="sc-value" title="${en?'Casting value':'Valeur de lancement'}">${esc(value)}</span>`:''}</div>
    ${domain?`<div class="sc-domain">${esc(domain)}</div>`:''}
    <div class="sc-meta">${difficulty?`<span class="sc-diff">${esc(difficulty)}</span>`:''}${override!=null?`<span class="rule-override-tag">${en?'CORRECTED':'CORRIGÉ'}</span>`:''}${editBtn}<button type="button" class="reference-peek-button" onclick="openReference('${cat}','${e.id}');event.stopPropagation()">ⓘ</button></div>
    ${isEditing?ruleEditFormMarkup(sectionId,0,rawText):`<div class="sc-desc">${desc}</div>`}
    <div class="rsource">${e.custom?`<span class="tag offi">${en?'Custom':'Personnalisé'}</span>`:`<span class="tag book">${en?'Core book':'Livre de base'}</span>`}${e.source?esc(e.source):''}</div>
  </article>`;
}
function spellCardsGridMarkup(list,cat){
  const en=siteLanguage==='en';
  if(!list.length)return `<div class="empty large"><strong>${en?'No entry.':'Aucune entrée.'}</strong><span>${en?'Try another search term.':'Essaie un autre terme de recherche.'}</span></div>`;
  return `<div class="spell-cards">${list.map(e=>spellCardMarkup(e,cat)).join('')}</div>`;
}
// The Règles "2.2.9 Magic" section is otherwise just its raw book-page prose
// (the domain intro paragraphs) — this appends the same spell-card gallery
// used in the Référentiel right after that prose, with its own search box,
// so a spell can be found and read without leaving the Règles page.
function filterMagicSpellCards(q){
  const query=String(q||'').trim().toLowerCase();
  document.querySelectorAll('#magicSpellGallery .spell-card').forEach(card=>{
    const hay=`${card.dataset.name||''} ${card.dataset.domain||''}`;
    card.classList.toggle('sc-hidden',!!query&&!hay.includes(query));
  });
}
function magicSpellGalleryMarkup(en){
  const spells=referenceEntries('spells');
  return `<div class="section-label" style="margin-top:22px">${en?'Spells & prayers':'Sorts & prières'} <span class="src">— ${spells.length} ${en?'entries':'entrées'}</span></div>
  <div class="actions-toolbar"><input class="actions-search" type="text" placeholder="${en?'Search a spell…':'Rechercher un sort…'}" oninput="filterMagicSpellCards(this.value)"></div>
  <div id="magicSpellGallery">${spellCardsGridMarkup(spells,'spells')}</div>`;
}
function references(){if(ruleOverridesCache===null)loadRuleOverrides();const en=siteLanguage==='en';const cats=Object.keys(REFERENCE_CATEGORIES),full=referenceEntries(referenceCategory);const q=referenceSearch.trim().toLowerCase();const filtered=referenceFilteredList(referenceCategory,q,referenceSourceFilter);const totalBook=full.filter(e=>!e.custom).length,totalCustom=full.filter(e=>e.custom).length;
const isSpells=referenceCategory==='spells';
$('#content').innerHTML=`<div class="ref-page">
<div class="rules-head"><h1 class="rules-page-title">${en?'Reference':'Référentiel'}</h1><p>${en?'All skills, spells, gear, special rules and traits — quick search by name, sorted by category.':'Toutes les compétences, sorts, objets, règles spéciales et traits — recherche rapide par nom, classées par catégorie.'}</p></div>
<div class="ref-intro"><p>${en?'The Reference gathers everything ':'Le Référentiel regroupe tout ce qui est '}<b>${en?'official':'officiel'}</b>${en?': the core book rules and any custom rule officialized by an admin.':' : les règles du livre de base et toute règle personnalisée officialisée par un admin.'} <a href="#" onclick="render('codex');return false;">${en?'Open the full book →':'Ouvrir le livre complet →'}</a></p></div>
<div class="ref-tabs">${cats.map(c=>`<button type="button" class="ref-tab ${referenceCategory===c?'active':''}" onclick="setReferenceCategory('${c}')">${esc(referenceCategoryLabel(c))} <span class="n">${referenceEntries(c).length}</span></button>`).join('')}</div>
<input class="ref-search" type="text" value="${esc(referenceSearch)}" placeholder="${en?'Search an entry…':'Rechercher une entrée…'}" oninput="setReferenceSearch(this.value)">
<div class="ref-source-filters"><span class="lbl">${en?'Source':'Source'}</span><span class="ref-src-chip ${referenceSourceFilter==='all'?'active':''}" onclick="setReferenceSource('all')">${en?'All':'Tout'} (${full.length})</span><span class="ref-src-chip ${referenceSourceFilter==='book'?'active':''}" onclick="setReferenceSource('book')">${en?'Core book':'Livre de base'} (${totalBook})</span><span class="ref-src-chip ${referenceSourceFilter==='custom'?'active':''}" onclick="setReferenceSource('custom')">${en?'Custom':'Personnalisé'} (${totalCustom})</span></div>
<div class="reference-list">${isSpells?spellCardsGridMarkup(filtered,referenceCategory):(filtered.length?filtered.map(e=>referenceEntryMarkup(e,referenceCategory)).join(''):`<div class="empty large"><strong>${en?'No entry.':'Aucune entrée.'}</strong><span>${en?'Try another search term.':'Essaie un autre terme de recherche.'}</span></div>`)}</div>
</div>`}
function setReferenceCategory(c){referenceCategory=c;referenceSearch='';render('references')}
function setReferenceSearch(v){referenceSearch=v;const q=v.trim().toLowerCase();const filtered=referenceFilteredList(referenceCategory,q,referenceSourceFilter);const en=siteLanguage==='en';const sec=$('.reference-list');if(sec)sec.innerHTML=referenceCategory==='spells'?spellCardsGridMarkup(filtered,referenceCategory):(filtered.length?filtered.map(e=>referenceEntryMarkup(e,referenceCategory)).join(''):`<div class="empty large"><strong>${en?'No entry.':'Aucune entrée.'}</strong><span>${en?'Try another search term.':'Essaie un autre terme de recherche.'}</span></div>`)}
function refTraitList(traits){if(!traits||traits==='—')return esc(traits||'—');return String(traits).split(/,\s*/).map(t=>refLinkByName(t,'traits')).join(', ');}
// Defense in depth for the BIGINT-as-string issue fixed server-side (see
// server.js): the API now always returns `revision` as a real number, but
// this coerces a numeric string too, so a client that still has an old
// string-typed cloudRevision cached locally (from before that fix) self-
// heals on its very next read instead of staying permanently stuck.
function toRev(x){const n=typeof x==='string'?parseInt(x,10):x;return Number.isInteger(n)?n:null;}
// Cross-device sync bug fix: mergeAccountData (below) used to be a pure
// union-by-id merge with no concept of deletion — an id present on one side
// and absent on the other was always treated as "not created there yet",
// never as "deleted there". So deleting a warband (or any custom content)
// on device A, then syncing from device B before B had pulled that
// deletion, would resurrect it: B's merge saw the id only in the remote
// copy it fetched pre-deletion (or in its own stale local copy) and held
// onto it. Every delete site now calls markDeleted() to leave a tombstone
// (id + timestamp) in state.deleted; mergeAccountData unions tombstones
// from both sides and drops any item whose id has a tombstone at least as
// new as the item's own updatedAt, so a real deletion sticks across
// devices instead of quietly reappearing.
function markDeleted(key,id){
  if(id==null)return;
  state.deleted=state.deleted||{};
  state.deleted[key]=state.deleted[key]||{};
  state.deleted[key][String(id)]=Date.now();
}
function save(silent=false){
  if(!Array.isArray(state.customEquipment))state.customEquipment=[];
  // Stamp whichever roster is currently open so a cross-device merge (see
  // mergeAccountData) can tell which side's edit to that same roster is
  // newer, instead of blindly letting one side win by array position. Every
  // roster-editing action already routes through activeRoster()/state.active
  // before calling save(), so this single choke point covers them all.
  const activeR=Array.isArray(state.rosters)?state.rosters.find(r=>r?.id===state.active):null;
  if(activeR)activeR.updatedAt=Date.now();
  state.meta=state.meta||{};
  if(cloudIsSignedIn()) state.meta.cloudDirty=true;
  state=window.MordheimundaStorage.save(state);
  queueCloudSave();
  if(!silent)toast(siteLanguage==='en'?'Data saved':'Données sauvegardées');
}
let cloudSaveTimer=null,cloudSaveBusy=false,cloudSaveAgain=false,cloudRetryTimer=null,cloudRetryAttempt=0;
// Not persisted (deliberately — it's diagnostic, not app data): the most
// recent sync failure, so it's visible in the account page's diagnostics
// panel even on a phone with no console access. Without this, a stuck
// "unsaved local edits" reads as an unexplained black box from the phone.
let lastCloudError=null;
function recordCloudError(where,e){lastCloudError={where,status:e?.status??null,message:String(e?.message||e||'?'),at:new Date().toISOString()};}
function clearCloudError(){lastCloudError=null;}
let cloudPollTimer=null,cloudPollBusy=false,pendingRemoteRerender=false;
function cloudIsSignedIn(){return !!accountSession();}
// Every action that changes something (recruiting a fighter, creating a
// custom item, editing a roster, etc.) already calls save() right after
// mutating state. Previously this then waited a fixed 500ms before actually
// sending it to the server. That delay is gone: the save fires on the very
// next tick after the action, so the transmission is driven by the action
// itself, not by a timer. (delay is still accepted for the rare caller that
// wants to coalesce several back-to-back mutations, e.g. drag interactions.)
function queueCloudSave(delay=0){
  if(!cloudIsSignedIn())return;
  clearTimeout(cloudSaveTimer);
  clearTimeout(cloudRetryTimer);
  cloudSaveTimer=setTimeout(flushCloudSave,Math.max(0,delay));
}
// Two devices that are both dirty at the same time can each fetch the
// latest revision, merge their own edit on top, and push back — and if
// both pushes land in the same window, both lose the optimistic-concurrency
// race and retry. With a purely exponential (non-jittered) delay, two
// devices whose retries happen to be in step can keep re-colliding on
// every single attempt, forever — reproduced live: two concurrent
// fetch/merge/push loops with no jitter starved each other on 15/15
// attempts each. Jitter spreads retries apart so they stop colliding.
function cloudRetryDelay(attempt,base){
  const capped=Math.min(30000,base*Math.pow(2,attempt));
  return Math.round(capped*0.5+Math.random()*capped*0.5);
}
async function flushCloudSave(){
  if(!cloudIsSignedIn())return;
  if(cloudSaveBusy){cloudSaveAgain=true;return}
  cloudSaveBusy=true;
  try{
    const expectedRevision=toRev(state?.meta?.cloudRevision);
    const result=await window.MordheimundaAPI.saveData(state,expectedRevision);
    state.meta=state.meta||{};
    state.meta.cloudRevision=result.revision;
    state.meta.cloudUpdatedAt=new Date().toISOString();
    state.meta.cloudDirty=false;
    state=window.MordheimundaStorage.save(state);
    cloudRetryAttempt=0;
    cloudSaveAgain=false;
    clearCloudError();
  }catch(e){
    console.warn('Cloud save failed',e);
    recordCloudError('flushCloudSave',e);
    if(e.status===409){
      await resolveCloudConflictAndRetry();
    }else if(e.status===401){
      localStorage.removeItem(ACCOUNT_SESSION_KEY);
      stopCloudPolling();
    }else{
      cloudSaveAgain=true;
      const delay=cloudRetryDelay(cloudRetryAttempt++,1000);
      clearTimeout(cloudRetryTimer);
      cloudRetryTimer=setTimeout(flushCloudSave,delay);
    }
  }finally{
    cloudSaveBusy=false;
    if(cloudSaveAgain&&!cloudRetryTimer)queueCloudSave(1000);
  }
}
async function resolveCloudConflictAndRetry(){
  try{
    const remote=await window.MordheimundaAPI.loadData();
    const remoteData=remote?.payload||{};
    const remoteRevision=toRev(remote?.revision)??1;
    // The other device's data is the new baseline; the mutation we were mid-way
    // through sending is layered back on top so it is not silently lost.
    state=mergeAccountData(remoteData,state);
    state.meta=state.meta||{};state.meta.cloudRevision=remoteRevision;
    state=window.MordheimundaStorage.save(state);
    scheduleRemoteRerender();
    const saved=await window.MordheimundaAPI.saveData(state,remoteRevision);
    state.meta.cloudRevision=saved.revision;
    state.meta.cloudDirty=false;
    window.MordheimundaStorage.save(state);
    cloudRetryAttempt=0;
    cloudSaveAgain=false;
    clearCloudError();
  }catch(e){
    console.warn('Cloud conflict resolution failed',e);
    recordCloudError('resolveCloudConflictAndRetry',e);
    cloudSaveAgain=true;
    // Only announce the very first retry of a storm — with jittered backoff
    // a storm can still take a few attempts to clear on a slow network, and
    // repeating this toast on every single attempt turned what should be a
    // quiet background retry into a wall of identical toasts.
    if(cloudRetryAttempt===0)toast(siteLanguage==='en'?'Cloud sync will retry automatically':'La synchronisation cloud va réessayer automatiquement');
    const delay=cloudRetryDelay(cloudRetryAttempt++,1500);
    clearTimeout(cloudRetryTimer);
    cloudRetryTimer=setTimeout(flushCloudSave,delay);
  }
}
function mergeAccountData(local,remote){
  const out=structuredClone(local||{});const r=remote||{};
  const idKeyFor=(key,x)=>{
    if(x&&typeof x==='object'){
      if('id' in x)return 'id';
      if('customFighterId' in x)return 'customFighterId';
      if('customEquipmentId' in x)return 'customEquipmentId';
      if('customContentId' in x)return 'customContentId';
    }
    return null;
  };
  const keys=['rosters','customFighters','customEquipment','customSkills','customSpells','customTraits','customSpecialRules','customSkillTrees','customMagicDomains','customWarbands','customContent'];
  // Union each side's deletion tombstones first (see markDeleted) so the
  // item merge below can tell a genuine deletion apart from an id that
  // simply hasn't reached the other side yet.
  const mergedDeleted={};
  keys.forEach(k=>{
    const a=(local?.deleted||{})[k]||{},b=(r?.deleted||{})[k]||{};
    const md={...a};
    Object.keys(b).forEach(id=>{md[id]=Math.max(md[id]||0,b[id]);});
    mergedDeleted[k]=md;
  });
  const merge=(key,a,b)=>{
    const m=new Map();
    const deletedMap=mergedDeleted[key]||{};
    [...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])].forEach(x=>{
      const idKey=idKeyFor(key,x);
      const id=idKey?x[idKey]:null;
      if(id==null)return;
      const sid=String(id);
      // A tombstone at least as new as this copy's own edit means it was
      // deleted after (or without ever getting) a newer edit anywhere else
      // — drop it rather than letting the union bring it back to life.
      const delAt=deletedMap[sid];
      if(delAt&&delAt>=(x?.updatedAt||0))return;
      const prev=m.get(sid);
      if(!prev){m.set(sid,x);return;}
      // Both sides can hold their own edit to the same id (e.g. a roster
      // changed on two devices before they last synced). Without a way to
      // tell which edit is newer, whichever array position happened to be
      // processed last always won — silently discarding real edits made on
      // the other device. Prefer the item stamped with the more recent
      // updatedAt; items with no stamp (older data, or content that's never
      // edited in place) fall back to the previous last-wins behavior.
      const prevAt=prev?.updatedAt||0,xAt=x?.updatedAt||0;
      if(xAt>=prevAt)m.set(sid,x);
    });
    return [...m.values()];
  };
  keys.forEach(k=>out[k]=merge(k,local?.[k],r?.[k]));
  out.deleted=mergedDeleted;
  if(!out.active&&r.active)out.active=r.active;
  out.meta={...(local?.meta||{}),...(r?.meta||{}),updatedAt:new Date().toISOString()};
  return out;
}
function currentViewName(){return parseAppRoute().view||'dashboard';}
function isEditingField(){const el=document.activeElement;return !!el&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)&&document.getElementById('content')?.contains(el);}
function scheduleRemoteRerender(){
  if(isEditingField()){pendingRemoteRerender=true;return}
  pendingRemoteRerender=false;
  // Repainting the app replaces #content. On mobile that can make the
  // browser jump the document back to the top even though the user has not
  // navigated anywhere. Preserve the current scroll position for background
  // sync refreshes; explicit navigation still gets its normal top-of-page
  // behavior.
  const y=window.scrollY||window.pageYOffset||0;
  render(currentViewName(),{history:false});
  requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'}));
}
/* Applies a payload fetched from the server, then repaints the screen so a
   change made on another device shows up without a manual reload.
   This used to treat the server as the sole source of truth and replace
   local state outright — correct ONLY if `cloudDirty` reliably means "this
   device's local copy is fully reflected on the server". It doesn't:
   cloudDirty can be false (this device's last push once succeeded) while
   the server has since lost that content anyway — another device's write,
   or the historical null-revision overwrite bug, can erase server-side
   data a device is still holding locally without ever marking that device
   dirty again. This is called only when the caller already believes there
   are no local edits to protect, so in the ordinary case merging is a
   no-op; the case it actually guards against is exactly the one that was
   reproduced live: a background pull silently deleting a custom warband
   that only existed on this device's local copy, the moment the app
   polled while the tab was open. A union merge can only add content, never
   remove it, so that can no longer happen — at the cost of a genuine
   cross-device deletion needing to be repeated on each device rather than
   propagating automatically, which is the safer trade-off here. */
function applyRemoteData(remoteData,remoteRevision,{announce=false}={}){
  const keepMeta=state?.meta||{};
  const next=mergeAccountData(remoteData||{rosters:[],active:null},state||{});
  next.meta={...keepMeta,cloudRevision:toRev(remoteRevision)??keepMeta.cloudRevision,cloudUpdatedAt:new Date().toISOString()};
  state=window.MordheimundaStorage.save(next);
  scheduleRemoteRerender();
  if(announce)toast(siteLanguage==='en'?'Synced from your other device':'Synchronisé depuis votre autre appareil');
}
async function pollCloudRevision(){
  // A background pull must never win a race against this device's own
  // push: if a save is in flight, queued, or there are local edits not yet
  // confirmed by the server (cloudDirty), the server's snapshot could be
  // older than what's already on screen. Applying it then would silently
  // revert the just-made change until the next successful save corrects it
  // again — the flicker/rollback this was causing. So the poll only ever
  // pulls when this device has nothing outstanding to push.
  if(!cloudIsSignedIn()||document.hidden||cloudPollBusy||cloudSaveBusy||hasUnsavedLocalEdits())return;
  cloudPollBusy=true;
  try{
    const r=await window.MordheimundaAPI.dataRevision();
    const remoteRevision=toRev(r?.revision);
    const localRevision=toRev(state?.meta?.cloudRevision);
    // Re-check right before applying: a save can have started while the
    // revision request above was in flight.
    if(remoteRevision!==null&&(localRevision===null||remoteRevision>localRevision)&&!cloudSaveBusy&&!hasUnsavedLocalEdits()){
      const full=await window.MordheimundaAPI.loadData();
      if(!cloudSaveBusy&&!hasUnsavedLocalEdits())applyRemoteData(full?.payload,full?.revision,{announce:true});
    }else if(pendingRemoteRerender&&!isEditingField()){
      pendingRemoteRerender=false;
      const y=window.scrollY||window.pageYOffset||0;
      render(currentViewName(),{history:false});
      requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'}));
    }
  }catch(e){
    if(e.status===401){localStorage.removeItem(ACCOUNT_SESSION_KEY);stopCloudPolling();}
    else console.warn('Cloud poll failed',e);
  }finally{cloudPollBusy=false;}
}
function startCloudPolling(){
  stopCloudPolling();
  pollCloudRevision();
  cloudPollTimer=setInterval(pollCloudRevision,3000);
}
function stopCloudPolling(){if(cloudPollTimer){clearInterval(cloudPollTimer);cloudPollTimer=null}}
// These triggers used to unconditionally push this tab's in-memory `state`
// to the server (flushCloudSave/queueCloudSave) whenever the tab regained
// focus, came back online, or was closed — even when this tab had no local
// edits at all. A second tab/device left open with an older (or empty)
// snapshot would then silently overwrite whatever another, more current
// tab/device had just saved, the moment it regained focus. Now these only
// ever *pull* (pollCloudRevision) unconditionally; they only *push* when
// this tab actually has unsaved local edits (state.meta.cloudDirty).
const hasUnsavedLocalEdits=()=>!!state?.meta?.cloudDirty;
// A save that just hit a conflict is already backing off on its own schedule
// (cloudRetryTimer, with jitter — see cloudRetryDelay). On a phone, `focus`
// fires far more often than on desktop: switching apps, the screen locking/
// unlocking, a notification banner, all of it. Previously every one of
// those calls went straight through to queueCloudSave(), which unconditionally
// clears cloudRetryTimer and fires immediately (delay 0) — so on a phone,
// ambient focus churn was overriding the backoff on nearly every attempt
// and turning a handful of retries into a continuous 409 storm (confirmed
// live: the repeating failures traced straight back to this focus listener).
// These ambient triggers now defer to a retry/backoff already in flight
// instead of restarting it.
const hasPendingCloudRetry=()=>cloudSaveBusy||!!cloudRetryTimer;
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollCloudRevision()});
window.addEventListener('online',()=>{pollCloudRevision();if(cloudIsSignedIn()&&hasUnsavedLocalEdits()&&!hasPendingCloudRetry())flushCloudSave();});
window.addEventListener('focus',()=>{pollCloudRevision();if(cloudIsSignedIn()&&hasUnsavedLocalEdits()&&!hasPendingCloudRetry())queueCloudSave();});
window.addEventListener('pagehide',()=>{if(cloudIsSignedIn()&&hasUnsavedLocalEdits()&&!hasPendingCloudRetry())flushCloudSave();});
async function syncAccountAfterLogin(user){
  localStorage.setItem(ACCOUNT_SESSION_KEY,JSON.stringify(user));
  refreshAdminNavVisibility();
  try{
    const remote=await window.MordheimundaAPI.loadData();
    const remoteData=remote?.payload||{};
    const remoteRevision=toRev(remote?.revision)??1;
    const hasLocal=Array.isArray(state.rosters)&&state.rosters.length>0;
    const hasRemote=Array.isArray(remoteData.rosters)&&remoteData.rosters.length>0;
    if(hasRemote&&!hasLocal){
      // Nothing local worth keeping: the server's copy simply becomes the
      // new baseline. A pure pull, so there's nothing to push.
      applyRemoteData(remoteData,remoteRevision);
      state.meta.accountUserId=user.id;window.MordheimundaStorage.save(state);
    }else{
      // Either this device has local content to reconcile with the
      // server's copy, or the account has nothing on either side yet and
      // still needs its very first save. Either way, the actual write to
      // the server goes through flushCloudSave — the single gated path
      // every other save in the app uses — instead of calling saveData()
      // directly here. Writing here AND from a normal user action
      // (e.g. creating a warband right after signing up) at the same time
      // used to race each other and produce a burst of 409 conflicts with
      // no other device involved at all.
      if(hasLocal&&hasRemote){
        // Both sides have content the first time this device links to the
        // account: combine them once instead of picking a winner.
        state=mergeAccountData(state,remoteData);
      }
      state.meta=state.meta||{};
      state.meta.accountUserId=user.id;
      state.meta.cloudRevision=remoteRevision;
      state.meta.cloudDirty=true;
      state=window.MordheimundaStorage.save(state);
      await flushCloudSave();
    }
    startCloudPolling();
    return true;
  }catch(e){console.warn('Cloud sync failed',e);return false;}
}

function imageFocusStyle(focus){
 if(!focus||typeof focus!=='object')return '';
 const x=Math.max(0,Math.min(100,(Number.isFinite(Number(focus.x))?Number(focus.x):0.5)*100));
 const y=Math.max(0,Math.min(100,(Number.isFinite(Number(focus.y))?Number(focus.y):0.5)*100));
 const zoom=Math.max(1,Math.min(2.5,Number(focus.zoom)||1));
 let style=`object-position:${x.toFixed(1)}% ${y.toFixed(1)}%`;
 if(zoom>1)style+=`;transform:scale(${zoom.toFixed(2)});transform-origin:${x.toFixed(1)}% ${y.toFixed(1)}%`;
 return ` style="${style}"`;
}
function imageMarkup(src,kind='fighter',label='Importer une image',focus=null){
 const cls=(kind==='gang'||kind==='custom-warband')?'gang-icon-image':'fighter-avatar-image';
 return src?`<img class="${cls}"${imageFocusStyle(focus)} src="${esc(src)}" alt="${esc(label)}">`:`<span class="${(kind==='gang'||kind==='custom-warband')?'gang-icon-placeholder':'fighter-avatar-placeholder'}">＋</span>`;
}
function pickImage(kind,index){
 const input=document.createElement('input');
 input.type='file';input.accept='image/*';input.style.display='none';
 input.onchange=()=>{const file=input.files?.[0];if(file)storeImportedImage(kind,index,file);input.remove()};
 document.body.appendChild(input);input.click();
}
function storeImportedImage(kind,index,file){
 if(!file.type.startsWith('image/')){toast('Choisis un fichier image');return}
 const reader=new FileReader();
 reader.onload=()=>{const img=new Image();img.onload=()=>{
   const max=512,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
   const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
   const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);
   let data=canvas.toDataURL('image/webp',0.86);if(!data.startsWith('data:image/webp'))data=canvas.toDataURL('image/png');
   openImageCropModal(kind,index,data);
 };img.onerror=()=>toast('Impossible de lire cette image');img.src=reader.result};
 reader.onerror=()=>toast('Impossible de lire ce fichier');reader.readAsDataURL(file);
}
function removeImage(kind,index){
 if(kind==='custom-warband'){
   const cw=customWarbandById(index);if(!cw)return;
   cw.icon='';cw.iconFocus=null;save(true);render('custom');toast(siteLanguage==='en'?'Warband icon removed':'Icône de la warband supprimée');return;
 }
 const r=activeRoster();if(!r)return;
 if(kind==='gang'){r.icon='';r.iconFocus=null;save(true);render('builder');toast('Icône de bande supprimée')}
 else{const x=r.fighters[index];if(!x)return;x.image='';x.imageFocus=null;save(true);render('fighter');toast('Image du combattant supprimée')}
}
// --- V144 image crop / center-point tool ---
// Lets the person pick a "focus point" (and optional zoom) on any newly
// imported image so the same source image looks correctly centered whether
// it's later displayed in a circular frame (.gang-icon) or a rectangular one
// (.dash-wcard-cover), on any device. The focus point is stored alongside
// the image data (r.iconFocus / cw.iconFocus / x.imageFocus) as normalized
// {x,y,zoom} and applied purely via CSS object-position/transform in imageMarkup().
let pendingImageCrop=null;
function imageCropExistingFocus(kind,index){
 if(kind==='custom-warband'){const cw=customWarbandById(index);return cw?.iconFocus||null;}
 if(kind==='gang'){const r=activeRoster();return r?.iconFocus||null;}
 const r=activeRoster();const x=r?.fighters?.[index];return x?.imageFocus||null;
}
function openImageCropModal(kind,index,dataUrl){
 const existing=imageCropExistingFocus(kind,index)||{};
 const x0=Number.isFinite(Number(existing.x))?Number(existing.x):0.5;
 const y0=Number.isFinite(Number(existing.y))?Number(existing.y):0.5;
 const zoom0=Math.max(1,Math.min(2.5,Number(existing.zoom)||1));
 pendingImageCrop={kind,index,dataUrl,focus:{x:x0,y:y0,zoom:zoom0}};
 openModal(imageCropModalMarkup());
 setTimeout(bindImageCropStage,30);
}
function imageCropModalMarkup(){
 const c=pendingImageCrop;if(!c)return '';
 const pct=v=>(v*100).toFixed(2)+'%';
 const previewStyle=`object-position:${pct(c.focus.x)} ${pct(c.focus.y)};transform:scale(${c.focus.zoom});transform-origin:${pct(c.focus.x)} ${pct(c.focus.y)}`;
 return `<div class="image-crop-dialog">
  <div class="eyebrow">CADRAGE DE L’IMAGE</div>
  <h2>Choisis le point central</h2>
  <p class="sheet-help">Clique ou fais glisser sur l’image pour positionner le point central. Ce point reste au milieu du cadre, qu’il soit rond ou rectangulaire, quel que soit l’appareil utilisé.</p>
  <div class="image-crop-stage" id="imageCropStage"><img src="${c.dataUrl}" alt="Aperçu" draggable="false"><div class="image-crop-marker" id="imageCropMarker" style="left:${pct(c.focus.x)};top:${pct(c.focus.y)}"></div></div>
  <label class="image-crop-zoom"><span>Zoom</span><input id="imageCropZoomInput" type="range" min="100" max="250" step="1" value="${Math.round(c.focus.zoom*100)}" oninput="setImageCropZoom(this.value)"><span id="imageCropZoomValue">${Math.round(c.focus.zoom*100)}%</span></label>
  <div class="image-crop-previews">
   <div class="image-crop-preview-item"><span class="image-crop-preview-label">Cadre rond</span><div class="image-crop-preview-circle"><img id="imageCropPreviewCircle" src="${c.dataUrl}" style="${previewStyle}" alt=""></div></div>
   <div class="image-crop-preview-item"><span class="image-crop-preview-label">Cadre rectangle</span><div class="image-crop-preview-rect"><img id="imageCropPreviewRect" src="${c.dataUrl}" style="${previewStyle}" alt=""></div></div>
  </div>
  <div class="custom-actions"><button type="button" class="button secondary" onclick="cancelImageCrop()">Annuler</button><button type="button" class="button primary" onclick="confirmImageCrop()">Valider le cadrage</button></div>
 </div>`;
}
function bindImageCropStage(){
 const stage=document.getElementById('imageCropStage');if(!stage)return;
 let dragging=false;
 const update=(clientX,clientY)=>{
   const rect=stage.getBoundingClientRect();if(!rect.width||!rect.height)return;
   const x=Math.max(0,Math.min(1,(clientX-rect.left)/rect.width));
   const y=Math.max(0,Math.min(1,(clientY-rect.top)/rect.height));
   if(!pendingImageCrop)return;
   pendingImageCrop.focus.x=x;pendingImageCrop.focus.y=y;
   refreshImageCropVisuals();
 };
 stage.onpointerdown=e=>{dragging=true;try{stage.setPointerCapture(e.pointerId)}catch(err){}update(e.clientX,e.clientY)};
 stage.onpointermove=e=>{if(!dragging)return;update(e.clientX,e.clientY)};
 const stop=e=>{dragging=false;try{stage.releasePointerCapture(e.pointerId)}catch(err){}};
 stage.onpointerup=stop;stage.onpointercancel=stop;
}
function refreshImageCropVisuals(){
 const c=pendingImageCrop;if(!c)return;
 const pct=v=>(v*100).toFixed(2)+'%';
 const marker=document.getElementById('imageCropMarker');
 if(marker){marker.style.left=pct(c.focus.x);marker.style.top=pct(c.focus.y)}
 const style=`object-position:${pct(c.focus.x)} ${pct(c.focus.y)};transform:scale(${c.focus.zoom});transform-origin:${pct(c.focus.x)} ${pct(c.focus.y)}`;
 const circle=document.getElementById('imageCropPreviewCircle');if(circle)circle.setAttribute('style',style);
 const rect=document.getElementById('imageCropPreviewRect');if(rect)rect.setAttribute('style',style);
}
function setImageCropZoom(v){
 if(!pendingImageCrop)return;
 pendingImageCrop.focus.zoom=Math.max(1,Math.min(2.5,Number(v)/100||1));
 const label=document.getElementById('imageCropZoomValue');if(label)label.textContent=`${Math.round(pendingImageCrop.focus.zoom*100)}%`;
 refreshImageCropVisuals();
}
function cancelImageCrop(){pendingImageCrop=null;closeModal();}
function confirmImageCrop(){
 const c=pendingImageCrop;if(!c)return;
 const focus={x:Number(c.focus.x.toFixed(4)),y:Number(c.focus.y.toFixed(4)),zoom:Number(c.focus.zoom.toFixed(2))};
 if(c.kind==='custom-warband'){
   const cw=customWarbandById(c.index);pendingImageCrop=null;if(!cw){closeModal();return}
   cw.icon=c.dataUrl;cw.iconFocus=focus;save(true);closeModal();render('custom');toast(siteLanguage==='en'?'Warband icon updated':'Icône de la warband mise à jour');return;
 }
 const r=activeRoster();
 if(c.kind==='gang'){pendingImageCrop=null;if(!r){closeModal();return}r.icon=c.dataUrl;r.iconFocus=focus;save(true);closeModal();render('builder');toast('Icône de bande mise à jour');return;}
 const idx=c.index,resolvedKind=c.kind;pendingImageCrop=null;
 const x=r?.fighters?.[idx];if(!x){closeModal();return}
 x.image=c.dataUrl;x.imageFocus=focus;save(true);closeModal();render(resolvedKind==='fighter-card'?'builder':'fighter');toast('Image du combattant mise à jour');
}
function toast(t,duration=1800){const x=document.createElement('div');const isExploration=/Résolution appliquée|Resolution appliquee/i.test(String(t));x.className='toast'+(isExploration?' exploration-toast':'');x.textContent=t;const target=isExploration?document.querySelector('.exploration-result'):null;if(target){target.insertBefore(x,target.firstChild)}else document.body.appendChild(x);setTimeout(()=>x.remove(),duration)}
function activeRoster(){
  const r=state.rosters.find(r=>r.id===state.active);
  if(!r)return null;
  if(!Array.isArray(r.fighters))r.fighters=[];
  if(!('icon' in r))r.icon='';
  if(!('notes' in r))r.notes='';
  // A single malformed/legacy fighter must never prevent a whole warband from opening.
  r.fighters.forEach(x=>{
    if(!x||typeof x!=='object')return;
    try{if(fighterUsesLoadouts(x))ensureFighterLoadouts(x);}catch(e){console.warn('Fighter loadout recovery skipped',e);}
    try{if(!x.instance)x.instance=crypto.randomUUID();}catch(e){if(!x.instance)x.instance=String(Date.now())+'-'+Math.random().toString(36).slice(2);}
    if(!('image' in x))x.image='';
    if(typeof x.name!=='string'||!x.name.trim())x.name=String(x.sourceName||x.wid||'Combattant');
    if(typeof x.type!=='string'||!x.type.trim())x.type='Henchman';
    if(typeof x.xp!=='number'||!Number.isFinite(x.xp))x.xp=0;
    if(!Array.isArray(x.profile))x.profile=Array.isArray(x.baseProfile)?x.baseProfile.slice():[];
    if(!Array.isArray(x.profile))x.profile=[];
    x.profile=Array.from({length:12},(_,i)=>{const n=Number(x.profile[i]);return Number.isFinite(n)?n:0});
    if(!Array.isArray(x.baseProfile))x.baseProfile=x.profile.slice();
    if(!Array.isArray(x.equipmentSelected))x.equipmentSelected=[];if(!Array.isArray(x.equipmentStash))x.equipmentStash=[];if(!Array.isArray(x.equipmentLoadouts))x.equipmentLoadouts=[];if(!Array.isArray(x.advancements))x.advancements=[];if(!Array.isArray(x.skills))x.skills=[];if(!Array.isArray(x.spells))x.spells=[];if(!Array.isArray(x.injuries))x.injuries=[];if(!Array.isArray(x.ruleNames))x.ruleNames=[];if(!Array.isArray(x.packModifiers))x.packModifiers=[];if(!Array.isArray(x.packRules))x.packRules=[];if(!Array.isArray(x.equipmentAccessGroups))x.equipmentAccessGroups=[];if(!Array.isArray(x.customEquipmentGrantedSkills))x.customEquipmentGrantedSkills=[];if(!Array.isArray(x.unlockedMagicDomains))x.unlockedMagicDomains=[];if(!x.status||typeof x.status!=='object'||Array.isArray(x.status))x.status={};
    x.status.recovery=!!x.status.recovery;
    x.status.captured=!!x.status.captured;
    x.status.dead=!!x.status.dead;
    try{syncCustomEquipmentEffects(x);}catch(e){console.warn('Custom equipment recovery skipped',e);}
    try{syncWarbandRuleEffects(x,r);}catch(e){console.warn('Warband rule recovery skipped',e);}
  });
  if(!Array.isArray(r.customValues))r.customValues=[];
  if(!Array.isArray(r.reserve))r.reserve=[];
  if(!Number.isFinite(r.wyrdstone))r.wyrdstone=0;
  try{ensurePostBattleData(r);}catch(e){console.warn('Post-battle recovery skipped',e);}
  if(!Array.isArray(state.customEquipment))state.customEquipment=[];
  if(!Number.isFinite(r.gold)){
    let spent=0;
    r.fighters.forEach(x=>{try{spent+=fighterPaid(x)}catch(e){}});
    r.gold=Math.max(0,(faction(r)?.budget||1000)-spent);
  }
  return r;
}
function availableSupplementsForFaction(fid){
  return (window.NECROHEIM_PACKS||[]).filter(p=>p.type==='supplement' && Array.isArray(p.compatibleFactions) && p.compatibleFactions.includes(fid));
}
function faction(r){
  if(r?.customWarbandId){
    const cw=Array.isArray(state.customWarbands)?state.customWarbands.find(x=>x.id===r.customWarbandId):null;
    if(cw){
      return {
        id:`custom-warband-${cw.id}`,
        displayName:cw.name,
        group:'CUSTOM',
        budget:1000,
        warriors:customWarbandWarriors(cw),
        equipment:customWarbandEquipmentObjects(cw)
      };
    }
  }
  const base=D.factions.find(f=>f.id===r.factionId);
  if(!base){
    const fighters=Array.isArray(r?.fighters)?r.fighters:[];
    return {id:String(r?.factionId||r?.customWarbandId||'unknown-faction'),displayName:String(r?.factionName||r?.factionId||'Faction inconnue'),group:'RECOVERED',budget:1000,warriors:fighters.map(x=>({id:x.wid||x.instance||crypto.randomUUID(),name:x.sourceName||x.name||'Combattant',type:x.type||'Henchman',cost:Number(x.cost||0),max:null,profile:Array.isArray(x.baseProfile)&&x.baseProfile.length?x.baseProfile.slice():(Array.isArray(x.profile)?x.profile.slice():[]),rules:x.rules||'',ruleNames:Array.isArray(x.ruleNames)?x.ruleNames.slice():[]})),equipment:[]};
  }
  const active=Array.isArray(r.activeSupplements)?r.activeSupplements:[];
  let chosen=base;
  // Packs may expose a derived faction. This keeps the core faction untouched.
  active.forEach(pid=>{
    const derived=D.factions.find(f=>f.packId===pid && (f.baseFactionId===base.id || f.baseFactionId===chosen.id));
    if(derived) chosen=derived;
  });
  return chosen;
}
function effectiveFighterProfile(w,f){
  const base=Array.isArray(w?.profile)?w.profile.slice():[];
  const mods=(f?.packRuleModifiers||[]).filter(m=>(!m.target||m.target===w.name||m.target===w.id||m.target==='all') && (!m.targetType||m.targetType==='unit'));
  mods.forEach(m=>{const i=P.indexOf(m.stat); if(i>=0 && typeof base[i]==='number') base[i]+=Number(m.amount||0)});
  return base;
}
function fighterUsesLoadouts(x){return ['Leader','Champion'].includes(String(x?.type||''));}
function ensureFighterLoadouts(x){
  if(!fighterUsesLoadouts(x)||!x)return false;
  let stash=Array.isArray(x.equipmentStash)?x.equipmentStash:[];
  stash.forEach((e,i)=>{if(!e.stashId)e.stashId=crypto.randomUUID();});
  x.equipmentStash=stash;
  if(!Array.isArray(x.equipmentLoadouts)||!x.equipmentLoadouts.length){
    const legacy=Array.isArray(x.equipmentSelected)?x.equipmentSelected.slice():stash.slice();
    const legacyIds=legacy.map(e=>e.stashId||null).filter(Boolean);
    x.equipmentLoadouts=[{id:crypto.randomUUID(),name:'1',equipmentIds:legacyIds,equipmentNames:legacy.map(e=>e.name)}];
    x.activeLoadoutId=x.equipmentLoadouts[0].id;
  }else{
    x.equipmentLoadouts.forEach(l=>{
      l.equipmentIds=Array.isArray(l.equipmentIds)?l.equipmentIds:[];
      // Migrate old name-based loadouts to individual stash items.
      if(!l.equipmentIds.length&&Array.isArray(l.equipmentNames)&&l.equipmentNames.length){
        const used=new Set();
        l.equipmentNames.forEach(name=>{
          const hit=stash.find(e=>!used.has(e.stashId)&&normName(e.name)===normName(name));
          if(hit){used.add(hit.stashId);l.equipmentIds.push(hit.stashId);}
        });
      }
      l.equipmentIds=l.equipmentIds.filter(id=>stash.some(e=>e.stashId===id));
      l.equipmentNames=l.equipmentIds.map(id=>stash.find(e=>e.stashId===id)?.name).filter(Boolean);
    });
    if(!x.activeLoadoutId||!x.equipmentLoadouts.some(l=>l.id===x.activeLoadoutId))x.activeLoadoutId=x.equipmentLoadouts[0].id;
  }
  const active=x.equipmentLoadouts.find(l=>l.id===x.activeLoadoutId)||x.equipmentLoadouts[0];
  if(!Array.isArray(active.equipmentIds))active.equipmentIds=[];
  active.equipmentIds=active.equipmentIds.filter(id=>stash.some(e=>e.stashId===id));
  active.equipmentNames=active.equipmentIds.map(id=>stash.find(e=>e.stashId===id)?.name).filter(Boolean);
  x.equipmentSelected=stash.filter(e=>active.equipmentIds.includes(e.stashId)).map(e=>({...e}));
  return true;
}
function syncLoadoutProjection(x){if(!fighterUsesLoadouts(x))return;ensureFighterLoadouts(x);}
function activeLoadout(x){if(!ensureFighterLoadouts(x))return null;return x.equipmentLoadouts.find(l=>l.id===x.activeLoadoutId)||x.equipmentLoadouts[0]||null;}
function loadoutNames(x){return (x?.equipmentLoadouts||[]).map(l=>l.name||'Loadout');}
function loadoutHasItem(x,item){const l=activeLoadout(x);const id=typeof item==='object'?item?.stashId:null;return !!l?.equipmentIds?.includes(id);}
function loadoutSelectedEquipment(x){const l=activeLoadout(x);const ids=new Set(l?.equipmentIds||[]);return (x?.equipmentStash||[]).filter(e=>ids.has(e.stashId));}
function setActiveLoadout(id){const x=activeRoster()?.fighters[editingIndex];if(!x||!fighterUsesLoadouts(x))return;x.activeLoadoutId=id;syncLoadoutProjection(x);syncCustomEquipmentEffects(x);save(true);render('fighter')}
function createLoadout(){const x=activeRoster()?.fighters[editingIndex];if(!x||!fighterUsesLoadouts(x))return;ensureFighterLoadouts(x);const number=x.equipmentLoadouts.length+1;const l={id:crypto.randomUUID(),name:String(number),equipmentIds:[],equipmentNames:[]};x.equipmentLoadouts.push(l);x.activeLoadoutId=l.id;syncLoadoutProjection(x);syncCustomEquipmentEffects(x);save(true);render('fighter');toast(`Loadout ${l.name} créé`)}
function renameLoadout(id){
  const x=activeRoster()?.fighters[editingIndex];
  const l=x?.equipmentLoadouts?.find(a=>a.id===id);
  if(!l)return;
  openModal(`<div class="loadout-rename-dialog"><div class="eyebrow">LOADOUT · MODIFICATION</div><h2>Renommer le loadout</h2><p>Donne un nom à cette configuration d’équipement. Ce nom sera affiché directement dans la fiche du combattant.</p><label class="modal-field loadout-name-field"><span>Nom du loadout</span><input id="loadoutNameInput" class="resource-amount loadout-name-input" maxlength="32" value="${esc(l.name||'Loadout')}" placeholder="Ex. Marteau · Grosse armure" onkeydown="if(event.key==='Enter'){event.preventDefault();saveLoadoutRename('${id}')}"></label><div class="purchase-actions loadout-rename-actions"><button type="button" class="button secondary" onclick="closeModal()">Annuler</button><button type="button" class="button primary" onclick="saveLoadoutRename('${id}')">Enregistrer</button></div></div>`);
}
function saveLoadoutRename(id){
  const x=activeRoster()?.fighters[editingIndex];
  const l=x?.equipmentLoadouts?.find(a=>a.id===id);
  const input=$('#loadoutNameInput');
  if(!l||!input)return;
  const clean=input.value.trim();
  if(!clean){toast('Le nom ne peut pas être vide');input.focus();return}
  l.name=clean;
  save(true);
  closeModal();
  render('fighter');
  toast(`Loadout « ${clean} » renommé`);
}
function deleteLoadout(id){const x=activeRoster()?.fighters[editingIndex];if(!x||!fighterUsesLoadouts(x))return;ensureFighterLoadouts(x);const ls=x.equipmentLoadouts||[];const idx=ls.findIndex(l=>l.id===id);if(idx<=0)return;const l=ls[idx];const ok=confirm(`Supprimer le loadout « ${l.name||'Loadout'} » ?\n\nSon contenu sera retiré uniquement de ce loadout, pas du coffre.`);if(!ok)return;const wasActive=x.activeLoadoutId===id;ls.splice(idx,1);if(wasActive)x.activeLoadoutId=ls[0].id;syncLoadoutProjection(x);syncCustomEquipmentEffects(x);save(true);render('fighter');toast(`Loadout « ${l.name||'Loadout'} » supprimé`)}
function canSelectLoadoutItem(x,e){
  ensureFighterLoadouts(x);
  const l=activeLoadout(x),ids=new Set(l?.equipmentIds||[]);
  if(ids.has(e.stashId))return {ok:true};
  // Validate against the loadout only. The stash itself has no armour/weapon-slot restrictions.
  const selected=loadoutSelectedEquipment(x);
  const previous=x.equipmentSelected;
  x.equipmentSelected=selected;
  const check=canEquip(x,e);
  x.equipmentSelected=previous;
  return check;
}
function loadoutDisabledReason(x,e){const check=canSelectLoadoutItem(x,e);return check.ok?'':check.msg}
function toggleLoadoutItem(index){
  const x=activeRoster()?.fighters[editingIndex];if(!x||!fighterUsesLoadouts(x))return;
  ensureFighterLoadouts(x);const l=activeLoadout(x),e=x.equipmentStash?.[index];if(!l||!e)return;
  const pos=l.equipmentIds.indexOf(e.stashId);
  if(pos>=0){l.equipmentIds.splice(pos,1);}
  else{
    const check=canSelectLoadoutItem(x,e);
    if(!check.ok){toast(check.msg);return}
    l.equipmentIds.push(e.stashId);
  }
  l.equipmentNames=l.equipmentIds.map(id=>x.equipmentStash.find(q=>q.stashId===id)?.name).filter(Boolean);
  syncLoadoutProjection(x);syncCustomEquipmentEffects(x);save(true);render('fighter');
}
function loadoutControlsMarkup(x){
  if(!fighterUsesLoadouts(x))return '';
  ensureFighterLoadouts(x);const ls=x.equipmentLoadouts||[];
  return `<div class="loadout-controls" aria-label="Loadouts"><button type="button" class="loadout-box chest ${loadoutView==='chest'?'active':''}" title="Coffre principal · tout l’équipement possédé" onclick="event.stopPropagation();setLoadoutView('chest')">▣</button>${ls.map((l,i)=>`<div class="loadout-control-group ${l.id===x.activeLoadoutId&&loadoutView!=='chest'?'active':''}"><button type="button" class="loadout-box ${l.id===x.activeLoadoutId&&loadoutView!=='chest'?'active':''}" title="${esc(l.name||'Loadout')} · double-cliquer pour renommer" onclick="setActiveLoadout('${l.id}');setLoadoutView('loadout')" ondblclick="event.stopPropagation();renameLoadout('${l.id}')">${esc(l.name||'Loadout')}</button>${i>0?`<button type="button" class="loadout-delete" title="Supprimer ce loadout" aria-label="Supprimer le loadout ${esc(l.name||'Loadout')}" onclick="event.stopPropagation();deleteLoadout('${l.id}')">×</button>`:''}</div>`).join('')}<button type="button" class="loadout-box add" title="Créer un nouveau loadout" onclick="createLoadout()">+</button></div>`;
}
function loadoutEquipmentMarkup(x){
  ensureFighterLoadouts(x);const stash=x.equipmentStash||[],l=activeLoadout(x);
  if(loadoutView==='chest')return `<div class="loadout-view"><div class="loadout-view-head"><div><strong>Coffre principal</strong><small>Tout l’équipement possédé. Le coffre ignore les limites d’armes et d’armures et n’applique aucun équipement au profil.</small></div><span>${stash.length} objet${stash.length!==1?'s':''}</span></div>${stash.length?`<div class="loadout-chest-list">${stash.map((e,i)=>`<div class="loadout-chest-row"><div>${refLink('equipment',e.name)}<small>${esc(e.category||'Équipement')}</small></div><span>${Number(e.value??e.price??0)} GC</span><div class="equipped-actions"><button type="button" class="equipment-action reserve" title="Mettre en réserve" aria-label="Mettre ${esc(e.name)} en réserve" onclick="moveStashEquipmentToReserve(${i})">▣</button><button type="button" class="equipment-action sell" title="Vendre" onclick="sellEquipment(${i})">💰</button><button type="button" class="equipment-action remove" title="Supprimer du coffre" onclick="removeEquipment(${i})">🗑</button></div></div>`).join('')}</div>`:'<div class="empty compact">Coffre vide.</div>'}</div>`;
  return `<div class="loadout-view"><div class="loadout-view-head"><div><strong>${esc(l?.name||'Loadout')}</strong><small>Coche les objets du coffre utilisés par ce loadout. Les restrictions d’armes, d’armures et de combinaison restent appliquées ici.</small></div><span>${x.equipmentSelected?.length||0} sélectionné${(x.equipmentSelected?.length||0)!==1?'s':''}</span></div>${stash.length?`<div class="loadout-select-list">${stash.map((e,i)=>{const checked=loadoutHasItem(x,e),reason=loadoutDisabledReason(x,e);return `<label class="loadout-check-row ${reason&&!checked?'is-disabled':''}" title="${reason?esc(reason):''}"><input type="checkbox" ${checked?'checked':''} ${reason&&!checked?'disabled':''} onchange="toggleLoadoutItem(${i})"><span><b>${refLink('equipment',e.name)}</b><small>${esc(e.category||'Équipement')}${e.profile?` · ${esc(e.profile.range||'')} · S ${esc(e.profile.strength||'')} · AP ${esc(e.profile.ap||'—')} · D ${esc(e.profile.damage||'—')}`:''}${reason&&!checked?` · <em>${esc(reason)}</em>`:''}</small></span></label>`}).join('')}</div>`:'<div class="empty compact">Le coffre est vide. Ajoute d’abord de l’équipement.</div>'}</div>`;
}
function fighterValue(x){const eq=fighterUsesLoadouts(x)?(Array.isArray(x?.equipmentStash)?x.equipmentStash:[]):(Array.isArray(x?.equipmentSelected)?x.equipmentSelected:[]);const adv=Array.isArray(x?.advancements)?x.advancements:[];return Number(x?.cost||0)+(eq.reduce((n,e)=>n+Number(e?.value ?? e?.price ?? 0),0))+(adv.reduce((n,a)=>n+Number(a?.value||0),0))}
function fighterPaid(x){const eq=fighterUsesLoadouts(x)?(Array.isArray(x?.equipmentStash)?x.equipmentStash:[]):(Array.isArray(x?.equipmentSelected)?x.equipmentSelected:[]);return Number(x?.cost||0)+(eq.reduce((n,e)=>n+Number(e?.paid ?? e?.price ?? 0),0))}
function fighterCost(x){return fighterValue(x)}
function total(r){const fighters=Array.isArray(r?.fighters)?r.fighters:[];const reserve=Array.isArray(r?.reserve)?r.reserve:[];return fighters.reduce((n,x)=>n+fighterValue(x),0)+reserve.reduce((n,e)=>n+Number(e?.value??e?.price??0),0)}
const MAGIC_RULEBOOK={
'Prayers of Sigmar':[
['1','Sigmar’s Fiery Hammer','0 · Basic · Continuous','Le Prêtre utilise un marteau magique : S+2, AP -, D2, Flaming Attack, Stun.'],
['2','Beacon of Righteous Virtue','-1 · Basic · Continuous','Les alliés à 8" deviennent immunisés à Fear et Panic ; le Leader peut relancer le D6 du Rout test.'],
['3','Soulfire','-2 · Basic','Chaque ennemi à 4" subit une touche S3 Flaming Attack sans sauvegarde ; Undead et Daemonic subissent S5.'],
['4','Shield of Faith','+1 · Basic · Continuous','Le Prêtre devient immunisé aux sorts.'],
['5','Healing Hand','+2 · Simple','Un guerrier à 2" est restauré à son nombre complet de Wounds ; un Seriously Injured se relève et les Flesh Wounds proches sont retirées.'],
['6','Armour of Righteousness','-2 · Basic · Continuous','Le Prêtre obtient une Armour Save 2+ et cause Fear.']],
'Necromancy':[
['1','Soul Stealer','-3 · Basic','Une cible à 6" perd 1 Wound sans Armour Save ; le Nécromancien gagne +1 Wound pour la partie. Ne fonctionne pas sur Undead ou Daemonic.'],
['2','Invocation of Nehek','0 · Basic','Un Skeleton ou Zombie Warrior de la bande qui vient d’être mis Out of Action revient à 6" du Nécromancien, hors contact ennemi.'],
['3','Hellish Vigour','0 · Basic','Un guerrier Undead non-Vampiric allié à 6" peut immédiatement effectuer Fight (Basic).'],
['4','Gaze of Nagash','-2 · Basic','Attaque immédiate à 12" : S4, AP -1, D1, D3 hits, sans Armour Save.'],
['5','Vanhel’s Danse Macabre','+1 · Basic','Un guerrier Undead allié à 6" effectue immédiatement Move (Simple) ; s’il atteint le contact, il compte comme ayant chargé et peut Fight.'],
['6','Spell of Awakening','Auto','Un Hero ennemi tué ou un Dreg mort (66) peut être relevé après la bataille comme Skeleton Warrior, avec ses armes et armures mais sans autre équipement ni compétences ; profil modifié et règle Undead.']],
'Chaos Rituals':[
['1','Vision of Torment','-3 · Basic','Une cible à 6" effectue un Willpower check ; réussite : Pinned ; échec : -1 Wound et Pinned. Ne touche pas Immune to Psychology.'],
['2','Eye of God','0 · Basic','Une fois par bataille : un guerrier fidèle à 6" reçoit un résultat D6 : 1 = Out of Action comptant Out Cold ; 2–5 = +1 à une caractéristique ; 6 = +1 à toutes les caractéristiques pour la bataille.'],
['3','Dark Blood','-1 · Basic','Attaque jusqu’à 8" : D3 touches S5. Après le sort, le Chaos Mage effectue un Toughness check ; échec = Flesh Wound.'],
['4','Lure of Chaos','-2 · Basic · Continuous','Une cible ennemie n’ayant pas activé à 12" effectue un Willpower check ; échec = elle est activée sous le contrôle du Chaos Mage jusqu’à réussir un Willpower check au début d’une activation.'],
['5','Wings of Darkness','0 · Basic','Le Chaos Mage effectue immédiatement un Move (Basic) gratuit jusqu’à 12", ignore le terrain et peut franchir les niveaux, mais pas murs/terrain infranchissable.'],
['6','Word of Pain','0 · Basic','Tous les guerriers à 3" du Chaos Mage, amis ou ennemis, subissent une touche S3 sans Armour Save.']],
'Lesser Magic':[
['1','Fires of U’Zhul','0 · Simple','Attaque immédiate à 18" : S4, AP -1, D1, Flaming Attack.'],
['2','Flight of Zimmeran','0 · Basic','Move (Basic) gratuit jusqu’à 12", en ignorant le terrain et les niveaux, sans traverser murs ou terrain infranchissable.'],
['3','Dread of Aramar','-1 · Basic','Une cible ennemie à 12" effectue un Panic check ; échec = Broken. Immune to Psychology n’est pas affecté.'],
['4','Silver Arrows of Arha','0 · Basic','Attaque immédiate à 24" : S3, AP -, D1, D3+2 hits.'],
['5','Luck of Shemtek','+1 · Basic','Le Wizard peut relancer ses jets ratés une fois ; les seconds résultats s’appliquent. Jusqu’à sa prochaine activation.'],
['6','Flaming Sword of Rhuin','-1 · Basic · Continuous','Le Wizard utilise une arme de mêlée S+2, AP -1, D1, +1 Attack dice, +2 WS, Parry, Flaming Attack.']],
'Magic of the Horned Rat':[
['1','Warp Lightning','-1 · Basic','Attaque à 9" : S4, AP -1, D1, D3 hits ; chaque guerrier à 2" de la cible subit aussi une touche S3.'],
['2','Skitterleap','0 · Basic','Le Sorcier se déplace jusqu’à 13" sans finir à moins de 1" d’un ennemi. S’il est Engaged, il compte comme ayant fait Retreat sans test d’Initiative ; les ennemis Engaged avec lui subissent -1 à leur test d’Initiative.'],
['3','Vermintide','+1 · Basic','Une cible à 8" subit 2D6 touches S1 avec -1 à la sauvegarde.'],
['4','Black Fury','-1 · Basic · Continuous','Charge (Double) immédiate jusqu’à 13" et +2 Attacks, +1 Strength jusqu’à la prochaine activation.'],
['5','Eye of the Warp','-1 · Basic','Les ennemis Engaged avec le Sorcier testent Cool ; échec = touche S3, Broken et Running for Cover. Immune to Psychology évite le Broken.'],
['6','Sorcerer’s Curse','+1 · Basic','À 13", une cible en ligne de vue doit relancer ses Armour Saves réussies et ses jets de touche réussis jusqu’à la prochaine activation du Sorcier.']],
'Prayers of Ulric':[
['1','Winter’s Chill','+1 · Basic · Continuous','Tout guerrier Engaged avec le Prêtre subit -1 à ses jets de touche.'],
['2','Ice Blast','-3 · Basic','Attaque à 12" : S3, AP -6, D1, Blast (5"), sans Armour Save.'],
['3','Battle Fury','0 · Basic · Continuous','Le Prêtre attaque à Strength +2 et avec Hack ; s’il possède déjà Hack, un 5 ou 6 naturel au toucher donne encore +1 Strength.'],
['4','Ulric’s Gift','0 · Basic','Un allié à 12" qui n’est pas Hired Sword gagne Frenzy.'],
['5','Heart of the Wolf','-1 · Basic · Continuous','Les alliés à 8" deviennent immunisés à Fear et Panic ; le Leader peut relancer le D6 du Rout test.'],
['6','Call of Ulric','-1 · Basic · Continuous','Charge (Double) immédiate jusqu’à 12" et +2 Attacks, +1 Strength jusqu’à la prochaine activation.']],
'Prayers of Taal':[
['1','Stags Leap','0 · Basic','Le Prêtre se déplace jusqu’à 9" ; au contact il compte comme ayant chargé et gagne +1 Strength au premier round. Contre un ennemi en fuite : 1 touche automatique à +1 Strength.'],
['2','Blessed Ale','+2 · Basic','Un modèle à 2" récupère ses Wounds au maximum. Les ennemis vivants à 2" perdent 1 Attack au prochain round ; Undead et Daemonic sont exclus.'],
['3','Bears Paw','0 · Basic','Le Prêtre ou un allié à 6" gagne +2 Strength jusqu’à la prochaine activation du Prêtre.'],
['4','Earth Shudder','-2 · Basic','Un bâtiment à 4" s’effondre ; les ennemis au contact subissent S3. Les modèles dessus chutent selon les règles de chute et le bâtiment est remplacé par des décombres en Difficult Terrain.'],
['5','Tanglefoot','-1 · Basic','Tous les modèles à 12" sauf Ostlander Jaeger se déplacent à demi-vitesse jusqu’à la prochaine phase de tir.'],
['6','Summon Squirrels','0 · Basic','Une cible ennemie à 12" subit 2D6 touches S1 sans Armour Save.']],
'Power of da Waaagh!':[
['1','‘Ere we go!','-2 · Continuous','Les Orcs et Goblins à 4" du Shaman gagnent Strike First.'],
['2','The Hand of Gork','0 · Basic','Une cible à 8" est déplacée de D6" directement à l’opposé ; collision avec guerrier/terrain = touche S3 aux modèles concernés. Pas sur une cible Engaged.'],
['3','Brain Bursta','-2 · Basic','Attaque à 12" : S4, AP -6, D1, D3 hits, sans Armour Save.'],
['4','Fooled Ya!','+1 · Basic','Aucun ennemi ne peut charger le Shaman à sa prochaine activation. S’il est Engaged, il peut immédiatement se déplacer de 4" ; effet jusqu’à sa prochaine activation.'],
['5','Fists of Gork','0 · Continuous','Le Shaman utilise une arme S+2, AP -1, D1, +1 Attack dice, Stun.'],
['6','Gaze of Mork','-1 · Basic','Deux rayons causent chacun D3 touches S3 à 12" ; ils peuvent viser la même cible la plus proche ou les deux cibles les plus proches. Flaming Attack.']]
};
function magicRulesMarkup(){return `<div class="rule-spell-groups">${Object.entries(MAGIC_RULEBOOK).map(([domain,spells])=>`<details class="rule-spell-domain"><summary><b>${esc(domain)}</b><span>6 résultats · 1D6</span></summary><div class="rule-spell-list">${spells.map(x=>`<article><div class="spell-roll">${x[0]}</div><div><b>${esc(x[1])}</b><small>${esc(x[2])}</small><p>${esc(x[3])}</p></div></article>`).join('')}</div></details>`).join('')}</div>`}

const RULES_BOOK=[{"id":"prebattle","title":"1. The pre-Battle Sequence","pages":"p. 143","content":[{"page":143,"text":"The pre-battle sequence\nIn a Campaign, there are additional steps that take place before\nand after a battle, as listed below. They must be followed in the\norder shown, and must be done while both players are present.\nThe pre-battle sequence has the following steps:\n\nTHE PRE-BATTLE SEQUENCE\n1.\n2.\n3.\n4.\n5.\n6.\n7.\n\nMAKE A CHALLENGE\nBUY ADVANCEMENTS AND RECRUIT HIRED\nSWORDS\nDETERMINE SCENARIO\nSET UP THE BATTLEFIELD\nCHOOSE CREWS\nANNOUNCE EXPLORATION BOONS\nDEPLOYMENT\n\n1. MAKE A CHALLENGE\nFor a battle to be fought, one player must challenge another\nplayer to play a game.\n2. BUY ADVANCEMENTS AND RECRUIT HIRED\nSWORDS\nEach player can spend Experience to purchase Advancements\nfor their warriors. If both players wish to do so, the player with\nthe lower Warband Rating goes first, purchasing any\nAdvancements they wish, then the other player does so. If both\nplayers have the same Warband Rating, the winner of a roll-off\nchooses whether to go first or second.\nOnce any Advancements have been bought, players can spend\ngold crowns to recruit Hired Swords. Again, if both players\nwish to do so, the player with the lower Warband Rating goes\nfirst.\n3. DETERMINE SCENARIO\nThe player with the lowest warband rating rolls on the\nScenario table to determine which scenario is played. To\ndetermine which scenario will be used, roll 2D6 on the\nfollowing table:\n[TABLE]\n2D6|Result\n*2-3|The player with the higher warband rating chooses which scenario to play. If both have the same warband rating, the winner of a roll off chooses. If there is an attacker and defender, the player who chose the scenario is the attacker.\n*4-6|Play the Skirmish scenario.\n*7-12|The player with the lower warband rating chooses which scenario to play. If both have the same warband rating, the winner of a roll off chooses. If there is an attacker and defender, the player who chose the scenario is the attacker.\n[/TABLE]\n\nRESCUE MISSIONS\n\nIf one player has Captured another player’s warrior(s), the\nCaptured warrior’s player may issue a challenge to play the\nRescue Mission scenario. If the challenge is accepted, then\nthe Rescue Mission scenario is automatically used for the\nbattle. If the player holding the Captive refuses the\nchallenge, they automatically forfeit the Captive.\nDETERMINING THE ATTACKER AND DEFENDER\nIn the scenarios where there is an attacker and a defender, the\nplayer with lowest warband rating may choose which he is.\nHOME TURF ADVANTAGE\nThe scenario being played may indicate that the defender\nbenefits from the Home Turf Advantage, representing the\nwarband fighting furiously to defend their valuable turf from\nattackers. A warband fighting with the Home Turf Advantage\nis far less likely to rout and in some cases will fight ferociously\nuntil the last.\n4. SET UP THE BATTLEFIELD\nThe players now set up the battlefield. Some scenarios have\nspecial instructions for terrain. The more buildings the better,\nso you should place all the terrain you have.\n5. CHOOSE CREWS\nAfter the battlefield has been set up, before warbands can be\ndeployed, players must select their starting crews for the battle\nahead. The scenario being played will detail the method of\nselection to be used and how many warriors can be selected.\n6. ANNOUNCE EXPLORATION BOONS\nPlayers may have Exploration Boons granted by the\nExploration chart (e.g. Catacombs). Players should announce\nwhich, if any, of their Exploration Boons grant them a bonus\nthat will have an effect on this game at this stage, forewarning\ntheir opponent. If a Exploration Boon is not announced, it\ncannot be used during the coming game.\n7. DEPLOYMENT\nMany scenarios will provide details of the size and location of\ndeployment zones."}]},{"id":"structure","title":"2. Game Structure","pages":"p. 11","content":[{"page":11,"text":"The Rules\nMany of the rules that follow will be familiar to players of Necromunda, as they utilise a lot of the same core mechanics and\nprinciples. For much of the time players should use the Necromunda rule books. But beware, certain elements have been modified\nin order to bring to the fore the highly tactical and narrative character of the dark and deadly environment of the ruined city over\nwhich rival warbands do battle.\nThis section contains rules that allow players to fight out the bitter and vicious skirmishes that punctuate the daily lives of the\nMordheim warbands. The Turn sequence, activating warriors, attacking the enemy with ranged weapons or in combat, suffering\nand recovering from injuries, warbands or individual warriors losing their nerve and fleeing – all of these things are dealt with\nover the following pages.\n\nGame structure\nA game of Mordheim is split into several rounds. During a round, players will determine who has Priority, take turns activating\none or more warriors and perform actions with them. They will attempt to recover Injured warriors, rally fleeing warriors and\ndetermine if their warband can hold its nerve in the face of the enemy.\n\nROUND SEQUENCE\n\nEach round is split into three phases, each in turn consisting of a number of steps resolved one at a time. These are as follows:\n\nPRIORITY PHASE\n•\n•\n\nROLL FOR PRIORITY: Both players roll for Priority.\nREADY WARRIORS: Each warrior is given a Ready marker.\n\nACTION PHASE\n•\n•\n\nFLEEING THE BATTLEFIELD: If either warband has failed a Rout test, Cool checks are made before the controlling\nplayer picks their first warrior to activate. Warriors that fail will flee the battlefield. •\nACTIVATE WARRIORS: Starting with the player with Priority, players take turns to pick one of their Ready warriors to\nactivate.\n\nEND PHASE\n•\n•\n•\n\nROUT TESTS: If either or both player(s) has at least one warrior Seriously Injured or Out of Action, they will have to\nmake a Rout test for their warband. •\nRECOVERY TESTS: The controlling player makes a Recovery roll for each of their Seriously Injured warrior(s) on the\nbattlefield. •\nRALLY TESTS: Cool checks are made for Broken warriors to see if they can Rally."}]},{"id":"priority","title":"2.1 Priority Phase","pages":"p. 12","content":[{"page":12,"text":"The Priority Phase\nThe Priority phase is split into the following steps:\n•\n•\n\nROLL FOR PRIORITY\nREADY WARRIORS\n\nROLL FOR PRIORITY\n\nThis step determines which player wins the Priority marker\nfor this round. The Priority marker is a coin or token, such\nas that contained in the Necromunda: Underhive boxed set,\nthat is held by the player with Priority for the round, acting\nas a reminder. Holding the Priority marker gives a player a\nhuge advantage, as they are able to activate first and can\ndictate the flow of the action during the round, often putting\ntheir opponent onto the back foot and making their\nwarband behave reactively rather than proactively in\nresponse to their foes moving and attacking first.\nEach player rolls a D6, and the player who rolls the highest\ntakes the Priority marker for this round. In the case of a tie,\nthe player who had the Priority marker in the previous\nround passes it to their opponent. If the first Priority roll of\nthe battle is tied, neither player will have held the Priority\nmarker previously, therefore both players roll again.\n\nPRIORITY IN MULTI-PLAYER GAMES\n\nSometimes, more than two warbands find themselves\nfighting on the same battlefield either allying together to\ntake out hated foes, or in a bloody free-for-all.\nPlayers roll for Priority as normal, using 2D6, but ties are\nhandled differently. Players determine play order based on\ntheir dice score when rolling for Priority. Any ties are rerolled (for example, if four players roll for Priority and score\na 5, 4, 4 and 2, the player that rolled 5 has Priority, the player\nthat rolled 2 goes last and the players that each rolled a 4 roll\noff again to determine who is going second and third).\n\nREADY WARRIORS\n\nDuring this step of the Priority phase, both players place a\nReady marker on each warrior in their warband that is\ncurrently on the battlefield, regardless of Status, Secondary\nStatus or any other Conditions. The Necromunda:\nUnderhive boxed set and the Warband Leader’s Accessories\nPack both contain a number of Ready markers that can be\nused for this. Ready markers should be placed either on the\nwarrior’s Warrior card or next to their model on the\nbattlefield. Once a warrior has been activated, their Ready\nmarker is removed. Under normal circumstances, a warrior\nthat is no longer Ready may not activate again, but players\nshould take note that there are some instances in which a\nwarrior may activate again, notably in the case of some skills\nand Tactics cards."}]},{"id":"actionphase","title":"2.2 The Action Phase","pages":"p. 13","content":[{"page":13,"text":"The Action Phase\nThe Action phase consists of the following steps:\n•\n•\n\nFLEEING THE BATTLEFIELD\nACTIVATE WARRIORS\n\nFLEEING THE BATTLEFIELD\n\nIf either warband has failed a Rout test, Cool checks must be\nmade for each warrior in the warband before any warriors\nactivate. Even warbands who are normally immune to\npsychology (such as Undead) must make Rout tests.\nStarting with the player that holds the Priority marker, each\nplayer makes a Cool check for every one of their warriors on\nthe battlefield, regardless of their Status, Secondary Status or\nany Conditions. If any of these Cool checks are failed, that\nwarrior will immediately flee the battlefield and play no\nfurther part in the battle. Remove the warrior from play. For\nthe purposes of the scenario being played, warriors that flee\nin this way are considered to have gone Out of Action,\nunless the scenario states otherwise.\nLEADING BY EXAMPLE\nWarriors draw courage from their leaders and will follow\ntheir example:\n• If the warband Leader passes their Cool check, any\nfriendly warriors within 12\" are considered to have\npassed their Cool check as well and will not flee the\nbattlefield.\n• If a Champion passes their Cool check, any friendly\nwarriors (not including the Leader or another\nChampion) that are within 6\" are considered to\nhave passed their Cool check as well and will not\nflee the battlefield.\n• Players should remember to consider the role of\nwalls and solid terrain features when measuring the\ndistance between a warrior and an inspirational\nLeader or Champion!\n• If a Leader or Champion is Seriously Injured, their\nCool checks are not eligible for Leading by\nExample.\n\nACTIVATE WARRIORS\n\nThe bulk of the Action phase consists of play alternating\nback and forth between the players and the warband they\ncontrol, activating individual warriors or small groups of\nwarriors. When it is a player’s turn, they must pick one of\nthe warriors from their warband that is Ready and make up\nto two actions with them (this is referred to as ‘activating’\nthe warrior). The actions a Ready warrior can perform are\ngoverned by their current Status and Secondary Status.\nPlayers should note that certain Conditions will also limit\nthe actions a warrior may make, most notably Broken. A\nwarrior subject to the Broken Condition may only make a\nRunning for Cover (Double) action when activated,\nregardless of Status or Secondary Status. If one player runs\nout of warriors to activate, the other player can activate all of\ntheir remaining warriors in an order of their choosing. Once\nall warriors have been activated, even if they performed no\nactions during their activation, the Activation phase ends.\nGROUP ACTIVATIONS\nWhen a player activates their warband Leader or a\nChampion (or the equivalent rank in warbands that use\nother titles for these warriors), they can choose to activate\nadditional Ready warriors that are within 3\" of them when\nthey activate at the same time as part of a Group Activation:\n• A Leader may activate two additional Ready\nwarriors within 3” of them at the start of their\nActivation.\n• A Champion may activate one additional Ready\nwarrior within 3\" of them at the start of their\nActivation.\nIf a Leader or Champion is activated in this way, they may\nnot then perform a Group Activation themselves!\nThe controlling player must nominate all of the warriors\nwho will be activated in this way before any of them are\nactivated. The controlling player must make it clear to their\nopponent which warrior is leading the Group Activation, be\nthey the Leader or a Champion.\nOnce all participants of the Group Activation have been\nnominated, the controlling player picks one and activates\nthem as normal, fully resolving their activation before\npicking the next warrior nominated as part of the Group\nActivation to activate, and so on until the entire group has\nbeen activated. Each warrior activates individually; groups\ndo not activate simultaneously.\nA group activation may not be performed by a leader or\nchampion who is Seriously Injured. In these instances, the\nwarrior is unable to give instructions to fellow warriors."}]},{"id":"types","title":"2.2.1 Types of Action","pages":"p. 14","content":[{"page":14,"text":"TYPES OF ACTION\n\nSTANDING AND ACTIVE WARRIORS\n\nBASIC ACTION\nThe most common type of action a warrior may perform. A\nBasic action can only be performed once per warrior\nactivation. If an activated warrior’s first action is a Basic\naction, they may fully resolve it before declaring their second\naction should they wish.\n\nMOVE (SIMPLE):\nThe warrior may:\n• Move a distance up to their Movement\ncharacteristic.\n• Climb vertically upwards or downwards – see page\n37\n• Cross any gap between two platforms that is no\nwider than their base.\n• Attempt to leap across a bigger gap provided that\nthey have enough movement left to do so – see\npage 37.\n• Attempt to jump down to a level below.\n\nThere are three types of action a warrior may perform when\nactivated:\n\nSIMPLE ACTION\nA warrior can perform the same Simple action more than\nonce during their activation. Each time a Simple action is\nrepeated during an activation, it uses up one action. For\nexample, a Standing and Active warrior may perform two\nMove (Simple) actions, using both of their actions but\nallowing them to move twice. If an active warrior’s first\naction is a Simple action, they may fully resolve it before\ndeclaring their second action should they wish.\nDOUBLE ACTION\nMaking a Double action counts as making two actions. For\nexample, if a Standing and Active warrior makes a Charge\n(Double) action, they will have used both of their actions\nand cannot perform another during this activation. If a\nwarrior can only perform one action during their activation\nfor any reason, they may not perform a Double action\n\nACTIONS\n\nThe following list details some of the common actions\nwarriors may perform in Mordheim.\nThis list is by no means exhaustive however, with skills,\nscenarios, special terrain features and more introducing\nfurther actions that warriors may perform.\n\nCHANGING FACING\n\nA Standing warrior may turn to face any direction they wish\nwhen they are activated, before making either of their\nactions.\n\nSTANDING WARRIORS\n\nStanding warriors can perform a wide range of actions. The\nexact actions available to them depend upon their Secondary\nStatus: Active or Engaged.\n\nWarriors that are Standing and Active are able to perform\nany of the following actions:\n\nCHARGE (DOUBLE):\nThe warrior makes a standard move, the move distance is\ndouble their Movement characteristic. A charging warrior\ncan move to within 1\" of one or more enemy warriors that\nare Standing and either Active or Engaged, or that are Prone\nand either Pinned or Seriously Injured, but if they do move\nto within 1\" they must have sufficient movement to get into\nbase to base contact with at least one enemy warrior,\nbecoming Engaged. If they do not have sufficient movement\nto get into base to base contact, they must stop 1\" away. If\nthey are Engaged at the end of this move, they can\nimmediately make a free Fight (Basic) action.\nTAKE COVER (BASIC): This warrior moves up to half\ntheir Movement characteristic and is then Prone and\nPinned.\nSHOOT (BASIC): The warrior makes an attack with a\nranged weapon.\nAIM (BASIC):\nIf the warrior makes a subsequent Shoot (Basic) action, add\n1 to the result of any hit rolls they make.\nRELOAD (SIMPLE): Pick one of the warrior’s weapons that\nis Out of Ammo, the weapon is reloaded and the Out of\nAmmo condition and marker are removed.\nWeapons that require reloading will have the weapon trait\nRELOAD (X). The (X) number in the brackets is the\nnumber of RELOAD (Simple) actions it takes to reload the\nweapon. For example, RELOAD (2) will take 2 actions (or in\nother words a (Double) action).\nCOUP DE GRACE (SIMPLE): If this warrior is not\nEngaged with any other warriors, pick one Seriously Injured\nenemy warrior within 1\" and within the vision arc of this\nwarrior. That warrior immediately goes Out of Action. A"}]},{"id":"actions","title":"2.2.2 Actions","pages":"p. 14–16","content":[{"page":14,"text":"ACTIONS\n\nThe following list details some of the common actions\nwarriors may perform in Mordheim.\nThis list is by no means exhaustive however, with skills,\nscenarios, special terrain features and more introducing\nfurther actions that warriors may perform.\n\nCHANGING FACING\n\nA Standing warrior may turn to face any direction they wish\nwhen they are activated, before making either of their\nactions.\n\nSTANDING WARRIORS\n\nStanding warriors can perform a wide range of actions. The\nexact actions available to them depend upon their Secondary\nStatus: Active or Engaged.\n\nWarriors that are Standing and Active are able to perform\nany of the following actions:\n\n[ACTIONSEARCH]\n\n[ACTIONCARDS]\nMove|simple|active|The warrior may move up to their Movement characteristic, climb vertically, cross a narrow gap between platforms, attempt to leap a wider one, or jump down to a level below.\nCharge|double|active|A standard move at double Movement. May move to within 1\" of enemy warriors that are Standing (Active or Engaged) or Prone (Pinned or Seriously Injured), but must have enough movement left to reach base contact and become Engaged, or stop 1\" away. Engaged at the end of this move → free Fight (Basic) action.\nTake Cover|basic|active|The warrior moves up to half their Movement characteristic and is then Prone and Pinned.\nShoot|basic|active|The warrior makes an attack with a ranged weapon.\nAim|basic|active|If the warrior makes a subsequent Shoot (Basic) action, add 1 to the result of any hit rolls they make.\nReload|simple|active,pinned|Pick one of the warrior’s weapons that is Out of Ammo — it is reloaded and the Out of Ammo condition/marker is removed. A weapon with the RELOAD (X) trait takes X Reload (Simple) actions to reload.\nCoup de Grâce|simple|active|If not Engaged, pick one Seriously Injured enemy warrior within 1\" and within this warrior’s vision arc — that warrior immediately goes Out of Action. A warrior making a Charge (Double) action may make this instead of a Fight (Basic) if they end their move within 1\" of a Prone and Seriously Injured warrior and are not Engaged.\nEngage|basic|active|The fighter moves D3\" plus a bonus from their Initiative towards an enemy fighter, and can move within 1\" of them provided they end the move Engaged with the target. If they end Engaged, they must immediately make a Fight action or a Coup de Grâce action as a Free action. Otherwise, they must move as close to the target as their remaining movement allows.\n[/ACTIONCARDS]\n"},{"page":15,"text":"STANDING AND ENGAGED WARRIORS\nWarriors that are Standing and Engaged may only perform\nthe following actions:\n\n[ACTIONCARDS]\nFight|basic|engaged|The warrior makes close combat attacks against one or more enemy warriors they are Engaged with.\nRetreat|basic|engaged|Make an Initiative test. On a success, the warrior can make a Move (Basic) action, moving up to their Initiative characteristic instead of their Movement characteristic. Whatever the result, each enemy warrior Engaged with them can make an Initiative test to attempt a Reaction attack (Attacks counted as 1, before modifiers) against the retreating warrior.\nFeed|basic|engaged|Starving warriors only. Replaces a Fight or Coup de Grâce action against a Prone and Seriously Injured warrior. Roll immediately on the Lasting Injuries table (Lesson Learned counts as Out Cold); the warrior loses their Starving condition if the Feed succeeds.\n[/ACTIONCARDS]\n\nWIZARD AND PRIEST ACTIONS\n\nIn Mordheim we commonly refer to spell casters as Wizards.\nSome races use different names, such as warlock, magister,\nshaman, priest or seer, but all of these are considered to be\ntypes of Wizard.\nWizards can cast Spells and Priests can use Prayers. Prayers\nare the same as Spells, they use the same actions, the only\ndifference is items and abilities that protect against spells\nwill not protect Prayers.\nWizards can make the following actions:\n\n[ACTIONCARDS]\nCast Spell (X)|Wizard|wizard|Also used for Prayers. The caster makes a Willpower check with the spell’s Difficulty modifier. Success: the spell takes effect immediately. Failure: no effect, the action is wasted. A failed check on a double 6, or a passed check on a double 1, forces an immediate roll on the Magical Miscast table (a double-1 success also cannot be Dispelled). Cannot be performed while wearing armour or using a shield/buckler — Priests are the exception.\nMaintain Control|Free|wizard|A free action — the Wizard can still make two other actions this turn. Used to maintain a Continuous Effect: make a Willpower check with the spell’s Difficulty modifier, at -1 to the roll. Failure, or not performing this action, ends the Continuous Effect at the start of this activation. A Wizard can only maintain one Continuous Effect at a time, and it ends immediately if the Wizard is Seriously Injured or taken Out of Action.\n[/ACTIONCARDS]\n"},{"page":16,"text":"PRONE WARRIORS\n\nBROKEN WARRIORS\n\nWarriors can be subject to the Broken Condition. Any warrior subject to the Broken Condition must perform a Running for Cover (Double) action when activated (see the action card below). When a Broken warrior moves they must attempt to end their move, in order of priority:\n1. So that they are more than 3\" away from enemy warriors.\n2. So that they are out of line of sight of enemy warriors.\n3. In partial or full cover.\n4. As far away from any enemy warriors as possible.\n\nIf a Broken warrior is Standing and Engaged when activated, they must make an Initiative check. If it is passed, they must move as described above. Each enemy warrior that is Engaged with them makes an Initiative check and if passed can make Reaction attacks before the Broken warrior is moved. If the Broken warrior fails the Initiative check, they remain Engaged and can perform no further actions.\n\nPRONE AND PINNED WARRIORS\n\nWarriors that are Prone are only able to perform a limited number of actions. The exact actions available to them depend upon their Secondary Status – whether they are Pinned or Seriously Injured.\n\n[ACTIONCARDS]\nStand Up|basic|pinned|The warrior stands up, returning to Active status. The controlling player chooses the warrior’s facing.\nCrawl|double|pinned,injured|The warrior may move up to half of their Movement characteristic. (Reload (Simple) is also available to a Pinned warrior — see above.)\nRunning for Cover|double|active,pinned,injured|Mandatory for a Broken warrior when activated. Standing and Active warriors move 2D6\"; Prone and Pinned or Prone and Seriously Injured warriors move half their Movement characteristic.\n[/ACTIONCARDS]"}]},{"id":"movement","title":"2.2.3 Movement","pages":"p. 17","content":[{"page":17,"text":"Movement\nDuring the Action phase, a number of actions allow a warrior to move in different ways, as detailed previously. Sometimes a\nwarrior may even be moved involuntarily as a result of an enemy attack or an in-game effect. This section deals with how warriors\nare moved around the tabletop and how terrain can hinder their progress.\n\nMOVING MODELS\nWarriors move by making actions. For example, a warrior\nmight make a Move (Simple) action to advance cautiously,\nor may make two Move (Simple) actions in quick succession\nto run forward and cover a lot more ground. A warrior\nmight Charge (Double) to get into combat, or Crawl\n(double) to get out of the firing line.\nA warrior is not obliged to move their full movement\nallowance, they can move any distance up to their\nmovement allowance, but they cannot move further.\nMovement need not be in a straight line, a warrior can\nzigzag around terrain as appropriate, though note that a\nCharge (Double) action should take the shortest route\npossible. After moving, a warrior can turn to face any\ndirection.\nAll Move actions must be declared before any measuring is\ncarried out. Sometimes, after a warrior’s declared movement\nis measured, it may become obvious that a warrior does not\nhave as much movement as hoped and will end their\nmovement short of where they had planned. In this case,\nmove the warrior as far as possible in the desired direction,\nand try to make good use of any available cover! In the case\nof a Charge (Double) action, if a warrior has insufficient\nmovement to make it into base to base contact with an\nenemy warrior, they must still move the full distance\n(stopping 1\" away, as follows) and may often end their\nmovement in a very dangerous position!\nFighters can move through friendly fighters.\n\nTHE 1\" RULE\nWarriors cannot move to within 1\" of any enemy warrior\nduring their activation, unless that enemy warrior is Prone\nand Seriously Injured. The only exception to this rule is\nwhen a Standing and Active warrior makes a Charge\n(Double) action, in which case they may move within 1\" of\none or more enemy warriors, provided that they end their\n\nmovement in base to base contact with one or more enemy\nwarriors. If a warrior making a Charge (Double) action has\nsufficient movement to get within 1\" of an enemy warrior\nbut does not have sufficient movement to make it into base\nto base contact with and Engage the enemy warrior, they\nmust stop moving 1\" away.\nIt may occur that a warrior is moved involuntarily to within\n1\" of an enemy warrior. For example, a warrior with the\nHurl skill may throw an enemy warrior that they are\nEngaged with, which may result in that warrior coming into\ncontact with other warriors, friendly or enemy. Should this\nhappen, the normal rules described previously are\ntemporarily suspended until the movement and any other\neffects it causes have been fully resolved (such as in the\nprevious Hurl example, in which case the warriors would\nsuffer hits as a result of coming into contact with one\nanother). Once they have been and if neither warrior is\nProne and Seriously Injured, move the warrior that was\ninvoluntarily moved by the shortest route possible until they\nare 1\" away from the enemy warrior.\n\nDIRECTLY TOWARDS AND DIRECTLY\nAWAY FROM\n\nSometimes the rules will say that a warrior needs to move\ndirectly towards another warrior. To do this, trace an\nimaginary straight line that crosses the centre of each\nwarrior’s base – the moving warrior then moves towards the\nother warrior along this line the required distance. Similarly,\nto move directly away from another warrior, follow the same\nmethod but move the moving warrior away.\nAs always, this cannot make a warrior move through a wall,\nimpassable terrain or a closed door. Should they contact one\nof these features, they stop and do not move further."}]},{"id":"terrain","title":"2.2.4 Terrain","pages":"p. 18–19","content":[{"page":18,"text":"Terrain\nAs mentioned previously, terrain features prominently in games of Mordheim. One of the most obvious ways in which warbands\nand warriors interact with terrain is when they attempt to move through and over it. The following section covers the various ways\nin which terrain affects a warrior’s movement.\n\nDIFFICULT TERRAIN\nPools of toxic sludge, areas of fallen rubble and broken or\nmissing walkways sections – there are numerous things in\nthe city of damned that can make the terrain difficult to\ncross.\nFor every 1\" a warrior moves through any terrain designated\nas difficult terrain when setting up the battlefield, they count\nas having moved 2\".\n\nDANGEROUS TERRAIN\nVats of molten metal, spinning turbines set into the floor\nand more – any terrain feature designated as dangerous\nwhen setting up the battlefield can pose a huge risk to\nwarriors crossing it.\nA Warrior treats Dangerous Terrain as Difficult Terrain\nwhen determining how far they can move\nAdditionally, after moving through Dangerous Terrain, a\nfighter must make an Initiative test (a roll of 6 is always a\nfailure):\nOn a failure, they immediately suffer 1 wound with no saves\nallowed.\nOn a success, nothing happens.\n\nOBSTACLES\nObstacles are any free standing terrain feature measuring no\nmore than 2\" high and no more than 2\" across, such as\nbarricades, barrels and pipelines. Warriors may cross\nobstacles as they move, but doing so reduces their\nmovement by a number of inches equal to the height of the\nobstacle. A warrior may not end their movement on top of\nan obstacle.\n\nSTRUCTURES\nStructures are any terrain feature measuring more than 2\"\nhigh and more than 2\" across, be they free standing or\nconnected to other terrain features in some way. Warriors\nmay climb up and onto structures and between the various\nlevels and platforms of a structure as they move and may\nend their movement on any level of a structure if there is\nsufficient space for their base. See ‘Climbing’ below.\n\nCLOSE COMBAT ACROSS BARRICADES\nA warrior who is in base contact with a barricade counts as\nbeing Engaged with a warrior that is in base contact with the\nother side of the barricade, even though their bases are not\ntouching, as long as the two warriors are within ½\" of each\nother. Close combat attacks made across a barricade in this\nway have a -1 modifiers to any hit roll.\n\nIMPASSABLE TERRAIN AND SOLID TERRAIN\nFEATURES\nZone Mortalis walls and closed doors are always impassable.\nAny suitable terrain on a Sector Mechanicus battlefield may\nbe designated as impassable when setting up the battlefield.\nSuch terrain on a Sector Mechanicus battlefield should also\nbe designated as a solid terrain feature for the purposes of\nline of sight and measurement, as described previously.\nWarriors may not move across impassable terrain.\n\nCLIMBING\n\nWarriors can climb up or down any vertical surface to reach\na higher level or platform of a structure during their\nmovement. For every 1\" a warrior moves vertically by\nclimbing, they count as having moved 2\". A warrior cannot\nend their activation mid-climb; they must have sufficient\nmovement to reach a flat surface. If they cannot, they will\nstay where they were when the action was declared.\nPlayers should note that a warrior may end a Move (Simple)\naction mid-climb, provided that they are able to\nimmediately use another action to complete the climb.\nSTEPPING UP: During a warrior’s move, a warrior may\nfreely ‘step up’ onto another level or platform of a structure,\nprovided that it is no more than 1⁄2\" higher than the level\nthey are currently on. If the difference in height is more than\n1⁄2\", they must climb as described above.\nOVERHANGS: When climbing, a warrior can traverse an\noverhang as long as it protrudes no more than 1\" from the\nvertical surface. Overhangs that protrude more than 1\" are\nconsidered impassable to a climbing warrior.\nLADDERS AND STAIRS: When climbing a ladder or stairs\nbetween the levels of a structure, there are no modifiers to a\nwarrior’s movement.\n\nLEAPING GAPS\n\nA moving warrior may attempt to leap across a gap that is\nbigger than their base, provided that they have enough\nMovement to do so. The warrior stops at the edge and\nmakes an Initiative check. If they pass, they leap the gap and\nmay continue moving. If they fail, they will fall straight\ndown by the shortest possible route to the next level down\nand will suffer a hit as follows."},{"page":19,"text":"JUMPING DOWN\n\nA warrior may attempt to jump down to a level below. They\nmust pass an Initiative check with no modifier for the first 2\"\njumped, but with a cumulative -1 modifier for every\nadditional 2\" jumped (rounded up). If the check is failed,\nthey fall and will suffer a hit as described below.\n\nFALLING HAZARDS\n\nA warrior is at risk of falling if they go from Standing to\nProne whilst within 1⁄2\" of the edge of a level or platform.\nShould this happen, the warrior must make an Initiative\ncheck. If the check is passed, nothing happens. If the check is\nfailed or if a natural 1 is rolled, the warrior will fall as\ndescribed below.\nRAILINGS: If the nearest edge of a level or platform is\nbounded by a railing, low wall or similar barrier at least 1⁄2\"\ntall, the chance of falling is reduced. Add 1 to the result of\nthe Initiative check to see if the warrior falls.\n\nFALLING\nIf a warrior falls 3\" or more, they will take a hit as described\non page 45 based on how far they fell, rounded up to the\nnearest inch:\n[TABLE]\nDistance Fallen|Strength|AP|Damage\n*3'' – 5''|*3|*—|*1\n*6'' – 7''|*5|*-1|*1\n*8'' – 9''|*7|*-2|*2\n*10'' +|*9|*-3|*3\n[/TABLE]\n\nA falling warrior is immediately Prone and Pinned and their\nactivation ends. If they land on top of another warrior, they\nare also Pinned and suffer a hit identical to that taken by the\nfalling warrior. Move the falling warrior the shortest possible\ndistance so that the two are not overlapping. Once the hits\nhave been resolved, and if neither warrior is Prone and\nSeriously Injured, if the falling warrior fell on an enemy\nwarrior, move the warrior that fell by the shortest route\npossible until they are 1\" away from the enemy warrior.\nIf a falling warrior lands within 1⁄2\" of a platform edge, they\nmust pass an Initiative check or will fall again.\ninto it)."}]},{"id":"shooting","title":"2.2.5 Shooting","pages":"p. 20–21","content":[{"page":20,"text":"Shooting\nThere are several ways in which a warrior may make a\nranged attack against an enemy, most frequently by making\na Shoot (Basic) action, but certain skills and Tactics cards\nwill also allow warriors to make a ranged attack outside of\nthe game’s normal sequence.\nWhenever a warrior makes an attack against one or more\nenemy warriors with a ranged weapon, this sequence is\nfollowed:\n1. DECLARE THE SHOT\n2. CHECK THE RANGE\n3. MAKE THE HIT ROLL\n4. TARGET IS PINNED\n5. RESOLVE HITS\n\n•\n\n•\n•\n•\n•\n\n•\n•\n\n1. DECLARE THE SHOT\nPick a ranged weapon carried by the warrior, and pick an\neligible enemy.\nTARGET PRIORITY\nA warrior must target the closest eligible target when\nmaking a ranged attack. An enemy warrior is an eligible\ntarget if they are within the vision arc and line of sight of the\nattacker, even if they are Engaged by a friendly warrior.\nHowever, if the closest eligible target is Seriously Injured or\nharder to hit than one further away, the attacker may choose\nto ignore them. Otherwise, to attack an eligible target that is\nnot the closest, the attacker must first pass a Cool check.\nPRONE TARGETS\nThe attacking warrior cannot target an enemy if the enemy\nis both Prone (either Pinned or Seriously Injured) and in\npartial or full cover – they are assumed to be keeping their\nhead very low!\n\n2. CHECK THE RANGE\nMeasure the range from the attacker to the target. If the\ntarget is outside the weapon’s Long range, the attack\nautomatically misses. The with the Reload (x) trait will still\nneed to be reloaded.\n\n3. MAKE THE HIT ROLL\nTo determine whether a shot hits its target, roll a D6. The\ndice score needed will depend upon how good a shot the\nfirer is (as indicated by his Ballistic Skill). The chart below\nshows the minimum D6 roll needed to score a hit. (A roll of\n1 is allways a faillure)\n[TABLE]\nBS of Shooter|1|2|3|4|5|6|7|8|9|10\nD6 Roll Needed|*6|*5|*4|*3|*2|*1|*0|*-1|*-2|*-3\n[/TABLE]\n\n•\n\n•\n\nIN PARTIAL COVER (-1): The target is in partial\ncover, apply the modifier.\nIN FULL COVER (-2): The target is in full cover,\napply the modifier.\nLONG RANGE(-1): The target is more than half of\nyour weapon’s maximum range away.\nTARGET IS ENGAGED (-1): If the target is\nStanding and Engaged, apply the modifier.\nTARGET IS PRONE (-1, LONG RANGE ONLY):\nIf the target is Prone (either Pinned or Seriously\nInjured) and the attacker is firing at Long range,\napply the modifier.\nBRACE OF PISTOLS (-1): The warrior attacks\nwith two weapons with the Pistol trait.\nTARGET MOVED FAST (-1): If the target moved\n10’’ or more this round.\nSMALL TARGET (-1): The whole target is less\nthan 1/2\" tall or wide. Warband models are always\nlarger than this, even if modelled smaller! Firing a\nBlast Template is always considered to be targeting\na small target.\nLARGE TARGET (+1): The whole target is 2’’ wide\nor tall.\n\nIMPROBABLE SHOTS: If the hit modifiers applied to a\nranged attack mean that it is impossible to score a hit, the\nattack is an Improbable Shot. To make a hit roll for an\nImprobable Shot, roll a D6. On a 1-5, the attack misses. On a\n6, there is a chance that it will hit; make a hit roll as normal,\nusing only the warrior’s Ballistic Skill and ignoring any other\nmodifiers.\nROLLS OF A NATURAL 1: If, when making a ranged\nattack, the hit roll is a natural 1, the attack automatically\nmisses, regardless of any modifiers that may apply.\n\n4. TARGET IS PINNED\n\nWhen a Standing and Active warrior is hit by a ranged\nattack that has the Black Powder trait, they are automatically\nplaced Prone and Pinned. Players should note that a\nStanding and Engaged warrior cannot become Prone and\nPinned.\nOnly weapons with the Black Powder trait have the Pinned\nrule as standard. If a warrior is hit by any other missile\nweapon they are not Pinned (unless specifically stated)."},{"page":21,"text":"5. RESOLVE HITS\n\nEach attack that scores a hit is resolved as described below\nBLAST MARKERS\nIf attacking with any weapon with the Blast (X) trait, a\nwarrior may target a point on the tabletop instead of an\neligible enemy warrior, using a Blast marker.\n• Place the appropriately sized Blast marker\n(determined by the number in brackets after the\ntrait on the weapon’s profile) so that the central\nhole is anywhere within line of sight of the warrior\nmaking the attack.\n• If the central hole is beyond the Long range of the\nweapon, the attack still goes ahead but the Blast\nmarker is moved directly back towards the\nattacking warrior until the central hole is within\nrange.\n– Roll a Scatter dice and 2D6. The marker moves in the\ndirection shown by the Scatter dice (using the small arrow if\nthe Hit symbol is rolled) a number of inches equal to the\nnumber rolled on the 2D6 substraticting the BS of the\nshooting model. The marker will stop moving if the central\nhole comes into contact with a wall, structure or impassable\nterrain feature.\n• Once the Blast marker’s position has been\nestablished, each warrior (friend and enemy) whose\nbase is beneath the Blast marker is hit by the attack\n(unless there is a wall or solid terrain feature\nbetween them and the centre of the Blast marker).\n• Follow steps 4 and 5 of the Shooting sequence as\nnormal for each warrior hit, in an order of the\nattacking player’s choice.\nPlayers should note that, after scattering, the Blast marker\nmay end beyond the weapon’s range or out of line of sight.\nFLAME TEMPLATES\nIf attacking with any weapon with the Template trait, the\nweapon will make use of the Flame template to determine\nwhich warriors are hit by the attack.\n• During step 1 of the Shooting sequence, instead of\ndeclaring an enemy to be the target of the attack,\nplace the Flame template so that the narrow end is\n\ntouching the attacking warrior’s base and the entire\ntemplate is within their vision arc.\n• Each warrior (friend and enemy) whose base is\nbeneath the template is hit automatically by the\nattack (unless there is a wall or solid terrain\nfeature between them and the warrior making the\nattack).\nFollow steps 4 and 5 of the Shooting sequence as normal for\neach warrior hit, in an order of the attacking player’s choice.\nSTRAY SHOTS\nIf an attack with a ranged weapon misses, there is a chance\nthat other warriors, friendly or enemy, that are Engaging the\ntarget, or that are within 1\" of the line along which the range\nbetween the attacker and the target was measured, will be\nhit.\nIf the attack misses, roll a D6 for each warrior that is at risk\nof being hit, starting with the warrior closest to the attacker.\nOn the roll of 1, 2 or 3, the warrior is hit by the attack. On a\n4, 5 or 6, the shot misses them - move on to the next warrior\nat risk of being hit. If the attack would have caused more\nthan one hit, follow this sequence for every hit.\nEditor’s Note: Warriors engaged with the target who are\nfurther away may be hit by a Stray Shot.\nBRACE OF PISTOLS\nIf a warrior is armed with two weapons with the Pistol trait,\nthey can choose to attack with both of them as part of a\nsingle Shoot (Basic) action. Make the hit roll for each\nweapon before resolving any hits scored. Both attacks must\nbe made against the same target and the hit roll for each\nsuffers a -1 modifier."}]},{"id":"combat","title":"2.2.6 Close Combat","pages":"p. 22–23","content":[{"page":22,"text":"Close Combat\nWarriors that are Standing and Engaged with an enemy\nwarrior may make close combat attacks against them. Most\noften, this is done by performing a Fight (Basic) action –\neither on its own or as part of a Charge (Double) action – or\nby making Reaction attacks after an enemy warrior they are\nEngaged with has resolved a Fight (Basic) action against\nthem. Additionally, certain skills and Tactics cards will also\nallow warriors to make a close combat attack outside of the\nnormal sequence of the game.\n\nPISTOLS AT CLOSE QUARTERS: A weapon with the\nPistol trait can only have one Attack dice allocated to it. Any\nremaining attacks must be allocated to a weapon with the\nMelee trait. If a warrior has no other weapons with the\nMelee trait, any remaining attacks must be Unarmed\nattacks, as described above.\nIf a warrior attacks with a weapon with the Pistol trait in\nclose combat, shooting modifiers do not apply – this is only\nused when making ranged attacks.\n\nWhen a combat is resolved as a result of a fighter making a\nFight action, each fighter makes their attacks in an order\ndetermined by their Initiative, following the steps below.\n\n4. DECLARE TARGETS\n\n1. TURN TO FACE\n2. PICK WEAPONS\n3. DETERMINE ATTACK DICE\n4. DECLARE TARGETS\n5. DETERMINE INITIATIVE\n6. MAKE HIT ROLL(S)\n7. RESOLVE HITS\n8. CONSOLIDATE\n\n1. TURN TO FACE\nThe attacking warrior may turn to face any direction.\nDoing so reduces the result of any hit roll by 1. This\nmodifier is cumulative with any others. For example, if a\nwarrior that is Broken turns to face before making a\nReaction attack, they will reduce the result of any hit roll by\na total of 3.\n\n2. PICK WEAPONS\nThe active fighter chooses a weapon with the Melee trait as\ntheir primary weapon. But only one if it also has the\nUnwieldy trait. If they have two close combat weapons, in\nany combination, they can choose another of those\nweapons as their secondary weapon.\nAll other fighters choose a close combat weapon as their\nprimary weapon.\n\n3. DETERMINE ATTACK DICE\nThe number of Attack dice rolled is equal to the warrior’s\nAttacks characteristic, plus the following modifiers:\n• Primary weapon — The number of Attack dice is\nequal to the fighter's Attacks characteristic\n\n• Secondary weapon — The fighter makes only one\nattack with their secondary weapon or sidearm.\nAll other fighters make only one attack with their primary\nweapon, regardless of their Attacks characteristic. Certain\nskills and traits may modify this.\n\nDeclare a target enemy warrior that is A) Engaged with the\nattacker and B) within their vision arc. Attacks can be split\nbetween eligible enemy warriors as the player wishes.\n\n5. DETERMINE INITIATIVE\n• If the primary or secondary weapon has the Fight Last\ntrait, the fighter's Initiative is set to 1 before applying\nany other modifiers.\n• If the fighter successfully made a Charge action during\nthis activation, their Initiative is then increased by 1.\nEach fighter resolves their attacks in order of their modified\nInitiative, unless they have been taken Out of Action or have\nbecome Seriously Injured / Damaged as a result of a fighter\nacting with a higher modified Initiative.\n\n6. MAKE HIT ROLL(S)\nMake a To Hit roll for the attacking warrior with each\nAttack dice. Roll separately for different weapons and/or\ndifferent targets.\n[TABLE]\nAttacker's WS vs Defender's WS|D6 Roll Required\nIs the Attacker's WS TWICE the Defender's WS or greater?|*2+\nIs the Attacker's WS GREATER than the Defender's WS?|*3+\nIs the Attacker's WS EQUAL to or LOWER than the Defender's WS?|*4+\nIs the Attacker's WS MORE THAN HALF the Defender's WS or lower?|*5+\n[/TABLE]"},{"page":23,"text":"TO HIT MODIFIERS\nApply the following modifiers to the D6 roll required to hit.\n•\n•\n•\n\n•\n\n•\n\n•\n\nASSISTS (+?): See below\nINTERFERENCE (-?): See below.\nHIGHER UP (+1): If your warrior is standing on a\nhigher level, platform, or slope then add +1 to their\nto Hit roll.\nOBSTACLE (-1): If you charge an enemy who is\nsheltering behind cover such as a low wall, then you\nsuffer a -1 penalty on your to Hit score that turn.\nNote this penalty only applies during the round\nwhen you charge.\nTURN TO FACE (-1): The attacking warrior may\nturn to face any direction. Doing so reduces the\nresult of any hit roll\nREACH (-1): If the enemy warrior’s reach (Melee\nX) is greater than your weapons reach (Melee X),\nyou suffer -1 to hit. In the case of warriors with\ndual weapons, use the reach of the longest weapon.\n\nROLLS OF A NATURAL 1: If, when making an attack, the\nhit roll is a natural 1, the attack automatically misses,\nregardless of any modifiers that may apply.\nASSISTS AND INTERFERENCE\nEngaging more than one opponent is much more difficult\nthan Engaging a lone warrior. When making close combat\nattacks, a warrior can claim ‘assists’ from friendly warriors\nwho are also Engaged with the target of the attack, and can\nsuffer ‘interference’ from enemy warriors other than the\ntarget of the attack who are also Engaged with them.\nASSISTS\nWhen a warrior makes a close combat attack, they can claim\nan assist from each other friendly warrior that is:\n\n•\n•\n\nEngaged with the target of the close combat attack.\nNot Engaged with any other warriors from the\nsame warband as the target of the attack.\nEach assist claimed in this way adds 1 to the result of the hit\nroll.\nINTERFERENCE\nWhen a warrior makes a close combat attack, they may\nsuffer interference from each other enemy warrior that is:\n• Engaged with the attacker.\n• Not Engaged with any other warriors from the\nsame warband as the attacker.\nEach interference subtracts 1 from the result of the hit roll.\n\n6. RESOLVE HITS\nEach attack that scores a hit is resolved as described on page\n45.\n\n7. CONSOLIDATE OR COUP DE GRACE\nIf all enemy fighters that the active fighter was Engaged with\nare now Out of Action or Seriously Injured / Damaged, they\ncan move up to a distance equal to their Initiative, in inches,\nin any direction.\nDuring this move, they can move within 1\" of enemy\nfighters, but must end their move at least 1\" away from all\nenemy fighters."}]},{"id":"resolve","title":"2.2.7 Resolve Hit","pages":"p. 24–25","content":[{"page":24,"text":"Resolve hits\nWhen a warrior suffers a successful hit, follow this sequence:\n1. MAKE WOUND ROLL\n2. MAKE A SAVE ROLL\n3. INFLICT DAMAGE\n\nARBITRATOR’S NOTE: HIT RESOLUTION\nORDER\n\nAll hits (ie the many hits from a single attacker’s multiple\nclose combat hits, the results of BRACE OF PISTOLS) are\nassumed to occur at the same time, before the consequences\nof each hit (for example being knocked back, becoming\npinned and falling into cover, etc) occurs.\n\n1. MAKE WOUND ROLL\n\nCross reference the weapon’s Strength with the hit warrior’s\nToughness and roll on the table below to determine if the\nwarrior is wounded by the attack:\n[TABLE]\nStrength vs Toughness|D6 Roll Required\nIs the Strength TWICE the Toughness or greater?|*2+\nIs the Strength GREATER than the Toughness?|*3+\nIs the Strength EQUAL to the Toughness?|*4+\nIs the Strength LOWER than the Toughness?|*5+\nIs the Strength HALF the Toughness or lower?|*6+\n[/TABLE]\n\n2. MAKE A SAVE ROLL\n\nIf a hit results in a successful wound roll, or leads to an\nInjury roll being made against the warrior for any reason,\nthe warrior may be able to make a save roll.\nOnly one save roll may be made for each hit that successfully\nwounds, or leads to an Injury roll being made, regardless of\nhow many different save rolls a warrior may have.\nArmour saves are made either:\n• After the Wound roll is made but before the\nWound is removed from the warrior, in which case\nthe Wound is ‘saved’ and not removed.\n• If the attack has a Damage ‘-’ characteristic and\ncauses an Injury dice to be rolled against the\nwarrior for any reason, a save roll is made before\nany Injury dice are rolled.\nPlayers should note that some weapon traits will disallow\nsave rolls. For example, the Gas Weapon Trait states that no\n\nsave roll can be made. In such cases, regardless of any\nmodifiers, no save roll can be made.\n\nARMOUR PENETRATION: It may happen that the AP\ncharacteristic of a weapon is greater than the save roll\ngranted by the armour a warrior wears, thus cancelling out\nthe save roll. For example, a warrior wearing mesh armour\nhas a save roll of 5+, but if they are hit by a weapon with AP\n-3, no save roll would be possible.\nPOSITIVE SAVE MODIFIERS: In some situations, such as\nsome weapon traits, a warrior’s save roll may be improved.\nIn such situations, this positive modifier may be added to a\nwarrior’s normal save roll. For example, if a warrior wearing\nlight armour (6+ save) gains a +1 modifier to their save roll,\ntheir armour save is now (5+).\nIf a warrior not wearing armour benefits from a positive\nsave modifier, treat their save as 6+ for the purposes of\nmodification. For example, if a warrior wearing no armour\ngains a +2 save modifier, they will be able to make a save roll\nof 5+.\nWARD SAVES: A ward save represents some kind of rare\nmagical protection, be it a spell, enchanted armour or\nperhaps even the innate nature of a Daemon or other\nmagical creature. The value of the ward save will always be\nshown in the warriors entry, Daemons for example have a\nWard Save(5+). The key difference ward saves and armour\nsaves is that wards saves are never modified by AP or\nanything. If a model has more than one wards save only\nmake one roll for the best.\nSometimes a warrior has both an armour save and a ward\nsave. In this case, the warrior takes its armour save as\nnormal first. If the armour save is failed (or modified to the\npoint at which the warrior cannot pass it) then the warrior\ntakes its ward save."},{"page":25,"text":"3. INFLICT DAMAGE\n\nDamage is inflicted following a successful unsaved wound\nroll, as follows:\n1. Each point of Damage caused by a weapon removes one\nWound from a warrior.\n2. When a warrior is reduced to 0 Wounds by Damage from\nan attack, immediately roll one Injury dice and apply the\nresult to the warrior (see below).\n3. If the weapon has additional points of Damage to cause\nafter the last Wound has been removed, immediately roll an\nadditional Injury dice for each and apply the result to the\nwarrior.\nFor example, if a warrior with two Wounds is hit by a\nweapon that causes three points of Damage, two Injury dice\nwill be rolled. The first point of Damage removes a Wound,\nthe second reduces the warrior to 0 Wounds and one Injury\ndice is rolled, and the third and final point of Damage will\ncause another Injury dice to be rolled.\n\nINJURY DICE\n\nWhen any number of Injury dice are rolled against a warrior\nfor any reason, apply the results of each individual dice as\nfollows:\n\n•\n•\n\n•\n\nOUT OF ACTION: The warrior is immediately\nremoved from play.\nSERIOUS INJURY: The warrior is placed Prone\nand laid face-down. They may successfully\nrecover in a later End phase. If this injury was\ninflicted in close combat, the warrior may be\nvulnerable to a Coup de Grace action\nFLESH WOUND: The warrior suffers a Flesh\nWound, reducing their Toughness\ncharacteristic by 1. If a warrior is reduced to\nToughness 0, they go Out of Action.\n\nINJURY DICE CHART\n[TABLE]\nD6|Result\n*1-2|Flesh Wound\n*3-5|Serious Injury\n*6|Out of Action\n[/TABLE]\n\nDAMAGE ‘ - ’ WEAPONS\nA weapon with a Damage characteristic of ‘-’ does not\ncause Damage in the usual way and will not cause a\nwarrior to lose a Wound. Such weapons cause injuries\nthrough the use of deadly poisons, venoms or gas.\nConsequently, if any Injury dice are rolled against a\nwarrior as the result of an attack made by a Damage ‘-’\nweapon, the result(s) of the Injury dice are applied as\nnormal. No Wounds are removed from the warrior.\nThe warrior may suffer a Flesh Wound, indicating they\nhave been weakened by the attack, may suffer a Serious\nInjury, representing their struggle to shake off the effects\nof the attack, or may be taken Out of Action as they\nsuccumb to the effects of the weapon.\n\nFALLING\n\nIf a warrior falls 3\" or more, they will take a hit based on how\nfar they fell, rounded up to the nearest inch:\n[TABLE]\nDistance Fallen|Strength|AP|Damage\n*3'' – 5''|*3|*—|*1\n*6'' – 7''|*5|*-1|*1\n*8'' – 9''|*7|*-2|*2\n*10'' +|*9|*-3|*3\n[/TABLE]\n\nLASTING INJURIES\n\nIf a warrior goes Out of Action during a campaign game, for\nany reason, immediately roll on the Lasting Injury Chart\nand apply the result:\n[TABLE]\nD66|Lasting Injury\n*11|Lesson Learned. Into recovery, +D3 Experience.\n*12-26|Out Cold. No effect.\n*31-45|Grievous Injury. Into recovery.\n*46|Humiliated. Into recovery, -1 Ld and Cl.\n*51|Head Injury. Into recovery, -1 Int and Wil.\n*52|Eye Injury. Into recovery, -1 BS.\n*53|Hand Injury. Into recovery, -1 WS.\n*54|Hobbled. Into recovery, -1 M.\n*55|Spinal Injury. Into recovery, -1 S.\n*56|Enfeebled. Into recovery, -1 T.\n*61-65|Critical Injury. Dead, unless saved by a Physician.\n*66|Memorable Death. Dead – attacker gains +1 Experience.\n[/TABLE]"}]},{"id":"psychology","title":"2.2.8 Psychology","pages":"p. 26","content":[{"page":26,"text":"Psychology\n\nFEAR\nFear is a natural reaction to huge or horrifying creatures. A\nwarrior must make a Cool check in the following situations.\n• If the warrior is charged by a warrior or a creature\nwhich causes fear. If a warrior is charged by an\nenemy that he fears then he must take a test to\novercome that fear. Check when the charge is\ndeclared and is determined to be within range. If\nthe check is passed the warrior may fight as normal.\nIf it is failed, the warrior has its WS reduced to 1.\n• If the warrior wishes to charge a fear-causing\nenemy. If it fails the warrior is paralysed with fear\nmay not charge and cannot perform any actions\nthat turn.\nNote, warriors that cause Fear ignore Fear tests. Warriors\nwhich cause Fear treat Terror as Fear instead.\nFRENZY\nWhen a warrior with Frenzy activates, if there are enemy\nwarriors in charge range, they must perform a Charge\n(double) action and perform a Fight (Basic) action. The\nplayer may make a Cool check to avoid this if they wish.\nIn close combat a Frenzied warrior gains an extra attack dice\nbut cannot use the Parry Skill or Parry weapon trait.\nOnce they are within charge range, Warriors with Frenzy\ngain the Immune to Psychology special rule, and don’t have\nto take Fear, Panic or Stupidity tests as long as they remain\nwithin charge range.\nDuring the battle, if a Warrior with Frenzy is Seriously\nInjured or Broken and then recovers, he is no longer\nfrenzied. The warrior loses the Frenzy ability for the rest of\nthe battle.\nHATRED\nWhen a warrior with Hatred activates check if:\n• There is an enemy warrior within their maximum\nCharge range. If so then they must Charge the\nenemy and perform a Fight(Basic) action.\n• The warrior must shoot at a visible Hated enemy\n(and does not need to target nearest enemy).\n• The warrior will always perform a Coup de Grace\naction against a Hated enemy that has been\nSeriously Injured in close combat.\nA warrior with Hatred may make a Cool check to avoid the\nabove. If successful then the warrior does not suffer Hatred.\nWarriors who fight enemies they hate in close combat may\nre-roll any misses when they charge, or if charged they may\nreroll any misses for reaction attacks. The warrior has +1\nCool (to max of CL 10) while fighting a Hated enemy in\nclose combat.\n\nPANIC TESTS\nWarriors must take a Panic check when a friendly warrior is\nSeriously Injured or taken Out of Action within 3\" of them.\nAll warriors must check regardless of their Status and\nSecondary Status, though it should be noted that some\nwarriors may be subject to a special rule that makes them\nimmune to Panic tests.\nTo make a Panic check, make a Cool check for the warrior,\nadd +1 to their Cool for each friendly warrior within 3\" of\nthem that is not Broken and is not Prone and Seriously\nInjured. If the check is passed, nothing happens. If the check\nis failed, the warrior becomes Broken. Place a Broken\nmarker on their Warrior card.\nBROKEN WARRIORS\nWhen a warrior becomes Broken, they will immediately\nmake a Running for Cover (Double) action as described\nabove. If the warrior is Ready, they lose their Ready marker.\nBroken warriors may be rallied in the End phase. When a\nBroken warrior activates in a subsequent round, they may\nnot make any actions other than Running for Cover\n(Double). If a Broken warrior is Engaged by an enemy\nwarrior, they may only make Reaction attacks with a -2\nmodifier.\n\nSTUPIDITY\nStupidity represents a creature’s tendency to do exactly the\nwrong thing! The warrior might be absent minded, it might\nrepresent shock, being easily distracted, animalistic\nbehaviour, or even a mental disorder.\nIf a friendly Leader or Champion is within 6\" (that isn't\nSeriously Injured or Broken) then there is no need to make a\nStupidity check as they keep the warrior’s mind focused.\nWhen a warrior with Stupidity activates make an\nIntelligence check. If you pass all is well – the warrior may\nmove and fight as normal.\nIf the Intelligence check failed the warrior will make no\nactions this turn. If a warrior who fails a Stupidity check is\nnot Engaged, roll a D6.\n1-3\nThe warrior makes one Move (Simple) action in a\nrandom direction. They will not charge an enemy\n(stop his movement 1\" away from any enemy he\nwould have come into contact with). If the warrior\ncomes within 1/2\" of an edge (of a building) it must\ntake an Initiative check or fall off (see Falling). If\nthe warrior walks into an obstacle it will stop\nmoving.\n4-6\nThe warrior stands inactive and performs no\nactions this turn. They are probably distracted by\nsomething shiny or a squirrel."}]},{"id":"magic","title":"2.2.9 Magic","pages":"p. 32–42","content":[{"page":32,"text":"Magic\nThere have always been those who have used magic: witches and wizards, wise women and warlocks. But as all scholars know, all\nmagic is dangerous, for it originates from Chaos, the source of corruption and change. Indeed, during these times, sorcery is illegal\nand punishable by death. Wizards have little say in whether the world of magic touches them or not. They are born with second\nsight and to them the world of magical energies and spells is much more real than the mundane world of normal mortals. With all\nthe persecution, fear and hatred it is little wonder that wizards become reclusive and suspicious, and many are downright insane.\nSome even turn to the worship of the dark gods, and others follow the forbidden path of necromancy.\nMordheim has become home to many magic users and they roam the ruins hiding from Witch Hunters. But there are other ways\nof gaining power over and above that of a normal mortal man. The gods watch over their subjects and a priest of strong faith can\ncall upon them to assist him in battle. Of these, the Priests of Sigmar are the most common, for Sigmar is the patron god of the\nEmpire, and his following is strong during these times of strife.\nIn Mordheim we commonly refer to spell casters as Wizards.\nSome races use different names, such as warlock, magister,\nshaman, priest or seer, but all of these are considered to be\ntypes of Wizard.\nWizards can cast Spells and Priests can use Prayers. Prayers\nare essentially the same as Spells, they use the same actions,\nthe only difference is items and abilities that protect against\nspells will not protect Prayers. And priests can wear armour\nand still use prayers. When we refer to Spells this also\nincludes Prayers (unless stated).\nDuring a battle, wizards are activated just like any other\nwarrior, with the exception that they may perform ‘Cast\nSpells (X)’ actions, which enable them to manifest their\nabilities.\nA Cast Spells (X) action may be (Simple), (Basic) or\n(Double), depending upon the complexity of the Cast Spell\nthe wizard is attempting to manifest. This will always be\nshown in brackets after the name of the Cast Spell itself.\nWhen a wizard is activated, they may choose to perform one\nor more Cast Spells (X) actions.\nRegardless of the Cast Spell(s) that a wizard knows, all\nwizards are able to perform the following actions:\nMAINTAIN CONTROL (Simple/free)\nThis is a free action. The Wizard can still make two actions\non a turn they are activated. Some CAST SPELL (X) actions\nare noted as being a Continuous Effect. Such a power lasts\nfrom when the warrior performs the action until the start of\ntheir next activation when it will expire. In order to maintain\na Continuous Effect, the warrior must perform this action.\nThe warrior immediately makes a Willpower check,\napplying the Difficulty modifier of the spell, and then\napplying -1 to the result of the dice roll (it’s easier to\nmaintain the spell once cast). If they do not perform this\naction, or they fail the Willpower check, the Continuous\nEffect expires at the beginning of this warrior’s activation\nand the spell ends. A Wizard can only ever have one\n\nContinuous Effect in play. If a Wizard is Seriously Injured or\ntaken Out of Action, any Continuous Effects will\nimmediately expire.\nCONCENTRATE (BASIC)\nIf the warrior makes a Willpower check in their subsequent\naction, apply a -1 to the result of the dice roll.\n\nCasting Spells\nWhen a wizard makes a Cast Spells (X) action, they must\nmake a Willpower check to see if the action is successful. If\nthe check is passed, the Cast Spell takes immediate effect. If\nit is failed, the Cast Spell has no effect and the action is\nwasted.\nMAGIC MISSILES\nWhen a wizard casts a ranged spell at an enemy warrior,\nthey must follow the same rules as shooting. The target must\nbe an Eligible target and Target Priority still counts (see\nshooting above). The spell takes immediate effect and hits\nautomatically (unless stated).\nA warrior targeted by a magic missile spell is Pinned.\nCAST SPELL (X) –(This action is also used for Prayers). To\nsee if the action is successful the spell caster must make a\nWillpower check with the Spell’s Difficulty modifier applied.\nIf the check is passed, the spell takes immediate effect. If it is\nfailed, the Spell has no effect and the action is wasted.\nHowever, using magic is not without risk. If the Willpower\ncheck is failed on the roll of a double 6, the spell caster must\nimmediately roll on the Magical Miscast table (see below). If\nthe Willpower check is passed on the roll of a double 1, the\nSpell takes effect, cannot be Dispelled (see Magic below) and\nthe Wizard must immediately roll on the Magical Miscast\ntable."},{"page":33,"text":"WIZARDS AND ARMOUR\nA Wizard cannot perform the action Cast Spell (X) if the\nwarrior is wearing armour or has a shield or buckler, they\ncause too much magical interference. Priests are an\nexception and may wear armour and still cast spells.\n\nMagical Miscasts\n\nHowever, using Cast Spells is not without risk. If the\nWillpower check is failed on the roll of a double 6, the\nwizard must immediately roll on the Magical Miscasts table\n(see overleaf). If the Willpower check is passed on the roll of\na double 1, the Cast Spell takes effect, cannot be Disrupted\n(see below) and the wizard must immediately roll on the\nMagical Miscasts table.\n\nDispel\nWhenever a wizard is activated to make a Cast Spells (X)\naction or to make a Maintain Control (Simple) action, if\nthere is a Standing and Active or Prone and Pinned enemy\nwizard within 18\", they may attempt to Dispel the wizard’s\nsuccessful Cast Spell. A Standing and Engaged or Prone and\nSeriously Injured wizard may not attempt to Dispel a Cast\nSpell.\nTo Dispel a successful Cast Spells (X) action, a wizard must\nroll 2D6. If the total is lower than the total rolled for the\nWillpower check made to successfully perform the action,\nthe Cast Spell is Dispelled and fails as if the wizard making\nthe action had failed their own Willpower check. If the total\nis equal to or higher than the total of the Willpower check\nmade to successfully perform the action, the Dispel attempt\nfails and the Cast Spells (X) action is resolved.\n\nHowever, Dispel attempts can be just as risky as casting\nspells.\nIf a double 1 is rolled, the Cast Spell is cancelled, but the\nwizard making the Dispel attempt must immediately roll on\nthe Magical Miscast table.\nIf a double 6 is rolled, the Dispel attempt fails and the wizard\nmaking the Dispel attempt must immediately roll on the\nMagical Miscast table.\n\nAllocated Spells\nThe chart below summarises the different kinds of magic\nand explains who can use what spells.\nWizard\nChaos Magisters\nMercenary wizards and\nWarlocks\nSkaven Grey Seer Apprentice\nSisters of Sigmar\n& Warrior-Priests of Sigmar\nNecromancers\nOrc Shaman\n\nType of Magic\nChaos Rituals\nLesser Magic\nMagic of the Horned Rat\nPrayers of Sigmar\nNecromancy\nPower of da Waaagh!\n\nEach wizard starts with one randomly determined spell, but\nmay gain more. Roll a D6 and consult the appropriate chart\nbelow. If you get the same spell twice, roll again or lower the\nspell’s difficulty by 1."},{"page":34,"text":"Magical Miscasts\nMagic is fickle, and writhes like a thing alive even whilst a Wizard shapes it to his will. Magic always strives to be free of constraint,\nand should the Wizard mispronounce a single word, or otherwise miscast the spell, the magic will shatter its bindings in a burst of\nincredible energy. Wizards can therefore be described as not trying to empower their spells, but to hold that same energy in check\nlest it prove to be their undoing.\nWhenever a Wizard rolls a double 1 or a double 6 when making a Willpower check to perform a Cast Spell (X) action, or when\nattempting to Dispel a Wizard’s Spell, roll 2D6 and consult the table below:\n\n[TABLE]\n2D6|Result\n*2-3|A Tear in Reality! The Wizard loses control and the fibre of reality itself is torn apart as a passage to the Realm of Chaos opens. Centre a 5” diameter Blast marker on the Wizard; any warrior touched by the marker must pass a Willpower check or lose a wound as their flesh mutates and their soul is sucked away. The Wizard then goes Out of Action.\n*4-5|Immaterium Inverse. The spell inverts upon those attempting to control it. The Wizard becomes the target of the spell (regardless of range). If the spell is beneficial, the Wizard instead becomes Pinned and suffers a Strength 6 hit that inflicts 2 Damage ignoring armour saves. The power has no other effects.\n*6-8|Whispers from the Realm of Chaos. The wizard’s mind is filled with screaming daemonic voices. The wizard becomes subject to Stupidity condition for the rest of the game. Place a marker on the wizard’s Warrior card and make an Intelligence check when they activate.\n*9-10|Power Surge! The Wizard’s spell becomes overcharged with magical energy. The Wizard may immediately try to manifest the same spell again as a free action, or if they were trying to disrupt a spell, they may immediately manifest one of their own spells as a free action – this additional manifestation of the spell can trigger a Magical Miscast as normal. After working out the effects of the spell, the Wizard becomes Pinned and suffers a Strength 4 hit that inflicts 1 Damage ignoring armour saves.\n*11-12|Daemonic Possession. Daemonic energy courses through the Wizard’s body. The Wizard increases their Movement, Weapon Skill, Strength, Toughness an Attacks characteristics all by 3. Their unarmed attacks inflict 2 Damage and have an AP of -1. They gain the Daemonic Special rule. In the End phase of the following round, or if the Wizard generates this result again, they go Out of Action.\n[/TABLE]"},{"page":35,"text":"Prayers of Sigmar\nThose with great faith in the gods can call upon their divine power. The priests of Sigmar can pray for many miracles: healing of\nwounds, strengthening the resolve of their comrades or the banishment of Daemonic creatures and the Undead.\nThe Prayers of Sigmar can be used by Witch Hunters, Priests of Sigmar and Sister of Sigmar. A warrior may use the divine\npower of Sigmar while wearing armour. Prayers of Sigmar are not regarded as spells, so any special protection against spells\ndoes not affect them.\nD6\n1\n\nResult\nSigmar’s Fiery Hammer\nDifficulty 0 (Basic), Continuous Effect:\nThe priest chants benedictions of Sigmar’s might and the weapon of the faithful glows with a golden light, imbued as it is with\nthe righteous power of Sigmar.\nFor as long as this Spell is maintained, the Priest counts as being armed with the following weapon:\nWeapon\nRange\nStr\nAP\nD\nTraits\nMelee\nS+2\n2\nSigmar’s Fiery Hammer\nFlaming Attack, Stun\n\n2\n\nBeacon of Righteous Virtue\nDifficulty -1(Basic), Continuous Effect:\nAs the Priest bellows prayers in Sigmar’s name, they become infused with holy fire of righteousness. Waves of glory surround the\nservant of Sigmar and the faithful are heartened by the warrior god’s presence.\nFor as long as this Spell is maintained, all allied warriors within 8\" of the Priest become immune to Fear and Panic tests. In\naddition, the warband Leader can reroll the D6 when making Rout test.\nSoulfire\nDifficulty -2 (Basic)\nThe wrath of Sigmar comes to earth. A holy fire explodes from the Priests body blasting outwards and wipe out those who resist\nthe righteous fury of the God-Emperor!\nAll enemy warriors within 4\" of the servant of Sigmar suffer a Strength 3 hit with the weapon trait Flaming Attack. No\narmour saves are allowed. The servants of darkness are especially susceptible to Sigmar’s holy power. Undead and Daemonic\nwarriors in range suffer a Strength 5 hit, Flaming Attack and no armour saves.\nShield of Faith\nDifficulty +1 (Basic), Continuous Effect:\nA shield of pure white light appears in front of the Priest. As long as his faith remains strong the shield will protect him.\nFor as long as this Spell is maintained, the Priest is immune to all spells. This doesn’t dispel it, the spell is still cast and effects\nother warriors as normal.\nHealing Hand\nDifficulty +2 (Simple)\nLaying hands upon a wounded comrade, the servant of Sigmar calls upon his Lord to heal the warrior’s wounds.\nAny one warrior within 2\" of the Priest (including himself) may be healed. The warrior is restored to his full quota of\nWounds. If the warrior was Seriously Wounded, they immediately come to their senses, stand up, and continue fighting as\nnormal. In addition, if any friendly warriors within 2” that have any flesh wounds are healed and the flesh wounds removed.\nArmour of Righteousness\nDifficulty -2 (Basic), Continuous Effect:\nImpenetrable armour covers the Priest and the fiery image of a twin-tailed comet burns above his head.\nFor as long as this Spell is maintained, the Priest has an armour save of 2+ which replaces his normal armour save. In\naddition, he causes Fear (and is therefore immune to fear).\n\n3\n\n4\n\n5\n\n6"},{"page":36,"text":"Necromancy\nAs the powers of Dark Magic are wielded to the purpose of necromancy, its unwholesome energies animate and invigorate the\nUndead. It grants Necromancers the power to raise the dead and command spirits, but also to destroy the vitality of the living.\nD6\n1\n\n2\n\n3\n\n4\n\n5\n\n6\n\nResult\nSoul Stealer\nDifficulty -3 (Basic)\nThe Necromancer sucks out the very essence of life from his victim, stealing its vigour for himself.\nYou may choose a single warrior within 6\". The target suffers a wound (no armour save allowed) and the Necromancer gains\nan extra wound for the duration of the battle. This may take the Necromancer’s Wounds above his original maximum value.\nThis spell will only affect living targets and will not affect any Daemonic or Undead warriors.\nInvocation of Nehek\nDifficulty 0 (Basic)\nAt the spoken command of the Necromancer, the dead rise to fight again.\nOne Skeleton or Zombie Warrior that went out of action immediately returns to the battle. Place the warrior\nwithin 6\" of the Necromancer. The warrior cannot be placed straight into close combat with an enemy warrior.\nHellish Vigour\nDifficulty 0 (Basic)\nThe caster invigorates the creatures under his control, who attack the foe with new found speed and ferocity.\nThe wizard can choose one friendly warrior in 6” with the Undead (not Vampiric) special rule. The warrior can immediately\nperform the action FIGHT (Basic). Does not need line of sight.\nGaze of Nagash\nDifficulty -2 (Basic)\nBolts of Dark Magic leap from the caster’s eyes, withering flesh and blackening the bone beneath.\nThe Necromances makes an immediate attack against one enemy warrior using the following weapon profile:\nWeapon\nRange\nStr\nAP\nD\nTraits\nGaze of Nagash\n12\n4\n-1\n1\nD3 hits, no armour save\nVanhel’s Danse Macabre\nDifficulty +1 (Basic)\nThe Undead are filled with magical energy that causes them to jerk forwards on the attack with tireless and unnatural speed.\nThe wizard can target a single friendly Undead warrior within 6\". The warrior may immediately perform the action MOVE\n(Simple). If this moves them into base contact with an enemy warrior, they count as charging and can perform a FIGHT\n(Basic) action.\nSpell of Awakening\nDifficulty: Auto (no WP check needed)\nThe Necromancer calls the soul of a slain Hero back to his body and enslaves him with corrupt magic.\nIf an enemy Hero is killed or one of the player’s Dregs dies (the warrior rolled 66 Memorable Death on the Lasting Injury\ntable) then the Necromancer may raise them to fight as a Skeleton Warrior in his servitude after the battle.\nThe dead Hero retains all his weapons, armour but loses any other equipment and skills. His characteristics are the same\nexcept for the following modifiers WS, BS, I are -1 and LD, CL WIL, INT are -2. The dead Hero gains the Undead special\nrule and is a Henchmen. This spell always succeeds. (Note: this is like hiring a skeleton warrior for free, but gaining the dead\nhero’s equipment)."},{"page":37,"text":"Chaos rituals\nChaos rituals employ the raw power of the darkest magic and are therefore supremely useful in bringing pain and suffering, as well as\nchange and mutation. Chaos rituals are used by Magisters of the Cult of the Possessed, and Daemons.\nD6\n1\n\n2\n\n3\n\n4\n\n5\n\n6\n\nResult\nVision of Torment\nDifficulty -3 (Basic)\nThe Chaos Mage summons horrible visions of the realm of Chaos, causing his enemy to recoil in utter horror.\nNominate an enemy warrior anywhere within 6\" of the Chaos Mage. The nominated warrior must immediately take a\nWillpower check. If the check is passed, the warrior is Pinned. If the test is failed, the warrior loses 1 Wound and is Pinned.\nIf this reduces the warrior to 0 Wounds, roll one Injury dice and apply the result. This doesn’t affect warrior with Immune to\nPsychology.\nEye of God\nDifficulty 0 (Basic)\nThe Chaos Mage implores the Dark gods to grant a boon to their servant.\nOnce cast successfully it cannot be cast again this battle. Choose any warrior from your warband, (only the faithful, not hired\nswords etc) within 6”. If you choose the Chaos Mage, they may re-roll the D6 result below. Roll a D6 to see what happens to\nthe affected warrior:\nD6 Result:\nThe wrath of the dark gods descends upon the target. The warrior is taken out of action immediately, they\n1\nautomatically count as having the result 12-26 Out Cold.\n2-5 The warrior gains +1 to any one of his characteristics during this battle.\nThe warrior gains +1 to all of its characteristics for the duration of the battle.\n6\nDark Blood\nDifficulty -1 (Basic)\nThe Chaos Mage cuts arcane symbols into his palm and his blood spurts out, burning flesh and armour.\nThis attack has a range of 8\" and causes D3 S5 hits. It hits the first warrior in its path. After using this spell the Chaos Mage\nmust make a Toughness Check, if failed then the caster gains a flesh wound.\nLure of Chaos\nDifficulty -2 (Basic) Continuous\nThe Chaos Mage calls upon the taint of chaos which exists in the inner soul of all living beings.\nSelect an enemy warrior that has not yet activated this round within 12\" and line of sight of the Chaos Mage. The enemy\nwarrior makes a WP check, if unsuccessful then the warrior is immediately activated (remove his ready marker), and the\nChaos Mage player can control him. The warrior will not do anything suicidal (such as jumping off a building) but can\ncharge, attack or shoot warriors on his own side. If he was engaged in close combat with any warriors of the Chaos Mage’s\nwarband, they will immediately move 1\" apart. The warrior is now activated by the Chaos Mage player. The Chaos Mage\ncontinues to control the warrior until they pass a Willpower check at the start of their activation.\nWings of Darkness\nDifficulty 0 (Basic)\nA pair of large wings of shadow grow from the Chaos Mage’s back allowing them to fly.\nThe Chaos Mage can immediately perform a MOVE (Basic) for free, up to distance of 12” and can ignore all terrain, may\nmove freely between levels without restriction. They may not however move through impassable terrain or walls.\nThe Chaos mage can use this to move into base contact with an enemy, in which case he counts as charging and follows as\nthe usual rules for being engaged and in close combat.\nWord of Pain\nDifficulty 0 (Basic)\nSpeaking the forbidden name of his dark god, the Chaos Mage causes indescribable pain to all who hear it.\nAll warriors within 3\" of the Chaos Mage, friend or foe, suffer one S3 hit. No armour saves are allowed."},{"page":38,"text":"Lesser magic\nThose who have not been schooled in the ways of magic can cast only relatively simple spells. Many human wizards, lacking the\ntradition of sorcery and the grimoires of Necromancers and Chaos Mages, must rely on their own natural aptitude and\nexperimentation.\nLesser Magic (or hedge magic) is used by human wizards. It may not be as awesome as the mighty spells of Necromancers and Chaos\nMages, but it is still dangerous.\nD6\n1\n\nResult\nFires of U’Zhul\nDifficulty 0 (Simple)\nThe wizard summons a fiery ball of flames and hurls it upon his enemies.\nThe wizard makes an immediate makes an immediate attack using the following weapon profile:\nWeapon\nRange\nStr\nAP\nD\nTraits\nFires of U’Zhul\n18\n4\n-1\n1\nFlaming attack\n\n2\n\nFlight of Zimmeran\nDifficulty 0 (Basic)\nCalling upon the power of the winds of magic, the wizard flys through the air.\nThe Wizard can immediately perform a MOVE (Basic) for free, up to distance of 12” and can ignore all terrain, may move\nfreely between levels without restriction. They may not however move through impassable terrain or walls. The Wizard can\nuse this to move into base contact with an enemy warrior, in which case he counts as charging and follows as the usual rules\nfor being engaged and in close combat.\nDread of Aramar\nDifficulty -1 (Basic)\nThe wizard places a sense of mind-numbing fear into the minds of his opponents.\nChoose an enemy warrior within 12\" of the Wizard. The enemy warrior must make a Panic check with or become subject to\nthe Broken condition. Note that this spell does not affect any warrior with Immune to Psychology.\nSilver Arrows of Arha\nDifficulty 0 (Basic)\nSilvery arrows appear from thin air and circle around the wizard, shooting out to strike his foes.\nThe Wizard makes an immediate attack against one enemy warrior using the following weapon profile:\nWeapon\nRange\nStr\nAP\nD\nTraits\nSilver Arrows of Arha\n24\n3\n1\nD3+2 hits\n\n3\n\n4\n\n5\n\n6\n\nLuck of Shemtek\nDifficulty +1 (Basic)\nThe wizard summons the fickle power of magic to manipulate chance.\nThe wizard may re-roll all his failed dice rolls, can only re-roll them once, and the second results stand. The effect lasts until\nthe Wizard’s next activation.\nFlaming Sword of Rhuin\nDifficulty -1 (Basic) Continuous\nA flaming sword appears in the hand of the wizard, promising red ruin to all who stand in his way.\nThe wizard can make close combat attacks with the following weapon profile:\nWeapon\nRange\nStr\nAP\nD Traits\nFlaming Sword of Rhuin\nMelee\nS+2\n-1\n1 +1 Attack dice, +2 WS, Parry, Flaming attack."},{"page":39,"text":"Magic of the horned rat\nThis brand of sorcery is used by the Skaven. It is a sinister form of magic which calls upon the Skaven deity, a loathsome daemonic\ngod known as the Horned Rat. The number thirteen is of particular significance in Skaven rituals.\nD6\n1\n\nResult\nWarp Lightning\nDifficulty -1 (Basic)\nThe sorcerer points a fleshy paw and bolts of greenish-black lightning arc outwards.\nThe Wizard makes an immediate attack against one enemy warrior using the following weapon profile:\nThe spell also causes one Strength 3 hit on each warrior within 2\" of the original target.\nWeapon\nRange\nStr\nAP\nD\nTraits\nWarp Lightning\n9\n4\n-1\n1\nD3 hits\n\n2\n\nSkitterleap\nDifficulty 0 (Basic)\nWith a ‘Bamf!’ the Skaven sorcerer disappears in a puff of smoke to reappear elsewhere on the battlefield.\nThe Sorcerer may immediately move anywhere in 13”, but not within 1” of an enemy warrior. If engaged in close combat,\nthe Sorcerer counts as having performed the action RETREAT (Basic) but doesn’t need to make an Initiative check.\nWarriors engaged with the Sorcerer deduct one from their Initiative when making the Initiative check.\nVermintide\nDifficulty +1 (Basic)\nThe hapless victim is attacked by a swarm of rats and soon is covered from head to foot in small, bleeding wounds.\nChoose a single warrior in 8” of the sorcerer. Vermintide causes 2D6 Strength 1 hits with a -1 save.\nBlack Fury\nDifficulty -1 (Basic) Continuous\nWith a chittering incantation the Sorcerer turns into a monstrous rat-like creature, and attacks with an insane fury.\nThe Sorcerer may immediately perform the action CHARGE (Double) at an enemy warrior within 13\" and gains +2 Attacks\nand +1 Strength until their next activation.\nEye of the Warp\nDifficulty -1 (Basic)\n“Gaze into the eye of the warp and despair!”\nAll enemy warriors engaged with the Sorcerer must take a Cool check. Any enemy warrior that fails this check suffers a\nStrength 3 hit and is immediately Broken and runs for cover. Warriors that are Immune to Psychology do not become\nBroken.\nSorcerer’s Curse\nDifficulty +1 (Basic)\nThe Sorcerer points a claw towards one of his enemies and curses him in the name of the Horned One.\nThe spell has a range of 13\" and affects a single warrior within range and line of sight. The sorcerer doesn’t need to choose\nthe closest target. The target must re-roll is any successful armour saves and to hit rolls until the sorcerer’s next activation.\n\n3\n\n4\n\n5\n\n6"},{"page":40,"text":"Prayers of Ulric\nUlric is the god of battles, wolves, and winter. He has been worshipped since ancient times, indeed was the patron of Sigmar himself.\nHis priests are as fierce as wolves, and they use spells to win more glorious victories in Ulric’s name. Those who call upon Ulric often\nfind that they prefer cold to heat, and seldom feel at home in civilised areas.\nThe wolf priests of Ulric hail from Middenheim, the city of the White Wolf. It is believed that Ulric himself struck the top off of it with\na mighty blow from his fist to create a plateau where his followers could build a stronghold. The priests of Ulric see the hammer-like\nblow of the comet on Mordheim as Ulric’s judgment on the decadent Sigmarites that lived in the city.\nA warrior may use the divine power of Ulric while wearing armour. Prayers of Ulric are not regarded as spells, so any special\nprotection against spells does not affect them.\nD6\n1\n\n2\n\n3\n\n4\n\n5\n\n6\n\nResult\nWinter’s Chill\nDifficulty +1 (Basic) Continuous\nThe priest radiates a coldness that chills to the bone.\nAny warrior Engaged with Priest suffers a -1 to hit penalty.\nIce Blast\nDifficulty -3 (Basic)\nThe Priest summons up a fierce storm of lashing ice.\nThe Priest makes an immediate attack against one enemy warrior using the following weapon profile:\nWeapon\nRange\nStr\nAP\nD\nTraits\nIce Storm\n12\n3\n-6\n1\nBlast (5”) no armour save\n.\nBattle Fury\nDifficulty 0 (Basic) Continuous\nUlric’s spirit fills the Priest, and their bloodlust is unleashed.\nThe Priest can make close combat attacks with Strength +2 .and the Hack weapon trait. If the Priest already has a weapon\nwith Hack trait, then it gains +1 Strength if the hit roll is a natural 5 or a 6.\nUlric’s Gift\nDifficulty 0 (Basic)\nThe Priests words awakens the slumbering berserker in an ally.\nThe Priest can cast this spell on one friendly warrior in 12” (not hired swords). The warrior now has Frenzy special Rule.\nHeart of the Wolf\nDifficulty -1 (Basic) Continuous\nThe Priest howls like one of Ulric’s wolves and it instils their allies with a lust for battle.\nFor as long as this Spell is maintained, all friendly warriors within 8\" of the Priest become immune to Fear and Panic tests. In\naddition, the warband Leader can reroll the D6 when making Rout test.\nCall of Ulric\nDifficulty -1 (Basic) Continuous\nThe Priest lets out a cry of agony as his body re-shapes itself into that of a huge slavering wolfman.\nThe Priest may immediately perform the action CHARGE (Double) at an enemy warrior within 12\" and gains +2 Attacks\nand +1 Strength until their next activation."},{"page":41,"text":"Prayers of Taal\nTaal is the God of Nature and demands the respect of all those who enter the wild regions of the Empire. He is portrayed as a tall,\nbroad-shouldered man with long wild beard and a thick beard. He wears a stag skull as a helm and is clothed in bison and bear\nskins. He is often called the Lord of Beasts. His followers include rangers, trappers and those who live in the wilds of the Empire.\nPrayers of Taal work like Prayers of Sigmar although the Taal Priest never wears armour.\nD6 Result\n1 Stags Leap\nDifficulty 0 (Basic)\nMany of Taal’s priests wear a stag skull as a symbol of their devotion and the Forest Lord’s power can be used to emulate the\nspeed and beauty of this magnificent beast.\nThe Priest of Taal may immediately move anywhere within 9\" including into base contact with the enemy, in which case he\ncounts as charging and gains a +1 Strength to his first round of attacks. If he engages a fleeing enemy, in the close combat\nphase he will score one automatic hit at +1 Strength.\n2 Blessed Ale\nDifficulty +2 (Basic)\nLike his brother Ulric, Taal has a great appetite for the strong ales of the Northern Empire. During the summer Equinox, each\nvillage in Ostland opens one keg of ale (at least!) in Taal's honour.\nDrinking a flask of Taal-blessed ale (the priest is assumed to carry as many flasks as are needed) may heal any one model\nwithin 2\" of the Priest (including himself). The warrior is restored to his full quota of Wounds. In addition, any living enemy\nmodels (not Undead or Daemonic) within 2\" of the Priest will be lose 1 Attack during the next round of combat due to the\npotent fumes of the ale.\n3 Bears Paw\nDifficulty 0 (Basic)\nMany an armoured knight has been knocked to the ground by the surprising Strength of the followers of Taal. Although\ntraditionally called ‘Bear’s Paw’ this spell is sometimes referred to as ‘Moose’s Breath’ by those Ostlander’s who have felt its\npower.\nThe Priest invokes the blessing of Taal on himself or a single friendly model within 6\". The target receives a bonus of +2 to\nhis Strength until the Priest’s next turn.\n4 Earth shudder\nDifficulty -2 (Basic)\nTaal’s domain includes both the earth and the skies and his power can reach out even into the dark streets of Mordheim. When\nhis name is invoked three times and the blood of an eagle is poured on the ground, the Lord of the Wild will cause thunder to\nrumble and the earth to shake.\nThe spell is cast on a single building within 4\". Any enemy models touching the building will suffer a single S3 hit. In\naddition the building will collapse and any models on it will count as having fallen to the ground (for example a model\nfalling 5\" to the tabletop must pass two Initiative tests to avoid taking D3 S5 hits.) Remove the terrain feature from the board\nfor the rest of the game (replace with rubble which counts as an area of difficult ground).\n5 Tanglefoot\nDifficulty -1 (Basic)\nIt is said that when Taal walked the earth, living things would spring up behind him as he passed. A portion of his power can be\nsummoned by his followers to help regrow forests and aid in the return of the land to its natural state.\nPlants, vines and even small trees burst forth from the earth, hindering all those who attempt to move through them. All\nmodels (friend as well as foe) with the exception of Ostlander Jaeger within 12\" of the Priest can only move at 1/2 speed until\nthe next shooting phase.\nSummon Squirels\n6\nDifficulty 0 (Basic)\nTaal is the master of all beasts both great and small. Those who anger him may be mauled by a mountain lion or drowned in a\nflood caused by an angry beaver.\nWith this spell the Priest invokes the wrath of the Lord of Beasts, summoning forth dozens upon dozens of enraged\nsquirrels. The furious rodents assault one enemy within 12\" of the Priest, crawling inside the warrior’s clothing and armour,\npelting him with nuts and causing numerous tiny bites and welts. The target suffers 2D6 Strength 1 hits. No armour saves\nallowed."},{"page":42,"text":"Power of da Waaagh!\nThese spells are used by Orc Shamans. The power of a Shaman comes not just from the winds of magic, or ‘da Great Green’ as\ngreenskins call it, but also from the raw energy radiated by their fellow Orcs.\nThe magical powers of Orc Shamans are boosted by the positive energies of Orcs fighting nearby. Conversely, if nearby Orcs are\nrunning away, their negative energy weakens a Shaman. To represent this, if a Spell of da Waaaagh! Has a Strength value or\ngrants a Strength bonus, that value or bonus is increased by +1 as long as there are more friendly warriors engaged in close\ncombat than there are Broken and fleeing. If there are more friendly warriors Broken and Fleeing than there are engaged in\nclose combat, then the strength is decreased by -1 instead.\nD6\n1\n\n2\n\n3\n\n4\n\n5\n\n6\n\nResult\n‘Ere we go!\nDifficulty: -2 (Continuous)\nAs the Shaman chants his gibberish, he seems to visibly leak fighty energy, which boosts the aggressive zeal and close combat\nprowess of nearby mobs of Goblinoids.\nAny Orc or Goblin within 4\" of the Shaman gain the Strike First weapon trait.\nThe Hand of Gork\nDifficulty: 0 (Basic)\nThe Shaman’s eyes roll back and an enormous, ghostly green hand materialises and flicks the enemy away.\nThe Shaman can target an enemy warrior in range 8\". Normal line of sight rules apply. The enemy warrior is moved D6\"\ndirectly away from the Shaman. If the target collides with another warrior or terrain, both suffer 1 S3 hit.\nNote: Very handy for dropping people from high buildings. May not be cast on warriors engaged in close combat.\nBrain Bursta\nDifficulty: -2 (Basic)\nA crackling green bolt of WAAAGH! energy erupts from the Shaman’s forehead to strike the skull of the closest foe. This energy\neasily overloads the brain of a weak-willed opponent.\nThe Shaman makes an immediate attack against one enemy warrior using the following weapon profile:\nWeapon\nRange\nStr\nAP\nD\nTraits\nBrain Bursta\n12\n4\n-6\n1\nD3 hits, no armour save\nFooled Ya!\nDifficulty: +1 (Basic)\nThe Shaman disappears in a green mist, confusing his enemies.\nNo enemy warrior may charge the Shaman during their next activation. If the Shaman is engaged in close combat\nhe may immediately move 4\" away. Last until the Shamans next activation.\nFists of Gork\nDifficulty: 0 (Continuous)\nIn a fit of fighting fury the Shaman’s gnarled fists grow large, becoming harder than iron.\nThe Shaman can make close combat attacks with the following weapon profile:\nWeapon\nRange\nStr\nAP\nD\nTraits\nFists of Gork\nMelee\nS+2\n-1\n1\n+1 attack dice, Stun\nGaze of Mork\nDifficulty: -1 (Basic)\nTwin bolts of green flame shoot from the Shaman’s eyes to strike the nearest enemy warrior.\nEach of the two bolts causes D3 S3 hits; the bolts can either be fired both at the closest enemy target or split between the two\nclosest enemy targets. The Shaman makes an immediate attack using the following weapon profile:\nWeapon\nRange\nStr\nAP\nD\nTraits\nGaze of Mork\n12\n3\n1\nTwo D3 hits, Flaming attack"}]},{"id":"endphase","title":"2.3 End Phase","pages":"p. 27","content":[{"page":27,"text":"End Phase\nAfter all warriors that wish to activate have activated, the\nAction phase ends and play moves on to the End phase. The\nEnd phase has three steps:\n1. MAKE ROUT TEST (IF NECESSARY).\n2. MAKE RECOVERY TESTS FOR SERIOUSLY\nINJURED WARRIORS.\n3. MAKE RALLY TESTS FOR ANY BROKEN\nWARRIORS.\n\nROUT TESTS\n\nAt the start of the End phase, either or both players will be\nrequired to make a Rout test for their warband if one or\nmore of their warriors are either Seriously Injured or Out of\nAction. Even warbands who are normally immune to\npsychology (such as Undead) must make Rout tests.\nTo make a Rout test for the warband, roll a D6 and add to\nthe result the total number of warriors that are Seriously\nInjured or Out of Action. If the final result is higher than the\ntotal number of warriors in the starting crew (the number of\nwarriors who were present at the start of the battle, see page\n506), then the warband as a whole has failed the Rout test\nand if Fleeing.\nFLEEING THE BATTLEFIELD\nOnce a warband is Fleeing, warriors may begin to flee the\nbattlefield. At the start of the Action phase, the controlling\nplayer will have to make a Cool check for each of their\nwarriors on the battlefield. Each warrior that fails this Cool\ncheck will immediately flee the battlefield and is removed\nfrom play.\nNote: although Undead are immune to psychology this can\nbe thought of as their masters cutting their loses and\ncommanding them to retreat. Or it can be thought of as\nmagical instability.\nLEADING BY EXAMPLE\nWarriors draw courage from their leaders and will follow\ntheir example:\n•\n• If the warband Leader passes their Cool check,\nany friendly warriors within 12\" are considered to have\npassed their Cool check and will not flee the battlefield.\n•\n• If a Champion passes their Cool check, any\nfriendly warriors that are not the Leader or another\nChampion within 6\" are considered to have passed their\nCool check and will not flee the battlefield.\nVOLUNTARY ROUT\nIn campaign play, a warband’s controlling player can choose\nto voluntarily fail any Rout test they make, instead of rolling\nfor it.\n\nDECLARE WARBAND IS FLEEING\nOnce a warband has failed a Rout test (whether voluntarily\nor by falling a Rout test), the controlling player can declare\nthat the warband will flee the battlefield at the start of any\nAction phase. Any Active and Pinned warriors from the\nwarband immediately flee the battlefield and are removed\nfrom play. Engaged warriors must first attempt to break\naway from their fight- make an initiative check for each of\nthem. If the check is passed, they flee, but if it fails, they are\nSeriously Injured. Once the warband that has declared it will\nflee has only Seriously injured warriors on the battlefield, the\nbattle ends. Roll to see whether warriors succumb to their\ninjuries or are captured as normal.\n\nRECOVERY TESTS\n\nFor each member of their warband that is Seriously Injured\nand still on the battlefield, the controlling player makes a\nRecovery test by rolling an Injury dice:\n•\nIf the result is Out of Action, the warrior is\nremoved from play. During a campaign game, roll for\nLasting Injuries.\n•\nIf the result is Seriously Injured, the warrior\nremains as they are, Prone and Seriously Injured.\n•\nIf the result is a Flesh Wound, the warrior suffers a\nFlesh Wound (see page 46) and becomes Prone and Pinned.\nASSISTANCE\nWhen making a Recovery test for a Seriously Injured\nwarrior, one Standing and Active friendly warrior that is\nwithin 1\" can offer assistance. If they do so, roll one extra\nInjury dice, then pick one of the Injury dice to resolve and\ndiscard the other.\nA warrior can only assist one Recovery test per End phase.\nMULTIPLE INJURY DICE\nIt may happen that, due to assistance, items of Wargear,\nTactics cards or skills that, when making a Recovery test,\nseveral Injury dice are rolled. Regardless of how many are\nrolled, one Injury dice is picked and resolved, the others are\ndiscarded, as described previously.\n\nRALLY TESTS\n\nAfter making Recovery tests for Seriously Injured warriors,\nplayers may attempt to Rally Broken warriors.\nTo Rally a Broken warrior, make a Cool check for them,\nadding 1 to the result for each friendly warrior within 3\" of\nthem that is not Broken and is not Prone and Seriously\nInjured. If the check is passed, the warrior is no longer\nBroken. If the check is failed, the warrior remains Broken\nuntil the next End phase"}]}];
// Source-PDF extraction artifact: some pages flatten a numbered summary list
// into a run of bare "1." "2." "3." … lines (their label text stripped away
// onto separate ALL-CAPS lines below), instead of "1. Label" on one line —
// e.g. the pre-battle sequence page renders "1. / 2. / 3. …" with nothing
// after each number. The same labels always reappear later in the same page
// as properly formed "1. Label", "2. Label" lines, so this repairs the
// summary list by pulling each label from its real occurrence and dropping
// the now-redundant orphaned label lines in between.
function repairOrphanedNumberedList(lines){
  const out=[];
  for(let i=0;i<lines.length;i++){
    if(!/^\d+\.$/.test((lines[i]||'').trim())){out.push(lines[i]);continue}
    const start=i;const nums=[];
    while(i<lines.length&&/^\d+\.$/.test((lines[i]||'').trim())){nums.push(parseInt(lines[i],10));i++}
    if(nums.length<2||nums[0]!==1){for(let k=start;k<i;k++)out.push(lines[k]);i--;continue}
    const labels=[];let searchFrom=i,ok=true;
    for(const n of nums){
      const re=new RegExp(`^${n}\\.\\s+(.+)`);
      let found=null,foundAt=-1;
      for(let m=searchFrom;m<lines.length;m++){const mm=(lines[m]||'').trim().match(re);if(mm){found=mm[1].trim();foundAt=m;break}}
      if(!found){ok=false;break}
      labels.push(found);searchFrom=foundAt+1;
    }
    if(!ok){for(let k=start;k<i;k++)out.push(lines[k]);i--;continue}
    nums.forEach((n,idx)=>out.push(`${n}. ${labels[idx]}`));
    let j=i;while(j<lines.length&&!/^1\.\s+\S/.test((lines[j]||'').trim()))j++;
    let sawBlank=false;
    for(let k=i;k<j;k++){if(!lines[k].trim()&&!sawBlank){out.push('');sawBlank=true}}
    i=j-1;
  }
  return out;
}
// Same PDF-extraction artifact as repairOrphanedNumberedList above, but for
// bulleted summary lists: the page flattens "• Label: description" into a
// run of bare "•" lines with nothing after them, followed (after a blank
// line) by the real "LABEL: description" paragraphs — each possibly
// wrapping across several physical lines, and sometimes with a stray
// trailing "•" glued onto the end of a line (the next item's marker,
// misplaced during extraction). This reunites each bare bullet with its
// real label+description, stripping the stray trailing marker.
function repairOrphanedBulletList(lines){
  const out=[];
  // Labels can carry modifier suffixes like "(+1)"/"(-1, LONG RANGE ONLY)",
  // so the allowed character set includes digits/parens/+/?/,/. as well as
  // plain ALL-CAPS words.
  const labelRe=/^[A-Z][A-Z0-9 '’\-()+?,.]{2,}:\s*(.*)$/;
  // Second, simpler malformed shape: the orphaned line is just a bare
  // ALL-CAPS step name with no colon or description at all (the description
  // lives further down under that name's own heading instead) — e.g.
  // "ROLL FOR PRIORITY" / "READY WARRIORS" with nothing else on the line.
  const bareLabelRe=/^[A-Z][A-Z0-9 '’\-]{2,}$/;
  for(let i=0;i<lines.length;i++){
    if(!/^[•·]$/.test((lines[i]||'').trim())){out.push(lines[i]);continue}
    const start=i;let count=0;
    // The orphaned markers aren't always one tight run — sometimes a blank
    // line is interleaved between them ("•\n•\n\n•\n\n•") — so the zone
    // consumes bullets AND blanks together and only stops at real content.
    while(i<lines.length&&(!lines[i].trim()||/^[•·]$/.test((lines[i]||'').trim()))){
      if(/^[•·]$/.test((lines[i]||'').trim()))count++;
      i++;
    }
    let k=i;
    const paras=[];let ok=true;
    for(let n=0;n<count;n++){
      while(k<lines.length&&!lines[k].trim())k++;
      const lt=(lines[k]||'').trim();
      const m=lt.match(labelRe);
      if(m){
        const label=lt.slice(0,lt.indexOf(':'));
        let text=m[1].trim();
        k++;
        while(k<lines.length){
          const lt2=(lines[k]||'').trim();
          if(!lt2||labelRe.test(lt2))break;
          text+=' '+lt2;k++;
          if(/[•·]\s*$/.test(lt2))break;
        }
        text=text.replace(/\s*[•·]\s*$/,'').trim();
        paras.push(text?`${label}: ${text}`:label);
      }else if(bareLabelRe.test(lt)&&lt.length<60){
        paras.push(lt);k++;
      }else{ok=false;break}
    }
    if(!ok||paras.length!==count){for(let x=start;x<i;x++)out.push(lines[x]);i--;continue}
    paras.forEach(p=>out.push(`• ${p}`));
    i=k-1;
  }
  return out;
}
// Renders a "[TABLE] header|col2|... \n row|col2|... [/TABLE]" plain-text
// block (see ruleTextMarkup below) as a real HTML <table>, matching the
// approved mockup: pipe-separated cells, first line is the header row. A
// cell prefixed with "*" gets the highlighted dice/roll styling (stripped
// before display) — lets the same generic renderer handle a 2-column
// "roll → result" chart and a wider stat table without extra syntax.
function ruleTableMarkup(rows){
  if(!rows.length)return '';
  const cell=(c,tag)=>{
    const hi=c.startsWith('*');
    const val=hi?c.slice(1):c;
    return `<${tag}${hi?' class="rule-table-hi"':''}>${esc(val)}</${tag}>`;
  };
  const [header,...body]=rows;
  const thead=`<tr>${header.map(h=>cell(h,'th')).join('')}</tr>`;
  const tbody=body.map(r=>`<tr>${r.map(c=>cell(c,'td')).join('')}</tr>`).join('');
  return `<div class="rule-table-wrap"><table class="rule-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`;
}
// Status metadata for the [ACTIONCARDS] block (2.2.2 Actions) — shared by
// the card renderer and the toolbar/legend so the color priority and labels
// only live in one place. Priority order matters: when an action carries
// several statuses, the card's frame/tint picks the first one that matches
// here (Standing & Active > Prone & Pinned > Seriously Injured — Engaged
// never overlaps another status in the rulebook, so it never needs to lose
// a priority tie).
const ACTION_STATUS_META=[
  {id:'active',cls:'active',fr:'Debout & Actif',en:'Standing & Active',shortFr:'Actif',shortEn:'Active'},
  {id:'pinned',cls:'pinned',fr:'À terre & Plaqué',en:'Prone & Pinned',shortFr:'Plaqué',shortEn:'Pinned'},
  {id:'injured',cls:'injured',fr:'Sérieusement blessé',en:'Seriously Injured',shortFr:'Blessé',shortEn:'Injured'},
  {id:'engaged',cls:'engaged',fr:'Engagé (mêlée)',en:'Engaged',shortFr:'Engagé',shortEn:'Engaged'},
  {id:'wizard',cls:'wizard',fr:'Mage & Prêtre',en:'Mage & Priest',shortFr:'Mage',shortEn:'Mage'},
];
// The 2.2.2 Actions page's consolidated, grouped-by-status gallery: instead
// of one card per action colored by a single "priority" status, every
// action card is rendered once per status it carries, filed under that
// status's own titled group, and colored to match whichever group it's
// currently shown under (see actionGroupsGalleryMarkup below).
const ACTION_GROUPS=[
  {statusId:'active',fr:'Debout (Actif)',en:'Standing'},
  {statusId:'engaged',fr:'Engagé',en:'Engaged'},
  {statusId:'wizard',fr:'Mage et Prêtre',en:'Mage and Priest'},
  {statusId:'pinned',fr:'À terre et plaqué',en:'Pinned and Prone'},
  {statusId:'injured',fr:'Blessé',en:'Injured'},
];
function actionTypeIconMarkup(type){
  const t=String(type||'').trim();
  const tl=t.toLowerCase();
  if(tl==='simple')return `<span class="ac-type-ic" title="Simple"><span class="circ"></span></span>`;
  if(tl==='basic')return `<span class="ac-type-ic" title="Basic"><span class="circ">1</span></span>`;
  if(tl==='double')return `<span class="ac-type-ic" title="Double"><span class="circ"></span><span class="circ"></span></span>`;
  return `<span class="ac-type">${esc(t)}</span>`;
}
// One combined search bar + color/type legend for the whole Actions feature
// — placed once via a bare "[ACTIONSEARCH]" line before the first
// [ACTIONCARDS] block on the page; filterActionCards() below then searches
// every ".action-card" on the page, including ones rendered by later blocks
// further down (Engaged, Wizard, Prone…), so admins can split the actions
// into as many [ACTIONCARDS] blocks as they like without losing one shared
// search box.
function actionSearchToolbarMarkup(){
  const en=siteLanguage==='en';
  return `<div class="actions-toolbar"><input class="actions-search" type="text" oninput="filterActionCards(this.value)" placeholder="${en?'Search an action… (e.g. charge, reload, fight)':'Rechercher une action… (ex : charge, reload, fight)'}"><div class="status-legend">${ACTION_STATUS_META.map(s=>`<div class="status-pill st-${s.cls}"><span class="dot"></span>${esc(en?s.en:s.fr)}</div>`).join('')}</div></div><div class="type-legend"><span class="ac-type-ic" title="Simple"><span class="circ"></span></span><span>Simple</span><span class="ac-type-ic" title="Basic"><span class="circ">1</span></span><span>Basic</span><span class="ac-type-ic" title="Double"><span class="circ"></span><span class="circ"></span></span><span>Double</span></div>`;
}
function filterActionCards(q){
  const query=String(q||'').trim().toLowerCase();
  document.querySelectorAll('.action-card').forEach(card=>{
    const hay=`${card.dataset.name||''} ${card.dataset.desc||''}`;
    card.classList.toggle('ac-hidden',!!query&&!hay.includes(query));
  });
}
// Renders a "[ACTIONCARDS] Name|Type|status1,status2|Description \n ... [/ACTIONCARDS]"
// plain-text block as a grid of action cards. Type is "simple"/"basic"/"double"
// (rendered as the matching circle glyph) or any other word, shown as a plain
// text badge (used for the Wizard actions, e.g. "Free"). Statuses is a
// comma-separated list drawn from active/pinned/injured/engaged.
function ruleActionCardsMarkup(rows){
  if(!rows.length)return '';
  const priority=ACTION_STATUS_META.map(s=>s.id);
  const byId={};ACTION_STATUS_META.forEach(s=>byId[s.id]=s);
  const en=siteLanguage==='en';
  const cards=rows.map(cols=>{
    const name=(cols[0]||'').trim();
    const type=(cols[1]||'').trim();
    const statuses=(cols[2]||'').split(',').map(s=>s.trim().toLowerCase()).filter(s=>byId[s]);
    const desc=cols.slice(3).join('|').trim();
    const primary=priority.find(p=>statuses.includes(p))||statuses[0]||'active';
    const tags=statuses.map(s=>`<span class="ac-tag t-${s}"><span class="dot"></span>${esc(en?byId[s].shortEn:byId[s].shortFr)}</span>`).join('');
    return `<div class="action-card c-${primary}" data-name="${esc(name.toLowerCase())}" data-desc="${esc(desc.toLowerCase())}"><div class="ac-head"><span class="ac-name">${esc(name)}</span>${actionTypeIconMarkup(type)}</div><p class="ac-desc">${esc(desc)}</p><div class="ac-tags">${tags}</div></div>`;
  }).join('');
  return `<div class="action-cards">${cards}</div>`;
}
// One action card rendered for a single status group: colored/framed for
// that group specifically (not the row's overall "priority" status), but
// still listing every status the action carries as small tags — used by
// actionGroupsGalleryMarkup so the same action can appear, recolored, in
// every group it belongs to.
function ruleActionCardForGroupMarkup(row,statusId,en){
  const byId={};ACTION_STATUS_META.forEach(s=>byId[s.id]=s);
  const tags=row.statuses.map(s=>`<span class="ac-tag t-${s}"><span class="dot"></span>${esc(en?byId[s].shortEn:byId[s].shortFr)}</span>`).join('');
  return `<div class="action-card c-${statusId}" data-name="${esc(row.name.toLowerCase())}" data-desc="${esc(row.desc.toLowerCase())}"><div class="ac-head"><span class="ac-name">${esc(row.name)}</span>${actionTypeIconMarkup(row.type)}</div><p class="ac-desc">${esc(row.desc)}</p><div class="ac-tags">${tags}</div></div>`;
}
// Parses every "[ACTIONCARDS]…[/ACTIONCARDS]" block across all of a
// RULES_BOOK section's pages (respecting any admin text override) into a
// flat list of {name,type,statuses,desc} rows — the single source of truth
// both the old inline cards and the new grouped gallery read from.
function getActionRowsForSection(sectionId){
  const grp=RULES_BOOK.find(s=>s.id===sectionId);
  if(!grp)return [];
  const byId={};ACTION_STATUS_META.forEach(s=>byId[s.id]=s);
  const rows=[];
  grp.content.forEach(page=>{
    const override=ruleEffectiveText(sectionId,page.page);
    const text=override!=null?override:page.text;
    const re=/\[ACTIONCARDS\]\s*\n([\s\S]*?)\n\s*\[\/ACTIONCARDS\]/g;
    let m;
    while((m=re.exec(text))){
      m[1].split(/\r?\n/).map(l=>l.trim()).filter(Boolean).forEach(line=>{
        const cols=line.split('|');
        const name=(cols[0]||'').trim();
        if(!name)return;
        const type=(cols[1]||'').trim();
        const statuses=(cols[2]||'').split(',').map(s=>s.trim().toLowerCase()).filter(s=>byId[s]);
        const desc=cols.slice(3).join('|').trim();
        rows.push({name,type,statuses,desc});
      });
    }
  });
  return rows;
}
// The consolidated Actions gallery: one shared search/legend toolbar, then
// each of the 5 status groups in a fixed order, each with its own title and
// a very thin separator between groups. An action carrying several statuses
// (e.g. Reload: Standing & Pinned) is rendered once per matching group,
// recolored to that group each time — see ruleActionCardForGroupMarkup.
function actionGroupsGalleryMarkup(en){
  const rows=getActionRowsForSection('actions');
  if(!rows.length)return '';
  const sections=ACTION_GROUPS.map(g=>{
    const matching=rows.filter(r=>r.statuses.includes(g.statusId));
    if(!matching.length)return '';
    const cards=matching.map(r=>ruleActionCardForGroupMarkup(r,g.statusId,en)).join('');
    return `<div class="ac-group"><h4 class="ac-group-title c-${g.statusId}">${esc(en?g.en:g.fr)}</h4><div class="action-cards">${cards}</div></div>`;
  }).filter(Boolean).join('<div class="ac-group-sep"></div>');
  return `<div class="action-groups-gallery">${actionSearchToolbarMarkup()}${sections}</div>`;
}
function ruleTextMarkup(text,opts){
  // Pull out any [TABLE]…[/TABLE], [ACTIONCARDS]…[/ACTIONCARDS] blocks and
  // bare [ACTIONSEARCH] markers first, rendering them as real HTML,
  // replacing each with a one-line placeholder so the line-by-line
  // classifier below (and the orphaned-list repairs it chains) never sees
  // their pipe-delimited rows — or the marker itself — as prose to reflow.
  // opts.suppressActionUI: the 2.2.2 Actions page now shows one consolidated,
  // grouped-by-status action gallery (actionGroupsGalleryMarkup) instead of
  // these scattered inline grids/search bars — so on that page we drop the
  // blocks here entirely rather than rendering them twice.
  const suppress=!!(opts&&opts.suppressActionUI);
  const tables=[];
  const actionCardBlocks=[];
  let withPlaceholders=String(text||'')
    .replace(/\[ACTIONCARDS\]\s*\n([\s\S]*?)\n\s*\[\/ACTIONCARDS\]/g,(m,body)=>{
      if(suppress)return '';
      const rows=body.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>l.split('|'));
      actionCardBlocks.push(ruleActionCardsMarkup(rows));
      return `\u0000ACTIONCARDS${actionCardBlocks.length-1}\u0000`;
    })
    .replace(/\[ACTIONSEARCH\]/g,()=>suppress?'':`\u0000ACTIONSEARCH\u0000`)
    .replace(/\[TABLE\]\s*\n([\s\S]*?)\n\s*\[\/TABLE\]/g,(m,body)=>{
      const rows=body.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>l.split('|').map(c=>c.trim()));
      tables.push(ruleTableMarkup(rows));
      return `\u0000TABLE${tables.length-1}\u0000`;
    });
  return repairOrphanedBulletList(repairOrphanedNumberedList(withPlaceholders.split(/\r?\n/))).map((line,i)=>{
    const raw=line.replace(/\s+$/,'');
    if(!raw.trim()) return '<div class="rule-line rule-blank" aria-hidden="true"></div>';
    const t=raw.trim();
    const tableMatch=t.match(/^\u0000TABLE(\d+)\u0000$/);
    if(tableMatch)return tables[Number(tableMatch[1])];
    const acMatch=t.match(/^\u0000ACTIONCARDS(\d+)\u0000$/);
    if(acMatch)return actionCardBlocks[Number(acMatch[1])];
    if(t==='\u0000ACTIONSEARCH\u0000')return actionSearchToolbarMarkup();
    // A lone "•"/"·" with nothing else on the line is always a leftover
    // extraction artifact (real bullets always carry their text on the same
    // line) — repairOrphanedBulletList already reunites the ones it can
    // safely and unambiguously match with their label; any that remain here
    // could not be matched, so rendering them would just be an empty dot
    // with no information. Drop them rather than show that as content.
    if(/^[•·]$/.test(t)) return '';
    const safe=esc(t);
    if(/^\d+\.\s+/.test(t)) return `<div class="rule-line rule-numbered"><span class="rule-num">${esc(t.match(/^\d+\./)[0])}</span><span>${esc(t.replace(/^\d+\.\s+/,''))}</span></div>`;
    if(/^[•·]\s*/.test(t)) return `<div class="rule-line rule-bullet"><span class="rule-marker">•</span><span>${esc(t.replace(/^[•·]\s*/,''))}</span></div>`;
    if(/^[-–—]\s+/.test(t)) return `<div class="rule-line rule-bullet"><span class="rule-marker">—</span><span>${esc(t.replace(/^[-–—]\s+/,''))}</span></div>`;
    if(/^(NOTE|EXAMPLE|IMPORTANT|SPECIAL RULE|SPECIAL RULES|RESCUE MISSIONS|DETERMINING THE ATTACKER AND DEFENDER|HOME TURF ADVANTAGE|VOLUNTARY ROUT|DECLARE WARBAND IS FLEEING|ASSISTANCE|MULTIPLE INJURY DICE|RALLY TESTS|RECOVERY TESTS|LEADING BY EXAMPLE)$/i.test(t)) return `<div class="rule-line rule-callout-title">${safe}</div>`;
    if(i===0 || /^(THE PRE-BATTLE SEQUENCE|ROUND SEQUENCE|PRIORITY PHASE|ACTION PHASE|END PHASE|ROLL FOR PRIORITY|READY WARRIORS|FLEEING THE BATTLEFIELD|ACTIVATE WARRIORS|ROUT TESTS|RECOVERY TESTS|RALLY TESTS|THE ACTION PHASE|THE END PHASE|THE PRIORITY PHASE|THE RULES|GAME STRUCTURE)$/i.test(t)) return `<div class="rule-line rule-heading">${safe}</div>`;
    if(/^[A-Z][A-Z0-9'’&\- ]{5,}$/.test(t) && t.length<90) return `<div class="rule-line rule-subheading rule-caps">${safe}</div>`;
    if(/^(Note:|Example:|Important:)/i.test(t)) return `<div class="rule-line rule-note"><strong>${esc(t.split(':')[0]+':')}</strong><span>${esc(t.slice(t.indexOf(':')+1).trim())}</span></div>`;
    if(/^(The |Game |Round |Priority |Action |End |Close |Resolve |Psychology |Magic |Movement |Terrain |Shooting |Combat |Recovery |Rally |Fleeing |Leading |Voluntary |Changing |Determine |Set Up |Choose |Announce |Deployment)/i.test(t) && t.length<65 && !/[.,;:]$/.test(t)) return `<div class="rule-line rule-subheading">${safe}</div>`;
    return `<div class="rule-line">${safe}</div>`;
  }).join('');
}
function ruleOverrideKey(sectionId,page){return `${sectionId}:${page}`}
// Section titles in Règles are always "<number> <name>" (e.g. "2.2.2
// Actions"). The number was the same size/weight as the rest of the title
// and easy to miss when scanning the theme cards — this pulls it into its
// own bold, accent-colored span so it reads as a distinct label instead of
// blending into the title text.
function ruleTitleMarkup(title){
  const m=String(title||'').match(/^([\d.]+)\s+(.*)$/);
  if(!m)return esc(title);
  return `<span class="rt-num">${esc(m[1])}</span><span class="rt-name">${esc(m[2])}</span>`;
}
// Both the Règles tab (paragraph-level overrides) and the Référentiel tab
// (per-entry overrides, keyed 'ref:<cat>:<id>') share this one override
// table/cache, so a save/cancel/restore made from either screen needs to
// re-render whichever of the two is actually on screen, not always 'rules'.
function rerenderOverrideHost(){const v=parseAppRoute().view;if(v==='rules'||v==='references')render(v);}
function ruleEffectiveText(sectionId,page){const o=ruleOverridesCache?.[ruleOverrideKey(sectionId,page)];return typeof o==='string'?o:null}
async function loadRuleOverrides(){
  if(ruleOverridesLoading||ruleOverridesCache!==null)return;
  ruleOverridesLoading=true;
  try{
    const res=await window.MordheimundaAPI.ruleOverrides();
    const map={};(res.overrides||[]).forEach(o=>{map[ruleOverrideKey(o.sectionId,o.page)]=o.text;});
    ruleOverridesCache=map;
  }catch(e){ruleOverridesCache=ruleOverridesCache||{};}
  ruleOverridesLoading=false;
  rerenderOverrideHost();
  // The fighter-card rule peek popup isn't the Rules/Référentiel view, so
  // rerenderOverrideHost() above won't touch it — refresh it separately if
  // it's the reason the cache just got loaded (e.g. hovering a rule link
  // before ever visiting those tabs).
  if(activeRulePeek&&$('#rulePeek')?.classList.contains('visible'))showRulePeek(activeRulePeek);
}
function rulePageMarkup(page,sectionId){
 const en=siteLanguage==='en';
 const override=sectionId?ruleEffectiveText(sectionId,page.page):null;
 const text=override!=null?override:page.text;
 const canEdit=sectionId&&isAdminSession();
 const isEditing=canEdit&&ruleOverridesEditKey===ruleOverrideKey(sectionId,page.page);
 const editBtn=canEdit?`<button type="button" class="rule-edit-btn" title="${en?'Edit this text (admin)':'Modifier ce texte (admin)'}" onclick="openRuleEdit('${esc(sectionId)}',${page.page})">✎ ${override!=null?(en?'Edited':'Modifié'):(en?'Edit':'Modifier')}</button>`:'';
 return `<section class="rule-page-block" id="rule-page-${page.page}"><div class="rule-page-heading"><span>${en?'Page':'Page'} ${page.page}</span>${override!=null?`<span class="rule-override-tag">${en?'CORRECTED':'CORRIGÉ'}</span>`:''}${editBtn}</div>${isEditing?ruleEditFormMarkup(sectionId,page.page,text):`<div class="rule-page-text">${ruleTextMarkup(text,{suppressActionUI:sectionId==='actions'})}</div>`}</section>`
}
function openRuleEdit(sectionId,page){ruleOverridesEditKey=ruleOverrideKey(sectionId,page);rerenderOverrideHost();setTimeout(()=>{const el=document.getElementById('ruleEditTextarea');if(el){el.focus();el.scrollIntoView({block:'center',behavior:'smooth'})}},30)}
function cancelRuleEdit(){ruleOverridesEditKey=null;rerenderOverrideHost()}
// Quick-insert helper for the rule editor toolbar below: wraps/prefixes the
// current selection (or a placeholder) with the exact plain-text convention
// ruleTextMarkup() already recognises (ALL CAPS line → heading, "Note: " →
// note callout, "• " → bullet), so admins get one-click formatting that's
// guaranteed to render with the site's existing rule typography/colors
// instead of guessing at the raw syntax.
function insertRuleEditToken(kind){
 const en=siteLanguage==='en';
 const el=document.getElementById('ruleEditTextarea');
 if(!el)return;
 const start=el.selectionStart??el.value.length,end=el.selectionEnd??el.value.length;
 const before=el.value.slice(0,start),selected=el.value.slice(start,end),after=el.value.slice(end);
 let insertText;
 if(kind==='heading')insertText=(selected||(en?'SECTION TITLE':'TITRE DE SECTION')).toUpperCase();
 else if(kind==='note')insertText=(en?'Note: ':'Note : ')+(selected||(en?'text':'texte'));
 else if(kind==='bullet')insertText='• '+(selected||(en?'text':'texte'));
 else if(kind==='actioncard')insertText=`[ACTIONCARDS]\n${en?'Action Name':'Nom de l’action'}|basic|active|${en?'What this action does.':'Ce que fait cette action.'}\n[/ACTIONCARDS]`;
 else return;
 const needsNL=before.length&&!/\n\n?$/.test(before);
 const prefix=needsNL?'\n\n':'';
 const suffix=(!after.length||!after.startsWith('\n'))?'\n':'';
 const newValue=before+prefix+insertText+suffix+after;
 el.value=newValue;
 const pos=(before+prefix+insertText).length;
 el.focus();el.setSelectionRange(pos,pos);
}
function ruleEditFormMarkup(sectionId,page,currentText){
 const en=siteLanguage==='en';
 const hasOverride=ruleEffectiveText(sectionId,page)!=null;
 // Only the "2.2.2 Actions" section uses the [ACTIONCARDS] syntax, so its
 // quick-insert button (and the extra format hint below) only shows up
 // there — everywhere else the toolbar stays exactly as before.
 const isActions=sectionId==='actions';
 const actionCardBtn=isActions?`<button type="button" class="rule-edit-tool rule-edit-tool-actioncard" onclick="insertRuleEditToken('actioncard')" title="${en?'Insert an action card':'Insérer une fiche action'}">▭ ${en?'Action card':'Fiche action'}</button>`:'';
 const hint=isActions
  ?(en?'One line per action: Name|Type|Statuses|Description — Type is simple, basic or double (shown as a glyph); Statuses is a comma list from active, pinned, injured, engaged (colors the card and adds its tags).':'Une ligne par action : Nom|Type|Statuts|Description — Type vaut simple, basic ou double (affiché en pictogramme) ; Statuts est une liste séparée par des virgules parmi active, pinned, injured, engaged (colore la fiche et ajoute ses pastilles).')
  :(en?'Formatting follows the rulebook’s own style — pick a line type, no manual styling needed.':'La mise en forme suit le style du livre de règles — choisis un type de ligne, pas besoin de mise en forme manuelle.');
 return `<div class="rule-edit-form"><div class="rule-edit-toolbar">
  <button type="button" class="rule-edit-tool rule-edit-tool-heading" onclick="insertRuleEditToken('heading')" title="${en?'Insert a section heading':'Insérer un titre de section'}">Aa <b>${en?'TITLE':'TITRE'}</b></button>
  <button type="button" class="rule-edit-tool rule-edit-tool-note" onclick="insertRuleEditToken('note')" title="${en?'Insert a Note: callout':'Insérer un encart Note :'}">${en?'Note':'Note'}</button>
  <button type="button" class="rule-edit-tool rule-edit-tool-bullet" onclick="insertRuleEditToken('bullet')" title="${en?'Insert a bullet point':'Insérer une puce'}">• ${en?'Bullet':'Puce'}</button>
  ${actionCardBtn}
  <span class="rule-edit-toolbar-hint">${hint}</span>
 </div><textarea id="ruleEditTextarea" class="wide-textarea rule-edit-textarea" rows="12">${esc(currentText)}</textarea><div class="custom-actions rule-edit-actions"><button type="button" class="button secondary" onclick="cancelRuleEdit()">${en?'Cancel':'Annuler'}</button>${hasOverride?`<button type="button" class="button secondary" onclick="restoreRuleOriginal('${esc(sectionId)}',${page})">↺ ${en?'Restore original text':'Restaurer le texte d’origine'}</button>`:''}<button type="button" class="button primary" onclick="saveRuleEdit('${esc(sectionId)}',${page})">${en?'Save':'Enregistrer'}</button></div></div>`
}
async function saveRuleEdit(sectionId,page){
 const en=siteLanguage==='en';
 const textarea=document.getElementById('ruleEditTextarea');
 const text=(textarea?.value||'').trim();
 if(!text){toast(en?'Text cannot be empty':'Le texte ne peut pas être vide');return}
 try{
  await window.MordheimundaAPI.adminSaveRuleOverride(sectionId,page,text);
  ruleOverridesCache=ruleOverridesCache||{};ruleOverridesCache[ruleOverrideKey(sectionId,page)]=text;
  ruleOverridesEditKey=null;rerenderOverrideHost();toast(en?'Rule text updated':'Texte de la règle mis à jour');
 }catch(e){toast(authError(e,en));}
}
async function restoreRuleOriginal(sectionId,page){
 const en=siteLanguage==='en';
 try{
  await window.MordheimundaAPI.adminDeleteRuleOverride(sectionId,page);
  if(ruleOverridesCache)delete ruleOverridesCache[ruleOverrideKey(sectionId,page)];
  ruleOverridesEditKey=null;rerenderOverrideHost();toast(en?'Original text restored':'Texte d’origine restauré');
 }catch(e){toast(authError(e,en));}
}

function ruleSectionMarkup(section){return `<details class="rules-section" data-rule-id="${section.id}" ${rulesOpen===section.id?'open':''} ontoggle="if(this.open){rulesOpen='${section.id}'}"><summary><span><b>${esc(section.title)}</b><small>${esc(section.pages)}</small></span><i>＋</i></summary><div class="rules-section-body">${section.content.map(p=>rulePageMarkup(p,section.id)).join('')}</div></details>`}
function openRuleSection(id){rulesOpen=id;render('rules');window.scrollTo({top:0,left:0,behavior:'auto'})}
function rules(){
if(ruleOverridesCache===null)loadRuleOverrides();
const en=siteLanguage==='en';
const q=rulesSearch.trim().toLowerCase();const list=q?RULES_BOOK.filter(s=>(s.title+' '+s.pages+' '+s.content.map(p=>p.text).join(' ')).toLowerCase().includes(q)):RULES_BOOK;
const current=list.find(s=>s.id===rulesOpen)||list[0]||null;
// Option B: the 14 existing sections regrouped by theme into a grid of
// clickable topic cards (icon, page range, a preview of the sub-sections
// inside, and a badge for how many quick-access tables or the Actions
// card-view live under that theme) — replaces the old single flat "Sommaire"
// list/sidebar with the mockup's actual card layout rather than just its
// grouping logic.
const topicGridMarkup=(()=>{
  const cards=RULES_NAV_GROUPS.map(g=>{
    const items=g.ids.map(id=>list.find(s=>s.id===id)).filter(Boolean);
    if(!items.length)return '';
    const containsCurrent=!!(current&&g.ids.includes(current.id));
    const isOpen=containsCurrent||!rulesNavCollapsed.has(g.id);
    const tableCount=RULES_QUICK_TABLES.filter(t=>g.ids.includes(t.id)).length;
    const hasActions=g.ids.includes('actions');
    const badges=`${tableCount?`<span class="tc-tables">${tableCount} ${en?(tableCount===1?'table':'tables'):(tableCount===1?'tableau':'tableaux')}</span>`:''}${hasActions?`<span class="tc-cards-badge">2.2.2 → ${en?'card view':'vue fiches'}</span>`:''}`;
    const subList=isOpen?`<ul class="tc-sub">${items.map(s=>`<li><a href="#" class="${current&&s.id===current.id?'active':''}" onclick="event.stopPropagation();openRuleSection('${s.id}');return false;">${ruleTitleMarkup(s.title)}</a></li>`).join('')}</ul>`:'';
    return `<div class="topic-card${isOpen?' open':''}${containsCurrent?' active':''}" onclick="toggleRulesNavGroup('${g.id}')">
      <div class="tc-head"><span class="tc-ic">${g.icon}</span><div><h3>${esc(en?g.en:g.fr)}</h3><span class="tc-count">${esc(g.pages)}</span></div></div>
      ${subList}
      ${badges?`<div class="tc-badges">${badges}</div>`:''}
    </div>`;
  }).join('');
  return cards||`<span class="muted">${en?'No results':'Aucun résultat'}</span>`;
})();
$('#content').innerHTML=`<div class="rules-shell-wrap">
<div class="rules-head"><h1 class="rules-page-title">${en?'Rules':'Règles'}</h1><p>${en?'The complete M17 rules, organized by theme — browse the menu like an online rulebook.':'L’intégralité des règles M17, organisées par thème — navigue dans le menu comme dans un livre de règles en ligne.'}</p></div>
${rulesQuickTablesMarkup(en)}
<div class="section-label">${en?'Rule themes':'Thèmes des règles'} <span class="src">— ${en?'existing categories, simply grouped':'catégories actuelles, simplement regroupées'}</span></div>
<input class="rules-search" type="text" value="${esc(rulesSearch)}" placeholder="${en?'Search a rule, an action, a spell…':'Rechercher une règle, une action, un sort…'}" oninput="setRulesSearch(this.value)">
<div class="topic-grid">${topicGridMarkup}</div>
<div class="rules-shell rules-shell-nogutter">
<div class="rules-main">
${current?`<div class="rules-crumb"><a href="#" onclick="render('dashboard');return false;">${en?'Home':'Accueil'}</a><span class="sep">›</span><span class="cur">${esc(current.title)}</span></div>
<div class="title-row"><h1 class="rules-title">${ruleTitleMarkup(current.title)}</h1></div>
<span class="raw-badge">VO</span><span class="raw-cite">${esc(current.pages)}</span>
<div class="rules-article-body">${current.content.map(p=>rulePageMarkup(p,current.id)).join('')}</div>${current.id==='magic'?magicSpellGalleryMarkup(en):''}${current.id==='actions'?actionGroupsGalleryMarkup(en):''}`:`<div class="empty large"><strong>${en?'No rule found.':'Aucune règle trouvée.'}</strong><span>${en?'Try another term.':'Essaie un autre terme.'}</span></div>`}
</div>
<nav class="rules-toc"><div class="rules-toc-label">${en?'On this page':'Sur cette page'}</div>${current?current.content.map(p=>`<a href="#rule-page-${p.page}">${en?'Page':'Page'} ${p.page}</a>`).join(''):''}</nav>
</div>
</div>`}
function setRulesSearch(v){rulesSearch=v;render('rules')}
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
  $('#content').innerHTML=`<div class="account-page"><div class="page-intro"><div><div class="eyebrow">ACCOUNT / PROFILE</div><h2>${en?'Account':'Compte'}</h2><p>${en?'Your account keeps your warbands and custom content available across devices.':'Votre compte conserve vos bandes et votre contenu personnalisé sur vos différents appareils.'}</p></div></div><div class="account-grid"><section class="card account-card"><div class="account-icon">◎</div><h3>${session?(en?'Signed in':'Connecté'):(en?'Not signed in':'Non connecté')}</h3>${session?`<p><strong>${esc(session.username||'')}</strong>${session.email?` · ${esc(session.email)}`:''}</p><div class="account-actions"><button class="button secondary" title="${en?'Use only if automatic sync is delayed or unavailable.':'À utiliser uniquement si la synchronisation automatique rencontre un problème.'}" onclick="syncCloudNow()">${en?'Force sync':'Synchroniser en cas de souci'}</button><button class="button secondary" onclick="logoutAccount()">${en?'Sign out':'Se déconnecter'}</button></div><details class="account-password"><summary>${en?'Change password':'Changer le mot de passe'}</summary><form onsubmit="changeAccountPassword(event)"><label>${en?'Current password':'Mot de passe actuel'}<input id="currentAccountPassword" type="password" minlength="10" required></label><label>${en?'New password':'Nouveau mot de passe'}<input id="newAccountPassword" type="password" minlength="10" required></label><button class="button secondary" type="submit">${en?'Change password':'Modifier le mot de passe'}</button></form></details>`:`<p>${en?'Sign in to synchronize your data between devices.':'Connectez-vous pour synchroniser vos données entre appareils.'}</p><div class="account-actions"><button class="button primary" onclick="openAccountAuth('login')">${en?'Sign in':'Se connecter'}</button><button class="button secondary" onclick="openAccountAuth('signup')">${en?'Create an account':'Créer un compte'}</button></div>`}</section><section class="card account-card"><div class="eyebrow">DATA</div><h3>${en?'Cloud storage':'Stockage cloud'}</h3><div class="account-data-row"><span>${en?'Local warbands':'Bandes locales'}</span><strong>${state.rosters.length}</strong></div><div class="account-data-row"><span>${en?'Custom content':'Contenu personnalisé'}</span><strong>${(state.customFighters||[]).length+(state.customEquipment||[]).length+(state.customSkills||[]).length+(state.customSpells||[]).length+(state.customWarbands||[]).length}</strong></div><p class="muted">${session?(en?'Changes are saved locally and synchronized to your account automatically.':'Les changements sont enregistrés localement puis synchronisés automatiquement avec votre compte.'):(en?'Your local data remains available without an account.':'Vos données locales restent disponibles sans compte.')}</p>${session?`<details class="account-diag" ${accountDiagOpen?'open':''} ontoggle="accountDiagOpen=this.open"><summary>${en?'Sync diagnostics':'Diagnostic de synchro'}</summary><div id="diagLocalResult">${accountDiagLocalMarkup(en)}</div><button type="button" class="button secondary" onclick="refreshAccountDiag()">${en?'Refresh (local)':'Rafraîchir (local)'}</button><hr><div id="diagServerResult"><p class="muted">${en?'Not checked yet.':'Pas encore vérifié.'}</p></div><button type="button" class="button secondary" onclick="checkServerData()">${en?'Check what the server has':'Vérifier ce que le serveur a'}</button></details>`:''}</section></div>
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
</div>`:''}
${session?`<div class="account-access-log card">
  <div class="eyebrow">PRIVACY</div><h3>${en?'Who looked at my data':'Qui a consulté mes données'}</h3>
  <div id="accessLogBody"><p class="muted">${en?'Loading…':'Chargement…'}</p></div>
</div>`:''}
</div>`;
if(session){loadFriendsPanel();loadAccessLog();}
}
async function loadFriendsPanel(){
  const en=siteLanguage==='en',box=$('#friendsCardBody');if(!box)return;
  try{
    const {friends,incoming,outgoing}=await window.MordheimundaAPI.friends();
    const row=(u,actions)=>`<div class="friend-row"><span class="friend-avatar">${esc((u.username||'?')[0].toUpperCase())}</span><strong>${esc(u.username)}</strong><span class="friend-actions">${actions}</span></div>`;
    box.innerHTML=`
      ${incoming.length?`<div class="friend-section-title">${en?'Requests received':'Demandes reçues'} (${incoming.length})</div>${incoming.map(r=>row({username:r.username},`<button class="button primary tiny" onclick="acceptFriendRequestUI('${r.id}')">${en?'Accept':'Accepter'}</button><button class="button secondary tiny" onclick="declineFriendRequestUI('${r.id}')">${en?'Decline':'Refuser'}</button>`)).join('')}`:''}
      ${outgoing.length?`<div class="friend-section-title">${en?'Requests sent':'Demandes envoyées'} (${outgoing.length})</div>${outgoing.map(r=>row({username:r.username},`<span class="friend-pending">${en?'Pending':'En attente'}</span><button class="button secondary tiny" onclick="cancelFriendRequestUI('${r.id}')">${en?'Cancel':'Annuler'}</button>`)).join('')}`:''}
      <div class="friend-section-title">${en?'Friends':'Amis'} (${friends.length})</div>
      ${friends.length?friends.map(f=>row(f,`<button class="text-button" title="${en?'Remove':'Retirer'}" onclick="removeFriendUI('${f.id}')">✕</button>`)).join(''):`<p class="muted">${en?'No friends yet.':'Aucun ami pour l’instant.'}</p>`}
    `;
  }catch(e){box.innerHTML=`<p class="muted">${en?'Could not load friends.':'Impossible de charger les amis.'}</p>`}
}
async function sendFriendRequestUI(ev){ev.preventDefault();const en=siteLanguage==='en',identifier=$('#friendIdentifier')?.value.trim();if(!identifier)return;try{await window.MordheimundaAPI.sendFriendRequest(identifier);$('#friendIdentifier').value='';toast(en?'Request sent':'Demande envoyée');loadFriendsPanel();}catch(e){toast(authError(e,en));}}
async function acceptFriendRequestUI(id){const en=siteLanguage==='en';try{await window.MordheimundaAPI.acceptFriendRequest(id);toast(en?'Friend added':'Ami ajouté');loadFriendsPanel();}catch(e){toast(authError(e,en));}}
async function declineFriendRequestUI(id){try{await window.MordheimundaAPI.declineFriendRequest(id);loadFriendsPanel();}catch(e){}}
async function cancelFriendRequestUI(id){try{await window.MordheimundaAPI.cancelFriendRequest(id);loadFriendsPanel();}catch(e){}}
async function removeFriendUI(id){try{await window.MordheimundaAPI.removeFriend(id);loadFriendsPanel();}catch(e){}}
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
async function loadAccessLog(){
  const en=siteLanguage==='en',box=$('#accessLogBody');if(!box)return;
  try{
    const {entries}=await window.MordheimundaAPI.accountAccessLog();
    box.innerHTML=entries.length?`<ul class="access-log-list">${entries.map(e=>`<li>${esc(e.admin_username)} — ${new Date(e.accessed_at).toLocaleString(en?'en-US':'fr-FR')}</li>`).join('')}</ul>`:`<p class="muted">${en?'No one has looked at your data.':'Personne n’a consulté tes données.'}</p>`;
  }catch(e){box.innerHTML='';}
}
function authError(e,en){const m={INVALID_USERNAME:en?'Username: 3–24 letters, numbers, _ or -.':'Nom d’utilisateur : 3 à 24 caractères, lettres/chiffres/_/-.',INVALID_EMAIL:en?'Invalid email address.':'Adresse e-mail invalide.',INVALID_PASSWORD:en?'Password must contain 10–128 characters.':'Le mot de passe doit contenir 10 à 128 caractères.',ACCOUNT_EXISTS:en?'Username or email already in use.':'Nom d’utilisateur ou e-mail déjà utilisé.',INVALID_CREDENTIALS:en?'Incorrect login or password.':'Identifiants incorrects.',RECOVERY_UNAVAILABLE:en?'Recovery service is temporarily unavailable.':'Le service de récupération est temporairement indisponible.',DATABASE_NOT_CONFIGURED:en?'Online account service is not configured on this server.':'Le service de compte en ligne n’est pas configuré sur ce serveur.',RATE_LIMITED:en?'Too many attempts. Please wait a few minutes.':'Trop de tentatives. Attendez quelques minutes.',API_NOT_CONFIGURED:en?'The online service is not configured.':'Le service en ligne n’est pas configuré.',INVALID_IDENTIFIER:en?'Enter an email or username.':'Renseigne un e-mail ou un pseudo.',ACCOUNT_NOT_FOUND:en?'No account matches this email/username.':'Aucun compte ne correspond à cet e-mail/pseudo.',ADMIN_REQUIRED:en?'Admins only.':'Réservé aux administrateurs.',INTERNAL_SERVER_ERROR:en?'Server error — please try again.':'Erreur serveur — réessaie dans un instant.'};return m[e?.message]||m[e?.error]||e?.message||'Error';}
function openAccountAuth(mode){const en=siteLanguage==='en';const signup=mode==='signup';openModal(`<div class="account-auth"><div class="eyebrow">${signup?(en?'CREATE ACCOUNT':'CRÉER UN COMPTE'):(en?'SIGN IN':'CONNEXION')}</div><h2>${signup?(en?'Create an account':'Créer un compte'):(en?'Sign in':'Se connecter')}</h2><form id="accountAuthForm" onsubmit="submitAccountAuth(event,'${mode}')"><label>${signup?(en?'Username':'Nom d’utilisateur'):(en?'Username or email':'Nom d’utilisateur ou e-mail')}<input id="authLogin" autocomplete="username" required></label>${signup?`<label>${en?'Email':'E-mail'}<input id="authEmail" type="email" autocomplete="email" required></label>`:''}<label>${en?'Password':'Mot de passe'}<input id="authPassword" type="password" autocomplete="${signup?'new-password':'current-password'}" required minlength="10"></label><div class="account-actions"><button class="button primary" type="submit">${signup?(en?'Create account':'Créer le compte'):(en?'Sign in':'Se connecter')}</button><button class="button secondary" type="button" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div></form>${!signup?`<div class="account-links"><button class="text-button" onclick="openRecovery('password')">${en?'Forgot password?':'Mot de passe oublié ?'}</button><button class="text-button" onclick="openRecovery('username')">${en?'Forgot username?':'Nom d’utilisateur oublié ?'}</button></div>`:''}</div>`);}
async function submitAccountAuth(ev,mode){ev.preventDefault();const en=siteLanguage==='en';const login=$('#authLogin')?.value.trim(),password=$('#authPassword')?.value||'';try{const user=mode==='signup'? (await window.MordheimundaAPI.register({username:login,email:$('#authEmail')?.value.trim()||'',password})).user : (await window.MordheimundaAPI.login({login,password})).user;await syncAccountAfterLogin(user);closeModal();render('account');toast(en?'Account connected':'Compte connecté');}catch(e){toast(authError(e,en));}}
function openRecovery(kind){const en=siteLanguage==='en';openModal(`<div class="account-auth"><div class="eyebrow">${kind==='password'?(en?'PASSWORD RECOVERY':'RÉCUPÉRATION DU MOT DE PASSE'):(en?'USERNAME RECOVERY':'RÉCUPÉRATION DU NOM D’UTILISATEUR')}</div><h2>${kind==='password'?(en?'Recover your account':'Récupérer votre compte'):(en?'Recover username':'Récupérer le nom d’utilisateur')}</h2><p>${en?'Enter the email linked to your account.':'Saisissez l’e-mail associé à votre compte.'}</p><form onsubmit="submitRecovery(event,'${kind}')"><label>E-mail<input id="recoveryEmail" type="email" required autocomplete="email"></label><div class="account-actions"><button class="button primary" type="submit">${en?'Send':'Envoyer'}</button><button class="button secondary" type="button" onclick="openAccountAuth('login')">${en?'Back':'Retour'}</button></div></form></div>`);}
async function submitRecovery(ev,kind){ev.preventDefault();const en=siteLanguage==='en';try{if(kind==='password')await window.MordheimundaAPI.recoverPassword({email:$('#recoveryEmail').value.trim()});else await window.MordheimundaAPI.recoverUsername({email:$('#recoveryEmail').value.trim()});closeModal();toast(en?'If the address is registered, an email has been sent.':'Si cette adresse est enregistrée, un e-mail a été envoyé.');}catch(e){toast(authError(e,en));}}
async function logoutAccount(){try{await window.MordheimundaAPI.logout()}catch{}stopCloudPolling();localStorage.removeItem(ACCOUNT_SESSION_KEY);refreshAdminNavVisibility();render('account');toast(siteLanguage==='en'?'Signed out':'Déconnecté');}
async function syncCloudNow(){
  const en=siteLanguage==='en';
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
    const remoteData=remote?.payload||{};
    const remoteRevision=toRev(remote?.revision)??1;
    const merged=mergeAccountData(remoteData,state);
    merged.meta={...(state.meta||{}),cloudRevision:remoteRevision,cloudDirty:true};
    state=window.MordheimundaStorage.save(merged);
    scheduleRemoteRerender();
    await flushCloudSave();
    startCloudPolling();render('account');
    toast(en?'Cloud synchronized':'Cloud synchronisé');
  }catch(e){recordCloudError('syncCloudNow',e);toast(authError(e,en));}
}
async function changeAccountPassword(ev){ev.preventDefault();const en=siteLanguage==='en';try{await window.MordheimundaAPI.changePassword({currentPassword:$('#currentAccountPassword').value,newPassword:$('#newAccountPassword').value});toast(en?'Password changed':'Mot de passe modifié');$('#currentAccountPassword').value='';$('#newAccountPassword').value='';}catch(e){toast(authError(e,en));}}
async function bootstrapAccountSession(){
  try{
    const r=await window.MordheimundaAPI.session();
    if(!r?.user)return;
    localStorage.setItem(ACCOUNT_SESSION_KEY,JSON.stringify(r.user));
    refreshAdminNavVisibility();
    const localDirty=!!state?.meta?.cloudDirty;
    const remote=await window.MordheimundaAPI.loadData();
    if(remote?.payload&&toRev(remote.revision)!==null){
      if(localDirty){
        // Never discard edits made while the device was temporarily offline.
        // Merge them over the remote baseline, then push automatically.
        state=mergeAccountData(remote.payload,state);
        state.meta=state.meta||{};
        state.meta.accountUserId=r.user.id;
        state.meta.cloudRevision=toRev(remote.revision);
        state.meta.cloudDirty=true;
        state=window.MordheimundaStorage.save(state);
        queueCloudSave(50);
      }else{
        applyRemoteData(remote.payload,remote.revision);
        state.meta.accountUserId=r.user.id;
        window.MordheimundaStorage.save(state);
      }
    }
    startCloudPolling();
  }catch(e){
    if(e.status===401)localStorage.removeItem(ACCOUNT_SESSION_KEY);
    console.warn('Account bootstrap failed',e);
  }
}
function showPasswordReset(){const params=new URLSearchParams(location.search),t=params.get('reset');if(!t)return;const en=siteLanguage==='en';openModal(`<div class="account-auth"><div class="eyebrow">${en?'PASSWORD RESET':'RÉINITIALISATION'}</div><h2>${en?'Choose a new password':'Choisissez un nouveau mot de passe'}</h2><form onsubmit="submitPasswordReset(event)"><label>${en?'New password':'Nouveau mot de passe'}<input id="resetPassword" type="password" minlength="10" required></label><div class="account-actions"><button class="button primary" type="submit">${en?'Change password':'Changer le mot de passe'}</button></div></form></div>`);}
async function submitPasswordReset(ev){ev.preventDefault();const en=siteLanguage==='en',t=new URLSearchParams(location.search).get('reset');try{await window.MordheimundaAPI.resetPassword({token:t,password:$('#resetPassword').value});history.replaceState({},'',location.pathname);closeModal();toast(en?'Password changed':'Mot de passe modifié');}catch(e){toast(authError(e,en));}}

/* ================= OFFICIAL WARBANDS (ADMIN) =================
   Any admin-published warband is fetched from /api/warbands/official and
   merged straight into the same global registries the app already reads
   from at render time, in the exact shape official content already has:
   - the faction itself (id/displayName/group/budget/warriors/equipment) → D.factions
   - any custom skill tree / skill it uses → D.skillSets + RULES.categories.skills
   - any custom magic domain / spell it uses → MAGIC_DOMAINS + RULES.categories.spells
   - any custom trait / special rule it uses → RULES.categories.traits / .special
   From that point on every existing code path (faction lookup, the "Create
   warband" grid, skillAccess/magicAccess resolution, refLink tooltips, roster
   budget math…) treats all of it like any other official content — no
   special-casing needed elsewhere. Everything merged here is tagged
   `__official` so a refetch (after officializing/removing something) can
   cleanly re-sync without piling up duplicates. */
let officialMergeState=null;
function resetOfficialMergeState(){officialMergeState={skillsAdded:{},spellsAdded:{}};}
function unmergeOfficialContent(){
  // Reverse extensions previously merged onto pre-existing (book) trees/
  // domains, before resetting the tracker. Trees/domains that were brand-new
  // never touch D.skillSets/MAGIC_DOMAINS at all (see mergeOfficialWarbandPackage
  // below), so there's nothing to undo there — they live only on the faction
  // object, which is dropped wholesale by the D.factions filter.
  if(officialMergeState){
    Object.entries(officialMergeState.skillsAdded).forEach(([tree,names])=>{if(Array.isArray(D.skillSets[tree]))D.skillSets[tree]=D.skillSets[tree].filter(n=>!names.has(n));});
    Object.entries(officialMergeState.spellsAdded).forEach(([domain,names])=>{if(Array.isArray(MAGIC_DOMAINS[domain]))MAGIC_DOMAINS[domain]=MAGIC_DOMAINS[domain].filter(n=>!names.has(n));});
  }
  resetOfficialMergeState();
  D.factions=D.factions.filter(f=>!f.__official);
  ['skills','traits','spells','special'].forEach(cat=>{
    if(Array.isArray(RULES.categories?.[cat]))RULES.categories[cat]=RULES.categories[cat].filter(e=>!e.__official);
  });
}
function mergeOfficialWarbandPackage(ow){
  ow.__official=true;
  if(!Array.isArray(ow.warriors))ow.warriors=[];
  if(!Array.isArray(ow.equipment))ow.equipment=[];
  D.factions.push(ow);
  const officialRefEntry=(cat,idPrefix,name,text)=>{
    RULES.categories[cat]=RULES.categories[cat]||[];
    if(RULES.categories[cat].some(e=>normName(e.name)===normName(name)))return;
    RULES.categories[cat].push({id:idPrefix+'-'+normName(name),name,text:text||'',lines:String(text||'').split(/\n+/).filter(Boolean).length||1,custom:true,__official:true});
  };
  // A tree/domain that already exists (an official book tree, or one another
  // already-merged official warband made global) gets its new skill/spell
  // merged in globally — that's just added content on shared ground. A
  // BRAND-NEW tree/domain — exclusive to this warband — never touches
  // D.skillSets/MAGIC_DOMAINS: it's kept on the faction object itself
  // (f.exclusiveSkillSets/f.exclusiveMagicDomains) so only the warriors this
  // warband actually attributed it to (via their own baked-in
  // skillAccess/magicAccess) can use it — see customMergedSkillSets(f).
  (ow.skillTrees||[]).forEach(t=>{
    if(!t?.name||D.skillSets[t.name])return;
    ow.exclusiveSkillSets=ow.exclusiveSkillSets||{};
    if(!ow.exclusiveSkillSets[t.name])ow.exclusiveSkillSets[t.name]=[];
  });
  (ow.skills||[]).forEach(s=>{
    if(!s?.name||!s?.tree)return;
    if(D.skillSets[s.tree]){
      if(!D.skillSets[s.tree].includes(s.name)){D.skillSets[s.tree].push(s.name);(officialMergeState.skillsAdded[s.tree]=officialMergeState.skillsAdded[s.tree]||new Set()).add(s.name);}
    }else{
      ow.exclusiveSkillSets=ow.exclusiveSkillSets||{};
      if(!ow.exclusiveSkillSets[s.tree])ow.exclusiveSkillSets[s.tree]=[];
      if(!ow.exclusiveSkillSets[s.tree].includes(s.name))ow.exclusiveSkillSets[s.tree].push(s.name);
    }
    officialRefEntry('skills','official-skill',s.name,s.text);
  });
  (ow.magicDomains||[]).forEach(d=>{
    if(!d?.name||MAGIC_DOMAINS[d.name])return;
    ow.exclusiveMagicDomains=ow.exclusiveMagicDomains||{};
    if(!ow.exclusiveMagicDomains[d.name])ow.exclusiveMagicDomains[d.name]=[];
  });
  (ow.spells||[]).forEach(s=>{
    if(!s?.name||!s?.domain)return;
    if(MAGIC_DOMAINS[s.domain]){
      if(!MAGIC_DOMAINS[s.domain].includes(s.name)){MAGIC_DOMAINS[s.domain].push(s.name);(officialMergeState.spellsAdded[s.domain]=officialMergeState.spellsAdded[s.domain]||new Set()).add(s.name);}
    }else{
      ow.exclusiveMagicDomains=ow.exclusiveMagicDomains||{};
      if(!ow.exclusiveMagicDomains[s.domain])ow.exclusiveMagicDomains[s.domain]=[];
      if(!ow.exclusiveMagicDomains[s.domain].includes(s.name))ow.exclusiveMagicDomains[s.domain].push(s.name);
    }
    officialRefEntry('spells','official-spell',s.name,s.text);
  });
  (ow.traits||[]).forEach(t=>{if(t?.name)officialRefEntry('traits','official-trait',t.name,t.text);});
  (ow.specialRules||[]).forEach(t=>{if(t?.name)officialRefEntry('special','official-special',t.name,t.text);});
}
async function loadOfficialWarbands(){
  try{
    const r=await window.MordheimundaAPI.officialWarbands();
    const list=Array.isArray(r?.warbands)?r.warbands:[];
    unmergeOfficialContent();
    list.forEach(mergeOfficialWarbandPackage);
  }catch(e){console.warn('Official warbands unavailable',e);}
}
/* Gathers every custom skill/spell/trait/special-rule an officialized
   warband's resolved warriors & equipment actually reference, by name (the
   only way the rest of the app resolves them), plus the warband's own
   selected traits/special rules (cw.traitIds/specialRuleIds — dropped by
   customWarbandFaction()). Anything already part of the official book
   (D.skillSets / MAGIC_DOMAINS / RULES.categories keys) is left out since
   every account already has it. */
function bundleCustomContentForOfficialize(cw,fx){
  const skillTreeNames=new Set(),magicDomainNames=new Set(),ruleNames=new Set();
  // A fighter can reference custom equipment/skills that were never
  // separately checked in the warband's own "Équipement"/skill-access tabs —
  // its defaultEquipment loadout, its purchasable equipmentAccess list, or a
  // defaultSkill from a tree it doesn't otherwise have access to. Without
  // pulling those in too, officializing would bake the fighter as official
  // while leaving something it depends on stuck as still-custom (invisible/
  // unresolvable on every other account). equipmentByName starts from the
  // warband's own checked equipment and gets anything else it's missing
  // added below; official equipment is never re-added here since it's
  // already resolvable everywhere.
  const equipmentByName=new Map((fx.equipment||[]).map(e=>[normName(e.name),e]));
  const addEquipmentByName=(name)=>{
    const key=normName(name);
    if(!key||equipmentByName.has(key))return;
    const found=customEquipmentList().find(e=>normName(e.name)===key);
    if(found)equipmentByName.set(key,found);
  };
  (fx.warriors||[]).forEach(w=>{
    Object.keys(w?.skillAccess||{}).forEach(n=>skillTreeNames.add(n));
    Object.keys(w?.magicAccess||{}).forEach(n=>magicDomainNames.add(n));
    (Array.isArray(w?.ruleNames)?w.ruleNames:[]).forEach(n=>n&&ruleNames.add(n));
    (Array.isArray(w?.defaultEquipment)?w.defaultEquipment:[]).forEach(addEquipmentByName);
    (Array.isArray(w?.equipmentAccessGroups)?w.equipmentAccessGroups:Array.isArray(w?.equipmentAccess)?w.equipmentAccess:[]).forEach(addEquipmentByName);
    (Array.isArray(w?.defaultSkills)?w.defaultSkills:[]).forEach(name=>{
      const skill=customContentList('skills').find(s=>normName(s.name)===normName(name));
      if(skill?.tree)skillTreeNames.add(skill.tree);
    });
  });
  const equipment=[...equipmentByName.values()];
  equipment.forEach(e=>{(Array.isArray(e?.traits)?e.traits:[]).forEach(n=>n&&ruleNames.add(n));});
  // Band-wide picks (cw.specialRuleIds/traitIds) are tracked separately from
  // per-fighter/per-weapon rules above, so a bandRuleNames list can travel
  // alongside the flat specialRules/traits union and tell the client, once
  // this is published, which of those apply to every recruited fighter
  // automatically rather than to one specific profile/weapon.
  const bandRuleNames=new Set();
  (cw.specialRuleIds||[]).forEach(id=>{const e=customContentById('special',id);if(e){ruleNames.add(e.name);bandRuleNames.add(e.name);}});
  (cw.traitIds||[]).forEach(id=>{const e=customContentById('traits',id);if(e){ruleNames.add(e.name);bandRuleNames.add(e.name);}});
  const wantedRuleNames=new Set([...ruleNames].map(normName));
  const skillTrees=customSkillTreeList().filter(t=>skillTreeNames.has(t.name)).map(t=>({name:t.name,description:t.description||''}));
  const skills=customContentList('skills').filter(s=>skillTreeNames.has(s.tree)).map(s=>({name:s.name,text:s.text||'',tree:s.tree}));
  const magicDomains=customMagicDomainList().filter(d=>magicDomainNames.has(d.name)).map(d=>({name:d.name,description:d.description||''}));
  const spells=customContentList('spells').filter(s=>magicDomainNames.has(s.domain)).map(s=>({name:s.name,text:s.text||'',domain:s.domain}));
  const traits=customContentList('traits').filter(t=>wantedRuleNames.has(normName(t.name))).map(t=>({name:t.name,text:t.text||''}));
  const specialRules=customContentList('special').filter(t=>wantedRuleNames.has(normName(t.name))).map(t=>({name:t.name,text:t.text||''}));
  return {skillTrees,skills,magicDomains,spells,traits,specialRules,bandRuleNames:[...bandRuleNames],equipment};
}

let adminAdminsCache=null,adminOfficialCache=null,adminLoading=false;
// Lightweight, admin-only editor for a published warband's BAND-WIDE rules
// (the traits/special rules that apply to the whole warband — see
// bandRuleNames). Unlike importOfficialWarbandForEditing (which clones the
// whole warband as a local custom-warband draft, with its own copies of
// every fighter/equipment, to be edited with the full Custom toolset then
// re-published), this never touches the Custom tab or state.customWarbands
// at all: it fetches the published definition, lets the admin toggle which
// existing rules are band-wide (or add a brand-new band-wide one), and PUTs
// the result straight back — the live warband is updated directly, with
// nothing left behind to clean up.
let adminRulesEditId=null,adminRulesEditData=null;
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
function admin(){
  const en=siteLanguage==='en';
  if(!isAdminSession()){$('#content').innerHTML=`<div class="empty large"><strong>${en?'Admins only':'Réservé aux administrateurs'}</strong></div>`;return}
  if(adminRulesEditId&&adminRulesEditData){$('#content').innerHTML=adminWarbandRulesPanel();return}
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
    <div class="admin-grid">
      <section class="card admin-card">
        <div class="eyebrow">${en?'ADMINS':'ADMINS'}</div>
        <h3>${en?'Admin accounts':'Comptes admin'}</h3>
        <div class="custom-item-list">${admins.length?admins.map(a=>`<article class="custom-item-row"><div class="custom-item-main"><div><strong>${esc(a.username)}</strong><small>${esc(a.email||'—')}</small></div></div><div class="custom-item-actions"><button type="button" class="equipment-action remove" onclick="confirmDemoteAdmin('${encodeURIComponent(a.username)}')">${en?'Revoke':'Retirer'}</button></div></article>`).join(''):`<div class="empty compact">${en?'No admin accounts yet.':'Aucun compte admin pour l’instant.'}</div>`}</div>
        <form class="admin-inline-form" onsubmit="promoteAdmin(event)"><label>${en?'Account email or username':'E-mail ou pseudo du compte'}<input id="adminPromoteEmail" required placeholder="joueur@example.com ${en?'or':'ou'} pseudo"></label><button class="button primary" type="submit">${en?'Grant admin':'Rendre admin'}</button></form>
      </section>
      <section class="card admin-card">
        <div class="eyebrow">${en?'OFFICIALIZE':'OFFICIALISER'}</div>
        <h3>${en?'Your custom warbands':'Tes warbands custom'}</h3>
        <p class="muted">${en?'Officializing keeps every fighter/equipment access restriction you defined and bundles along any custom skill, spell, trait or special rule the warband uses — all of it becomes available to every account, with the starting treasury set to the standard 1000 GC.':'Officialiser conserve toutes les restrictions d’accès (combattants/équipement) que tu as définies et embarque toute compétence, sort, trait ou règle spéciale custom utilisé par la bande — tout devient disponible pour tous les comptes, avec un trésor de départ standard de 1000 GC.'}</p>
        <div class="custom-item-list">${customsToOfficialize.length?customsToOfficialize.map(cw=>`<article class="custom-item-row"><div class="custom-item-main"><div><strong>${esc(cw.name)}</strong><small>${(cw.fighterIds||[]).length} ${en?'fighters':'combattants'}</small></div></div><div class="custom-item-actions"><button type="button" class="button secondary" onclick="officializeCustomWarband('${esc(cw.id)}')">${en?'Make official':'Rendre officielle'}</button></div></article>`).join(''):`<div class="empty compact">${customs.length?(en?'Every custom warband is already official — unpublish one to bring it back here.':'Toutes tes warbands custom sont déjà officielles — dépublie-en une pour la faire revenir ici.'):(en?'No custom warband yet — create one from the Custom tab first.':'Aucune warband custom — crées-en une depuis l’onglet Custom.')}</div>`}</div>
      </section>
      <section class="card admin-card">
        <div class="eyebrow">${en?'PUBLISHED':'PUBLIÉES'}</div>
        <h3>${en?'Official warbands':'Bandes officielles'}</h3>
        <p class="muted">${en?'Edit opens Official Edition — a copy exclusive to officialized content and admins, using the exact same tool as custom warbands (fighters/equipment/rules), which you then publish. Unpublish pulls a warband back from every account for corrections without deleting it, and returns its source warband to your active Custom list; permanent deletion is only possible once a warband is a draft, and requires typing its name.':'Éditer ouvre l’Édition officielle — une copie réservée au contenu officialisé et aux admins, avec exactement le même outil que les warbands custom (combattants/équipement/règles), à publier ensuite. Dépublier retire une bande de tous les comptes pour la corriger sans la supprimer, et fait revenir sa warband source dans ta liste Custom active ; la suppression définitive n’est possible qu’une fois la bande en brouillon, et demande de taper son nom.'}</p>
        <div class="custom-item-list">${officials.length?officials.map(w=>{const isDraft=w.status==='draft';return `<article class="custom-item-row"><div class="custom-item-main"><div><strong>${esc(w.name)}</strong><small>${isDraft?`<span class="official-status-draft">${en?'DRAFT — hidden':'BROUILLON — masquée'}</span> · `:''}${en?'by':'par'} ${esc(w.created_by_username||'—')} · ${new Date(w.created_at).toLocaleDateString()}</small></div></div><div class="custom-item-actions"><button type="button" class="button secondary" title="${en?'Opens Official Edition — an admin-only copy of this warband, edited like any custom content, then published back':'Ouvre l’Édition officielle — une copie de cette bande réservée aux admins, modifiable comme un contenu custom, à republier ensuite'}" onclick="importOfficialWarbandForEditing('${esc(w.id)}')">✎ ${en?'Edit':'Éditer'}</button><button type="button" class="button secondary" onclick="setOfficialWarbandStatus('${esc(w.id)}','${isDraft?'published':'draft'}')">${isDraft?(en?'Republish':'Republier'):(en?'Unpublish':'Dépublier')}</button>${isDraft?`<button type="button" class="equipment-action remove" title="${en?'Delete permanently':'Supprimer définitivement'}" onclick="confirmDeleteOfficialWarband('${esc(w.id)}')">🗑</button>`:''}</div></article>`}).join(''):`<div class="empty compact">${en?'No official warband published yet.':'Aucune bande officielle publiée pour l’instant.'}</div>`}</div>
      </section>
    </div>
  </div>`;
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
/* ================= ADMIN — EDIT A WARBAND'S BAND-WIDE RULES ===============
   Scoped, direct alternative to importOfficialWarbandForEditing: no
   state.customWarbands/customFighters/customEquipment copy is ever created,
   nothing shows up in the Custom tab, and saving PUTs the published
   definition straight back with only traits/specialRules/bandRuleNames
   changed — everything else (warriors, equipment, skill trees…) is carried
   over untouched from the definition the server already has. */
let adminWarbandSection='rules',adminEditingWarriorIdx=null,adminEditingEquipmentIdx=null;
async function openAdminWarbandRules(officialId){
  const en=siteLanguage==='en';
  try{
    const full=await window.MordheimundaAPI.adminGetWarband(officialId);
    adminRulesEditId=officialId;
    adminRulesEditData={...full,traits:arr2(full.traits),specialRules:arr2(full.specialRules),bandRuleNames:arr2(full.bandRuleNames).map(String),warriors:arr2(full.warriors),equipment:arr2(full.equipment)};
    adminWarbandSection='rules';adminEditingWarriorIdx=null;adminEditingEquipmentIdx=null;
    render('admin');
  }catch(e){toast(authError(e,en));}
}
function arr2(v){return Array.isArray(v)?v.slice():[]}
function closeAdminWarbandRules(){adminRulesEditId=null;adminRulesEditData=null;adminWarbandSection='rules';adminEditingWarriorIdx=null;adminEditingEquipmentIdx=null;render('admin')}
function setAdminWarbandSection(v){adminWarbandSection=v;adminEditingWarriorIdx=null;adminEditingEquipmentIdx=null;render('admin')}
function toggleAdminBandRule(kind,idx){
  const d=adminRulesEditData;if(!d)return;
  const list=kind==='special'?d.specialRules:d.traits;
  const r=list?.[idx];if(!r)return;
  const set=new Set(d.bandRuleNames.map(normName));
  if(set.has(normName(r.name)))d.bandRuleNames=d.bandRuleNames.filter(n=>normName(n)!==normName(r.name));
  else d.bandRuleNames=[...d.bandRuleNames,r.name];
  render('admin');
}
function addAdminBandRule(kind){
  const en=siteLanguage==='en';
  const d=adminRulesEditData;if(!d)return;
  const nameId=kind==='special'?'adminNewSpecialName':'adminNewTraitName',textId=kind==='special'?'adminNewSpecialText':'adminNewTraitText';
  const name=($('#'+nameId)?.value||'').trim(),text=($('#'+textId)?.value||'').trim();
  if(!name){toast(en?'Give the rule a name':'Donne un nom à la règle');return}
  const list=kind==='special'?d.specialRules:d.traits;
  if(list.some(r=>normName(r.name)===normName(name))){toast(en?'A rule with this name already exists':'Une règle porte déjà ce nom');return}
  list.push({name,text});
  d.bandRuleNames=[...d.bandRuleNames,name];
  render('admin');
}
async function saveAdminWarbandRules(){
  const en=siteLanguage==='en';
  const d=adminRulesEditData;if(!d||!adminRulesEditId)return;
  try{
    await window.MordheimundaAPI.adminUpdateOfficialWarband(adminRulesEditId,{name:d.name,warriors:d.warriors,equipment:d.equipment,skillTrees:d.skillTrees,skills:d.skills,magicDomains:d.magicDomains,spells:d.spells,traits:d.traits,specialRules:d.specialRules,bandRuleNames:d.bandRuleNames});
    adminOfficialCache=null;
    await loadOfficialWarbands();
    toast(en?'Live warband updated':'Bande en ligne mise à jour');
    closeAdminWarbandRules();
  }catch(e){toast(authError(e,en));}
}
/* ---- Warriors (fighters) section of the admin direct-edit panel ---- */
function adminEditWarrior(idx){adminEditingWarriorIdx=idx;render('admin')}
function adminNewWarrior(){adminEditingWarriorIdx=-1;render('admin')}
function adminCancelWarrior(){adminEditingWarriorIdx=null;render('admin')}
function confirmAdminDeleteWarrior(idx){
  const en=siteLanguage==='en';
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'REMOVE FIGHTER':'RETIRER LE COMBATTANT'}</div><h2>${en?'Remove this fighter from the warband?':'Retirer ce combattant de la bande ?'}</h2><p>${en?'This only affects the definition — saving is still required to apply it.':'Ceci ne modifie que la fiche en cours d’édition — il faudra encore Enregistrer pour l’appliquer.'}</p><button type="button" class="big-delete" onclick="adminDeleteWarrior(${idx});closeModal()">${en?'REMOVE':'RETIRER'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`);
}
function adminDeleteWarrior(idx){const d=adminRulesEditData;if(!d)return;d.warriors.splice(idx,1);adminEditingWarriorIdx=null;render('admin')}
function saveAdminWarrior(idx){
  const en=siteLanguage==='en';const d=adminRulesEditData;if(!d)return;
  const name=($('#awName')?.value||'').trim();
  if(!name){toast(en?'Give the fighter a name':'Donne un nom au combattant');return}
  const profile=P.map((_,i)=>Number($('#awStat'+i)?.value||0));
  const maxRaw=($('#awMax')?.value||'').trim();
  const w={
    name,type:$('#awType')?.value||'Henchman',
    cost:Number($('#awCost')?.value||0),
    race:($('#awRace')?.value||'Human').trim()||'Human',
    max:maxRaw===''?null:Number(maxRaw),
    profile,
    ruleNames:($('#awRules')?.value||'').split(',').map(s=>s.trim()).filter(Boolean),
    defaultSkills:($('#awSkills')?.value||'').split(',').map(s=>s.trim()).filter(Boolean),
    defaultEquipment:($('#awEquipment')?.value||'').split(',').map(s=>s.trim()).filter(Boolean),
    skillAccess:{...(d.warriors[idx]?.skillAccess||{})},
    magicAccess:{...(d.warriors[idx]?.magicAccess||{})},
    equipmentAccessGroups:Array.isArray(d.warriors[idx]?.equipmentAccessGroups)?d.warriors[idx].equipmentAccessGroups.slice():[],
    description:($('#awDescription')?.value||'')
  };
  w.rules=w.ruleNames.join(', ');
  if(idx===-1||idx==null||idx<0)d.warriors.push(w);else d.warriors[idx]=w;
  adminEditingWarriorIdx=null;
  render('admin');
}
function adminWarriorRow(w,i){
  return `<article class="custom-item-row"><div class="custom-item-main"><div class="custom-item-icon">☠</div><div><strong>${esc(w.name)}</strong><small>${esc(w.type||'Henchman')} · ${esc(w.race||'Human')} · ${Number(w.cost||0)} GC</small></div></div><div class="custom-item-actions"><button type="button" class="equipment-action" onclick="adminEditWarrior(${i})">✎</button><button type="button" class="equipment-action remove" onclick="confirmAdminDeleteWarrior(${i})">🗑</button></div></article>`;
}
function adminWarriorFormMarkup(w,idx){
  const en=siteLanguage==='en';
  const types=['Leader','Champion','Raw Recruit','Henchman'];
  const p=w?.profile||P.map(()=>1);
  return `<div class="custom-form-head"><div><div class="eyebrow">${idx===-1?(en?'NEW FIGHTER':'NOUVEAU COMBATTANT'):(en?'EDIT FIGHTER':'MODIFICATION')}</div><h3>${esc(w?.name||(en?'Build a fighter':'Construire un combattant'))}</h3></div></div>
  <div class="custom-form-grid">
    <label class="custom-field wide"><span>${en?'Name':'Nom'}</span><input id="awName" value="${esc(w?.name||'')}" placeholder="${en?'e.g. Warlord':'Ex. Maître de guerre'}"></label>
    <label class="custom-field"><span>${en?'Role':'Sous-catégorie'}</span><select id="awType">${types.map(t=>`<option value="${esc(t)}" ${t===(w?.type||'Henchman')?'selected':''}>${esc(t)}</option>`).join('')}</select></label>
    <label class="custom-field"><span>${en?'Cost (GC)':'Valeur de base (GC)'}</span><input id="awCost" type="number" min="0" step="1" value="${Number(w?.cost||0)}"></label>
    <label class="custom-field"><span>${en?'Race':'Race'}</span><input id="awRace" value="${esc(w?.race||'Human')}"></label>
    <label class="custom-field"><span>${en?'Max in warband':'Limite'}</span><input id="awMax" type="number" min="0" step="1" value="${w?.max===null||w?.max===undefined?'':Number(w.max)}" placeholder="${en?'Blank = no limit':'Vide = aucune limite'}"></label>
  </div>
  <details class="custom-collapse" open><summary><span>${en?'PROFILE':'CARACTÉRISTIQUES'}</span><small>12 ${en?'values':'valeurs'}</small></summary><div class="custom-profile-grid">${P.map((n,i)=>`<label><span>${esc(P_FULL[i])}</span><input id="awStat${i}" type="number" step="1" value="${esc(p[i]??'')}"></label>`).join('')}</div></details>
  <div class="custom-form-grid" style="margin-top:12px">
    <label class="custom-field wide"><span>${en?'Special rules (comma-separated names)':'Règles spéciales (noms séparés par des virgules)'}</span><input id="awRules" value="${esc((w?.ruleNames||[]).join(', '))}" placeholder="${en?'e.g. Frenzy, Hatred (Elves)':'Ex. Frénésie, Haine (Elfes)'}"></label>
    <label class="custom-field wide"><span>${en?'Default skills (comma-separated)':'Compétences par défaut (séparées par des virgules)'}</span><input id="awSkills" value="${esc((w?.defaultSkills||[]).join(', '))}"></label>
    <label class="custom-field wide"><span>${en?'Default equipment (comma-separated)':'Équipement par défaut (séparé par des virgules)'}</span><input id="awEquipment" value="${esc((w?.defaultEquipment||[]).join(', '))}"></label>
  </div>
  <details class="custom-collapse"><summary><span>${en?'DESCRIPTION':'DESCRIPTION'}</span></summary>${customTextToolbarMarkup('awDescription')}<textarea id="awDescription" class="wide-textarea" rows="4">${esc(w?.description||'')}</textarea></details>
  <p class="custom-field-help">${en?'Skill/magic access and detailed equipment-access lists carry over unchanged from the live warband and aren’t editable from this simplified panel — use “Advanced edit” for those.':'Les accès aux arbres de compétences/magie et les listes d’accès détaillées à l’équipement sont conservés tels quels depuis la bande en ligne et ne sont pas modifiables depuis ce panneau simplifié — utilise « Édition avancée » pour cela.'}</p>
  <div class="custom-actions"><button type="button" class="button secondary" onclick="adminCancelWarrior()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" onclick="saveAdminWarrior(${idx})">${en?'Apply':'Appliquer'}</button></div>`;
}
/* ---- Equipment section of the admin direct-edit panel ---- */
function adminEditEquipment(idx){adminEditingEquipmentIdx=idx;render('admin')}
function adminNewEquipment(){adminEditingEquipmentIdx=-1;render('admin')}
function adminCancelEquipment(){adminEditingEquipmentIdx=null;render('admin')}
function confirmAdminDeleteEquipment(idx){
  const en=siteLanguage==='en';
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'REMOVE EQUIPMENT':'RETIRER L’ÉQUIPEMENT'}</div><h2>${en?'Remove this item from the warband?':'Retirer cet objet de la bande ?'}</h2><p>${en?'This only affects the definition — saving is still required to apply it.':'Ceci ne modifie que la fiche en cours d’édition — il faudra encore Enregistrer pour l’appliquer.'}</p><button type="button" class="big-delete" onclick="adminDeleteEquipment(${idx});closeModal()">${en?'REMOVE':'RETIRER'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`);
}
function adminDeleteEquipment(idx){const d=adminRulesEditData;if(!d)return;d.equipment.splice(idx,1);adminEditingEquipmentIdx=null;render('admin')}
function toggleAdminWeaponFields(){
  const box=$('#awWeaponFields');if(!box)return;
  const weapon=$('#aeType')?.value==='weapon';
  box.innerHTML=weapon?`<div class="custom-weapon-grid"><label class="custom-field"><span>${siteLanguage==='en'?'Range':'Portée'}</span><input id="aeRange" value=""></label><label class="custom-field"><span>${siteLanguage==='en'?'Strength':'Force'}</span><input id="aeStrength" value=""></label><label class="custom-field"><span>AP</span><input id="aeAp" value=""></label><label class="custom-field"><span>${siteLanguage==='en'?'Damage':'Dégâts'}</span><input id="aeDamage" value=""></label><label class="custom-field wide"><span>${siteLanguage==='en'?'Traits (comma-separated)':'Traits (séparés par des virgules)'}</span><input id="aeTraits" value=""></label></div>`:'';
}
function saveAdminEquipment(idx){
  const en=siteLanguage==='en';const d=adminRulesEditData;if(!d)return;
  const name=($('#aeName')?.value||'').trim();
  if(!name){toast(en?'Give the item a name':'Donne un nom à l’objet');return}
  const isWeapon=$('#aeType')?.value==='weapon';
  const e={
    name,
    category:$('#aeCategory')?.value||'Équipements divers',
    rarity:($('#aeRarity')?.value||'').trim(),
    price:Number($('#aePrice')?.value||0),
    rulesText:($('#aeRulesText')?.value||''),
    profile:isWeapon?{range:($('#aeRange')?.value||''),strength:($('#aeStrength')?.value||''),ap:($('#aeAp')?.value||''),damage:($('#aeDamage')?.value||''),traits:($('#aeTraits')?.value||'')}:null,
    traits:isWeapon?($('#aeTraits')?.value||'').split(',').map(s=>s.trim()).filter(Boolean):[]
  };
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
  const cats=['Armes de corps à corps','Armes de tir','Armure','Boucliers / défense','Drogues','Wargear','Animaux','Équipements divers'];
  const p=e?.profile||{};
  return `<div class="custom-form-head"><div><div class="eyebrow">${idx===-1?(en?'NEW ITEM':'NOUVEL ÉQUIPEMENT'):(en?'EDIT ITEM':'MODIFICATION')}</div><h3>${esc(e?.name||(en?'Build an item':'Construire un équipement'))}</h3></div></div>
  <div class="custom-form-grid">
    <label class="custom-field wide"><span>${en?'Name':'Nom'}</span><input id="aeName" value="${esc(e?.name||'')}"></label>
    <label class="custom-field"><span>${en?'Type':'Type'}</span><select id="aeType" onchange="toggleAdminWeaponFields()"><option value="equipment" ${!weapon?'selected':''}>${en?'Equipment':'Équipement'}</option><option value="weapon" ${weapon?'selected':''}>${en?'Weapon':'Arme'}</option></select></label>
    <label class="custom-field"><span>${en?'Category':'Sous-catégorie'}</span><select id="aeCategory">${cats.map(c=>`<option value="${esc(c)}" ${c===(e?.category||'Équipements divers')?'selected':''}>${c}</option>`).join('')}</select></label>
    <label class="custom-field"><span>${en?'Rarity':'Rareté'}</span><input id="aeRarity" value="${esc(e?.rarity||'')}"></label>
    <label class="custom-field"><span>${en?'Price (GC)':'Prix (GC)'}</span><input id="aePrice" type="number" min="0" step="1" value="${Number(e?.price??e?.value??0)}"></label>
    <label class="custom-field wide"><span>${en?'Rules text':'Règles de l’équipement'}</span>${customTextToolbarMarkup('aeRulesText')}<textarea id="aeRulesText" class="wide-textarea" rows="3">${esc(e?.rulesText||'')}</textarea></label>
  </div>
  <div id="awWeaponFields">${weapon?`<div class="custom-weapon-grid"><label class="custom-field"><span>${en?'Range':'Portée'}</span><input id="aeRange" value="${esc(p.range||'')}"></label><label class="custom-field"><span>${en?'Strength':'Force'}</span><input id="aeStrength" value="${esc(p.strength||'')}"></label><label class="custom-field"><span>AP</span><input id="aeAp" value="${esc(p.ap||'')}"></label><label class="custom-field"><span>${en?'Damage':'Dégâts'}</span><input id="aeDamage" value="${esc(p.damage||'')}"></label><label class="custom-field wide"><span>${en?'Traits (comma-separated)':'Traits (séparés par des virgules)'}</span><input id="aeTraits" value="${esc((e?.traits||[]).join(', '))}"></label></div>`:''}</div>
  <div class="custom-actions"><button type="button" class="button secondary" onclick="adminCancelEquipment()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary" onclick="saveAdminEquipment(${idx})">${en?'Apply':'Appliquer'}</button></div>`;
}
function adminWarbandRulesPanel(){
  const en=siteLanguage==='en',d=adminRulesEditData;
  const bandSet=new Set(d.bandRuleNames.map(normName));
  const rowsFor=(kind,list)=>list.length?list.map((r,i)=>`<label class="custom-check"><input type="checkbox" ${bandSet.has(normName(r.name))?'checked':''} onchange="toggleAdminBandRule('${kind}',${i})"><span><b>${esc(r.name)}</b><small>${esc((r.text||'').slice(0,140))}</small></span></label>`).join(''):`<div class="empty compact">${en?'None yet.':'Aucune pour l’instant.'}</div>`;
  const sections=[['rules',en?'RULES':'RÈGLES'],['warriors',en?'FIGHTERS':'COMBATTANTS'],['equipment',en?'EQUIPMENT':'ÉQUIPEMENT']];
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
      body=`<section class="card admin-card"><div class="custom-item-list">${d.warriors.length?d.warriors.map((w,i)=>adminWarriorRow(w,i)).join(''):`<div class="empty">${en?'No fighters yet.':'Aucun combattant pour l’instant.'}</div>`}</div><div class="custom-actions" style="margin-top:12px"><button type="button" class="button secondary" onclick="adminNewWarrior()">＋ ${en?'Add fighter':'Ajouter un combattant'}</button></div></section>`;
    }
  }else if(adminWarbandSection==='equipment'){
    if(adminEditingEquipmentIdx!=null){
      body=`<section class="card admin-card">${adminEquipmentFormMarkup(adminEditingEquipmentIdx===-1?null:d.equipment[adminEditingEquipmentIdx],adminEditingEquipmentIdx)}</section>`;
    }else{
      body=`<section class="card admin-card"><div class="custom-item-list">${d.equipment.length?d.equipment.map((e,i)=>adminEquipmentRow(e,i)).join(''):`<div class="empty">${en?'No equipment yet.':'Aucun équipement pour l’instant.'}</div>`}</div><div class="custom-actions" style="margin-top:12px"><button type="button" class="button secondary" onclick="adminNewEquipment()">＋ ${en?'Add item':'Ajouter un équipement'}</button></div></section>`;
    }
  }
  return `<div class="admin-page">
    <div class="page-intro"><div><div class="eyebrow">ADMIN / ${en?'EDIT WARBAND':'MODIFIER LA BANDE'}</div><h2>${esc(d.name)}</h2><p>${en?'Edits the published warband directly — no draft or copy is ever created, and nothing shows up in your Custom tab. Saving pushes the whole definition back to the live warband at once.':'Modifie directement la bande publiée — aucun brouillon ni copie n’est jamais créé, et rien n’apparaît dans ton onglet Custom. Enregistrer renvoie la fiche complète vers la bande en ligne en une fois.'}</p></div><button type="button" class="button secondary" onclick="closeAdminWarbandRules()">← ${en?'Back to Admin':'Retour à Admin'}</button></div>
    ${tabs}
    ${body}
    <div class="custom-actions" style="margin-top:16px"><button type="button" class="button primary" onclick="saveAdminWarbandRules()">${en?'Save — update the live warband':'Enregistrer — mettre à jour la bande en ligne'}</button></div>
  </div>`;
}
async function officializeCustomWarband(id){
  const en=siteLanguage==='en',cw=customWarbandById(id);
  if(!cw)return;
  const fx=customWarbandFaction(cw);
  if(!(fx.warriors||[]).length){toast(en?'Add at least one fighter to this warband first':'Ajoute d’abord au moins un combattant à cette warband');return}
  const bundle=bundleCustomContentForOfficialize(cw,fx);
  try{
    const result=await window.MordheimundaAPI.adminOfficializeWarband({name:cw.name,warriors:fx.warriors,...bundle});
    // Tag the source custom warband as now-official so it stops being offered
    // as a separate/duplicate choice on the Create Warband screen — it still
    // has the same fighters/rules, but the published official faction is now
    // the "real" entry point for them. It stays visible in the Custom tab
    // library (marked OFFICIAL DRAFT) so it can still be edited/republished.
    if(result?.warband?.id)cw.officialId=result.warband.id;
    save(true);
    adminOfficialCache=null;
    await loadOfficialWarbands();
    const extra=bundle.skills.length+bundle.spells.length+bundle.traits.length+bundle.specialRules.length;
    toast((en?'Warband made official':'Warband officialisée')+(extra?` (+${extra} ${en?'linked custom rules':'règles custom liées'})`:''));
    render('admin');
  }catch(e){toast(authError(e,en));}
}
/* ================= EDIT AN OFFICIAL WARBAND (same tool as custom) =========
   Rather than a second, parallel editor just for official content, editing
   an official warband imports its resolved warriors/equipment/rules as a
   normal custom warband + custom fighters/equipment/rules — the exact same
   records an admin would create by hand from the Custom tab. From that
   point on it IS a custom warband: same page, same per-field stat editor,
   same everything. The only difference is a `officialId` tag on the draft
   and one extra button ("Publier les modifications") that pushes the
   bundled result back to the official record instead of just saving it
   locally. Deleting this draft from the Custom tab only ever removes the
   local working copy — never the published warband, which needs its own
   explicit unpublish/delete flow below. */
function ensureCustomContent(kind,entry){
  if(!entry?.name)return null;
  const list=customContentList(kind);
  const found=list.find(x=>normName(x.name)===normName(entry.name));
  if(found)return found;
  const item={customContentId:crypto.randomUUID(),name:entry.name,text:entry.text||''};
  list.push(item);
  return item;
}
// Skill trees / magic domains a warband exclusively brings in aren't part of
// the shared customContentList() family (they're their own {id,name,
// description} records — see createCustomSkillTree/createCustomMagicDomain)
// so they get their own ensure-by-name helper, mirroring the same
// dedupe-by-name logic.
function ensureCustomTreeOrDomain(kind,entry){
  if(!entry?.name)return null;
  const list=kind==='skills'?customSkillTreeList():customMagicDomainList();
  const found=list.find(x=>normName(x.name)===normName(entry.name));
  if(found)return found;
  const item={id:crypto.randomUUID(),name:entry.name,description:entry.description||''};
  list.push(item);
  return item;
}
function warriorToCustomFighterDraft(w,customWarbandId){
  return {
    customFighterId:crypto.randomUUID(),
    name:w.name,type:w.type||'Henchman',factionId:'',customWarbandId,
    cost:Number(w.cost||0),
    max:(w.max===null||w.max===undefined)?null:Number(w.max),
    maxMode:(w.max===null||w.max===undefined)?'auto':'manual',
    manualMaxProfile:Array.isArray(w.profile)?w.profile.slice():null,
    profile:Array.isArray(w.profile)?w.profile.slice():P.map(()=>1),
    race:w.race||'Human',
    ruleNames:Array.isArray(w.ruleNames)?w.ruleNames.slice():[],
    rules:w.rules||(Array.isArray(w.ruleNames)?w.ruleNames.join(', '):''),
    skillAccess:{...(w.skillAccess||{})},
    magicAccess:{...(w.magicAccess||{})},
    defaultSkills:Array.isArray(w.defaultSkills)?w.defaultSkills.slice():[],
    defaultEquipment:Array.isArray(w.defaultEquipment)?w.defaultEquipment.slice():[],
    equipmentAccess:Array.isArray(w.equipmentAccessGroups)?w.equipmentAccessGroups.slice():(Array.isArray(w.equipmentAccess)?w.equipmentAccess.slice():[]),
    description:w.description||''
  };
}
function equipmentToCustomDraft(e){
  const isWeapon=!!e.profile;
  return {
    customEquipmentId:crypto.randomUUID(),
    name:e.name,
    type:isWeapon?'weapon':'equipment',
    category:e.category||e.subcategory||'Équipements divers',
    subcategory:e.subcategory||e.category||'Équipements divers',
    rarity:e.rarity||'',
    price:Number(e.price??e.value??0),
    unrestricted:true,
    factions:[],
    traits:Array.isArray(e.traits)?e.traits.slice():[],
    rulesText:e.rulesText||'',
    profile:isWeapon?{range:e.profile.range||'',strength:e.profile.strength||'',ap:e.profile.ap||'',damage:e.profile.damage||'',traits:e.profile.traits||''}:null,
    weaponSlotCost:e.weaponSlotCost,
    customArmor:!!e.customArmor
  };
}
async function importOfficialWarbandForEditing(officialId){
  const en=siteLanguage==='en';
  // Only reuse an existing local draft if it actually has fighters in it —
  // a draft left empty by an interrupted/failed import in the past must
  // never be reopened forever; re-import from the server instead.
  const existing=customWarbandList().find(x=>x.officialId===officialId);
  if(existing&&(existing.fighterIds||[]).length){customWarbandEditId=existing.id;customWarbandCreating=false;customWarbandSection='fighters';render('custom');return;}
  if(existing){
    // Drop the stale empty draft so re-importing doesn't leave two entries
    // tagged with the same officialId floating in the Custom tab.
    state.customWarbands=state.customWarbands.filter(x=>x.id!==existing.id);
  }
  try{
    const full=await window.MordheimundaAPI.adminGetWarband(officialId);
    const cwId=crypto.randomUUID();
    const fighterIds=(full.warriors||[]).map(w=>{const draft=warriorToCustomFighterDraft(w,cwId);state.customFighters.push(draft);return draft.customFighterId;});
    const equipmentIds=(full.equipment||[]).map(e=>{const draft=equipmentToCustomDraft(e);state.customEquipment.push(draft);return draft.customEquipmentId;});
    // Every special rule/trait the warband ever references gets a content
    // entry created (needed regardless, for lookups/refLink), but only the
    // ones recorded as band-wide (full.bandRuleNames) get pre-checked as the
    // warband's own picks — otherwise every fighter's individual rule would
    // wrongly show up as "applies to the whole warband" once re-imported.
    const bandNameSet=new Set((full.bandRuleNames||[]).map(normName));
    const specialEntries=(full.specialRules||[]).map(r=>ensureCustomContent('special',r)).filter(Boolean);
    const traitEntries=(full.traits||[]).map(r=>ensureCustomContent('traits',r)).filter(Boolean);
    const specialRuleIds=specialEntries.filter(e=>bandNameSet.has(normName(e.name))).map(e=>e.customContentId);
    const traitIds=traitEntries.filter(e=>bandNameSet.has(normName(e.name))).map(e=>e.customContentId);
    // Skill trees/magic domains exclusive to this warband, plus their
    // skills/spells — same dedupe-by-name treatment, so re-importing (or
    // importing a second warband sharing a tree) never creates duplicates.
    (full.skillTrees||[]).forEach(t=>ensureCustomTreeOrDomain('skills',t));
    (full.skills||[]).forEach(s=>{if(s?.tree)ensureCustomContent('skills',s).tree=s.tree;});
    (full.magicDomains||[]).forEach(d=>ensureCustomTreeOrDomain('spells',d));
    (full.spells||[]).forEach(s=>{if(s?.domain)ensureCustomContent('spells',s).domain=s.domain;});
    const cw={id:cwId,name:full.name,description:'',officialId,fighterIds,equipmentIds,fighterRefs:fighterIds.map(id=>`custom:${id}`),equipmentRefs:equipmentIds.map(id=>`custom:${id}`),specialRuleIds,traitIds};
    state.customWarbands.push(cw);
    save(true);
    customWarbandEditId=cwId;customWarbandCreating=false;customWarbandSection='fighters';
    render('custom');
    toast(en?'Official warband imported — edit it like any custom warband':'Bande officielle importée — modifie-la comme une warband custom');
  }catch(e){toast(authError(e,en));}
}
async function publishOfficialWarbandChanges(cwId){
  const en=siteLanguage==='en',cw=customWarbandById(cwId);
  if(!cw?.officialId)return;
  const fx=customWarbandFaction(cw);
  if(!(fx.warriors||[]).length){toast(en?'Add at least one fighter first':'Ajoute d’abord au moins un combattant');return}
  const bundle=bundleCustomContentForOfficialize(cw,fx);
  try{
    await window.MordheimundaAPI.adminUpdateOfficialWarband(cw.officialId,{name:cw.name,warriors:fx.warriors,...bundle});
    adminOfficialCache=null;
    await loadOfficialWarbands();
    toast(en?'Official warband updated':'Bande officielle mise à jour');
    render('custom');
  }catch(e){toast(authError(e,en));}
}
/* ================= OFFICIAL WARBAND LIFECYCLE (admin) =====================
   Unpublish/republish is a reversible toggle (never touches the stored
   definition — see PATCH .../status server-side). Permanent deletion is
   only reachable once a warband is a draft, and even then requires typing
   its exact name, so a live warband can never disappear from every
   account's roster list in a single misclick. */
async function setOfficialWarbandStatus(id,status){
  const en=siteLanguage==='en';
  try{
    await window.MordheimundaAPI.adminSetOfficialWarbandStatus(id,status);
    adminOfficialCache=null;
    await loadOfficialWarbands();
    let reactivated=0;
    if(status==='draft'){
      // Unpublishing hides the official record from every account, but until
      // now the source custom warband (and any Official Edition draft) stayed
      // tagged with officialId forever — permanently archived out of the
      // active Custom list with no way back and no way to officialize it
      // again. Clearing the tag on unpublish returns it to an ordinary,
      // editable custom warband in the active list, exactly like before it
      // was ever made official.
      state.customWarbands.filter(cw=>cw.officialId===id).forEach(cw=>{cw.officialId=null;reactivated++});
      if(reactivated)save(true);
    }
    toast(status==='draft'?(en?`Unpublished — hidden from every account until republished${reactivated?' (back in your active Custom list)':''}`:`Dépubliée — masquée pour tous les comptes jusqu’à republication${reactivated?' (revenue dans ta liste Custom active)':''}`):(en?'Republished':'Republiée'));
    render('admin');
  }catch(e){toast(authError(e,en));}
}
function confirmDeleteOfficialWarband(id){
  const en=siteLanguage==='en';
  const name=(adminOfficialCache||[]).find(x=>x.id===id)?.name||'';
  openModal(`<div class="delete-dialog"><div class="eyebrow">${en?'PERMANENT DELETION':'SUPPRESSION DÉFINITIVE'}</div><h2>${en?'Delete':'Supprimer'} « ${esc(name)} » ?</h2><p>${en?'This removes it for every account and cannot be undone. Type its name to confirm.':'Ceci la supprime pour tous les comptes, sans retour possible. Tape son nom pour confirmer.'}</p><input id="officialDeleteConfirm" class="search" placeholder="${esc(name)}" oninput="document.getElementById('officialDeleteBtn').disabled=(this.value.trim()!==this.placeholder)"><button type="button" id="officialDeleteBtn" class="big-delete" disabled onclick="finalizeDeleteOfficialWarband('${esc(id)}')">${en?'DELETE PERMANENTLY':'SUPPRIMER DÉFINITIVEMENT'}</button><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button></div>`);
  setTimeout(()=>$('#officialDeleteConfirm')?.focus(),20);
}
async function finalizeDeleteOfficialWarband(id){
  const en=siteLanguage==='en';
  try{
    await window.MordheimundaAPI.adminDeleteOfficialWarband(id);
    adminOfficialCache=null;await loadOfficialWarbands();
    closeModal();toast(en?'Official warband deleted':'Bande officielle supprimée');render('admin');
  }catch(e){
    if(e.status===409){closeModal();toast(en?'Unpublish this warband first':'Dépublie d’abord cette bande');}
    else toast(authError(e,en));
  }
}

function renderOriginal(view='dashboard'){
 if(view==='admin'&&!isAdminSession()){view='dashboard'}
 const activeNavView=(view==='builder'||view==='fighter')?'rosters':view;
 document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===activeNavView));
 document.title=`${PROJECT_NAME} // M17`;
 ({dashboard,rosters,create,rules,builder,fighter,armory,codex,references,custom,account,admin}[view]||dashboard)(); if(view==='builder') setTimeout(attachFighterInteractions,0);
}
/* ================= SITE LANGUAGE / I18N ================= */
const SITE_LANGUAGE_KEY='mordheimunda_site_language';
let siteLanguage=localStorage.getItem(SITE_LANGUAGE_KEY)||'en';
const I18N_EN={
'Accueil':'Home','Mes bandes':'My Warbands','Créer une bande':'Create Warband','Règles':'Rules','Référentiel':'Reference','Custom':'Custom','Sauvegarder':'Save','Exporter':'Export','Réinitialiser les données':'Reset Data','Nouvelle bande':'New Warband','Créer une nouvelle bande':'Create a New Warband','Voir mes bandes →':'View My Warbands →','Aucune bande.':'No warbands.','Choisis une bande':'Choose a warband','Modifier':'Edit','Supprimer':'Delete','Enregistrer':'Save','Enregistrer les modifications':'Save Changes','Annuler':'Cancel','Ajouter':'Add','Ajouter de l’équipement':'Add Equipment','Équipement équipé':'Equipped Equipment','Armes & équipement':'Weapons & Equipment','Armes de corps à corps':'Close Combat Weapons','Armes de tir':'Ranged Weapons','Équipements divers':'Miscellaneous Equipment','Équipement':'Equipment','Équipements':'Equipment','Compétences':'Skills','Compétence':'Skill','Traits d’armes':'Weapon Traits','Règles spéciales':'Special Rules','Sorts & prières':'Spells & Prayers','Sort':'Spell','Domaine de magie':'Magic Domain','Arbre de compétences':'Skill Tree','Arbres de compétences':'Skill Trees','Profils de combattants':'Fighter Profiles','Warbands personnalisées':'Custom Warbands','Équipements personnalisés':'Custom Equipment','Compétences personnalisées':'Custom Skills','Sorts personnalisés':'Custom Spells','Règle spéciale':'Special Rule','Réputation':'Reputation','Trésor':'Treasury','Volonté':'Willpower','Capacité de combat':'Weapon Skill','Capacité de tir':'Ballistic Skill','Mouvement':'Movement','Force':'Strength','Endurance':'Toughness','Blessures':'Wounds','Initiative':'Initiative','Attaques':'Attacks','Commandement':'Leadership','Calme':'Cool','Valeur':'Rating','Réserve':'Stash','RÉSERVE':'STASH','Après la bataille':'After Battle','Post-bataille':'Post-Battle','Réduire':'Collapse','Ouvrir':'Open','Rechercher':'Search','Aucune entrée.':'No entries.','Aucune compétence disponible':'No skills available','Aucun équipement disponible':'No equipment available','Aucun combattant disponible':'No fighters available','Aucun équipement équipé.':'No equipment equipped.','Aucun wargear équipé.':'No wargear equipped.','Aucune règle spéciale enregistrée.':'No special rules recorded.','Aucune compétence acquise.':'No skills acquired.','Aucun advancement acheté.':'No advancements purchased.','Aucun statut':'No status','Aucun texte de règle enregistré.':'No rule text recorded.','Aucune séquelle enregistrée.':'No lasting injuries recorded.','Aucune bande active':'No active warband','Aucune faction assignée':'No faction assigned','Créer l’équipement':'Create Equipment','Nouvel équipement':'New Equipment','NOUVEL ÉQUIPEMENT':'NEW EQUIPMENT','NOUVEAU PROFIL':'NEW PROFILE','NOUVELLE ENTRÉE':'NEW ENTRY','APERÇU':'PREVIEW','APERÇU EN DIRECT':'LIVE PREVIEW','ACCÈS À L’ÉQUIPEMENT':'EQUIPMENT ACCESS','ACHAT D’ÉQUIPEMENT':'EQUIPMENT PURCHASE','AJOUT À LA FICHE':'ADD TO CARD','DOMAINES DE MAGIE':'MAGIC DOMAINS','ARBRES DE COMPÉTENCES':'SKILL TREES','ARCHIVES':'ARCHIVES','ACTION PHASE':'ACTION PHASE','ACTIONS':'ACTIONS','ADVANCEMENT':'ADVANCEMENT','ARMORY':'ARMORY','ACCESS':'ACCESS','Référence':'Reference','Voir la règle complète →':'View full rule →','Ouvrir dans le référentiel →':'Open in Reference →','Rechercher une règle spéciale…':'Search for a special rule…','Rechercher une arme, armure ou équipement…':'Search for a weapon, armour or equipment…','Rechercher un combattant…':'Search for a fighter…','Rechercher un équipement…':'Search for equipment…','Rechercher un trait…':'Search for a trait…','Rechercher une règle, une action, un sort…':'Search for a rule, action or spell…','Donne un nom':'Enter a name','Nom du profil…':'Profile name…','Nom de la Warband':'Warband name','Nom du nouvel arbre…':'New tree name…','Nom du nouveau domaine…':'New domain name…','Description de la bande…':'Warband description…','Description du combattant…':'Fighter description…','Résumé des règles spéciales…':'Special rules summary…','Notes…':'Notes…','Texte complet de la règle…':'Full rule text…','Ajoute le texte de la règle':'Add the rule text','Le nom ne peut pas être vide':'Name cannot be empty','Données sauvegardées':'Data saved','Warband sauvegardée':'Warband saved','Configuration sauvegardée':'Configuration saved','Entrée créée':'Entry created','Entrée modifiée':'Entry updated','Entrée supprimée':'Entry deleted','Compétence créée':'Skill created','Compétence modifiée':'Skill updated','Compétence supprimée':'Skill deleted','Sort créé':'Spell created','Sort modifié':'Spell updated','Sort supprimé':'Spell deleted','Domaine de magie créé':'Magic domain created','Domaine supprimé':'Domain deleted','Arbre de compétences créé':'Skill tree created','Arbre supprimé':'Tree deleted','Profil custom créé':'Custom profile created','Profil custom modifié':'Custom profile updated','Profil custom supprimé':'Custom profile deleted','Équipement custom créé':'Custom equipment created','Équipement custom modifié':'Custom equipment updated','Équipement custom supprimé':'Custom equipment deleted','Séquence post-bataille réinitialisée':'Post-battle sequence reset','✓ Résolution appliquée':'✓ Resolution applied','✓ Vente appliquée':'✓ Sale applied','Combattant récupéré':'Fighter recovered','Combattant capturé':'Fighter captured','Combattant libéré':'Fighter released','Combattant tué':'Fighter killed','Combattant ressuscité':'Fighter resurrected','Envoyé en récupération':'Sent to Recovery','Mis en état critique':'Placed in Critical condition','État critique retiré':'Critical condition removed','Réinitialiser':'Reset','Supprimer ce bonus':'Remove this bonus','Supprimer du coffre':'Remove from stash','Mettre en réserve':'Move to stash','Transférer à un combattant':'Transfer to fighter','Transférer':'Transfer','Acheter':'Buy','Acquis':'Acquired','Autorisé':'Allowed','Non autorisé':'Not allowed','Quantité':'Quantity','Maximum de caractéristique atteint':'Characteristic maximum reached','XP insuffisant':'Insufficient XP','Advancement remboursé':'Advancement refunded','Ajouter 1 XP':'Add 1 XP','Construire un combattant':'Build a Fighter','Construire un équipement':'Build Equipment','Créer un nouveau loadout':'Create New Loadout','Supprimer ce loadout':'Delete this loadout','Coffre principal · tout l’équipement possédé':'Main stash · all owned equipment','Coffre + configurations d’équipement':'Stash + equipment loadouts','Warband personnalisée':'Custom Warband','Warband custom supprimée':'Custom warband deleted','Image du combattant supprimée':'Fighter image removed','Image du combattant mise à jour':'Fighter image updated','Icône de bande supprimée':'Warband icon removed','Icône de bande mise à jour':'Warband icon updated','Importer une image':'Import image','Importer / remplacer l’image du combattant':'Import / replace fighter image','Importer / remplacer l’icône de la bande':'Import / replace warband icon','Choisis un fichier image':'Choose an image file','Impossible de lire ce fichier':'Unable to read this file','Impossible de lire cette image':'Unable to read this image','Effacer toutes les bandes locales ?':'Delete all local warbands?','Supprimer définitivement cette bande ?':'Permanently delete this warband?','Supprimer cette valeur personnalisée ?':'Delete this custom value?','Résultat de la table p.133':'Result from table p.133','Vente de wyrdstone':'Wyrdstone Sale','Shards vendus':'Shards sold','Guerriers dans la bande':'Warriors in warband','Profit calculé':'Calculated profit','Dés d’Exploration':'Exploration Dice','Exploration':'Exploration','Dés générés':'Dice generated','Dés renseignés':'Dice entered','Dés retenus':'Dice kept','Total':'Total','Shards trouvés':'Shards found','Dés supplémentaires':'Additional dice','Récompense d’exploration':'Exploration reward','Aucune règle trouvée.':'No rule found.','Bienvenue, Capitaine':'Welcome, Captain','Combattants':'Fighters','Bandes actives':'Active warbands','Trésor cumulé':'Combined treasury','Réputation totale':'Total reputation','Voir tout →':'View all →','Rechercher une bande…':'Search a warband…','Aucun résultat pour':'No results for','Essaie un autre terme.':'Try another search term.','Tout le livre':'Full book','Factions':'Factions','Fiche enregistrée automatiquement':'Card saved automatically','Profil de base':'Base profile','modifications enregistrées automatiquement':'changes saved automatically','Wargear':'Wargear','Règles spéciales':'Special Rules','Notes de campagne':'Campaign Notes','Aucune limite':'No limit','Vide = aucune limite':'Empty = no limit','Utiliser le prix d’achat comme valeur affichée':'Use purchase price as displayed value','Prix d’achat payé (GC)':'Purchase price paid (GC)','Valeur affichée (GC)':'Displayed value (GC)','bandes locales':'local warbands','factions disponibles':'available factions','packs chargés':'loaded packs','pages de référence':'reference pages','GC de départ':'starting GC','Fiche du combattant':'Fighter Card','Aucun lieu inhabituel détecté.':'No unusual location detected.','Aucun Hero éligible dans la bande.':'No eligible Hero in the warband.','Heroes ayant survécu':'Surviving Heroes','Victoire de la dernière bataille':'Victory in the last battle','Coche précisément les Heroes qui ont survécu à la bataille. Les Henchmen ne lancent pas de dé.':'Check each Hero who survived the battle. Henchmen do not roll a die.','Le montant sera retiré de la réserve Wyrdstone et ajouté au Trésor.':'The amount will be removed from the Wyrdstone stash and added to the Treasury.','Mettre ces wyrdstone en réserve':'Move these wyrdstone to stash','Vendre les shards sélectionnés':'Sell selected shards','Cette résolution reste disponible : tu peux relancer les récompenses ou choisir une nouvelle option sans annuler la précédente.':'This resolution remains available: you can resolve rewards again or choose another option without cancelling the previous one.','Le tableau utilise le nombre de guerriers et le nombre de shards vendus.':'The table uses the number of warriors and the number of shards sold.','Calculé automatiquement depuis le roster.':'Calculated automatically from the roster.','La vente utilise le Wyrdstone actuellement en réserve.':'The sale uses the Wyrdstone currently in the stash.','Le revenu a déjà été appliqué pour ce résultat':'Income has already been applied for this result','Aucun résultat de wyrdstone à mettre en réserve':'No Wyrdstone result to add to the stash','Indique au moins 1 shard à vendre':'Enter at least 1 shard to sell','Maximum de 6 dés retenus':'Maximum of 6 dice kept','Renseigne au moins un dé':'Enter at least one die','Tous les dés ont été lancés':'All dice have been rolled','Lancer tous les dés non renseignés':'Roll all unentered dice','Relancer':'Reroll','Lancer':'Roll','Résoudre automatiquement les récompenses de':'Automatically resolve rewards for','Résolution appliquée':'Resolution applied','Effets d’Exploration débloqués':'UNLOCKED EXPLORATION EFFECTS','Aucun texte de règle enregistré.':'No rule text recorded.'};
// Additional dictionary entries — a broad sweep to bring French-only screens
// (Custom tab builders, roster reserve/post-battle/history, admin equipment
// forms, codex, etc.) up to the same English coverage the Règles/Référentiel
// pages already had, using the same generic text-node translation the site
// already runs (applySiteLanguage) rather than rewriting every render
// function with en?/: branches.
Object.assign(I18N_EN,{
'BIBLIOTHÈQUE':'LIBRARY','← Bibliothèque':'← Library',
'SUPPRIMER L’ÉQUIPEMENT':'REMOVE EQUIPMENT','SUPPRESSION D’ÉQUIPEMENT':'REMOVE EQUIPMENT','SUPPRESSION D’ÉQUIPEMENT CUSTOM':'DELETE CUSTOM EQUIPMENT',
'Portée':'Range','Dégâts':'Damage','Rareté':'Rarity','Catégorie':'Category','Sous-catégorie':'Subcategory','Disponibilité':'Availability','Caractéristiques':'Characteristics','CARACTÉRISTIQUES':'CHARACTERISTICS',
'ARCHIVÉ':'ARCHIVED','ARCHIVÉES':'ARCHIVED','ARCHIVÉES · OFFICIALISÉES':'ARCHIVED · OFFICIALIZED','OFFICIALISÉ':'OFFICIALIZED','OFFICIALISÉS':'OFFICIALIZED','ÉDITION OFFICIELLE':'OFFICIAL EDITION','CORRIGÉ':'CORRECTED','Personnalisé':'Custom',
'Crée la première avec le bouton ci-dessus.':'Create the first one with the button above.',
'Or récupéré (GC)':'Gold recovered (GC)',
'RÈGLES SPÉCIALES':'SPECIAL RULES','Non autorisé / Primary / Secondary':'Not allowed / Primary / Secondary','Aucune entrée custom.':'No custom entry.',
'Le coffre est vide. Ajoute d’abord de l’équipement.':'The stash is empty. Add equipment first.',
'6 résultats · 1D6':'6 results · 1D6','1000 GC de départ':'1000 starting GC',
'Laissé vide → nommée automatiquement « Bande [faction] ».':'Left empty → automatically named "Warband [faction]".',
'Créer la bande →':'Create warband →','Suppléments':'Supplements',
"Seuls les suppléments liés à la faction choisie à l'étape 01 apparaissent ici.":'Only supplements linked to the faction chosen in step 01 appear here.',
'Un seul supplément optionnel peut être actif à la fois, ou aucun':'Only one optional supplement can be active at a time, or none',
'Toujours actif — commun à toutes les factions':'Always active — common to all factions',
'TRÉSOR':'TREASURY','RÉPUTATION':'REPUTATION',
'Shards en réserve · cliquer pour modifier':'Shards in stash · click to edit',
'Créer une nouvelle valeur personnalisée':'Create a new custom value',
'☰ Règles de bande':'☰ Warband Rules','▣ Réserve':'▣ Stash',
'Caractéristiques mentales':'Mental characteristics','Expérience':'Experience','Expérience (XP)':'Experience (XP)','VALEUR PERSONNALISÉE':'CUSTOM VALUE',
'1. Dés d’Exploration':'1. Exploration Dice','Chaque dé peut être lancé ou saisi manuellement.':'Each die can be rolled or entered manually.',
'Coche au moins un Hero survivant pour générer les dés.':'Check at least one surviving Hero to generate dice.',
'+1 dé':'+1 die','Compétences, équipement ou autre bonus autorisé':'Skills, equipment or other allowed bonus','Règles / résolution':'Rules / resolution',
'Renseigne au moins deux dés identiques pour afficher l’entrée correspondante.':'Enter at least two matching dice to show the corresponding entry.',
'＋ Mettre ces wyrdstone en réserve':'＋ Move this wyrdstone to stash',
'EFFETS D’EXPLORATION DÉBLOQUÉS':'UNLOCKED EXPLORATION EFFECTS',
'Ces effets restent liés à la bande jusqu’à leur suppression.':'These effects remain linked to the warband until removed.',
'Le module Trading Post sera implémenté dans une prochaine étape.':'The Trading Post module will be implemented in a future update.',
'P.133–139 · dés, wyrdstone et exploration':'P.133–139 · dice, wyrdstone and exploration',
'RESERVE / ÉQUIPEMENT STOCKÉ':'STASH / STORED EQUIPMENT','Réserve de la bande':'Warband stash','Réserve vide.':'Empty stash.',
'⇄ Transférer':'⇄ Transfer','↕ Aller à…':'↕ Go to…',
'Suivi de la bande au sein d’une campagne (classement, territoires, rivalités).':'Track the warband within a campaign (standings, territories, rivalries).',
'Aucune campagne liée à cette bande pour l’instant.':'No campaign linked to this warband yet.',
'transféré vers la':'transferred to the','transféré de la':'transferred from the',
"Réserve d'équipement":'Equipment stash','RÉSERVE · TRANSFERT':'STASH · TRANSFER',
'Aucun combattant ne peut actuellement équiper cet objet.':'No fighter can currently equip this item.',
'VENTE DE RÉSERVE':'STASH SALE','vendu depuis la réserve —':'sold from the stash —',
'L’objet sera retiré de la réserve sans remboursement.':'The item will be removed from the stash with no refund.',
'Modifier les caractéristiques':'Edit characteristics','Aucune compétence Primary disponible.':'No Primary skill available.',
'À 6 XP, utilise le tableau p.129. Le jet consomme 6 XP.':'At 6 XP, use the table on p.129. The roll consumes 6 XP.',
'Ce type de combattant n’utilise pas le tableau d’avancement des Héros.':'This fighter type does not use the Heroes advancement table.',
'Achat de compétences':'Skill purchase','Aucun achat de compétence disponible pour ce profil.':'No skill purchase available for this profile.',
'Achats d’améliorations':'Advancement purchases','Achat caractéristique':'Characteristic purchase',
'Aucun arbre autorisé ne contient encore de compétence disponible.':'No allowed tree yet contains an available skill.',
'🎲 Tirer une compétence aléatoire':'🎲 Roll a random skill','Aucune compétence disponible.':'No skill available.','Choisis la compétence à acquérir.':'Choose the skill to acquire.',
'Le Physician coûte':'The Physician costs','pour ce patient (2D6 × 10). Trésor disponible :':'for this patient (2D6 × 10). Treasury available:',
'Si le paiement est effectué, un D6 détermine le résultat :':'If payment is made, a D6 determines the result:','6 = récupération complète':'6 = full recovery',
'Séquences de blessures persistantes · D66 optionnel':'Lasting injuries sequences · optional D66','Résultat':'Result','Ajouter ce résultat':'Add this result',
'Le lancer est facultatif : le résultat ne sera ajouté qu’après validation.':'The roll is optional: the result is only added once confirmed.',
'Compétences acquises':'Acquired skills','Domaines et sorts autorisés par le profil':'Domains and spells allowed by the profile',
'← Retour à la bande':'← Back to warband','Voir / modifier le résumé conservé dans la base':'View / edit the summary stored in the database',
'⛓ CAPTURÉ':'⛓ CAPTURED','L’objet sera retiré de la fiche sans remboursement du prix payé.':'The item will be removed from the card with no refund of the price paid.',
'VENTE D’ÉQUIPEMENT':'EQUIPMENT SALE',', soit 50 % de la valeur affichée, que tu peux modifier.':', i.e. 50% of the displayed value, which you can edit.',
'＋ Débloquer':'＋ Unlock','— glisser pour réorganiser':'— drag to reorder','Domaines de magie comptés comme arbres Primary':'Magic domains counted as Primary trees',
'AJOUT D’UNE COMPÉTENCE':'ADD A SKILL','Choisir une compétence':'Choose a skill','Choisis une catégorie.':'Choose a category.',
'Toutes les compétences de cet arbre sont déjà acquises.':'All skills in this tree are already acquired.',
'Le résultat est ajouté automatiquement à l’XP du combattant.':"The result is automatically added to the fighter's XP.",
'ACTION IRRÉVERSIBLE':'IRREVERSIBLE ACTION','SUPPRIMER DÉFINITIVEMENT LE COMBATTANT':'PERMANENTLY DELETE FIGHTER',
'Règles de l’équipement':'Equipment rules','DISPONIBILITÉ':'AVAILABILITY','Listes auxquelles l’équipement est ajouté':'Lists this equipment is added to',
'Une affectation à une bande n’enlève pas l’objet de l’Unrestricted List.':'Assigning to a warband does not remove the item from the Unrestricted List.',
'Écris un trait existant pour créer un lien vers sa règle.':'Type an existing trait to link to its rule.','Aucun trait ajouté.':'No trait added.',
'Équipement non armé':'Non-weapon equipment','Le profil d’arme apparaîtra automatiquement si le type est changé en Arme.':'The weapon profile will appear automatically if the type is changed to Weapon.',
'Aucune règle détaillée enregistrée.':'No detailed rule recorded.','Aucun équipement accessible dans cette liste.':'No equipment accessible in this list.',
'Toutes les catégories':'All categories','Aucun équipement trouvé.':'No equipment found.',
'Le livre complet est embarqué dans':'The full book is embedded in','Les combattants déjà recrutés conservent leur fiche actuelle.':'Fighters already recruited keep their current card.',
'recruté dans la bande —':'recruited into the warband —','Utilisés si mode manuel':'Used in manual mode','Aucune règle spéciale.':'No special rule.',
'ARBRE DE COMPÉTENCES':'SKILL TREE','COMPÉTENCES PAR DÉFAUT':'DEFAULT SKILLS','Aucune compétence par défaut.':'No default skill.','＋ Ajouter une compétence…':'＋ Add a skill…',
'ÉQUIPEMENT PAR DÉFAUT':'DEFAULT EQUIPMENT','RÈGLES / ACCÈS':'RULES / ACCESS',
'CRÉATION DES ARBRES DE COMPÉTENCES':'SKILL TREE CREATION','＋ Créer l’arbre':'＋ Create tree','Aucun arbre custom. Crée d’abord un arbre, puis ajoute 1 à 6 compétences.':'No custom tree. Create a tree first, then add 1 to 6 skills.',
'CRÉATION DES DOMAINES DE MAGIE':'MAGIC DOMAIN CREATION','＋ Créer le domaine':'＋ Create domain','Aucun domaine custom. Crée d’abord un domaine, puis ajoute 1 à 6 sorts.':'No custom domain. Create a domain first, then add 1 to 6 spells.',
'TEXTE / RÈGLE':'TEXT / RULE','Affiché dans le Référentiel':'Shown in the Reference','Cette entrée custom sera retirée de son arbre/domaine.':'This custom entry will be removed from its tree/domain.',
'Règle / texte':'Rule / text','Crée-la directement dans son arbre/domaine.':'Create it directly in its tree/domain.',
'Crée d’abord son nom et sa description. Une fois sauvegardée, utilise':'First create its name and description. Once saved, use',
'Aucun équipement disponible.':'No equipment available.','Aucun contenu custom créé.':'No custom content created.',
'Créer une Warband custom':'Create a custom Warband','Crée d’abord la Warband, puis clique sur Modifier pour ouvrir sa configuration.':'First create the Warband, then click Edit to open its configuration.',
'Crée et configure tes propres Warbands sans toucher au contenu officiel.':'Create and configure your own Warbands without touching official content.',
});
const I18N_FR={'Home':'Accueil','My Warbands':'Mes bandes','Create Warband':'Créer une bande','Rules':'Règles','Reference':'Référentiel','Save':'Sauvegarder','Export':'Exporter','Reset Data':'Réinitialiser les données','New Warband':'Nouvelle bande','Create a New Warband':'Créer une nouvelle bande','View My Warbands →':'Voir mes bandes →','No warbands.':'Aucune bande.','Choose a warband':'Choisis une bande','Edit':'Modifier','Delete':'Supprimer','Save Changes':'Enregistrer les modifications','Cancel':'Annuler','Add':'Ajouter','Equipment':'Équipement','Skills':'Compétences','Skill':'Compétence','Special Rules':'Règles spéciales','Spells & Prayers':'Sorts & prières','Spell':'Sort','Magic Domain':'Domaine de magie','Skill Tree':'Arbre de compétences','Skill Trees':'Arbres de compétences','Fighter Profiles':'Profils de combattants','Custom Warbands':'Warbands personnalisées','Custom Equipment':'Équipements personnalisés','Custom Skills':'Compétences personnalisées','Custom Spells':'Sorts personnalisés','Reputation':'Réputation','Treasury':'Trésor','Willpower':'Volonté','Weapon Skill':'Capacité de combat','Ballistic Skill':'Capacité de tir','Movement':'Mouvement','Strength':'Force','Toughness':'Endurance','Wounds':'Blessures','Initiative':'Initiative','Attacks':'Attaques','Leadership':'Commandement','Cool':'Calme','Rating':'Valeur','Stash':'Réserve','After Battle':'Après la bataille','Post-Battle':'Post-bataille','Search':'Rechercher','Warband':'Bande','Warbands':'Bandes','Fighter':'Combattant','Fighters':'Combattants','Faction':'Faction','Factions':'Factions','Campaign':'Campagne','Campaigns':'Campagnes','Custom Warband':'Warband personnalisée','Custom Warband deleted':'Warband custom supprimée','Account':'Compte','Sign in':'Se connecter','Sign up':'Créer un compte','Log in':'Se connecter','Log out':'Se déconnecter','Username':'Nom d’utilisateur','Password':'Mot de passe','Email':'E-mail','Forgot password?':'Mot de passe oublié ?','Forgot username?':'Nom d’utilisateur oublié ?','Account settings':'Paramètres du compte','Cloud sync':'Synchronisation cloud','Local data':'Données locales','Not signed in':'Non connecté','Reference pages':'pages de référence','local warbands':'bandes locales','available factions':'factions disponibles','loaded packs':'packs chargés','starting GC':'GC de départ','Core M17':'M17 de base','No results':'Aucun résultat','Create':'Créer','Rename':'Renommer','Transfer':'Transférer','Remove':'Supprimer','Buy':'Acheter','Roll':'Lancer','Reroll':'Relancer','Sign-in and cloud storage will be added in the next account step.':'La connexion et le stockage cloud seront ajoutés lors de la prochaine étape du système de compte.'};
const FACTION_FR={'Possessed':'Possédés','Witch Hunters':'Chasseurs de sorcières','Sisters of Sigmar':'Sœurs de Sigmar','Undead':'Morts-vivants','Skaven':'Skavens','Orcs':'Orques','Dwarfs':'Nains','Grave Guard':'Garde des cryptes','Crypt Ghouls':'Goules des cryptes','Skeleton Warriors':'Guerriers squelettes','Dire Wolves':'Loups funestes'};
const STORAGE_MODE=window.MordheimundaStorage.mode(); const ACCOUNT_SESSION_KEY='mordheimunda_account_session';
const accountSession=()=>{try{return JSON.parse(localStorage.getItem(ACCOUNT_SESSION_KEY)||'null')}catch{return null}};
const isAdminSession=()=>!!accountSession()?.isAdmin;
function refreshAdminNavVisibility(){const wrap=document.getElementById('navAdmin');if(wrap)wrap.classList.toggle('is-visible',isAdminSession())}
const dataStore=window.MordheimundaStorage;
function translateSiteText(v){const text=String(v);return siteLanguage==='fr'?(I18N_FR[text]||FACTION_FR[text]||text):(I18N_EN[text]||text);} 

function applySiteLanguage(){
 document.documentElement.lang=siteLanguage;
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 nodes.forEach(n=>{if(n.parentElement?.closest('#languageSelect'))return;if(n.__i18nOriginal===undefined)n.__i18nOriginal=n.nodeValue;n.nodeValue=translateSiteText(n.__i18nOriginal);});
 document.querySelectorAll('input[placeholder],textarea[placeholder],[title],[aria-label]').forEach(el=>{
   if(el.dataset.i18nPlaceholder===undefined&&el.placeholder)el.dataset.i18nPlaceholder=el.placeholder;
   if(el.dataset.i18nTitle===undefined&&el.title)el.dataset.i18nTitle=el.title;
   if(el.dataset.i18nAria===undefined&&el.getAttribute('aria-label'))el.dataset.i18nAria=el.getAttribute('aria-label');
   if(siteLanguage==='en'){if(el.placeholder)el.placeholder=translateSiteText(el.dataset.i18nPlaceholder||el.placeholder);if(el.title)el.title=translateSiteText(el.dataset.i18nTitle||el.title);if(el.getAttribute('aria-label'))el.setAttribute('aria-label',translateSiteText(el.dataset.i18nAria||el.getAttribute('aria-label')));}
   else{if(el.dataset.i18nPlaceholder!==undefined)el.placeholder=el.dataset.i18nPlaceholder;if(el.dataset.i18nTitle!==undefined)el.title=el.dataset.i18nTitle;if(el.dataset.i18nAria!==undefined)el.setAttribute('aria-label',el.dataset.i18nAria);}
 });
 const sel=document.getElementById('languageSelect');if(sel){sel.value=siteLanguage;const label=sel.closest('.language-control')?.querySelector('span');if(label)label.textContent=siteLanguage==='en'?'Language':'Langue';const opts=sel.options;if(opts[0])opts[0].textContent='English';if(opts[1])opts[1].textContent='Français';}
}
function setSiteLanguage(v){siteLanguage=v==='fr'?'fr':'en';localStorage.setItem(SITE_LANGUAGE_KEY,siteLanguage);renderCurrentRoute();}
function render(view='dashboard',opts={}){const next=routeForView(view);if(opts.history!==false&&next!==appPath(location.pathname)){history.pushState({mordheimunda:true,view},'',next)}renderCurrentRoute();}
function dashKpi(label,value,accent){return `<div class="dash-kpi-card"><span class="dash-kpi-label">${esc(label)}</span><strong class="dash-kpi-value"${accent?` style="color:${accent}"`:''}>${value}</strong></div>`}
function dashWarbandCard(r){const en=siteLanguage==='en';const f=faction(r)||{displayName:r?.factionName||r?.factionId||(en?'Unknown faction':'Faction inconnue'),budget:1000};const bar=f.group==='Undead'||/vampir|mort|zombi|skelet/i.test(f.displayName||'')?'#a5453a':'#9dfa3c';const labelColor=bar==='#a5453a'?'#c97a7a':'#7ddd2e';const bannerVisual=r.icon?`<img class="dash-wcard-cover"${imageFocusStyle(r.iconFocus)} src="${esc(r.icon)}" alt="${en?'Icon for':'Icône de'} ${esc(r.name)}">`:`<span class="gang-icon">${imageMarkup(r.icon,'gang',`${en?'Icon for':'Icône de'} ${esc(r.name)}`,r.iconFocus)}</span>`;
  // V147 — landscape poster card ported from the Main.dc.html mockup: a wide
  // image band (~72%) with just the rank tag, accent bar and duplicate icon,
  // and a slim bottom strip (~28%) holding only faction + name on the left
  // and the warband's Cote (total value) in a small badge on the right —
  // fighters/gold no longer shown on the dashboard card at all.
  return `<a href="${warbandPath(r.id)}" data-app-route="1" class="dash-wcard"><div class="dash-wcard-banner">${bannerVisual}<span class="dash-wcard-bar" style="background:${bar}"></span><button type="button" class="dash-wcard-dup" title="${en?'Duplicate':'Dupliquer'}" aria-label="${en?'Duplicate':'Dupliquer'} ${esc(r.name)}" onclick="event.preventDefault();event.stopPropagation();duplicateRoster('${r.id}')">⧉</button><span class="dash-wcard-rep">${en?'Rep.':'Rép.'} ${Number(r.reputation||0)}</span></div><div class="dash-wcard-body"><div class="dash-wcard-text"><span class="dash-wcard-faction" style="color:${labelColor}">${esc(f.displayName)}</span><strong class="dash-wcard-name">${esc(r.name)}</strong></div><div class="dash-wcard-cote"><span>${en?'Rating':'Cote'}</span><b>${total(r)}</b></div></div></a>`}
function dashboard(){const en=siteLanguage==='en';const rosters=state.rosters||[];const totalFighters=rosters.reduce((n,r)=>n+(r.fighters?.length||0),0);const totalGold=Math.round(rosters.reduce((n,r)=>n+Number(r.gold||0),0));const totalRep=rosters.reduce((n,r)=>n+Number(r.reputation||0),0);
$('#content').innerHTML=`<div class="dash-wrap">
<div class="dash-content">
<div class="dash-topbar">
<div><span class="dash-kicker">Mordheimunda 26 / M17</span><h1 class="dash-h1">${en?'Welcome, Captain':'Bienvenue, Capitaine'}</h1></div>
<div class="dash-topbar-actions"><input type="search" class="dash-search" placeholder="${en?'Search a warband…':'Rechercher une bande…'}" oninput="dashFilterWarbands(this.value)"><button type="button" class="dash-icon-btn" title="${en?'Change background image':"Changer l'image de fond"}" aria-label="${en?'Change background image':"Changer l'image de fond"}" onclick="toast('${en?'Coming soon':'Bientôt disponible'}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></button><button type="button" class="dash-btn-primary" onclick="render('create')">＋ ${en?'New warband':'Nouvelle bande'}</button></div>
</div>
<div class="dash-kpi-row">
${dashKpi(en?'Active warbands':'Bandes actives',rosters.length)}
${dashKpi(en?'Fighters':'Combattants',totalFighters)}
${dashKpi(en?'Total treasure':'Trésor cumulé',`${totalGold} <span style="font-size:13px;color:#8f8f8a">GC</span>`,'#a6ff33')}
${dashKpi(en?'Total reputation':'Réputation totale',totalRep)}
</div>
<div class="dash-section">
<div class="dash-section-head"><h2>${en?'My warbands':'Mes bandes'}</h2><a href="#" data-app-route="1" onclick="render('rosters');return false;">${en?'See all →':'Voir tout →'}</a></div>
<div class="dash-wgrid" id="dashWgrid">
${rosters.slice(0,3).map(dashWarbandCard).join('')}
<a href="#" data-app-route="1" onclick="render('create');return false;" class="dash-create-tile"><span class="dash-create-plus">＋</span><span>${en?'Create a new warband':'Créer une nouvelle bande'}</span></a>
</div>
${!rosters.length?`<div class="empty large" style="margin-top:12px"><strong>${en?'No warband.':'Aucune bande.'}</strong><span>${en?'Start by choosing a faction and forging your first roster.':'Commence par choisir une faction et forge ton premier roster.'}</span></div>`:''}
</div>
</div>
</div>`}
function dashFilterWarbands(q){const term=String(q||'').trim().toLowerCase();const cards=Array.from(document.querySelectorAll('#dashWgrid .dash-wcard'));cards.forEach(c=>{const name=(c.querySelector('.dash-wcard-name')?.textContent||'').toLowerCase();c.style.display=!term||name.includes(term)?'':'none'})}
function factionTile(f){const pack=f.packId?(window.NECROHEIM_PACKS||[]).find(p=>p.id===f.packId):null;return `<button class="faction-tile" onclick="startFaction('${f.id}')"><span class="faction-sigil">${factionSigils[f.id]||'◆'}</span><span class="faction-name">${esc(f.displayName)}</span><span class="faction-sub">${f.warriors.length} profils · ${esc(f.group||'M17')}</span>${pack?`<span class="pack-badge">PACK · ${esc(pack.name)}</span>`:''}<span class="faction-arrow">→</span></button>`}
function customWarbandCreateTile(cw){const fid=`custom-warband-${cw.id}`;const count=(cw.fighterIds||[]).length;const sigil=cw.icon?`<span class="choice-sigil has-icon">${imageMarkup(cw.icon,'custom-warband',esc(cw.name),cw.iconFocus)}</span>`:`<span class="choice-sigil">⚔</span>`;
  // Once a custom warband has been made official (cw.officialId set), it's no
  // longer a "custom" pick — drop the CUSTOM badge here, same as everywhere
  // else this warband's name is shown.
  return `<button class="faction-choice custom-warband" data-faction="${esc(fid)}" onclick="selectFaction('${esc(fid)}',this)"><span class="choice-img-wrap">${sigil}</span><span class="fname">${esc(cw.name)}</span><span class="fcount">${count} profil${count!==1?'s':''} custom</span>${cw.officialId?'':'<span class="custom-badge">CUSTOM</span>'}</button>`}
function customWarbandFaction(cw){return {id:`custom-warband-${cw.id}`,displayName:cw.name,group:'CUSTOM',budget:1000,warriors:customWarbandWarriors(cw),equipment:customWarbandEquipmentObjects(cw)}}
function allCreateWarbandEntries(){const official=D.factions.filter(f=>!f.packId);const customs=customWarbandList().map(customWarbandFaction);return [...official,...customs]}
function startFaction(fid){render('create');setTimeout(()=>{const el=$(`[data-faction="${fid}"]`);if(el)selectFaction(fid,el)},0)}
function rosters(){const en=siteLanguage==='en';$('#content').innerHTML=`<div class="dash-section-head" style="margin-bottom:18px"><div><span class="dash-kicker">Warhouse / Archives</span><h2 style="margin:0;font-family:'Cinzel',serif;font-size:24px;color:#f2f2ee">${en?'My warbands':'Mes bandes'}</h2></div><button class="dash-btn-primary" onclick="render('create')">＋ ${en?'New warband':'Nouvelle bande'}</button></div>${state.rosters.length?`<div class="dash-wgrid">${state.rosters.map(dashWarbandCard).join('')}<a href="#" data-app-route="1" onclick="render('create');return false;" class="dash-create-tile"><span class="dash-create-plus">＋</span><span>${en?'Create a new warband':'Créer une nouvelle bande'}</span></a></div>`:`<div class="empty large"><strong>${en?'No warband.':'Aucune bande.'}</strong><span>${en?'Start by choosing a faction and forging your first roster.':'Commence par choisir une faction et forge ton premier roster.'}</span><button class="dash-btn-primary" onclick="render('create')">${en?'Create a warband':'Créer une bande'}</button></div>`}`}
function create(){
  // A custom warband that has been officialized (cw.officialId set) already
  // has its published official faction listed here — showing the original
  // custom entry too would just be the same warband appearing twice. It
  // stays selectable via the Custom tab (as an OFFICIAL DRAFT, for editing),
  // just not offered again as a brand-new-warband starting point.
  const official=D.factions.filter(f=>!f.packId),customs=customWarbandList().filter(cw=>!cw.officialId),defaultId=official[0]?.id||(customs[0]?`custom-warband-${customs[0].id}`:'');
  $('#content').innerHTML=`<div class="mu-create-page">
<div class="mu-create-head"><h1>Créer une bande</h1><p>Choisis une faction, les suppléments actifs, puis nomme ta bande. Le recrutement des combattants se fait ensuite dans l'onglet Recrutement.</p></div>
<div class="panel">
<div class="step-head"><span class="step-num">01</span><b>Faction</b><span class="aux">1000 GC de départ</span></div>
<div class="faction-grid">${official.map((f,i)=>`<button class="faction-choice ${i===0&&!customs.length?'selected':''}" data-faction="${f.id}" onclick="selectFaction('${f.id}',this)"><span class="choice-img-wrap"><span class="choice-sigil">${factionSigils[f.id]||'◆'}</span></span><span class="fname">${esc(f.displayName)}</span><span class="fcount">${f.warriors.length} profils structurés</span></button>`).join('')}${customs.map(cw=>customWarbandCreateTile(cw)).join('')}</div>
</div>
<div id="supplementStep"></div>
<div class="panel">
<div class="step-head"><span class="step-num">03</span><b>Nom de bande</b><span class="aux">Optionnel</span></div>
<input id="createName" class="name-input" placeholder="Ex. Les Enfants de la Crypte" value="">
<p style="margin:8px 0 0;font-size:9px;color:#5a5a56">Laissé vide → nommée automatiquement « Bande [faction] ».</p>
</div>
<div class="mu-create-actions"><button class="mu-btn-cancel" onclick="render('rosters')">Annuler</button><button class="dash-btn-primary" onclick="createFromPage()">Créer la bande →</button></div>
</div>`;
  selectedFaction=defaultId;
  const first=$(`[data-faction="${defaultId}"]`); if(first)first.classList.add('selected');
  renderSupplementChoices();
}
let selectedFaction=D.factions[0]?.id;
function selectFaction(fid,el){
  selectedFaction=fid;
  document.querySelectorAll('.faction-choice').forEach(x=>x.classList.remove('selected'));
  el.classList.add('selected');
  renderSupplementChoices();
}
function renderSupplementChoices(){
  const box=$('#supplementStep');
  if(!box)return;
  if(String(selectedFaction).startsWith('custom-warband-')){box.innerHTML='';return;}
  const packs=availableSupplementsForFaction(selectedFaction);
  const faction=D.factions.find(x=>x.id===selectedFaction);
  if(!packs.length){box.innerHTML='';return;}
  box.innerHTML=`<div class="panel">
<div class="step-head"><span class="step-num">02</span><b>Suppléments</b><span class="aux">Compatibles avec ${esc(faction?.displayName||'')}</span></div>
<p class="supp-hint">Seuls les suppléments liés à la faction choisie à l'étape 01 apparaissent ici. <b>Un seul supplément optionnel peut être actif à la fois, ou aucun</b> : coche une option pour l'activer, reclique dessus pour la désactiver — certains réécrivent entièrement les profils, l'équipement ou l'arbre de compétences de la bande de base.</p>
<div class="supp-choice locked"><input type="checkbox" checked disabled><div><span class="sn">Livre de base (M17)</span><div class="sd">Toujours actif — commun à toutes les factions</div></div></div>
${packs.map((p)=>`<div class="supp-choice"><input type="checkbox" class="supplement-check" data-supp="${esc(p.id)}" onclick="handleSupplementToggle(this)"><div><span class="sn">${esc(p.name)}</span><div class="sd">${esc(p.description||'Supplément compatible avec cette faction.')}</div></div></div>`).join('')}
</div>`;
}
function handleSupplementToggle(el){if(el.checked){document.querySelectorAll('#supplementStep input.supplement-check').forEach(o=>{if(o!==el)o.checked=false})}}
function selectedSupplements(){const checked=document.querySelector('#supplementStep input.supplement-check:checked');return checked?[checked.dataset.supp]:[]}
function createFromPage(){
  const isCustom=String(selectedFaction||'').startsWith('custom-warband-');
  const cw=isCustom?customWarbandById(String(selectedFaction).replace('custom-warband-','')):null;
  const f=isCustom?customWarbandFaction(cw):D.factions.find(x=>x.id===selectedFaction && !x.packId);
  if(!f)return;
  const name=($('#createName').value||'').trim()||`Bande ${f.displayName}`;
  const activeSupplements=isCustom?[]:selectedSupplements();
  const id=crypto.randomUUID();
  state.rosters.push({id,name,factionId:isCustom?null:f.id,customWarbandId:isCustom?cw.id:null,activeSupplements,fighters:[],gold:f.budget,reputation:1,reserve:[],customValues:[],icon:''});
  state.active=id;save(true);render('builder');
}
function openRoster(id){const r0=Array.isArray(state?.rosters)?state.rosters.find(x=>String(x?.id)===String(id)):null;if(!r0)return;state.active=r0.id;gangTab='roster';try{activeRoster();}catch(err){console.warn('Warband normalization warning',err)}try{navigateApp(warbandPath(r0.id));}catch(err){console.error('Warband render failed',err);toast('La bande a été récupérée, mais une donnée ancienne empêche encore son affichage.');}}
function duplicateRoster(id){const r=state.rosters.find(x=>x.id===id),copy=JSON.parse(JSON.stringify(r));copy.id=crypto.randomUUID();copy.name=r.name+' — copie';copy.fighters.forEach(x=>x.instance=crypto.randomUUID());(copy.reserve||[]).forEach(x=>x.reserveId=crypto.randomUUID());state.rosters.push(copy);state.active=copy.id;save();navigateApp(warbandPath(copy.id))}
function builder(){const r=activeRoster();if(!r){render('create');return}const f=faction(r)||{id:'unknown-faction',displayName:r.factionName||r.factionId||'Faction inconnue',group:'RECOVERED',budget:1000,warriors:[],equipment:[]},value=total(r),isRecruit=gangTab==='recruit',isPostBattle=gangTab==='postbattle',isHistory=gangTab==='history',isCampaign=gangTab==='campaign',isRulesTab=gangTab==='rules';if(!Number.isFinite(r.reputation))r.reputation=1;const activeSupplements=Array.isArray(r.activeSupplements)?r.activeSupplements:[];const activePackNames=activeSupplements.map(id=>(window.NECROHEIM_PACKS||[]).find(p=>p.id===id)?.name).filter(Boolean);const custom=Array.isArray(r.customValues)?r.customValues:[];$('#content').innerHTML=`<div class="warroom"><div class="warroom-topbar"><a href="#" onclick="event.preventDefault();navigateApp('${APP_ROUTES.rosters}')">← Mes bandes</a><div class="warroom-topbar-icons"><button type="button" class="mu-icon-btn" title="Imprimer la feuille de bande" onclick="window.print()">⎙</button></div></div><div class="warroom-head"><div class="warroom-brand-block"><button type="button" class="gang-icon gang-icon-editable" title="Importer / remplacer l’icône de la bande" onclick="event.stopPropagation();pickImage('gang')">${imageMarkup(r.icon,'gang',`Icône de ${r.name}`,r.iconFocus)}<span class="image-edit-badge">✎</span></button><div><div class="faction-line"><span class="faction-sigil small">${factionSigils[f.id]||'◆'}</span><span>${esc(f.displayName)}</span>${activePackNames.map(n=>`<span class="supplement-active">PACK · ${esc(n)}</span>`).join('')}</div>${warbandRulesMarkup(r)}<h2>${esc(r.name)}</h2><div class="roster-meta"><span>${r.fighters.length} guerrier${r.fighters.length!==1?'s':''}</span><span>Valeur ${value} GC</span></div></div></div><div class="warroom-head-right"><div class="warband-overview"><div class="warband-stat rating-stat"><span class="stat-icon">◈</span><div><small>VALEUR DE BANDE</small><strong>${value}<em>GC</em></strong></div></div><div class="warband-stat gold-stat resource-clickable" onclick="openResourceAdjust('gold')"><span class="stat-icon">◈</span><div><small>TRÉSOR</small><strong>${r.gold}<em>GC</em></strong><span>Cliquer pour ajouter ou soustraire</span></div></div><div class="warband-stat wyrdstone-stat resource-clickable" onclick="openResourceAdjust('wyrdstone')"><span class="stat-icon">◆</span><div><small>WYRDSTONE</small><strong>${r.wyrdstone||0}</strong><span>Shards en réserve · cliquer pour modifier</span></div></div><div class="warband-stat reputation-stat resource-clickable" onclick="openResourceAdjust('reputation')"><span class="stat-icon">★</span><div><small>RÉPUTATION</small><strong>${r.reputation}</strong><span>Cliquer pour ajouter ou soustraire</span></div></div>${custom.map((c,i)=>`<div class="warband-stat custom-stat resource-clickable" onclick="openCustomValue(${i})"><span class="stat-icon">◆</span><div><small>${esc(c.label||'VALEUR PERSONNALISÉE')}</small><strong>${esc(String(c.value??0))}</strong><span>Cliquer pour modifier</span></div></div>`).join('')}<button class="warband-stat custom-stat custom-add" type="button" onclick="openCustomValue()"><span class="stat-icon">＋</span><div><small>AJOUTER UNE VALEUR</small><strong>+</strong><span>Créer une nouvelle valeur personnalisée</span></div></button></div><button class="button primary warroom-edit-btn" onclick="openEditWarband()">✎ Modifier</button></div></div><div class="gang-tabs"><button class="gang-tab ${gangTab==='roster'?'active':''}" onclick="setGangTab('roster')">⚔ Bande <span>${r.fighters.length}</span></button><button class="gang-tab ${isRulesTab?'active':''}" onclick="setGangTab('rules')">☰ Règles de bande</button><button class="gang-tab ${isRecruit?'active':''}" onclick="setGangTab('recruit')">＋ Recrutement</button><button class="gang-tab ${gangTab==='reserve'?'active':''}" onclick="setGangTab('reserve')">▣ Réserve <span>${(r.reserve||[]).length}</span></button><button class="gang-tab ${isPostBattle?'active':''}" onclick="setGangTab('postbattle')">⚔ Post-bataille</button><button class="gang-tab ${isHistory?'active':''}" onclick="setGangTab('history')">◷ Historique</button><button class="gang-tab ${isCampaign?'active':''}" onclick="setGangTab('campaign')">⚑ Campagne</button></div>${!isRecruit&&gangTab!=='reserve'&&!isPostBattle&&!isHistory&&!isCampaign&&!isRulesTab?`<div class="stat-legend"><span><i class="legend-swatch mental"></i>Caractéristiques mentales</span><span><i class="legend-swatch save"></i>Sauvegarde</span><span><i class="legend-swatch xp"></i>Expérience</span></div>`:''}<div class="mobile-roster-picker"><span class="rail-label">ROSTER ACTUEL</span><select class="mobile-roster-select" aria-label="Choisir un guerrier" onchange="if(this.value!==\"\")openFighterCard(Number(this.value))"><option value="">Choisir un guerrier…</option>${r.fighters.map((x,i)=>`<option value="${i}">${esc(x.name)}</option>`).join('')}</select></div><section class="warroom-main warroom-main-full">${isRecruit?recruitmentView(f):gangTab==='reserve'?reserveView(r,f):isPostBattle?postBattleView(r,f):isHistory?historyView(r):isCampaign?campaignView(r):isRulesTab?warbandRulesView(r):rosterView(r,f)}</section></div>`}
function setGangTab(tab){gangTab=tab;if(tab==='postbattle')postBattleSubtab='income';render('builder')}
function adjustGold(amount){const r=activeRoster();if(!r)return;const n=Number(amount);if(!Number.isFinite(n)||n===0)return;r.gold=Math.max(0,Math.round(r.gold+n));save(true);render('builder');toast(`${n>0?'+':''}${n} GC`)}
function adjustReputation(amount){const r=activeRoster();if(!r)return;const n=Number(amount);if(!Number.isFinite(n)||n===0)return;r.reputation=Math.max(0,Math.round(Number(r.reputation||0)+n));save(true);render('builder');toast(`Réputation ${r.reputation}`)}
function openResourceAdjust(type){const r=activeRoster();if(!r)return;const cfg={gold:{label:'Trésor',unit:'GC',current:r.gold||0},wyrdstone:{label:'Wyrdstone',unit:'shards',current:r.wyrdstone||0},reputation:{label:'Réputation',unit:'points',current:r.reputation||0}}[type]||null;if(!cfg)return;openModal(`<div class="resource-dialog"><div class="eyebrow">GESTION DE BANDE</div><h2>${cfg.label}</h2><p>Choisis l’opération puis indique la quantité à appliquer. La valeur actuelle est <strong>${cfg.current}</strong>.</p><div class="resource-mode"><button type="button" class="resource-mode-btn active" data-mode="add" onclick="selectResourceMode(this)">＋ Ajouter</button><button type="button" class="resource-mode-btn" data-mode="sub" onclick="selectResourceMode(this)">− Soustraire</button></div><input id="resourceAmount" class="resource-amount" type="number" min="0" step="1" value="1" placeholder="Quantité"><small class="resource-unit">${cfg.unit}</small><div class="resource-actions"><button class="button secondary" type="button" onclick="closeModal()">Annuler</button><button class="button primary" type="button" onclick="applyResourceAdjust('${type}')">Appliquer</button></div></div>`)}
function selectResourceMode(btn){document.querySelectorAll('.resource-mode-btn').forEach(x=>x.classList.remove('active'));btn.classList.add('active')}
function applyResourceAdjust(type){const r=activeRoster(),input=$('#resourceAmount');if(!r||!input)return;const n=Math.round(Number(input.value));if(!Number.isFinite(n)||n<=0){toast('Entre une valeur positive');return}const sub=document.querySelector('.resource-mode-btn.active')?.dataset.mode==='sub';const delta=sub?-n:n;if(type==='gold'){r.gold=Math.max(0,Math.round(Number(r.gold||0)+delta));logHistory(r,'treasury',`Trésorerie de la bande : <b style="color:${delta>0?'#a6ff33':'#e0895a'}">${delta>0?'+':''}${delta} GC</b>`)}else if(type==='wyrdstone'){r.wyrdstone=Math.max(0,Math.round(Number(r.wyrdstone||0)+delta));logHistory(r,'treasury',`Wyrdstone de la bande : <b style="color:${delta>0?'#a6ff33':'#e0895a'}">${delta>0?'+':''}${delta}</b> (réserve ${r.wyrdstone})`)}else{r.reputation=Math.max(0,Math.round(Number(r.reputation||0)+delta));logHistory(r,'settings',`Réputation de la bande : <b style="color:${delta>0?'#a6ff33':'#e0895a'}">${delta>0?'+':''}${delta}</b> (nouvelle valeur ${r.reputation})`)}save(true);closeModal();render('builder');toast(`${type==='gold'?'Trésor':type==='wyrdstone'?'Wyrdstone':'Réputation'} ${delta>0?'+':''}${delta}`)}
function openEditWarband(){const r=activeRoster();if(!r)return;openModal(`<div class="resource-dialog"><div class="eyebrow">MODIFIER LA BANDE</div><h2>Renommer la bande</h2><label class="modal-field"><span>Nom de la bande</span><input id="warbandNameInput" class="resource-amount" maxlength="60" value="${esc(r.name)}" placeholder="Nom de la bande"></label><div class="resource-actions"><button class="button secondary" type="button" onclick="closeModal()">Annuler</button><button class="button danger-outline" type="button" onclick="deleteRoster('${r.id}')">Supprimer la bande</button><button class="button primary" type="button" onclick="saveWarbandName()">Enregistrer</button></div></div>`)}
function saveWarbandName(){const r=activeRoster();if(!r)return;const input=$('#warbandNameInput');const name=(input?.value||'').trim();if(!name){toast('Donne un nom à la bande');return}const oldName=r.name;if(oldName!==name)logHistory(r,'settings',`Nom de la bande modifié : <span style="color:#8f8f8a">« ${esc(oldName)} »</span> → <b>« ${esc(name)} »</b>`);r.name=name;save(true);closeModal();render('builder');toast('Bande renommée')}
function openCustomValue(index){const r=activeRoster();if(!r)return;r.customValues=Array.isArray(r.customValues)?r.customValues:[];const existing=index!==undefined?r.customValues[index]:null;openModal(`<div class="resource-dialog custom-dialog"><div class="eyebrow">VALEUR PERSONNALISÉE</div><h2>${existing?'Modifier la valeur':'Nouvelle valeur'}</h2><label class="modal-field"><span>Nom</span><input id="customLabel" class="resource-amount" maxlength="32" value="${esc(existing?.label||'')}" placeholder="Ex. Influence"></label><label class="modal-field"><span>Valeur</span><input id="customAmount" class="resource-amount" type="number" step="1" value="${Number(existing?.value??0)}"></label><div class="resource-actions"><button class="button secondary" type="button" onclick="closeModal()">Annuler</button>${existing?`<button class="button danger-outline" type="button" onclick="deleteCustomValue(${index})">Supprimer</button>`:''}<button class="button primary" type="button" onclick="saveCustomValue(${index===undefined?'null':index})">Enregistrer</button></div></div>`)}
function saveCustomValue(index){const r=activeRoster();if(!r)return;const label=($('#customLabel')?.value||'').trim();const value=Math.round(Number($('#customAmount')?.value));if(!label){toast('Donne un nom à la valeur');return}if(!Number.isFinite(value)){toast('Valeur invalide');return}r.customValues=Array.isArray(r.customValues)?r.customValues:[];const isNew=index===null;if(isNew)r.customValues.push({label,value});else if(r.customValues[index])r.customValues[index]={...r.customValues[index],label,value};logHistory(r,'settings',isNew?`Ressource personnalisée <b>« ${esc(label)} »</b> ajoutée aux paramètres de la bande (valeur ${value})`:`Ressource personnalisée <b>« ${esc(label)} »</b> modifiée (valeur ${value})`);save(true);closeModal();render('builder');toast('Valeur personnalisée enregistrée')}
function deleteCustomValue(index){const r=activeRoster();if(!r||!Array.isArray(r.customValues))return;if(!confirm('Supprimer cette valeur personnalisée ?'))return;const label=r.customValues[index]?.label||'Valeur';r.customValues.splice(index,1);logHistory(r,'settings',`Ressource personnalisée <b>« ${esc(label)} »</b> supprimée des paramètres de la bande`);save(true);closeModal();render('builder');toast('Valeur supprimée')}
const EXPLORATION_RESULTS={
  doubles:{1:{name:'Well',text:'Choose one of your Heroes and roll a D6. If the result is equal to or lower than his Toughness, he finds one shard of wyrdstone at the bottom of the well. If he fails, the Hero swallows tainted water and must miss the next game through sickness.'},2:{name:'Shop',text:'After a thorough search you find loot worth D6×5 GC. If you roll a 1 you will also find a Lucky Charm (see the Equipment section).'},3:{name:'Corpse',text:'You gain a Dagger. In addition, roll a D6 to see what you find when you search the corpse: 1 = D6×5 GC; 2 = Club; 3 = Axe; 4 = Spear; 5 = Sword; 6 = Suit of light armour.'},4:{name:'Straggler',text:'Skaven and Orc warbands can sell the straggler to slavers (or eat him) and gain D6×5 GC. Possessed warbands can sacrifice the unfortunate individual for the glory of the Chaos gods; the Leader gains +1D3 Experience. Undead warbands can kill the man and gain a Skeleton Warrior with no equipment for no cost. Any other warband can interrogate the man and gain insight into the city. Next time you roll on the Exploration chart, roll one dice more than is usually allowed, and discard any one dice.'},5:{name:'Overturned Cart',text:'Roll a D6 to see what you find: 1–2 = Mordheim Map; 3–4 = a purse with 2D6×5 GC; 5–6 = a jewelled sword (worth 50 GC) and jewelled dagger (20 GC).'},6:{name:'Ruined Hovels',text:'You find loot worth D6×5 GC amidst the ruins.'}},
  triples:{1:{name:'Tavern',text:'The warband’s Leader must take a Leadership check. If he passes, the warband gains 4D6×5 GC worth of wines and ales which can be sold immediately. If he fails, the men drink most of the alcohol despite their leader’s threats and curses; you have D6×5 GC worth of alcohol left when the warband reaches their encampment. Undead, Witch Hunter and Sisters of Sigmar warbands automatically pass this check, as they are not tempted by such worldly things as alcohol.'},2:{name:'Smithy',text:'Roll a D6 to determine what you find inside: 1 = Sword; 2 = Bastard Sword; 3 = Morning Star; 4 = Halberd; 5 = Great Axe; 6 = 2D6×5 GC worth of scrap metal (add the value to your treasury).'},3:{name:'Prisoners',text:'Possessed warbands can sacrifice the victims and gain 2D3 Experience distributed amongst the Heroes. Undead warbands can callously kill the prisoners and gain a Skeleton Warrior with no equipment at no cost. Skaven and Orcs can sell the prisoners into slavery for 3D6×10 GC. Other warbands can escort the prisoners out of the city and are rewarded with 2D6×5 GC; in addition, one prisoner decides to join the warband. Gain a Henchman of your choice from the Warband List; they start with no equipment.'},4:{name:'Fletcher',text:'Roll a D6 to see what you find: 1 = D3 Bows; 2 = D3 Long Bows; 3 = Quiver Of Bodkin Arrows; 4 = Quiver Of Hunting Arrows; 5 = D3 Crossbows; 6 = Heavy Crossbow.'},5:{name:'Market Hall',text:'You find several items worth 2D6×10 GC in total.'},6:{name:'Returning a Favour',text:'You gain the services of any one Hired Sword (choose from those available to your warband) for the duration of the next battle, free of charge. After the battle he will depart, or you may continue to pay for his upkeep as normal.'}},
  four:{1:{name:'Gunsmith',text:'Roll a D6 to see what you find: 1 = Blunderbuss; 2 = Brace Of Pistols (Pair); 3 = Brace Of Duelling Pistols (Pair); 4 = D3 Handguns; 5 = D3 Flasks Of Superior Blackpowder; 6 = Bomb.'},2:{name:'Shrine',text:'Your warband may strip the shrine and gain 3D6×5 GC worth of loot. Sisters of Sigmar or Witch Hunter warbands may save some of the shrine’s holy relics. They gain 2D6×5 GC from their patrons, and a blessing from the gods; one weapon chosen by the player gains the weapon trait Blessed.'},3:{name:'Townhouse',text:'Your warband finds 3D6×5 GC worth of loot.'},4:{name:'Armourer',text:'Roll a D6 to see what you find: 1 = D3 Shields; 2 = D3 Bucklers; 3 = D3 Suits Of Light Armour; 4 = D3 Suits Of Heavy Armour; 5 = Suit Of Full Plate Armour; 6 = Suit Of Ithilmar Armour.'},5:{name:'Graveyard',text:'Any warband apart from Witch Hunters and Sisters of Sigmar may loot the crypts and graves and gains D6×5 GC worth of loot. If you loot the graveyard, the next time you play against Sisters of Sigmar or Witch Hunters, the entire enemy warband will hate all the models in your warband. Witch Hunters and Sisters of Sigmar will seal the graves and are rewarded for their piety by D6 Experience points distributed amongst the Heroes.'},6:{name:'Catacombs',text:'You can use the new tunnels you found in the next battle you play. Position up to three warriors (not any warrior with Large Target special rule) anywhere on the battlefield at ground level. They are set up at the end of the player’s first turn and cannot be placed within 8" of any enemy models.'}},
  five:{1:{name:'Moneylender’s House',text:'Inside, hidden amongst the debris, you find D6×50 GC to add to your treasury.'},2:{name:'Alchemist’s Laboratory',text:'In the ruins you find loot worth 3D6×5 GC and a battered old notebook. One of your Heroes may study the Alchemist’s notebook; the Hero gains Academic skills as a Primary Skill set.'},3:{name:'Gem Cutter',text:'Roll a D6 to see what you find: 1 = Gold Jewellery worth 2D6×5; 2 = Onyx worth D3×25 GC; 3 = Amethysts worth D6×25 GC; 4 = Emeralds worth 100 GC; 5 = Sapphires worth 250 GC; 6 = Rubies D6×50 GC. If your warband does not sell the gems, one of your Heroes may keep them and displays them proudly. The warrior gains Opulent Jewellery (see Equipment section).'},4:{name:'Merchant’s House',text:'Inside you find several valuable objects which can be sold for 2D6×25 GC. If you roll a double, instead of finding money you find the Symbol of the Order of Freetraders. A Hero in possession of this gains the Haggle skill.'},5:{name:'Shattered Building',text:'You find D3 shards of wyrdstone amongst the ruins. In addition, the warband Leader makes a Leadership check. If passed, a wardog that was guarding the building joins the warband (Human warbands only).'},6:{name:'Entrance to the Catacombs',text:'You can use these tunnels to explore Mordheim more efficiently. From now on, you may re-roll one dice when you roll on the Exploration chart. Make a note of this on your warband’s roster sheet. Second and subsequent catacomb entrances you find do not grant you any additional re-rolls, although you may find further re-rolls from other sources.'}},
  six:{1:{name:'The Pit',text:'You may choose to send one of your Heroes to search for any wyrdstone hidden here. Roll a D6. On a roll of 1 the Hero is devoured by the daemonic guardians of the Pit and never seen again. On a roll of 2 or more he returns with D6+1 shards of wyrdstone.'},2:{name:'Hidden Treasure',text:'When you open the chest you find the following items. Roll for every item on the list separately (apart from the gold crowns) to see whether you have found it: 5D6×20 GC (automatic); D3 pieces of wyrdstone (4+); D3 gems worth 25 GC each (4+); Sacred Relic (5+); Suit of Full Plate Armour (5+); Elven Cloak (5+); Holy tome (5+); Magical artefact (5+).'},3:{name:'Dwarf Smithy',text:'Roll a D6 to see what you find: 1 = Dwarf Handgun; 2 = D3 Great Hammers; 3 = D3 Suits of Heavy Armour; 4 = Gromril Axe; 5 = Gromril Great axe; 6 = Gromril Plate Armour.'},4:{name:'Slaughtered Warband',text:'After giving the dead their final rites, eating them or looting them as appropriate, you find the following items. Roll for every item separately (apart from the gold coins and daggers) to see if you find it: 3D6×25 GC (automatic); D3 Daggers (automatic); D3 Shields (2+); D3 Swords (3+); D3 Axes (3+); D3 Bows (4+); D3 Suits of Light Armour (4+); Mordheim Map (4+); D3 Halberds (5+); Suit of Heavy Armour (5+).'},5:{name:'Fighting Arena',text:'You find a training manual, which you can either sell for 100 GC or let one of your Heroes read. The Warrior gains Combat skills as a Primary Skill set, and their WS is increased by +1. This can be above their normal Maximum Characteristics.'},6:{name:'Noble’s Villa',text:'Roll a D6 to see what you find: 1–2 = D6×50 GC worth of items and money to add to your treasury; 3–4 = 2D3 vials of Crimson Shade; 5–6 = a hidden magical artefact carefully concealed in a hidden cellar or behind a secret door. Roll on the Magical Artefacts table.'}}
};
function ensurePostBattleData(r){
  if(!r)return null;
  if(!r.postBattle||typeof r.postBattle!=='object')r.postBattle={};
  const p=r.postBattle;
  if(!Array.isArray(p.dice))p.dice=[];
  if(!Array.isArray(p.bonusDice))p.bonusDice=[];
  if(!Array.isArray(p.survivingHeroIds))p.survivingHeroIds=[];
  if(!Array.isArray(r.reserve))r.reserve=[];
  if(Array.isArray(r.stash)){ r.stash.forEach(x=>{ if(!r.reserve.some(q=>q.reserveId===x.reserveId || (q.name===x.name&&q.category===x.category))) r.reserve.push({...x,reserveId:x.reserveId||crypto.randomUUID()}); }); delete r.stash; }
  if(!('winner' in p))p.winner=false;
  p.survivingHeroIds=p.survivingHeroIds.filter(id=>(r.fighters||[]).some(x=>x.instance===id&&['Leader','Champion','Raw Recruit'].includes(x.type)&&!fighterStatus(x).dead&&!fighterStatus(x).captured&&!fighterStatus(x).recovery));
  p.heroCount=p.survivingHeroIds.length;
  if(!Number.isFinite(p.extraDice))p.extraDice=p.bonusDice.length;
  if(!Number.isFinite(p.shards))p.shards=0;
  if(!('shardsCashed' in p))p.shardsCashed=false;
  if(!Array.isArray(p.explorationBonuses))p.explorationBonuses=[];
  if(!Number.isFinite(p.soldShards))p.soldShards=0;
  if(!Number.isFinite(p.income))p.income=0;
  if(!p.exploration||typeof p.exploration!=='object')p.exploration={resolved:false,rewards:[],notes:[],rolls:[],history:[]};
  if(!Array.isArray(p.exploration.history))p.exploration.history=[];
  return p;
}
function postBattleEligibleHeroes(r){return (r?.fighters||[]).filter(x=>['Leader','Champion','Raw Recruit'].includes(x.type)&&!fighterStatus(x).dead&&!fighterStatus(x).captured&&!fighterStatus(x).recovery)}
function togglePostBattleHero(id,checked){const r=activeRoster();if(!r)return;const p=ensurePostBattleData(r);const ids=new Set(p.survivingHeroIds);if(checked)ids.add(id);else ids.delete(id);p.survivingHeroIds=[...ids];p.heroCount=p.survivingHeroIds.length;postBattleMarkDirty(p);postBattleDieRows();save(true);render('builder')}
function postBattleRoll(){return 1+Math.floor(Math.random()*6)}
function postBattleDieRows(){const r=activeRoster(),p=ensurePostBattleData(r),totalBase=Math.max(0,Math.floor(Number(p.heroCount)||0)),bonus=Math.max(0,Math.floor(Number(p.extraDice)||0));const need=totalBase+bonus+(p.winner?1:0);while(p.dice.length<need)p.dice.push({value:null,selected:p.dice.length<6,source:p.dice.length<totalBase?'Héros':p.dice.length<totalBase+(p.winner?1:0)?'Victoire':'Bonus'});if(p.dice.length>need)p.dice.length=need;p.dice.forEach((d,i)=>{if(!d.source)d.source=i<totalBase?'Héros':i===totalBase&&p.winner?'Victoire':'Bonus';if(typeof d.selected!=='boolean')d.selected=i<6});return p.dice}
function postBattleSelectedDice(p){return (p.dice||[]).filter(d=>d.selected&&Number.isInteger(Number(d.value))&&Number(d.value)>=1&&Number(d.value)<=6).map(d=>Number(d.value)).slice(0,6)}
function postBattleMultiplicity(dice){const counts=[0,0,0,0,0,0];dice.forEach(n=>{if(n>=1&&n<=6)counts[n-1]++});let best=0,faces=[];counts.forEach((c,i)=>{if(c>=2){if(c>best){best=c;faces=[i+1]}else if(c===best)faces.push(i+1)}});return {count:best,faces}}
function postBattleExploration(p){const dice=postBattleSelectedDice(p),m=postBattleMultiplicity(dice);if(m.count<2)return null;let tier=m.count>=6?'six':m.count===5?'five':m.count===4?'four':m.count===3?'triples':'doubles';const face=Math.max(...m.faces);return {tier,face,result:EXPLORATION_RESULTS[tier][face],count:m.count}}
function postBattleShards(sum){if(sum<=5)return 1;if(sum<=11)return 2;if(sum<=17)return 3;if(sum<=24)return 4;if(sum<=30)return 5;if(sum<=35)return 6;return 7}
function postBattleIncomeMatrix(warriors,shards){const rows=['1-3','4-6','7-9','10-12','13-15','16+'],cols=[1,2,3,4,5,6,7,8],data=[[45,60,75,90,110,120,145,155],[40,55,70,80,100,110,130,140],[35,50,65,70,90,100,120,130],[30,45,60,65,80,90,110,120],[30,40,55,60,70,80,100,110],[25,35,50,55,65,70,90,100]];const ri=warriors<=3?0:warriors<=6?1:warriors<=9?2:warriors<=12?3:warriors<=15?4:5;const ci=Math.min(8,Math.max(1,Math.floor(shards)))-1;return {value:data[ri][ci],row:rows[ri],col:cols[ci]}}
function resetPostBattle(){const r=activeRoster();if(!r)return;const old=ensurePostBattleData(r);if(old.shardsCashed)r.wyrdstone=Math.max(0,Number(r.wyrdstone||0)-Number(old.shards||0));r.postBattle={heroCount:0,extraDice:0,winner:false,dice:[],bonusDice:[],shards:0,shardsCashed:false,soldShards:0,income:0,incomeApplied:false,survivingHeroIds:[],exploration:{resolved:false,rewards:[],notes:[],rolls:[],bonuses:[],history:[]},explorationBonuses:old.explorationBonuses||[]};save(true);render('builder');toast('Séquence post-bataille réinitialisée')}
function postBattleMarkDirty(p,resetCash=true){p.incomeApplied=false;p.income=0;/* Les shards déjà mis en réserve restent dans le Wyrdstone de la bande. Ils ne sont retirés qu'au moment de la vente à l'étape suivante. */}

function rollAllPostBattleDice(){const r=activeRoster();if(!r)return;const p=ensurePostBattleData(r);postBattleDieRows().forEach(d=>{if(!Number.isInteger(Number(d.value)))d.value=postBattleRoll()});postBattleMarkDirty(p);save(true);render('builder');toast('Tous les dés ont été lancés')}
function postBattleUpdateDice(){const r=activeRoster();if(!r)return;const p=ensurePostBattleData(r);postBattleMarkDirty(p);postBattleDieRows();save(true);render('builder')}
function setPostBattleNumber(field,value){const r=activeRoster();if(!r)return;const p=ensurePostBattleData(r);const n=Math.max(0,Math.floor(Number(value)||0));if(field==='soldShards'){p.soldShards=Math.min(n,Number(r.wyrdstone||0))}else if(field==='extraDice'){p[field]=n}else return;postBattleMarkDirty(p,false);postBattleDieRows();save(true);render('builder')}
function setPostBattleWinner(value){const r=activeRoster();if(!r)return;const p=ensurePostBattleData(r);p.winner=!!value;postBattleMarkDirty(p);postBattleDieRows();save(true);render('builder')}
function rollPostBattleDie(i){const r=activeRoster();if(!r)return;const p=ensurePostBattleData(r);postBattleDieRows();if(!p.dice[i])return;p.dice[i].value=postBattleRoll();postBattleMarkDirty(p);save(true);render('builder')}
function editPostBattleDie(i,value){const r=activeRoster();if(!r)return;const p=ensurePostBattleData(r);postBattleDieRows();const n=Math.floor(Number(value));if(Number.isInteger(n)&&n>=1&&n<=6)p.dice[i].value=n;else if(value==='')p.dice[i].value=null;postBattleMarkDirty(p);save(true);render('builder')}
function togglePostBattleDie(i){const r=activeRoster();if(!r)return;const p=ensurePostBattleData(r);postBattleDieRows();if(!p.dice[i])return;const selected=p.dice.filter(d=>d.selected).length;if(!p.dice[i].selected&&selected>=6){toast('Maximum de 6 dés retenus');return}p.dice[i].selected=!p.dice[i].selected;postBattleMarkDirty(p);save(true);render('builder')}
function applyPostBattleIncome(){const r=activeRoster();if(!r)return;const p=ensurePostBattleData(r);const dice=postBattleSelectedDice(p),sum=dice.reduce((a,b)=>a+b,0),shards=dice.length?postBattleShards(sum):0,sold=Math.min(Math.max(0,Number(p.soldShards||0)),shards);if(!dice.length){toast('Renseigne au moins un dé');return}const income= sold>0?postBattleIncomeMatrix(Math.max(1,r.fighters.length),sold).value:0;if(p.incomeApplied){toast('Le revenu a déjà été appliqué pour ce résultat');return}r.wyrdstone=Math.max(0,Number(r.wyrdstone||0)+(shards-sold));r.gold=Math.max(0,Number(r.gold||0)+income);p.shards=shards;p.soldShards=sold;p.income=income;p.incomeApplied=true;save(true);render('builder');toast(`Income appliqué : +${income} GC · ${shards-sold} shard${shards-sold!==1?'s':''} conservé${shards-sold!==1?'s':''}`)}
const EXPLORATION_LORE={
 doubles:{
  1:'The public wells, of which there were several in Mordheim, were covered by rooves raised up on pillars and adorned with carvings and fountains. The city was proud of its water system. Unfortunately, like all the other wells, this one is in a parlous state and undoubtedly polluted with wyrdstone.',
  2:'The Merchants Guild shop has been thoroughly ransacked. Even so, there are still items scattered around the single, long room, mingled in with the rubble. Some are useful, such as cast iron pots and pans and rolls of fine cloth. All manner of smaller items are lying about – the sort of frippery which no longer has a use in a devastated city with few inhabitants.',
  3:'You find a still-warm corpse. A chipped dagger sticks out of his back. Surprisingly, his possessions have not been looted.',
  4:'Your warband encounters one of the survivors of Mordheim, who has lost his sanity along with all his worldly possessions.',
  5:'Stuck in a ruined gateway is an overturned wagon – the covered type that nobles travel in from the city to their estates in the country. Since anyone important fled a long time ago, what is it doing here? The horses have broken their traces, or did someone cut them free?',
  6:'The street consists of ruined hovels, which are leaning over at alarming angles. Not much worth looting here.'
 },
 triples:{
  1:'The ruin of a tavern is recognisable by its sign still hanging on the wall. The upper part of the building is ruined, but the cellars are cut into rock and are still full of barrels. There are broken flagons and tankards everywhere.',
  2:'The furnace and toppled anvil make it obvious what work was done here. Most of the iron and the tools have been looted long ago. Coal and slag litter the floor but there may still be weapons to be found among the debris.',
  3:'A muffled sound comes from one of the buildings. Inside you find a group of finely dressed people who have been locked in a cellar. Perhaps they are prisoners taken by cultists, ready to be sacrificed during Geheimnisnacht.',
  4:'This hovel was once the workshop of a fletcher – a maker of bows and arrows. There are bundles of yew staves and willow rods everywhere.',
  5:'The market hall was raised up on pillars, with the timbered corn exchange above the open market place. The upper storey has been badly damaged, but the covered market still offers a good deal of shelter. The remains of the last market day are still lying around on the cobbles. Most of this is broken pottery and iron pots.',
  6:'As you are returning to your encampment, you meet one of your old acquaintances. He has come to repay an old favour or debt.'
 },
 four:{
  1:'You find the workshop of a Dwarf gunsmith. Its doors have been broken down and the rooms raided, but some of the iron strongboxes have survived intact.',
  2:'Your warband stumbles across a ruined shrine, which is so badly damaged that it is difficult to tell which god was once worshipped within its walls. A few images remain on the painted plaster walls but they have been defaced by heretics. Fragments of smashed statues lie among the ruins. Some items appear to be covered in gold leaf, most of which has been torn off.',
  3:'This three-storey house was once part of a tenement block overlooking a narrow alleyway. The street is now in ruins, but this house remains largely intact. Exploring it you find that the garret leans over so far that you can step out of the window into the attic of the house opposite.',
  4:'A breastplate hanging from a pole drew your attention to this place, obviously too high up to be easily looted. The workshop is ruined and the forge has been smashed. Rooting about in the soot, you find various half-finished items of armour.',
  5:'You find an old graveyard, crammed with sepulchres that are overgrown with ivy. The monuments to the dead are grotesque and decorated with sculpted gargoyles. The ironwork has been ripped from some of the tombs, and stones have toppled off. It looks as if some of the crypts have already been broken into by tomb robbers.',
  6:'You find an entrance to the catacombs and tunnels below Mordheim.'
 },
 five:{
  1:'A grand mansion, that is strongly built from stone, has survived the cataclysm remarkably well. A carved coat of arms adorns the lintel above the doorway although it has been defaced by raiders and the symbols are now unrecognisable. The door itself, has been smashed open with axes and hangs open on its hinges.',
  2:'A narrow stairway leads down into a crypt-like dwelling which was once an alchemist’s workshop. The sign still hangs from one hinge above the entrance. It looks as if this was a very old building which has remained in use for centuries although it did not survive the comet’s destruction too well. The stone floor has strange symbols on it and there are charts and astrological symbols painted onto the walls.',
  3:'The houses in the jewellers’ quarter have all been well and truly looted long ago. Even the rubble has been picked over many times for fragments of gold and gems. But still, some small but valuable items may have been overlooked.',
  4:'The merchant’s house stands by the waterfront. It has a vaulted stone undercroft which is still stacked with barrels and bales of cloth. The foodstuffs have been looted or eaten long ago and huge rats infest the rotting bales. Up the stairs are the dwelling quarters, solidly built of timber, although badly damaged you think you can still get up to them but you’ll need to tread with care!',
  5:'The comet destroyed this building almost completely, making it unsafe for all but the most daring to explore. But places such as this are the best for searching for wyrdstone shards.',
  6:'You find a well-hidden entrance to the dark catacombs which extend for miles beneath the city of Mordheim. Although the entrance looks foreboding the tunnels will take hours off your searches of the city.'
 },
 six:{
  1:'You have come within sight of the Pit, the huge crater created by the comet. A black cloud still rises from it but you can see glowing wyrdstone everywhere. This is the domain of the Shadow Lord, the lord of the Possessed, and no-one is welcome here – even his own followers!',
  2:'In the depths of Mordheim, you come across a hidden chest, bearing the coat-of-arms of one of the noble families of the town.',
  3:'You find a solidly built stone workshop. A runic inscription indicates that this may have been a Dwarf smithy.',
  4:'You find the remains of an entire warband. Broken bodies lay scattered among the ruins, torn apart by some monstrous creature. You see a huge shape, which looks like an immense Possessed creature, shambling away.',
  5:'During better times, Mordheim was famous for its duellists and pit warriors. You have found one of the areas used to train these warriors. The place is filled with training equipment and practice weapons.',
  6:'You find a fine house which is partially ruined. It has been thoroughly ransacked and all the furniture has been stripped of its fine fabrics. Shards of broken pottery of the finest quality are scattered over the floor.'
 }
};
function explorationFactionId(r){return faction(r)?.id||r?.factionId||''}
// Exploration exceptions are grouped by actual warband type instead of scattered checks.
// This keeps special Mordheim results consistent for every relevant warband and custom band.
function explorationWarbandTraits(r){
  const f=faction(r)||{},id=String(explorationFactionId(r)).toLowerCase();
  const label=String(f.displayName||f.name||r?.name||'').toLowerCase();
  const warriors=Array.isArray(f.warriors)?f.warriors:[];
  const races=warriors.map(w=>String(w.race||w.raceName||w.specialRules||'').toLowerCase()).join(' ');
  return {
    undead:id==='undead'||id==='blood-dragons'||label.includes('undead')||races.includes('undead'),
    skaven:id==='skaven'||label.includes('skaven'),
    orcs:id==='orcs'||id==='orc'||label.includes('orc'),
    possessed:id==='possessed'||label.includes('possessed'),
    witchHunters:id==='witchhunters'||id==='witch-hunters'||label.includes('witch hunter'),
    sisters:id==='sisters'||id==='sisters-of-sigmar'||label.includes('sisters of sigmar'),
    human: ['reikland','middenheim','averland','ostland','marienburg','witchhunters','sisters'].includes(id) || label.includes('human') || races.includes('race (human)') || races.includes('human')
  };
}
function explorationIsUndead(r){return explorationWarbandTraits(r).undead}
function explorationIsSkaven(r){return explorationWarbandTraits(r).skaven}
function explorationIsOrc(r){return explorationWarbandTraits(r).orcs}
function explorationIsPossessed(r){return explorationWarbandTraits(r).possessed}
function explorationRoll(sides=6){return 1+Math.floor(Math.random()*sides)}
function explorationDice(n,sides=6){let a=0,rolls=[];for(let i=0;i<n;i++){const x=explorationRoll(sides);a+=x;rolls.push(x)}return {sum:a,rolls}}
function addExplorationGold(r,n){r.gold=Math.max(0,Number(r.gold||0)+Math.max(0,Math.round(n)))}
function addExplorationWyrdstone(r,n){r.wyrdstone=Math.max(0,Number(r.wyrdstone||0)+Math.max(0,Math.round(n)))}
function explorationWarriorDefinition(r,name){
  const f=faction(r);
  const aliases={
    'zombie warrior':'Zombies',
    'zombies':'Zombies',
    'skeleton warrior':'Skeleton Warriors',
    'skeleton warriors':'Skeleton Warriors'
  };
  const target=normName(name),canonical=aliases[target]||name;
  const base=(f?.warriors||[]).find(w=>normName(w.name)===normName(canonical));
  if(base)return base;
  const custom=(customFightersForFaction(f)||[]).find(w=>normName(w.name)===normName(canonical));
  return custom?customFighterAsWarrior(custom):null;
}
function recruitFreeExplorationWarrior(r,name,quantity=1,ignoreComposition=true){
  const f=faction(r),w=explorationWarriorDefinition(r,name);
  if(!w)return 0;
  let added=0;
  const maxCount=Number.isFinite(Number(w.max))?Number(w.max):null;
  for(let n=0;n<Math.max(1,Math.round(quantity));n++){
    const restriction=ignoreComposition?null:recruitmentRestriction(r,w);
    if(restriction){return added;}
    const count=r.fighters.filter(x=>x.wid===w.id||x.sourceName===w.name||x.name===w.name).length;
    if(maxCount!==null&&count>=maxCount)break;
    const fighter={...w,profile:effectiveFighterProfile(w,f),baseProfile:Array.isArray(w.profile)?w.profile.slice():w.profile,sourceName:w.name,wid:w.id||w.customFighterId||`exploration:${normName(w.name)}`,instance:crypto.randomUUID(),name:w.name,xp:0,equipmentSelected:[],skills:Array.isArray(w.defaultSkills)?w.defaultSkills.slice():[],advancements:[],injuries:[],spells:[],notes:'',veteran:false,image:'',status:{recovery:false,captured:false,dead:false,critical:false},customFighterId:w.customFighterId||null};
    if(fighterUsesLoadouts(fighter)){fighter.equipmentStash=[];fighter.equipmentLoadouts=[{id:crypto.randomUUID(),name:'1',equipmentIds:[],equipmentNames:[]}];fighter.activeLoadoutId=fighter.equipmentLoadouts[0].id;syncLoadoutProjection(fighter);}
    r.fighters.push(fighter);
    syncCustomEquipmentEffects(fighter);
    added++;
  }
  return added;
}
function explorationEquipmentDefinition(name){
  const aliases={
    'Jewelled Sword':{base:'Sword',price:50},
    'Jewelled Dagger':{base:'Dagger',price:20},
    'Brace Of Pistols (Pair)':{base:'Pistol',price:50},
    'Brace Of Duelling Pistols (Pair)':{base:'Duelling Pistol',price:80},
    'D3 Flasks Of Superior Blackpowder':{base:'Superior Blackpowder',price:30},
    'Long Bows':{base:'Long bow',price:20},
    'Heavy Crossbow':{base:'Heavy crossbow',price:45},
    'Full Plate Armour':{base:'Full plate armour',price:80},
    'Ithilmar Armour':{base:'Ithilmar',price:90},
    'Heavy Armour':{base:'Heavy armour',price:50},
    'Light Armour':{base:'Light armour',price:20},
    'Gromril Plate Armour':{base:'Gromril plate',price:120},
    'Gromril Great Axe':{base:'Gromril Great Axe',price:75}
  };
  const a=aliases[name]||{base:name};
  const base=D.weapons.find(w=>normName(w.name)===normName(a.base));
  if(!base)return {name,category:'Récompense d’exploration',price:a.price??0,value:a.price??0,profile:null,traits:[],weaponSlotCost:0,equipmentAccessGroups:['ALL'],explorationReward:true};
  return {name,category:base.category,subcategory:base.subcategory||base.category,price:a.price??base.price??0,value:a.price??base.price??0,rarity:base.rarity||'',availability:base.availability||base.rarity||'—',profile:base.profile?{...base.profile}:null,traits:Array.isArray(base.traits)?base.traits.slice():base.traits?[base.traits]:[],rulesText:base.rulesText||'',weaponSlotCost:weaponSlots(base),equipmentAccessGroups:['ALL'],explorationReward:true,sourceEquipment:base.name};
}
function explorationFactionLabel(r){return String(faction(r)?.displayName||faction(r)?.name||'')}
function explorationBonusList(r){return Array.isArray(r?.postBattle?.explorationBonuses)?r.postBattle.explorationBonuses:[]}
function addExplorationBonus(r,id,label,icon,description){const p=ensurePostBattleData(r);p.explorationBonuses=Array.isArray(p.explorationBonuses)?p.explorationBonuses:[];if(!p.explorationBonuses.some(b=>b.id===id))p.explorationBonuses.push({id,label,icon,description});}
function removeExplorationBonus(id){const r=activeRoster();if(!r)return;const p=ensurePostBattleData(r);p.explorationBonuses=(p.explorationBonuses||[]).filter(b=>b.id!==id);save(true);render('builder');toast('Bonus d’Exploration supprimé')}
function addExplorationStash(r,name,quantity=1,category='Récompense d’exploration'){r.reserve=Array.isArray(r.reserve)?r.reserve:[];const q=Math.max(1,Math.round(quantity));const warrior=explorationWarriorDefinition(r,name);if(warrior){const added=recruitFreeExplorationWarrior(r,name,q,true);if(added)return {type:'fighter',name,quantity:added};}const def=explorationEquipmentDefinition(name);const hit=r.reserve.find(x=>x.name===name&&x.explorationReward);if(hit)hit.quantity=(hit.quantity||1)+q;else r.reserve.push({reserveId:crypto.randomUUID(),...def,name,quantity:q,category:def.category,paid:0});return {type:'equipment',name,quantity:q}}
function explorationResolve(r){
  const p=ensurePostBattleData(r),e=postBattleExploration(p);if(!e)return;
  const out={gold:0,wyrdstone:0,items:[],fighters:[],notes:[],rolls:[],bonuses:[]};
  const d=()=>explorationRoll(6),dN=n=>explorationDice(n).sum,addG=n=>{out.gold+=Math.round(n)},addW=n=>{out.wyrdstone+=Math.round(n)},item=(name,q=1)=>{const warrior=explorationWarriorDefinition(r,name);if(warrior)out.fighters.push({name,quantity:q});else out.items.push({name,quantity:q})};
  const d3=()=>explorationRoll(3),traits=explorationWarbandTraits(r),isU=traits.undead,hero=postBattleEligibleHeroes(r)[0];
  const addBonus=(id,label,icon,description)=>out.bonuses.push({id,label,icon,description});
  if(e.tier==='doubles'){
    if(e.face===1){if(!hero){out.notes.push('Aucun Hero survivant disponible pour tester le puits.');return out}const roll=d(),t=Array.isArray(hero.profile)?Number(hero.profile[4]||0):3;out.rolls.push(`Puits : ${roll} contre T ${t}`);if(roll<=t)addW(1);else out.notes.push(`${hero.name} boit une eau souillée et doit manquer la prochaine partie.`)}
    if(e.face===2){const roll=d();addG(roll*5);out.rolls.push(`Boutique : ${roll}`);if(roll===1)item('Lucky Charm')}
    if(e.face===3){item('Dagger');const roll=d();out.rolls.push(`Cadavre : ${roll}`);const m={1:null,2:'Club',3:'Axe',4:'Spear',5:'Sword',6:'Light armour'};if(roll===1)addG(d()*5);else item(m[roll])}
    if(e.face===4){if(isU){out.notes.push('Le straggler peut être ajouté comme Skeleton Warrior ou Zombie Warrior.');}else if(explorationIsSkaven(r)||explorationIsOrc(r)){addG(d()*5)}else if(explorationIsPossessed(r)){out.notes.push('Le Leader gagne +1D3 Experience.')}else{addBonus('exploration_extra_die','Insight du Straggler','☼','Lors de la prochaine Exploration : lancez un dé de plus que normalement autorisé, puis défaussez un dé au choix.')}}
    if(e.face===5){const roll=d();out.rolls.push(`Chariot : ${roll}`);if(roll<=2)item('Mordheim Map');else if(roll<=4)addG(dN(2)*5);else{item('Jewelled Sword');item('Jewelled Dagger')}}
    if(e.face===6)addG(d()*5)
  } else if(e.tier==='triples'){
    if(e.face===1){const leader=(r.fighters||[]).find(x=>x.type==='Leader'&&!fighterStatus(x).dead&&!fighterStatus(x).captured);const ld=Array.isArray(leader?.profile)?Number(leader.profile[8]||7):7;const roll=d();out.rolls.push(`Taverne : ${roll} contre LD ${ld}`);addG((roll<=Math.min(6,ld)?dN(4):d())*5)}
    if(e.face===2){const roll=d();out.rolls.push(`Forge : ${roll}`);const m={1:'Sword',2:'Bastard Sword',3:'Morning Star',4:'Halberd',5:'Great Axe'};if(m[roll])item(m[roll]);else addG(dN(2)*5)}
    if(e.face===3){if(explorationIsPossessed(r))out.notes.push('Les prisonniers rapportent 2D3 Experience réparties entre les Heroes.');else if(isU){out.notes.push('Les prisonniers peuvent être tués pour obtenir un Skeleton Warrior ou un Zombie Warrior gratuit.');}else if(explorationIsSkaven(r)||explorationIsOrc(r))addG(dN(3)*10);else{addG(dN(2)*5);out.notes.push('Un Henchman au choix peut rejoindre la bande sans équipement.')}}
    if(e.face===4){const roll=d();out.rolls.push(`Fléchier : ${roll}`);if(roll===1)item('Bow',d3());if(roll===2)item('Long bow',d3());if(roll===3)item('Quiver Of Bodkin Arrows');if(roll===4)item('Quiver Of Hunting Arrows');if(roll===5)item('Crossbow',d3());if(roll===6)item('Heavy Crossbow')}
    if(e.face===5)addG(dN(2)*10)
    if(e.face===6)out.notes.push('Un Hired Sword disponible peut rejoindre la bande gratuitement pour la prochaine bataille. Après la bataille, il partira ou pourra être payé normalement.')
  } else if(e.tier==='four'){
    if(e.face===1){const roll=d();out.rolls.push(`Gunsmith : ${roll}`);if(roll===1)item('Blunderbuss');if(roll===2)item('Brace Of Pistols (Pair)');if(roll===3)item('Brace Of Duelling Pistols (Pair)');if(roll===4)item('Handgun',d3());if(roll===5)item('Flasks Of Superior Blackpowder',d3());if(roll===6)item('Bomb')}
    if(e.face===2){if(traits.witchHunters||traits.sisters){addG(dN(2)*5);out.notes.push('Une arme choisie peut gagner le trait Blessed.')}else addG(dN(3)*5)}
    if(e.face===3)addG(dN(3)*5)
    if(e.face===4){const roll=d();out.rolls.push(`Armurier : ${roll}`);if(roll===1)item('Shield',d3());if(roll===2)item('Buckler',d3());if(roll===3)item('Light Armour',d3());if(roll===4)item('Heavy Armour',d3());if(roll===5)item('Full Plate Armour');if(roll===6)item('Ithilmar Armour')}
    if(e.face===5){if(traits.witchHunters||traits.sisters)out.notes.push('Les tombes sont scellées : +D6 Experience réparties entre les Heroes.');else{addG(d()*5);addBonus('graveyard_hatred','Vendetta du cimetière','⚰','La prochaine fois que vous affrontez des Sisters of Sigmar ou des Witch Hunters, toute votre bande est affectée par Hate contre l’ennemi.')}}
    if(e.face===6){addBonus('catacomb_infiltration','Passages des catacombes','⚔','Lors de votre prochaine bataille, jusqu’à trois guerriers (hors Large Target) peuvent être placés au niveau du sol à la fin du premier tour, à plus de 8 pouces de tout ennemi.')}
  } else if(e.tier==='five'){
    if(e.face===1)addG(d()*50)
    if(e.face===2){addG(dN(3)*5);item('Alchemist’s Notebook')}
    if(e.face===3){const roll=d();out.rolls.push(`Gem Cutter : ${roll}`);if(roll===1)addG(dN(2)*5);if(roll===2)addG(d3()*25);if(roll===3)addG(d()*25);if(roll===4)addG(100);if(roll===5)addG(250);if(roll===6)addG(d()*50);out.notes.push('Si les gemmes ne sont pas vendues, un Hero peut les conserver et gagner Opulent Jewellery.')}
    if(e.face===4){const roll1=d(),roll2=d();out.rolls.push(`Merchant’s House : ${roll1}, ${roll2}`);if(roll1===roll2){item('Symbol of the Order of Freetraders');out.notes.push('Un Hero en possession du symbole gagne la compétence Haggle.')}else addG((roll1+roll2)*25)}
    if(e.face===5){
      addW(d3());
      if(traits.human){
        const leader=(r.fighters||[]).find(x=>x.type==='Leader'&&!fighterStatus(x).dead&&!fighterStatus(x).captured);
        const ld=Array.isArray(leader?.profile)?Number(leader.profile[8]||7):7;
        const roll=d();out.rolls.push(`Shattered Building · Leadership : ${roll} contre LD ${ld}`);
        if(roll<=Math.min(6,ld))out.fighters.push({name:'Wardog',quantity:1});
        else out.notes.push('Le test de Leadership échoue : le Wardog ne rejoint pas la bande.');
      }else out.notes.push('Le Wardog ne peut rejoindre la bande que si elle est humaine.');
    }
    if(e.face===6)addBonus('catacomb_reroll','Entrée des catacombes','☠','Une fois par future Exploration, vous pouvez relancer un dé sur le tableau d’Exploration. Les entrées supplémentaires de catacombes ne donnent pas de relance supplémentaire.')
  } else {
    if(e.face===1){if(!hero){out.notes.push('Aucun Hero disponible pour le Puits.');return out}const roll=d();out.rolls.push(`Puits : ${roll}`);if(roll===1)out.notes.push(`${hero.name} est dévoré et ne reviendra jamais.`);else addW(d()+1)}
    if(e.face===2){addG(dN(5)*20);for(const [name,need] of [['D3 Pieces of wyrdstone',4],['D3 Gems worth 25 gc each',4],['Sacred Relic',5],['Full Plate Armour',5],['Elven Cloak',5],['Holy tome',5],['Magical artefact',5]]){const roll=d();out.rolls.push(`${name} : ${roll}+`);if(roll>=need){if(name.startsWith('D3 Pieces'))addW(d3());else if(name.startsWith('D3 Gems'))addG(d3()*25);else item(name)}}}
    if(e.face===3){const roll=d();out.rolls.push(`Dwarf Smithy : ${roll}`);if(roll===1)item('Dwarf Handgun');if(roll===2)item('Great Hammer',d3());if(roll===3)item('Heavy Armour',d3());if(roll===4)item('Gromril Axe');if(roll===5)item('Gromril Great Axe');if(roll===6)item('Gromril Plate Armour')}
    if(e.face===4){addG(dN(3)*25);item('Dagger',d3());for(const [name,need] of [['Shield',2],['Sword',3],['Axe',3],['Bow',4],['Light Armour',4],['Mordheim Map',4],['Halberd',5],['Heavy Armour',5]]){const roll=d();out.rolls.push(`${name} : ${roll}+`);if(roll>=need)item(name,d3())}}
    if(e.face===5){item('Training Manual');out.notes.push('Le Training Manual peut être vendu 100 GC ou lu par un Hero : Combat devient un Primary Skill set et le WS augmente de +1, même au-dessus du maximum normal.')}
    if(e.face===6){const roll=d();out.rolls.push(`Villa : ${roll}`);if(roll<=2)addG(d()*50);else if(roll<=4)item('Crimson Shade',2*d3());else item('Magical artefact')}
  }
  return out;
}
function setStragglerChoice(choice){const r=activeRoster();if(!r)return;const p=ensurePostBattleData(r);p.exploration.stragglerChoice=choice;save(true);render('builder')}
function applyExplorationReward(){
  const r=activeRoster();if(!r)return;
  const p=ensurePostBattleData(r),e=postBattleExploration(p);if(!e)return;
  const needsUndeadChoice=(e.tier==='doubles'&&e.face===4||e.tier==='triples'&&e.face===3)&&explorationIsUndead(r);
  if(needsUndeadChoice&&!p.exploration.stragglerChoice){toast('Choisis Skeleton ou Zombie');return}
  const out=explorationResolve(r);if(!out)return;
  if(e.tier==='doubles'&&e.face===4&&explorationIsUndead(r))out.fighters.push({name:p.exploration.stragglerChoice==='zombie'?'Zombie Warrior':'Skeleton Warrior',quantity:1});
  if(e.tier==='triples'&&e.face===3&&explorationIsUndead(r))out.fighters.push({name:p.exploration.stragglerChoice==='zombie'?'Zombie Warrior':'Skeleton Warrior',quantity:1});
  out.gold=Number(out.gold||0);out.wyrdstone=Number(out.wyrdstone||0);
  addExplorationGold(r,out.gold);addExplorationWyrdstone(r,out.wyrdstone);
  const addedFighters=[];out.fighters.forEach(x=>{const n=recruitFreeExplorationWarrior(r,x.name,x.quantity,true);if(n)addedFighters.push({name:x.name,quantity:n})});
  const addedItems=[];out.items.forEach(x=>{const result=addExplorationStash(r,x.name,x.quantity);if(result?.type==='fighter')addedFighters.push(result);else addedItems.push(x)});
  (out.bonuses||[]).forEach(b=>addExplorationBonus(r,b.id,b.label,b.icon,b.description));
  const snapshot={id:crypto.randomUUID(),resolvedAt:new Date().toISOString(),location:e.result.name,rolls:out.rolls,gold:out.gold,wyrdstone:out.wyrdstone,rewards:addedItems,fighters:addedFighters,notes:out.notes,bonuses:out.bonuses||[],stragglerChoice:p.exploration.stragglerChoice||null};
  // Keep a lightweight history for data continuity, but do not display/count resolutions in the UI.
  p.exploration.history=Array.isArray(p.exploration.history)?p.exploration.history:[];
  p.exploration.history.push(snapshot);
  p.exploration={...p.exploration,...snapshot,resolved:true,history:p.exploration.history,stragglerChoice:p.exploration.stragglerChoice||null};
  save(true);render('builder');
  toast('✓ Résolution appliquée',3000)
}
function clearExplorationReward(){const r=activeRoster();if(!r)return;const p=ensurePostBattleData(r),e=p.exploration||{};r.gold=Math.max(0,Number(r.gold||0)-Number(e.gold||0));r.wyrdstone=Math.max(0,Number(r.wyrdstone||0)-Number(e.wyrdstone||0));(e.rewards||[]).forEach(x=>{const hit=(r.reserve||[]).find(q=>q.name===x.name&&q.explorationReward);if(hit){hit.quantity=Math.max(0,Number(hit.quantity||1)-Number(x.quantity||1));if(hit.quantity===0)r.reserve.splice(r.reserve.indexOf(hit),1)}});(e.bonuses||[]).forEach(b=>{const stillUsed=(r.postBattle?.explorationBonuses||[]).some(q=>q.id===b.id);if(stillUsed)removeExplorationBonus(b.id)});p.exploration={resolved:false,rewards:[],notes:[],rolls:[],bonuses:[],stragglerChoice:null};save(true);render('builder')}
function cashPostBattleWyrdstone(){const r=activeRoster();if(!r)return;const p=ensurePostBattleData(r),dice=postBattleSelectedDice(p),sum=dice.reduce((a,b)=>a+b,0),shards=dice.length?postBattleShards(sum):0;if(!shards){toast('Aucun résultat de wyrdstone à mettre en réserve');return}r.wyrdstone=Math.max(0,Number(r.wyrdstone||0)+shards);p.shards=shards;p.shardsCashed=false;p.soldShards=Math.min(Number(p.soldShards||0),r.wyrdstone);p.incomeApplied=false;save(true);render('builder');toast(`+${shards} wyrdstone ajouté à la réserve`)}
function sellPostBattleWyrdstone(){const r=activeRoster();if(!r)return;const p=ensurePostBattleData(r),sold=Math.max(0,Math.min(Math.floor(Number(p.soldShards||0)),Number(r.wyrdstone||0)));if(!sold){toast('Indique au moins 1 shard à vendre');return}const income=postBattleIncomeMatrix(Math.max(1,r.fighters.length),sold).value;r.wyrdstone-=sold;r.gold+=income;p.income=income;p.incomeApplied=true;p.soldShards=sold;save(true);render('builder');toast(`Vente : ${sold} shard${sold!==1?'s':''} · +${income} GC`)}
function postBattleIncomeView(r,f){const p=ensurePostBattleData(r),dice=postBattleDieRows(),selected=postBattleSelectedDice(p),sum=selected.reduce((a,b)=>a+b,0),shards=selected.length?postBattleShards(sum):0,warriors=Math.max(1,r.fighters.length),available=Number(r.wyrdstone||0),sold=Math.min(Number(p.soldShards||0),available),income=sold>0?postBattleIncomeMatrix(warriors,sold):null,exploration=postBattleExploration(p),allRolls=dice.filter(d=>Number.isInteger(Number(d.value))).map(d=>Number(d.value)),selectedCount=dice.filter(d=>d.selected).length,heroes=postBattleEligibleHeroes(r),stragglerChoice=p.exploration?.stragglerChoice||'',bonuses=explorationBonusList(r);return `<div class="postbattle-shell"><div class="postbattle-toolbar"><div><div class="eyebrow">POST-BATTLE / STEP 3 · P.133–139</div><h3>Income & Exploration</h3><p>Un dé pour chaque Hero validé comme survivant, +1 dé en cas de victoire, puis les dés supplémentaires autorisés. Six dés maximum sont retenus.</p></div><button type="button" class="button danger-outline" onclick="resetPostBattle()">Réinitialiser</button></div><div class="postbattle-grid"><section class="sheet-block postbattle-panel"><div class="sheet-block-head prominent-section"><div><h4>1. Dés d’Exploration</h4><small>Coche précisément les Heroes qui ont survécu à la bataille. Les Henchmen ne lancent pas de dé.</small></div><span class="postbattle-counter">${selectedCount}/6 retenus</span></div><div class="postbattle-income-layout"><div class="postbattle-heroes-column"><div class="postbattle-hero-validation"><span class="postbattle-field-title">Heroes ayant survécu</span>${heroes.length?heroes.map(x=>{const checked=p.survivingHeroIds.includes(x.instance);return `<label class="postbattle-hero-check"><input type="checkbox" ${checked?'checked':''} onchange="togglePostBattleHero('${x.instance}',this.checked)"><span><b>${esc(x.name)}</b><small>${esc(x.type||'Hero')}</small></span><em>✓</em></label>`}).join(''):'<div class="empty compact">Aucun Hero éligible dans la bande.</div>'}<small class="postbattle-help">${p.heroCount} Hero${p.heroCount!==1?'s':''} validé${p.heroCount!==1?'s':''} → ${p.heroCount} dé${p.heroCount!==1?'s':''}.</small></div></div><div class="postbattle-roll-column"><div class="postbattle-dice-head"><span>Chaque dé peut être lancé ou saisi manuellement.</span></div><div class="postbattle-dice-list">${dice.length?dice.map((d,i)=>`<div class="postbattle-die ${d.selected?'selected':''} ${d.value?'rolled':''}"><button type="button" class="postbattle-select" title="${d.selected?'Retirer des 6 dés retenus':'Retenir ce dé'}" onclick="togglePostBattleDie(${i})">${d.selected?'✓':'○'}</button><span class="postbattle-die-source">${esc(d.source||'Dé')}</span><input class="postbattle-die-input" type="number" min="1" max="6" placeholder="–" value="${d.value??''}" onchange="editPostBattleDie(${i},this.value)"><button type="button" class="button secondary small" onclick="rollPostBattleDie(${i})">🎲 ${d.value?'Relancer':'Lancer'}</button></div>`).join(''):'<div class="empty compact">Coche au moins un Hero survivant pour générer les dés.</div>'}</div></div><div class="postbattle-bonus-controls"><label class="postbattle-check"><input type="checkbox" ${p.winner?'checked':''} onchange="setPostBattleWinner(this.checked)"><span>Victoire de la dernière bataille <b>+1 dé</b></span></label><label><span>Dés supplémentaires</span><input type="number" min="0" max="20" value="${p.extraDice}" onchange="setPostBattleNumber('extraDice',this.value)"><small>Compétences, équipement ou autre bonus autorisé</small></label></div></div><div class="postbattle-summary"><div><span>Dés générés</span><strong>${dice.length}</strong></div><div><span>Dés renseignés</span><strong>${allRolls.length}</strong></div><div><span>Dés retenus</span><strong>${selected.length}</strong></div><div><span>Total</span><strong>${selected.length?sum:'—'}</strong></div><div><span>Shards trouvés</span><strong>${selected.length?shards:'—'}</strong></div></div></section><section class="sheet-block postbattle-panel"><div class="sheet-block-head prominent-section"><div><h4>2. Exploration</h4><small>Le multiple le plus nombreux prime ; à égalité, le résultat le plus élevé est retenu.</small></div></div>${exploration?`<div class="exploration-result"><div class="exploration-badge">${exploration.count===2?'DOUBLE':exploration.count===3?'TRIPLE':exploration.count===4?'QUATRE':exploration.count===5?'CINQ':'SIX'} · ${exploration.face}</div><h3>${esc(exploration.result.name)}</h3><p class="exploration-lore"><em>${esc(EXPLORATION_LORE[exploration.tier][exploration.face])}</em></p><div class="exploration-effect"><strong>Règles / résolution</strong><p>${esc(exploration.result.text)}</p></div>${exploration.tier==='doubles'&&exploration.face===4&&explorationIsUndead(r)?`<div class="exploration-choice"><strong>Straggler — choix de la bande Undead</strong><div><button class="button secondary ${stragglerChoice==='skeleton'?'active':''}" onclick="setStragglerChoice('skeleton')">☠ Skeleton Warrior</button><button class="button secondary ${stragglerChoice==='zombie'?'active':''}" onclick="setStragglerChoice('zombie')">🧟 Zombie Warrior</button></div></div>`:''}${exploration.tier==='triples'&&exploration.face===3&&explorationIsUndead(r)?`<div class="exploration-choice"><strong>Prisonniers — choix de la bande Undead</strong><div><button class="button secondary ${stragglerChoice==='skeleton'?'active':''}" onclick="setStragglerChoice('skeleton')">☠ Skeleton Warrior</button><button class="button secondary ${stragglerChoice==='zombie'?'active':''}" onclick="setStragglerChoice('zombie')">🧟 Zombie Warrior</button></div></div>`:''}<button type="button" class="button primary" onclick="applyExplorationReward()">🎲 Résoudre automatiquement les récompenses de ${esc(exploration.result.name)}</button><small class="exploration-repeat-help">Cette résolution reste disponible : tu peux relancer les récompenses ou choisir une nouvelle option sans annuler la précédente.</small></div>`:'<div class="empty compact"><strong>Aucun lieu inhabituel détecté.</strong><span>Renseigne au moins deux dés identiques pour afficher l’entrée correspondante.</span></div>'}${selected.length?`<div class="shard-result"><span>Résultat de la table p.133</span><strong>${shards} shard${shards!==1?'s':''} de wyrdstone</strong><button type="button" class="button primary small" onclick="cashPostBattleWyrdstone()">＋ Mettre ces wyrdstone en réserve</button><small>Ajoute ce résultat à la réserve Wyrdstone de la bande. Tu peux recliquer pour ajouter à nouveau la pool.</small></div>`:''}${bonuses.length?`<div class="exploration-bonus-strip"><div class="exploration-bonus-title"><span>EFFETS D’EXPLORATION DÉBLOQUÉS</span><small>Ces effets restent liés à la bande jusqu’à leur suppression.</small></div>${bonuses.map(b=>`<div class="exploration-bonus"><span class="exploration-bonus-icon">${b.icon}</span><div><strong>${esc(b.label)}</strong><small>${esc(b.description)}</small></div><button type="button" class="equipment-action remove" title="Supprimer ce bonus" onclick="removeExplorationBonus('${b.id}')">🗑</button></div>`).join('')}</div>`:''}</section></div><section class="sheet-block postbattle-panel"><div class="sheet-block-head prominent-section"><div><h4>3. Vente de wyrdstone</h4><small>Le tableau utilise le nombre de guerriers et le nombre de shards vendus.</small></div><span class="postbattle-counter">${available} shard${available!==1?'s':''} disponibles</span></div><div class="postbattle-controls income-controls"><div class="postbattle-readonly"><span>Guerriers dans la bande</span><strong>${warriors}</strong><small>Calculé automatiquement depuis le roster.</small></div><label><span>Shards vendus</span><input type="number" min="0" max="${available}" value="${sold}" onchange="setPostBattleNumber('soldShards',this.value)" ${available?'':'disabled'}><small>La vente utilise le Wyrdstone actuellement en réserve.</small></label><div class="income-total"><span>Profit calculé</span><strong>${income?income.value:0} GC</strong></div></div><div class="income-apply-row"><button type="button" class="button primary" onclick="sellPostBattleWyrdstone()" ${sold>0&&!p.incomeApplied?'':'disabled'}>${p.incomeApplied?'✓ Vente appliquée':'💰 Vendre les shards sélectionnés'}</button><span>${p.incomeApplied?`Dernière vente : ${p.soldShards} shard${p.soldShards!==1?'s':''} · +${p.income} GC.`:'Le montant sera retiré de la réserve Wyrdstone et ajouté au Trésor.'}</span></div><div class="income-table-wrap"><table class="postbattle-income-table"><thead><tr><th>Guerriers</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8+</th></tr></thead><tbody>${[['1–3',45,60,75,90,110,120,145,155],['4–6',40,55,70,80,100,110,130,140],['7–9',35,50,65,70,90,100,120,130],['10–12',30,45,60,65,80,90,110,120],['13–15',30,40,55,60,70,80,100,110],['16+',25,35,50,55,65,70,90,100]].map((row,i)=>`<tr class="${warriors>=1&&((i===0&&warriors<=3)||(i===1&&warriors>=4&&warriors<=6)||(i===2&&warriors>=7&&warriors<=9)||(i===3&&warriors>=10&&warriors<=12)||(i===4&&warriors>=13&&warriors<=15)||(i===5&&warriors>=16))?'current':''}">${row.map((v,j)=>j===0?`<th>${v}</th>`:`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section></div>`}
function postBattleActionsView(r,f){const action=postBattleSubtab==='trading'?'trading':'none';return `<div class="postbattle-shell"><section class="sheet-block postbattle-panel"><div class="sheet-block-head prominent-section"><div><h4>Post-battle action</h4><small>Chaque Leader ou Champion peut effectuer une action, sauf s’il est en Recovery ou Captured.</small></div></div><details class="postbattle-action-details" ${action==='trading'?'open':''}><summary>Visit the Trading Post</summary><div class="postbattle-placeholder"><strong>Visit the Trading Post</strong><span>Le module Trading Post sera implémenté dans une prochaine étape.</span><button type="button" class="button secondary" onclick="postBattleSubtab='none';render('builder')">Fermer</button></div></details></section></div>`}
function postBattleView(r,f){ensurePostBattleData(r);return `<div class="postbattle-accordion"><details class="postbattle-step" open><summary><span><b>STEP 3</b> Income / Exploration <small>P.133–139 · dés, wyrdstone et exploration</small></span><i>⌄</i></summary><div class="postbattle-step-body">${postBattleIncomeView(r,f)}</div></details><details class="postbattle-step"><summary><span><b>STEP 4</b> Post-battle action <small>Actions des Leaders et Champions</small></span><i>⌄</i></summary><div class="postbattle-step-body">${postBattleActionsView(r,f)}</div></details></div>`}
function reserveView(r,f){const reserve=Array.isArray(r.reserve)?r.reserve:[];const total=reserve.reduce((n,e)=>n+Number(e.value??e.price??0),0);return `<div class="roster-toolbar"><div><div class="eyebrow">RESERVE / ÉQUIPEMENT STOCKÉ</div><h3>Réserve de la bande</h3><p>Équipement acheté ou récupéré, non attribué à un combattant. La valeur reste comptée dans la valeur de bande.</p></div>${reserve.length?`<span class="reserve-summary-badge">${reserve.length} objet${reserve.length!==1?'s':''} · <span class="v">${total} GC</span></span>`:''}</div>${reserve.length?`<div class="reserve-list">${reserve.map((e,i)=>reserveItemRow(e,i)).join('')}</div>`:`<div class="empty large"><strong>Réserve vide.</strong><span>Utilise le petit bouton ▣ sur l'équipement d'un combattant pour placer un objet ici.</span></div>`}`}
function reserveItemRow(e,i){return `<div class="reserve-row"><div class="reserve-item-main"><div><strong>${refLink('equipment',e.name)}</strong><small>${esc(e.category||'Équipement')}</small></div><strong>${Number(e.value??e.price??0)} GC</strong></div><div class="reserve-actions"><button type="button" class="equipment-action reserve-action-labeled" title="Transférer à un combattant" aria-label="Transférer ${esc(e.name)}" onclick="transferReserveEquipment(${i})">⇄ Transférer</button><button type="button" class="equipment-action sell reserve-action-labeled" title="Vendre" aria-label="Vendre ${esc(e.name)}" onclick="sellReserveEquipment(${i})">⤓ Vendre</button><button type="button" class="equipment-action remove" title="Supprimer" aria-label="Supprimer ${esc(e.name)}" onclick="removeReserveEquipment(${i})">🗑</button></div></div>`}
function rosterView(r,f){return `<div class="roster-toolbar"><div><div class="eyebrow">ACTIVE ROSTER</div><h3>Guerriers de la bande</h3><p>Clique sur un combattant pour ouvrir sa fiche complète. Les modifications sont enregistrées automatiquement. Glisse les cartes pour définir leur ordre.</p></div><div class="roster-toolbar-actions">${r.fighters.length>1?`<select class="roster-jump-select" aria-label="Aller à un combattant" onchange="jumpToFighterCard(this.value);this.value=''"><option value="">↕ Aller à…</option>${r.fighters.map((x,i)=>`<option value="${i}">${esc(x.name)}</option>`).join('')}</select>`:''}<button class="button primary" onclick="setGangTab('recruit')">＋ Recruter</button></div></div>${r.fighters.length?`<div class="roster-section roster-section-all"><div class="section-label">GUERRIERS <span>${r.fighters.length}</span></div><div class="fighter-list">${r.fighters.map((x,i)=>ownedFighterCard(x,i,f)).join('')}</div></div>`:'<div class="empty large"><strong>Ta bande est vide.</strong><span>Utilise l’onglet Recrutement pour choisir tes premiers combattants.</span><button class="button primary" onclick="setGangTab(\'recruit\')">Ouvrir le recrutement</button></div>'}`}
function jumpToFighterCard(i){if(i===''||i==null)return;const el=document.querySelector(`.fighter-list [data-fighter-index="${CSS.escape(String(i))}"]`);if(!el)return;el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('fighter-card-jump-highlight');setTimeout(()=>el.classList.remove('fighter-card-jump-highlight'),1400)}
function championLimitForRoster(r){return 2+Math.floor(Math.max(0,Number(r?.reputation||0))/10)}
function compositionCounts(r){const fighters=Array.isArray(r?.fighters)?r.fighters:[];return {champions:fighters.filter(x=>advancementRole(x)==='Champion'||x.type==='Champion').length,henchmen:fighters.filter(x=>fighterSourceType(x)==='Henchman'||x.type==='Henchman').length,other:fighters.filter(x=>{const role=advancementRole(x);return role!=='Henchman'&&role!=='Champion'&&x.type!=='Henchman'&&x.type!=='Champion'}).length};}
function recruitmentRestriction(r,w){if(!r||!w)return null;const counts=compositionCounts(r);const role=w.type==='Raw Recruit'?'Juves':w.type;const limit=championLimitForRoster(r);if(role==='Champion'&&counts.champions>=limit)return `Limite de Champions atteinte : ${counts.champions}/${limit} (Réputation ${Number(r.reputation||0)})`;if(role!=='Henchman'&&role!=='Champion'&&counts.henchmen<counts.other+1&&r.fighters.length>0)return `Il faut au moins autant de Henchmen que d'autres guerriers (${counts.henchmen} Henchmen / ${counts.other} autres)`;if(role==='Champion'&&counts.henchmen<counts.other+1&&r.fighters.length>0)return `Il faut au moins autant de Henchmen que d'autres guerriers (${counts.henchmen} Henchmen / ${counts.other} autres)`;return null;}
function recruitmentCompositionNotice(r){const c=compositionCounts(r),limit=championLimitForRoster(r),valid=c.henchmen>=c.other;return `<div class="recruit-composition-notice ${valid?'valid':'warning'}"><div><strong>COMPOSITION · RÉPUTATION ${Number(r.reputation||0)}</strong><small>Champions : ${c.champions}/${limit} · Henchmen : ${c.henchmen} · Autres : ${c.other}</small></div>${valid?'<span>✓ Composition valide</span>':`<span>⚠ Il manque ${c.other-c.henchmen} Henchman${c.other-c.henchmen>1?'s':''}</span>`}</div>`;}
function logHistory(r,category,text){if(!r)return;if(!Array.isArray(r.history))r.history=[];r.history.unshift({id:crypto.randomUUID(),category,text,ts:Date.now()});if(r.history.length>300)r.history.length=300}
const HISTORY_CATS={recruit:{label:'Recrutement',color:'#7ddd2e'},xp:{label:'XP / Blessures',color:'#e6a8c8'},treasury:{label:'Trésorerie',color:'#f0dc4f'},equipment:{label:'Équipement',color:'#9cc3e0'},settings:{label:'Paramètres',color:'#c9a0f5'}};
let historyFilter='all';
function setHistoryFilter(cat){historyFilter=cat;render('builder')}
function historyDayLabel(ts){const d=new Date(ts),now=new Date();const startOfDay=x=>{const y=new Date(x);y.setHours(0,0,0,0);return y.getTime()};const diffDays=Math.round((startOfDay(now)-startOfDay(d))/86400000);if(diffDays===0)return 'Aujourd’hui';if(diffDays===1)return 'Hier';return d.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}
function historyRelativeTime(ts){const diff=Date.now()-ts,min=Math.floor(diff/60000);if(min<1)return 'à l’instant';if(min<60)return `il y a ${min} min`;return new Date(ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
function historyView(r){
  const all=Array.isArray(r.history)?r.history:[];
  const filtered=historyFilter==='all'?all:all.filter(e=>e.category===historyFilter);
  const chips=`<div class="hist-filters"><span class="hist-chip ${historyFilter==='all'?'active':''}" onclick="setHistoryFilter('all')">Tout</span>${Object.entries(HISTORY_CATS).map(([k,c])=>`<span class="hist-chip ${historyFilter===k?'active':''}" onclick="setHistoryFilter('${k}')"><span class="dot" style="background:${c.color}"></span>${c.label}</span>`).join('')}</div>`;
  if(!filtered.length)return `<div class="roster-toolbar"><div><div class="eyebrow">HISTORIQUE</div><h3>Historique de la bande</h3><p>Journal de toutes les modifications apportées à cette bande — recrutement, trésorerie, équipement, paramètres.</p></div></div>${chips}<div class="empty large"><strong>${all.length?'Aucune entrée pour ce filtre.':'Aucune activité enregistrée pour l’instant.'}</strong><span>${all.length?'Choisis un autre filtre ou reviens sur « Tout ».':'Recrute un combattant ou modifie la bande pour commencer le journal.'}</span></div>`;
  const groups=[];
  filtered.forEach(e=>{const label=historyDayLabel(e.ts);let g=groups.find(x=>x.label===label);if(!g){g={label,items:[]};groups.push(g)}g.items.push(e)});
  const body=groups.map(g=>`<div class="hist-day">${esc(g.label)}</div>${g.items.map(e=>{const cat=HISTORY_CATS[e.category]||{color:'#6f6f6a'};return `<div class="hist-row"><div class="hist-dot" style="background:${cat.color}"></div><div><div class="hist-text">${e.text}</div><div class="hist-meta">${historyRelativeTime(e.ts)}</div></div></div>`}).join('')}`).join('');
  return `<div class="roster-toolbar"><div><div class="eyebrow">HISTORIQUE</div><h3>Historique de la bande</h3><p>Journal de toutes les modifications apportées à cette bande — recrutement, trésorerie, équipement, paramètres.</p></div></div>${chips}<div class="hist-body">${body}</div>`;
}
function campaignView(r){return `<div class="roster-toolbar"><div><div class="eyebrow">CAMPAGNE</div><h3>Campagne</h3><p>Suivi de la bande au sein d’une campagne (classement, territoires, rivalités).</p></div></div><div class="empty large"><strong>Aucune campagne liée à cette bande pour l’instant.</strong><span>La gestion de campagne (classement entre bandes, territoires, rivalités) arrive dans une prochaine mise à jour.</span></div>`}
function recruitmentView(f){const r=activeRoster();return `<div class="recruit-head"><div><div class="eyebrow">RECRUTEMENT / ${esc(f.displayName)}</div><h3>Recruter un combattant</h3><p>Le recrutement ajoute le combattant à la bande sans ouvrir sa fiche. Ouvre ensuite sa carte depuis le roster.</p></div></div>${recruitmentCompositionNotice(r)}<div class="recruit-select-row"><label>Type de combattant<select id="typeFilter" class="select" onchange="filterFighters()"><option value="">Tous les types</option><option>Leader</option><option>Champion</option><option>Raw Recruit</option><option>Henchman</option></select></label><label class="grow">Rechercher<input id="fighterSearch" class="search" placeholder="Nom du profil…" oninput="filterFighters()"></label></div><div class="fighter-pool" id="fighterPool">${fighterPool(f)}</div>`}
function chosenRow(x,i){return `<button class="chosen-v4" onclick="openFighterCard(${i})"><span class="chosen-sigil">${factionSigils[faction(activeRoster()).id]||'◆'}</span><span class="chosen-info"><b>${esc(x.name)}</b><small>${esc(x.type)} · ${fighterValue(x)} GC</small></span><span class="chosen-open">›</span></button>`}
var ARMOUR_SUITS=['Light armour','Light armor','Heavy armour','Heavy armor','Full plate armour','Full plate armor','Gromril plate','Gromril plate armour','Gromril plate armor','Ithilmar','Ithilmar mail','Ithilmar armour','Ithilmar armor','Sigmarite armour','Sigmarite armor','Chaos armour','Chaos armor'];
var FUR_CLOAKS=['Fur cloak','Wolf cloak'];
var OFFHAND_DEFENCE=['Shield','Buckler','Main Gauche','Left hand dagger','Sword breaker'];
function moveStashEquipmentToReserve(i){const r=activeRoster(),x=r?.fighters[editingIndex];if(!r||!x||!fighterUsesLoadouts(x))return;ensureFighterLoadouts(x);const e=x.equipmentStash?.[i];if(!e)return;if(normName(e.name)==='chaos armour'||normName(e.name)==='chaos armor'){toast('L’armure du Chaos est fusionnée au porteur et ne peut pas être mise en réserve.');return}r.reserve=r.reserve||[];r.reserve.push({...JSON.parse(JSON.stringify(e)),reserveId:crypto.randomUUID(),sourceFighter:x.name});x.equipmentStash.splice(i,1);x.equipmentLoadouts.forEach(l=>{l.equipmentIds=(l.equipmentIds||[]).filter(id=>id!==e.stashId);l.equipmentNames=l.equipmentIds.map(id=>x.equipmentStash.find(q=>q.stashId===id)?.name).filter(Boolean)});syncLoadoutProjection(x);syncCustomEquipmentEffects(x);save(true);render('fighter');toast(`${e.name} placé en réserve`)}

function moveEquipmentToReserve(i){const r=activeRoster(),x=r?.fighters[editingIndex],e=x?.equipmentSelected?.[i];if(!r||!x||!e)return;if(normName(e.name)==='chaos armour'||normName(e.name)==='chaos armor'){toast('L’armure du Chaos est fusionnée au porteur et ne peut pas être mise en réserve.');return}r.reserve=r.reserve||[];r.reserve.push({...JSON.parse(JSON.stringify(e)),reserveId:crypto.randomUUID(),sourceFighter:x.name});x.equipmentSelected.splice(i,1);syncCustomEquipmentEffects(x);logHistory(r,'equipment',`<b>${esc(e.name)}</b> transféré vers la <b>Réserve d'équipement</b> depuis <b>${esc(x.name)}</b>`);save(true);equipmentOpen=true;render('fighter');toast(`${e.name} placé en réserve`)}
function transferReserveEquipment(i){const r=activeRoster(),e=r?.reserve?.[i];if(!r||!e)return;const eligible=r.fighters.map((x,idx)=>{const access=warriorBandAllowed(e,x);const check=fighterUsesLoadouts(x)?{ok:true,msg:''}:canEquip(x,e);return {x,idx,ok:check.ok&&access,reason:!access?'Équipement non autorisé pour ce profil':check.msg}}).filter(a=>a.ok);openModal(`<div class="skill-dialog"><div class="eyebrow">RÉSERVE · TRANSFERT</div><h2>${esc(e.name)}</h2><p>Choisis le combattant auquel attribuer cet équipement. Les limites d’armes, l’accès au profil et les règles d’armure sont vérifiés.</p><div class="reserve-transfer-list">${eligible.length?eligible.map(a=>`<button type="button" class="skill-modal-skill" onclick="confirmTransferReserve(${i},${a.idx})"><span>${esc(a.x.name)}</span><small>${esc(a.x.type)} · ${currentWeaponSlots(a.x)}/3</small></button>`).join(''):'<div class="empty compact">Aucun combattant ne peut actuellement équiper cet objet.</div>'}</div><div class="purchase-actions"><button type="button" class="button secondary" onclick="closeModal()">Fermer</button></div></div>`)}
function confirmTransferReserve(ri,fi){const r=activeRoster(),e=r?.reserve?.[ri],x=r?.fighters?.[fi];if(!r||!e||!x)return;const access=warriorBandAllowed(e,x),check=fighterUsesLoadouts(x)?{ok:true,msg:''}:canEquip(x,e);if(!access||!check.ok){toast(!access?'Équipement non autorisé pour ce profil':check.msg);return}const copy={...JSON.parse(JSON.stringify(e)),stashId:crypto.randomUUID(),paid:0};if(fighterUsesLoadouts(x)){ensureFighterLoadouts(x);x.equipmentStash=x.equipmentStash||[];x.equipmentStash.push(copy);syncLoadoutProjection(x);}else{x.equipmentSelected=x.equipmentSelected||[];x.equipmentSelected.push(copy);}syncCustomEquipmentEffects(x);r.reserve.splice(ri,1);logHistory(r,'equipment',`<b>${esc(e.name)}</b> transféré de la <b>Réserve</b> vers <b>${esc(x.name)}</b>`);save(true);closeModal();gangTab='reserve';render('builder');toast(`${e.name} placé dans le coffre de ${x.name}`)}
function sellReserveEquipment(i){const r=activeRoster(),e=r?.reserve?.[i];if(!r||!e)return;const sale=Math.max(0,Math.floor(Number(e.value??e.price??0)/2));openModal(`<div class="sell-dialog"><div class="eyebrow">VENTE DE RÉSERVE</div><h2>Vendre « ${esc(e.name)} » ?</h2><p>La règle de revente du M17 permet de vendre l’équipement pour la moitié de son prix indiqué.</p><label>Or récupéré (GC)<input id="saleGold" type="number" min="0" step="1" value="${sale}"></label><div class="purchase-actions"><button type="button" class="button secondary" onclick="closeModal()">Annuler</button><button type="button" class="button primary" onclick="confirmSellReserveEquipment(${i})">Vendre</button></div></div>`)}
function confirmSellReserveEquipment(i){const r=activeRoster(),e=r?.reserve?.[i];if(!r||!e)return;const gold=Math.max(0,Number($('#saleGold')?.value||0));if(!Number.isFinite(gold)){toast('Montant invalide');return}r.gold+=gold;r.reserve.splice(i,1);logHistory(r,'equipment',`<b>${esc(e.name)}</b> vendu depuis la réserve — <b style="color:#a6ff33">+${gold} GC</b>`);save(true);closeModal();render('builder');toast(`${e.name} vendu · +${gold} GC`)}
function removeReserveEquipment(i){const r=activeRoster(),e=r?.reserve?.[i];if(!r||!e)return;openModal(`<div class="delete-dialog"><div class="eyebrow">SUPPRESSION D’ÉQUIPEMENT</div><h2>Supprimer « ${esc(e.name)} » ?</h2><p>L’objet sera retiré de la réserve sans remboursement.</p><button type="button" class="big-delete" onclick="confirmRemoveReserveEquipment(${i})">SUPPRIMER L’ÉQUIPEMENT</button><button type="button" class="button secondary full" onclick="closeModal()">Annuler</button></div>`)}
function confirmRemoveReserveEquipment(i){const r=activeRoster();if(!r?.reserve?.[i])return;r.reserve.splice(i,1);save(true);closeModal();render('builder')}
function updateFighterStat(i,val){const x=activeRoster()?.fighters[editingIndex];if(!x)return;if(!Array.isArray(x.profile))x.profile=Array.isArray(x.baseProfile)?x.baseProfile.slice():[];let n=Math.round(Number(val));if(!Number.isFinite(n))n=Number(x.profile[i]||0);const max=maxProfileFor(x);n=Math.max(0,n);x.profile[i]=n;save(true);render('fighter')}
function statsTabMarkup(x){const original=Array.isArray(x.baseProfile)?x.baseProfile:(Array.isArray(x.profile)?x.profile:[]);const current=Array.isArray(x.profile)?x.profile:original;return `<section class="sheet-block stats-collapse-block ${statsOpen?'is-open':'is-collapsed'}"><button type="button" class="equipment-collapse-head stats-collapse-head" onclick="toggleStatsPanel()"><span><span class="equipment-collapse-icon">${statsOpen?'−':'＋'}</span><strong>Modifier les caractéristiques</strong></span><span>${statsOpen?'Réduire':'Afficher'} · ${D.profileNames.length} caractéristiques</span></button>${statsOpen?`<div class="stats-collapse-body"><div class="stats-inline-list">${D.profileNames.map((name,i)=>`<div class="stats-inline-row"><span class="stats-inline-name">${esc(name)}</span><span class="stats-inline-original" title="Valeur d'origine">${esc(original[i]??'—')}</span><span class="stats-inline-arrow">→</span><input class="stat-current-inline ${Number(current[i]??original[i]??0)>Number(maxProfileFor(x)?.[i]??Infinity)?'stat-input-overstat':''}" type="number" step="1" value="${esc(current[i]??original[i]??'')}" onchange="updateFighterStat(${i},this.value)" aria-label="${esc(name)} actuelle"><small>origine ${esc(original[i]??'—')}</small></div>`).join('')}</div><p class="stats-inline-help">La valeur de gauche est celle du profil d'origine. Modifie uniquement la valeur actuelle.</p></div>`:''}</section>`}

const ADVANCEMENT_MAIN=[
 {id:'wil-int',xp:3,value:5,label:'Volonté ou Intelligence +1',kind:'stat',stats:[10,11]},
 {id:'ld-cl',xp:4,value:10,label:'Commandement ou Calme +1',kind:'stat',stats:[8,9]},
 {id:'initiative',xp:5,value:10,label:'Initiative +1',kind:'stat',stats:[6]},
 {id:'movement',xp:5,value:10,label:'Mouvement +1',kind:'stat',stats:[0]},
 {id:'ws-bs',xp:6,value:20,label:'Capacité de combat ou Capacité de tir +1',kind:'stat',stats:[1,2]},
 {id:'random-primary',xp:6,value:20,label:'Compétence aléatoire d’un arbre Primary',kind:'skillRandomPrimary'},
 {id:'st-t',xp:8,value:30,label:'Force ou Endurance +1',kind:'stat',stats:[3,4]},
 {id:'pick-primary',xp:9,value:20,label:'Choisir une compétence d’un arbre Primary',kind:'skillPickPrimary'},
 {id:'random-secondary',xp:9,value:35,label:'Compétence aléatoire d’un arbre Secondary',kind:'skillRandomSecondary'},
 {id:'w-a',xp:12,value:45,label:'Blessures ou Attaques +1',kind:'stat',stats:[5,7]},
 {id:'veteran-promote',xp:12,value:40,label:'Veteran uniquement : promouvoir en Champion + compétence Primary aléatoire',kind:'veteranPromote'},
 {id:'random-any',xp:15,value:50,label:'Compétence aléatoire de n’importe quel arbre',kind:'skillRandomAny'}
];
const ADVANCEMENT_HENCHMAN=[
 {roll:'2',xp:6,value:0,label:'Devient Veteran',kind:'henchVeteran'},
 {roll:'3–4',xp:6,value:30,label:'Force +1',kind:'henchStat',stats:[3]},
 {roll:'5–6',xp:6,value:10,label:'Mouvement +1 ou Initiative +1',kind:'henchChoice',stats:[0,6]},
 {roll:'7',xp:6,value:20,label:'Capacité de combat ou Capacité de tir +1',kind:'henchStat',stats:[1,2]},
 {roll:'8–9',xp:6,value:10,label:'Commandement ou Calme +1',kind:'henchStat',stats:[8,9]},
 {roll:'10',xp:6,value:5,label:'Volonté ou Intelligence +1',kind:'henchStat',stats:[10,11]},
 {roll:'11',xp:6,value:45,label:'Attaques +1',kind:'henchStat',stats:[7]},
 {roll:'12',xp:6,value:0,label:'Devient Veteran',kind:'henchVeteran'}
];
const MAX_RACE={
 Beastman:[5,7,6,4,5,3,6,4,9,9,8,8],Dwarf:[4,7,6,4,5,3,5,4,10,10,10,9],Elf:[6,7,7,4,4,3,9,4,10,10,10,10],Ghoul:[5,6,2,4,5,3,6,4,8,7,8,7],Goblin:[5,5,5,4,4,3,6,4,7,7,7,7], 'Grave Guard':[5,5,5,4,4,3,5,3,7,7,7,7],Halfling:[4,5,7,3,3,3,8,4,8,8,10,9],Human:[5,6,6,4,4,3,6,4,9,9,9,9],Ogre:[7,6,5,5,5,5,6,5,9,7,9,6],Orc:[5,6,6,4,5,3,5,4,9,9,9,7], 'Rat Ogre':[7,6,1,6,5,5,7,6,7,7,9,6],Skaven:[6,6,6,4,4,3,7,4,8,7,9,8], Possessed:[6,7,1,6,6,5,6,5,9,9,10,8],'The Possessed':[6,7,1,6,6,5,6,5,9,9,10,8],Troll:[7,3,1,6,5,5,4,6,6,8,8,6],Vampire:[6,8,5,6,6,4,9,5,10,10,10,10]
};
function fighterSourceType(x){
 const r=activeRoster(),f=r&&faction(r),source=x?.customFighterId?customFighterById(x.customFighterId):f?.warriors?.find(w=>w.id===x?.wid||w.name===x?.sourceName||w.name===x?.name);
 return source?.type||null;
}
function advancementRole(x){
 const sourceType=fighterSourceType(x);
 // A source Henchman uses the Henchman table unless it has explicitly
 // been promoted to Veteran. This repairs stale saved types as well.
 if(sourceType==='Henchman') return x.promotedVeteran===true?'Veteran':'Henchman';
 if(x.type==='Henchman') return x.promotedVeteran===true?'Veteran':'Henchman';
 if(x.type==='Raw Recruit')return 'Juves';
 if(x.type==='Veteran'||x.veteran===true)return 'Veteran';
 return x.type
}
function advancementEligible(x){const role=advancementRole(x);return ['Leader','Champion','Juves','Veteran'].includes(role)}
function maxProfileFor(x){
  const r=activeRoster();
  const f=faction(r);
  if(x?.customFighterId){const cw=customFighterById(x.customFighterId);if(cw?.maxMode==='manual'&&Array.isArray(cw.manualMaxProfile))return cw.manualMaxProfile.slice();}
  const source=x?.customFighterId?customFighterById(x.customFighterId):f?.warriors?.find(w=>w.id===x?.wid||w.name===x?.sourceName||w.name===x?.name);
  const base=Array.isArray(x?.baseProfile)&&x.baseProfile.length===P.length?x.baseProfile:(Array.isArray(source?.profile)&&source.profile.length===P.length?source.profile:(Array.isArray(x?.profile)?x.profile:MAX_RACE.Human));
  const max=base.slice();
  const mods=(f?.packRuleModifiers||[]).filter(m=>(!m.target||m.target===source?.name||m.target===source?.id||m.target==='all')&&(!m.targetType||m.targetType==='unit'));
  const defaultBonus=[1,3,3,1,1,2,3,3,2,2,2,2];
  for(let i=0;i<max.length;i++)max[i]=Number(max[i]||0)+defaultBonus[i];
  mods.forEach(m=>{const i=P.indexOf(m.stat);if(i>=0)max[i]=Number(max[i]||0)+Number(m.amount||0);});
  return max;
}
function statUpgradeCount(x,i,id){return (x.advancements||[]).filter(a=>a.kind==='stat'&&a.statIndex===i&&a.sourceId===id).length}
function statUpgradeCost(x,entry,i){return entry.xp}
function statLabel(i){return P_FULL[i]||P[i]||`Caractéristique ${i+1}`}
function availableSkillsByAccess(x,level){const access=skillAccessFor(x),sets=customMergedSkillSets(faction(activeRoster()));return Object.keys(access).filter(k=>access[k]===level).flatMap(k=>(sets[k]||[]).map(skill=>({skill,set:k}))).filter(o=>!(x.skills||[]).includes(o.skill));}
function randomSkillFor(x,levels){const pool=levels.flatMap(l=>availableSkillsByAccess(x,l));return pool.length?pool[Math.floor(Math.random()*pool.length)]:null}
function advancementStatChoices(x,entry){const max=maxProfileFor(x),current=x.profile||[];return entry.stats.filter(i=>Number(current[i])<Number(max[i])).map(i=>`<button type="button" class="adv-choice" onclick="buyStatAdvancement('${entry.id}',${i})"><span>${esc(statLabel(i))}</span><small>${Number(current[i])} → ${Number(current[i])+1} · ${statUpgradeCost(x,entry,i)} XP</small></button>`).join('')}
function advancementRow(x,e){let can=Number(x.xp||0)>=e.xp;let detail='';if(e.kind==='stat'){detail=advancementStatChoices(x,e);can=can&&!!detail}else if(e.kind==='skillPickPrimary'){const n=eligibleSkillTreesForAdvancement(x,['Primary']).reduce((sum,o)=>sum+o.skills.length,0);detail=n?`<button type="button" class="button secondary small" onclick="openAdvancementSkillPicker('${e.id}','Primary')">Choisir</button>`:'<small>Aucune compétence Primary disponible.</small>';can=can&&n>0}else if(e.kind.startsWith('skillRandom')||e.kind==='veteranPromote'){detail=`<button type="button" class="button secondary small" onclick="buyAdvancement('${e.id}')">Acheter</button>`}else if(e.kind==='henchChoice'){detail=`<button type="button" class="button secondary small" onclick="openHenchChoice()">Lancer</button>`}else{detail=`<button type="button" class="button secondary small" onclick="buyAdvancement('${e.id}')">Lancer 2D6</button>`}return `<div class="advancement-row ${can?'available':'locked'}"><div class="advancement-main"><span class="advancement-xp">${e.xp} XP</span><div><strong>${esc(e.label)}</strong><small>+${e.value} GC de valeur</small></div></div><div class="advancement-action">${can?detail:`<small>${Number(x.xp||0)} / ${e.xp} XP</small>`}</div></div>`}
function purchasedAdvancementRow(a,i){return `<div class="purchased-advancement"><div><strong>${esc(a.label)}</strong><small>${a.xp} XP · +${a.value} GC · ${a.detail?esc(a.detail):'acquis'}</small></div><button type="button" class="equipment-action remove" title="Annuler et rembourser" onclick="refundAdvancement(${i})">↩</button></div>`}
function progressionStatsMarkup(x){
 const role=advancementRole(x);
 if(role==='Henchman')return `<div class="advancement-panel"><div class="advancement-intro"><div><strong>Avancement des Henchmen</strong><small>À 6 XP, utilise le tableau p.129. Le jet consomme 6 XP.</small></div><span>${Number(x.xp||0)} XP</span></div><button type="button" class="button primary" ${Number(x.xp||0)<6?'disabled':''} onclick="rollHenchmanAdvancement()">Lancer l’avancement · 6 XP</button></div>`;
 if(!['Leader','Champion','Juves','Veteran'].includes(role))return `<div class="empty compact">Ce type de combattant n’utilise pas le tableau d’avancement des Héros.</div>`;
 const max=maxProfileFor(x);
 return `<div class="advancement-panel"><div class="advancement-intro"><div><strong>Achat de caractéristiques · ${esc(role)}</strong><small>Les caractéristiques sont affichées dans l’ordre du profil. Les coûts de caractéristiques augmentent de +2 à chaque nouvelle augmentation du même type, sauf les Juves.</small></div><span>${Number(x.xp||0)} XP</span></div><div class="advancement-list">${ADVANCEMENT_MAIN.filter(e=>e.kind==='stat').map(e=>advancementRow(x,e)).join('')}</div><div class="max-profile-note">Maximum actuel de référence : ${max.map((v,i)=>`${esc(P_FULL[i])} ${v}`).join(' · ')}</div></div>`;
}
function progressionSkillsMarkup(x){
 const role=advancementRole(x);
 if(!['Leader','Champion','Juves','Veteran'].includes(role))return `<div class="advancement-panel"><div class="advancement-intro"><div><strong>Achat de compétences</strong><small>Les Henchmen utilisent le tableau p.129 et ne disposent pas ici d’un achat de compétence individuel.</small></div><span>${Number(x.xp||0)} XP</span></div><div class="empty compact">Aucun achat de compétence disponible pour ce profil.</div></div>`;
 const skillEntries=ADVANCEMENT_MAIN.filter(e=>e.kind.startsWith('skill')||e.kind==='veteranPromote');
 return `<div class="advancement-panel"><div class="advancement-intro"><div><strong>Achat de compétences · ${esc(role)}</strong><small>Les compétences achetées par advancement sont enregistrées ci-dessous. Les compétences normales restent accessibles gratuitement dans l’onglet Skills.</small></div><span>${Number(x.xp||0)} XP</span></div><div class="advancement-list">${skillEntries.filter(e=>e.kind!=='veteranPromote'||role==='Veteran').map(e=>advancementRow(x,e)).join('')}</div></div>`;
}
function progressionMarkup(x){
 const owned=x.advancements||[];
 const role=advancementRole(x);
 const eligible=['Leader','Champion','Juves','Veteran'].includes(role)||role==='Henchman';
 return `<section class="sheet-block fighter-tab-block progression-block"><div class="sheet-block-head"><div><h4>Progression</h4><small>Les améliorations utilisent l’XP du combattant et augmentent sa valeur sans coût en GC.</small></div><span>${Number(x.xp||0)} XP</span></div>${eligible?`<section class="progression-collapse ${progressionOpen?'is-open':'is-collapsed'}"><button type="button" class="equipment-collapse-head" onclick="toggleProgressionPanel()"><span><span class="equipment-collapse-icon">${progressionOpen?'−':'＋'}</span><strong>Achats d’améliorations</strong></span><span>${progressionOpen?'Réduire':'Ouvrir'} · caractéristiques / skills</span></button>${progressionOpen?`<div class="progression-collapse-body"><div class="progression-subtabs"><button type="button" class="progression-subtab ${progressionSubtab==='stats'?'active':''}" onclick="setProgressionSubtab('stats')">Achat caractéristique</button><button type="button" class="progression-subtab ${progressionSubtab==='skills'?'active':''}" onclick="setProgressionSubtab('skills')">Achat skill</button></div>${progressionSubtab==='stats'?progressionStatsMarkup(x):progressionSkillsMarkup(x)}</div>`:''}</section>`:progressionStatsMarkup(x)}<div class="owned-advancement-list"><div class="subsection-title">Advancements acquis</div>${owned.length?owned.map(purchasedAdvancementRow).join(''):'<small class="muted">Aucun advancement acheté.</small>'}</div></section>`;
}
function spendAdvancement(x,entry,extra={}){if(Number(x.xp||0)<entry.xp){toast('XP insuffisant');return false}x.xp=Number(x.xp||0)-entry.xp;x.advancements=x.advancements||[];x.advancements.push({id:crypto.randomUUID(),sourceId:entry.id,label:entry.label,xp:entry.xp,value:entry.value,...extra});return true}
function buyStatAdvancement(id,i){const x=activeRoster()?.fighters[editingIndex],e=ADVANCEMENT_MAIN.find(a=>a.id===id);if(!x||!e)return;const max=maxProfileFor(x);if(Number(x.profile[i])>=Number(max[i])){toast('Maximum de caractéristique atteint');return}const cost=statUpgradeCost(x,e,i);const entry={...e,xp:cost,label:`${statLabel(i)} +1`};if(Number(x.xp||0)<cost){toast(`XP insuffisant : ${cost} XP requis`);return}x.xp-=cost;x.profile[i]=Number(x.profile[i]||0)+1;x.advancements=x.advancements||[];x.advancements.push({id:crypto.randomUUID(),sourceId:e.id,kind:'stat',statIndex:i,label:entry.label,xp:cost,value:e.value});save(true);render('fighter');toast(`${entry.label} acheté`)}
function buySkillAdvancement(x,e,skill,detail){if(!skill){toast('Aucune compétence disponible');return false}if(!spendAdvancement(x,e,{kind:'skill',skill,detail}))return false;x.skills=x.skills||[];x.skills.push(skill);return true}
function buyAdvancement(id){const x=activeRoster()?.fighters[editingIndex],e=ADVANCEMENT_MAIN.find(a=>a.id===id);if(!x||!e)return;if(e.kind==='stat'){return}if(e.kind==='skillPickPrimary'){openAdvancementSkillPicker(id,'Primary');return}if(e.kind==='skillRandomPrimary'){openRandomSkillTreePicker(id,['Primary']);return}if(e.kind==='skillRandomSecondary'){openRandomSkillTreePicker(id,['Secondary']);return}if(e.kind==='skillRandomAny'){openRandomSkillTreePicker(id,['Primary','Secondary']);return}if(e.kind==='veteranPromote'){if(!x.veteran){toast('Cet advancement est réservé aux Veterans');return}openRandomSkillTreePicker(id,['Primary']);return}}
function eligibleSkillTreesForAdvancement(x,levels){
 const access=skillAccessFor(x),ownedSkills=new Set(x.skills||[]),ownedSpells=new Set(x.spells||[]),trees=[];
 Object.keys(access).filter(set=>levels.includes(access[set])&&Array.isArray(D.skillSets?.[set])).forEach(set=>{
  const skills=(D.skillSets[set]||[]).filter(skill=>!ownedSkills.has(skill));
  if(skills.length)trees.push({set,level:access[set],skills,kind:'skill'});
 });
 if(levels.includes('Primary')) magicAccessFor(x).forEach(domain=>{
  const skills=(MAGIC_DOMAINS[domain]||[]).filter(spell=>!ownedSpells.has(spell));
  if(skills.length)trees.push({set:domain,level:'Primary',skills,kind:'magic'});
 });
 return trees;
}
function openRandomSkillTreePicker(id,levels){
 const x=activeRoster()?.fighters[editingIndex],e=ADVANCEMENT_MAIN.find(a=>a.id===id);if(!x||!e)return;
 const trees=eligibleSkillTreesForAdvancement(x,levels);
 openModal(`<div class="skill-dialog"><div class="eyebrow">ADVANCEMENT · ${e.xp} XP</div><h2>1. Choisir l’arbre</h2><p>${esc(e.label)}. Choisis d’abord un arbre auquel ce combattant a accès. Ensuite, tu verras les compétences disponibles dans cet arbre avant de lancer le tirage aléatoire.</p><div class="skill-modal-grid">${trees.length?trees.map(o=>`<button type="button" class="skill-modal-category" onclick="showRandomSkillTree('${e.id}','${encodeURIComponent(o.set)}','${o.kind}')"><span>${esc(o.set)}</span><small>${esc(o.level)} · ${o.skills.length} disponible${o.skills.length>1?'s':''}</small></button>`).join(''):'<div class="empty compact">Aucun arbre autorisé ne contient encore de compétence disponible.</div>'}</div><div class="purchase-actions"><button type="button" class="button secondary" onclick="closeModal()">Annuler</button></div></div>`);
}
function showRandomSkillTree(id,encodedSet,kind){
 const x=activeRoster()?.fighters[editingIndex],e=ADVANCEMENT_MAIN.find(a=>a.id===id),set=decodeURIComponent(encodedSet);if(!x||!e)return;
 const tree=eligibleSkillTreesForAdvancement(x,e.kind==='skillRandomSecondary'?['Secondary']:e.kind==='skillRandomPrimary'||e.kind==='veteranPromote'?['Primary']:['Primary','Secondary']).find(o=>o.set===set&&o.kind===kind);
 if(!tree){toast('Cet arbre n’est pas autorisé ou ne contient plus de compétence disponible');return}
 openModal(`<div class="skill-dialog"><div class="eyebrow">ADVANCEMENT · ${e.xp} XP</div><h2>2. ${esc(set)}</h2><p>${esc(tree.level)} · Voici les compétences encore disponibles dans cet arbre. Le choix reste aléatoire : le bouton ci-dessous tire une seule compétence parmi cette liste.</p><div class="skill-modal-list">${orderedChoiceNames(tree.skills, kind==='magic'?MAGIC_DOMAINS[set]:D.skillSets[set]).map(skill=>`<div class="skill-modal-skill"><span>${esc(numberedSkillName(skill, kind==='magic'?MAGIC_DOMAINS[set]:D.skillSets[set]))}${refInfo(kind==='magic'?'spells':'skills',skill)}</span><small>${kind==='magic'?'Sort disponible':'Compétence disponible'}</small></div>`).join('')}</div><div class="purchase-actions"><button type="button" class="button primary" onclick="rollRandomSkillFromTree('${e.id}','${encodeURIComponent(set)}','${kind}')">🎲 Tirer une compétence aléatoire</button><button type="button" class="button secondary" onclick="openRandomSkillTreePicker('${e.id}',${JSON.stringify(e.kind==='skillRandomSecondary'?['Secondary']:e.kind==='skillRandomPrimary'||e.kind==='veteranPromote'?['Primary']:['Primary','Secondary'])})">← Changer d’arbre</button></div></div>`);
}
function rollRandomSkillFromTree(id,encodedSet,kind){
 const x=activeRoster()?.fighters[editingIndex],e=ADVANCEMENT_MAIN.find(a=>a.id===id),set=decodeURIComponent(encodedSet);if(!x||!e)return;
 const levels=e.kind==='skillRandomSecondary'?['Secondary']:e.kind==='skillRandomPrimary'||e.kind==='veteranPromote'?['Primary']:['Primary','Secondary'];
 const tree=eligibleSkillTreesForAdvancement(x,levels).find(o=>o.set===set&&o.kind===kind);if(!tree){toast('Cet arbre n’est pas autorisé ou ne contient plus de compétence disponible');return}
 const skill=tree.skills[Math.floor(Math.random()*tree.skills.length)];
 if(e.kind==='veteranPromote'){
  if(!spendAdvancement(x,e,{kind:'promotion',skill,detail:`${set} · aléatoire`}))return;
  if(kind==='magic'){x.spells=x.spells||[];x.spells.push(skill)}else{x.skills=x.skills||[];x.skills.push(skill)}
  x.type='Champion';x.veteran=false;x.promotedVeteran=true;save(true);closeModal();render('fighter');toast(`${x.name} promu Champion · ${skill} acquis`);return;
 }
 if(kind==='magic'){
  if(Number(x.xp||0)<e.xp){toast('XP insuffisant');return}
  x.xp-=e.xp;x.spells=x.spells||[];x.spells.push(skill);x.advancements=x.advancements||[];x.advancements.push({id:crypto.randomUUID(),sourceId:e.id,kind:'skill',skill,detail:`${set} · aléatoire`,xp:e.xp,value:e.value});save(true);closeModal();render('fighter');toast(`${skill} acquis`);return;
 }
 if(buySkillAdvancement(x,e,skill,`${set} · aléatoire`)){save(true);closeModal();render('fighter');toast(`${skill} acquis`)}
}
function openAdvancementSkillPicker(id,level){
 const x=activeRoster()?.fighters[editingIndex],e=ADVANCEMENT_MAIN.find(a=>a.id===id);if(!x||!e)return;
 const trees=eligibleSkillTreesForAdvancement(x,[level]);
 openModal(`<div class="skill-dialog"><div class="eyebrow">ADVANCEMENT · ${e.xp} XP</div><h2>1. Choisir l’arbre</h2><p>${esc(e.label)}. Choisis l’un des arbres ${esc(level)} autorisés, puis sélectionne la compétence voulue.</p><div class="skill-modal-grid">${trees.length?trees.map(o=>`<button type="button" class="skill-modal-category" onclick="showChosenSkillTree('${e.id}','${encodeURIComponent(o.set)}','${o.kind}')"><span>${esc(o.set)}</span><small>${esc(o.level)} · ${o.skills.length} disponible${o.skills.length>1?'s':''}</small></button>`).join(''):'<div class="empty compact">Aucune compétence disponible.</div>'}</div><div class="purchase-actions"><button type="button" class="button secondary" onclick="closeModal()">Annuler</button></div></div>`);
}
function showChosenSkillTree(id,encodedSet,kind){
 const x=activeRoster()?.fighters[editingIndex],e=ADVANCEMENT_MAIN.find(a=>a.id===id),set=decodeURIComponent(encodedSet);if(!x||!e)return;
 const tree=eligibleSkillTreesForAdvancement(x,['Primary','Secondary']).find(o=>o.set===set&&o.kind===kind);if(!tree){toast('Cet arbre n’est plus disponible');return}
 openModal(`<div class="skill-dialog"><div class="eyebrow">ADVANCEMENT · ${e.xp} XP</div><h2>2. ${esc(set)}</h2><p>Choisis la compétence à acquérir.</p><div class="skill-modal-list">${orderedChoiceNames(tree.skills, kind==='magic'?MAGIC_DOMAINS[set]:D.skillSets[set]).map(skill=>`<button type="button" class="skill-modal-skill" onclick="confirmAdvancementSkill('${e.id}','${encodeURIComponent(skill)}','${encodeURIComponent(set)}','${kind}')"><span>${esc(numberedSkillName(skill, kind==='magic'?MAGIC_DOMAINS[set]:D.skillSets[set]))}${refInfo(kind==='magic'?'spells':'skills',skill)}</span><small>${kind==='magic'?'Sort · Primary':'Compétence · '+esc(tree.level)}</small></button>`).join('')}</div><div class="purchase-actions"><button type="button" class="button secondary" onclick="openAdvancementSkillPicker('${e.id}','${levelForSkillPicker(e.id)}')">← Changer d’arbre</button></div></div>`);
}
function levelForSkillPicker(id){const e=ADVANCEMENT_MAIN.find(a=>a.id===id);return e?.kind==='skillPickPrimary'?'Primary':'Primary'}
function confirmAdvancementSkill(id,encoded,setEncoded,kind='skill'){const x=activeRoster()?.fighters[editingIndex],e=ADVANCEMENT_MAIN.find(a=>a.id===id),skill=decodeURIComponent(encoded),set=decodeURIComponent(setEncoded);if(!x||!e)return;if(kind==='magic'){if(Number(x.xp||0)<e.xp){toast('XP insuffisant');return}x.xp-=e.xp;x.spells=x.spells||[];x.spells.push(skill);x.advancements=x.advancements||[];x.advancements.push({id:crypto.randomUUID(),sourceId:e.id,kind:'skill',skill,detail:`${set} · choisi`,xp:e.xp,value:e.value});save(true);closeModal();render('fighter');toast(`${skill} acquis`);return}if(buySkillAdvancement(x,e,skill,`${set} · choisi`)){save(true);closeModal();render('fighter');toast(`${skill} acquis`)} }
function refundAdvancement(i){const r=activeRoster(),x=r?.fighters[editingIndex],a=x?.advancements?.[i];if(!x||!a)return;openModal(`<div class="delete-dialog"><div class="eyebrow">REMBOURSEMENT</div><h2>Annuler « ${esc(a.label)} » ?</h2><p>Remboursement : <strong>${a.xp} XP</strong> et retrait de <strong>+${a.value} GC</strong> de valeur.</p><button type="button" class="big-delete" onclick="confirmRefundAdvancement(${i})">REMBOURSER L’ADVANCEMENT</button><button type="button" class="button secondary full" onclick="closeModal()">Annuler</button></div>`)}
function confirmRefundAdvancement(i){const x=activeRoster()?.fighters[editingIndex],a=x?.advancements?.[i];if(!x||!a)return;x.xp=Number(x.xp||0)+Number(a.xp||0);if(a.kind==='stat'&&Number.isInteger(a.statIndex))x.profile[a.statIndex]=Number(x.profile[a.statIndex]||0)-1;if(a.kind==='skill'&&a.skill)x.skills=(x.skills||[]).filter((s,n)=>n!==(x.skills||[]).lastIndexOf(a.skill));if(a.kind==='promotion'){x.skills=(x.skills||[]).filter((s,n)=>n!==(x.skills||[]).lastIndexOf(a.skill));x.type='Henchman';x.veteran=false;x.promotedVeteran=false}x.advancements.splice(i,1);save(true);closeModal();render('fighter');toast('Advancement remboursé')}
function rollHenchmanAdvancement(){const x=activeRoster()?.fighters[editingIndex];if(!x||Number(x.xp||0)<6){toast('6 XP sont requis');return}const max=maxProfileFor(x);let attempts=0;while(attempts<100){attempts++;const roll=2+Math.floor(Math.random()*11);let choices=[];if(roll===2||roll===12)choices=[null];else if(roll>=3&&roll<=4)choices=[3];else if(roll>=5&&roll<=6)choices=[0,6];else if(roll===7)choices=[1,2];else if(roll>=8&&roll<=9)choices=[8,9];else if(roll===10)choices=[10,11];else if(roll===11)choices=[7];if(choices.some(i=>i===null||Number(x.profile[i])<Number(max[i]))){if(roll===5||roll===6){const valid=choices.filter(i=>Number(x.profile[i])<Number(max[i]));if(!valid.length)continue;openModal(`<div class="skill-dialog"><div class="eyebrow">TABLE P.129 · ${roll}</div><h2>Choisis l’augmentation</h2><p>Le jet indique +1 Mouvement ou +1 Initiative. Les 6 XP seront consommés une seule fois.</p><div class="skill-modal-list">${valid.map(i=>`<button class="skill-modal-skill" onclick="confirmHenchRoll(${roll},${i})"><span>${esc(statLabel(i))} +1</span><small>+10 GC · MAX ${max[i]}</small></button>`).join('')}</div></div>`);return}return confirmHenchRoll(roll,null)}}toast('Impossible de déterminer un avancement valide');}
function openHenchChoice(){rollHenchmanAdvancement()}
function henchmanAdvancementByRoll(roll){const n=Number(roll);return ADVANCEMENT_HENCHMAN.find(e=>{const m=String(e.roll).match(/^(\d+)(?:[–-](\d+))?$/);if(!m)return false;const a=Number(m[1]),b=Number(m[2]||m[1]);return n>=a&&n<=b})||null}
function confirmHenchRoll(roll,statIndex){const x=activeRoster()?.fighters[editingIndex];const entry=henchmanAdvancementByRoll(roll);if(!x||!entry)return;if(Number(x.xp||0)<entry.xp){toast(`${entry.xp} XP requis`);closeModal();return}const max=maxProfileFor(x);if(entry.kind==='henchVeteran'){x.xp-=entry.xp;x.promotedVeteran=true;x.veteran=true;x.advancements=x.advancements||[];x.advancements.push({id:crypto.randomUUID(),sourceId:`hench-${entry.roll}`,kind:'promotion',label:entry.label,xp:entry.xp,value:entry.value});closeModal();save(true);render('fighter');toast(`${x.name} devient Veteran`);return}let i=Number.isInteger(statIndex)?statIndex:null;if(i===null){const valid=(entry.stats||[]).filter(idx=>Number(x.profile[idx])<Number(max[idx]));i=valid.length?valid[Math.floor(Math.random()*valid.length)]:null}if(i===null||Number(x.profile[i])>=Number(max[i])){toast('Maximum de caractéristique atteint');closeModal();return}x.xp-=entry.xp;x.profile[i]=Number(x.profile[i]||0)+1;x.advancements=x.advancements||[];x.advancements.push({id:crypto.randomUUID(),sourceId:`hench-${entry.roll}`,kind:'stat',statIndex:i,label:`${statLabel(i)} +1`,xp:entry.xp,value:entry.value});closeModal();save(true);render('fighter');toast(`${statLabel(i)} +1 · avancement Henchman`)}
function resolveCriticalInjury(){const r=activeRoster(),x=r?.fighters[editingIndex];if(!r||!x||!fighterStatus(x).critical)return;const cost=(1+Math.floor(Math.random()*6)+1+Math.floor(Math.random()*6))*10;const available=Number(r.gold||0);openModal(`<div class="skill-dialog"><div class="eyebrow">POST-BATTLE · MEDICAL ESCORT</div><h2>Traiter la Critical Injury</h2><p>Le Physician coûte <strong>${cost} GC</strong> pour ce patient (2D6 × 10). Trésor disponible : <strong>${available} GC</strong>.</p><p>Si le paiement est effectué, un D6 détermine le résultat : <strong>1 = mort</strong> · <strong>2–5 = Lasting Injury 51–56</strong> · <strong>6 = récupération complète</strong>.</p><div class="purchase-actions"><button type="button" class="button secondary" onclick="closeModal()">Annuler</button><button type="button" class="button danger" onclick="applyCriticalPhysician(${cost})">Payer & lancer D6</button></div></div>`)}
function applyCriticalPhysician(cost){const r=activeRoster(),x=r?.fighters[editingIndex];if(!r||!x||!fighterStatus(x).critical)return;if(Number(r.gold||0)<Number(cost)){closeModal();setFighterStatus('dead',true);toast('Fonds insuffisants : Critical Injury → mort');return}r.gold-=Number(cost);const roll=1+Math.floor(Math.random()*6);if(roll===1){setFighterStatus('dead',true);closeModal();toast('Physician : complications · combattant mort');return}if(roll===6){setFighterStatus('critical',false);setFighterStatus('recovery',true);closeModal();toast('Physician : récupération complète · en Recovery');return}const lastingRoll=50+roll;setFighterStatus('critical',false);addInjuryResult(lastingRoll);closeModal();toast(`Physician : résultat ${lastingRoll}`)}
function lastingInjuriesMarkup(x){
  normalizeInjuries(x);
  return `<section class="sheet-block fighter-tab-block lasting-injuries-block"><div class="sheet-block-head prominent-section"><div><h4>Lasting Injuries</h4><small>Séquences de blessures persistantes · D66 optionnel</small></div><button type="button" class="button primary injury-add-button" onclick="toggleInjuryPicker()">＋ ADD LASTING INJURY</button></div><div class="tag-editor">${x.injuries?.length?x.injuries.map((inj,i)=>`<span title="${esc(inj.desc||'')}" class="injury-tag"><b>${esc(inj.roll||'')}</b> ${esc(inj.name)}${inj.statMods?.length?` <em>· ${esc(inj.statMods.map(m=>m.label).join(', '))}</em>`:''}<button type="button" onclick="removeInjury(${i})">×</button></span>`).join(''):'<small>Aucune séquelle enregistrée.</small>'}</div>${injuryPickerOpen?`<div class="lasting-injury-picker"><div class="lasting-injury-picker-head"><div><strong>TABLE DES LASTING INJURIES</strong><small>Choisis directement un résultat, ou lance un D66 si le jet n’a pas été fait à table.</small></div><button type="button" class="button secondary" onclick="toggleInjuryPicker()">Fermer</button></div><div class="lasting-injury-roll"><button type="button" class="button primary" onclick="rollLastingInjury()">🎲 Lancer D66</button>${lastInjuryRoll?`<div class="lasting-roll-result"><span>Résultat</span><strong>${lastInjuryRoll.roll}</strong><div><b>${esc(lastInjuryRoll.result.name)}</b><small>${esc(lastInjuryRoll.result.desc)}</small></div><button type="button" class="button secondary" onclick="addRolledLastingInjury()">Ajouter ce résultat</button></div>`:'<small>Le lancer est facultatif : le résultat ne sera ajouté qu’après validation.</small>'}</div><div class="lasting-injury-list">${LASTING_INJURIES.map(inj=>`<button type="button" class="lasting-injury-option" onclick="addInjuryResult('${inj.roll.split(/[–-]/)[0]}')"><span class="lasting-injury-rollcode">${esc(inj.roll)}</span><span class="lasting-injury-option-main"><b>${esc(inj.name)}</b><small>${esc(inj.desc)}</small></span>${inj.mods?.length?`<em>${esc(inj.mods.map(m=>m.label).join(' · '))}</em>`:''}</button>`).join('')}</div><div class="lasting-injury-custom"><input id="injuryInput" placeholder="Séquelle personnalisée"><button type="button" class="button secondary" onclick="addInjury()">Ajouter</button></div></div>`:''}</section>`;
}
function fighterPageMarkup(x){
 const f=faction(activeRoster()),equip=x.equipmentSelected||[];
 const tabs=`<div class="fighter-section-tabs"><button class="fighter-section-tab ${fighterTab==='skills'?'active':''}" onclick="setFighterTab('skills')">Skills <span>${(x.skills||[]).length}</span></button><button class="fighter-section-tab ${fighterTab==='progression'?'active':''}" onclick="setFighterTab('progression')">Progression <span>${Number(x.xp||0)} XP</span></button><button class="fighter-section-tab ${fighterTab==='magic'?'active':''}" onclick="setFighterTab('magic')">Magie <span>${(x.spells||[]).length}</span></button><button class="fighter-section-tab ${fighterTab==='injuries'?'active':''}" onclick="setFighterTab('injuries')">Lasting Injuries <span>${(x.injuries||[]).length}</span></button></div>`;
 let tabContent='';
 if(fighterTab==='skills') tabContent=`<section class="sheet-block fighter-tab-block skills-block"><div class="sheet-block-head"><div><h4>Skills</h4><small>Les compétences sont acquises gratuitement. Les arbres personnels indiquent Primary / Secondary.</small></div><button type="button" class="button primary skill-add-button" onclick="openSkillModal()">＋ ADD</button></div><div class="owned-skills-section"><div class="subsection-title">Compétences acquises</div>${x.skills?.length?`<div class="skill-tags">${x.skills.map((s,i)=>`<span>${refLink('skills',s)}<button type="button" title="Supprimer" onclick="removeSkill(${i})">×</button></span>`).join('')}</div>`:'<small class="muted">Aucune compétence acquise.</small>'}</div></section>`;
 else if(fighterTab==='progression') tabContent=progressionMarkup(x);
 else if(fighterTab==='magic') tabContent=`<section class="sheet-block fighter-tab-block magic-block"><div class="sheet-block-head"><div><h4>Magie</h4><small>Domaines et sorts autorisés par le profil</small></div></div>${magicMarkup(x)}</section>`;
 else tabContent=lastingInjuriesMarkup(x);
 return `<div class="fighter-page"><div class="fighter-page-top"><button class="button secondary" onclick="backToGang()">← Retour à la bande</button><div class="fighter-page-actions"><button class="button danger-outline" onclick="removeEditingFighter()">Supprimer le combattant</button></div></div><div class="fighter-page-header"><div><div class="eyebrow">FICHE DU COMBATTANT · ${esc(f.displayName)}</div><div class="fighter-title-row"><input id="fighterName" class="sheet-name" value="${esc(x.name)}" onchange="updateFighterField('name',this.value)"><span class="role-badge role-${esc(x.type.toLowerCase().replace(/\s+/g,'-'))}">${esc(x.type)}</span><span class="fighter-race-badge">${esc(fighterRace(x,f))}</span></div><div class="sheet-sub">Profil de base · ${x.cost} GC · modifications enregistrées automatiquement</div></div><div class="fighter-header-visuals"><div class="fighter-avatar-wrap">${fighterStatus(x).recovery?'<span class="fighter-recovery-icon" title="En récupération">✚</span>':''}${fighterStatus(x).captured?'<span class="fighter-captured-icon" title="Capturé">⛓</span>':''}<button type="button" class="fighter-avatar fighter-avatar-hero" title="Importer / remplacer l’image du combattant" onclick="pickImage('fighter',${editingIndex})">${imageMarkup(x.image,'fighter',`Portrait de ${x.name}`,x.imageFocus)}<span class="image-edit-badge">✎</span></button></div><div class="fighter-hero-value"><span>VALEUR</span><strong>${fighterValue(x)}</strong><em>GC</em></div><button type="button" class="image-remove-button" onclick="removeImage('fighter',${editingIndex})" ${x.image?'':'disabled'}>× Retirer</button></div></div>${fighterStatusControlsMarkup(x)}${profileMarkup(x.profile,x.xp,x,{showMax:true})}<div class="fighter-detail-grid"><section class="sheet-block weapons-block"><div class="sheet-block-head loadout-section-head"><div><h4>Armes & équipement</h4><small>${fighterUsesLoadouts(x)?'Coffre + configurations d’équipement':'Équipement équipé'}</small></div><div class="loadout-header-right">${fighterUsesLoadouts(x)?loadoutControlsMarkup(x):`<span>${currentWeaponSlots(x)} / 3 emplacements</span>`}</div></div>${fighterUsesLoadouts(x)?loadoutEquipmentMarkup(x):(equip.length?`<div class="equipped-management-list">${equip.map((e,i)=>equippedItemRow(e,i)).join('')}</div>`:'<div class="empty compact">Aucun équipement équipé.</div>')}</section><section class="sheet-block equipment-add-block ${equipmentOpen?'is-open':'is-collapsed'}"><button type="button" class="equipment-collapse-head" onclick="toggleEquipmentPanel()"><span><span class="equipment-collapse-icon">＋</span><strong>Ajouter de l’équipement</strong></span><span>${equipmentOpen?'Réduire':'Ouvrir'} · 3 listes</span></button>${equipmentOpen?`<div class="equipment-collapse-body"><p class="sheet-help">Band List respecte exclusivement « WEAPONS AND EQUIPMENT » du profil et la liste de la bande.</p>${equipmentPicker(x,equip)}</div>`:''}</section>${statsTabMarkup(x)}${tabs}${tabContent}<section class="sheet-block"><div class="sheet-block-head prominent-section"><h4>Wargear</h4></div><div class="wargear-summary">${equip.filter(e=>!e.profile).length?equip.filter(e=>!e.profile).map(e=>`<span>${refLink('equipment',e.name)}</span>`).join(''):'<small>Aucun wargear équipé.</small>'}</div></section><section class="sheet-block"><div class="sheet-block-head prominent-section"><h4>Règles spéciales</h4></div><div class="rule-name-tags">${fighterRuleNames(x,f).length?fighterRuleNames(x,f).map(n=>`<span>${refLink('special',n)}</span>`).join(''):'<small>Aucune règle spéciale enregistrée.</small>'}</div><details class="rule-details"><summary>Voir / modifier le résumé conservé dans la base</summary><textarea id="fighterRules" class="wide-textarea" rows="5" placeholder="Résumé des règles spéciales…" onchange="updateFighterField('rules',this.value)">${esc(x.rules||'')}</textarea></details></section><section class="sheet-block"><div class="sheet-block-head"><h4>Notes de campagne</h4></div><textarea id="fighterNotes" class="wide-textarea" rows="5" placeholder="Notes…" onchange="updateFighterField('notes',this.value)">${esc(x.notes||'')}</textarea></section></div></div>`;
}
var ARMOUR_SUITS=['Light armour','Light armor','Heavy armour','Heavy armor','Full plate armour','Full plate armor','Gromril plate','Gromril plate armour','Gromril plate armor','Ithilmar','Ithilmar mail','Ithilmar armour','Ithilmar armor','Sigmarite armour','Sigmarite armor','Chaos armour','Chaos armor'];
var FUR_CLOAKS=['Fur cloak','Wolf cloak'];
var OFFHAND_DEFENCE=['Shield','Buckler','Main Gauche','Left hand dagger','Sword breaker'];
function normName(n){return String(n||'').trim().toLowerCase();}
function isArmourSuit(w){return !!w?.customArmor || (isCustomEquipment(w)&&['armure','armures'].includes(normName(w?.category))) || ARMOUR_SUITS.map(normName).includes(normName(w?.name));}
function isFurCloak(w){return FUR_CLOAKS.map(normName).includes(normName(w?.name));}
function isShield(w){return normName(w?.name)==='shield';}
function isOffhandDefence(w){return OFFHAND_DEFENCE.map(normName).includes(normName(w?.name));}
function fighterNormalProfile(x,f=faction(activeRoster()),fallbackProfile=[]){
  const base=fighterOriginalProfile(x);
  const out=Array.isArray(base)&&base.length===12?base.slice():(Array.isArray(fallbackProfile)?fallbackProfile.slice():P.map(()=>0));
  (x?.advancements||[]).forEach(a=>{if(a.kind==='stat'&&Number.isInteger(a.statIndex)&&a.statIndex>=0&&a.statIndex<12)out[a.statIndex]=Number(out[a.statIndex]||0)+1;});
  // Permanent profile-changing rules are part of the warrior's normal value.
  const source=x?.customFighterId?customFighterById(x.customFighterId):f?.warriors?.find(w=>w.id===x?.wid||w.name===x?.sourceName||w.name===x?.name);
  const names=[...(x?.ruleNames||source?.ruleNames||[]),...(x?.skills||[])].map(normName);
  if(names.includes('fliyinghorror'))out[0]=10;
  return out;
}
function fighterStatus(x){if(!x)return {recovery:false,captured:false,dead:false,critical:false};if(!x.status||typeof x.status!=='object')x.status={};x.status.recovery=!!x.status.recovery;x.status.captured=!!x.status.captured;x.status.dead=!!x.status.dead;x.status.critical=!!x.status.critical;if(x.status.dead)x.status.critical=false;return x.status;}
function setFighterStatus(kind,value){const x=activeRoster()?.fighters[editingIndex];if(!x)return;const st=fighterStatus(x);if(kind==='recovery')st.recovery=!!value;if(kind==='captured')st.captured=!!value;if(kind==='dead')st.dead=!!value;if(kind==='critical')st.critical=!!value;if(value&&kind==='dead'){st.recovery=false;st.captured=false;st.critical=false}if(value&&kind==='recovery'){st.dead=false}if(value&&kind==='critical'){st.dead=false}save(true);render('fighter');const labels={recovery:value?'Envoyé en récupération':'Combattant récupéré',captured:value?'Combattant capturé':'Combattant libéré',dead:value?'Combattant tué':'Combattant ressuscité',critical:value?'Mis en état critique':'État critique retiré'};toast(labels[kind]);}
function toggleFighterStatus(kind){const x=activeRoster()?.fighters[editingIndex];if(!x)return;const st=fighterStatus(x);setFighterStatus(kind,!st[kind]);}
function fighterStatusControlsMarkup(x){const st=fighterStatus(x);return `<div class="fighter-status-panel"><div class="fighter-status-head"><span class="eyebrow">STATUT DE CAMPAGNE</span><div class="fighter-status-badges">${st.recovery?'<span class="fighter-status-badge recovery">✚ RECOVERY</span>':''}${st.captured?'<span class="fighter-status-badge captured">⛓ CAPTURÉ</span>':''}${st.dead?'<span class="fighter-status-badge dead">☠ DEAD</span>':''}${st.critical&&!st.dead?'<span class="fighter-status-badge critical">⚠ CRITICAL</span>':''}${!st.recovery&&!st.captured&&!st.dead&&!st.critical?'<span class="fighter-status-none">Aucun statut</span>':''}</div></div><div class="fighter-status-actions"><button type="button" class="button ${st.recovery?'recovery-active':'primary'}" onclick="setFighterStatus('recovery',${st.recovery?'false':'true'})">${st.recovery?'✚ Recover Warrior':'✚ Send to Recovery'}</button><button type="button" class="button ${st.captured?'captured-active':'secondary'}" onclick="toggleFighterStatus('captured')">${st.captured?'⛓ Release Warrior':'⛓ Mark as Captured'}</button><button type="button" class="button ${st.dead?'death-active':'danger-outline'}" onclick="setFighterStatus('dead',${st.dead?'false':'true'})">${st.dead?'☠ Resurrect Warrior':'☠ Kill Warrior'}</button>${st.critical&&!st.dead?'<button type="button" class="button critical-active" onclick="resolveCriticalInjury()">⚕ Medical Escort</button>':''}</div></div>`;}

// Small mono-color XP bar (0-15 scale), same pink as the XP stat box.
// It fills proportionally to the XP within the current 15-XP "cycle" and
// shows that remainder as a "12/15"-style label underneath. Once XP passes
// 15, the bar restarts at the surplus, but rendered in a progressively
// darker shade of the same color for each completed cycle of 15 — so a
// glance at the shade tells you roughly how many multiples of 15 the
// fighter has banked, not just the current remainder.
function hexToHsl(hex){
 hex=String(hex||'').replace('#','');
 const r=parseInt(hex.slice(0,2),16)/255,g=parseInt(hex.slice(2,4),16)/255,b=parseInt(hex.slice(4,6),16)/255;
 const max=Math.max(r,g,b),min=Math.min(r,g,b);let h=0,s=0;const l=(max+min)/2,d=max-min;
 if(d!==0){
  s=l>0.5?d/(2-max-min):d/(max+min);
  if(max===r)h=(g-b)/d+(g<b?6:0);else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;
  h/=6;
 }
 return {h:h*360,s:s*100,l:l*100};
}
function hslToHex(h,s,l){
 h/=360;s/=100;l/=100;let r,g,b;
 if(s===0){r=g=b=l;}
 else{
  const hue2rgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
  const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;
  r=hue2rgb(p,q,h+1/3);g=hue2rgb(p,q,h);b=hue2rgb(p,q,h-1/3);
 }
 const toHex=x=>Math.max(0,Math.min(255,Math.round(x*255))).toString(16).padStart(2,'0');
 return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function xpCycleShade(baseHex,cycle){
 if(!cycle)return baseHex;
 const {h,s,l}=hexToHsl(baseHex);
 const newL=Math.max(16,l-cycle*11);
 return hslToHex(h,s,newL);
}
function xpBarMarkup(xp){
 const val=Math.max(0,Math.round(Number(xp||0))),cap=15;
 const baseColor='#f4b8dc';
 let cycle=0,remainder=val;
 if(val>0){cycle=Math.floor((val-1)/cap);remainder=val-cycle*cap;}
 const pct=Math.max(0,Math.min(100,remainder/cap*100));
 const color=xpCycleShade(baseColor,cycle);
 return `<div class="xp-bar" title="Progression XP · ${val} XP${cycle?` · cycle ${cycle+1}`:''}"><div class="xp-bar-track"><div class="xp-bar-fill" style="width:${pct.toFixed(2)}%;background:${color}"></div></div><div class="xp-bar-label">${val}/${cap}</div></div>`;
}
function profileMarkup(profile,xp,x,options={}){const showMax=!!options.showMax;const rosterCard=!!options.rosterCard;const normal=fighterNormalProfile(x,faction(activeRoster()),profile);normalizeInjuries(x);const injuryStats=new Set((x.injuries||[]).flatMap(inj=>Array.isArray(inj.statMods)?inj.statMods.map(m=>m.index):[]));const injuryTitles=P.map((n,i)=>(x.injuries||[]).filter(inj=>(inj.statMods||[]).some(m=>m.index===i)).map(inj=>inj.name).join(' · '));const maxProfile=maxProfileFor(x)||[];const stats=P.map((n,i)=>{const v=Number(profile?.[i]??0),b=Number(normal?.[i]??v);const delta=v-b;const scar=injuryStats.has(i);const maxValue=Number(maxProfile?.[i]??v);const overstat=Number.isFinite(maxValue)&&v>maxValue;const cls=`profile-stat ${i>=8?'mental-stat ':''}${delta<0?'stat-below ':''}${delta>0?'stat-above ':''}${overstat?'stat-overstat ':''}${scar?'injury-altered':''}`.trim();return `<div class="${cls}" data-overstat="${overstat?'true':'false'}" title="${overstat?'OVERSTAT · ':''}Maximum : ${maxValue}${scar?` · Séquelle : ${esc(injuryTitles[i])}`:''}"><span>${n}</span><i></i><b>${v}</b>${overstat?'<em class="overstat-label" aria-hidden="true">OVER</em>':''}${scar?'<em class="injury-scar" aria-hidden="true">⌁</em>':''}</div>`}).join('');const maxRow=showMax?`<div class="profile-max-row" aria-label="Caractéristiques maximales">${P.map((n,i)=>`<span><b>${Number(maxProfile?.[i]??profile?.[i]??0)}</b></span>`).join('')}</div>`:'';const xpMarkup=rosterCard?`<div class="profile-stat profile-xp" aria-label="Expérience" title="Modifiable depuis la fiche du guerrier"><span>XP</span><i></i><b>${Number(xp||0)}</b></div>`:`<div class="profile-xp resource-clickable" title="Cliquer pour ajouter ou soustraire une quantité d’XP" onclick="event.stopPropagation();openFighterXPAdjust()"><span>XP</span><div class="xp-controls"><button type="button" class="xp-btn" title="Retirer 1 XP" aria-label="Retirer 1 XP" onclick="event.stopPropagation();adjustFighterXP(-1)">−</button><b>${Number(xp||0)}</b><button type="button" class="xp-btn" title="Ajouter 1 XP" aria-label="Ajouter 1 XP" onclick="event.stopPropagation();adjustFighterXP(1)">+</button></div></div>`;return `<div class="profile-simple"><div class="profile-row">${stats}<div class="profile-stat armor-stat"><span>Sv</span><i></i><b>${esc(armorSave(x))}</b></div>${xpMarkup}</div>${maxRow}${!rosterCard?xpBarMarkup(xp):''}</div>`}
function weaponEffectPack(x,e){
  if(!x||!e?.profile)return {traits:[],strength:0,ap:0,damage:0,notes:[]};
  const n=normName(e.name), traits=[], notes=[], addTrait=t=>{if(t&&!traits.some(x=>refNorm(x)===refNorm(t)))traits.push(t)};
  const allSkills=(x.skills||[]).map(normName);
  const allRules=(fighterRuleNames(x,faction(activeRoster()))||[]).map(normName);
  const eq=(x.equipmentSelected||[]).map(normName);
  const isMelee=String(e.profile.range||'').toLowerCase().includes('melee');
  const isBow=['shortbow','bow','longbow','elfbow'].includes(n);
  const isBlackpowder=(e.traits||[]).some(t=>refNorm(t)==='blackpowder');
  if(allSkills.includes('backstab')&&isMelee){addTrait('Backstab');notes.push('Backstab · compétence');}
  if(allSkills.includes('disarm')&&isMelee){addTrait('Disarm');notes.push('Disarm · compétence');}
  if(allSkills.includes('bullcharge')&&isMelee){addTrait('Knockback');notes.push('+1 Force et Knockback lors d’une Charge · Bull Charge');}
  if(allSkills.includes('fistsofsteel')&&['unarmed','naturalweapons'].includes(n)){notes.push('+2 Force et Dégâts 2 · Fists of Steel');}
  if(eq.includes('huntingarrows')&&isBow){addTrait('Rending');notes.push('Rending · Hunting arrows');}
  if(eq.includes('bodkinarrows')&&isBow){notes.push('-1 AP · Bodkin arrows');}
  if(eq.includes('superiorblackpowder')&&isBlackpowder){addTrait('Hack');addTrait('Rending');notes.push('Hack + Rending · Superior blackpowder');}
  // Custom equipment/rules can explicitly grant weapon traits using phrases such as “weapon gains X”.
  const sources=[];
  (x.equipmentSelected||[]).forEach(q=>{if(isCustomEquipment(q))sources.push(String(q.rulesText||''));});
  (x.ruleNames||[]).forEach(r=>{const found=referenceFind('special',r);if(found)sources.push(found.text||'');});
  (x.skills||[]).forEach(r=>{const found=referenceFind('skills',r);if(found)sources.push(found.text||'');});
  sources.forEach(text=>{
    const m=String(text).match(/weapons?\s+(?:used by this warrior\s+)?(?:also\s+)?gain(?:s)?\s+(?:the\s+)?([A-Za-z][A-Za-z ()'’-]+?)(?:\s+weapon)?\s+trait/i);
    if(m&&isMelee)addTrait(m[1].trim());
  });
  return {traits,strength:0,ap:0,damage:0,notes};
}
function weaponProfileMarkup(e,x){const p=e.profile;if(!p)return '';const fx=weaponEffectPack(x,e);const baseTraits=String(p.traits||'').split(/,\s*/).map(s=>s.trim()).filter(Boolean);const merged=[...baseTraits,...fx.traits.filter(t=>!baseTraits.some(b=>refNorm(b)===refNorm(t)))];const traitMarkup=merged.map(t=>{const added=fx.traits.some(a=>refNorm(a)===refNorm(t))&&!baseTraits.some(b=>refNorm(b)===refNorm(t));return added?`<span class="weapon-applied-rule">${refLinkByName(t,'traits')}</span>`:refLinkByName(t,'traits')}).join(', ')||'—';const noteMarkup=fx.notes.length?`<div class="weapon-applied-effects">${fx.notes.map(n=>`<span>${esc(n)}</span>`).join(' · ')}</div>`:'';return `<div class="weapon-profile"><div class="weapon-profile-title">${refLink('equipment',e.name)}</div><div class="weapon-profile-grid"><span>Portée<b>${esc(p.range)}</b></span><span>Force<b>${esc(fx.strength?`${p.strength} (${fx.strength>0?'+':''}${fx.strength})`:p.strength)}</b></span><span>AP<b>${esc(p.ap||'—')}${fx.ap?` <em class="weapon-stat-applied">${fx.ap>0?'+':''}${fx.ap}</em>`:''}</b></span><span>Dégâts<b>${esc(p.damage||'—')}${fx.damage?` <em class="weapon-stat-applied">${fx.damage>0?'+':''}${fx.damage}</em>`:''}</b></span><span class="weapon-traits">Traits<b>${traitMarkup}</b></span></div>${noteMarkup}</div>`}
const RULE_DISPLAY_NAMES=['Martial Prowess','Eternally Brave','Honour','Warrior Code','Men-at-Arms','Red Fury','Blade Master','Hearth Piercing','Strength of Steel','Transfiring Glare','Fliying Horror','Race','Leader','Champion','Raw Recruit','Henchman','Henchmen','Wizard','Priest','Hired Sword','Fearless','Fear','Frenzy','Terror','Panic','Large Target','Undead','Vampiric','Daemonic','Mutation','Poisoned Attacks','Starving','No Deal','Wight Blades','No Brain','Summoned','Undead Horde','War Beasts','Scurry Away!','Strength in numbers','Animosity','Size Matters','Fear Elves','Monster','Regeneration','Stupidity','Troll Vomit','Ballistics Expert','Gunsmith','Stubborn','Counter Attack (Skill)','Blessed Sight','Wyrdstone Seeker','Hatred','extra skill','may never wear armour'];
function fighterRace(x,f){
  const source=x?.customFighterId?customFighterById(x.customFighterId):f?.warriors?.find(w=>w.id===x?.wid||w.name===x?.sourceName||w.name===x?.name);
  // Built-in fighters always inherit the race from the catalog. This also repairs old rosters
  // whose saved `race` field was generated from an incorrect catalog entry.
  if(!x?.customFighterId && source?.race)return String(source.race).replace(/^Race\s*\(\s*/i,'').replace(/\s*\)\s*$/,'').trim();
  const explicit=String(x?.race||source?.race||'').trim();
  if(explicit)return explicit.replace(/^Race\s*\(\s*/i,'').replace(/\s*\)\s*$/,'').trim();
  const text=String(x?.rules||source?.rules||'');
  const m=text.match(/Race\s*\(\s*([^)]*?)\s*\)/i);
  return (m?.[1]||'Human').trim()||'Human';
}
function fighterRaceRule(x,f){return `Race (${fighterRace(x,f)})`}

function sourceOrderedNames(list, sourceMap){
 const src=Array.isArray(sourceMap)?sourceMap:[];
 const rank=new Map(src.map((name,i)=>[name,i+1]));
 const known=list.filter(name=>rank.has(name)).sort((a,b)=>rank.get(a)-rank.get(b));
 const unknown=list.filter(name=>!rank.has(name)).sort((a,b)=>String(a).localeCompare(String(b),'fr',{sensitivity:'base'}));
 return [...known.map(name=>({name,number:rank.get(name)})),...unknown.map(name=>({name,number:null}))];
}
function numberedSkillName(name, sourceList){
 const list=Array.isArray(sourceList)?sourceList:[];
 const idx=list.indexOf(name);
 return idx>=0 && idx<6 ? `${idx+1}. ${name}` : name;
}
function orderedChoiceNames(list, sourceList){
 const src=Array.isArray(sourceList)?sourceList:[];
 const ranked=list.filter(n=>src.indexOf(n)>=0 && src.indexOf(n)<6).sort((a,b)=>src.indexOf(a)-src.indexOf(b));
 const unranked=list.filter(n=>!ranked.includes(n)).sort((a,b)=>String(a).localeCompare(String(b),'fr',{sensitivity:'base'}));
 return [...ranked,...unranked];
}
function fighterSkillsCardMarkup(x){
 const skills=Array.isArray(x.skills)?x.skills:[];
 return `<div><span class="micro-label">SKILLS</span><p>${skills.length?skills.map(s=>refLink('skills',s)).join(' · '):'—'}</p></div>`;
}
function fighterSpellsCardMarkup(x){
 const spells=Array.isArray(x.spells)?x.spells:[];
 return spells.length?`<div><span class="micro-label">SORTS</span><p>${spells.map(s=>refLink('spells',s)).join(' · ')}</p></div>`:'';
}
function ownedFighterCard(x,i,f){const weapons=(x.equipmentSelected||[]).filter(e=>e.profile);const instance=x.instance||`legacy-${i}`;const st=fighterStatus(x);if(st.recovery||st.captured||st.dead||st.critical)return `<article class="fighter-card-v5 owned-card draggable-fighter fighter-card-status-reduced" data-fighter-index="${i}" data-instance="${esc(instance)}" tabindex="0" role="button"><div class="fighter-reduced-main"><div class="fighter-reduced-name"><span class="fighter-sigil">${factionSigils[f.id]||'◆'}</span><h4>${esc(x.name)}</h4></div><div class="fighter-reduced-visual">${st.recovery?'<span class="fighter-card-status-icon recovery" title="En récupération">✚</span>':''}${st.captured?'<span class="fighter-card-status-icon captured" title="Capturé">⛓</span>':''}${st.dead?'<span class="fighter-card-status-icon dead" title="Mort">☠</span>':''}${st.critical&&!st.dead?'<span class="fighter-card-status-icon critical" title="État critique">⚠</span>':''}<div class="fighter-reduced-avatar">${imageMarkup(x.image,'fighter',`Portrait de ${x.name}`,x.imageFocus)}</div></div></div></article>`;const roleClass=esc(x.type.toLowerCase().replace(/\s+/g,'-'));return `<article class="fighter-card-v5 owned-card draggable-fighter" data-fighter-index="${i}" data-instance="${esc(instance)}" tabindex="0" role="button"><div class="fighter-top"><div class="fighter-ident"><button type="button" class="fighter-avatar-square" title="Importer / remplacer l’image du combattant" onclick="event.stopPropagation();pickImage('fighter-card',${i})">${imageMarkup(x.image,'fighter',`Portrait de ${x.name}`,x.imageFocus)}</button><div><h4>${esc(x.name)}</h4><div class="fighter-badge-row"><span class="role-badge role-${roleClass}">${esc(x.type)}</span><span class="fighter-race-badge">${esc(fighterRace(x,f))}</span></div><div class="fighter-subline">${Number(x.xp||0)} XP</div></div></div><div class="fighter-cost-badge role-${roleClass}"><strong>${fighterValue(x)}</strong><span>GC</span></div></div>${profileMarkup(x.profile,x.xp,x,{rosterCard:true})}${x.packModifiers?.length?`<div class="pack-modifiers"><span class="micro-label">MODIFICATEURS DU PACK</span><p>${x.packModifiers.map(m=>esc(m.rule+' · '+m.stat+' '+(m.amount>0?'+':'' )+m.amount)).join(' · ')}</p></div>`:''}${weapons.length?`<div class="card-weapons">${weapons.map(w=>weaponProfileMarkup(w,x)).join('')}</div>`:''}<div class="fighter-card-sections"><div><span class="micro-label">WARGEAR</span><p>${x.equipmentSelected?.length?x.equipmentSelected.filter(e=>!e.profile).map(e=>refLink('equipment',e.name)).join(' · '):'Aucun'}</p></div>${fighterSkillsCardMarkup(x)}${fighterSpellsCardMarkup(x)}<div><span class="micro-label">RÈGLES SPÉCIALES</span><p>${fighterRuleNames(x,f).length?fighterRuleNames(x,f).map(n=>refLink('special',n)).join(' · '):'—'}</p></div><div><span class="micro-label">LASTING INJURIES</span><p>${x.injuries?.length?x.injuries.map(inj=>esc(typeof inj==='object'?inj.name:inj)).join(' · '):'Aucune'}</p></div></div></article>`}
function filterFighters(){const q=($('#fighterSearch')?.value||'').toLowerCase(),t=$('#typeFilter')?.value||'';document.querySelectorAll('.fighter-row').forEach(x=>x.style.display=(!q||x.dataset.name.includes(q))&&(!t||x.dataset.type===t)?'block':'none')}
function openFighterCard(index){const r=activeRoster();if(!r||!r.fighters[index])return;editingIndex=index;equipmentTab='band';equipmentCategoryFilter='all';equipmentSearch='';equipmentOpen=false;loadoutView='loadout';fighterTab='skills';statsOpen=false;progressionOpen=false;progressionSubtab='stats';skillPickerOpen=false;injuryPickerOpen=false;lastInjuryRoll=null;render('fighter')}
function weaponSlots(e){if(e?.weaponSlotCost!=null)return Number(e.weaponSlotCost);const t=(e?.profile?.traits||'').toLowerCase();if(/two[- ]handed/.test(t))return 2;if(['Shield','Buckler','Main Gauche','Left hand dagger','Sword breaker'].includes(e?.name))return 1;if(/paired/.test(t))return 2;if(['Unarmed','Natural Weapons','Tail Blade'].includes(e?.name))return 0;return e?.profile?1:0}
function currentWeaponSlots(x){return (x.equipmentSelected||[]).reduce((n,e)=>n+weaponSlots(e),0)}
function canEquip(x,w){if(w.bandOnlyIntrinsic)return {ok:true};const equipped=x?.equipmentSelected||[];if(isWeaponLike(w)){const slots=weaponSlots(w);if(currentWeaponSlots(x)+slots>3)return {ok:false,msg:'Maximum de 3 emplacements d’armes atteint (les armes à deux mains comptent pour 2).'}}if(isArmourSuit(w)&&equipped.some(e=>isArmourSuit(e)))return {ok:false,msg:'Un combattant ne peut porter qu’une seule armure.'};if(isFurCloak(w)&&equipped.some(e=>isShield(e)))return {ok:false,msg:'Une fourrure/cape de fourrure ne peut pas être utilisée avec un bouclier.'};if(isShield(w)&&equipped.some(e=>isFurCloak(e)))return {ok:false,msg:'Un bouclier ne peut pas être utilisé avec une fourrure/cape de fourrure.'};return {ok:true}}
function equippedItemRow(e,index){return `<div class="equipped-row"><div class="equipped-row-main"><div class="equipped-row-name"><strong>${refLink('equipment',e.name)}</strong><small>${esc(e.category||'Équipement')}</small></div>${e.profile?`<div class="equipped-inline-profile"><span>Weapon <b>${esc(e.name)}</b></span><span>Range <b>${esc(e.profile.range)}</b></span><span>Str <b>${esc(e.profile.strength)}</b></span><span>Ap <b>${esc(e.profile.ap)}</b></span><span>D <b>${esc(e.profile.damage)}</b></span></div>`:''}<div class="equipped-row-price"><strong>${e.paid==null?'—':Number(e.paid)+' GC'}</strong><small>valeur ${Number(e.value??e.price??0)} GC</small></div></div><div class="equipped-actions"><button type="button" class="equipment-action sell" title="Vendre" aria-label="Vendre ${esc(e.name)}" onclick="sellEquipment(${index})">💰</button><button type="button" class="equipment-action reserve" title="Mettre en réserve" aria-label="Mettre ${esc(e.name)} en réserve" onclick="moveEquipmentToReserve(${index})">▣</button><button type="button" class="equipment-action remove" title="Supprimer" aria-label="Supprimer ${esc(e.name)}" onclick="removeEquipment(${index})">🗑</button></div></div>`}
function setEquipmentSearch(v){equipmentSearch=v;const el=$('#equipmentSearch');if(el&&document.activeElement!==el)el.value=v;const r=activeRoster(),x=r?.fighters[editingIndex];if(r&&x){const picker=document.querySelector('.equipment-picker');if(picker){const old=picker.outerHTML;const tmp=document.createElement('div');tmp.innerHTML=equipmentPicker(x,x.equipmentSelected||[]);picker.replaceWith(tmp.firstElementChild);setTimeout(()=>{$('#equipmentSearch')?.focus();const q=$('#equipmentSearch');if(q){q.setSelectionRange(q.value.length,q.value.length)}},0)}}}
function toggleEquipmentPanel(){equipmentOpen=!equipmentOpen;render('fighter')}
function toggleProgressionPanel(){progressionOpen=!progressionOpen;render('fighter')}
function setProgressionSubtab(tab){progressionSubtab=tab;progressionOpen=true;render('fighter')}
function setLoadoutView(view){loadoutView=view==='chest'?'chest':'loadout';render('fighter')}
function setEquipmentTab(tab){equipmentTab=tab;equipmentCategoryFilter='all';equipmentSearch='';render('fighter')}
function setEquipmentCategory(cat){equipmentCategoryFilter=cat;render('fighter')}
function openPurchaseConfirm(w,defaultPrice,tab){const source=tab==='band'?'Band List':tab==='market'?'Market List':'Unrestricted List';const intrinsic=w.bandOnlyIntrinsic;const canBuy=defaultPrice!=null&&!intrinsic;openModal(`<div class="purchase-dialog"><div class="eyebrow">${intrinsic?'AJOUT À LA FICHE':'ACHAT D’ÉQUIPEMENT'} · ${source}</div><h2>${esc(w.name)}</h2><p>${intrinsic?'Cette arme est innée et n’a aucun coût d’achat.':'Confirme l’achat et, si nécessaire, modifie le prix réellement payé. La valeur affichée peut rester différente.'}</p>${intrinsic?'':'<div class="purchase-grid"><label>Prix d’achat payé (GC)<input id="purchasePaid" type="number" min="0" step="1" value="'+(canBuy?Number(defaultPrice):0)+'"></label><label>Valeur affichée (GC)<input id="purchaseValue" type="number" min="0" step="1" value="'+(canBuy?Number(defaultPrice):0)+'"></label></div><label class="toggle-line"><input id="sameValue" type="checkbox" checked onchange="syncPurchaseValue()"><span>Utiliser le prix d’achat comme valeur affichée</span></label>'}<div class="purchase-actions"><button type="button" class="button secondary" onclick="closeModal()">Annuler</button><button type="button" class="button primary" onclick="purchaseEquipment('${encodeURIComponent(w.name)}','${tab}')">${intrinsic?'Ajouter':'Confirmer l’achat'}</button></div></div>`)}
function syncPurchaseValue(){const p=$('#purchasePaid'),v=$('#purchaseValue');if($('#sameValue')?.checked&&p&&v)v.value=p.value}
function removeEquipment(i){const r=activeRoster(),x=r?.fighters[editingIndex];if(!x)return;const e=x.equipmentSelected?.[i];if(!e)return;openModal(`<div class="delete-dialog"><div class="eyebrow">SUPPRESSION D’ÉQUIPEMENT</div><h2>Supprimer « ${esc(e.name)} » ?</h2><p>L’objet sera retiré de la fiche sans remboursement du prix payé.</p><button type="button" class="big-delete" onclick="confirmRemoveEquipment(${i})">SUPPRIMER L’ÉQUIPEMENT</button><button type="button" class="button secondary full" onclick="closeModal()">Annuler</button></div>`)}
function confirmRemoveEquipment(i){const r=activeRoster(),x=r?.fighters[editingIndex];if(!x)return;if(fighterUsesLoadouts(x)){ensureFighterLoadouts(x);const e=x.equipmentStash?.[i];if(!e)return;x.equipmentStash.splice(i,1);x.equipmentLoadouts.forEach(l=>{l.equipmentIds=(l.equipmentIds||[]).filter(id=>id!==e.stashId);l.equipmentNames=l.equipmentIds.map(id=>x.equipmentStash.find(q=>q.stashId===id)?.name).filter(Boolean)});syncLoadoutProjection(x);}else{x.equipmentSelected.splice(i,1);}syncCustomEquipmentEffects(x);save(true);closeModal();render('fighter')}
function sellEquipment(i){const r=activeRoster(),x=r?.fighters[editingIndex];if(!x)return;const e=fighterUsesLoadouts(x)?x.equipmentStash?.[i]:x.equipmentSelected?.[i];if(!e)return;const sale=Math.max(0,Math.floor(Number(e.value??e.price??0)/2));openModal(`<div class="sell-dialog"><div class="eyebrow">VENTE D’ÉQUIPEMENT</div><h2>Vendre « ${esc(e.name)} » ?</h2><p>Le M17 fourni ne fixe pas ici de règle générale de revente d’équipement. L’application propose donc par défaut <strong>${sale} GC</strong>, soit 50 % de la valeur affichée, que tu peux modifier.</p><label>Or récupéré (GC)<input id="saleGold" type="number" min="0" step="1" value="${sale}"></label><div class="purchase-actions"><button type="button" class="button secondary" onclick="closeModal()">Annuler</button><button type="button" class="button primary" onclick="confirmSellEquipment(${i})">Vendre</button></div></div>`)}
function confirmSellEquipment(i){const r=activeRoster(),x=r?.fighters[editingIndex];if(!r||!x)return;const e=fighterUsesLoadouts(x)?x.equipmentStash?.[i]:x.equipmentSelected?.[i];if(!e)return;const gold=Math.max(0,Number($('#saleGold')?.value||0));if(!Number.isFinite(gold)){toast('Montant invalide');return}r.gold+=gold;if(fighterUsesLoadouts(x)){x.equipmentStash.splice(i,1);x.equipmentLoadouts.forEach(l=>{l.equipmentIds=(l.equipmentIds||[]).filter(id=>id!==e.stashId);l.equipmentNames=l.equipmentIds.map(id=>x.equipmentStash.find(q=>q.stashId===id)?.name).filter(Boolean)});syncLoadoutProjection(x);}else{x.equipmentSelected.splice(i,1);}syncCustomEquipmentEffects(x);save(true);closeModal();render('fighter');toast(`${e.name} vendu · +${gold} GC`)}
function magicAccessFor(x){
 const domains=customMergedMagicDomains(faction(activeRoster()));
 const unlocked=Array.isArray(x?.unlockedMagicDomains)?x.unlockedMagicDomains:[];
 const custom=x?.customFighterId?customFighterById(x.customFighterId):null;
 let allowed=[];
 if(custom){
   const raw=custom.magicAccess||{};
   allowed=Array.isArray(raw)?raw:Object.entries(raw).filter(([,v])=>v===true||v==='Primary'||v==='Secondary').map(([k])=>k);
 }else{
   const f=faction(activeRoster()), map=MAGIC_ACCESS[f?.id]||{};
   allowed=map[x?.name]||map['*']||[];
 }
 return [...new Set([...allowed,...unlocked])].filter(d=>domains[d]);
}
function unlockMagicDomain(encoded){
 const x=activeRoster()?.fighters[editingIndex],domain=decodeURIComponent(encoded);
 if(!x||!customMergedMagicDomains(faction(activeRoster()))[domain])return;
 if(!Array.isArray(x.unlockedMagicDomains))x.unlockedMagicDomains=[];
 if(!x.unlockedMagicDomains.includes(domain)){
   x.unlockedMagicDomains.push(domain); save(true); toast(`${domain} débloqué pour ${x.name}`);
 }
 render('fighter');
}
function magicSpellWhitelistFor(x,domain){return Array.isArray(x?.magicSpellWhitelist?.[domain])?x.magicSpellWhitelist[domain]:null;}
function magicMarkup(x){
 const mergedDomains=customMergedMagicDomains(faction(activeRoster()));
 const allowed=magicAccessFor(x), spells=x.spells||[], domains=Object.keys(mergedDomains);
 return `<div class="magic-access-grid">${domains.map(d=>{const ok=allowed.includes(d),allSpells=mergedDomains[d]||[],whitelist=magicSpellWhitelistFor(x,d),available=whitelist?allSpells.filter(s=>whitelist.includes(s)):allSpells,known=available.filter(s=>spells.includes(s));return `<div class="magic-domain-card ${ok?'authorized':'locked'}"><button type="button" class="magic-domain-main" ${ok?`onclick="openMagicModal('${encodeURIComponent(d)}')"`:''}><div><strong>${esc(d)}</strong><small>${ok?'Autorisé':'Non autorisé'}${whitelist?' · limité':''}</small></div><span>${known.length}/${available.length} sorts acquis</span></button>${!ok?`<button type="button" class="magic-domain-unlock" onclick="unlockMagicDomain('${encodeURIComponent(d)}')">＋ Débloquer</button>`:''}</div>`}).join('')}</div>${allowed.length?`<div class="owned-magic-section"><div class="subsection-title">Sorts acquis <small>— glisser pour réorganiser</small></div>${spells.length?`<div class="skill-tags spell-tags">${spells.map((s,i)=>`<span draggable="true" data-spell-index="${i}" ondragstart="dragStartSpell(${i},event)" ondragover="dragOverSpell(event)" ondrop="dropSpell(${i},event)">${refLink('spells',s)}<button type="button" title="Retirer" onclick="event.stopPropagation();removeSpell(${i})">×</button></span>`).join('')}</div>`:'<small class="muted">Aucun sort acquis.</small>'}</div>`:''}`;
}
function openMagicModal(encoded){const x=activeRoster()?.fighters[editingIndex],domain=decodeURIComponent(encoded);if(!x||!magicAccessFor(x).includes(domain))return;const owned=new Set(x.spells||[]),allSpells=customMergedMagicDomains(faction(activeRoster()))[domain]||[],whitelist=magicSpellWhitelistFor(x,domain),spells=whitelist?allSpells.filter(s=>whitelist.includes(s)):allSpells;openModal(`<div class="skill-dialog magic-dialog"><div class="eyebrow">AJOUT D’UN SORT</div><h2>${esc(domain)}</h2><p>${whitelist?'Ce combattant ne peut apprendre que les sorts autorisés par sa règle spéciale.':'Les sorts de ce domaine sont disponibles.'}</p><div class="skill-modal-list">${orderedChoiceNames(spells,spells).map(s=>owned.has(s)?`<div class="skill-modal-skill acquired"><span>${refLink('spells',s,numberedSkillName(s,spells))}</span><small>Acquis</small></div>`:`<button type="button" class="skill-modal-skill" onclick="addSpellFromModal('${encodeURIComponent(s)}')"><span>${refLink('spells',s,numberedSkillName(s,spells))}</span><small>Ajouter</small></button>`).join('')}</div><div class="purchase-actions"><button type="button" class="button secondary" onclick="closeModal()">Fermer</button></div></div>`)}
function addSpellFromModal(encoded){const x=activeRoster()?.fighters[editingIndex],v=decodeURIComponent(encoded);if(!x||!v)return;const allowed=magicAccessFor(x);const domain=allowed.find(d=>(customMergedMagicDomains(faction(activeRoster()))[d]||[]).includes(v));if(!domain)return;const whitelist=magicSpellWhitelistFor(x,domain);if(whitelist&&!whitelist.includes(v)){toast('Sort non autorisé pour ce combattant');return}x.spells=x.spells||[];if(!x.spells.includes(v)){x.spells.push(v);save(true);toast(`${v} ajouté`)}closeModal();render('fighter')}
function removeSpell(i){const x=activeRoster()?.fighters[editingIndex];if(!x)return;if(Number.isInteger(i))x.spells=(x.spells||[]).filter((_,n)=>n!==i);else x.spells=(x.spells||[]).filter(s=>s!==i);save(true);render('fighter')}
let fighterPointerStart=null;
let fighterPointerActive=false;
let fighterPointerMoved=false;
let fighterPointerTimer=null;
let fighterSuppressClickUntil=0;
let fighterPointerDropTarget=null;
let fighterPointerDropAfter=false;

function clearFighterDragVisuals(){
  document.querySelectorAll('.owned-card.dragging,.owned-card.drag-over').forEach(c=>c.classList.remove('dragging','drag-over'));
}

function beginFighterPointerDrag(e){
  const card=e.currentTarget;
  if(!card)return;
  if(e.pointerType==='mouse'&&e.button!==0)return;
  if(e.target.closest('button,input,textarea,select,a'))return;
  clearTimeout(fighterPointerTimer);
  fighterPointerStart={card,pointerId:e.pointerId,x:e.clientX,y:e.clientY,type:e.pointerType};
  fighterPointerActive=false;
  fighterPointerMoved=false;
  fighterPointerDropTarget=null;
  fighterPointerDropAfter=false;
  if(e.pointerType==='touch'){
    fighterPointerTimer=setTimeout(()=>activateFighterPointerDrag(e.pointerId),220);
  }
}

function activateFighterPointerDrag(pointerId){
  const st=fighterPointerStart;
  if(!st)return;
  fighterPointerActive=true;
  st.card.classList.add('dragging');
  try{st.card.setPointerCapture(pointerId)}catch(_){}
}

function updateFighterDropTarget(e){
  const st=fighterPointerStart;
  if(!st||!fighterPointerActive)return;
  const el=document.elementFromPoint(e.clientX,e.clientY);
  const target=el?.closest?.('.owned-card');
  document.querySelectorAll('.owned-card.drag-over').forEach(c=>c.classList.remove('drag-over'));
  if(!target||target===st.card){
    fighterPointerDropTarget=null;
    fighterPointerDropAfter=false;
    return;
  }
  fighterPointerDropTarget=target;
  const rect=target.getBoundingClientRect();
  fighterPointerDropAfter=e.clientY>=rect.top+rect.height/2;
  target.classList.add('drag-over');
}

function moveFighterPointerDrag(e){
  const st=fighterPointerStart;
  if(!st||e.pointerId!==st.pointerId)return;
  const dx=e.clientX-st.x,dy=e.clientY-st.y;
  if(!fighterPointerActive){
    if(st.type==='touch')return;
    if(Math.hypot(dx,dy)<6)return;
    clearTimeout(fighterPointerTimer);
    activateFighterPointerDrag(e.pointerId);
  }
  if(!fighterPointerActive)return;
  fighterPointerMoved=true;
  e.preventDefault();
  updateFighterDropTarget(e);
}

function finishFighterPointerDrag(e,cancelled=false){
  clearTimeout(fighterPointerTimer);
  const st=fighterPointerStart;
  if(!st)return;
  const moved=fighterPointerActive&&fighterPointerMoved;
  const source=st.card;
  if(moved&&!cancelled){
    e.preventDefault();
    fighterSuppressClickUntil=Date.now()+500;
    const r=activeRoster();
    const target=fighterPointerDropTarget;
    if(r&&target){
      const sourceId=source.dataset.instance;
      const targetId=target.dataset.instance;
      const list=r.fighters.slice();
      const from=list.findIndex(x=>x.instance===sourceId);
      let to=list.findIndex(x=>x.instance===targetId);
      if(from>=0&&to>=0&&from!==to){
        const [fighter]=list.splice(from,1);
        if(from<to)to--;
        list.splice(fighterPointerDropAfter?to+1:to,0,fighter);
        r.fighters=list;
        save(true);
      }
    }
  }
  clearFighterDragVisuals();
  try{source.releasePointerCapture?.(st.pointerId)}catch(_){}
  fighterPointerStart=null;
  fighterPointerActive=false;
  fighterPointerDropTarget=null;
  fighterPointerDropAfter=false;
  setTimeout(()=>fighterPointerMoved=false,50);
  if(moved&&!cancelled)render('builder');
}

function attachFighterInteractions(){
  document.querySelectorAll('.owned-card').forEach(card=>{
    if(card.dataset.bound==='1')return;
    card.dataset.bound='1';
    card.addEventListener('pointerdown',beginFighterPointerDrag);
    card.addEventListener('pointermove',moveFighterPointerDrag);
    card.addEventListener('pointerup',e=>finishFighterPointerDrag(e,false));
    card.addEventListener('pointercancel',e=>finishFighterPointerDrag(e,true));
    card.addEventListener('click',e=>{
      if(Date.now()<fighterSuppressClickUntil||fighterPointerMoved){
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      openFighterCard(Number(card.dataset.fighterIndex));
    });
    card.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){
        e.preventDefault();
        openFighterCard(Number(card.dataset.fighterIndex));
      }
    });
  });
}
function dragStartSpell(i,e){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(i));e.currentTarget.classList.add('dragging')}
function dragOverSpell(e){e.preventDefault();e.currentTarget.classList.add('drag-over')}
function dropSpell(to,e){e.preventDefault();e.stopPropagation();const x=activeRoster()?.fighters[editingIndex];const from=Number(e.dataTransfer.getData('text/plain'));if(!x||!Number.isInteger(from)||from===to)return;const moved=(x.spells||[]).splice(from,1)[0];x.spells.splice(from<to?to-1:to,0,moved);save(true);render('fighter')}
function skillAccessFor(x){const custom=x?.customFighterId?customFighterById(x.customFighterId):null;if(custom)return {...(custom.skillAccess||{})};const f=faction(activeRoster());const w=f?.warriors.find(a=>a.id===x.wid)||f?.warriors.find(a=>a.name===String(x.name||'').replace(/\s*#\d+$/,''));const access={...(w?.skillAccess||{})};if(x.type==='Leader')access.Leadership='Primary';else if(x.type==='Champion')access.Leadership='Secondary';return access}
function gangSkillTrees(){const f=faction(activeRoster());const trees={};const factionAccess=D.skillAccess?.[f?.id]||{};Object.values(factionAccess).forEach(a=>Object.keys(a||{}).forEach(cat=>trees[cat]=true));if(f?.id)trees.Leadership=true;return trees}
function skillAccessGrid(x){const f=faction(activeRoster()),mergedSets=customMergedSkillSets(f),personal=skillAccessFor(x),allowed=gangSkillTrees(),all=[...new Set([...Object.keys(mergedSets),...Object.keys(personal)])];const regular=all.map(cat=>{const p=personal[cat];const a=allowed[cat]||!!p;const status=p|| (a?'Autorisé':'Non autorisé');const cls=p?p.toLowerCase().replace(/\s/g,'-'):a?'authorized':'locked';return `<div class="skill-access-card ${cls}"><div><strong>${esc(cat)}</strong><small>${status}</small></div><span>${a?`${(mergedSets[cat]||[]).length} compétences`:'Arbre indisponible'}</span></div>`}).join('');const mergedDomains=customMergedMagicDomains(f);const magic=magicAccessFor(x).map(d=>`<div class="skill-access-card primary magic-skill-tree"><div><strong>${esc(d)}</strong><small>Primary</small></div><span>${(mergedDomains[d]||[]).length} sorts</span></div>`).join('');return `<div class="skill-access-heading">Arbres de compétences</div><div class="skill-access-grid">${regular}</div>${magic?`<div class="skill-access-heading magic-skill-heading">Domaines de magie comptés comme arbres Primary</div><div class="skill-access-grid">${magic}</div>`:''}`}
function openSkillModal(){const x=activeRoster()?.fighters[editingIndex];if(!x)return;skillCategory='all';const mergedSets=customMergedSkillSets(faction(activeRoster())),personal=skillAccessFor(x),allowed=gangSkillTrees(),cats=[...new Set([...Object.keys(mergedSets).filter(c=>allowed[c]),...Object.keys(personal).filter(c=>personal[c])])];const catRows=cats.map(c=>`<button type="button" class="skill-modal-category" onclick="chooseSkillModalCategory('${encodeURIComponent(c)}')"><span>${esc(c)}</span><small>${personal[c]||'Autorisé'}</small></button>`).join('');const magicRows=magicAccessFor(x).map(d=>`<button type="button" class="skill-modal-category magic-category" onclick="openMagicModal('${encodeURIComponent(d)}')"><span>${esc(d)}</span><small>Primary · domaine de magie</small></button>`).join('');openModal(`<div class="skill-dialog"><div class="eyebrow">AJOUT D’UNE COMPÉTENCE</div><h2>Choisir une compétence</h2><p>Les compétences normales sont gratuites. Le domaine de magie accessible à ce combattant est traité comme un arbre Primary ; ses sorts restent enregistrés dans Magie.</p><div class="skill-modal-grid">${catRows}${magicRows}</div><div id="skillModalChoices" class="skill-modal-choices"><div class="empty compact">Choisis une catégorie.</div></div><div class="purchase-actions"><button type="button" class="button secondary" onclick="closeModal()">Fermer</button></div></div>`)}
function chooseSkillModalCategory(encoded){skillCategory=decodeURIComponent(encoded);const x=activeRoster()?.fighters[editingIndex];if(!x)return;const mergedSets=customMergedSkillSets(faction(activeRoster())),personal=skillAccessFor(x),allowed=gangSkillTrees(),owned=new Set(x.skills||[]),available=(mergedSets[skillCategory]||[]).filter(s=>!owned.has(s));const box=$('#skillModalChoices');if(!box)return;box.innerHTML=`<div class="skill-modal-choice-head"><strong>${esc(skillCategory)}</strong><span>${personal[skillCategory]||'Autorisé'}</span></div><div class="skill-modal-list">${available.length?orderedChoiceNames(available,mergedSets[skillCategory]).map(s=>`<button type="button" class="skill-modal-skill" onclick="addSkillFromModal('${encodeURIComponent(s)}')"><span>${refLink('skills',s,numberedSkillName(s,mergedSets[skillCategory]))}</span><small>Ajouter</small></button>`).join(''):'<div class="empty compact">Toutes les compétences de cet arbre sont déjà acquises.</div>'}</div>`;document.querySelectorAll('.skill-modal-category').forEach(b=>b.classList.toggle('active',b.querySelector('span')?.textContent===skillCategory))}
function addSkillFromModal(encoded){const x=activeRoster()?.fighters[editingIndex],v=decodeURIComponent(encoded);if(!x||!v)return;x.skills=x.skills||[];if(!x.skills.includes(v)){x.skills.push(v);save(true);toast(`${v} ajoutée`)}closeModal();render('fighter')}
function setSkillCategory(c){skillCategory=c;render('fighter')}
function toggleStatsPanel(){statsOpen=!statsOpen;render('fighter')}
function setFighterTab(tab){fighterTab=tab;render('fighter')}
function addSelectedSkill(){const x=activeRoster()?.fighters[editingIndex],v=decodeURIComponent($('#skillChoiceSelect')?.value||'');if(!x||!v)return;x.skills=x.skills||[];if(!x.skills.includes(v)){x.skills.push(v);save(true)}skillPickerOpen=true;render('fighter')}
function backToGang(){save(true);render('builder')}
function updateFighterField(key,val){const x=activeRoster()?.fighters[editingIndex];if(!x)return;x[key]=key==='xp'?Math.max(0,Number(val)||0):val;save(true);if(key!=='xp')render('fighter');else toast('XP mis à jour')}
function adjustFighterXP(delta){const x=activeRoster()?.fighters[editingIndex];if(!x)return;const next=Math.max(0,Number(x.xp||0)+Number(delta||0));x.xp=next;save(true);render('fighter')}
function openFighterXPAdjust(){const x=activeRoster()?.fighters[editingIndex];if(!x)return;const current=Number(x.xp||0);openModal(`<div class="resource-dialog"><div class="eyebrow">FICHE DU COMBATTANT</div><h2>Expérience (XP)</h2><p>Choisis l’opération puis indique la quantité à appliquer. La valeur actuelle est <strong>${current} XP</strong>.</p><div class="resource-mode"><button type="button" class="resource-mode-btn active" data-mode="add" onclick="selectResourceMode(this)">＋ Ajouter</button><button type="button" class="resource-mode-btn" data-mode="sub" onclick="selectResourceMode(this)">− Soustraire</button></div><input id="resourceAmount" class="resource-amount" type="number" min="0" step="1" value="1" placeholder="Quantité"><small class="resource-unit">XP</small><div class="resource-actions"><button class="button secondary" type="button" onclick="closeModal()">Annuler</button><button class="button primary" type="button" onclick="applyFighterXPAdjust()">Appliquer</button></div></div>`)}
function applyFighterXPAdjust(){const x=activeRoster()?.fighters[editingIndex],input=$('#resourceAmount');if(!x||!input)return;const n=Math.round(Number(input.value));if(!Number.isFinite(n)||n<=0){toast('Entre une valeur positive');return}const sub=document.querySelector('.resource-mode-btn.active')?.dataset.mode==='sub';const delta=sub?-n:n;x.xp=Math.max(0,Math.round(Number(x.xp||0)+delta));save(true);closeModal();render('fighter');toast(`XP ${delta>0?'+':''}${delta}`)}
function removeSkill(i){const x=activeRoster()?.fighters[editingIndex];if(!x)return;x.skills.splice(i,1);save(true);render('fighter')}
const LASTING_INJURIES=[
  {roll:'11',name:'Lesson Learned',desc:'Le combattant reste actif (pas de récupération) et gagne D3 XP.',mods:[]},
  {roll:'12–26',name:'Out Cold',desc:'Le combattant manque le reste de la bataille, sans séquelle à long terme.',mods:[]},
  {roll:'31–45',name:'Grievous Injury',desc:'Le combattant va en récupération.',mods:[]},
  {roll:'46',name:'Humiliated',desc:'Le combattant va en récupération. Commandement et Calme diminuent de 1.',mods:[{index:8,amount:-1,label:'Commandement -1'},{index:9,amount:-1,label:'Calme -1'}]},
  {roll:'51',name:'Head Injury',desc:'Le combattant va en récupération. Intelligence et Volonté diminuent de 1.',mods:[{index:11,amount:-1,label:'Intelligence -1'},{index:10,amount:-1,label:'Volonté -1'}]},
  {roll:'52',name:'Eye Injury',desc:'Le combattant va en récupération. Capacité de tir diminue de 1.',mods:[{index:2,amount:-1,label:'Capacité de tir -1'}]},
  {roll:'53',name:'Hand Injury',desc:'Le combattant va en récupération. Capacité de combat diminue de 1.',mods:[{index:1,amount:-1,label:'Capacité de combat -1'}]},
  {roll:'54',name:'Hobbled',desc:'Le combattant va en récupération. Mouvement diminue de 1.',mods:[{index:0,amount:-1,label:'Mouvement -1'}]},
  {roll:'55',name:'Spinal Injury',desc:'Le combattant va en récupération. Force diminue de 1.',mods:[{index:3,amount:-1,label:'Force -1'}]},
  {roll:'56',name:'Enfeebled',desc:'Le combattant va en récupération. Endurance diminue de 1.',mods:[{index:4,amount:-1,label:'Endurance -1'}]},
  {roll:'61–65',name:'Critical Injury',desc:'Le combattant est en état critique et doit être soigné pour survivre.',mods:[]},
  {roll:'66',name:'Memorable Death',desc:'Le combattant est tué instantanément.',mods:[]}
];
function lastingInjuryByRoll(roll){const n=Number(roll);return LASTING_INJURIES.find(i=>{const m=String(i.roll).match(/^(\d+)(?:[–-](\d+))?$/);if(!m)return false;const a=Number(m[1]),b=Number(m[2]||m[1]);return n>=a&&n<=b})||null}
function lastingInjuryIndexByName(name){return LASTING_INJURIES.findIndex(i=>refNorm(i.name)===refNorm(name))}
function injuryObjectFromResult(result){return {roll:result.roll,name:result.name,desc:result.desc,statMods:(result.mods||[]).map(m=>({index:m.index,amount:m.amount,label:m.label}))}}
function applyInjuryStatMods(x,injury,sign=1){(injury?.statMods||[]).forEach(m=>{if(Number.isInteger(m.index)&&Number.isFinite(m.amount))x.profile[m.index]=(Number(x.profile[m.index])||0)+Number(m.amount)*sign;})}
function normalizeInjuries(x){if(!x)return;const arr=Array.isArray(x.injuries)?x.injuries:[];x.injuries=arr.map(v=>{if(v&&typeof v==='object')return v;const found=LASTING_INJURIES.find(i=>refNorm(i.name)===refNorm(v));if(found){const injury=injuryObjectFromResult(found);if(Array.isArray(x.profile))applyInjuryStatMods(x,injury,1);return injury}return {roll:'',name:String(v||''),desc:'',statMods:[]};});}
function toggleInjuryPicker(){injuryPickerOpen=!injuryPickerOpen;render('fighter')}
function addInjuryResult(roll){const x=activeRoster()?.fighters[editingIndex];const result=lastingInjuryByRoll(roll);if(!x||!result)return;const r=Number(roll);if(r===11){openLessonLearnedModal();return}if(r>=12&&r<=26){injuryPickerOpen=false;lastInjuryRoll=null;render('fighter');toast('Out Cold : aucune séquelle permanente ajoutée');return}if(r>=31&&r<=45){setFighterStatus('recovery',true);injuryPickerOpen=false;lastInjuryRoll=null;render('fighter');toast('Grievous Injury : envoyé en récupération');return}if(r>=61&&r<=65){setFighterStatus('critical',true);injuryPickerOpen=false;lastInjuryRoll=null;render('fighter');toast('Critical Injury : état critique · doit être traité par un Physician');return}if(r===66){setFighterStatus('dead',true);injuryPickerOpen=false;lastInjuryRoll=null;render('fighter');toast('Memorable Death : combattant tué');return}normalizeInjuries(x);const injury=injuryObjectFromResult(result);x.injuries.push(injury);applyInjuryStatMods(x,injury,1);if(r>=46&&r<=56)setFighterStatus('recovery',true);else {save(true);injuryPickerOpen=false;lastInjuryRoll=null;render('fighter');toast(`Lasting Injury ${result.roll} · ${result.name} ajoutée`);return}save(true);injuryPickerOpen=false;lastInjuryRoll=null;render('fighter');toast(`Lasting Injury ${result.roll} · ${result.name} ajoutée · récupération`)}
function openLessonLearnedModal(){openModal(`<div class="skill-dialog"><div class="eyebrow">LASTING INJURY · 11</div><h2>Lesson Learned</h2><p>Le résultat 11 ne crée pas de Lasting Injury. Le combattant reste actif (pas de récupération) et gagne de l’XP.</p><div class="lesson-xp-choice"><label class="modal-field"><span>Ajouter directement</span><input id="lessonXpInput" class="resource-amount" type="number" min="0" max="999" step="1" value="1" placeholder="XP"></label><button type="button" class="button primary" onclick="applyLessonLearned('manual')">Ajouter l’XP</button></div><div class="lesson-xp-or">OU</div><button type="button" class="skill-modal-skill" onclick="applyLessonLearned('d3')"><span>🎲 Lancer 1D3 XP</span><small>Le résultat est ajouté automatiquement à l’XP du combattant.</small></button><div class="purchase-actions"><button type="button" class="button secondary" onclick="closeModal()">Annuler</button></div></div>`)}
function applyLessonLearned(mode){const x=activeRoster()?.fighters[editingIndex];if(!x)return;let gain=0;if(mode==='d3')gain=1+Math.floor(Math.random()*3);else{const input=$('#lessonXpInput');gain=Math.max(0,Math.floor(Number(input?.value||0)));if(!gain){input?.focus();toast('Indique une quantité d’XP');return}};x.xp=Number(x.xp||0)+gain;closeModal();save(true);injuryPickerOpen=false;lastInjuryRoll=null;render('fighter');toast(`Lesson Learned : +${gain} XP`)}
function rollLastingInjury(){const tens=Math.ceil(Math.random()*6),ones=Math.ceil(Math.random()*6);const roll=tens*10+ones;const result=lastingInjuryByRoll(roll);if(!result)return;lastInjuryRoll={roll,result};render('fighter')}
function addRolledLastingInjury(){if(!lastInjuryRoll?.result)return;addInjuryResult(lastInjuryRoll.roll);lastInjuryRoll=null}
function addInjury(){const input=$('#injuryInput');const v=(input?.value||'').trim();if(!v)return;const found=LASTING_INJURIES.find(i=>refNorm(i.name)===refNorm(v));if(found)addInjuryResult(found.roll.split(/[–-]/)[0]);else{const x=activeRoster()?.fighters[editingIndex];if(!x)return;normalizeInjuries(x);x.injuries.push({roll:'',name:v,desc:'Séquelle personnalisée',statMods:[]});save(true);render('fighter');toast('Séquelle personnalisée ajoutée')}}
function removeInjury(i){const x=activeRoster()?.fighters[editingIndex];if(!x)return;normalizeInjuries(x);const injury=x.injuries[i];if(!injury)return;applyInjuryStatMods(x,injury,-1);x.injuries.splice(i,1);save(true);render('fighter')}
function saveFighterCard(){save(true);toast('Fiche enregistrée automatiquement')}
function removeEditingFighter(){const r=activeRoster(),x=r?.fighters[editingIndex];if(!r||!x)return;openModal(`<div class="delete-dialog"><div class="eyebrow">ACTION IRRÉVERSIBLE</div><h2>Supprimer ${esc(x.name)} ?</h2><p>Ce combattant et les informations de sa fiche seront retirés de la bande. L’équipement acheté n’est pas remboursé.</p><button type="button" class="big-delete" onclick="confirmRemoveEditingFighter()">SUPPRIMER DÉFINITIVEMENT LE COMBATTANT</button><button type="button" class="button secondary full" onclick="closeModal()">Annuler</button></div>`)}
function confirmRemoveEditingFighter(){const r=activeRoster();if(!r)return;r.fighters.splice(editingIndex,1);save(true);closeModal();editingIndex=null;history.replaceState({mordheimunda:true},'',routeForView('builder'));renderCurrentRoute();toast('Combattant supprimé')}
function deleteRoster(id){if(confirm('Supprimer définitivement cette bande ?')){markDeleted('rosters',id);state.rosters=state.rosters.filter(r=>r.id!==id);state.active=state.rosters[0]?.id||null;save(true);closeModal();render('rosters')}}
function openModal(html){$('#modalContent').innerHTML=html;$('#modal').classList.remove('hidden');setTimeout(()=>document.querySelector('#modal input')?.focus(),20)}
// On touch devices, closing the modal from a tap on a button near the bottom
// of the screen (e.g. a delete-confirmation dialog) can uncover the fixed
// bottom nav bar right under the finger. The browser's synthetic "click"
// event for that same tap then fires a few ms later and lands on whatever
// nav pill is now exposed at that spot, silently navigating away (this is
// how deleting a fighter could end up on the Admin page). Swallow any
// app-route click that lands immediately after a modal close to prevent it.
let ghostClickGuardUntil=0;
function closeModal(){$('#modal').classList.add('hidden');ghostClickGuardUntil=Date.now()+600}

// Some reference traits/special rules are templated with a literal "(X)" in
// their name — e.g. "Reload (X)", "Rapid Fire (X)", "Training (X)",
// "Magic Resistance (X)". X stands for a number the player is meant to fill
// in for that particular weapon/fighter. Picking one used to paste the
// template text verbatim with no way to set the real value, so every custom
// weapon/fighter ended up with the literal, unusable "(X)". This prompts for
// the value at add-time, and keeps it editable afterward via a ✎ button.
let pendingTraitParam=null;
function isTraitParamTemplate(name){return /\(X\)\s*$/i.test(String(name||'').trim())}
function traitBaseName(name){const m=String(name||'').match(/^(.*\S)\s*\([^)]*\)\s*$/);return m?m[1]:String(name||'')}
function traitParamCurrentValue(name){const m=String(name||'').match(/\(([^)]*)\)\s*$/);return m?m[1]:''}
function isEditableParamTag(context,name){
  const withX=`${traitBaseName(name)} (X)`;
  const found=referenceFind(context==='equipment'?'traits':'special',withX);
  return !!(found&&isTraitParamTemplate(found.name));
}
function openTraitParamPrompt(context,index,templateName){
  pendingTraitParam={context,index,templateName};
  const en=siteLanguage==='en';
  const arr=context==='equipment'?customEquipmentTraitDraft:customFighterRuleDraft;
  const current=index!=null?traitParamCurrentValue(arr[index]):'';
  const label=traitBaseName(templateName);
  openModal(`<div class="trait-param-dialog"><div class="eyebrow">${en?'RULE VALUE':'VALEUR DE LA RÈGLE'}</div><h2>${esc(label)} (X)</h2><p>${en?'Enter the value for X in this rule.':'Indique la valeur de X pour cette règle.'}</p><label class="custom-field"><span>X</span><input id="traitParamValue" value="${esc(current)}" placeholder="Ex. 2"></label><div class="custom-actions"><button type="button" class="button secondary full" onclick="closeModal()">${en?'Cancel':'Annuler'}</button><button type="button" class="button primary full" onclick="confirmTraitParamValue()">${en?'Save':'Valider'}</button></div></div>`);
}
function confirmTraitParamValue(){
  if(!pendingTraitParam)return;
  const {context,index,templateName}=pendingTraitParam;
  const raw=($('#traitParamValue')?.value||'').trim();
  if(!raw){toast(siteLanguage==='en'?'Enter a value':'Indique une valeur');return}
  const finalName=`${traitBaseName(templateName)} (${raw})`;
  if(context==='equipment'){
    if(index==null){if(!customEquipmentTraitDraft.some(x=>normName(x)===normName(finalName)))customEquipmentTraitDraft.push(finalName);}
    else customEquipmentTraitDraft[index]=finalName;
    refreshCustomTraitEditor();
  }else{
    if(index==null){if(!customFighterRuleDraft.some(x=>normName(x)===normName(finalName)))customFighterRuleDraft.push(finalName);}
    else customFighterRuleDraft[index]=finalName;
    refreshCustomFighterTags('rule');
  }
  pendingTraitParam=null;
  closeModal();
}
function editTraitParamValue(context,index){
  const arr=context==='equipment'?customEquipmentTraitDraft:customFighterRuleDraft;
  const name=arr[index];if(name==null)return;
  openTraitParamPrompt(context,index,`${traitBaseName(name)} (X)`);
}


function newCustomEquipment(){customEquipmentEditId=null;customEquipmentTraitDraft=[];render('custom');setTimeout(()=>$('#customName')?.focus(),30)}
function editCustomEquipment(id){const w=customEquipmentList().find(x=>x.customEquipmentId===id);if(!w)return;customEquipmentEditId=id;customEquipmentTraitDraft=Array.isArray(w.traits)?w.traits.slice():String(w.profile?.traits||'').split(',').map(x=>x.trim()).filter(Boolean);render('custom')}
function deleteCustomEquipment(id){const w=customEquipmentList().find(x=>x.customEquipmentId===id);if(!w)return;openModal(`<div class="delete-dialog"><div class="eyebrow">SUPPRESSION D’ÉQUIPEMENT CUSTOM</div><h2>Supprimer « ${esc(w.name)} » ?</h2><p>L’équipement sera retiré de la bibliothèque custom. Les copies déjà achetées par des combattants restent présentes dans leurs fiches.</p><button type="button" class="big-delete" onclick="confirmDeleteCustomEquipment('${id}')">SUPPRIMER L’ÉQUIPEMENT</button><button type="button" class="button secondary full" onclick="closeModal()">Annuler</button></div>`)}
function confirmDeleteCustomEquipment(id){markDeleted('customEquipment',id);state.customEquipment=customEquipmentList().filter(w=>w.customEquipmentId!==id);if(customEquipmentEditId===id)customEquipmentEditId=null;save(true);closeModal();render('custom');toast('Équipement custom supprimé')}
function customEquipmentForm(w){
  const weapon=w?.type==='weapon';
  const traits=customEquipmentTraitDraft.length?customEquipmentTraitDraft:(w?.traits||[]);
  const factions=Array.isArray(w?.factions)?w.factions:[];
  const cats=['Armes de corps à corps','Armes de tir','Armure','Boucliers / défense','Drogues','Wargear','Animaux','Équipements divers'];
  return `<div class="custom-form-head"><div><div class="eyebrow">${w?'MODIFICATION':'NOUVEL ÉQUIPEMENT'}</div><h3>${esc(w?.name||'Construire un équipement')}</h3></div>${w?`<button type="button" class="button secondary" onclick="newCustomEquipment()">＋ Nouveau</button>`:''}</div>
  <div class="custom-form-grid">
    <label class="custom-field wide"><span>Nom</span><input id="customName" value="${esc(w?.name||'')}" placeholder="Ex. Hache du Waaagh!"></label>
    <label class="custom-field"><span>Type</span><select id="customType" onchange="refreshCustomForm()"><option value="equipment" ${!weapon?'selected':''}>Équipement</option><option value="weapon" ${weapon?'selected':''}>Arme</option></select></label>
    <label class="custom-field"><span>Sous-catégorie</span><select id="customCategory">${cats.map(c=>`<option value="${esc(c)}" ${c===(w?.category||'Équipements divers')?'selected':''}>${c}</option>`).join('')}</select></label>
    <label class="custom-field"><span>Rareté</span><input id="customRarity" value="${esc(w?.rarity||'')}" placeholder="Common / Rare 7 / etc."></label>
    <label class="custom-field"><span>Prix (GC)</span><input id="customPrice" type="number" min="0" step="1" value="${Number(w?.price||0)}"></label>
    <label class="custom-field wide"><span>Règles de l’équipement</span>${customTextToolbarMarkup('customRules')}<textarea id="customRules" class="wide-textarea custom-rules-textarea" rows="4" placeholder="Ex. Cette armure donne une sauvegarde de 5+.
Les règles écrites ici peuvent être interprétées par le système lorsqu’elles correspondent à une valeur de jeu reconnue.">${esc(w?.rulesText||'')}</textarea><small class="custom-field-help">Tu peux écrire les règles librement. Certaines valeurs reconnues, comme « sauvegarde de 5+ », sont automatiquement prises en compte dans la fiche du combattant. Évite de couper une valeur reconnue au milieu d’une mise en forme.</small></label>
  </div>
  <div id="customWeaponFields">${weapon?customWeaponEditor(w):''}</div>
  <div class="custom-section"><div class="custom-section-head"><div><span class="micro-label">DISPONIBILITÉ</span><strong>Listes auxquelles l’équipement est ajouté</strong></div><small>Une affectation à une bande n’enlève pas l’objet de l’Unrestricted List.</small></div>
    <label class="custom-check unrestricted-check"><input id="customUnrestricted" type="checkbox" checked disabled> <span><b>Unrestricted List</b><small>Toujours disponible dans la liste générale. Les factions choisies ci-dessous ajoutent aussi l’objet à leur Band List.</small></span></label>
    <label class="custom-check market-check"><input id="customMarketList" type="checkbox" ${w?.market?'checked':''}> <span><b>Market List</b><small>Ajoute aussi l’objet à la Market List, accessible à toutes les bandes lors des achats post-bataille.</small></span></label>
    <div class="custom-faction-grid">${D.factions.map(f=>`<label class="custom-check"><input class="customFaction" data-faction="${esc(f.id)}" type="checkbox" ${factions.includes(f.id)?'checked':''}><span>${esc(f.displayName)}</span></label>`).join('')}</div>
  </div>
  <div class="custom-actions"><button type="button" class="button secondary" onclick="resetCustomForm()">Réinitialiser</button><button type="button" class="button primary" onclick="saveCustomEquipment()">${w?'Enregistrer les modifications':'Créer l’équipement'}</button></div>`
}
function customWeaponEditor(w){
  const p=w?.profile||{};
  return `<div class="custom-section weapon-builder"><div class="custom-section-head"><div><span class="micro-label">PROFIL DE L’ARME</span><strong>Caractéristiques</strong></div><span class="custom-live-badge">APERÇU EN DIRECT</span></div>
    <div class="custom-weapon-grid"><label class="custom-field"><span>Portée</span><input id="customRange" value="${esc(p.range||'')}" placeholder="Melee 2 / 12\""></label><label class="custom-field"><span>Force</span><input id="customStrength" value="${esc(p.strength||'')}" placeholder="S / S+1 / 2D6…"></label><label class="custom-field"><span>AP</span><input id="customAp" value="${esc(p.ap||'')}" placeholder="- / -1 / +1…"></label><label class="custom-field"><span>Dégâts</span><input id="customDamage" value="${esc(p.damage||'')}" placeholder="1 / 2 / D3…"></label></div>
    <div class="custom-trait-editor"><div class="custom-section-head"><div><span class="micro-label">TRAITS</span><strong>Traits de l’arme</strong></div><small>Écris un trait existant pour créer un lien vers sa règle.</small></div><div id="customTraitTags" class="custom-trait-tags">${customTraitTagsMarkup()}</div><div class="custom-trait-add"><input id="customTraitInput" list="customTraitDatalist" placeholder="Rechercher un trait…" onkeydown="handleCustomTraitKey(event)"><datalist id="customTraitDatalist">${referenceEntries('traits').map(t=>`<option value="${esc(t.name)}">`).join('')}</datalist><button type="button" class="button secondary" onclick="addCustomTrait()">＋ Ajouter</button></div></div>
    <div class="custom-weapon-preview" id="customWeaponPreview">${customPreviewMarkup(w||{name:$('#customName')?.value||'Nouvelle arme',profile:p,traits:customEquipmentTraitDraft})}</div>
  </div>`
}
function customTraitTagsMarkup(){return customEquipmentTraitDraft.map((t,i)=>`<span class="custom-trait-tag">${refLink('traits',t,t)}${isEditableParamTag('equipment',t)?`<button type="button" title="Modifier la valeur" class="trait-tag-edit" onclick="editTraitParamValue('equipment',${i})">✎</button>`:''}<button type="button" title="Retirer" onclick="removeCustomTrait(${i})">×</button></span>`).join('')||'<span class="custom-trait-empty">Aucun trait ajouté.</span>'}
function customPreviewMarkup(w){if(!w?.profile)return '<div class="custom-nonweapon-preview"><span>APERÇU</span><strong>Équipement non armé</strong><small>Le profil d’arme apparaîtra automatiquement si le type est changé en Arme.</small></div>';return weaponProfileMarkup({...w,customEquipmentId:'preview',profile:{...w.profile,traits:customEquipmentTraitDraft.join(', ')}}).replace(/data-ref-category="equipment"[^>]*>/g,'>')}
function refreshCustomForm(){const type=$('#customType')?.value;const box=$('#customWeaponFields');if(!box)return;box.innerHTML=type==='weapon'?customWeaponEditor({name:$('#customName')?.value||'Nouvelle arme',profile:{range:$('#customRange')?.value||'',strength:$('#customStrength')?.value||'',ap:$('#customAp')?.value||'',damage:$('#customDamage')?.value||''},traits:customEquipmentTraitDraft}):''}
function refreshCustomTraitEditor(){const tags=$('#customTraitTags');if(tags)tags.innerHTML=customTraitTagsMarkup();const preview=$('#customWeaponPreview');if(preview){const w={name:$('#customName')?.value||'Nouvelle arme',profile:{range:$('#customRange')?.value||'',strength:$('#customStrength')?.value||'',ap:$('#customAp')?.value||'',damage:$('#customDamage')?.value||''},traits:customEquipmentTraitDraft};preview.innerHTML=customPreviewMarkup(w)}}
function addCustomTrait(){const input=$('#customTraitInput');const v=(input?.value||'').trim();if(!v)return;const found=referenceFind('traits',v);const canonical=found?.name||v;if(isTraitParamTemplate(canonical)){input.value='';openTraitParamPrompt('equipment',null,canonical);return}if(!customEquipmentTraitDraft.some(t=>normName(t)===normName(canonical)))customEquipmentTraitDraft.push(canonical);input.value='';refreshCustomTraitEditor();setTimeout(()=>{$('#customTraitInput')?.focus()},20)}
function handleCustomTraitKey(e){if(e.key==='Enter'){e.preventDefault();addCustomTrait()}}
function removeCustomTrait(i){customEquipmentTraitDraft.splice(i,1);refreshCustomTraitEditor()}
function resetCustomForm(){customEquipmentEditId=null;customEquipmentTraitDraft=[];render('custom')}
function saveCustomEquipment(){
  const name=($('#customName')?.value||'').trim(),type=$('#customType')?.value||'equipment',category=$('#customCategory')?.value||'Équipements divers',rarity=($('#customRarity')?.value||'').trim(),price=Math.max(0,Number($('#customPrice')?.value||0));
  if(!name){toast('Donne un nom à l’équipement');return} if(!Number.isFinite(price)){toast('Prix invalide');return}
  const factions=[...document.querySelectorAll('.customFaction:checked')].map(x=>x.dataset.faction);const unrestricted=true;
  const market=!!$('#customMarketList')?.checked;
  const rulesText=($('#customRules')?.value||'').trim();
  const item={customEquipmentId:customEquipmentEditId||crypto.randomUUID(),name,type,category,subcategory:category,rarity,price,unrestricted,market,factions,traits:customEquipmentTraitDraft.slice(),rulesText};
  if(type==='weapon'){item.profile={range:($('#customRange')?.value||'').trim(),strength:($('#customStrength')?.value||'').trim(),ap:($('#customAp')?.value||'').trim(),damage:($('#customDamage')?.value||'').trim(),traits:customEquipmentTraitDraft.join(', ')};item.weaponSlotCost=weaponSlots(item);item.customArmor=false}else item.profile=null;
  if(category==='Armure'&&!item.profile)item.customArmor=true;
  const idx=state.customEquipment.findIndex(w=>w.customEquipmentId===item.customEquipmentId);item.archived=idx>=0?!!state.customEquipment[idx].archived:false;if(idx>=0)state.customEquipment[idx]=item;else state.customEquipment.push(item);
  customEquipmentEditId=item.customEquipmentId;save(true);render('custom');toast(idx>=0?'Équipement custom modifié':'Équipement custom créé');
}
function setCustomEquipmentSearch(v){customEquipmentSearch=v;render('custom')}
function toggleCustomEquipmentArchive(id){const w=customEquipmentList().find(x=>x.customEquipmentId===id);if(!w)return;w.archived=!w.archived;save(true);render('custom');toast(w.archived?'Équipement archivé':'Équipement désarchivé')}
function customEquipmentRow(w){
  // Library rows are a picklist, not a fiche: just enough to identify the
  // item (name / catégorie / prix). Faction access and rule text are shown
  // once, in the editor itself (✎), not duplicated here — same principle
  // as the custom fighter and traits/rules rows.
  return `<article class="custom-item-row${w.archived?' is-archived':''}"><div class="custom-item-main"><div class="custom-item-icon">${w.type==='weapon'?'⚔':'◆'}</div><div><strong>${esc(w.name)}</strong><small>${w.archived?'<span class="archived-tag">ARCHIVÉ</span> · ':''}${esc(w.category)} · ${Number(w.price||0)} GC${w.rarity?' · '+esc(w.rarity):''}</small></div></div><div class="custom-item-actions"><button type="button" class="equipment-action" title="${w.archived?'Désarchiver':'Archiver'}" onclick="toggleCustomEquipmentArchive('${w.customEquipmentId}')">${w.archived?'⇤':'🗄'}</button><button type="button" class="equipment-action" onclick="editCustomEquipment('${w.customEquipmentId}')">✎</button><button type="button" class="equipment-action remove" onclick="deleteCustomEquipment('${w.customEquipmentId}')">🗑</button></div></article>`}


// --- V58 custom equipment integration / rule parsing ---
function customSaveFromRulesText(w){
  if(!isCustomEquipment(w)) return null;
  const text=String(w.rulesText||'');
  const m=text.match(/(?:sauvegarde|save|sv)\s*(?:de|:)?\s*(\d+)\s*\+/i);
  return m ? `${m[1]}+` : null;
}
function customRuleStatIndex(name){
  const n=normName(name);
  const map={mouvement:0,m:0,ws:1,cc:1,'capacitédecombat':1,bs:2,'capacitédetir':2,force:3,s:3,endurance:4,t:4,blessures:5,w:5,initiative:6,i:6,attaques:7,a:7,leadership:8,ld:8,commandement:8,calme:9,cl:9,wil:10,volonté:10,intelligence:11,int:11};
  return map[n];
}
function customEquipmentEffects(w){
  if(!isCustomEquipment(w))return {stats:[],skills:[]};
  return effectsFromRuleText(w.rulesText);
}
// Shared free-text rule interpreter: given a rule's written text (an
// equipment's rulesText, or a warband-wide special rule/trait's text),
// detects stat modifiers ("Leadership -1", "réduit son Endurance de 1") and
// granted skills ("gagne la compétence Bull Charge"). Used both for
// per-equipment effects (customEquipmentEffects, above) and for warband-wide
// rule effects (syncWarbandRuleEffects, below) so the two behave identically.
function effectsFromRuleText(text){
  text=String(text||'');
  const stats=[];
  const statNames='Mouvement|Movement|M|WS|CC|Capacité de combat|BS|CT|Capacité de tir|Force|S|Endurance|T|Blessures|W|Initiative|I|Attaques|A|Leadership|LD|Commandement|Calme|CL|Volonté|WIL|Intelligence|INT';
  const re=new RegExp('(?:réduit|reduit|diminue|baisse|augmente|augmente de|modifie|modifié|modifier|gagne|perd|ajoute|ajout)\\s+(?:son|sa|ses|le|la|les)?\\s*('+statNames+')\\s*(?:de|à|a)?\\s*([+-]?\\d+)', 'gi');
  let m;while((m=re.exec(text))){const idx=customRuleStatIndex(m[1]);if(idx!=null){let amount=Number(m[2]);const lead=m[0].toLowerCase();if(/réduit|reduit|diminue|baisse|perd/.test(lead))amount=-Math.abs(amount);stats.push({index:idx,amount});}}
  // Also accept concise forms such as "Leadership -3" or "Leadership +2".
  const re2=new RegExp('\\b('+statNames+')\\s*([+-]\\d+)','gi');while((m=re2.exec(text))){const idx=customRuleStatIndex(m[1]);if(idx!=null)stats.push({index:idx,amount:Number(m[2])});}
  const skills=[];
  const addSkillCandidate=(candidate)=>{
    let c=String(candidate||'').trim().replace(/^[\s:;–—-]+|[\s:;,.!?–—-]+$/g,'').trim();
    c=c.replace(/^(?:le|la|les|un|une)\s+(?:skill|compétence|competence|talent)\s+/i,'').trim();
    const found=referenceFind('skills',c);
    if(found&&!skills.some(x=>refNorm(x)===refNorm(found.name)))skills.push(found.name);
  };
  // Natural formulations: "a le skill Bull Charge", "gagne Bull Charge",
  // "gagne : Bull Charge", "obtient la compétence Bull Charge", etc.
  const skillRe=/(?:le\s+combattant|le\s+porteur|il|elle)?\s*(?:a|possède|possede|gagne|obtient|acquiert|donne(?:\s+au\s+porteur)?)\s*(?::|\s)*(?:(?:le|la|les)\s+(?:skill|compétence|competence|talent)\s+)?([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÿ'’ -]+?)(?=\.|$|\n)/gi;
  let sm;
  while((sm=skillRe.exec(text)))addSkillCandidate(sm[1]);

  // Reliable fallback: if a granting verb is present, look for an exact
  // existing skill name anywhere in the following part of the rule.
  if(/(?:gagne|obtient|acquiert|possède|possede|a|donne)/i.test(text)){
    referenceEntries('skills').forEach(entry=>{
      const name=String(entry.name||'').trim();
      if(!name)return;
      const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const reSkill=new RegExp('(?:gagne|obtient|acquiert|possède|possede|a|donne)[^\\n.]{0,80}\\b'+escaped+'\\b','i');
      if(reSkill.test(text))addSkillCandidate(name);
    });
  }
  return {stats,skills};
}
function standardEquipmentStatEffects(w){
  const n=normName(w?.name);
  const out=[];
  // These are unconditional profile modifiers stated directly by the M17 equipment rules.
  if(n==='full plate armour'||n==='full plate armor'){
    out.push({index:2,amount:-1}); // BS
    out.push({index:6,amount:-1}); // Initiative
  }else if(n==='heavy armour'||n==='heavy armor'){
    out.push({index:6,amount:-1}); // Initiative
  }else if(n==='sigmarite armour'||n==='sigmarite armor'){
    out.push({index:6,amount:-1}); // Initiative
  }else if(n==='laudanum'){
    out.push({index:6,amount:-1}); // Initiative
  }else if(n==='war trophies'){
    out.push({index:1,amount:+1}); // WS
  }
  return out;
}
function standardEquipmentSpecialRules(x){
  const eq=x?.equipmentSelected||[];
  const out=[];
  const baseRules=Array.isArray(x?.ruleNames)?x.ruleNames:[];
  const hasMR=baseRules.find(n=>{const m=String(n).match(/^Magic Resistance\s*\((\d+)\)$/i);return !!m;});
  let mr=hasMR?Number(String(hasMR).match(/\((\d+)\)/)?.[1]):null;
  if(eq.some(e=>{const n=normName(e.name);return n==='sigmarite armour'||n==='sigmarite armor';}))mr=mr==null?5:Math.min(mr,5);
  const amulets=eq.filter(e=>normName(e.name)==='amulet of protection').length;
  if(amulets){
    mr=mr==null?6:Math.max(1,mr-amulets);
  }
  if(mr!=null)out.push(`Magic Resistance (${mr})`);
  return out;
}
function syncCustomEquipmentEffects(x){
  if(!x||!Array.isArray(x.equipmentSelected))return;
  const previous=Array.isArray(x.customEquipmentStatMods)?x.customEquipmentStatMods:[];
  if(!Array.isArray(x.profile))return;
  previous.forEach(m=>{if(Number.isInteger(m.index)&&Number.isFinite(m.amount))x.profile[m.index]-=Number(m.amount);});
  const oldGranted=Array.isArray(x.customEquipmentGrantedSkills)?x.customEquipmentGrantedSkills.slice():[];
  const desiredStats=[];const desiredSkills=[];
  x.equipmentSelected.forEach(e=>{
    standardEquipmentStatEffects(e).forEach(m=>desiredStats.push({...m,itemId:e.name}));
    const fx=customEquipmentEffects(e);
    fx.stats.forEach(m=>desiredStats.push({...m,itemId:e.customEquipmentId||e.name}));
    fx.skills.forEach(skill=>desiredSkills.push({skill,itemId:e.customEquipmentId||e.name}));
  });
  desiredStats.forEach(m=>{x.profile[m.index]=(Number(x.profile[m.index])||0)+Number(m.amount);});
  const desiredSkillNames=[...new Set(desiredSkills.map(s=>s.skill))];
  x.skills=Array.isArray(x.skills)?x.skills:[];
  oldGranted.forEach(skill=>{if(!desiredSkillNames.some(s=>refNorm(s)===refNorm(skill)))x.skills=x.skills.filter(s=>refNorm(s)!==refNorm(skill));});
  desiredSkillNames.forEach(skill=>{if(!x.skills.some(s=>refNorm(s)===refNorm(skill)))x.skills.push(skill);});
  x.customEquipmentStatMods=desiredStats.map(({index,amount})=>({index,amount}));
  x.customEquipmentGrantedSkills=desiredSkillNames;
}
// Rules attached to the WARBAND itself (not to one specific fighter or
// weapon) — e.g. "all models in this warband have Fear", "Leadership -1 for
// every fighter". For a custom warband these are exactly cw.specialRuleIds/
// traitIds (the "Règles spéciales"/"Traits" tabs of its editor). For an
// officialized warband, f.specialRules/f.traits is a flat union of BAND-WIDE
// rules together with every fighter's own rules and every weapon's own
// traits (see bundleCustomContentForOfficialize) — f.bandRuleNames is the
// subset of names that were actually band-wide picks, so only those are
// used here; without it (older/legacy published warbands), nothing is
// auto-applied rather than risking applying everyone's individual rules to
// the whole roster.
function warbandRuleEntries(r){
  if(r?.customWarbandId){
    const cw=customWarbandById(r.customWarbandId);
    if(!cw)return [];
    const out=[];
    (cw.specialRuleIds||[]).forEach(id=>{const e=customContentById('special',id);if(e)out.push({name:e.name,text:e.text||'',category:'special'});});
    (cw.traitIds||[]).forEach(id=>{const e=customContentById('traits',id);if(e)out.push({name:e.name,text:e.text||'',category:'traits'});});
    return out;
  }
  const f=D.factions.find(x=>x.id===r?.factionId);
  if(!f)return [];
  const bandNames=new Set((f.bandRuleNames||[]).map(normName));
  if(!bandNames.size)return [];
  const out=[];
  (f.specialRules||[]).forEach(t=>{if(t?.name&&bandNames.has(normName(t.name)))out.push({name:t.name,text:t.text||'',category:'special'});});
  (f.traits||[]).forEach(t=>{if(t?.name&&bandNames.has(normName(t.name)))out.push({name:t.name,text:t.text||'',category:'traits'});});
  return out;
}
// Small read-only display of the warband's own rules on the gang page, so
// their automatic effects (applied by syncWarbandRuleEffects below) aren't
// invisible — each name is a refLink, so hovering/tapping shows the full
// rule text exactly like any other reference tag in the app.
function warbandRulesMarkup(r){
  const entries=warbandRuleEntries(r);
  if(!entries.length)return '';
  return `<div class="warband-rules-line"><span class="warband-rules-label">${siteLanguage==='en'?'WARBAND RULES':'RÈGLES DE LA BANDE'}</span>${entries.map(e=>`<span class="warband-rule-tag">${refLink(e.category,e.name,e.name)}</span>`).join('')}</div>`;
}
// "Règles de bande" tab: a read-only panel listing every band-wide rule in
// full (not just as tags, unlike warbandRulesMarkup above) plus a deep-link
// back into Custom to manage the selection, and an editable free-text notes
// zone the player fills in themselves (capped at 2000 characters).
function warbandRulesView(r){
  const en=siteLanguage==='en';
  const entries=warbandRuleEntries(r);
  const canManage=!!r.customWarbandId;
  const notes=String(r.notes||'');
  const cap=2000;
  const rulesBlock=entries.length?`<div class="rule-select-list">${entries.map(e=>`<div class="rule-select-card"><div class="rule-select-head"><span class="rule-select-name">${refLink(e.category,e.name,e.name)}</span><span class="rule-select-origin">${e.category==='traits'?(en?'Trait':'Trait'):(en?'Special Rule':'Règle spéciale')}</span></div><div class="rule-select-text">${esc(e.text||(en?'No rule text recorded.':'Aucun texte de règle enregistré.'))}</div></div>`).join('')}</div>`
    :`<div class="rb-empty">${canManage?(en?'No warband rules selected yet.':'Aucune règle de bande sélectionnée pour l’instant.'):(en?'This warband has no band-wide rules.':'Cette bande n’a pas de règles de bande.')}</div>`;
  const manageLink=canManage?`<a class="rb-manage-link" href="javascript:void(0)" onclick="openWarbandRulesInCustom('${esc(r.customWarbandId)}')">${en?'Manage selection in Custom →':'Gérer la sélection dans Custom →'}</a>`:'';
  return `<div class="roster-toolbar"><div><div class="eyebrow">${en?'WARBAND':'BANDE'}</div><h3>${en?'Warband Rules':'Règles de bande'}</h3><p>${en?'General rules that apply to the warband as a whole, plus your own notes for this band.':'Règles générales qui s’appliquent à l’ensemble de la bande, ainsi que tes propres notes pour cette bande.'}</p></div></div>
  <div class="rb-section-head"><h4>${en?'Selected rules':'Règles sélectionnées'}</h4>${manageLink}</div>
  ${rulesBlock}
  <div class="rb-section-head" style="margin-top:24px"><h4>${en?'Band notes':'Notes de bande'}</h4></div>
  <div class="notes-box-wrap">
    <textarea class="wide-textarea notes-box" maxlength="${cap}" placeholder="${en?'Write any notes, custom fluff or house-rules for this warband here…':'Écris ici toute note, fluff personnalisé ou règle maison pour cette bande…'}" oninput="$('#rbNotesCount').textContent=this.value.length" onchange="updateRosterField('notes',this.value)">${esc(notes)}</textarea>
    <div class="notes-foot"><span class="notes-counter"><span id="rbNotesCount">${notes.length}</span>/${cap}</span><span class="notes-hint">${en?'Saved automatically.':'Enregistré automatiquement.'}</span></div>
  </div>`;
}
function updateRosterField(key,val){const r=activeRoster();if(!r)return;r[key]=val;save(true);}
function openWarbandRulesInCustom(cwId){
  if(!customWarbandById(cwId))return;
  customContentTab='warband';customContentSearch='';customBuilderResetComposer();
  customWarbandEditId=cwId;customWarbandCreating=false;customWarbandSection='special';
  render('custom');
}
// Applies every warband-wide rule's stat modifiers/granted skills to a
// SINGLE fighter, the same way syncCustomEquipmentEffects does for gear —
// tracked under its own field names (x.warbandRuleStatMods/
// x.warbandRuleGrantedSkills) so the two effect sources never clash and can
// each be recomputed from scratch on every call without double-applying.
function syncWarbandRuleEffects(x,r){
  if(!x||!Array.isArray(x.profile))return;
  const previous=Array.isArray(x.warbandRuleStatMods)?x.warbandRuleStatMods:[];
  previous.forEach(m=>{if(Number.isInteger(m.index)&&Number.isFinite(m.amount))x.profile[m.index]-=Number(m.amount);});
  const oldGranted=Array.isArray(x.warbandRuleGrantedSkills)?x.warbandRuleGrantedSkills.slice():[];
  const desiredStats=[];const desiredSkillSet=new Set();
  warbandRuleEntries(r).forEach(entry=>{
    const fx=effectsFromRuleText(entry.text);
    fx.stats.forEach(m=>desiredStats.push(m));
    fx.skills.forEach(s=>desiredSkillSet.add(s));
  });
  desiredStats.forEach(m=>{x.profile[m.index]=(Number(x.profile[m.index])||0)+Number(m.amount);});
  const desiredSkillNames=[...desiredSkillSet];
  x.skills=Array.isArray(x.skills)?x.skills:[];
  oldGranted.forEach(skill=>{if(!desiredSkillNames.some(s=>refNorm(s)===refNorm(skill)))x.skills=x.skills.filter(s=>refNorm(s)!==refNorm(skill));});
  desiredSkillNames.forEach(skill=>{if(!x.skills.some(s=>refNorm(s)===refNorm(skill)))x.skills.push(skill);});
  x.warbandRuleStatMods=desiredStats.map(({index,amount})=>({index,amount}));
  x.warbandRuleGrantedSkills=desiredSkillNames;
}
function armorSave(x){
  const eq=x?.equipmentSelected||[];
  const customSaves=eq.map(e=>customSaveFromRulesText(e)).filter(Boolean);
  const names=eq.map(e=>normName(e.name));
  let base=null;
  if(names.includes('full plate armour')||names.includes('full plate armor')||names.includes('gromril plate')||names.includes('gromril plate armour')||names.includes('gromril plate armor'))base='4+';
  else if(names.includes('heavy armour')||names.includes('heavy armor'))base='5+';
  else if(names.includes('light armour')||names.includes('light armor'))base='6+';
  else if(names.includes('ithilmar')||names.includes('ithilmar mail')||names.includes('ithilmar armour')||names.includes('ithilmar armor'))base='5+';
  else if(names.includes('sigmarite armour')||names.includes('sigmarite armor')||names.includes('chaos armour')||names.includes('chaos armor'))base='5+';
  if(customSaves.length){
    const vals=customSaves.map(s=>parseInt(s,10)).filter(Number.isFinite);
    const best=Math.min(...vals);
    base=`${best}+`;
  }
  const shield=names.includes('shield');
  if(!base&&!shield)return '—';
  if(!base&&shield)return '6+/5+';
  if(shield){const n=Number(base[0]);return `${base}/${Math.max(2,n-1)}+`;}
  return base;
}
function equipmentCategory(w){return w.category||w.subcategory||'Équipements divers'}
function customEquipmentList(){if(!Array.isArray(state.customEquipment))state.customEquipment=[];state.customEquipment.forEach(w=>{if(w.category==='Armures')w.category='Armure';if(w.subcategory==='Armures')w.subcategory='Armure';if(w.category==='Armure'&&!w.profile)w.customArmor=true;});return state.customEquipment}
// Any custom equipment item that belongs to a warband already officialized
// (cw.officialId set — see officializeCustomWarband / importOfficialWarbandForEditing)
// is "published" content: still fully editable here, but visually noisy if it
// stays mixed in with equipment the user hasn't published yet. Gathered as an
// id set so the Custom > Équipements library can tuck those into their own
// collapsed section instead of overwhelming the active list.
function officializedEquipmentIdSet(){
  const ids=new Set();
  customWarbandList().forEach(cw=>{if(cw.officialId)(cw.equipmentIds||[]).forEach(id=>ids.add(id));});
  return ids;
}
// Same idea, for custom fighter profiles (Custom > Profils): those are
// tracked on the warband via cw.fighterIds, same as equipment, so this
// mirrors officializedEquipmentIdSet exactly.
function officializedFighterIdSet(){
  const ids=new Set();
  customWarbandList().forEach(cw=>{if(cw.officialId)(cw.fighterIds||[]).forEach(id=>ids.add(id));});
  return ids;
}
// Same idea as officializedEquipmentIdSet, but for traits / skills / spells /
// special rules: those aren't tracked on the warband via a simple id array
// (they're only ever resolved indirectly, from what its fighters/equipment
// reference — see bundleCustomContentForOfficialize), so this reruns that
// same bundling for every officialized warband and maps the resulting names
// back to customContentIds. Used to tuck already-published content into its
// own collapsed "OFFICIALISÉS" folder in the Custom library, same as
// equipment, instead of leaving it mixed in with unpublished entries.
function officializedContentIdSets(){
  const out={traits:new Set(),skills:new Set(),spells:new Set(),special:new Set()};
  customWarbandList().forEach(cw=>{
    if(!cw.officialId)return;
    let bundle;
    try{bundle=bundleCustomContentForOfficialize(cw,customWarbandFaction(cw));}catch(e){return;}
    const map=(kind,list)=>{
      (list||[]).forEach(entry=>{
        const found=customContentList(kind).find(x=>normName(x.name)===normName(entry.name));
        if(found)out[kind].add(found.customContentId);
      });
    };
    map('traits',bundle.traits);
    map('skills',bundle.skills);
    map('spells',bundle.spells);
    map('special',bundle.specialRules);
  });
  return out;
}
// Custom equipment an admin bundled while officializing a warband: unlike
// state.customEquipment (per-user, editable), this is read-only content
// merged from D.factions' official entries, available to every account —
// same object shape, still gated by its (server-rescoped) `.factions` field.
function officialCustomEquipmentList(){
  const out=[],seen=new Set();
  (D.factions||[]).forEach(f=>{
    if(!f.__official)return;
    (f.equipment||[]).forEach(w=>{
      if(!w?.customEquipmentId)return;
      const key=normName(w.name);if(seen.has(key))return;seen.add(key);
      out.push(w);
    });
  });
  return out;
}
function isCustomEquipment(w){return !!w?.customEquipmentId}
function customEquipmentByName(name){const n=normName(name);return customEquipmentList().find(w=>normName(w.name)===n)||officialCustomEquipmentList().find(w=>normName(w.name)===n)||null}
function customEquipmentForFaction(w,fid){if(!isCustomEquipment(w)||!fid)return false;const target=normName(fid);const factionObj=D.factions.find(f=>normName(f.id)===target||normName(f.displayName)===target);const targetId=normName(factionObj?.id||fid);const targetName=normName(factionObj?.displayName||fid);return Array.isArray(w.factions)&&w.factions.some(id=>{const n=normName(id);return n===targetId||n===targetName||normName(D.factions.find(f=>normName(f.id)===n)?.displayName)===targetName})}
function equipmentPrice(w,f,tab=equipmentTab){if(w.bandOnlyIntrinsic)return 0;if(isCustomEquipment(w))return Number(w.price||0);if(tab==='band'&&w.bandPrices?.[f.id]!=null)return Number(w.bandPrices[f.id]);return w.price}
function isWeaponLike(w){return !!w.profile&&w.category!=='Équipements divers'&&w.category!=='Animaux'}
function equipmentPeekFind(name){
  const n=normName(decodeURIComponent(String(name||'')));
  if(n==='natural weapons'){
    return {name:'Natural Weapons',category:'Armes de corps à corps',bandOnlyIntrinsic:true,
      profile:{range:'Melee 2',strength:'S',ap:'-',damage:'1',traits:'Natural weapon — ne prend pas d’emplacement'}};
  }
  return D.weapons.find(w=>normName(w.name)===n)||customEquipmentByName(n)||null;
}
function equipmentPeekText(w){
  if(isCustomEquipment(w))return String(w.rulesText||'').trim();
  const e=referenceFind('equipment',w?.name);
  return String(e?.text||'').trim();
}
function equipmentPeekProfileMarkup(w){
  const p=w?.profile;
  if(!p||(!p.range&&!p.strength&&!p.ap&&!p.damage&&!p.traits))return '';
  return `<div class="equipment-peek-profile">
    <span>Portée<b>${esc(p.range||'—')}</b></span>
    <span>Force<b>${esc(p.strength||'—')}</b></span>
    <span>AP<b>${esc(p.ap||'—')}</b></span>
    <span>Dégâts<b>${esc(p.damage||'—')}</b></span>
    <span class="equipment-peek-traits">Traits<b>${refTraitList(p.traits||'—')}</b></span>
  </div>`;
}
function showEquipmentPeek(el){
  clearTimeout(rulePeekTimer);
  activeRulePeek=el;
  const w=equipmentPeekFind(el.dataset.equipmentName||'');
  if(!w)return;
  let pop=$('#rulePeek');
  if(!pop){
    pop=document.createElement('div');pop.id='rulePeek';pop.className='rule-peek';
    pop.onmouseenter=cancelHideRulePeek;pop.onmouseleave=scheduleHideRulePeek;
    document.body.appendChild(pop);
  }
  const text=equipmentPeekText(w);
  pop.innerHTML=`<div class="rule-peek-kicker">${esc(equipmentCategory(w))}</div>
    <strong>${esc(w.name)}</strong>
    ${equipmentPeekProfileMarkup(w)}
    ${text?`<div class="equipment-peek-rules">${referenceTextMarkup(text)}</div>`:'<div class="equipment-peek-rules muted">Aucune règle détaillée enregistrée.</div>'}
    <button type="button" class="rule-peek-open" onclick="openEquipmentReferenceFromPeek(event)">${text?'Ouvrir dans le référentiel →':'Voir la fiche →'}</button>`;
  pop.classList.add('visible');
  requestAnimationFrame(()=>positionRulePeek(el));
}
function toggleEquipmentPeek(el,event){
  event?.stopPropagation();
  if(activeRulePeek===el&&$('#rulePeek')?.classList.contains('visible')){
    $('#rulePeek').classList.remove('visible');activeRulePeek=null;return;
  }
  showEquipmentPeek(el);
}
function openEquipmentReferenceFromPeek(event){
  event?.stopPropagation();
  const el=activeRulePeek;
  if(!el)return;
  const w=equipmentPeekFind(el.dataset.equipmentName||'');
  const ref=w?referenceFind('equipment',w.name):null;
  if(ref)openReference('equipment',ref.id);
}
function equipmentPicker(x,equip){
  const f=faction(activeRoster()),tabs=[['band','Band List'],['market','Market List'],['unrestricted','Unrestricted List']];
  const cats=['all',...new Set([...D.weapons,...customEquipmentList(),...officialCustomEquipmentList()].map(equipmentCategory))];
  const ws=equipmentPool(equipmentTab,x).filter(w=>fighterUsesLoadouts(x)||!equip.some(e=>e.name===w.name));
  return `<div class="equipment-picker"><div class="equipment-tabs">${tabs.map(([id,label])=>`<button type="button" class="equipment-tab ${equipmentTab===id?'active':''}" onclick="setEquipmentTab('${id}')">${label}<span>${equipmentPool(id,x).length}</span></button>`).join('')}</div><div class="equipment-search-row"><input class="search equipment-search" id="equipmentSearch" value="${esc(equipmentSearch)}" placeholder="Rechercher rapidement…" oninput="setEquipmentSearch(this.value)"></div><div class="equipment-rule-note">Armure : une seule armure de protection. Un bouclier peut se cumuler avec une armure. Une fourrure/cape de fourrure peut se cumuler avec une armure, mais pas avec un bouclier. Buckler, Main Gauche et Sword Breaker utilisent des emplacements d’armes.</div><div class="equipment-categories">${cats.map(c=>`<button type="button" class="equipment-cat ${equipmentCategoryFilter===c?'active':''}" onclick="setEquipmentCategory('${c}')">${c==='all'?'Toutes':c}</button>`).join('')}</div><div class="equipment-market-list">${ws.length?ws.map(w=>`<button type="button" class="equipment-choice" onclick="confirmEquipment('${encodeURIComponent(w.name)}')"><span class="equipment-choice-main"><span class="equipment-choice-name" data-equipment-name="${esc(encodeURIComponent(w.name))}" onmouseenter="showEquipmentPeek(this)" onmouseleave="scheduleHideRulePeek()" onfocus="showEquipmentPeek(this)" onblur="scheduleHideRulePeek()" onclick="toggleEquipmentPeek(this,event)">${esc(w.name)}</span><small>${esc(equipmentCategory(w))}${w.availability&&w.availability!=='—'?' · '+esc(w.availability):''}${w.rarity?' · '+esc(w.rarity):''}</small></span><strong>${w.bandOnlyIntrinsic?'Inné':(equipmentPrice(w,f,equipmentTab)==null?'—':equipmentPrice(w,f,equipmentTab)+' GC')}</strong></button>`).join(''):'<div class="empty compact">Aucun équipement accessible dans cette liste.</div>'}</div></div>`;
}
function confirmEquipment(encoded){
  const name=decodeURIComponent(encoded),x=activeRoster().fighters[editingIndex],f=faction(activeRoster());
  let w=D.weapons.find(a=>a.name===name)||customEquipmentByName(name)||equipmentPool(equipmentTab,x).find(a=>a.name===name);
  if(name==='Natural Weapons'&&Array.isArray(x.equipmentAccessGroups)&&x.equipmentAccessGroups.includes('Natural Weapons'))w={name:'Natural Weapons',category:'Armes de corps à corps',availability:'Inné',price:0,bandOnlyIntrinsic:true,profile:{range:'Melee 2',strength:'S',ap:'-',damage:'1',traits:'Natural weapon — ne prend pas d’emplacement'}};
  if(!w)return;
  if(!fighterUsesLoadouts(x)){const check=canEquip(x,w);if(!check.ok){toast(check.msg);return}}
  openPurchaseConfirm(w,equipmentPrice(w,f,equipmentTab),equipmentTab);
}
function purchaseEquipment(encoded,tab){
  const r=activeRoster(),x=r?.fighters[editingIndex],f=faction(r),name=decodeURIComponent(encoded);
  const w=D.weapons.find(a=>a.name===name)||customEquipmentByName(name)||equipmentPool(tab,x).find(a=>a.name===name);
  if(!r||!x||!w)return;
  const intrinsic=!!w.bandOnlyIntrinsic;
  const paid=intrinsic?0:Math.max(0,Number($('#purchasePaid')?.value||0));
  const value=intrinsic?0:Math.max(0,Number($('#purchaseValue')?.value||0));
  if(!Number.isFinite(paid)||!Number.isFinite(value)){toast('Prix invalide');return}
  if(r.gold<paid){toast(`Trésor insuffisant : ${r.gold} GC disponibles`);return}
  const newItem={stashId:crypto.randomUUID(),name:w.name,paid,value,price:value,category:w.category,subcategory:w.subcategory||w.category,rarity:w.rarity||'',availability:w.availability||w.rarity||'—',profile:w.profile||null,traits:w.traits||[],rulesText:w.rulesText||'',customEquipmentId:w.customEquipmentId||null,weaponSlotCost:weaponSlots(w),intrinsic};
  if(fighterUsesLoadouts(x)){ensureFighterLoadouts(x);x.equipmentStash.push(newItem);const l=activeLoadout(x);l.equipmentIds=l.equipmentIds||[];l.equipmentIds.push(newItem.stashId);l.equipmentNames=l.equipmentIds.map(id=>x.equipmentStash.find(q=>q.stashId===id)?.name).filter(Boolean);syncLoadoutProjection(x);}else{x.equipmentSelected=x.equipmentSelected||[];x.equipmentSelected.push(newItem);}
  syncCustomEquipmentEffects(x);
  r.gold-=paid;save(true);closeModal();equipmentOpen=true;render('fighter');toast(`${w.name} ajouté`);
}
function armory(){const cats=[...new Set([...D.weapons,...customEquipmentList(),...officialCustomEquipmentList()].map(w=>equipmentCategory(w)))].filter(Boolean);$('#content').innerHTML=`<div class="card"><div class="toolbar"><input class="search" id="weaponSearch" placeholder="Rechercher une arme, armure ou équipement…" oninput="renderArmory()"><select class="select" id="weaponType" onchange="renderArmory()"><option value="">Toutes les catégories</option>${cats.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div class="armory-wrap"><div id="armoryTable"></div></div></div>`;renderArmory()}
function renderArmory(){const q=($('#weaponSearch')?.value||'').toLowerCase(),t=$('#weaponType')?.value||'',ws=[...D.weapons,...customEquipmentList().filter(w=>w.unrestricted),...officialCustomEquipmentList()];const filtered=ws.filter(w=>(!q||(w.name||'').toLowerCase().includes(q)||(w.rulesText||'').toLowerCase().includes(q))&&(!t||equipmentCategory(w)===t));$('#armoryTable').innerHTML=`<table class="armory-table"><thead><tr><th>Objet</th><th>Catégorie</th><th>Prix</th><th>Disponibilité</th></tr></thead><tbody>${filtered.map(w=>`<tr><td><strong>${refLink('equipment',w.name)}</strong>${w.rulesText?`<small class="armory-rules-preview">${esc(stripCustomTextMarkup(w.rulesText))}</small>`:''}</td><td>${esc(equipmentCategory(w))}</td><td>${w.price===null?'—':Number(w.price||0)+' GC'}</td><td>${isCustomEquipment(w)?`<span class="custom-armory-badge">CUSTOM${(w.factions||[]).length?' · '+(w.factions||[]).map(id=>esc(D.factions.find(f=>f.id===id)?.displayName||id)).join(' · '):''}</span>`:'M17'}</td></tr>`).join('')||`<tr><td colspan="4"><div class="empty compact">Aucun équipement trouvé.</div></td></tr>`}</tbody></table>`}
function codex(){const sections=D.rulesMeta;$('#content').innerHTML=`<div class="codex-layout"><aside class="card codex-nav"><button class="active" onclick="showCodex('all',this)">Tout le livre</button>${sections.map((s,i)=>`<button onclick="showCodex(${i},this)">${esc(s[0])}</button>`).join('')}<button onclick="showCodex('factions',this)">Factions</button></aside><section class="card codex-content"><input class="search rule-search" id="bookSearch" placeholder="Rechercher dans les ${D.pages.length} pages…" oninput="searchBook()"><div id="codexBody">${bookPages(D.pages.slice(0,5))}<div class="notice">Le livre complet est embarqué dans <code>data/catalog.js</code>.</div></div></section></div>`}
function bookPages(ps){return ps.map(p=>`<article class="book-page"><h4>Page source ${p.page}</h4><pre>${esc(p.text)}</pre></article>`).join('')}
function searchBook(){const q=$('#bookSearch').value.trim().toLowerCase();if(!q){$('#codexBody').innerHTML=bookPages(D.pages.slice(0,5));return}const hits=D.pages.filter(p=>p.text.toLowerCase().includes(q));$('#codexBody').innerHTML=hits.length?bookPages(hits.slice(0,40)):`<div class="empty">Aucun résultat pour « ${esc(q)} ».</div>`}
function showCodex(key,btn){document.querySelectorAll('.codex-nav button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(key==='factions'){$('#codexBody').innerHTML=D.factions.map(f=>`<article class="book-page"><h4>${esc(f.displayName)} · source p.${f.startPage||'—'}</h4><pre>${esc(f.text)}</pre></article>`).join('');return}if(key==='all'){$('#codexBody').innerHTML=bookPages(D.pages.slice(0,5))+'<div class="notice">Utilise la recherche pour parcourir le livre complet.</div>';return}const [name,desc]=D.rulesMeta[key];const hits=D.pages.filter(p=>p.text.toLowerCase().includes(name.toLowerCase())||p.text.toLowerCase().includes(desc.split(',')[0].toLowerCase()));$('#codexBody').innerHTML=`<div class="notice"><strong>${esc(name)}</strong> — ${esc(desc)}</div>`+bookPages(hits.slice(0,40))}
function exportRoster(){const r=activeRoster();if(!r){toast('Aucune bande active');return}const f=faction(r),lines=[`${PROJECT_NAME.toUpperCase()} — ${r.name}`,`Faction: ${f.displayName}`,`Pack: ${f.packId||'Core M17'}`,`Budget initial: ${f.budget} GC`,`Réputation: ${r.reputation}`,'','GUERRIERS'];r.fighters.forEach(x=>lines.push(`${x.name} — ${x.type} — ${fighterCost(x)} GC — ${x.profile.join('/')}`));if(r.reserve?.length){lines.push('','RÉSERVE');r.reserve.forEach(e=>lines.push(`${e.name} — ${Number(e.value??e.price??0)} GC`));}lines.push('',`Total: ${total(r)} GC`,`Restant: ${f.budget-total(r)} GC`);const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=r.name.replace(/[^a-z0-9-_]+/gi,'_')+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$('#modalClose').onclick=closeModal;$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};$('#resetBtn').onclick=()=>{
  const signedIn=cloudIsSignedIn();
  const msg=signedIn
    ?(siteLanguage==='en'?'This will also erase the warbands stored in your account, on every device. Continue?':'Ceci effacera aussi les bandes stockées dans ton compte, sur tous tes appareils. Continuer ?')
    :(siteLanguage==='en'?'Delete all local warbands?':'Effacer toutes les bandes locales ?');
  if(!confirm(msg))return;
  const keepMeta=signedIn?{accountUserId:state?.meta?.accountUserId,cloudRevision:state?.meta?.cloudRevision}:null;
  window.MordheimundaStorage.clear();
  state=window.MordheimundaStorage.load();
  if(keepMeta){state.meta=state.meta||{};Object.assign(state.meta,keepMeta);state=window.MordheimundaStorage.save(state);}
  render('dashboard');
  if(signedIn)queueCloudSave();
};

document.addEventListener('click',e=>{const link=e.target.closest?.('a[data-app-route]');if(!link)return;if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;if(Date.now()<ghostClickGuardUntil){e.preventDefault();e.stopPropagation();return}const href=link.getAttribute('href');if(!href||href.startsWith('http'))return;e.preventDefault();navigateApp(href);});
document.addEventListener('click',e=>{const pop=$('#rulePeek');if(!pop?.classList.contains('visible'))return;if(e.target.closest?.('.rule-ref,.rule-ref-info,#rulePeek'))return;pop.classList.remove('visible');activeRulePeek=null;clearTimeout(rulePeekTimer);});
document.addEventListener('touchstart',e=>{const pop=$('#rulePeek');if(!pop?.classList.contains('visible'))return;if(e.target.closest?.('.rule-ref,.rule-ref-info,#rulePeek'))return;pop.classList.remove('visible');activeRulePeek=null;clearTimeout(rulePeekTimer);},{passive:true});
const languageSelect=document.getElementById('languageSelect');if(languageSelect){languageSelect.value=siteLanguage;languageSelect.onchange=()=>setSiteLanguage(languageSelect.value);}

/* ================= CUSTOM FIGHTER PROFILES ================= */
let customTab='fighters';
let customFighterEditId=null;
let customFighterSearch='';
let customFighterRuleDraft=[];
let customFighterSkillDraft=[];
let customFighterDefaultEquipmentDraft=[];
let customFighterEquipmentAccessDraft=[];
let customFighterMagicAccessDraft={};

function customFighterList(){
  if(!Array.isArray(state.customFighters))state.customFighters=[];
  return state.customFighters;
}
function customFighterById(id){return customFighterList().find(x=>x.customFighterId===id)||null}
function customFighterFactionMatches(w,f){
  if(!w||!f)return false;
  const stored=normName(w.factionId||w.faction);
  const candidates=[f.id,f.displayName,f.baseFactionId,activeRoster()?.factionId].filter(Boolean).map(normName);
  if(w.customWarbandId && normName(f.id)===normName(`custom-warband-${w.customWarbandId}`))return true;
  const cwId=String(w.customWarbandId||'');
  if(cwId && normName(f.id)===normName(cwId))return true;
  if(candidates.includes(stored))return true;
  const obj=D.factions.find(a=>normName(a.id)===stored||normName(a.displayName)===stored);
  if(obj && candidates.some(c=>c===normName(obj.id)||c===normName(obj.displayName)||c===normName(obj.baseFactionId)))return true;
  return false;
}
function customFightersForFaction(f){
  if(!f)return [];
  return customFighterList().filter(w=>customFighterFactionMatches(w,f)).map(customFighterAsWarrior);
}
function customFighterAsWarrior(w){
  return {
    ...w,
    id:w.customFighterId,
    customFighterId:w.customFighterId,
    custom:true,
    max:w.max===null||w.max===undefined||w.max===''?null:Number(w.max),
    type:w.type||'Henchman',
    profile:Array.isArray(w.profile)?w.profile.slice():P.map(()=>1),
    skillAccess:w.skillAccess||{},
    magicAccess:w.magicAccess||{},
    equipmentAccessGroups:Array.isArray(w.equipmentAccess)?w.equipmentAccess.slice():[],
    rules:w.rules||'',
    race:w.race||fighterRace(w),
    ruleNames:fighterRuleNames({...w,ruleNames:Array.isArray(w.ruleNames)?w.ruleNames.slice():[]},null),
    description:w.description||''
  };
}
function customFighterAllEquipment(){
  const customs=[...customEquipmentList(),...officialCustomEquipmentList()];
  const all=[...D.weapons,...customs];
  const seen=new Set();
  return all.filter(w=>{const k=normName(w.name);if(!k||seen.has(k))return false;seen.add(k);return true});
}
function newCustomFighter(){customFighterEditId=null;customFighterRuleDraft=[];customFighterSkillDraft=[];customFighterDefaultEquipmentDraft=[];customFighterEquipmentAccessDraft=[];customFighterMagicAccessDraft={};render('custom');setTimeout(()=>$('#cfName')?.focus(),30)}
function editCustomFighter(id){const w=customFighterById(id);if(!w)return;customFighterEditId=id;customFighterRuleDraft=(w.ruleNames||[]).slice();customFighterSkillDraft=(w.defaultSkills||[]).slice();customFighterDefaultEquipmentDraft=(w.defaultEquipment||[]).slice();customFighterEquipmentAccessDraft=(w.equipmentAccess||[]).slice();customFighterMagicAccessDraft=JSON.parse(JSON.stringify(w.magicAccess||{}));render('custom')}
function deleteCustomFighter(id){const w=customFighterById(id);if(!w)return;openModal(`<div class="delete-dialog"><div class="eyebrow">SUPPRESSION DE PROFIL CUSTOM</div><h2>Supprimer « ${esc(w.name)} » ?</h2><p>Les combattants déjà recrutés conservent leur fiche actuelle.</p><button type="button" class="big-delete" onclick="confirmDeleteCustomFighter('${id}')">SUPPRIMER LE PROFIL</button><button type="button" class="button secondary full" onclick="closeModal()">Annuler</button></div>`)}
function confirmDeleteCustomFighter(id){markDeleted('customFighters',id);state.customFighters=customFighterList().filter(w=>w.customFighterId!==id);if(customFighterEditId===id)customFighterEditId=null;save(true);closeModal();render('custom');toast('Profil custom supprimé')}
function resetCustomFighterForm(){newCustomFighter()}
function refreshCustomFighterTags(kind){
  const isRule=kind==='rule', arr=isRule?customFighterRuleDraft:customFighterSkillDraft;
  const tagId=isRule?'cfRuleTags':'cfSkillTags'; const el=$('#'+tagId); if(!el)return;
  el.innerHTML=arr.map((s,i)=>`<span class="custom-trait-tag">${refLink(isRule?'special':'skills',s,s)}${isRule&&isEditableParamTag('fighter',s)?`<button type="button" title="Modifier la valeur" class="trait-tag-edit" onclick="editTraitParamValue('fighter',${i})">✎</button>`:''}<button type="button" onclick="${isRule?'removeCustomFighterRule':'removeCustomFighterSkill'}(${i})">×</button></span>`).join('')||`<span class="custom-trait-empty">Aucune ${isRule?'règle spéciale':'compétence par défaut'}.</span>`;
  const details=el.closest('details'); const small=details?.querySelector('summary small');
  if(small)small.textContent=`${arr.length} ${isRule?'liée':'compétence'}${arr.length!==1?'s':''}`;
}
function addCustomFighterRule(){const input=$('#cfRuleInput'),v=(input?.value||'').trim();if(!v)return;const found=referenceFind('special',v),canonical=found?.name||v;if(/^Race\s*\(/i.test(canonical)){toast(siteLanguage==='en'?'Race is set with the dedicated Race field above':'La race se règle avec le champ Race dédié plus haut');if(input)input.value='';return}if(isTraitParamTemplate(canonical)){if(input)input.value='';openTraitParamPrompt('fighter',null,canonical);return}if(!customFighterRuleDraft.some(x=>normName(x)===normName(canonical)))customFighterRuleDraft.push(canonical);if(input)input.value='';refreshCustomFighterTags('rule');setTimeout(()=>$('#cfRuleInput')?.focus(),20)}
function handleCustomFighterRuleKey(e){if(e.key==='Enter'){e.preventDefault();addCustomFighterRule()}}
function removeCustomFighterRule(i){customFighterRuleDraft.splice(i,1);refreshCustomFighterTags('rule')}
function addCustomFighterSkill(v){v=(v||'').trim();if(!v)return;if(!customFighterSkillDraft.some(x=>normName(x)===normName(v)))customFighterSkillDraft.push(v);const select=$('#cfSkillSelect');if(select)select.value='';refreshCustomFighterTags('skill')}
function removeCustomFighterSkill(i){customFighterSkillDraft.splice(i,1);refreshCustomFighterTags('skill')}
function customFighterReadChecks(cls){return [...document.querySelectorAll('.'+cls+':checked')].map(x=>x.dataset.name)}
function saveCustomFighter(){
  const name=($('#cfName')?.value||'').trim(),type=$('#cfType')?.value||'Henchman',factionId=$('#cfFaction')?.value||'',cost=Math.max(0,Number($('#cfCost')?.value||0));
  if(!name){toast('Donne un nom au combattant');return} if(!factionId){toast('Choisis une bande');return} if(!Number.isFinite(cost)){toast('Valeur de base invalide');return}
  const maxMode=$('#cfMaxMode')?.value||'auto';const maxRaw=($('#cfMax')?.value||'').trim();const max=maxRaw===''?null:Math.max(0,Number(maxRaw));if(max!==null&&!Number.isFinite(max)){toast('Limite invalide');return}
  const profile=P.map((_,i)=>{const n=Number($('#cfStat'+i)?.value);return Number.isFinite(n)?n:0});
  const manualMaxProfile=maxMode==='manual'?P.map((_,i)=>{const n=Number($('#cfMaxStat'+i)?.value);return Number.isFinite(n)?n:profile[i]||0}):null;
  const skillAccess={};document.querySelectorAll('.cfSkillAccess').forEach(s=>{if(s.value)skillAccess[s.dataset.set]=s.value});
  const magicAccess={};document.querySelectorAll('.cfMagicAccess').forEach(s=>{if(s.value)magicAccess[s.dataset.domain]=s.value});
  const defaultEquipment=customFighterReadChecks('cfDefaultEquipment'),equipmentAccess=customFighterReadChecks('cfEquipmentAccess');
  const raceRaw=($('#cfRace')?.value||'Human').trim();
  const race=raceRaw.replace(/^Race\s*\(\s*/i,'').replace(/\s*\)\s*$/,'').trim()||'Human';
  const ruleNames=[`Race (${race})`,...customFighterRuleDraft.filter(n=>!/^Race\s*\(/i.test(String(n)))];
  const isCustomWarband=String(factionId).startsWith('custom-warband-');
  const customWarbandId=isCustomWarband?String(factionId).replace('custom-warband-',''):null;
  const item={customFighterId:customFighterEditId||crypto.randomUUID(),name,type,factionId:isCustomWarband?'':factionId,customWarbandId,cost,max,maxMode,manualMaxProfile,profile,race,ruleNames,rules:ruleNames.join(', '),skillAccess,magicAccess,defaultSkills:customFighterSkillDraft.slice(),defaultEquipment,equipmentAccess,description:($('#cfDescription')?.value||'').trim()};
  const existing=customFighterById(item.customFighterId);const previousCustomWarbandId=existing?.customWarbandId||null;item.archived=existing?.archived||false;
  const idx=customFighterList().findIndex(w=>w.customFighterId===item.customFighterId);if(idx>=0)state.customFighters[idx]=item;else state.customFighters.push(item);
  if(previousCustomWarbandId && previousCustomWarbandId!==customWarbandId){const oldCw=customWarbandById(previousCustomWarbandId);if(oldCw)oldCw.fighterIds=(oldCw.fighterIds||[]).filter(id=>id!==item.customFighterId);}
  if(customWarbandId){const cw=customWarbandById(customWarbandId);if(cw){cw.fighterIds=Array.isArray(cw.fighterIds)?cw.fighterIds:[];if(!cw.fighterIds.includes(item.customFighterId))cw.fighterIds.push(item.customFighterId);}}
  customFighterEditId=item.customFighterId;save(true);render('custom');toast(idx>=0?'Profil custom modifié':'Profil custom créé');
}
function toggleCustomFighterArchive(id){const w=customFighterById(id);if(!w)return;w.archived=!w.archived;save(true);render('custom');toast(w.archived?'Profil archivé':'Profil désarchivé')}
function customFighterRow(w,isOfficial){const f=D.factions.find(f=>f.id===w.factionId),cw=w.customWarbandId?customWarbandById(w.customWarbandId):null;const bandLabel=cw?`⚔ ${cw.name}${cw.officialId?'':' · CUSTOM'}`:(f?.displayName||w.factionId||'—');
  // Library rows are a picklist, not a fiche: just enough to identify and pick
  // the profile (name / type / band / race / cost). Skill-access and rule
  // details are shown once, in the editor itself (✎), not duplicated here.
  return `<article class="custom-item-row${w.archived?' is-archived':''}"><div class="custom-item-main"><div class="custom-item-icon">⚔</div><div><strong>${esc(w.name)}</strong><small>${w.archived?'<span class="archived-tag">ARCHIVÉ</span> · ':''}${isOfficial?'<span class="archived-tag official-tag">OFFICIALISÉ</span> · ':''}${esc(w.type||'Henchman')} · ${esc(bandLabel)} · Race (${esc(fighterRace(w,null))}) · ${Number(w.cost||0)} GC</small></div></div><div class="custom-item-actions"><button type="button" class="equipment-action" title="${w.archived?'Désarchiver':'Archiver'}" onclick="toggleCustomFighterArchive('${w.customFighterId}')">${w.archived?'⇤':'🗄'}</button><button type="button" class="equipment-action" onclick="editCustomFighter('${w.customFighterId}')">✎</button><button type="button" class="equipment-action remove" onclick="deleteCustomFighter('${w.customFighterId}')">🗑</button></div></article>`}

/* Merge custom fighters into recruitment without changing the source catalog. */
function addFighter(wid){const r=activeRoster(),f=faction(r),custom=customFighterById(wid),w=custom?customFighterAsWarrior(custom):f?.warriors?.find(x=>x.id===wid);if(!w)return;const restriction=recruitmentRestriction(r,w);if(restriction){toast(restriction);return}const count=r.fighters.filter(x=>x.wid===wid).length;if(w.max!==null&&count>=w.max){toast('Limite atteinte pour ce profil');return}if(r.gold<w.cost){toast('Trésor insuffisant');return}const defaults=(w.defaultEquipment||[]).map(name=>{const e=D.weapons.find(a=>normName(a.name)===normName(name))||customEquipmentByName(name);if(!e)return null;return {stashId:crypto.randomUUID(),name:e.name,paid:0,value:0,price:0,category:e.category,subcategory:e.subcategory||e.category,rarity:e.rarity||'',availability:e.availability||e.rarity||'—',profile:e.profile||null,traits:e.traits||[],customEquipmentId:e.customEquipmentId||null,weaponSlotCost:weaponSlots(e),intrinsic:true}}).filter(Boolean);const fighter={...w,profile:effectiveFighterProfile(w,f),baseProfile:Array.isArray(w.profile)?w.profile.slice():w.profile,sourceName:w.name,wid,instance:crypto.randomUUID(),name:w.name,xp:0,equipmentSelected:defaults,skills:Array.isArray(w.defaultSkills)?w.defaultSkills.slice():[],advancements:[],injuries:[],spells:[],notes:'',veteran:false,image:'',status:{recovery:false,captured:false,dead:false,critical:false},customFighterId:w.customFighterId||null};if(fighterUsesLoadouts(fighter)){fighter.equipmentStash=defaults.slice();fighter.equipmentLoadouts=[{id:crypto.randomUUID(),name:'1',equipmentIds:defaults.map(e=>e.stashId),equipmentNames:defaults.map(e=>e.name)}];fighter.activeLoadoutId=fighter.equipmentLoadouts[0].id;syncLoadoutProjection(fighter);}r.fighters.push(fighter);syncCustomEquipmentEffects(fighter);r.gold-=Number(w.cost||0);logHistory(r,'recruit',`<b>${esc(w.name)}</b> recruté dans la bande — <b>${esc(w.type)}</b>, coût ${Number(w.cost||0)} GC`);save(true);render('builder');toast(`✓ ${w.name} recruté — ${w.cost} GC`)}
function ensureFighterSourceData(x,r){const f=faction(r),cw=x?.customFighterId?customFighterById(x.customFighterId):null,w=cw?customFighterAsWarrior(cw):f?.warriors?.find(a=>a.id===x.wid||a.name===x.sourceName||a.name===x.name);if(!w)return;if(!Array.isArray(x.baseProfile)&&Array.isArray(w.profile))x.baseProfile=w.profile.slice();if(w.rules)x.rules=w.rules;if(Array.isArray(w.ruleNames))x.ruleNames=w.ruleNames.slice();if(w.packRules)x.packRules=JSON.parse(JSON.stringify(w.packRules));if(w.packModifiers)x.packModifiers=JSON.parse(JSON.stringify(w.packModifiers));if(!Array.isArray(x.advancements))x.advancements=[];if(!Array.isArray(x.skills))x.skills=[];if(typeof x.veteran!=='boolean')x.veteran=false;if(typeof x.promotedVeteran!=='boolean')x.promotedVeteran=false;if(w.type==='Henchman'){const legacyPromotion=Array.isArray(x.advancements)&&x.advancements.some(a=>a?.kind==='promotion'||a?.sourceId==='hench-2'||a?.sourceId==='hench-12');if(x.promotedVeteran!==true&&legacyPromotion)x.promotedVeteran=true;if(x.promotedVeteran===true){x.veteran=true;x.type='Henchman'}else{x.promotedVeteran=false;x.veteran=false;if(x.type==='Veteran')x.type='Henchman';}}if(!x.sourceName)x.sourceName=w.name;if(!x.customFighterId&&w.customFighterId)x.customFighterId=w.customFighterId}
function fighterOriginalProfile(x){
  const r=activeRoster(),f=faction(r),source=x?.customFighterId?customFighterById(x.customFighterId):f?.warriors?.find(w=>w.id===x.wid||w.name===x.sourceName||w.name===x.name);
  const out=Array.isArray(x.baseProfile)&&x.baseProfile.length===12?x.baseProfile.slice():Array.isArray(source?.profile)?source.profile.slice():(Array.isArray(x.profile)?x.profile.slice():[]);
  const mods=(f?.packRuleModifiers||[]).filter(m=>(!m.target||m.target===source?.name||m.target===source?.id||m.target==='all')&&(!m.targetType||m.targetType==='unit'));
  mods.forEach(m=>{const i=P.indexOf(m.stat);if(i>=0)out[i]=Number(out[i]||0)+Number(m.amount||0);});
  return out;
}
function fighterRuleNames(x,f){
  const source=x?.customFighterId?customFighterById(x.customFighterId):f?.warriors?.find(w=>w.id===x?.wid||w.name===x?.sourceName||w.name===x?.name);
  const raceRule=fighterRaceRule(x,f);
  const raw=String(x?.rules||source?.rules||'');
  let names=Array.isArray(x?.ruleNames)&&x.ruleNames.length?x.ruleNames.slice():Array.isArray(source?.ruleNames)&&source.ruleNames.length?source.ruleNames.slice():[];
  // Official profiles store their special rules in the source `rules` field. Resolve each
  // comma-separated entry against the actual special-rule reference registry so every
  // keyword shown on a profile becomes a live rule link, including rules added later.
  if(!names.length){
    const parts=raw.split(',').map(v=>v.trim()).filter(Boolean);
    const specials=referenceEntries('special');
    for(const part of parts){
      if(/^Race\s*\(/i.test(part))continue;
      const hit=specials.find(e=>{
        const en=String(e.name||'');
        if(en==='Race (X)')return /^Race\s*\(/i.test(part);
        const a=refNorm(en),b=refNorm(part);
        return b===a || b.startsWith(a) || (a.endsWith('skill') && b.startsWith(a.replace(/skill$/,'')));
      });
      if(hit)names.push(hit.name);
    }
  }
  names=names.filter(n=>!/^Race\s*\(/i.test(String(n)));
  const equipmentRules=standardEquipmentSpecialRules(x);
  return [...new Set([raceRule,...names,...equipmentRules])];
}
function warriorBandAllowed(w,x){if(x?.customFighterId){return Array.isArray(x.equipmentAccess)&&x.equipmentAccess.some(n=>normName(n)===normName(w?.name))}if(isCustomEquipment(w))return customEquipmentForFaction(w,faction(activeRoster())?.id);const groups=x?.equipmentAccessGroups;if(groups==='ALL')return true;if(!Array.isArray(groups))return false;if(groups.includes('Natural Weapons')&&w.name==='Natural Weapons')return true;const f=faction(activeRoster());const key=Object.keys(f?.equipmentItemGroups||{}).find(k=>normName(k)===normName(w?.name));const memberships=key?(f.equipmentItemGroups[key]||[]):[];return groups.some(g=>memberships.includes(g))}

/* Final custom-fighter integration overrides. */
function customFighterForm(w){
  const editing=!!customFighterEditId;
  const skillAccess=w?.skillAccess||{};
  const rules=editing?customFighterRuleDraft:(w?.ruleNames||[]);
  const skills=editing?customFighterSkillDraft:(w?.defaultSkills||[]);
  const defaults=editing?customFighterDefaultEquipmentDraft:(w?.defaultEquipment||[]);
  const access=editing?customFighterEquipmentAccessDraft:(w?.equipmentAccess||[]);
  const p=w?.profile||P.map(()=>1);
  const factionId=w?.customWarbandId?`custom-warband-${w.customWarbandId}`:(w?.factionId||D.factions.find(f=>!f.packId)?.id||'');
  const types=['Leader','Champion','Raw Recruit','Henchman'];
  const officialFactions=D.factions.filter(f=>!f.packId);
  const customWarbands=customWarbandList();
  return `<div class="custom-form-head"><div><div class="eyebrow">${w?'MODIFICATION':'NOUVEAU PROFIL'}</div><h3>${esc(w?.name||'Construire un combattant')}</h3></div>${w?`<button type="button" class="button secondary" onclick="newCustomFighter()">＋ Nouveau</button>`:''}</div>
  <div class="custom-form-grid">
    <label class="custom-field wide"><span>Nom</span><input id="cfName" value="${esc(w?.name||'')}" placeholder="Ex. Maître de guerre"></label>
    <label class="custom-field"><span>Sous-catégorie</span><select id="cfType">${types.map(t=>`<option value="${esc(t)}" ${t===(w?.type||'Henchman')?'selected':''}>${esc(t)}</option>`).join('')}</select></label>
    <label class="custom-field"><span>Warband</span><select id="cfFaction"><optgroup label="Warbands principales">${officialFactions.map(f=>`<option value="${esc(f.id)}" ${f.id===factionId?'selected':''}>${esc(f.displayName)}</option>`).join('')}</optgroup>${customWarbands.length?`<optgroup label="Warbands custom">${customWarbands.map(cw=>{const id=`custom-warband-${cw.id}`;return `<option value="${id}" ${id===factionId?'selected':''}>⚔ ${esc(cw.name)}${cw.officialId?'':' · CUSTOM'}</option>`}).join('')}</optgroup>`:''}</select></label>
    <label class="custom-field"><span>Valeur de base (GC)</span><input id="cfCost" type="number" min="0" step="1" value="${Number(w?.cost||0)}"></label>
    <label class="custom-field"><span>Race</span><input id="cfRace" value="${esc(w?.race||'Human')}" placeholder="Ex. Human, Skaven, Vampire…"></label>
    <label class="custom-field"><span>Mode des maximums</span><select id="cfMaxMode"><option value="auto" ${(w?.maxMode||'auto')==='auto'?'selected':''}>Automatique (race + modificateurs)</option><option value="manual" ${(w?.maxMode||'auto')==='manual'?'selected':''}>Manuel</option></select></label>
    <label class="custom-field"><span>Limite</span><input id="cfMax" type="number" min="0" step="1" value="${w?.max===null||w?.max===undefined?'':Number(w.max)}" placeholder="Vide = aucune limite"></label>
  </div>
  <details class="custom-collapse" open><summary><span>CARACTÉRISTIQUES</span><small>12 valeurs de profil</small></summary><table class="custom-stat-bar"><tr>${P.map((n,i)=>`<th title="${esc(P_FULL[i])}">${esc(n)}</th>`).join('')}</tr><tr>${P.map((n,i)=>`<td><input id="cfStat${i}" type="number" step="1" value="${esc(p[i]??'')}"></td>`).join('')}</tr></table></details>
  <details class="custom-collapse" open><summary><span>MAXIMUMS MANUELS</span><small>Utilisés si mode manuel</small></summary><table class="custom-stat-bar"><tr>${P.map((n,i)=>`<th title="${esc(P_FULL[i])}">${esc(n)}</th>`).join('')}</tr><tr>${P.map((n,i)=>`<td><input id="cfMaxStat${i}" type="number" min="0" step="1" value="${esc((w?.manualMaxProfile?.[i]??p[i]??0))}"></td>`).join('')}</tr></table></details>
  <details class="custom-collapse" open><summary><span>RÈGLES SPÉCIALES</span><small>${rules.length} liée${rules.length!==1?'s':''}</small></summary><div class="custom-tag-editor"><div id="cfRuleTags" class="custom-trait-tags">${rules.map((s,i)=>`<span class="custom-trait-tag">${refLink('special',s,s)}${isEditableParamTag('fighter',s)?`<button type="button" title="Modifier la valeur" class="trait-tag-edit" onclick="editTraitParamValue('fighter',${i})">✎</button>`:''}<button type="button" onclick="removeCustomFighterRule(${i})">×</button></span>`).join('')||'<span class="custom-trait-empty">Aucune règle spéciale.</span>'}</div><div class="custom-trait-add"><input id="cfRuleInput" list="cfRuleDatalist" placeholder="Rechercher une règle spéciale…" onkeydown="handleCustomFighterRuleKey(event)"><datalist id="cfRuleDatalist">${referenceEntries('special').filter(s=>!/^Race\s*\(/i.test(s.name)).map(s=>`<option value="${esc(s.name)}">`).join('')}</datalist><button type="button" class="button secondary" onclick="addCustomFighterRule()">＋ Ajouter</button></div></div></details>
  <details class="custom-collapse" open><summary><span>ARBRE DE COMPÉTENCES</span><small>Non autorisé / Primary / Secondary</small></summary><div class="custom-skill-access-grid">${Object.keys(customMergedSkillSets()).map(set=>`<label><span>${esc(set)}</span><select class="cfSkillAccess" data-set="${esc(set)}"><option value="">Non autorisé</option><option value="Primary" ${skillAccess[set]==='Primary'?'selected':''}>Primary</option><option value="Secondary" ${skillAccess[set]==='Secondary'?'selected':''}>Secondary</option></select></label>`).join('')}</div></details>
  <details class="custom-collapse"><summary><span>SORTS / DOMAINES DE MAGIE</span><small>Non autorisé / Primary / Secondary</small></summary><div class="custom-skill-access-grid">${Object.keys(customMergedMagicDomains()).map(domain=>{const mv=customFighterMagicAccessDraft?.[domain]||w?.magicAccess?.[domain]||'';return `<label><span>${esc(domain)}</span><select class="cfMagicAccess" data-domain="${esc(domain)}"><option value="">Non autorisé</option><option value="Primary" ${mv==='Primary'?'selected':''}>Primary</option><option value="Secondary" ${mv==='Secondary'?'selected':''}>Secondary</option></select></label>`}).join('')}</div></details>
  <details class="custom-collapse"><summary><span>COMPÉTENCES PAR DÉFAUT</span><small>${skills.length} compétence${skills.length!==1?'s':''}</small></summary><div class="custom-choice-list"><div id="cfSkillTags" class="custom-trait-tags">${skills.map((s,i)=>`<span class="custom-trait-tag">${refLink('skills',s,s)}<button type="button" onclick="removeCustomFighterSkill(${i})">×</button></span>`).join('')||'<span class="custom-trait-empty">Aucune compétence par défaut.</span>'}</div><select id="cfSkillSelect" onchange="addCustomFighterSkill(this.value);this.value=''" class="custom-wide-select"><option value="">＋ Ajouter une compétence…</option>${customFighterSkillNames().map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select></div></details>
  <details class="custom-collapse"><summary><span>ÉQUIPEMENT PAR DÉFAUT</span><small>${defaults.length} objet${defaults.length!==1?'s':''}</small></summary>${customFighterEquipmentChooser('cfDefaultEquipment',defaults,'default')}</details>
  <details class="custom-collapse"><summary><span>ACCÈS À L’ÉQUIPEMENT</span><small>${access.length} objet${access.length!==1?'s':''}</small></summary>${customFighterEquipmentChooser('cfEquipmentAccess',access,'access')}</details>
  <details class="custom-collapse"><summary><span>DESCRIPTION</span><small>Texte du profil</small></summary>${customTextToolbarMarkup('cfDescription')}<textarea id="cfDescription" class="wide-textarea" rows="5" placeholder="Description du combattant…">${esc(w?.description||'')}</textarea></details>
  <div class="custom-actions"><button type="button" class="button secondary" onclick="resetCustomFighterForm()">Réinitialiser</button><button type="button" class="button primary" onclick="saveCustomFighter()">${w?'Enregistrer les modifications':'Créer le profil'}</button></div>`;
}
function equipmentPool(tab,x){
  const f=faction(activeRoster());let ws=[];const customs=[...customEquipmentList(),...officialCustomEquipmentList()];
  if(tab==='band'){
    if(x?.customFighterId){
      ws=D.weapons.filter(w=>warriorBandAllowed(w,x));
      ws.push(...customs.filter(w=>warriorBandAllowed(w,x)));
    }else{
      const base=f?.equipment||[];
      ws=D.weapons.filter(w=>base.includes(w.name)&&warriorBandAllowed(w,x));
      ws.push(...customs.filter(w=>customEquipmentForFaction(w,f?.id)));
      if(Array.isArray(x?.equipmentAccessGroups)&&x.equipmentAccessGroups.includes('Natural Weapons')&&!ws.some(w=>w.name==='Natural Weapons'))ws.push({name:'Natural Weapons',category:'Armes de corps à corps',availability:'Inné',price:0,band:true,profile:{range:'Melee 2',strength:'S',ap:'-',damage:'1',traits:'Natural weapon — ne prend pas d’emplacement'},bandOnlyIntrinsic:true});
    }
  } else if(tab==='market') ws=[...D.weapons.filter(w=>w.market!==false),...customs.filter(w=>w.market)];
  else ws=[...D.weapons,...customs.filter(w=>w.unrestricted)];
  if(equipmentCategoryFilter!=='all')ws=ws.filter(w=>equipmentCategory(w)===equipmentCategoryFilter);
  const q=(equipmentSearch||'').trim().toLowerCase();if(q)ws=ws.filter(w=>(w.name||'').toLowerCase().includes(q)||(equipmentCategory(w)||'').toLowerCase().includes(q)||(w.rulesText||'').toLowerCase().includes(q));
  return ws;
}

function customFighterEquipmentChooser(id,selected,mode){
  const list=customFighterAllEquipment();const set=new Set((selected||[]).map(normName));const groups={};
  list.forEach(w=>{const c=equipmentCategory(w);(groups[c]||(groups[c]=[])).push(w)});
  const ar=activeRoster(),af=ar?faction(ar):D.factions.find(f=>!f.packId);
  return `<div class="custom-equipment-chooser">${Object.entries(groups).map(([cat,items])=>`<details class="custom-mini-collapse"><summary>${esc(cat)} <small>${items.length}</small></summary><div class="custom-equipment-checks">${items.map(w=>`<label><input class="${id}" data-name="${esc(w.name)}" type="checkbox" ${set.has(normName(w.name))?'checked':''}><span>${refLink('equipment',w.name,w.name)}<small>${isCustomEquipment(w)?'CUSTOM · ':''}${equipmentPrice(w,af,'band')??0} GC</small></span></label>`).join('')}</div></details>`).join('')}</div>`;
}
function fighterPool(f){
  // A custom warband's own `f.warriors` (built by customWarbandWarriors) already
  // includes every custom fighter profile checked into that warband's own
  // "Combattants" tab. customFightersForFaction(f) separately matches any custom
  // fighter whose own "Bande" field also points at this same warband. When both
  // are true for the same profile — which is the normal way to add a custom
  // fighter to a custom warband — it used to appear twice in the recruitment
  // pool. Dedupe by id so each profile shows (and can be recruited) only once.
  const base=Array.isArray(f?.warriors)?f.warriors:[];
  const seenIds=new Set(base.map(w=>w.id));
  const all=[...base,...customFightersForFaction(f).filter(w=>!seenIds.has(w.id))];
  const r=activeRoster();return `<div class="pool-grid">${all.map(w=>{const owned=(r?.fighters||[]).filter(x=>x.wid===w.id).length;const maxed=w.max!==null&&owned>=w.max;return `<article class="fighter-card-v4 fighter-row ${maxed?'maxed':''}" data-name="${esc(w.name.toLowerCase())}" data-type="${esc(w.type)}"><div class="fighter-top"><div class="fighter-ident"><div class="fighter-sigil">${w.custom?'✦':(factionSigils[f.id]||'◆')}</div><div><div class="fighter-name-line"><h4>${esc(w.name)}</h4><span class="role-badge role-${esc(w.type.toLowerCase().replace(/\s+/g,'-'))}">${esc(w.type)}</span>${w.custom?'<span class="custom-armory-badge">CUSTOM</span>':''}</div><div class="fighter-subline">${w.max!==null?'Maximum '+w.max:'Aucune limite'} · ${owned} recrutée${owned!==1?'s':''}</div></div></div><span class="fc-cost">${w.cost} GC</span></div>${profileMarkup(effectiveFighterProfile(w,f),0,{equipmentSelected:[]},{rosterCard:true})}${w.description?`<div class="fighter-description">${customTextMarkup(w.description)}</div>`:''}<div class="fighter-bottom"><div><span class="micro-label">RÈGLES / ACCÈS</span><p>${fighterRuleNames(w,f).map(n=>refLink('special',n,n)).join(' · ')}</p></div></div><button class="button primary recruit-btn recruit-btn-full" type="button" data-recruit-fighter="${esc(w.id)}" ${maxed?'disabled':''}>${maxed?'Limite atteinte':`Recruter — ${w.cost} GC`}</button></article>`}).join('')}</div>`}
window.addFighter=addFighter;
window.setGangTab=setGangTab;
window.filterFighters=filterFighters;

// Recruitment buttons use a capture-phase listener so parent handlers cannot swallow the click.
window.addEventListener('click',e=>{
  const btn=e.target.closest?.('[data-recruit-fighter]');
  if(!btn)return;
  const id=btn.getAttribute('data-recruit-fighter');
  if(!id)return;
  e.preventDefault();
  e.stopPropagation();
  try{
    addFighter(id);
  }catch(err){
    console.error('Recruitment error:',err);
    toast('Erreur lors du recrutement');
  }
},true);

function fighter(){const r=activeRoster(),x=r?.fighters[editingIndex];if(!r||!x){render('builder');return}ensureFighterSourceData(x,r);$('#content').innerHTML=fighterPageMarkup(x);if(x.customFighterId&&x.description){const grid=$('#content .fighter-detail-grid');if(grid){const s=document.createElement('section');s.className='sheet-block custom-fighter-description-block';s.innerHTML=`<div class="sheet-block-head prominent-section"><h4>Description</h4></div><p class="fighter-description">${customTextMarkup(x.description)}</p>`;grid.prepend(s)}}}

/* V67 — Custom reference content: traits, skill trees, magic domains and special rules */
if(!Array.isArray(state.customTraits))state.customTraits=[];
if(!Array.isArray(state.customSkills))state.customSkills=[];
if(!Array.isArray(state.customSpells))state.customSpells=[];
if(!Array.isArray(state.customSpecialRules))state.customSpecialRules=[];
if(!Array.isArray(state.customSkillTrees))state.customSkillTrees=[];
if(!Array.isArray(state.customMagicDomains))state.customMagicDomains=[];
let customContentTab='traits';
let customContentEditId=null;
let customContentSearch='';
let customContentDraftItems=[];

function customContentList(kind){
  const map={traits:'customTraits',skills:'customSkills',spells:'customSpells',special:'customSpecialRules'};
  const key=map[kind]; if(!key)return [];
  if(!Array.isArray(state[key]))state[key]=[];
  return state[key];
}
function customContentById(kind,id){return customContentList(kind).find(x=>x.customContentId===id)||null}
function customContentReferenceEntries(kind){
  const base=Array.isArray(RULES.categories?.[kind])?RULES.categories[kind]:[];
  return [...base,...customContentList(kind).map(x=>({id:'custom-'+kind+'-'+x.customContentId,name:x.name,text:x.text||'Aucune règle enregistrée.',lines:String(x.text||'').split(/\n+/).filter(Boolean).length||1,custom:true,customContentId:x.customContentId,category:x.domain||x.tree||''}))];
}
function referenceEntries(category){
  if(category==='equipment'){
    const base=Array.isArray(RULES.categories?.equipment)?RULES.categories.equipment:[];
    const customs=[...customEquipmentList(),...officialCustomEquipmentList()].map(w=>({id:'custom-equipment-'+w.customEquipmentId,name:w.name,text:w.rulesText||'Aucune règle supplémentaire enregistrée.',lines:String(w.rulesText||'').split(/\n+/).filter(Boolean).length||1,custom:true,customEquipmentId:w.customEquipmentId}));
    return [...base,...customs];
  }
  if(['traits','skills','spells','special'].includes(category))return customContentReferenceEntries(category);
  return Array.isArray(RULES.categories?.[category])?RULES.categories[category]:[];
}
// `f` (optional): the ACTIVE ROSTER'S faction. When it's an officialized
// warband with trees/domains exclusive to it (f.exclusiveSkillSets /
// f.exclusiveMagicDomains — brand-new trees that didn't exist anywhere
// before that warband was published), those are merged in too, but ONLY for
// callers resolving a specific fighter's own access — never for the generic
// "pick a tree for a brand-new custom fighter" pickers, which call this with
// no faction and so never see them. That keeps a warband-exclusive tree
// usable exactly by the warriors it was attributed to in the custom editor,
// not assignable to unrelated fighters via the custom-content tools.
function customMergedSkillSets(f){
  const out={}; Object.entries(D.skillSets||{}).forEach(([k,v])=>out[k]=Array.isArray(v)?v.slice():[]);
  customSkillTreeList().forEach(t=>{if(!out[t.name])out[t.name]=[]});
  customContentList('skills').forEach(s=>{if(s.tree){if(!out[s.tree])out[s.tree]=[];if(!out[s.tree].includes(s.name))out[s.tree].push(s.name)}});
  if(f?.exclusiveSkillSets)Object.entries(f.exclusiveSkillSets).forEach(([k,v])=>{if(!out[k])out[k]=[];(Array.isArray(v)?v:[]).forEach(n=>{if(!out[k].includes(n))out[k].push(n)})});
  return out;
}
function customMergedMagicDomains(f){
  const out={};Object.entries(MAGIC_DOMAINS||{}).forEach(([k,v])=>out[k]=Array.isArray(v)?v.slice():[]);
  customMagicDomainList().forEach(d=>{if(!out[d.name])out[d.name]=[]});
  customContentList('spells').forEach(s=>{if(s.domain){if(!out[s.domain])out[s.domain]=[];if(!out[s.domain].includes(s.name))out[s.domain].push(s.name)}});
  if(f?.exclusiveMagicDomains)Object.entries(f.exclusiveMagicDomains).forEach(([k,v])=>{if(!out[k])out[k]=[];(Array.isArray(v)?v:[]).forEach(n=>{if(!out[k].includes(n))out[k].push(n)})});
  return out;
}
function customSkillTreeList(){if(!Array.isArray(state.customSkillTrees))state.customSkillTrees=[];return state.customSkillTrees}
function customMagicDomainList(){if(!Array.isArray(state.customMagicDomains))state.customMagicDomains=[];return state.customMagicDomains}
function customSkillTreeById(id){return customSkillTreeList().find(x=>x.id===id)||null}
function customMagicDomainById(id){return customMagicDomainList().find(x=>x.id===id)||null}
function customTreeNameExists(name){const n=normName(name);return Object.keys(D.skillSets||{}).some(x=>normName(x)===n)||customSkillTreeList().some(x=>normName(x.name)===n)}
function customDomainNameExists(name){const n=normName(name);return Object.keys(MAGIC_DOMAINS||{}).some(x=>normName(x)===n)||customMagicDomainList().some(x=>normName(x.name)===n)}
function customSkillTreePanel(){const trees=customSkillTreeList();return `<details class="custom-collapse" open><summary><span>CRÉATION DES ARBRES DE COMPÉTENCES</span><small>${trees.length} arbre${trees.length!==1?'s':''} custom</small></summary><div class="custom-tree-manager"><div class="custom-tree-create"><input id="newSkillTreeName" placeholder="Nom du nouvel arbre…"><input id="newSkillTreeDesc" placeholder="Description (facultatif)"><button type="button" class="button secondary" onclick="createCustomSkillTree()">＋ Créer l’arbre</button></div>${trees.length?`<div class="custom-tree-list">${trees.map(t=>{const count=(customMergedSkillSets()[t.name]||[]).filter(n=>(customContentList('skills').find(x=>x.name===n)?.tree===t.name)).length;return `<div class="custom-tree-row"><div><strong>${esc(t.name)}</strong><small>${count}/6 compétences custom</small></div><button type="button" class="equipment-action remove" onclick="deleteCustomSkillTree('${t.id}')">🗑</button></div>`}).join('')}</div>`:'<div class="muted">Aucun arbre custom. Crée d’abord un arbre, puis ajoute 1 à 6 compétences.</div>'}</div></details>`}
function customMagicDomainPanel(){const domains=customMagicDomainList();return `<details class="custom-collapse" open><summary><span>CRÉATION DES DOMAINES DE MAGIE</span><small>${domains.length} domaine${domains.length!==1?'s':''} custom</small></summary><div class="custom-tree-manager"><div class="custom-tree-create"><input id="newMagicDomainName" placeholder="Nom du nouveau domaine…"><input id="newMagicDomainDesc" placeholder="Description (facultatif)"><button type="button" class="button secondary" onclick="createCustomMagicDomain()">＋ Créer le domaine</button></div>${domains.length?`<div class="custom-tree-list">${domains.map(d=>{const count=(customMergedMagicDomains()[d.name]||[]).filter(n=>(customContentList('spells').find(x=>x.name===n)?.domain===d.name)).length;return `<div class="custom-tree-row"><div><strong>${esc(d.name)}</strong><small>${count}/6 sorts custom</small></div><button type="button" class="equipment-action remove" onclick="deleteCustomMagicDomain('${d.id}')">🗑</button></div>`}).join('')}</div>`:'<div class="muted">Aucun domaine custom. Crée d’abord un domaine, puis ajoute 1 à 6 sorts.</div>'}</div></details>`}
function createCustomSkillTree(){const name=($('#newSkillTreeName')?.value||'').trim(),description=($('#newSkillTreeDesc')?.value||'').trim();if(!name)return toast('Donne un nom à l’arbre');if(customTreeNameExists(name))return toast('Cet arbre existe déjà');state.customSkillTrees.push({id:crypto.randomUUID(),name,description});save(true);render('custom');toast('Arbre de compétences créé')}
function createCustomMagicDomain(){const name=($('#newMagicDomainName')?.value||'').trim(),description=($('#newMagicDomainDesc')?.value||'').trim();if(!name)return toast('Donne un nom au domaine');if(customDomainNameExists(name))return toast('Ce domaine existe déjà');state.customMagicDomains.push({id:crypto.randomUUID(),name,description});save(true);render('custom');toast('Domaine de magie créé')}
function deleteCustomSkillTree(id){const t=customSkillTreeById(id);if(!t)return;const used=customContentList('skills').some(x=>x.tree===t.name);if(used)return toast('Impossible de supprimer un arbre contenant des compétences custom');markDeleted('customSkillTrees',id);state.customSkillTrees=customSkillTreeList().filter(x=>x.id!==id);save(true);render('custom');toast('Arbre supprimé')}
function deleteCustomMagicDomain(id){const d=customMagicDomainById(id);if(!d)return;const used=customContentList('spells').some(x=>x.domain===d.name);if(used)return toast('Impossible de supprimer un domaine contenant des sorts custom');markDeleted('customMagicDomains',id);state.customMagicDomains=customMagicDomainList().filter(x=>x.id!==id);save(true);render('custom');toast('Domaine supprimé')}
function customFighterSkillNames(){return [...new Set(Object.values(customMergedSkillSets()).flat())].sort((a,b)=>a.localeCompare(b))}
function customContentTypeLabel(k){return {traits:'Trait d’arme',skills:'Compétence',spells:'Sort',special:'Règle spéciale'}[k]||k}
function removeCustomContentDraft(i){customContentDraftItems.splice(i,1);render('custom')}
function customContentDraftItemMarkup(kind,x,i){return `<span class="custom-trait-tag">${refLink(kind,x.name,x.name)}<button type="button" onclick="removeCustomContentDraft(${i})">×</button></span>`}
function customContentForm(kind,w){
  const draft=customContentDraftItems;
  const isSkill=kind==='skills',isSpell=kind==='spells';
  const trees=Object.keys(customMergedSkillSets()),domains=Object.keys(customMergedMagicDomains());
  return `<div class="custom-form-head"><div><div class="eyebrow">${w?'MODIFICATION':'NOUVELLE ENTRÉE'}</div><h3>${esc(w?.name||'Créer '+customContentTypeLabel(kind).toLowerCase())}</h3></div>${w?`<button type="button" class="button secondary" onclick="newCustomContent('${kind}')">＋ Nouveau</button>`:''}</div>
  <div class="custom-form-grid"><label class="custom-field wide"><span>Nom</span><input id="ccName" value="${esc(w?.name||'')}" placeholder="Nom de la ${customContentTypeLabel(kind).toLowerCase()}"></label>
  ${isSkill?`<label class="custom-field"><span>Arbre de compétences</span><select id="ccTree"><option value="">Choisir un arbre…</option>${trees.map(t=>`<option value="${esc(t)}" ${w?.tree===t?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`:''}
  ${isSpell?`<label class="custom-field"><span>Domaine de magie</span><select id="ccDomain"><option value="">Choisir un domaine…</option>${domains.map(t=>`<option value="${esc(t)}" ${w?.domain===t?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`:''}</div>
  ${isSkill?customSkillTreePanel():''}${isSpell?customMagicDomainPanel():''}
  <details class="custom-collapse" open><summary><span>TEXTE / RÈGLE</span><small>Affiché dans le Référentiel</small></summary>${customTextToolbarMarkup('ccText')}<textarea id="ccText" class="wide-textarea" rows="7" placeholder="Texte complet de la règle…">${esc(w?.text||'')}</textarea></details>
  <div class="custom-actions"><button type="button" class="button secondary" onclick="resetCustomContentForm('${kind}')">Réinitialiser</button><button type="button" class="button primary" onclick="saveCustomContent('${kind}')">${w?'Enregistrer les modifications':'Créer'}</button></div>`;
}
function newCustomContent(kind){customContentTab=kind;customContentEditId=null;customContentDraftItems=[];customContentSearch='';render('custom')}
function editCustomContent(kind,id){const w=customContentById(kind,id);if(!w)return;customContentTab=kind;customContentEditId=id;customContentDraftItems=[];render('custom')}
function deleteCustomContent(kind,id){const w=customContentById(kind,id);if(!w)return;openModal(`<div class="delete-dialog"><div class="eyebrow">SUPPRESSION</div><h2>Supprimer « ${esc(w.name)} » ?</h2><p>Les profils et combattants déjà enregistrés ne sont pas modifiés rétroactivement.</p><button type="button" class="big-delete" onclick="confirmDeleteCustomContent('${kind}','${id}')">SUPPRIMER</button><button type="button" class="button secondary full" onclick="closeModal()">Annuler</button></div>`)}
function confirmDeleteCustomContent(kind,id){const map={traits:'customTraits',skills:'customSkills',spells:'customSpells',special:'customSpecialRules'};const key=map[kind];markDeleted(key,id);state[key]=customContentList(kind).filter(x=>x.customContentId!==id);customContentEditId=null;save(true);closeModal();render('custom');toast('Entrée supprimée')}
function saveCustomContent(kind){
  const name=($('#ccName')?.value||'').trim(),text=($('#ccText')?.value||'').trim();
  if(!name){toast('Donne un nom à l’entrée');return}
  if(!text){toast('Ajoute le texte de la règle');return}
  const item={customContentId:customContentEditId||crypto.randomUUID(),name,text};
  if(kind==='skills')item.tree=($('#ccTree')?.value||'').trim();
  if(kind==='spells')item.domain=($('#ccDomain')?.value||'').trim();
  if(kind==='skills'&&item.tree&&customSkillTreeList().some(t=>t.name===item.tree)){const cur=customContentList('skills').find(x=>x.customContentId===item.customContentId);const count=customContentList('skills').filter(x=>x.tree===item.tree&&x.customContentId!==item.customContentId).length;if(count>=6){toast('Cet arbre custom contient déjà 6 compétences');return}}
  if(kind==='spells'&&item.domain&&customMagicDomainList().some(d=>d.name===item.domain)){const cur=customContentList('spells').find(x=>x.customContentId===item.customContentId);const count=customContentList('spells').filter(x=>x.domain===item.domain&&x.customContentId!==item.customContentId).length;if(count>=6){toast('Ce domaine custom contient déjà 6 sorts');return}}
  const map={traits:'customTraits',skills:'customSkills',spells:'customSpells',special:'customSpecialRules'},key=map[kind],arr=customContentList(kind),idx=arr.findIndex(x=>x.customContentId===item.customContentId);item.archived=idx>=0?!!arr[idx].archived:false;if(idx>=0)state[key][idx]=item;else state[key].push(item);customContentEditId=item.customContentId;save(true);render('custom');toast(idx>=0?'Entrée modifiée':'Entrée créée')
}
function resetCustomContentForm(kind){customContentEditId=null;customContentDraftItems=[];render('custom')}
function toggleCustomContentArchive(kind,id){const w=customContentById(kind,id);if(!w)return;w.archived=!w.archived;save(true);render('custom');toast(w.archived?'Entrée archivée':'Entrée désarchivée')}
function customContentLibraryRow(kind,w,isOfficial){const place=w.tree||w.domain||'';
  // Library rows are a picklist, not a fiche: just enough to identify the
  // entry (name / type / arbre-domaine). The full rule text is shown once,
  // in the editor itself (✎), not duplicated here — same principle as the
  // custom fighter rows.
  return `<article class="custom-item-row${w.archived?' is-archived':''}"><div class="custom-item-main"><div class="custom-item-icon">${kind==='traits'?'◆':kind==='skills'?'★':kind==='spells'?'✦':'✚'}</div><div><strong>${esc(w.name)}</strong><small>${w.archived?'<span class="archived-tag">ARCHIVÉ</span> · ':''}${isOfficial?'<span class="archived-tag official-tag">OFFICIALISÉ</span> · ':''}${esc(customContentTypeLabel(kind))}${place?' · '+esc(place):''}</small></div></div><div class="custom-item-actions"><button type="button" class="equipment-action" title="${w.archived?'Désarchiver':'Archiver'}" onclick="toggleCustomContentArchive('${kind}','${w.customContentId}')">${w.archived?'⇤':'🗄'}</button><button type="button" class="equipment-action" onclick="editCustomContent('${kind}','${w.customContentId}')">✎</button><button type="button" class="equipment-action remove" onclick="deleteCustomContent('${kind}','${w.customContentId}')">🗑</button></div></article>`}


/* V70b — inline custom Skill Tree / Magic Domain builders.
   Kept separate from the legacy content editor so the existing V68 data model remains compatible. */
let customTreeComposer={kind:null,parentId:null,itemId:null};
function customBuilderParentList(kind){return kind==='skills'?customSkillTreeList():customMagicDomainList()}
function customBuilderParentName(kind,p){return p?.name||''}
function customBuilderItems(kind,parent){
  const field=kind==='skills'?'tree':'domain';
  return customContentList(kind).filter(x=>normName(x[field]||'')===normName(parent?.name||''));
}
function customBuilderParentId(kind,p){return p?.id||''}
function customBuilderItemById(kind,id){return customContentById(kind,id)}
function customBuilderResetComposer(){customTreeComposer={kind:null,parentId:null,itemId:null}}
function customBuilderOpenNew(kind,parentId){customTreeComposer={kind,parentId,itemId:null};render('custom')}
function customBuilderOpenEdit(kind,parentId,itemId){customTreeComposer={kind,parentId,itemId};render('custom')}
function customBuilderClose(){customBuilderResetComposer();render('custom')}
function customBuilderDelete(kind,id){
  const w=customBuilderItemById(kind,id); if(!w)return;
  openModal(`<div class="delete-dialog"><div class="eyebrow">SUPPRESSION</div><h2>Supprimer « ${esc(w.name)} » ?</h2><p>Cette entrée custom sera retirée de son arbre/domaine.</p><button type="button" class="big-delete" onclick="confirmCustomBuilderDelete('${kind}','${id}')">SUPPRIMER</button><button type="button" class="button secondary full" onclick="closeModal()">Annuler</button></div>`)
}
function confirmCustomBuilderDelete(kind,id){
  const map={skills:'customSkills',spells:'customSpells'}; const key=map[kind];
  if(!key)return; markDeleted(key,id); state[key]=customContentList(kind).filter(x=>x.customContentId!==id);
  customBuilderResetComposer(); save(true); closeModal(); render('custom'); toast(kind==='skills'?'Compétence supprimée':'Sort supprimé')
}
function customBuilderSaveItem(kind,parentId,itemId){
  const parent=customBuilderParentList(kind).find(x=>x.id===parentId); if(!parent)return toast('Arbre/domaine introuvable');
  const name=($('#cbName')?.value||'').trim(), text=($('#cbText')?.value||'').trim();
  if(!name)return toast('Donne un nom'); if(!text)return toast('Ajoute le texte de la règle');
  const field=kind==='skills'?'tree':'domain';
  const arr=customContentList(kind);
  const duplicate=arr.find(x=>normName(x.name)===normName(name)&&x.customContentId!==itemId);
  if(duplicate)return toast('Une entrée portant ce nom existe déjà');
  const existing=itemId?arr.find(x=>x.customContentId===itemId):null;
  const count=arr.filter(x=>normName(x[field]||'')===normName(parent.name)&&x.customContentId!==(itemId||'')).length;
  if(!existing && count>=6)return toast(`Maximum de 6 ${kind==='skills'?'compétences':'sorts'} dans cet ${kind==='skills'?'arbre':'domaine'}`);
  const item={customContentId:itemId||crypto.randomUUID(),name,text}; item[field]=parent.name;
  const map={skills:'customSkills',spells:'customSpells'},key=map[kind],idx=arr.findIndex(x=>x.customContentId===item.customContentId);
  item.archived=idx>=0?!!arr[idx].archived:false;
  if(idx>=0)state[key][idx]=item; else state[key].push(item);
  customBuilderResetComposer(); save(true); render('custom'); toast(idx>=0?(kind==='skills'?'Compétence modifiée':'Sort modifié'):(kind==='skills'?'Compétence créée':'Sort créé'))
}
function customBuilderComposerMarkup(kind,parent,item){
  const isSkill=kind==='skills',label=isSkill?'compétence':'sort';
  return `<div class="custom-inline-composer">
    <div class="custom-inline-head"><div><div class="eyebrow">${item?'MODIFICATION':'NOUVELLE ENTRÉE'}</div><strong>${item?'Modifier':'Créer'} une ${label}</strong><small>${esc(parent.name)}</small></div><button type="button" class="equipment-action" onclick="customBuilderClose()">×</button></div>
    <div class="custom-inline-grid"><label class="custom-field"><span>Nom</span><input id="cbName" value="${esc(item?.name||'')}" placeholder="Nom de la ${label}"></label><label class="custom-field"><span>${isSkill?'Arbre de compétences':'Domaine de magie'}</span><input value="${esc(parent.name)}" disabled></label></div>
    <label class="custom-field custom-inline-text"><span>Règle / texte</span>${customTextToolbarMarkup('cbText')}<textarea id="cbText" class="wide-textarea" rows="5" placeholder="Texte complet de la règle…">${esc(item?.text||'')}</textarea></label>
    <div class="custom-actions"><button type="button" class="button secondary" onclick="customBuilderClose()">Annuler</button><button type="button" class="button primary" onclick="customBuilderSaveItem('${kind}','${parent.id}','${item?.customContentId||''}')">${item?'Enregistrer':'Créer '+label}</button></div>
  </div>`
}
function customSkillSpellBuilder(kind){
  const en=siteLanguage==='en';
  const isSkill=kind==='skills',parents=customBuilderParentList(kind),composer=customTreeComposer.kind===kind?customTreeComposer:null;
  const title=en?(isSkill?'SKILL TREES':'MAGIC DOMAINS'):(isSkill?'ARBRES DE COMPÉTENCES':'DOMAINES DE MAGIE');
  const label=en?(isSkill?'tree':'domain'):(isSkill?'arbre':'domaine');
  const itemLabel=en?(isSkill?'skill':'spell'):(isSkill?'compétence':'sort');
  const createId=isSkill?'newSkillTreeName':'newMagicDomainName', descId=isSkill?'newSkillTreeDesc':'newMagicDomainDesc';
  const createFn=isSkill?'createCustomSkillTree':'createCustomMagicDomain';
  const cards=parents.map(parent=>{
    const items=customBuilderItems(kind,parent),active=composer&&composer.parentId===parent.id;
    const editItem=active&&composer.itemId?customBuilderItemById(kind,composer.itemId):null;
    return `<section class="custom-tree-card">
      <header class="custom-tree-card-head"><div><div class="eyebrow">${isSkill?(en?'SKILL TREE':'ARBRE DE COMPÉTENCES'):(en?'MAGIC DOMAIN':'DOMAINE DE MAGIE')}</div><h3>${esc(parent.name)}</h3></div><div class="custom-tree-card-meta"><span>${items.length}/6</span><button type="button" class="equipment-action remove" onclick="${isSkill?'deleteCustomSkillTree':'deleteCustomMagicDomain'}('${parent.id}')">🗑</button></div></header>
      <div class="custom-builder-items">${items.map((item,i)=>`<div class="custom-builder-item"><div class="custom-builder-item-main"><span class="custom-builder-index">${i+1}</span><div><strong>${refLink(isSkill?'skills':'spells',item.name,item.name)}</strong><p>${customTextMarkup(item.text||'')}</p></div></div><div class="custom-builder-item-actions"><button type="button" class="equipment-action" title="${en?'Edit':'Modifier'}" onclick="customBuilderOpenEdit('${kind}','${parent.id}','${item.customContentId}')">✎</button><button type="button" class="equipment-action remove" title="${en?'Delete':'Supprimer'}" onclick="customBuilderDelete('${kind}','${item.customContentId}')">🗑</button></div></div>`).join('')||`<div class="custom-builder-empty">${en?'No custom entry in this':'Aucune entrée custom dans cet'} ${label}.</div>`}</div>
      ${active?customBuilderComposerMarkup(kind,parent,editItem):items.length>=6?`<div class="custom-builder-limit">${en?'Maximum reached: 6':'Maximum atteint : 6'} ${itemLabel}${en?'s':'s'}.</div>`:`<button type="button" class="custom-add-slot" onclick="customBuilderOpenNew('${kind}','${parent.id}')"><span>＋</span> ${en?'Add a':'Ajouter un'} ${itemLabel}</button>`}
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
  const isSkill=kind==='skills';
  const field=isSkill?'tree':'domain';
  const parents=customBuilderParentList(kind);
  const q=(customContentSearch||'').toLowerCase();
  const matches=w=>!q||((w.name+' '+(w.text||'')+' '+(w[field]||'')).toLowerCase().includes(q));
  const all=customContentList(kind);
  const filteredTotal=all.filter(matches).length;
  const officialIds=officializedContentIdSets()[kind];
  const rowFn=w=>customContentLibraryRow(kind,w,officialIds.has(w.customContentId));
  const groupMarkup=(name,items,isOrphan)=>{
    if(!items.length)return '';
    return `<details class="custom-collapse custom-content-group${isOrphan?' custom-content-group-orphan':''}"${q?' open':''}><summary><span>${esc(name)}</span><small>${items.length}${isOrphan?'':'/6'}</small></summary><div class="custom-item-list">${items.map(rowFn).join('')}</div></details>`;
  };
  const knownNames=new Set(parents.map(p=>normName(p.name)));
  const body=parents.map(parent=>groupMarkup(parent.name,customBuilderItems(kind,parent).filter(matches))).join('')
    +groupMarkup(isSkill?'Sans arbre':'Sans domaine',all.filter(w=>matches(w)&&!knownNames.has(normName(w[field]||''))),true);
  return `<aside class="card custom-library"><div class="custom-library-head"><div><div class="eyebrow">BIBLIOTHÈQUE</div><h3>${isSkill?'Compétences':'Sorts'} custom</h3></div><span>${filteredTotal}</span></div><input class="search" value="${esc(customContentSearch)}" placeholder="Rechercher…" oninput="customContentSearch=this.value;render('custom')"><div class="custom-item-list">${body||'<div class="empty large"><strong>Aucune entrée custom.</strong><span>Crée-la directement dans son arbre/domaine.</span></div>'}</div></aside>`
}
function custom(){
  const tabs=[['traits','◆ Traits'],['skills','★ Compétences'],['spells','✦ Sorts'],['special','✚ Règles spéciales'],['fighters','⚔ Combattants'],['equipment','◇ Équipements'],['warband','⚔ Warband']];
  let title,createLabel,action,editor,library;
  if(customContentTab==='warband'){
    const list=customWarbandList(); title='Warbands personnalisées'; createLabel='Nouvelle Warband'; action='newCustomWarband()'; editor=customWarbandEditorPanel();
    const q=(customContentSearch||'').trim().toLowerCase(); const matches=w=>!q||(w.name+' '+(w.description||'')).toLowerCase().includes(q);
    // A warband that's been officialized is archived out of the main list —
    // it's still fully editable (as an OFFICIAL DRAFT) and searchable, just
    // tucked under a collapsed section so it doesn't clutter the library
    // with an entry that now has a published official faction in its place.
    const active=list.filter(w=>!w.officialId&&matches(w));
    const archived=list.filter(w=>w.officialId&&matches(w));
    // A search that only matches something in the archived section still needs
    // to be reachable — auto-expand the <details> whenever a query is active,
    // instead of leaving matches hidden behind a collapsed summary.
    library=`<aside class="card custom-library"><div class="custom-library-head"><div><div class="eyebrow">BIBLIOTHÈQUE</div><h3>Warbands custom</h3></div><span>${active.length+archived.length}</span></div><input class="search" value="${esc(customContentSearch)}" placeholder="Rechercher…" oninput="customContentSearch=this.value;render('custom')"><div class="custom-item-list">${active.length?active.map(customWarbandSummaryRow).join(''):(archived.length?'':'<div class="empty large"><strong>Aucune Warband custom.</strong><span>Crée la première avec le bouton ci-dessus.</span></div>')}</div>${archived.length?`<details class="custom-collapse custom-warband-archive"${q?' open':''}><summary><span>ARCHIVÉES · OFFICIALISÉES</span><small>${archived.length}</small></summary><div class="custom-item-list">${archived.map(customWarbandSummaryRow).join('')}</div></details>`:''}</aside>`;
  }else if(customContentTab==='skills'||customContentTab==='spells'){
    const isSkill=customContentTab==='skills'; title=isSkill?'Compétences personnalisées':'Sorts personnalisés'; createLabel=''; action=''; editor=customSkillSpellBuilder(customContentTab); library=customBuilderLibrary(customContentTab);
  }else{
    const list=customContentTab==='fighters'?customFighterList():customContentTab==='equipment'?customEquipmentList():customContentList(customContentTab);
    const q=(customContentSearch||'').toLowerCase();
    const filtered=list.filter(w=>{
      if(!q)return true;
      const haystack=customContentTab==='fighters'?(w.name+' '+(w.type||'')+' '+(w.race||'')):customContentTab==='equipment'?(w.name+' '+(w.category||'')+' '+(w.subcategory||'')+' '+(w.rulesText||'')):(w.name+' '+(w.text||'')+' '+(w.tree||'')+' '+(w.domain||''));
      return haystack.toLowerCase().includes(q);
    });
    // Archived entries (manually tucked away to free up visible space, same
    // idea as officialized warbands) stay searchable but sit collapsed under
    // their own section — auto-expanded whenever a search matches inside it.
    // Equipment/traits/special also get a third bucket: entries already
    // bundled into a published/officialized warband (see
    // officializedEquipmentIdSet / officializedContentIdSets) are read-only
    // "official" content in spirit — still editable here, but tucked into
    // their own collapsed folder so they don't drown out what the user is
    // still actively building.
    const officialFighterIds=customContentTab==='fighters'?officializedFighterIdSet():null;
    const officialEqIds=customContentTab==='equipment'?officializedEquipmentIdSet():null;
    const officialContentSets=(customContentTab==='traits'||customContentTab==='special')?officializedContentIdSets():null;
    const isOfficialized=w=>{
      if(officialFighterIds)return officialFighterIds.has(w.customFighterId);
      if(officialEqIds)return officialEqIds.has(w.customEquipmentId);
      if(officialContentSets)return officialContentSets[customContentTab].has(w.customContentId);
      return false;
    };
    const active=filtered.filter(w=>!w.archived&&!isOfficialized(w));
    const archived=filtered.filter(w=>w.archived&&!isOfficialized(w));
    const officialized=(officialFighterIds||officialEqIds||officialContentSets)?filtered.filter(isOfficialized):[];
    const rowFn=w=>customContentTab==='fighters'?customFighterRow(w,isOfficialized(w)):customContentTab==='equipment'?customEquipmentRow(w):customContentLibraryRow(customContentTab,w);
    if(customContentTab==='fighters'){const editingF=customFighterEditId?customFighterById(customFighterEditId):null;editor=customFighterForm(editingF)} else if(customContentTab==='equipment'){const editingEq=customEquipmentEditId?state.customEquipment.find(x=>x.customEquipmentId===customEquipmentEditId):null;editor=customEquipmentForm(editingEq)} else {const editing=customContentEditId?customContentById(customContentTab,customContentEditId):null;editor=customContentForm(customContentTab,editing)}
    title=customContentTab==='fighters'?'Profils de combattants':customContentTab==='equipment'?'Équipements personnalisés':customContentTypeLabel(customContentTab)+'s personnalisés';
    createLabel=customContentTab==='fighters'?'Nouveau combattant':customContentTab==='equipment'?'Nouvel équipement':'Nouvelle '+customContentTypeLabel(customContentTab).toLowerCase();
    action=customContentTab==='fighters'?'newCustomFighter()':customContentTab==='equipment'?'newCustomEquipment()':`newCustomContent('${customContentTab}')`;
    library=`<aside class="card custom-library"><div class="custom-library-head"><div><div class="eyebrow">BIBLIOTHÈQUE</div><h3>${esc(title)}</h3></div><span>${filtered.length}</span></div><input class="search" value="${esc(customContentSearch)}" placeholder="Rechercher…" oninput="customContentSearch=this.value;render('custom')"><div class="custom-item-list">${active.length?active.map(rowFn).join(''):(archived.length||officialized.length?'':`<div class="empty large"><strong>Aucune entrée custom.</strong><span>Crée la première avec le bouton ci-dessus.</span></div>`)}</div>${officialized.length?`<details class="custom-collapse custom-item-official"${q?' open':''}><summary><span>OFFICIALISÉS</span><small>${officialized.length}</small></summary><div class="custom-item-list">${officialized.map(rowFn).join('')}</div></details>`:''}${archived.length?`<details class="custom-collapse custom-item-archive"${q?' open':''}><summary><span>ARCHIVÉES</span><small>${archived.length}</small></summary><div class="custom-item-list">${archived.map(rowFn).join('')}</div></details>`:''}</aside>`;
  }
  const introButton=(customContentTab==='skills'||customContentTab==='spells')?'':(action?`<button class="button primary" onclick="${action}">＋ ${esc(createLabel)}</button>`:'');
  const description=customContentTab==='warband'?'Crée une Warband personnalisée, puis associe-lui tes combattants, équipements, règles spéciales et traits custom.':(customContentTab==='skills'||customContentTab==='spells')?(customContentTab==='skills'?'Crée un arbre de compétences avant d’ajouter ses compétences. Chaque arbre peut contenir jusqu’à 6 compétences custom.':'Crée un domaine de magie avant d’ajouter ses sorts. Chaque domaine peut contenir jusqu’à 6 sorts custom.'):'Crée du contenu personnalisé sans modifier le catalogue M17. Les entrées sont reliées au Référentiel.';
  $('#content').innerHTML=`<div class="custom-page"><div class="page-intro"><div><div class="eyebrow">FORGE / CUSTOM CONTENT</div><h2>${esc(title)}</h2><p>${description}</p></div>${introButton}</div><div class="custom-top-tabs">${tabs.map(([id,label])=>`<button type="button" class="custom-top-tab ${customContentTab===id?'active':''}" onclick="setCustomTab('${id}')">${label} <span>${id==='fighters'?customFighterList().length:id==='equipment'?customEquipmentList().length:id==='warband'?customWarbandList().length:customContentList(id).length}</span></button>`).join('')}</div><div class="custom-workspace"><section class="card custom-editor">${editor}</section>${library}</div></div>`;
}
function customWarbandEditorPanel(){
  if(customWarbandCreating)return customWarbandCreateForm();
  if(customWarbandEditId){const cw=customWarbandById(customWarbandEditId);if(cw)return customWarbandEditor(cw);customWarbandEditId=null;}
  return `<div class="custom-warband-empty"><div class="eyebrow">WARBAND CUSTOM</div><h3>Forge ta propre Warband</h3><p>Crée d’abord son nom et sa description. Une fois sauvegardée, utilise <b>Modifier</b> dans la bibliothèque pour associer les combattants, l’équipement, les règles spéciales et les traits.</p><button type="button" class="button primary" onclick="newCustomWarband()">＋ Nouvelle Warband</button></div>`;
}
function setCustomTab(v){customContentTab=v;customContentSearch='';customBuilderResetComposer();if(v==='warband'){customWarbandEditId=null;customWarbandCreating=false;customWarbandSection='fighters'}else if(v==='fighters'){customFighterEditId=null}else if(v==='equipment'){customEquipmentEditId=null}else{customContentEditId=null;customContentDraftItems=[]}render('custom')}

/* ================= CUSTOM WARBANDS ================= */
let customWarbandEditId=null;
let customWarbandCreating=false;
let customWarbandSection='fighters';
// When true, the fighter/equipment pickers below hide entries that come from
// an already-existing (official book) warband, so building a warband from
// scratch isn't buried under every other faction's roster. Anything already
// selected stays visible regardless, so toggling this can never silently
// drop a pick made earlier.
let customWarbandHideOfficial=true;
function toggleCustomWarbandHideOfficial(v){customWarbandHideOfficial=!!v;render('custom')}
let selectedCustomWarbandId=null;
function customWarbandList(){
  if(!Array.isArray(state.customWarbands))state.customWarbands=[];
  return state.customWarbands
}
function customWarbandById(id){return customWarbandList().find(x=>x.id===id)||null}
function customWarbandFighterEntries(){
  const out=[];
  const seen=new Set();
  (D.factions||[]).forEach(f=>{
    (f.warriors||[]).forEach(w=>{
      const key=`official:${f.id}:${w.id}`;
      if(seen.has(key))return;
      seen.add(key);
      out.push({key,factionId:f.id,factionName:f.displayName||f.name||f.id,warrior:w,custom:false});
    });
  });
  customFighterList().forEach(w=>{
    const key=`custom:${w.customFighterId}`;
    if(seen.has(key))return;
    seen.add(key);
    out.push({key,factionId:'custom',factionName:'Custom',warrior:customFighterAsWarrior(w),custom:true,customFighterId:w.customFighterId});
  });
  return out;
}
function customWarbandEquipmentEntries(){
  const out=[];
  const seen=new Set();
  (D.weapons||[]).forEach(w=>{
    const key=`official:${w.name}`;
    if(seen.has(key))return;
    seen.add(key);
    out.push({key,equipment:w,custom:false});
  });
  [...customEquipmentList(),...officialCustomEquipmentList()].forEach(w=>{
    const key=`custom:${w.customEquipmentId}`;
    if(seen.has(key))return;
    seen.add(key);
    out.push({key,equipment:w,custom:true});
  });
  return out;
}
function customWarbandFighterRefs(cw){
  if(Array.isArray(cw?.fighterRefs))return cw.fighterRefs;
  return (cw?.fighterIds||[]).map(id=>`custom:${id}`);
}
function customWarbandEquipmentRefs(cw){
  if(Array.isArray(cw?.equipmentRefs))return cw.equipmentRefs;
  return (cw?.equipmentIds||[]).map(id=>`custom:${id}`);
}
function customWarbandWarriors(cw){
  const refs=new Set(customWarbandFighterRefs(cw));
  return customWarbandFighterEntries().filter(e=>refs.has(e.key)).map(e=>{
    if(e.custom)return e.warrior;
    return customFighterAsWarrior({
      ...e.warrior,
      id:`custom-warband-fighter-${cw.id}-${e.factionId}-${e.warrior.id}`,
      customFighterId:null,
      factionId:e.factionId,
      sourceFactionId:e.factionId,
      sourceWarriorId:e.warrior.id
    });
  });
}
function customWarbandEquipmentObjects(cw){
  const refs=new Set(customWarbandEquipmentRefs(cw));
  return customWarbandEquipmentEntries().filter(e=>refs.has(e.key)).map(e=>e.equipment);
}
function newCustomWarband(){customWarbandEditId=null;customWarbandCreating=true;customWarbandSection='fighters';render('custom');setTimeout(()=>$('#cwName')?.focus(),0)}
function editCustomWarband(id){if(!customWarbandById(id))return;customWarbandEditId=id;customWarbandCreating=false;customWarbandSection='fighters';render('custom')}
function deleteCustomWarband(id){const cw=customWarbandById(id);if(!cw)return;openModal(`<div class="delete-dialog"><div class="eyebrow">SUPPRESSION</div><h2>Supprimer « ${esc(cw.name)} » ?</h2><button type="button" class="big-delete" onclick="confirmDeleteCustomWarband('${id}')">SUPPRIMER</button><button type="button" class="button secondary full" onclick="closeModal()">Annuler</button></div>`)}
function confirmDeleteCustomWarband(id){markDeleted('customWarbands',id);state.customWarbands=customWarbandList().filter(x=>x.id!==id);if(customWarbandEditId===id)customWarbandEditId=null;save(true);closeModal();render('custom');toast('Warband custom supprimée')}
function saveCustomWarbandMeta(){const name=($('#cwName')?.value||'').trim(),description=($('#cwDescription')?.value||'').trim();if(!name){toast('Donne un nom à la Warband');return}let cw=customWarbandById(customWarbandEditId);const isNew=!cw;if(!cw){cw={id:crypto.randomUUID(),name:'',description:'',fighterIds:[],equipmentIds:[],fighterRefs:[],equipmentRefs:[],specialRuleIds:[],traitIds:[]};state.customWarbands.push(cw)}cw.name=name;cw.description=description;customWarbandEditId=null;customWarbandCreating=false;save(true);render('custom');toast(isNew?'Warband créée — utilise Modifier pour la configurer':'Warband sauvegardée')}
function setCustomWarbandSection(v){if(customWarbandEditId){customWarbandSection=v;render('custom')}}
function saveCustomWarbandConfiguration(){
  const cw=customWarbandById(customWarbandEditId);if(!cw)return;
  if(customWarbandSection==='fighters'){
    cw.fighterRefs=[...document.querySelectorAll('.cwFighter:checked')].map(x=>x.value);
    cw.fighterIds=cw.fighterRefs.filter(v=>v.startsWith('custom:')).map(v=>v.slice(7));
  }else if(customWarbandSection==='equipment'){
    cw.equipmentRefs=[...document.querySelectorAll('.cwEquipment:checked')].map(x=>x.value);
    cw.equipmentIds=cw.equipmentRefs.filter(v=>v.startsWith('custom:')).map(v=>v.slice(7));
  }else if(customWarbandSection==='special')cw.specialRuleIds=[...document.querySelectorAll('.cwSpecialRule:checked')].map(x=>x.value);
  else cw.traitIds=[...document.querySelectorAll('.cwTrait:checked')].map(x=>x.value);
  save(true);render('custom');toast('Configuration sauvegardée')
}
function customWarbandSummaryRow(cw){return `<article class="custom-item-row"><div class="custom-item-main"><div class="custom-item-icon">⚔</div><div><strong>${esc(cw.name)}</strong>${cw.officialId?'<small><span class="official-draft-tag">ÉDITION OFFICIELLE</span></small>':''}</div></div><div class="custom-item-actions"><button type="button" class="equipment-action" onclick="editCustomWarband('${cw.id}')">✎</button><button type="button" class="equipment-action remove" onclick="deleteCustomWarband('${cw.id}')">🗑</button></div></article>`}
function customWarbandEditor(cw){
 const tabs=[['fighters','⚔ Combattants'],['equipment','◇ Équipement'],['special','✚ Règles spéciales'],['traits','◆ Traits']];
 let body='';
 if(customWarbandSection==='fighters'){
   const sel=new Set(customWarbandFighterRefs(cw));
   const allItems=customWarbandFighterEntries();
   const items=allItems.filter(e=>e.custom||sel.has(e.key)||!customWarbandHideOfficial);
   const hiddenCount=allItems.length-items.length;
   const groups={};
   items.forEach(e=>(groups[e.factionName]||(groups[e.factionName]=[])).push(e));
   const hideToggle=`<label class="custom-hide-official-toggle"><input type="checkbox" ${customWarbandHideOfficial?'checked':''} onchange="toggleCustomWarbandHideOfficial(this.checked)"> Masquer les combattants des warbands déjà existantes${hiddenCount?` <small>(${hiddenCount} masqué${hiddenCount>1?'s':''})</small>`:''}</label>`;
   body=allItems.length?`<div class="custom-choice-toolbar"><input class="search" placeholder="Rechercher un combattant…" oninput="filterCustomWarbandChoices(this,'.cw-fighter-entry')"><span>${items.length} profils disponibles</span></div>${hideToggle}${items.length?`<div class="custom-choice-list">${Object.entries(groups).map(([group,rows])=>`<details class="custom-collapse" open><summary><span>${esc(group)}</span><small>${rows.length}</small></summary><div class="custom-choice-list">${rows.map(e=>{const w=e.warrior;return `<label class="custom-check cw-fighter-entry" data-search="${esc((w.name+' '+group+' '+(w.type||'')).toLowerCase())}"><input class="cwFighter" type="checkbox" value="${esc(e.key)}" ${sel.has(e.key)?'checked':''}><span><b>${esc(w.name)}</b><small>${esc(w.type||'Henchman')} · ${Number(w.cost||0)} GC${e.custom?' · CUSTOM':''}</small></span></label>`}).join('')}</div></details>`).join('')}</div>`:'<div class="empty compact">Tout est masqué — décoche la case ci-dessus pour voir les combattants des warbands existantes.</div>'}`:'<div class="empty compact">Aucun combattant disponible.</div>'
 } else if(customWarbandSection==='equipment'){
   const sel=new Set(customWarbandEquipmentRefs(cw));
   const allItems=customWarbandEquipmentEntries();
   const items=allItems.filter(e=>e.custom||sel.has(e.key)||!customWarbandHideOfficial);
   const hiddenCount=allItems.length-items.length;
   const groups={};
   items.forEach(e=>{const g=e.equipment.category||e.equipment.subcategory||'Équipement';(groups[g]||(groups[g]=[])).push(e)});
   const hideToggle=`<label class="custom-hide-official-toggle"><input type="checkbox" ${customWarbandHideOfficial?'checked':''} onchange="toggleCustomWarbandHideOfficial(this.checked)"> Masquer l'équipement des warbands déjà existantes${hiddenCount?` <small>(${hiddenCount} masqué${hiddenCount>1?'s':''})</small>`:''}</label>`;
   body=allItems.length?`<div class="custom-choice-toolbar"><input class="search" placeholder="Rechercher un équipement…" oninput="filterCustomWarbandChoices(this,'.cw-equipment-entry')"><span>${items.length} équipements disponibles</span></div>${hideToggle}${items.length?`<div class="custom-choice-list">${Object.entries(groups).map(([group,rows])=>`<details class="custom-collapse" open><summary><span>${esc(group)}</span><small>${rows.length}</small></summary><div class="custom-choice-list">${rows.map(e=>{const w=e.equipment;return `<label class="custom-check cw-equipment-entry" data-search="${esc((w.name+' '+group).toLowerCase())}"><input class="cwEquipment" type="checkbox" value="${esc(e.key)}" ${sel.has(e.key)?'checked':''}><span><b>${esc(w.name)}</b><small>${esc(group)} · ${Number(w.price??w.value??0)} GC${e.custom?' · CUSTOM':''}</small></span></label>`}).join('')}</div></details>`).join('')}</div>`:'<div class="empty compact">Tout est masqué — décoche la case ci-dessus pour voir l\'équipement des warbands existantes.</div>'}`:'<div class="empty compact">Aucun équipement disponible.</div>'
 } else {const kind=customWarbandSection,items=customContentList(kind),key=kind==='special'?'specialRuleIds':'traitIds',cls=kind==='special'?'cwSpecialRule':'cwTrait',sel=cw[key]||[];
   const bandWideNotice=`<p class="custom-field-help">Coché ici, ${kind==='special'?'une règle spéciale':'un trait'} s'applique automatiquement à <b>tous les combattants</b> de cette warband (pas à un seul) : les modificateurs de stat et compétences accordées écrits dans son texte sont détectés et appliqués tout seuls sur chaque fiche.</p>`;
   body=(bandWideNotice+(items.length?`<div class="custom-choice-list">${items.map(w=>`<label class="custom-check"><input class="${cls}" type="checkbox" value="${esc(w.customContentId)}" ${sel.includes(w.customContentId)?'checked':''}><span><b>${esc(w.name)}</b><small>${esc((w.text||'').slice(0,140))}</small></span></label>`).join('')}</div>`:`<div class="empty compact">Aucun contenu custom créé.</div>`))}
 const officialNotice=cw.officialId?`<div class="official-draft-notice"><span class="official-draft-tag">ÉDITION OFFICIELLE</span><p>Cette bande est la copie d'édition, réservée aux admins, d'une warband officielle publiée. Modifie ses combattants/équipements/règles avec les mêmes outils que pour une warband custom (onglet Custom → Profils / Équipements), coche-les ici comme d'habitude, puis clique <b>Publier les modifications</b> pour les pousser sur le serveur, visibles par tous les comptes.</p></div>`:'';
 return `<section class="card custom-warband-editor">${officialNotice}${customWarbandMetaEditor(cw)}<div class="custom-builder-intro"><div><div class="eyebrow">WARBAND CUSTOM</div><h3>Configuration</h3><p>Associe à cette Warband les combattants et équipements disponibles dans l'ensemble du jeu, ainsi que tes règles et traits custom.</p></div></div><div class="custom-warband-sections">${tabs.map(([id,l])=>`<button type="button" class="${customWarbandSection===id?'active':''}" onclick="setCustomWarbandSection('${id}')">${l}</button>`).join('')}</div>${body}<div class="custom-actions"><button type="button" class="button primary" onclick="saveCustomWarbandConfiguration()">Sauvegarder la configuration</button>${cw.officialId?`<button type="button" class="button primary" onclick="publishOfficialWarbandChanges('${cw.id}')">⬆ Publier les modifications</button>`:''}</div></section>`;
}
// Post-creation name/description/icon editor — the initial create form
// (customWarbandCreateForm) only runs once, at creation, so this is the only
// place those fields can be changed afterward. The icon shown here is the
// same one rendered on the warband's tile in the "Create Warband" screen.
function customWarbandMetaEditor(cw){
 const icon=cw.icon||'';
 return `<div class="custom-warband-meta-edit"><div class="custom-warband-icon-row"><span class="gang-icon custom-warband-tile-icon">${imageMarkup(icon,'custom-warband',esc(cw.name),cw.iconFocus)}</span><div class="custom-warband-icon-actions"><button type="button" class="button secondary" onclick="pickImage('custom-warband','${cw.id}')">${icon?"Changer l'icône":'Ajouter une icône'}</button>${icon?`<button type="button" class="button secondary" onclick="removeImage('custom-warband','${cw.id}')">Retirer</button>`:''}</div></div><label class="custom-field"><span>Nom</span><input id="cwMetaName" value="${esc(cw.name)}"></label><label class="custom-field"><span>Description (facultatif)</span>${customTextToolbarMarkup('cwMetaDescription')}<textarea id="cwMetaDescription" class="wide-textarea" rows="3" placeholder="Description de la bande…">${esc(cw.description||'')}</textarea></label><div class="custom-actions"><button type="button" class="button secondary" onclick="saveCustomWarbandInfo('${cw.id}')">Sauvegarder le nom / la description</button></div></div>`;
}
function saveCustomWarbandInfo(id){
 const cw=customWarbandById(id);if(!cw)return;
 const name=($('#cwMetaName')?.value||'').trim();
 if(!name){toast('Donne un nom à la Warband');return}
 cw.name=name;
 cw.description=($('#cwMetaDescription')?.value||'').trim();
 save(true);render('custom');toast('Informations sauvegardées');
}
function filterCustomWarbandChoices(input,selector){const q=(input.value||'').trim().toLowerCase();document.querySelectorAll(selector).forEach(el=>{el.style.display=!q||(el.dataset.search||'').includes(q)?'':'none'})}
function customWarbandCreateForm(){return `<section class="card custom-warband-create-form"><div class="eyebrow">NOUVELLE WARBAND</div><h3>Créer une Warband custom</h3><label class="custom-field"><span>Nom</span><input id="cwName" placeholder="Nom de la Warband"></label><label class="custom-field"><span>Description (facultatif)</span>${customTextToolbarMarkup('cwDescription')}<textarea id="cwDescription" class="wide-textarea" rows="4" placeholder="Description de la bande…"></textarea></label><div class="custom-actions"><button type="button" class="button secondary" onclick="customWarbandCreating=false;render('custom')">Annuler</button><button type="button" class="button primary" onclick="saveCustomWarbandMeta()">Sauvegarder</button></div></section>`}
function customWarbandPage(){const list=customWarbandList();if(customWarbandCreating)return `<div class="custom-page"><div class="page-intro"><div><div class="eyebrow">FORGE / CUSTOM CONTENT</div><h2>Warbands personnalisées</h2><p>Crée d’abord la Warband, puis clique sur Modifier pour ouvrir sa configuration.</p></div></div>${customWarbandCreateForm()}</div>`;if(customWarbandEditId){const cw=customWarbandById(customWarbandEditId);if(cw)return `<div class="custom-page"><div class="page-intro"><div><div class="eyebrow">FORGE / CUSTOM CONTENT / WARBAND</div><h2>${esc(cw.name)}</h2><p>${cw.description?customTextMarkup(cw.description):esc('Warband personnalisée')}</p></div><button type="button" class="button secondary" onclick="customWarbandEditId=null;render('custom')">← Bibliothèque</button></div>${customWarbandEditor(cw)}</div>`}return `<div class="custom-page"><div class="page-intro"><div><div class="eyebrow">FORGE / CUSTOM CONTENT</div><h2>Warbands personnalisées</h2><p>Crée et configure tes propres Warbands sans toucher au contenu officiel.</p></div><button type="button" class="button primary" onclick="newCustomWarband()">＋ Nouvelle Warband</button></div><div class="custom-workspace"><section class="card custom-editor"><div class="custom-library-head"><div><div class="eyebrow">BIBLIOTHÈQUE</div><h3>Warbands custom</h3></div><span>${list.length}</span></div><div class="custom-item-list">${list.length?list.map(customWarbandSummaryRow).join(''):'<div class="empty large"><strong>Aucune Warband custom.</strong><span>Crée la première avec le bouton ci-dessus.</span></div>'}</div></section></div></div>`}

// Boot sequence: run only after every top-level `let`/`const`/function
// declaration in this file has been evaluated. Calling this earlier (it used
// to sit mid-file) could invoke render functions — e.g. custom() — that
// reference variables declared further down (customContentTab, customTab,
// customFighterEditId, ...) while they were still in their temporal dead
// zone, throwing a ReferenceError that aborted the rest of this script's
// top-level execution for the whole session (breaking the Custom tab and
// skipping the official-warband merge below).
refreshAdminNavVisibility();renderCurrentRoute();showPasswordReset();bootstrapAccountSession();loadOfficialWarbands().then(()=>renderCurrentRoute());
