// Smoke tests for the key player/admin flows, run in a real browser.
// Usage:  python3 -m http.server 8765   (from this folder)  then
//         node tests/smoke.mjs [baseUrl]
// Needs the `playwright` package (npm i --no-save playwright) or
// PLAYWRIGHT_MODULE pointing at an installed copy. Exits 1 on any failure.
const base=(process.argv[2]||process.env.SMOKE_BASE_URL||'http://localhost:8765').replace(/\/$/,'');
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');const chromium=pw.chromium||pw.default?.chromium;
const results=[];let failed=0;
const browser=await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM?{executablePath:process.env.PLAYWRIGHT_CHROMIUM}:{});

async function session(viewport){
  // No service worker: on a first visit it takes control and reloads the page
  // (index.html, controllerchange), which raced the first step of a test.
  const ctx=await browser.newContext({serviceWorkers:'block',...(viewport==='mobile'?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1300,height:900}})});
  const page=await ctx.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR|HTTP_404|API_NOT_CONFIGURED|unavailable/i.test(m.text()))errors.push('console: '+m.text())});
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof D!=='undefined'&&Array.isArray(D.factions)&&D.factions.length>0&&typeof render==='function',null,{timeout:20000});
  // the rulebook text loads just after the first screen (V-RULESLAZY)
  await page.evaluate(()=>typeof ensureRulesBook==='function'?ensureRulesBook():null).catch(()=>{});
  await page.waitForTimeout(800);
  return {ctx,page,errors};
}
// SHARD=k/n runs every n-th test starting at k (see tests/run-parallel.mjs).
const SHARD=(process.env.SHARD||'').match(/^(\d+)\/(\d+)$/);let testIndex=0;
async function test(name,viewport,fn){
  {const i=testIndex++;if(SHARD&&i%Number(SHARD[2])!==Number(SHARD[1]))return;}
  const s=await session(viewport);
  try{await fn(s.page);if(s.errors.length)throw new Error('page errors: '+s.errors.slice(0,3).join(' | '));results.push(['PASS',name])}
  catch(e){failed++;results.push(['FAIL',name,String(e.message||e).slice(0,300)])}
  finally{await s.ctx.close()}
}
const expect=(cond,msg)=>{if(!cond)throw new Error(msg)};
// a fresh warband of a book faction, set as active
const seed=page=>page.evaluate(()=>{siteLanguage='en';const f=D.factions.find(x=>/reikland/i.test(x.displayName||x.name||''))||D.factions.find(x=>!x.__official);
  state.rosters=[{id:'smoke',name:'Smoke Test Band',factionId:f.id,gold:500,fighters:[]}];state.active='smoke';save(true);});

for(const vp of ['desktop','mobile']){
  await test(`[${vp}] home page renders`,vp,async page=>{
    await page.evaluate(()=>navigateApp('/'));await page.waitForTimeout(500);
    expect((await page.textContent('#content')).trim().length>50,'home is empty');
  });
  await test(`[${vp}] open a warband, recruit a fighter, open its sheet`,vp,async page=>{
    await seed(page);await page.evaluate(()=>navigateApp(warbandPath('smoke')));await page.waitForTimeout(600);
    expect(await page.isVisible('#content >> text=Smoke Test Band'),'warband page did not open');
    await page.evaluate(()=>openRecruitPanel());await page.waitForTimeout(500);
    const btn=page.locator('.recruit-panel button',{hasText:/Recruit — \d+ GC/}).first();
    expect(await btn.count(),'no recruit button in the recruit panel');
    await btn.click();await page.waitForTimeout(800);
    const n=await page.evaluate(()=>activeRoster().fighters.length);expect(n===1,`recruit did not add a fighter (${n})`);
    await page.evaluate(()=>openFighterCard(0));await page.waitForTimeout(700);
    expect(await page.isVisible('.fighter-page'),'fighter sheet did not open');
    for(const t of ['Special Rules','Weapons & Equipment'])expect(await page.isVisible(`text=${t}`),`fighter sheet misses "${t}"`);
    await page.evaluate(()=>openStatsEditor());await page.waitForTimeout(300);
    expect(await page.isVisible('#modal .stat-current-inline'),'Edit characteristics did not open');
  });
  await test(`[${vp}] warband tabs: rules, stash, post-battle, campaign`,vp,async page=>{
    await seed(page);await page.evaluate(()=>navigateApp(warbandPath('smoke')));await page.waitForTimeout(500);
    for(const tab of ['rules','reserve','postbattle','campaign']){await page.evaluate(t=>{try{setGangTab(t)}catch(e){gangTab=t;render('builder')}},tab);await page.waitForTimeout(300);
      expect((await page.textContent('#content')).length>200,`tab ${tab} is empty`)}
  });
  await test(`[${vp}] data survives a reload`,vp,async page=>{
    await seed(page);await page.waitForTimeout(300);await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof state!=='undefined'&&Array.isArray(state.rosters),null,{timeout:20000});await page.waitForTimeout(800);
    expect(await page.evaluate(()=>state.rosters.some(r=>r.id==='smoke')),'warband lost after reload');
  });
  await test(`[${vp}] site search finds rules and skips partial words`,vp,async page=>{
    await page.evaluate(()=>navigateApp('/'));await page.click('.site-search-btn');await page.fill('#siteSearchInput','backstab');await page.waitForTimeout(200);
    expect(await page.isVisible('.site-search-item >> text=Backstab'),'Backstab not found');
    const titles=await page.evaluate(()=>searchRun('hired swords').flatMap(g=>g.items.map(i=>i.title)));
    expect(!titles.includes('Sword'),'"hired swords" still lists plain Sword');
    await page.keyboard.press('Enter');await page.waitForTimeout(500);
    expect(await page.evaluate(()=>location.pathname)==='/reference','Enter did not open the Reference');
  });
  await test(`[${vp}] play mode, rules, scenarios, campaigns pages`,vp,async page=>{
    await seed(page);
    for(const path of ['/warbands/play','/rules','/rules/warbands','/rules/scenarios','/rules/campaign','/campaigns','/reference','/custom']){
      await page.evaluate(p=>navigateApp(p),path);await page.waitForTimeout(400);
      expect((await page.textContent('#content')).trim().length>30,`${path} is empty`)}
    const fid=await page.evaluate(()=>D.factions.find(f=>!f.__official)?.id);
    await page.evaluate(id=>navigateApp('/rules/warbands/'+encodeURIComponent(id)),fid);await page.waitForTimeout(500);
    expect((await page.textContent('#content')).length>200,'a warband rules page is empty');
  });
}
await test('[desktop] campaign post-battle: dice result goes to the Treasure stock',null,async page=>{
  await page.evaluate(()=>{siteLanguage='en';const f=D.factions.find(x=>!x.__official);const w=JSON.parse(JSON.stringify(f.warriors[0]));
    state.rosters=[{id:'cpb',name:'Camp Band',factionId:f.id,gold:100,wyrdstone:0,fighters:[{...w,instance:'h1'}],campaignId:'c-smoke'}];state.active='cpb';
    campaignDetailCache.set('c-smoke',{id:'c-smoke',name:'Lustria',members:[],definition:{exploration:{chart:'custom',entries:lustriaExplorationDefaults(),enabled:true}}});
    const pb=ensurePostBattleData(activeRoster());pb.survivingHeroIds=['h1'];pb.heroCount=1;pb.winner=true;postBattleDieRows();pb.dice.forEach((d,i)=>{d.value=[4,2][i]??3;d.selected=true});save(true);
    navigateApp(warbandPath('cpb'));setGangTab('postbattle')});
  await page.waitForTimeout(600);
  const btn=page.locator('[data-pb-sub="2"] .shard-result button');
  expect(await btn.count(),'no "put in stock" button in the campaign exploration block');
  await btn.click();await page.waitForTimeout(400);
  expect(await page.evaluate(()=>Number(activeRoster().wyrdstone||0))>0,'Treasure stock did not increase');
});
await test('[desktop] French: a Rules side-menu group stays in French when opened',null,async page=>{
  await page.evaluate(()=>{localStorage.setItem(SITE_LANGUAGE_KEY,'fr');siteLanguage='fr';i18nNeedsFullPass=true;navigateApp('/rules')});
  await page.waitForTimeout(800);
  const head=page.locator('#rulesNavSidebar .rn-head').first();expect(await head.count(),'no Rules side-menu group');
  await head.click();await page.waitForTimeout(600);
  const txt=await page.evaluate(()=>document.getElementById('rulesNavSidebar').innerText);
  expect(!/First Principles|Measurement|Line of Sight/.test(txt),'opened group shows English titles: '+txt.slice(0,160));
});
await test('[desktop] campaign: market penalties never touch the Band List',null,async page=>{
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>!x.__official);
    state.rosters=[{id:'out',name:'Outsider',factionId:f.id,gold:500,fighters:[],campaignId:'c-out',campaignResidence:'s1'}];state.active='out';
    campaignDetailCache.set('c-out',{id:'c-out',name:'C',members:[],definition:{settlements:[{id:'s1',name:'Closed',excluded:[rosterCampaignFactionId(state.rosters[0])]}]}});
    const r=activeRoster();const band=tradingShopItems(r,'band',null);const post=tradingShopItems(r,'post',tradingPostById(tradingData(r).postId));
    return {outsider:rosterCampaignMarket(r)?.outsider,bandRaised:band.filter(i=>i.price!==i.basePrice).length,postRaised:post.filter(i=>i.price>i.basePrice).length}});
  expect(out.outsider,'test campaign should make this warband an outsider');
  expect(out.bandRaised===0,`${out.bandRaised} Band List items got a campaign price`);
  expect(out.postRaised>0,'the general market lost its outsider penalty');
});
await test('[desktop] campaign: Band List purchase is on its way until a campaign game with the warband is recorded',null,async page=>{
  const r1=await page.evaluate(()=>{siteLanguage='en';const f=D.factions.find(x=>!x.__official);const w=JSON.parse(JSON.stringify(f.warriors[0]));
    state.rosters=[{id:'tr',name:'Transit',factionId:f.id,gold:500,fighters:[{...w,instance:'f1'}],campaignId:'c-tr'}];state.active='tr';
    campaignDetailCache.set('c-tr',{id:'c-tr',name:'C',members:[],definition:{settlements:[{id:'s1',name:'Town'}]}});
    campaignBattlesCache.set('c-tr',[{id:'old',status:'confirmed',createdAt:new Date(Date.now()-86400000).toISOString(),sides:[{rosterId:'tr',result:'win'}]}]);save(true);
    const name=tradingShopItems(activeRoster(),'band',null)[0].w.name;buyTradingItem('band',name);navigateApp(warbandPath('tr'));setGangTab('reserve');
    confirmTransferReserve(0,0);
    return {section:!!document.querySelector('.transit-section'),badge:!!document.querySelector('.gt-transit'),inTransit:reserveInTransit(activeRoster(),activeRoster().reserve[0]),stillInStash:activeRoster().reserve.length}});
  expect(r1.inTransit&&r1.section&&r1.badge&&r1.stillInStash===1,'purchase not held as on its way: '+JSON.stringify(r1));
  const r2=await page.evaluate(()=>{const bs=campaignBattlesCache.get('c-tr');bs.push({id:'other',status:'confirmed',createdAt:new Date(Date.now()+1000).toISOString(),sides:[{rosterId:'someone-else'}]});return reserveInTransit(activeRoster(),activeRoster().reserve[0])});
  expect(r2,'delivered by a campaign game that did not include the warband');
  const r3=await page.evaluate(()=>{campaignBattlesCache.get('c-tr').push({id:'next',status:'confirmed',createdAt:new Date(Date.now()+2000).toISOString(),sides:[{rosterId:'tr',result:'loss'}]});setGangTab('reserve');return {inTransit:reserveInTransit(activeRoster(),activeRoster().reserve[0]),section:!!document.querySelector('.transit-section')}});
  expect(!r3.inTransit&&!r3.section,'still on its way after a recorded campaign game with the warband');
});
await test('[desktop] weapon covering: chip variant, stacked modifiers, exclusions, live profile',null,async page=>{
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Leader'));const w=f.warriors.find(x=>x.type==='Leader');
    state.customEquipment=[{customEquipmentId:'cov-t',name:'Testmetal',type:'covering',rarity:'Rare 12',market:true,unrestricted:true,factions:[],covering:{mult:2,range:1,strength:1,ap:-1,damage:1,traits:['Strike First'],excluded:['Dagger']}}];
    state.rosters=[{id:'cv',name:'CV',factionId:f.id,gold:500,fighters:[{...JSON.parse(JSON.stringify(w)),wid:w.id,instance:'L',equipmentSelected:[]}]}];state.active='cv';
    const x=state.rosters[0].fighters[0];const pool=equipmentPool('market',x);const v=pool.find(i=>i.name==='Testmetal Sword');
    const bumps=[['strength','S+2',1],['damage','D3',1],['ap','+1',-1],['range','Melee 1',-2],['strength','S',-1],['strength','3',-4],['ap','-',2]].map(([k,val,d])=>coveringBump(k,val,d));
    const stored={name:'Testmetal Sword',coveringId:'cov-t',coveringName:'Testmetal',coveringBase:'Sword',profile:null};state.customEquipment[0].covering.range=2;
    const camp=campaignEquipmentItems({definition:{description:'[ITEMS]\nSword\nDagger\nTestmetal *\n[/ITEMS]',pages:[]}}).map(w=>w.name);
    const gro={name:'Gromtest',covering:{mult:1,flat:20}};const flat=[coveredWeapon(D.weapons.find(w=>w.name==='Axe'),gro).price,coveredWeapon(D.weapons.find(w=>w.name==='Great Axe'),gro).price];
    return {flat,camp,v:v&&{price:equipmentPrice(v,f,'market',x),p:v.profile},dagger:pool.some(i=>i.name==='Testmetal Dagger'),leak:pool.some(i=>isCovering(i)),bumps,live:liveEquipmentView(stored).profile?.range}});
  expect(out.v,'covered Sword missing from the Market List');
  expect(out.v.price===50,`covered Sword price ${out.v.price}, expected 25×2`);
  expect(out.v.p.range==='Melee 3'&&out.v.p.strength==='S+1'&&out.v.p.ap==='-1'&&out.v.p.damage==='2'&&/Strike First/.test(out.v.p.traits),`covered profile ${JSON.stringify(out.v.p)}`);
  expect(!out.dagger,'excluded Dagger still got the covering');
  expect(out.flat.join('/')==='40/75','fixed surcharge: Axe/Great Axe gave '+out.flat.join('/'));
  expect(out.camp.includes('Testmetal Sword')&&!out.camp.includes('Testmetal Dagger')&&!out.camp.includes('Testmetal Axe'),'"Testmetal *" in [ITEMS] should cover only the listed weapons it accepts: '+out.camp.join(', '));
  expect(!out.leak,'the covering itself is listed as an item');
  expect(out.bumps.join(' ')==='S+3 D3+1 - Melee -1 S-1 -1 +2','modifier stacking '+out.bumps.join(' '));
  expect(out.live==='Melee 4','a bought copy did not follow the edited covering');
});
await test('[desktop] weapon covering: Heroes only keeps it away from Henchmen',null,async page=>{
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Leader')&&x.warriors?.some(w=>w.type==='Henchman'));
    const mk=t=>{const w=f.warriors.find(a=>a.type===t);return {...JSON.parse(JSON.stringify(w)),wid:w.id,instance:t,equipmentSelected:[]}};
    state.customEquipment=[{customEquipmentId:'cov-h',name:'Testmetal',type:'covering',market:true,unrestricted:true,factions:[f.id],covering:{mult:2,range:1,heroesOnly:true,excluded:[]}}];
    const hero=mk('Leader'),hench=mk('Henchman');state.rosters=[{id:'ch',name:'CH',factionId:f.id,gold:0,fighters:[hero,hench]}];state.active='ch';
    const item={name:'Testmetal Sword',coveringId:'cov-h',coveringName:'Testmetal',coveringBase:'Sword'};
    const other=D.factions.find(x=>!x.__official&&x.id!==f.id&&x.warriors?.some(w=>w.type==='Leader'));
    state.customEquipment[0].factions=['__ALL__'];state.customEquipment[0].covering.bandFactions=[f.id];
    state.customEquipment[0].market=true;const cv=coveringList()[0];const allScope={mine:coveringBandAllowed(cv,f),other:coveringBandAllowed(cv,other),otherMarket:coveringsForList('market',other).length,otherUnres:coveringsForList('unrestricted',other).length};
    return {allScope,hero:equipmentPool('band',hero).some(w=>w.coveredVariant),hench:equipmentPool('band',hench).some(w=>w.coveredVariant),give:canEquip(hench,item).ok}});
  expect(out.hero,'the Leader lost the covered weapons');
  expect(out.allScope.mine&&!out.allScope.other&&out.allScope.otherMarket===1&&out.allScope.otherUnres===1,'a covering published for every warband opened every Band List '+JSON.stringify(out.allScope));
  expect(!out.hench,'a Henchman can still buy a Heroes-only covered weapon');
  expect(!out.give,'a Henchman can still be given a Heroes-only covered weapon');
});
await test('[desktop] warband size limit: recruit blocked, supplement inherits, Hired Swords not counted',null,async page=>{
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Henchman'&&w.max==null));
    const hw=f.warriors.find(w=>w.type==='Henchman'&&w.max==null);const mk=()=>({...JSON.parse(JSON.stringify(hw)),wid:hw.id,instance:crypto.randomUUID(),equipmentSelected:[]});
    const saved=warbandSizeLimits;warbandSizeLimits={[f.id]:2};
    state.rosters=[{id:'sz',name:'SZ',factionId:f.id,gold:5000,fighters:[mk(),mk(),{name:'Merc',type:'Hired Sword',hiredSword:true,wid:'hs',instance:'hs1'}]}];state.active='sz';
    const r=state.rosters[0];const before=r.fighters.length;addFighterCore(hw.id);const blocked=r.fighters.length===before;
    r.fighters.push(mk());const illegal=warbandLegalityIssues(r).some(i=>/3\/2/.test(i));
    const inherits=warbandSizeLimitFor({id:'sup-test',baseFactionId:f.id})===2;const note=!!warbandSizeNoteMarkup(f,false);
    warbandSizeLimits=saved;const none=warbandSizeLimitFor(f)==null||saved[f.id]>0;return {blocked,illegal,inherits,note,count:warbandSizeCount(r),none}});
  expect(out.blocked,'a third fighter was recruited past a limit of 2');
  expect(out.count===3,'Hired Swords should not count toward the size: '+out.count);
  expect(out.illegal,'a band over its size limit is not flagged as illegal');
  expect(out.inherits,'a supplement without its own limit should use its base warband limit');
  expect(out.note,'the Faction Rules note for the size limit is missing');
});
await test('[desktop] weapon-scoped bonus: Oversized Jaws improves the Bite Attack, not the fighter',null,async page=>{
  const out=await page.evaluate(()=>{
    const bite={name:'Bite Attack',customEquipmentId:'t-bite',category:'Armes de corps à corps',subcategory:'Armes de corps à corps',price:0,traits:['Strike Last'],profile:{range:'Melee 1',strength:'S',ap:'-',damage:'1',traits:'Strike Last'}};
    const jaws={name:'Oversized Jaws',customEquipmentId:'t-jaws',category:'Équipements divers',subcategory:'Équipements divers',price:20,profile:null,rulesText:'The Hero may make his bite attack with +1 Strength'};
    const brute={name:'Brute Helm',customEquipmentId:'t-helm',category:'Équipements divers',subcategory:'Équipements divers',price:20,profile:null,rulesText:'The wearer gains +1 Strength.'};
    state.customEquipment=[bite,jaws,brute];
    const x={name:'Saurus Totem Warrior',type:'Champion',profile:[4,4,0,4,4,2,2,2,8,8,8,6],equipmentSelected:[{...bite},{...jaws}]};
    syncCustomEquipmentEffects(x);const s1=x.profile[3];const view=fighterWeaponView(x,x.equipmentSelected[0]).profile.strength;
    x.equipmentSelected.push({...brute});syncCustomEquipmentEffects(x);const s2=x.profile[3];
    return {s1,view,s2}});
  expect(out.s1===4,'Oversized Jaws changed the fighter\'s Strength: '+out.s1);
  expect(out.view==='S+1','the Bite Attack should show S+1, got '+out.view);
  expect(out.s2===5,'a plain "+1 Strength" item should still raise the profile: '+out.s2);
});
await test('[desktop] scenario editor: rule toolbar writes into the focused field, tables render',null,async page=>{
  await page.evaluate(()=>ensureAdminCode());
  const out=await page.evaluate(()=>{
    adminScenarioEditId=null;adminScenarioEditData=blankScenarioDraft();
    document.querySelector('#content').innerHTML=scenarioEditorPanel();
    const ta=document.getElementById('seSpecialRules');ta.focus();ta.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));
    ta.value='Intro.';ta.setSelectionRange(6,6);insertRuleEditToken('table');
    const z=document.getElementById('seZones');z.focus();z.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));
    return {bar:!!document.querySelector('.scn-format-bar .rule-edit-toolbar'),inserted:ta.value.includes('[TABLE]'),zoneTarget:ruleEditTargetId,table:/<table/i.test(scenarioText(ta.value)),plain:scenarioText('One line.\nTwo <b>')}});
  expect(out.bar,'the scenario editor has no formatting toolbar');
  expect(out.inserted,'the table was not inserted into the focused field');
  expect(out.zoneTarget===null,'a list field (zones) should not take formatting');
  expect(out.table,'a [TABLE] block in a scenario text does not render as a table');
  expect(out.plain==='One line.\nTwo &lt;b&gt;','a plain scenario text should stay plain and escaped: '+out.plain);
});
await test('[desktop] campaign market: sell from the Stash (present, new at +50 %, exclusive)',null,async page=>{
  const out=await page.evaluate(async()=>{
    const f=D.factions.find(x=>!x.__official&&x.warriors?.length);const sword=D.weapons.find(w=>w.name==='Sword');const axe=D.weapons.find(w=>w.name==='Axe');
    const cid='c-sell';campaignMarketCache.set(cid,{stock:{sword:2},initial:{sword:2},premium:{},trades:[]});
    state.rosters=[{id:'rs',name:'RS',factionId:f.id,campaignId:cid,gold:0,fighters:[],reserve:[{name:'Sword',price:sword.price,value:sword.price},{name:'Axe',price:axe.price,value:axe.price},{name:'Elf Blade',price:40,value:40,availability:'Rare E 9'}]}];state.active='rs';
    const r=state.rosters[0];const q=r.reserve.map(e=>stashSaleQuote(r,e));
    window.MordheimundaAPI.campaignMarketSell=async(id,p)=>{const m=campaignMarketCache.get(id);const present=p.key in m.stock;const stock={...m.stock};const premium={...m.premium};if(present)stock[p.key]++;else{stock[p.key]=1;premium[p.key]=1.5}return {ok:true,present,premiumBefore:1,stock,premium}};
    sellReserveEquipment(1);await confirmSellReserveEquipment(1,'new',q[1].gold);
    const m=campaignMarketCache.get(cid);const listed=tradingShopItems(r,'post',campaignMarketPost(r)).find(it=>it.w.name==='Axe');
    return {kinds:q.map(x=>x.kind),swordGold:q[0].gold,axeGold:q[1].gold,gold:r.gold,axeStock:m.stock.axe,axePrice:listed?.price,axeBase:axe.price,section:/Sell from your Stash|Vendre depuis le Stash/.test(tradingSellSectionMarkup(r)),exclusiveRarity:tradingRarity({availability:'Rare E 9'})}});
  expect(out.kinds.join()==='present,new,exclusive','sale kinds: '+out.kinds.join());
  expect(out.axeGold===Math.floor(out.axeBase*0.75)&&out.gold===out.axeGold,'a new item should sell for 75 % of its base: '+JSON.stringify(out));
  expect(out.axeStock===1&&out.axePrice===Math.round(out.axeBase*1.5),'the sold item should be in the market at base +50 %: '+JSON.stringify(out));
  expect(out.section,'the Trading Post has no Sell section');
  expect(out.exclusiveRarity===9,'Rare E 9 should still read as rarity 9');
});
await test('[desktop] stash: an Unrestricted custom item can be given to a hero',null,async page=>{
  const out=await page.evaluate(()=>{
    const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Leader'));const other=D.factions.find(x=>!x.__official&&x.id!==f.id);
    state.customEquipment=[{customEquipmentId:'t-boots',name:'Elven Boots',type:'equipment',category:'Équipements divers',price:40,factions:[],unrestricted:true},{customEquipmentId:'t-other',name:'Other Relic',type:'equipment',category:'Équipements divers',price:40,factions:[other.id],unrestricted:false,market:false}];
    const L=f.warriors.find(w=>w.type==='Leader');const hero={...JSON.parse(JSON.stringify(L)),wid:L.id,instance:'h1',equipmentSelected:[]};
    state.rosters=[{id:'sa',name:'SA',factionId:f.id,gold:0,fighters:[hero],reserve:[{name:'Elven Boots',customEquipmentId:'t-boots',category:'Équipements divers',price:40,factions:[]},{name:'Other Relic',customEquipmentId:'t-other',category:'Équipements divers',price:40,factions:[other.id]}]}];state.active='sa';
    const r=state.rosters[0];const ok=[stashItemAccessOk(r,r.reserve[0]),stashItemAccessOk(r,r.reserve[1])];
    confirmTransferReserve(0,0);const x=(activeRoster()||r).fighters[0];const names=[...(x.equipmentSelected||[]),...(x.equipmentStash||[])].map(e=>e.name);return {ok,given:names.includes('Elven Boots')||!(activeRoster()||r).reserve.some(e=>e.name==='Elven Boots')}});
  expect(out.ok[0],'an Unrestricted item in the Stash is refused to every fighter');
  expect(!out.ok[1],'an item linked to another warband only should stay refused');
  expect(out.given,'the Elven Boots were not given to the Leader');
});
await test('[desktop] stash: an Unrestricted item is refused to a plain Henchman, allowed to a Veteran',null,async page=>{
  const out=await page.evaluate(()=>{
    const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Henchman'));
    state.customEquipment=[{customEquipmentId:'t-boots2',name:'Elven Boots',type:'equipment',category:'Équipements divers',price:40,factions:[],unrestricted:true}];
    const H=f.warriors.find(w=>w.type==='Henchman');const mk=(id,vet)=>({...JSON.parse(JSON.stringify(H)),wid:H.id,instance:id,equipmentSelected:[],...(vet?{veteran:true,promotedVeteran:true}:{})});
    state.rosters=[{id:'hv',name:'HV',factionId:f.id,gold:0,fighters:[mk('hn',false),mk('hv',true)],reserve:[{name:'Elven Boots',customEquipmentId:'t-boots2',category:'Équipements divers',price:40,factions:[]}]}];state.active='hv';
    const r=state.rosters[0],e=r.reserve[0];const ok=x=>henchmanBandListAllows(x,e)&&stashItemAccessOk(r,e);
    return {plain:ok(r.fighters[0]),vet:ok(r.fighters[1]),roles:[advancementRole(r.fighters[0]),advancementRole(r.fighters[1])]}});
  expect(!out.plain,'a plain Henchman may not take an Unrestricted item: '+JSON.stringify(out));
  expect(out.vet,'a Veteran should be able to take it: '+JSON.stringify(out));
});
await test('[desktop] weapon category bonus: "melee weapons +1 Strength and -1 AP" boosts the weapons, not the fighter',null,async page=>{
  const out=await page.evaluate(()=>{
    const sword=D.weapons.find(w=>w.name==='Sword'),bow=D.weapons.find(w=>w.name==='Bow');
    state.customEquipment=[{customEquipmentId:'t-gl',name:'Brute Gloves',type:'equipment',category:'Équipements divers',price:10,rulesText:'Les armes de mêlée de ce combattant ont +1 Force et -1 AP.'}];
    const x={name:'X',type:'Champion',profile:[4,4,3,3,3,1,3,1,7,7,7,7],equipmentSelected:[{...sword},{...bow},{name:'Brute Gloves',customEquipmentId:'t-gl',category:'Équipements divers',price:10}]};
    syncCustomEquipmentEffects(x);
    return {S:x.profile[3],sword:fighterWeaponView(x,x.equipmentSelected[0]).profile,bow:fighterWeaponView(x,x.equipmentSelected[1]).profile,
      ranged:weaponModsInText('Ranged weapons have +6" range.',null)[0]?.range,cond:weaponModsInText('Ses armes de tir gagnent +1 Force quand il ne bouge pas.',null).length}});
  expect(out.S===3,'the fighter\'s Strength changed: '+out.S);
  expect(out.sword.strength==='S+1'&&out.sword.ap==='-1','the melee weapon should be S+1 / AP -1: '+JSON.stringify(out.sword));
  expect(out.bow.ap==='-'&&!/\+/.test(String(out.bow.strength)),'the bow should not change: '+JSON.stringify(out.bow));
  expect(out.ranged===6,'ranged range bonus not read: '+out.ranged);
  expect(out.cond===0,'a conditional weapon bonus should not apply for good');
});
await test('[desktop] Dramatis Personae: hired like a Hired Sword, static, own rules on its card and sheet',null,async page=>{
  const out=await page.evaluate(()=>{
    const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Leader'));
    state.customFighters=[{customFighterId:'dp-1',name:'Aenur, Sword of Twilight',type:'Hired Sword',hiredSword:true,dramatis:true,factionId:'',cost:80,upkeep:35,max:1,profile:[5,7,6,4,3,2,8,3,9,8,8,8],race:'Elves',ruleNames:['Race (Elves)'],rules:'Race (Elves)',skillAccess:{},magicAccess:{},defaultSkills:[],defaultEquipment:['Sword'],equipmentAccess:[],hsChoices:[],hsFactions:[],hsExcluded:[],dpRules:[{name:'Wanderer',text:'Never takes Leadership tests.'}]}];
    state.rosters=[{id:'dp',name:'DP',factionId:f.id,gold:500,fighters:[]}];state.active='dp';
    const listed=hiredSwordsFor(f,state.rosters[0]).some(w=>w.customFighterId==='dp-1');
    hireHiredSword('dp-1');const r=activeRoster();const x=r.fighters.find(q=>q.customFighterId==='dp-1'||normName(q.sourceName||q.name)===normName('Aenur, Sword of Twilight'));
    if(x){x.xp=7}const x2=activeRoster().fighters.find(q=>q===x||q.instance===x?.instance);
    const card=x2?ownedFighterCard(x2,0,f):'';const rulesPage=hiredSwordsRulesPageMarkup(true);
    return {listed,hired:!!x,dramatis:!!x2?.dramatis,xp:x2?.xp,canXp:fighterCanEarnXp(x2),card:/Wanderer/.test(card),catalogue:!!referenceFind('special','Wanderer'),rulesPage:/Wanderer/.test(rulesPage)&&/class="hs-entry dp"/.test(rulesPage)&&/role-badge[^>]*>Dramatis Personae</.test(rulesPage),progress:/Dramatis Personae/.test(progressionStatsMarkup(x2))}});
  expect(out.listed&&out.hired,'the Dramatis Personae could not be hired: '+JSON.stringify(out));
  expect(out.dramatis&&out.xp===0&&!out.canXp,'a Dramatis Personae must stay at 0 XP: '+JSON.stringify(out));
  expect(out.card&&out.rulesPage&&out.progress,'its own rules / static notice are missing: '+JSON.stringify(out));
  expect(!out.catalogue,'its own rules must not enter the rules catalogue');
});
await test('[desktop] Dramatis Personae for one game: price from gap and warband, gold or points, unique per game',null,async page=>{
  const out=await page.evaluate(()=>{
    const fs=D.factions.filter(x=>!x.__official&&x.warriors?.some(w=>w.type==='Leader'));const fa=fs[0],fb=fs[1];
    state.customFighters=[{customFighterId:'dp-g',name:'Grimgor the Passing',type:'Hired Sword',hiredSword:true,dramatis:true,dpMode:'game',dpGame:{base:100,step:50,perStep:10,factions:[{id:fa.id,mod:-20,banned:false}]},cost:0,upkeep:0,max:1,profile:[4,5,4,4,4,2,4,2,8,8,8,8],ruleNames:[],skillAccess:{},magicAccess:{},defaultEquipment:['Sword'],hsChoices:[],hsFactions:[],hsExcluded:[],dpRules:[{name:'Passing Through',text:'Leaves after the game.'}]}];
    const L=f=>{const w=f.warriors.find(q=>q.type==='Leader');return {...JSON.parse(JSON.stringify(w)),wid:w.id,instance:'L-'+f.id,equipmentSelected:[]}};
    state.rosters=[{id:'A',name:'Weak',factionId:fa.id,gold:200,fighters:[L(fa)]},{id:'B',name:'Strong',factionId:fb.id,gold:200,fighters:[L(fb)]}];state.active='A';
    state.playSession={slots:[{source:'own',rosterId:'A',rosterName:'Weak'},{source:'own',rosterId:'B',rosterName:'Strong'}],engaged:{}};const ps=state.playSession;
    const [A,B]=state.rosters;const eA=playEngEntry(ps,A),eB=playEngEntry(ps,B);eA.picks=[A.fighters[0].instance];eA.total=150;eB.picks=[B.fighters[0].instance];eB.total=300;
    const inHirePool=hiredSwordsFor(fa,A).some(w=>w.name==='Grimgor the Passing');const w=hiredSwordsFor(fb,B,'dp')[0];
    const pA=dpGamePrice(w,ps,A).price,pB=dpGamePrice(w,ps,B).price;
    playDpPick('B',w.id,'gold');const goldAfter=B.gold;const tB=playEngEntry(ps,B).ud.temps.find(t=>t.kind==='dp');
    playDpPick('A',w.id,'gold');const aTook=playEngEntry(ps,A).ud.temps.some(t=>t.kind==='dp');
    playDpDrop('B');const refunded=state.rosters.find(r=>r.id==='B').gold;
    const sum=hiredSwordsRulesPageMarkup(true);
    return {inHirePool,found:!!w,pA,pB,goldAfter,dramatis:!!tB?.fighter?.dramatis,aTook,refunded,sum:/POUR UNE PARTIE|FOR ONE GAME/.test(sum)};
  });
  expect(out.found&&!out.inHirePool,'a one-game-only DP must not be in the hire pool but must be offered for the game: '+JSON.stringify(out));
  expect(out.pB===130&&out.pA===50,'price: 100 base, ±10 per 50 pts of gap, -20 for the warband: '+JSON.stringify(out));
  expect(out.goldAfter===70&&out.dramatis,'gold payment failed: '+JSON.stringify(out));
  expect(!out.aTook,'the same DP was taken by two warbands in one game');
  expect(out.refunded===200&&out.sum,'drop must refund the gold / rules page must show the one-game price: '+JSON.stringify(out));
});
await test('[desktop] rule hover: "Ward" does not open "Warden of the Castle"',null,async page=>{
  const out=await page.evaluate(()=>{state.customSpecialRules=[{id:'w1',name:'Warden of the Castle',text:'Castle rule.'}];try{__refEntriesCache=null}catch(e){}
    const w=referenceFind('special','Warden of the Castle');const ward=referenceFind('special','Ward');const plural=referenceFind('special','Wardens of the Castle');const w5=referenceFind('special','Ward (5)'),w5p=referenceFind('special','Ward (5+)'),w4=referenceFind('special','Ward(4+)');return {w:w?.name||null,ward:ward?.name||null,plural:plural?.name||null,w5:w5?.name||null,w5p:w5p?.name||null,w4:w4?.name||null}});
  expect(out.w==='Warden of the Castle','the custom rule itself is not found: '+JSON.stringify(out));
  expect(out.ward!=='Warden of the Castle','"Ward" still opens "Warden of the Castle"');
  expect(out.ward==='Ward (X+)'&&out.w5==='Ward (X+)'&&out.w5p==='Ward (X+)'&&out.w4==='Ward (X+)','Ward (5) / (5+) / (4+) must open the Ward rule: '+JSON.stringify(out));
  expect(out.plural==='Warden of the Castle','a plural form should still find the rule: '+JSON.stringify(out));
});
await test('[desktop] recruitment options: paid Wizard option adds the rule, stats and cost',null,async page=>{
  await page.evaluate(()=>{const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Leader'));const w=f.warriors.find(q=>q.type==='Leader');
    w.recruitOptions=[{id:'wiz',name:'Wizard',cost:25,rules:['Wizard'],skills:['Dodge'],stats:{1:1},magic:[]},{id:'tough',name:'Tough',cost:10,rules:[],stats:{4:1},magic:[],gear:['Sword']}];
    state.rosters=[{id:'ro',name:'RO',factionId:f.id,gold:1000,fighters:[]}];state.active='ro';window.__ro={wid:w.id,ws:Number(effectiveFighterProfile(w,f)[1])};navigateApp(warbandPath('ro'));addFighter(w.id)});
  await page.waitForSelector('.roPick');await page.check('.roPick[value="wiz"]');await page.click('#roGo');await page.waitForTimeout(300);
  const out=await page.evaluate(()=>{const r=activeRoster(),f=faction(r);const x=r.fighters.find(q=>q.wid===window.__ro.wid);if(!x)return {found:false};
    return {found:true,opts:(x.recruitPicks||[]).map(o=>o.name),rules:fighterRuleNames(x,f).includes('Wizard'),skill:(activeRoster().fighters.find(q=>q.wid===window.__ro.wid).skills||[]).includes('Dodge'),ws:Number(x.profile[1])-window.__ro.ws,spent:1000-r.gold,value:fighterValue(x,f),base:liveFighterCost(x,f),card:/OPTIONS DE RECRUTEMENT|RECRUITMENT OPTIONS/.test(ownedFighterCard(x,0,f))}});
  expect(out.found&&out.opts.join()==='Wizard','the option was not recorded: '+JSON.stringify(out));
  expect(out.skill,'the option skill was not given: '+JSON.stringify(out));
  expect(out.rules&&out.ws===1,'the Wizard rule / +1 WS were not applied: '+JSON.stringify(out));
  expect(out.value-out.base>=25&&out.spent>=25&&out.card,'the option cost is missing from gold / value / card: '+JSON.stringify(out));
});
await test('[desktop] recruitment options can be changed later from the fighter sheet (paid / refunded)',null,async page=>{
  await page.evaluate(()=>{const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Leader'));const w=f.warriors.find(q=>q.type==='Leader');
    w.recruitOptions=[{id:'wiz',name:'Wizard',cost:25,rules:['Wizard'],skills:['Dodge'],stats:{1:1},magic:[]},{id:'tough',name:'Tough',cost:10,rules:[],stats:{4:1},magic:[],gear:['Sword']}];
    state.rosters=[{id:'ro2',name:'RO2',factionId:f.id,gold:1000,fighters:[]}];state.active='ro2';window.__ro2={wid:w.id,base:effectiveFighterProfile(w,f).map(Number)};navigateApp(warbandPath('ro2'));addFighter(w.id)});
  await page.waitForSelector('.roPick');await page.check('.roPick[value="wiz"]');await page.click('#roGo');await page.waitForTimeout(300);
  const before=await page.evaluate(()=>{const r=activeRoster();editingIndex=r.fighters.findIndex(q=>q.wid===window.__ro2.wid);openFighterOptionsModal();return r.gold});
  await page.uncheck('.roHave[value="wiz"]');await page.check('.roHave[value="tough"]');await page.click('#roApply');await page.waitForTimeout(300);
  const out=await page.evaluate(b=>{const r=activeRoster(),f=faction(r);const x=r.fighters.find(q=>q.wid===window.__ro2.wid);const gear=[...(x.equipmentSelected||[]),...(x.equipmentStash||[])].filter(e=>e.roOpt==='tough').length;
    return {picks:(x.recruitPicks||[]).map(p=>p.id),wizard:fighterRuleNames(x,f).includes('Wizard'),dodge:(x.skills||[]).includes('Dodge'),ws:Number(x.profile[1])-window.__ro2.base[1],t:Number(x.profile[4])-window.__ro2.base[4],goldDelta:r.gold-b,gear}},before);
  expect(out.picks.join()==='tough'&&!out.wizard&&!out.dodge&&out.ws===0,'removing Wizard did not undo it: '+JSON.stringify(out));
  expect(out.t===1&&out.gear===1,'adding Tough did not apply its stat / gear: '+JSON.stringify(out));
  expect(out.goldDelta===15,'expected +25 refund -10 cost = +15 gold: '+JSON.stringify(out));
});
await test('[desktop] mount rule "+1 armour save for the rider" improves the rider save',null,async page=>{
  const out=await page.evaluate(()=>{state.customSpecialRules=[{id:'bs1',name:'Barded Steed',text:'The rider gains +1 armour save.'}];try{__refEntriesCache=null}catch(e){}
    state.customCreatures=[{customCreatureId:'m1',kind:'mount',name:'Test Steed',cost:40,profile:[8,3,0,3,3,1,3,1,5,5,5,5],sv:'',ruleNames:['Barded Steed'],rules:'Barded Steed',skills:[],factions:[],market:true}];
    const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Leader'));const L=f.warriors.find(w=>w.type==='Leader');
    const mk=eq=>({...JSON.parse(JSON.stringify(L)),wid:L.id,instance:'r'+eq.length,equipmentSelected:eq});
    const la=D.weapons.find(w=>w.name==='Light armour');const steed=mountCreatureEquipmentList().find(m=>m.name==='Test Steed');
    state.rosters=[{id:'ms',name:'MS',factionId:f.id,gold:0,fighters:[]}];state.active='ms';
    return {without:armorSaveInfo(mk([{...la}])).parts,with:armorSaveInfo(mk([{...la},{...steed}])).parts,found:!!steed}});
  expect(out.found,'the mount could not be built');
  expect(out.without[0]===6&&out.with[0]===5,'the mount rule did not improve the rider save (6+ -> 5+): '+JSON.stringify(out));
});
await test('[desktop] weapon slots: armour and mounts never take a weapon slot',null,async page=>{
  const out=await page.evaluate(()=>{const gs=D.weapons.find(w=>w.name==='Great Sword'),sw=D.weapons.find(w=>w.name==='Sword');
    const armour={name:'Spiked plate',category:'Armure',profile:{range:'Melee',strength:'S',ap:'-',damage:'1'}};const mount={name:'Steed',category:'Montures',mountCreatureId:'m9',profile:null,creatureProfile:[8,3,0,3,3,1,3,1,5,5,5,5]};
    const x={name:'Recruit',type:'Raw Recruit',equipmentSelected:[{...gs},armour,mount]};const sh=D.weapons.find(w=>w.name==='Shield');const y={name:'Recruit',type:'Raw Recruit',equipmentSelected:[{...D.weapons.find(w=>w.name==='Halberd'),weaponSlotCost:2},{...sh,weaponSlotCost:1},mount]};return {slots:currentWeaponSlots(x),ok:canEquip(x,sw).ok,halberdShield:currentWeaponSlots(y)}});
  expect(out.slots===2&&out.ok,'armour / mount counted as weapon slots: '+JSON.stringify(out));
  expect(out.halberdShield===2,'Halberd + Shield + mount must use 2 slots (the shield takes none): '+JSON.stringify(out));
});
await test('[desktop] weapon slots follow the current weapon definition, not the one stored at purchase',null,async page=>{
  const out=await page.evaluate(()=>{const h=D.weapons.find(w=>w.name==='Halberd');const old=JSON.parse(JSON.stringify(h.profile));const item={...JSON.parse(JSON.stringify(h)),stashId:'s1',weaponSlotCost:2};
    const before=weaponSlots(item);h.profile={...h.profile,traits:'Hack, Knock back'};const after=weaponSlots(item);h.profile=old;return {before,after}});
  expect(out.before===2&&out.after===1,'dropping Two Handed from the Halberd must free a slot on owned copies: '+JSON.stringify(out));
});
await test('[desktop] campaign overview lists the artifacts found, between Events and Favoured scenario',null,async page=>{
  const out=await page.evaluate(()=>{const c={id:'ca1',name:'Lustria test',definition:{events:[],artifacts:[{name:'Sun Disc',table:'minor',roll:'4',rules:'Glows.'}]},members:[{rosterId:'r1',username:'Alice',rosterName:'Sun Hunters',stats:{artifactsFound:[{name:'Sun Disc',at:Date.UTC(2026,9,20)}]}},{rosterId:'r2',username:'Bob',rosterName:'Old Guard',stats:{artifacts:['Crown of Thorns']}}]};
    const h=hubOverviewMarkup(c);const iE=h.indexOf('hub-events'),iA=h.indexOf('hub-artifacts'),iF=h.search(/Favoured scenario|Scénario favori/);
    return {order:iE>=0&&iA>iE&&iF>iA,alice:/Alice/.test(h)&&/Sun Disc/.test(h)&&/2026-10-20/.test(h),bob:/Bob/.test(h)&&/Crown of Thorns/.test(h)}});
  expect(out.order,'the artifacts panel is not between Events and Favoured scenario: '+JSON.stringify(out));
  expect(out.alice&&out.bob,'found artifacts are missing from the overview: '+JSON.stringify(out));
});
await test('[desktop] new Leaders start with 20 XP and Champions with 9 XP',null,async page=>{
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Leader')&&x.warriors.some(w=>w.type==='Champion')&&x.warriors.some(w=>w.type==='Henchman'));
    state.rosters=[{id:'sx',name:'SX',factionId:f.id,gold:2000,fighters:[]}];state.active='sx';
    const xpOf=t=>{const w=f.warriors.find(q=>q.type===t);addFighterCore(w.id);const r=activeRoster();return Number(r.fighters[r.fighters.length-1].xp)};
    return {leader:xpOf('Leader'),champion:xpOf('Champion'),henchman:xpOf('Henchman')}});
  expect(out.leader===20&&out.champion===9&&out.henchman===0,'starting XP is wrong: '+JSON.stringify(out));
});
await test('[desktop] campaign standings: scenarios played counter (e.g. 2/4)',null,async page=>{
  const out=await page.evaluate(()=>{const c={id:'cs1',name:'Scn test',definition:{events:[],scenarioTable:{two:{2:'The warband with the lower rating picks the scenario',3:'Skirmish',4:'Island Hopping',5:'Jungle Skirmish / The Fog Of War'},multi:{3:'Ambush',4:'Skirmish'}}},members:[{rosterId:'a',username:'A',rosterName:'Alpha',stats:{rating:500}},{rosterId:'b',username:'B',rosterName:'Beta',stats:{rating:400}}]};
    campaignBattlesCache.set('cs1',[{status:'confirmed',scenario:'Skirmish',sides:[{rosterId:'a',result:'win'},{rosterId:'b',result:'loss'}]},{status:'confirmed',scenario:'The Fog Of War',sides:[{rosterId:'a',result:'win'}]},{status:'confirmed',scenario:'Skirmish',sides:[{rosterId:'a',result:'draw'}]},{status:'pending',scenario:'Ambush',sides:[{rosterId:'a'}]}]);
    const h=hubOverviewMarkup(c);const m=[...h.matchAll(/class="hub-scn[^"]*"[^>]*>(\d+\/\d+)</g)].map(x=>x[1]);return {m,head:/Scénarios|Scenarios/.test(h)}});
  expect(out.head&&out.m.join()==='2/4,1/4','scenario counters wrong (expected Alpha 2/4, Beta 1/4): '+JSON.stringify(out));
});
await test('[desktop] Lustria maze (five 4s): the lost Hero keeps the effect until he returns or is lost',null,async page=>{
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Leader'));const L=f.warriors.find(w=>w.type==='Leader');
    campaignDetailCache.set('cm1',{id:'cm1',name:'Maze test',members:[],definition:{exploration:{entries:LUSTRIA_EXPLORATION}}});
    const hero={...JSON.parse(JSON.stringify(L)),wid:L.id,instance:'h-maze',equipmentSelected:[],status:{}};
    state.rosters=[{id:'mz',name:'MZ',factionId:f.id,campaignId:'cm1',gold:0,fighters:[hero]}];state.active='mz';
    const r=activeRoster();campaignExploreState(r).lead='h-maze';resolveCampaignExplore('5-4');
    const x=()=>activeRoster().fighters.find(q=>q.instance==='h-maze');const set=!!x().maze;const blocked=!playEngFighterOk(x());const card=/LABYRINTHE|MAZE/.test(ownedFighterCard(x(),0,f));
    editingIndex=0;mazeGamePlayed();const g1=x().maze.games;
    const rnd=Math.random;Math.random=()=>0;mazeRoll();mazeRoll();mazeRoll();Math.random=rnd;const gone=!!x().maze.gone;
    x().maze={games:1,rolls:[]};Math.random=()=>0.99;mazeRoll();Math.random=rnd;const back=!!x().maze.returned&&playEngFighterOk(x());
    return {set,blocked,card,g1,gone,back}});
  expect(out.set&&out.blocked&&out.card,'the maze state is not kept on the hero / he can still be engaged: '+JSON.stringify(out));
  expect(out.g1===1&&out.gone&&out.back,'maze progression is wrong: '+JSON.stringify(out));
});
await test('[desktop] exploration effects are applied for real (Well → misses the game, undone by clear; Gold Plaque for Lizardmen)',null,async page=>{
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Leader')&&!/possess|undead|skaven|orc/i.test(x.id));const L=f.warriors.find(w=>w.type==='Leader');
    const hero={...JSON.parse(JSON.stringify(L)),wid:L.id,instance:'h-well',equipmentSelected:[],status:{},profile:[4,4,4,3,3,1,4,1,7,7,7,7]};
    state.rosters=[{id:'wl',name:'WL',factionId:f.id,gold:0,fighters:[hero]}];state.active='wl';const r=activeRoster();const p=ensurePostBattleData(r);
    p.survivingHeroIds=['h-well'];p.dice=[{value:1,selected:true},{value:1,selected:true}];
    const rnd=Math.random;Math.random=()=>0.99;applyExplorationReward();Math.random=rnd;
    const st=()=>fighterStatus(activeRoster().fighters[0]);const after=st().recovery;clearExplorationReward();const cleared=!st().recovery;
    // Lustria Gold Plaque: 200 gc for a Lizardmen warband, no hatred
    campaignDetailCache.set('gp1',{id:'gp1',name:'GP',members:[],definition:{exploration:{entries:LUSTRIA_EXPLORATION}}});
    const lz=D.factions.find(x=>/lizard/i.test(x.displayName||x.id));let lizard=null;
    if(lz){state.rosters=[{id:'lz',name:'LZ',factionId:lz.id,campaignId:'gp1',gold:0,fighters:[]}];state.active='lz';resolveCampaignExplore('6-2');const r2=activeRoster();lizard={gold:r2.gold,hate:explorationBonusList(r2).some(b=>b.id==='lustria-lizard-hate')}}
    state.rosters=[{id:'nl',name:'NL',factionId:f.id,campaignId:'gp1',gold:0,fighters:[]}];state.active='nl';resolveCampaignExplore('6-2');const r3=activeRoster();
    return {after,cleared,lizard,other:{gold:r3.gold,hate:explorationBonusList(r3).some(b=>b.id==='lustria-lizard-hate')}}});
  expect(out.after&&out.cleared,'Well failure must set Recovery and clear must undo it: '+JSON.stringify(out));
  expect(!out.lizard||(out.lizard.gold===200&&!out.lizard.hate),'Lizardmen must earn 200 gc from the Gold Plaque: '+JSON.stringify(out));
  expect(out.other.hate&&out.other.gold>=110,'other warbands get the gold and the Lizardmen hatred: '+JSON.stringify(out));
});
await test('[desktop] exploration tasks: notebook (Academic), Training Manual, Cold One, Boulder Race, Stegadon armour, Returning a Favour',null,async page=>{
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Leader')&&!/possess|undead|skaven|orc/i.test(x.id));const L=f.warriors.find(w=>w.type==='Leader');
    const mk=(id,S)=>({...JSON.parse(JSON.stringify(L)),wid:L.id,instance:id,name:'Hero '+id,equipmentSelected:[],status:{},xp:0,profile:[5,4,4,S,3,1,4,1,7,7,7,7]});
    state.rosters=[{id:'et',name:'ET',factionId:f.id,gold:0,fighters:[mk('h1',3),mk('h2',4)]}];state.active='et';
    // five 2s = Alchemist's Laboratory → a task; applying it gives Academic Primary; clearing removes everything
    let r=activeRoster();let p=ensurePostBattleData(r);p.survivingHeroIds=['h1'];p.dice=[2,2,2,2,2].map(v=>({value:v,selected:true}));applyExplorationReward();
    r=activeRoster();const t1=(r.exploreTasks||[]).find(t=>t.kind==='access');document.body.insertAdjacentHTML('beforeend',`<select id="etSel-${t1.id}"><option value="h1" selected>h1</option></select>`);exploreTaskHero(t1.id);
    const acad=skillAccessFor(activeRoster().fighters[0]).Academic;clearExplorationReward();const acadAfter=skillAccessFor(activeRoster().fighters[0]).Academic||null;const tasksLeft=(activeRoster().exploreTasks||[]).length;
    // three 6s = Returning a Favour → bonus
    p=ensurePostBattleData(activeRoster());p.exploration={resolved:false,rewards:[],notes:[],rolls:[],history:[]};p.dice=[6,6,6].map(v=>({value:v,selected:true}));applyExplorationReward();const favour=explorationBonusList(activeRoster()).some(b=>b.id==='returning_favour');
    // Lustria: Boulder Race (auto) + Cold One task + Stegadon armour
    campaignDetailCache.set('ex1',{id:'ex1',name:'Ex',members:[],definition:{exploration:{entries:LUSTRIA_EXPLORATION}}});
    state.rosters=[{id:'lu',name:'LU',factionId:f.id,campaignId:'ex1',gold:0,fighters:[mk('l1',3),mk('l2',4)]}];state.active='lu';r=activeRoster();campaignExploreState(r).lead='l1';
    const rnd=Math.random;Math.random=()=>0;resolveCampaignExplore('5-3');Math.random=rnd;const boulderGold=activeRoster().gold;
    resolveCampaignExplore('5-5');r=activeRoster();const co=(r.exploreTasks||[]).find(t=>t.kind==='coldone');const n0=r.fighters.length;exploreTaskColdOne(co.id,'win');r=activeRoster();const coldAdded=r.fighters.length===n0+1&&r.fighters.some(x=>/Cold One/.test(x.name));const leadXp=r.fighters.find(x=>x.instance==='l1').xp;
    undoCampaignExplore('5-5');r=activeRoster();const coldUndone=r.fighters.length===n0&&r.fighters.find(x=>x.instance==='l1').xp===0;
    const steg=campaignStashItem(activeRoster(),{n:'Stegadon Bone Armour',b:'Heavy armour',statMods:[{index:0,amount:-1}],minS:4},1,'test');
    const y=activeRoster().fighters.find(x=>x.instance==='l2');const S=Number(y.profile[3]);const okS=canEquip(y,steg).ok===(S>=4);const low=canEquip({...y,profile:y.profile.map((v,i)=>i===3?3:v)},steg).ok;
    const m0=Number(y.profile[0]);y.equipmentSelected=[{...steg}];syncCustomEquipmentEffects(y);const m=Number(y.profile[0])-m0;
    return {acad,acadAfter,tasksLeft,favour,boulderGold,coldAdded,leadXp,coldUndone,okS,low,m}});
  expect(out.acad==='Primary'&&!out.acadAfter&&out.tasksLeft===0,'Alchemist notebook task / undo failed: '+JSON.stringify(out));
  expect(out.favour,'Returning a Favour bonus missing: '+JSON.stringify(out));
  expect(out.boulderGold===50,'Boulder Race success must give 50 gc: '+JSON.stringify(out));
  expect(out.coldAdded&&out.leadXp===1&&out.coldUndone,'Cold One task failed: '+JSON.stringify(out));
  expect(out.okS&&!out.low&&out.m===-1,'Stegadon armour: S4+ only and -1 Movement: '+JSON.stringify(out));
});
await test('[desktop] Ogre rules: Slow Witted costs x1.5 XP, Difficult Customers -1 Rare, Cannibals Hired Sword ban',null,async page=>{
  const out=await page.evaluate(()=>{state.customSpecialRules=[{id:'sw1',name:'Slow Witted',text:'Ogres only improve at half the rate of everyone else. They earn half the usual number of experience points (to a minimum of 1).'}];try{__refEntriesCache=null}catch(e){}
    const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Leader'));const L=f.warriors.find(w=>w.type==='Leader');const keep=f.specialRules;
    f.specialRules=[...(keep||[]),{name:'Difficult Customers',text:'Ogre Heroes suffer -3 when rolling to find Rare items that are not exclusively available to Ogres.'},{name:'Cannibals',text:'An Ogre warband may never hire any Hired Swords, except for Halflings (Scout, Thief, etc.) and the Ogre Bodyguard, or unless stated otherwise.'}];
    const ogre={...JSON.parse(JSON.stringify(L)),wid:L.id,instance:'o1',ruleNames:[...(L.ruleNames||[]),'Slow Witted'],extraRuleNames:['Slow Witted'],equipmentSelected:[],status:{}};const human={...JSON.parse(JSON.stringify(L)),wid:L.id,instance:'h1',equipmentSelected:[],status:{}};
    state.rosters=[{id:'og',name:'OG',factionId:f.id,gold:0,fighters:[ogre,human]}];state.active='og';const r=activeRoster();
    const e=ADVANCEMENT_MAIN.find(a=>a.kind!=='veteranPromote'&&Number(a.xp)>0);const slow=advancementCost(r.fighters[0],e),normal=advancementCost(r.fighters[1],e);
    const rare=bandRareSearchMod(r).mod;const hs=n=>hiredSwordAvailableFor({name:n,race:''},f,r);const ban={body:hs('Ogre Bodyguard'),half:hs('Halfling Scout'),pit:hs('Pit Fighter')};
    f.specialRules=keep;return {slow,normal,rare,ban}});
  expect(out.slow===Math.ceil(out.normal*1.5),'Slow Witted pays x1.5 (rounded up): '+JSON.stringify(out));
  expect(out.rare===-1,'Difficult Customers gives -1 to Rare searches (decided ruling): '+JSON.stringify(out));
  expect(out.ban.body&&out.ban.half&&!out.ban.pit,'Cannibals: only Halflings and the Ogre Bodyguard may be hired: '+JSON.stringify(out));
});
await test('[desktop] quest trees and quests can be limited to races',null,async page=>{
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Champion'));const C=f.warriors.find(w=>w.type==='Champion');
    state.customFighters=[{customFighterId:'cf-skink',name:'Skink Hero',type:'Champion',factionId:f.id,cost:40,race:'Skink',profile:[6,3,3,3,2,1,4,1,6,6,6,6],ruleNames:[],skillAccess:{},magicAccess:{},defaultSkills:[],defaultEquipment:[],equipmentAccess:[]}];
    const sk={...customFighterAsWarrior(state.customFighters[0]),wid:'cf-skink',customFighterId:'cf-skink',instance:'s1',sourceName:'Skink Hero',equipmentSelected:[],status:{},xp:0};
    const hu={...JSON.parse(JSON.stringify(C)),wid:C.id,instance:'c1',equipmentSelected:[],status:{},xp:0};
    state.rosters=[{id:'qr',name:'QR',factionId:f.id,gold:0,fighters:[sk,hu]}];state.active='qr';const r=activeRoster();
    questLibraryOverride={trees:[{id:'rt-skink',name:'Skink',ignoreSkills:true,scope:{races:['Skink']},skillTrees:[],quests:[{id:'q1',name:'Darts',text:'x',xp:1}]},{id:'rt-saurus',name:'Saurus',ignoreSkills:true,scope:{races:['Saurus']},skillTrees:[],quests:[{id:'q2',name:'Jaws',text:'x',xp:1}]}]};
    const ids=x=>fighterQuestInfo(x).available.map(a=>a.tree.id);const a=ids(r.fighters[0]),b=ids(r.fighters[1]);
    const base=QUEST_BASE.trees.some(t=>t.id==='skink'||t.id==='saurus');questLibraryOverride=null;
    return {skinkHas:a.includes('rt-skink'),skinkNoSaurus:!a.includes('rt-saurus'),humanNo:!b.includes('rt-skink')&&!b.includes('rt-saurus'),noBuiltIn:!base,label:questScopeLabel({races:['Skink']})}});
  expect(out.skinkHas&&out.skinkNoSaurus&&out.humanNo,'race scope is wrong: '+JSON.stringify(out));
  expect(out.noBuiltIn,'no built-in race trees should ship');
});
await test('[desktop] confirmations open in a site dialog, never a native browser box',null,async page=>{
  let native=0;page.on('dialog',d=>{native++;d.dismiss().catch(()=>{})});
  await page.evaluate(()=>{const f=D.factions.find(x=>x.warriors?.length);state.rosters=[{id:'dlg1',name:'DLG',factionId:f.id,gold:0,fighters:[]},{id:'dlg2',name:'DLG2',factionId:f.id,gold:0,fighters:[]}];state.active='dlg1';deleteRoster('dlg1')});
  await page.waitForTimeout(150);
  const shown=await page.evaluate(()=>{const m=document.querySelector('#siteDialog');return !!m&&!m.classList.contains('hidden')&&m.textContent.length>5});
  await page.click('#siteDialogOkBtn');await page.waitForTimeout(150);
  const gone=await page.evaluate(()=>!state.rosters.some(r=>r.id==='dlg1'));
  await page.evaluate(()=>{window.__pv='x';sitePrompt('Value?','7').then(v=>window.__pv=v)});await page.waitForTimeout(100);
  await page.fill('#siteDialogInput','12');await page.press('#siteDialogInput','Enter');await page.waitForTimeout(100);
  const pv=await page.evaluate(()=>window.__pv);
  await page.evaluate(()=>{window.__cv='x';siteConfirm('Delete?').then(v=>window.__cv=v)});await page.waitForTimeout(100);
  await page.evaluate(()=>document.querySelector('#siteDialog .button.secondary').click());await page.waitForTimeout(100);
  const cv=await page.evaluate(()=>window.__cv);
  expect(shown&&gone,'the delete confirmation did not show in the site dialog: '+JSON.stringify({shown,gone}));
  expect(pv==='12'&&cv===false,'site prompt/confirm returned wrong values: '+JSON.stringify({pv,cv}));
  expect(native===0,'a native browser dialog was opened');
});
await test('[desktop] site search finds fighters of supplement warbands (Blood Dragons)',null,async page=>{
  const out=await page.evaluate(()=>{const bd=D.factions.find(f=>f.packId&&/blood/i.test(f.displayName||f.id));if(!bd)return {noPack:true};
    bd.warriors=[...(bd.warriors||[]),{id:'vk-test',name:'Vampire Knight',type:'Leader',cost:210,profile:[6,7,3,4,4,2,5,3,8,8,9,8]}];
    const g=searchRun('vampire knight').find(g=>g.key==='profiles');const hit=g?.items.find(i=>i.title==='Vampire Knight');
    const wb=searchRun('blood dragons').find(g=>g.key==='warbands')?.items.some(i=>i.title===bd.displayName);
    bd.warriors=bd.warriors.filter(w=>w.id!=='vk-test');return {hit:!!hit,sub:hit?.sub||'',wb:!!wb}});
  expect(!out.noPack,'Blood Dragons supplement not loaded');
  expect(out.hit&&/Blood Dragons/.test(out.sub),'Vampire Knight not found by the search: '+JSON.stringify(out));
  expect(out.wb,'the Blood Dragons supplement itself is not found');
});
await test('[desktop] profile editor shows a filled description open, with a clear button',null,async page=>{
  await page.evaluate(()=>{state.customWarbands=[{id:'cwd',name:'Desc CW',description:'',fighterIds:['fd1'],equipmentIds:[],fighterRefs:[]}];
    state.customFighters=[{customFighterId:'fd1',name:'Chief',type:'Leader',customWarbandId:'cwd',factionId:'',cost:100,max:1,profile:[4,4,4,4,4,2,4,2,8,8,8,8],ruleNames:[],skillAccess:{},magicAccess:{},defaultSkills:[],defaultEquipment:[],equipmentAccess:[],description:'Starts with 20 XP.'}];
    editWarbandFighter('fd1','cwd')});await page.waitForTimeout(400);
  const d=page.locator('#cfDescription');await d.scrollIntoViewIfNeeded();const vis=await d.isVisible();
  await page.click('#cfDescription ~ .desc-clear');await page.evaluate(()=>saveCustomFighter());await page.waitForTimeout(200);
  const saved=await page.evaluate(()=>customFighterById('fd1')?.description);
  expect(vis,'the filled description is not visible in the editor');
  expect(saved==='','clearing the description did not save: '+JSON.stringify(saved));
});
await test('[desktop] forbidden equipment categories block buying and Stash items',null,async page=>{
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>!x.packId&&x.warriors?.some(w=>w.type==='Champion'));
    state.customFighters=[{customFighterId:'cf-ban',name:'No Guns',type:'Champion',factionId:f.id,cost:40,race:'Human',profile:[4,3,3,3,3,1,3,1,7,7,7,7],ruleNames:[],skillAccess:{},magicAccess:{},defaultSkills:[],defaultEquipment:[],equipmentAccess:[],bannedCategories:['Armes à poudre','Armes de tir'],bannedExceptions:['Throwing axe']}];
    const x={...customFighterAsWarrior(state.customFighters[0]),wid:'cf-ban',customFighterId:'cf-ban',instance:'b1',sourceName:'No Guns',equipmentSelected:[],status:{},xp:0};
    state.rosters=[{id:'rb',name:'RB',factionId:f.id,gold:500,fighters:[x],reserve:[]}];state.active='rb';const r=activeRoster();const fx=r.fighters[0];
    const gun=D.weapons.find(w=>canonEquipmentCategory(equipmentCategory(w))==='Armes à poudre');const sword=D.weapons.find(w=>/^sword$/i.test(w.name));
    const pool=['band','market','unrestricted'].flatMap(t=>equipmentPool(t,fx)).some(w=>canonEquipmentCategory(equipmentCategory(w))==='Armes à poudre');
    const axe=D.weapons.find(w=>/^throwing axe$/i.test(w.name)),bow=D.weapons.find(w=>/^bow$/i.test(w.name));const pAll=['band','market','unrestricted'].flatMap(t=>equipmentPool(t,fx)).map(w=>w.name);
    return {gun:canEquip(fx,gun).ok,sword:canEquip(fx,sword).ok,pool,axe:canEquip(fx,axe).ok,bow:canEquip(fx,bow).ok,axePool:pAll.includes(axe.name)||!pAll.length,msg:canEquip(fx,gun).msg||''}});
  expect(out.gun===false&&out.sword===true,'category ban not applied: '+JSON.stringify(out));
  expect(!out.pool,'banned category still offered for purchase');
  expect(out.axe===true&&out.bow===false,'exception (Throwing axe) not honoured: '+JSON.stringify(out));
});
await test('[desktop] henchman advancement roll spends 6 XP and raises a stat',null,async page=>{
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>!x.packId&&x.warriors?.some(w=>w.type==='Henchman'));const H=f.warriors.find(w=>w.type==='Henchman');
    const h={...JSON.parse(JSON.stringify(H)),wid:H.id,instance:'h1',equipmentSelected:[],status:{},xp:7,profile:[3,2,2,2,2,1,2,1,5,5,5,5],advancements:[]};
    state.rosters=[{id:'rh',name:'RH',factionId:f.id,gold:0,fighters:[h]}];state.active='rh';editingIndex=0;
    const x=activeRoster().fighters[0];const before=x.profile.slice();let err='';
    try{confirmHenchRoll(5,null)}catch(e){err=String(e)}
    const y=activeRoster().fighters[0];return {err,xp:y.xp,changed:y.profile.some((v,i)=>v!==before[i]),adv:(y.advancements||[]).length}});
  expect(!out.err,'henchman roll crashed: '+out.err);
  expect(out.xp===1&&out.changed&&out.adv===1,'henchman roll did not apply: '+JSON.stringify(out));
});
await test('[desktop] warband card explains the red post-battle badge',null,async page=>{
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>x.warriors?.length);state.rosters=[{id:'pb1',name:'PB',factionId:f.id,gold:0,fighters:[],postBattle:{dice:[{value:4},{value:null}],incomeApplied:false}},{id:'pb2',name:'Clean',factionId:f.id,gold:0,fighters:[],postBattle:{dice:[{value:null},{value:''}]}}];
    const res={id:'pb3',postBattle:{result:'win',incomeApplied:false}},kept={id:'pb4',postBattle:{dice:[{value:5}],shards:2,incomeApplied:false}};
    const a=dashWarbandCard(state.rosters[0],null),b=dashWarbandCard(state.rosters[1],null);return {a:a.includes('dash-wcard-pb'),b:b.includes('dash-wcard-pb'),open:homePostBattleOpen(state.rosters[1]),res:homePostBattleOpen(res),kept:homePostBattleOpen(kept)}});
  expect(out.a&&!out.b&&!out.open&&!out.res&&!out.kept,'post-battle chip wrong: '+JSON.stringify(out));
});
await test('[desktop] scenario editor puts the formatting bar right above the focused field',null,async page=>{
  await page.evaluate(()=>{window.isAdminSession=()=>true;navigateApp('/admin')});await page.waitForTimeout(400);
  await page.evaluate(()=>{adminOpenCategory='scenarios';openScenarioEditor(null)});await page.waitForTimeout(500);
  const ta=page.locator('#seSpecialRules');await ta.scrollIntoViewIfNeeded();await ta.click();await ta.type('X');
  const near=await page.evaluate(()=>document.querySelector('.scn-format-bar')?.nextElementSibling?.id);
  await page.locator('.scn-format-bar .rule-edit-tool-bullet').click();
  const v=await ta.inputValue();
  expect(near==='seSpecialRules','format bar not next to the field: '+near);
  expect(v.includes('• '),'bullet not inserted: '+JSON.stringify(v));
  const xp=page.locator('#seExperience');await xp.scrollIntoViewIfNeeded();await xp.click();
  const off=await page.evaluate(()=>{const b=document.querySelector('.scn-format-bar');return b.classList.contains('scn-format-off')&&b.nextElementSibling?.id==='seExperience'});
  expect(off,'plain-text field should show the bar greyed out');
  const rw=page.locator('#seRewards');await rw.scrollIntoViewIfNeeded();await rw.click();
  const rwOn=await page.evaluate(()=>{const b=document.querySelector('.scn-format-bar');return !b.classList.contains('scn-format-off')&&ruleEditTargetId==='seRewards'});
  expect(rwOn,'Rewards should accept formatting');
});
await test('[desktop] light game-content export skips accounts and pictures',null,async page=>{
  await page.evaluate(()=>ensureAdminCode());
  const out=await page.evaluate(async()=>{const big='data:image/png;base64,'+'A'.repeat(3000);
    const T={users:[{id:'u1',email:'x@y.z',payload:{}}],official_warbands:[{id:'w1',created_by:'u1',definition:{name:'Orcs',icon:big,warriors:[{name:'Boss',cost:140}]}}],rule_images:[{id:'i1',data:{base64:'AAAA'}}],scenarios:[{id:'s1',user_id:'u1',definition:{name:'Skirmish'}}]};
    window.MordheimundaAPI.adminExport=async(t,off)=>t?{rows:off?[]:(T[t]||[]),done:true}:{tables:Object.keys(T).map(t=>({table:t,pageSize:20}))};
    let blob=null;const oc=URL.createObjectURL;URL.createObjectURL=b=>{blob=b;return oc.call(URL,b)};
    await adminExportAll(true);URL.createObjectURL=oc;const txt=blob?await blob.text():'';return {txt}});
  const j=JSON.parse(out.txt||'{}');const t=j.tables||{};
  expect(j.kind==='game-content','not marked as game content');
  expect(!t.users&&!t.rule_images,'accounts or pictures exported: '+Object.keys(t).join(','));
  expect(!/x@y\.z|created_by|user_id|"u1"/.test(out.txt),'account fields leaked');
  expect(t.official_warbands?.[0]?.definition?.icon==='[image]'&&t.official_warbands[0].definition.warriors[0].cost===140,'content altered wrongly');
});
await test('[desktop] warband-wide equipment discount (%) on price and value, item rule wins',null,async page=>{
  await page.evaluate(()=>ensureAdminCode());
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>!x.__official&&(x.warriors||[]).length);const w=D.weapons.find(a=>a.name==='Sword')||D.weapons.find(a=>Number(a.price)>=20);const x={wid:f.warriors[0].id};
    const old=priceRules;const base=equipmentPrice(w,f,'band',x);const it={name:w.name,value:Number(w.price),paid:Number(w.price)};const baseV=equipmentBandValue(it,f,x);
    priceRules=[{factionId:String(f.id),warriorId:null,item:'*',price:null,value:null,pricePct:20,valuePct:50}];
    const p=equipmentPrice(w,f,'band',x),v=equipmentBandValue(it,f,x),m=equipmentPrice(w,f,'market',x),stash=equipmentBandValue(it,f,null);
    priceRules.push({factionId:String(f.id),warriorId:null,item:w.name,price:3,value:null});const p2=equipmentPrice(w,f,'band',x);
    priceRules=[{factionId:String(f.id),warriorId:null,item:'*',price:null,value:null,pricePct:20,valuePct:null}];const vSame=equipmentBandValue(it,f,x);
    const rare=D.weapons.find(a=>tradingRarity(a)>=8&&Number(a.price)>0);const common=w;
    priceRules=[{factionId:String(f.id),warriorId:null,item:'*',price:null,value:null,pricePct:50,valuePct:null,rarityMin:1,rarityMax:9}];
    const rar={commonFull:equipmentPrice(common,f,'band',x)===base,rareCut:rare?equipmentPrice(rare,f,'band',x)===Math.round(Number(rare.price)*0.5)||tradingRarity(rare)>9:true,rareOut:rare&&tradingRarity(rare)>9?equipmentPrice(rare,f,'band',x)===Number(rare.price):true};
    const html=(()=>{priceRules=[{factionId:String(f.id),warriorId:null,item:'*',price:null,value:null,pricePct:20,valuePct:null}];prFactionSel=String(f.id);return adminPriceRulesMarkup()})();
    priceRules=old;return {base,baseV,p,v,m,stash,p2,vSame,rar,html:/Tout l’équipement|All equipment/.test(html)&&/−20 %/.test(html)}});
  expect(out.p===Math.round(out.base*0.8),'Band List price should be cut by 20%: '+JSON.stringify(out));
  expect(out.v===Math.round(out.baseV*0.5),'value should be cut by 50%: '+JSON.stringify(out));
  expect(out.m!==out.p||out.base===0,'market price must stay untouched: '+JSON.stringify(out));
  expect(out.stash===out.baseV,'warband stash keeps its normal value: '+JSON.stringify(out));
  expect(out.vSame===Math.round(out.baseV*0.8),'with no value %, the value follows the price %: '+JSON.stringify(out));
  expect(out.rar.commonFull&&out.rar.rareCut&&out.rar.rareOut,'rarity range 1–9 should skip Common items and cut Rare 8: '+JSON.stringify(out.rar));
  expect(out.p2===3,'a special price for one item wins over the percentage: '+out.p2);
  expect(out.html,'admin list should show the warband-wide discount');
});
await test('[desktop] admin can forbid Hired Swords / Dramatis Personae for a warband; Feared-style text bans too',null,async page=>{
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>!x.__official&&(x.warriors||[]).length);const r={factionId:f.id,fighters:[]};
    const fake=[{id:'hs-x',name:'Test Blade',type:'Hired Sword',hiredSword:true},{id:'dp-x',name:'Test Legend',type:'Hired Sword',hiredSword:true,dramatis:true}];
    const okHs=w=>hiredSwordAvailableFor(w,f,r);const before=[okHs(fake[0]),okHs(fake[1])];
    const old=warbandHireRules;warbandHireRules={[f.id]:{hs:true}};const hsBan=[okHs(fake[0]),okHs(fake[1])];
    warbandHireRules={[f.id]:{dp:true}};const dpBan=[okHs(fake[0]),okHs(fake[1])];warbandHireRules=old;
    const oldTexts=bandRuleTexts;bandRuleTexts=()=>[{name:'Feared',text:'Strigoi Vampires may not hire any Hired Swords.'}];const feared=bandHiredSwordBan(r);bandRuleTexts=oldTexts;
    return {before,hsBan,dpBan,feared:!!feared}});
  expect(out.before[0]&&out.before[1],'without a ban both are available: '+JSON.stringify(out));
  expect(!out.hsBan[0]&&out.hsBan[1],'Hired Swords ban hides Hired Swords only: '+JSON.stringify(out));
  expect(out.dpBan[0]&&!out.dpBan[1],'Dramatis Personae ban hides Dramatis Personae only: '+JSON.stringify(out));
  expect(out.feared,'“may not hire any Hired Swords” should be detected as a ban');
});
await test('[desktop] race rule bundle only fills a bare Race (X): Slayers listing their own rules get no Expert Miners',null,async page=>{
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>(x.warriors||[]).length);
    const listed=fighterRuleCardMarkup({name:'Test Slayer',type:'Henchman',rules:'Race (Dwarf), Hard Head, Elf Grudge, Magic Resistance (6)'},f);
    const bare=fighterRuleCardMarkup({name:'Test Dwarf',type:'Henchman',rules:'Race (Dwarf)'},f);
    return {listedMiners:/Expert Miners/.test(listed),listedGrudge:/Elf Grudge/.test(listed),bareMiners:/Expert Miners/.test(bare)}});
  expect(!out.listedMiners&&out.listedGrudge,'a profile that lists its own race rules must not get Expert Miners added: '+JSON.stringify(out));
  expect(out.bareMiners,'a bare Race (Dwarf) still shows the dwarf rules: '+JSON.stringify(out));
});
await test('[desktop] Play Mode fighter cards keep the rule hover peek (no need to open the sheet)',null,async page=>{
  await seed(page);
  const out=await page.evaluate(()=>{const r=state.rosters[0];const f=faction(r);const w=f.warriors[0];const x={instance:'t1',wid:w.id,name:w.name,type:w.type,profile:w.profile,rules:w.rules,xp:0,skills:['Resolute'],equipmentSelected:[],injuries:[]};
    const box=document.createElement('div');box.className='roster-sections play-cards';box.innerHTML=playCardMarkup(x,f,'','engc-test','',null,r.id);document.body.appendChild(box);
    const ref=box.querySelector('.rule-ref');if(!ref)return {ref:false};const pe=getComputedStyle(ref).pointerEvents;
    let opened=false;const old=window.playOpenFighter;window.playOpenFighter=()=>{opened=true};ref.dispatchEvent(new MouseEvent('mouseenter'));ref.click();window.playOpenFighter=old;
    const peek=document.getElementById('rulePeek');const shown=!!peek&&peek.textContent.trim().length>0;box.remove();return {ref:true,pe,opened,shown}});
  expect(out.ref,'the play card should contain linked rules');
  expect(out.pe!=='none','rule links must react to hover in Play Mode: '+JSON.stringify(out));
  expect(!out.opened,'tapping a rule must not open the fighter sheet: '+JSON.stringify(out));
  expect(out.shown,'the rule peek should show: '+JSON.stringify(out));
});
await test('[desktop] Underdog starts at a 100-point gap; decided rulings patch published texts',null,async page=>{
  await page.evaluate(()=>ensureRulesBook());
  const out=await page.evaluate(()=>({b99:playUdGapBudget(99),b100:playUdGapBudget(100),b160:playUdGapBudget(160),
    sell:patchRuleText('The item is deleted from the Stash, and the warband gains its value in gold crowns, minus D6x10 (to a minimum of five).'),
    ud:patchRuleText('You can use the Underdog bonus for each 100 points in difference above the first 100 points of difference.'),
    krox:patchRuleText('Kroxigor have a 4+ save\n\nLight Armour adds +1 to the save, as does the addition of a shield.'),
    baked:RULES_BOOK.find(x=>x.id==='postbattlesequence').content.some(c=>/minus D6x10/.test(c.text))}));
  expect(out.b99===0&&out.b100===100&&out.b160===160,'budget is the whole gap from 100 points: '+JSON.stringify(out));
  expect(/half its value/.test(out.sell)&&!/D6x10/.test(out.sell),'resale text says half: '+out.sell);
  expect(/100 points or more behind/.test(out.ud),'underdog text rewritten: '+out.ud);
  expect(/never be modified/.test(out.krox),'Kroxigor text rewritten: '+out.krox);
  expect(!out.baked,'baked post-battle text no longer says D6x10');
});
await test('[desktop] site rule pages: house rules, exploration, experience with live tables',null,async page=>{
  const out=await page.evaluate(()=>{const ids=['houserules','exploration','experience'];const secs=ids.map(id=>RULES_BOOK.find(s=>s.id===id));
    const nav=ids.map(id=>RULES_NAV_GROUPS.some(g=>g.ids.includes(id)));
    const exp=expandRuleAutoBlocks(secs[2]?.content[0].text||'',false);const ex=expandRuleAutoBlocks(secs[1]?.content[0].text||'',false);
    const box=document.createElement('div');box.innerHTML=rulePageMarkup(secs[1].content[0],'exploration',[]);
    return {have:secs.map(Boolean),nav,leftover:/\[AUTO /.test(exp+ex),tables:box.querySelectorAll('table').length,
      quests:/Headhunter/.test(exp),adv:/Initiative \+1/.test(exp),income:/\|45\|60\|/.test(ex),shards:/36 et plus\|7/.test(ex)}});
  expect(out.have.every(Boolean)&&out.nav.every(Boolean),'the three pages exist and are in the nav: '+JSON.stringify(out));
  expect(!out.leftover,'every [AUTO] block expands: '+JSON.stringify(out));
  expect(out.quests&&out.adv&&out.income&&out.shards,'live tables carry the real data: '+JSON.stringify(out));
  expect(out.tables>=5,'exploration page renders its tables: '+JSON.stringify(out));
});
await test('[mobile] interface size: off by default, larger sizes lift small text without sideways scroll',null,async page=>{
  await page.setViewportSize({width:390,height:844});await seed(page);
  const read=()=>page.evaluate(()=>{let tiny=0;document.querySelectorAll('#content *').forEach(e=>{if([...e.childNodes].some(c=>c.nodeType===3&&c.textContent.trim().length>1)&&parseFloat(getComputedStyle(e).fontSize)<11)tiny++});return {attr:document.documentElement.getAttribute('data-comfort'),tiny,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}});
  await page.evaluate(()=>{setSiteComfort('normal');navigateApp(warbandPath('smoke'))});await page.waitForTimeout(500);const normal=await read();
  await page.evaluate(()=>setSiteComfort('xlarge'));await page.waitForTimeout(500);const big=await read();
  await page.evaluate(()=>setSiteComfort('normal'));await page.waitForTimeout(300);const back=await read();
  expect(normal.attr===null&&normal.tiny>0,'normal size leaves the site as it is: '+JSON.stringify(normal));
  expect(big.attr==='xlarge'&&big.tiny===0&&big.sw<=big.cw+1,'extra large lifts every small text and fits the width: '+JSON.stringify(big));
  expect(back.attr===null&&back.tiny===normal.tiny,'switching back restores the original sizes: '+JSON.stringify(back));
});
await test('[mobile] interface polish: no split words, delete at the bottom, kill asks first, compact recruit list',null,async page=>{
  await page.setViewportSize({width:390,height:844});await seed(page);
  await page.evaluate(()=>{navigateApp(warbandPath('smoke'));openRecruitPanel()});await page.waitForTimeout(500);
  await page.locator('.recruit-panel button',{hasText:/Recruit — \d+ GC/}).first().click();await page.waitForTimeout(500);
  const split=()=>page.evaluate(()=>[...document.querySelectorAll('.warroom-head-btns .button,.fighter-section-tab')].filter(b=>{const words=b.textContent.trim().split(/\s+/).length;const r=document.createRange();r.selectNodeContents(b);return r.getClientRects().length>words+1}).map(b=>b.textContent.trim()));
  await page.evaluate(()=>navigateApp(warbandPath('smoke')));await page.waitForTimeout(500);const s1=await split();
  await page.evaluate(()=>openFighterCard(0));await page.waitForTimeout(500);const s2=await split();
  const sheet=await page.evaluate(()=>({top:!!document.querySelector('.fighter-page-actions [onclick="removeEditingFighter()"], .fighter-page > :first-child [onclick="removeEditingFighter()"]'),zone:!!document.querySelector('.fighter-danger-zone [onclick="removeEditingFighter()"]'),kill:!!document.querySelector('[onclick="confirmKillFighter()"]')}));
  await page.evaluate(()=>{confirmKillFighter()});await page.waitForTimeout(300);const asked=await page.evaluate(()=>!!document.querySelector('#siteDialog:not(.hidden)'));await page.evaluate(()=>siteDialogClose(false));
  const dead=await page.evaluate(()=>!!activeRoster().fighters[0].status?.dead);
  await page.evaluate(()=>{navigateApp(warbandPath('smoke'));openRecruitPanel();if(!recruitCompact)toggleRecruitCompact()});await page.waitForTimeout(400);
  const compact=await page.evaluate(()=>{const p=document.getElementById('fighterPool');const fb=p?.querySelector('.fighter-bottom');return !!p&&p.classList.contains('compact')&&(!fb||getComputedStyle(fb).display==='none')});
  await page.evaluate(()=>{if(recruitCompact)toggleRecruitCompact()});
  expect(!s1.length&&!s2.length,'no button or tab splits a word: '+JSON.stringify([s1,s2]));
  expect(sheet.zone&&!sheet.top&&sheet.kill,'delete sits at the bottom, kill goes through a confirmation: '+JSON.stringify(sheet));
  expect(asked&&!dead,'killing a fighter asks first and does nothing until confirmed: '+JSON.stringify({asked,dead}));
  expect(compact,'compact recruit list hides the rules block');
});
await test('[mobile] guided post-battle: steps keep what was done, back and forth, finish resets the tab',null,async page=>{
  await page.setViewportSize({width:390,height:844});await seed(page);
  await page.evaluate(()=>{navigateApp(warbandPath('smoke'));openRecruitPanel()});await page.waitForTimeout(400);
  await page.locator('.recruit-panel button',{hasText:/Recruit — \d+ GC/}).first().click();await page.waitForTimeout(400);
  await page.evaluate(()=>{setPbMode('all');setGangTab('postbattle')});await page.waitForTimeout(300);
  const all=await page.evaluate(()=>!!document.querySelector('.postbattle-accordion')&&!document.querySelector('.pbg'));
  await page.evaluate(()=>setPbMode('guided'));await page.waitForTimeout(300);
  const titles=[];for(let i=0;i<8;i++){titles.push(await page.evaluate(()=>document.querySelector('.pbg-title')?.textContent||''));await page.evaluate(()=>pbGuideGo(1));await page.waitForTimeout(150)}
  await page.evaluate(()=>{pbGuideJump(0);const x=activeRoster().fighters[0];pbgSetStatus(x.instance,'recovery');pbGuideGo(1);pbgXp(x.instance,2);pbGuideGo(1);pbGuideGo(-1);pbGuideGo(-1)});await page.waitForTimeout(300);
  const kept=await page.evaluate(()=>{const r=activeRoster(),x=r.fighters[0];return {rec:fighterStatus(x).recovery,xp:Number(x.xp)-Number(r.postBattle.guide.startXp[x.instance]),step:r.postBattle.guide.step,checked:!!document.querySelector('.pbg-chip.warn.on')}});
  await page.evaluate(()=>{pbGuideJump(pbGuideSteps(activeRoster()).length-1);pbgFinish()});await page.waitForTimeout(300);await page.evaluate(()=>siteDialogOk());await page.waitForTimeout(400);
  const after=await page.evaluate(()=>{const r=activeRoster();return {fresh:Number(r.postBattle?.guide?.step||0)===0&&!(r.postBattle?.dice||[]).length&&!r.postBattle?.actionsApplied,rec:fighterStatus(r.fighters[0]).recovery,hist:(r.history||[]).some(h=>/post-battle finished|après-bataille terminé/i.test(h.text))}});
  await page.evaluate(()=>setPbMode('all'));
  expect(all,'"All on one page" keeps the current layout');
  expect(titles[0]==='Injured and dead'&&titles.includes('Exploration')&&titles.includes('Trading Post')&&titles[7]==='Summary','guided steps in order: '+JSON.stringify(titles));
  expect(kept.rec&&kept.xp===2&&kept.step===0&&kept.checked,'back and forth keeps what was done: '+JSON.stringify(kept));
  expect(after.fresh&&after.rec&&after.hist,'finish records history, keeps the results and starts the tab again: '+JSON.stringify(after));
});
await test('[mobile] guided post-battle XP step: same XP & quest table as Play mode, writes to the fighter, stays on the warband',null,async page=>{
  await page.setViewportSize({width:390,height:844});await seed(page);
  await page.evaluate(()=>{navigateApp(warbandPath('smoke'));openRecruitPanel()});await page.waitForTimeout(400);
  await page.locator('.recruit-panel button',{hasText:/Recruit — \d+ GC/}).first().click();await page.waitForTimeout(400);
  await page.evaluate(()=>{setPbMode('guided');setGangTab('postbattle');pbGuideJump(1)});await page.waitForTimeout(400);
  const x0=await page.evaluate(()=>activeRoster().fighters[0].xp);
  await page.evaluate(()=>{const b=[...document.querySelectorAll('.pbg-xptable [onclick^="pbgGameXp"]')].find(b=>/,1\)$/.test(b.getAttribute('onclick')));b&&b.click()});await page.waitForTimeout(300);
  const out=await page.evaluate(()=>({xp:activeRoster().fighters[0].xp,rec:(activeRoster().fighters[0].gameXpRecord||[]).length,table:!!document.querySelector('.pbg-xptable .ms-row'),onPage:location.pathname.startsWith('/warbands/smoke')&&!!document.querySelector('.pbg'),ctx:xpCtx}));
  await page.evaluate(()=>setPbMode('all'));
  expect(out.table,'the guided XP step shows the Play mode table');
  expect(out.xp>x0&&out.rec===1,'a + adds the line XP to the fighter: '+JSON.stringify({x0,...out}));
  expect(out.onPage&&out.ctx===null,'stays on the warband page and leaves no context behind: '+JSON.stringify(out));
});
await test('[desktop] Slow Witted: advancements cost x1.5 (rounded up), starting XP x1.5, normal fighters unchanged',null,async page=>{
  await seed(page);
  const out=await page.evaluate(()=>{const slowL={name:'Ogre Test',type:'Leader',ruleNames:['Race (Ogre)','Slow Witted'],rules:'Race (Ogre), Slow Witted',profile:[6,4,3,4,4,4,3,3,8,9,6,6]};
    const slowC={...slowL,type:'Champion'};const normL={name:'Human Test',type:'Leader',ruleNames:['Race (Human)'],rules:'Race (Human)',profile:[4,4,4,3,3,2,4,3,9,8,7,7]};
    return {mult:xpCostMultiplier(slowL),six:xpCostFor(slowL,6),three:xpCostFor(slowL,3),startL:startingXpFor(slowL),startC:startingXpFor(slowC),normal:[xpCostMultiplier(normL),xpCostFor(normL,6),startingXpFor(normL)]}});
  expect(out.mult===1.5&&out.six===9&&out.three===5,'x1.5 rounded up: '+JSON.stringify(out));
  expect(out.startL===30&&out.startC===14,'starting XP x1.5 (30 / 14): '+JSON.stringify(out));
  expect(out.normal.join()==='1,6,20','normal fighters unchanged: '+JSON.stringify(out));
});
await test('[desktop] Gluttony: each Ogre counts 1.5 models for wyrdstone income (rounded up), others 1',null,async page=>{
  const out=await page.evaluate(()=>{const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Leader'));const L=f.warriors.find(w=>w.type==='Leader');const keep=f.specialRules;
    const mk=(i,race)=>({...JSON.parse(JSON.stringify(L)),wid:L.id,instance:'g'+i,extraRuleNames:race==='Ogre'?['Race (Ogre)']:[],equipmentSelected:[],status:{}});
    state.rosters=[{id:'gl',name:'GL',factionId:f.id,gold:0,fighters:[mk(1,'Ogre'),mk(2,'Ogre'),mk(3,'Ogre'),mk(4,'Gnoblar'),mk(5,'Gnoblar')]}];state.active='gl';const r=activeRoster();
    const without=postBattleWarriorCount(r);f.specialRules=[...(keep||[]),{name:'Gluttony',text:'Because of a voracious appetite, each Ogre model counts as two models when selling wyrdstone or treasure.'}];
    const withG=postBattleWarriorCount(r);const txt=bandRuleTexts(r).find(e=>e.name==='Gluttony')?.text||'';f.specialRules=keep;return {without,withG,txt}});
  expect(out.without===5,'no Gluttony rule: one per fighter: '+JSON.stringify(out));
  expect(out.withG===7,'3 Ogres x1.5 + 2 = 6.5 -> 7: '+JSON.stringify(out));
  expect(/one and a half/.test(out.txt),'Gluttony text updated: '+out.txt);
});
await test('[desktop] Dramatis Personae own weapons: given free with it, no slot, synced after an edit, never in shop lists',null,async page=>{
  await seed(page);
  const out=await page.evaluate(()=>{const id='dpw-test';state.customFighters=[...(state.customFighters||[]),{customFighterId:id,name:'Test Prophet',type:'Hired Sword',hiredSword:true,dramatis:true,dpMode:'hire',cost:50,upkeep:0,max:1,profile:[6,3,3,3,2,2,5,2,8,8,9,8],ruleNames:[],rules:'',dpRules:[],defaultEquipment:[],
      dpWeapons:[{id:'b1',name:'Blade of the Test',profile:{range:'Melee 0',strength:'S+1',ap:'-1',damage:'1',traits:'Poison'},rulesText:'A test blade.'}]}];save(true);
    const r=activeRoster();r.gold=500;const w=hiredSwordAsWarrior(hiredSwordRawById(id));hiredSwordDoHire(w,{});
    const x=r.fighters.find(f=>f.customFighterId===id||f.name==='Test Prophet');if(!x)return {hired:false};
    const own=(x.equipmentSelected||[]).filter(e=>e.dpOwn);const slots=currentWeaponSlots(x);const val=fighterValue(x,faction(r));
    const cf=state.customFighters.find(c=>c.customFighterId===id);cf.dpWeapons[0].profile.strength='S+2';cf.dpWeapons.push({id:'b2',name:'Second Test',profile:{range:'12',strength:'3',ap:'-',damage:'1',traits:''},rulesText:''});cf.updatedAt=Date.now();
    syncAdminManagedFighter(x,r);const own2=(x.equipmentSelected||[]).filter(e=>e.dpOwn);
    const inShop=(()=>{try{return JSON.stringify(equipmentPool(faction(r),'band',null)||[]).includes('Blade of the Test')}catch(e){return 'n/a'}})();
    return {hired:true,own:own.map(e=>e.name),s:own[0]?.profile?.strength,slots,val,own2:own2.map(e=>e.name+':'+e.profile.strength),inShop}});
  expect(out.hired&&out.own.length===1&&out.s==='S+1','the own weapon comes with the hire: '+JSON.stringify(out));
  expect(out.slots===0,'own weapons take no weapon slot: '+JSON.stringify(out));
  expect(out.own2.join()==='Blade of the Test:S+2,Second Test:3','an edit of the character updates the hired copy: '+JSON.stringify(out));
  expect(out.inShop!==true,'own weapons are not in the shop: '+JSON.stringify(out));
});
await test('[desktop] custom fighter default skills: ticked from a list grouped by tree, with search',null,async page=>{
  await page.evaluate(()=>navigateApp('/custom'));await page.waitForTimeout(400);
  const out=await page.evaluate(()=>{const box=document.createElement('div');box.innerHTML=cfSkillPickerMarkup([],false);document.body.appendChild(box);
    const trees=box.querySelectorAll('.cf-skill-tree').length;const first=box.querySelector('.cf-skill-opt');const name=first?.dataset.skill;customFighterSkillDraft=[];
    toggleCustomFighterSkill(name);const added=customFighterSkillDraft.includes(name)&&first.classList.contains('on');toggleCustomFighterSkill(name);const removed=!customFighterSkillDraft.length&&!first.classList.contains('on');
    cfSkillFilter(name.slice(0,4));const shown=[...box.querySelectorAll('.cf-skill-opt')].filter(b=>!b.hidden).map(b=>b.dataset.skill);box.remove();return {trees,added,removed,shown,name}});
  expect(out.trees>3,'skills are grouped by tree: '+JSON.stringify(out));
  expect(out.added&&out.removed,'a click ticks then unticks a skill: '+JSON.stringify(out));
  expect(out.shown.includes(out.name),'search keeps the matching skill: '+JSON.stringify(out));
});
await test('[desktop] Dramatis Personae: trait picker per own weapon, shown as Dramatis Personae, own Rules listing',null,async page=>{
  await seed(page);
  const out=await page.evaluate(()=>{const box=document.createElement('div');box.id='dpWeaponsBox';document.body.appendChild(box);
    box.innerHTML=dpWeaponRowsMarkup([{id:'w1',name:'Fang',profile:{range:'Melee 0',strength:'S',ap:'-',damage:'1',traits:'Parry'},rulesText:'Poison on a 6.'}]);
    const picker=!!box.querySelector('#dpwInput-w1')&&!box.querySelector('.dpwTraits');const linkedTag=!!box.querySelector('#dpwTags-w1 [data-ref-id]');
    box.querySelector('#dpwInput-w1').value='Poison';addTraitFor('dpw:w1');const read=dpWeaponsReadRaw()[0].profile.traits;box.remove();
    const id='dpl-test';state.customFighters=[...(state.customFighters||[]),{customFighterId:id,name:'Label Prophet',type:'Hired Sword',hiredSword:true,dramatis:true,dpMode:'hire',cost:50,upkeep:0,max:1,profile:[6,3,3,3,2,2,5,2,8,8,9,8],ruleNames:[],rules:'',dpRules:[{name:'Old Wrath',text:'Causes Fear.'}],defaultEquipment:[],dpWeapons:[]}];save(true);
    const r=activeRoster();r.gold=500;hiredSwordDoHire(hiredSwordAsWarrior(hiredSwordRawById(id)),{});const x=r.fighters.find(f=>f.name==='Label Prophet');
    const groups=rosterGroupedIndices(r).map(g=>g.role);const dpPage=hiredSwordsRulesPageMarkup(true),hsPage=hiredSwordsRulesPageMarkup(false);
    return {picker,linkedTag,read,label:fighterTypeLabel(x),stillHS:isHiredSword(x),groups,dpPage:dpPage.includes('Label Prophet'),hsPage:hsPage.includes('Label Prophet'),ruleLinked:/data-ref-/.test(dramatisRulesMarkup(x))}});
  expect(out.picker&&out.linkedTag,'each own weapon row has the trait picker with linked tags: '+JSON.stringify(out));
  expect(out.read==='Parry, Poison','picked traits are saved: '+JSON.stringify(out));
  expect(out.label==='Dramatis Personae'&&out.stillHS&&out.groups.includes('Dramatis Personae'),'a DP shows as Dramatis Personae: '+JSON.stringify(out));
  expect(out.dpPage&&!out.hsPage,'DPs have their own Rules page: '+JSON.stringify(out));
  expect(out.ruleLinked,'keywords in own rules are linked: '+JSON.stringify(out));
});
await test('[desktop] Rules: Hired Swords / Dramatis Personae page lists starting equipment, choices and own weapons with links',null,async page=>{
  await seed(page);
  const out=await page.evaluate(()=>{state.customFighters=[...(state.customFighters||[]),{customFighterId:'dpg',name:'Gear Prophet',type:'Hired Sword',hiredSword:true,dramatis:true,dpMode:'hire',cost:50,upkeep:10,max:1,profile:[6,3,3,3,2,2,5,2,8,8,9,8],ruleNames:[],rules:'',dpRules:[],defaultEquipment:['Light Armour'],hsChoices:[{label:'Weapon',count:1,options:['Sword','Axe']}],dpWeapons:[{id:'g1',name:'Blade of Ages',profile:{range:'Melee 0',strength:'S+1',ap:'-1',damage:'1',traits:'Parry'},rulesText:'Causes Fear.'}]}];
    const box=document.createElement('div');box.innerHTML=hiredSwordsRulesPageMarkup(true);const gear=box.querySelector('.hs-rules-gear');const txt=gear?.textContent||'';
    return {gear:!!gear,armour:/Light armour/i.test(txt),choice:/Sword/.test(txt)&&/Axe/.test(txt)&&!!gear?.querySelector('.hs-rules-choice'),own:/Blade of Ages/.test(txt),links:gear?gear.querySelectorAll('[data-ref-id]').length:0,back:!!box.querySelector('button.rules-back'),label:!/>Hired Sword</i.test(box.innerHTML.replace(/HIRED SWORD/g,'x'))||box.innerHTML.includes('Dramatis Personae</span>')}});
  expect(out.gear&&out.armour&&out.choice&&out.own,'starting gear, choices and own weapons are listed: '+JSON.stringify(out));
  expect(out.links>=4,'items and traits are linked: '+JSON.stringify(out));
  expect(out.back,'the back link is a site button: '+JSON.stringify(out));
});
await test('[desktop] Dramatis Personae lore: shown on the Rules page only',null,async page=>{
  await seed(page);
  const out=await page.evaluate(()=>{const id='dplore';state.customFighters=[...(state.customFighters||[]),{customFighterId:id,name:'Lore Prophet',type:'Hired Sword',hiredSword:true,dramatis:true,dpMode:'hire',cost:50,upkeep:0,max:1,profile:[6,3,3,3,2,2,5,2,8,8,9,8],ruleNames:[],rules:'',dpRules:[],defaultEquipment:[],dpWeapons:[],dpLore:'Born under the twin moons of Zerbravia.'}];save(true);
    const rules=hiredSwordsRulesPageMarkup(true).includes('twin moons of Zerbravia');
    const r=activeRoster();r.gold=500;hiredSwordDoHire(hiredSwordAsWarrior(hiredSwordRawById(id)),{});const i=r.fighters.findIndex(f=>f.name==='Lore Prophet');
    const card=ownedFighterCard(r.fighters[i],i,faction(r)).includes('twin moons');
    const form=(()=>{try{return customFighterForm?String(customFighterForm(hiredSwordRawById(id),'hired-swords')||''):''}catch(e){return ''}})();
    return {rules,card,search:searchRun('zerbravia').some(g=>g.key==='hiredSwords')}});
  expect(out.rules,'lore shows on the Rules page: '+JSON.stringify(out));
  expect(!out.card,'lore is not on the warband card: '+JSON.stringify(out));
  expect(out.search,'lore is searchable: '+JSON.stringify(out));
});
await test('[desktop] Custom starting spells: picked like skills, given at hire, synced; DP rules card has no choice menus',null,async page=>{
  await seed(page);
  const out=await page.evaluate(()=>{const doms=customMergedMagicDomains(null);const [dom,list]=Object.entries(doms).find(([,l])=>l.length>1);
    customFighterSpellDraft=[];const box=document.createElement('div');box.innerHTML=`<div id="cfSpellTags"></div>`+cfSpellPickerMarkup(false);document.body.appendChild(box);
    toggleCustomFighterSpell(list[0]);const picked=customFighterSpellDraft.slice();const btnOn=box.querySelector('.cf-spell-opt.on')?.dataset.spell;box.remove();
    const id='dpsp';state.customFighters=[...(state.customFighters||[]),{customFighterId:id,name:'Spell Prophet',type:'Hired Sword',hiredSword:true,dramatis:true,dpMode:'hire',cost:50,upkeep:0,max:1,profile:[6,3,3,3,2,2,5,2,8,8,9,8],ruleNames:[],rules:'',dpRules:[],defaultEquipment:[],dpWeapons:[],defaultSkills:[],defaultSpells:[list[0]]}];save(true);
    const r=activeRoster();r.gold=500;hiredSwordDoHire(hiredSwordAsWarrior(hiredSwordRawById(id)),{});const x=r.fighters.find(f=>f.name==='Spell Prophet');const hired=(x?.spells||[]).slice();
    const cf=state.customFighters.find(c=>c.customFighterId===id);cf.defaultSpells=[list[1]];cf.updatedAt=Date.now();try{syncAdminManagedFighter(x,r)}catch(e){}try{ensureFighterSourceData(x,r)}catch(e){}
    const card=fighterRuleCardMarkup(hiredSwordAsWarrior(cf),null);
    return {picked,btnOn,first:list[0],second:list[1],hired,synced:(x?.spells||[]).slice(),menus:/Available skills|Compétences disponibles|Equipment available|Magie disponible|Magic available/.test(card),spellRow:card.includes(list[1])}});
  expect(out.picked.length===1&&out.picked[0]===out.first&&out.btnOn===out.first,'a click picks a spell: '+JSON.stringify(out));
  expect(out.hired.includes(out.first),'the hired copy knows the spell: '+JSON.stringify(out));
  expect(out.synced.includes(out.second)&&!out.synced.includes(out.first),'an edit updates the hired copy: '+JSON.stringify(out));
  expect(!out.menus&&out.spellRow,'DP rules card: no choice menus, spells listed: '+JSON.stringify(out));
});
await test('[desktop] play & reading helpers: rout threshold, combat screen order, scenario sections, find in page, pins',null,async page=>{
  await seed(page);
  const out=await page.evaluate(()=>{const r=activeRoster();const f=faction(r);(f.warriors||[]).slice(0,5).forEach(w=>r.fighters.push({...w,profile:(w.profile||[]).slice(),baseProfile:(w.profile||[]).slice(),sourceName:w.name,wid:w.id,instance:crypto.randomUUID(),name:w.name,xp:0,equipmentSelected:[],skills:[],spells:[],advancements:[],injuries:[]}));
    SCENARIOS_CACHE=[...(SCENARIOS_CACHE||[]),{id:'ps1',name:'Plain',bandsMin:2,bandsMax:2,battlefield:{terrainType:'Ruins'},endCondition:'',victory:{major:'Win'}}];
    const secs=scenarioSections(SCENARIOS_CACHE.find(x=>x.id==='ps1'),true,'<div>dep</div>').map(x=>x.title);
    const ps=blankPlaySession();ps.scenarioId='ps1';playEnsureSlots(ps,2);ps.slots[0]={...ps.slots[0],source:'own',rosterId:r.id,rosterName:r.name};state.playSession=ps;
    const e=playEngEntry(ps,r);e.picks=r.fighters.map(x=>x.instance);const before=playFightersMarkup(ps);e.validated=true;const after=playFightersMarkup(ps);
    ps.rout={};ps.rout[r.id]=2;const row=playRoutRowMarkup(ps,r);
    state.playSession=null;
    navigateApp('/rules');const c=document.getElementById('content');const probe=document.createElement('p');probe.textContent='Zorblax test word';c.appendChild(probe);pfSearch('zorblax');const hits=pfState.hits.length;pfClose();probe.remove();
    localStorage.removeItem('mu_read_pins');readTogglePin();const pins=readPins().length;readTogglePin();
    return {secs,firstIsCardsAfter:after.indexOf('ROUT')>=0&&after.indexOf('eng-ingame')>=0,beforeNoRout:before.indexOf('rout-box')<0,row:/4\+/.test(row),hits,pins,pinsAfter:readPins().length}});
  expect(!out.secs.some(t=>/End of Game/.test(t))&&out.secs.some(t=>/Victory/.test(t)),'empty scenario sections are left out: '+JSON.stringify(out));
  expect(out.beforeNoRout&&out.firstIsCardsAfter,'combat screen comes first once validated, with the rout test: '+JSON.stringify(out));
  expect(out.row,'5 starting fighters, 2 down: the warband flees on 4+: '+JSON.stringify(out));
  expect(out.hits===1,'find in page highlights the word: '+JSON.stringify(out));
  expect(out.pins===1&&out.pinsAfter===0,'a page can be pinned and unpinned: '+JSON.stringify(out));
});
await test('[desktop] phone helpers: number stepper, folded campaign status, play resume tab, offline cache list',null,async page=>{
  await seed(page);
  const out=await page.evaluate(()=>{const st=numStepperMarkup(2,`setPostBattleNumber('extraDice',%v)`,0,20);
    const r=activeRoster();const f=faction(r);const w=f.warriors[0];r.fighters.push({...w,profile:w.profile.slice(),baseProfile:w.profile.slice(),sourceName:w.name,wid:w.id,instance:crypto.randomUUID(),name:w.name,xp:0,equipmentSelected:[],skills:[],spells:[],advancements:[],injuries:[]});
    const status=fighterStatusControlsMarkup(r.fighters[0]);
    return {minus:/extraDice',1\)/.test(st),plus:/extraDice',3\)/.test(st),numpad:/inputmode="numeric"/.test(st),fold:/<details class="fighter-status-panel fighter-status-fold/.test(status)&&/<\/details>$/.test(status.trim()),wake:typeof wakeWanted==='function'}});
  expect(out.minus&&out.plus&&out.numpad,'stepper buttons and numeric keypad: '+JSON.stringify(out));
  expect(out.fold,'campaign status is a foldable block: '+JSON.stringify(out));
  expect(out.wake,'wake lock helper present: '+JSON.stringify(out));
});
await test('[desktop] scenario text: the line above a table is plain text, not a big title',null,async page=>{
  const out=await page.evaluate(()=>scenarioText('Lance un D6 pour chaque pion :\n[TABLE]\nD6|Résultat\n1|Rien\n[/TABLE]'));
  expect(!/rule-heading/.test(out)&&/rule-table|<table/.test(out),'no page title in scenario text: '+out.slice(0,300));
});
await test('[desktop] warband colour, Stats tab, emblem and XP bar',null,async page=>{
  await seed(page);
  const out=await page.evaluate(()=>{const r=activeRoster();const f=faction(r);const w=f.warriors[0];r.fighters.push({...w,profile:w.profile.slice(),baseProfile:w.profile.slice(),sourceName:w.name,wid:w.id,instance:crypto.randomUUID(),name:w.name,xp:40,equipmentSelected:[],skills:[],spells:[],advancements:[],injuries:[]});
    const auto=warbandColor(r);r.color='#e06fa0';const picked=warbandColor(r);delete r.color;r.battleRecord={w:2,d:0,l:1};
    navigateApp(warbandPath(r.id));setGangTab('stats');const stats=document.querySelector('.st-page')?.textContent||'';gangTab='roster';render('builder');
    const card=document.querySelector('.fighter-card-v5')?.innerHTML||'';return {auto:/^#[0-9a-f]{6}$/i.test(auto),picked,stats:/67%/.test(stats),emblem:/fighter-emblem/.test(card),xp:/xpbar/.test(card)}});
  expect(out.auto&&out.picked==='#e06fa0','warband colour: race default and player choice: '+JSON.stringify(out));
  expect(out.stats,'Stats tab shows the record: '+JSON.stringify(out));
  expect(out.emblem&&out.xp,'fighter card shows the emblem and the XP bar: '+JSON.stringify(out));
});
await test('[desktop] printable sheets, journal, pre-game reminder, rarity gems, warband tint',null,async page=>{
  await seed(page);
  const out=await page.evaluate(()=>{const r=activeRoster();const f=faction(r);const w=f.warriors[0];r.fighters.push({...w,profile:w.profile.slice(),baseProfile:w.profile.slice(),sourceName:w.name,wid:w.id,instance:crypto.randomUUID(),name:w.name,xp:40,equipmentSelected:[],skills:[],spells:[],advancements:[],injuries:[],status:{recovery:true}});
    const sheet=sheetDocument(r,false),blank=sheetDocument(null,true);activeRoster().valueLog=[{ts:Date.now(),value:300,res:'win',scenario:'Street Fight',hero:'Bob'}];save(true);
    navigateApp(warbandPath(r.id));setGangTab('stats');const journal=/Street Fight/.test(document.querySelector('.st-journal')?.textContent||'');
    const remind=playPreGameReminder(r);readToolsSync();const tinted=document.body.classList.contains('wb-tinted');
    return {sheet:sheet.includes(r.name)&&sheet.includes('ws-stats'),blank:(blank.match(/ws-fighter blank/g)||[]).length,journal,remind:/convalescence|recovery/i.test(remind),gem:rarityTier({rarity:'Rare 10'})==='epic'&&rarityTier({rarity:'Common'})==='common',tinted}});
  expect(out.sheet&&out.blank===10,'warband sheet and 10 blank fighter blocks: '+JSON.stringify(out));
  expect(out.journal,'game journal lists recorded battles: '+JSON.stringify(out));
  expect(out.remind,'pre-game reminder mentions fighters in recovery: '+JSON.stringify(out));
  expect(out.gem&&out.tinted,'rarity tiers and warband background tint: '+JSON.stringify(out));
});
await test('[desktop] game end: out of action on cards, game note, summary to guided post-battle, fighter history',null,async page=>{
  await seed(page);
  const out=await page.evaluate(async()=>{const r=activeRoster();const f=faction(r);(f.warriors||[]).slice(0,5).forEach(w=>r.fighters.push({...w,profile:(w.profile||[]).slice(),baseProfile:(w.profile||[]).slice(),sourceName:w.name,wid:w.id,instance:crypto.randomUUID(),name:w.name,xp:0,equipmentSelected:[],skills:[],spells:[],advancements:[],injuries:[]}));save(true);
    SCENARIOS_CACHE=[...(SCENARIOS_CACHE||[]),{id:'ps2',name:'Bridge Fight',bandsMin:2,bandsMax:2,battlefield:{terrainType:'Ruins'},endCondition:'',victory:{major:'Win'}}];
    const ps=blankPlaySession();ps.scenarioId='ps2';playEnsureSlots(ps,2);ps.slots[0]={...ps.slots[0],source:'own',rosterId:r.id,rosterName:r.name};state.playSession=ps;
    const e=playEngEntry(ps,r);e.picks=activeRoster().fighters.map(x=>x.instance);e.validated=true;save(true);
    const heroes=activeRoster().fighters.filter(x=>['Leader','Champion','Raw Recruit'].includes(x.type));const down=heroes[heroes.length-1]||activeRoster().fighters[0];const id=down.instance;
    playOoaToggle(r.id,id);const m1=playFightersMarkup(state.playSession);const rout1=state.playSession.rout[r.id];
    playOoaToggle(r.id,id);const rout0=state.playSession.rout[r.id];playOoaToggle(r.id,id);
    playNoteSet('ambush at the bridge');const note=playNoteMarkup(state.playSession);
    const snap=playSummaryBuild(state.playSession);confirmPlayEndSession();await new Promise(z=>setTimeout(z,600));
    const rr=state.rosters.find(q=>q.id===r.id);const lg=rr.lastGame;const games=rr.fighters.filter(x=>(x.games||[]).length===1).length;
    openPlaySummary(snap);const modal=document.getElementById('modalContent').innerHTML;snap.bands[0].result='win';playSummaryToPostBattle(r.id);await new Promise(z=>setTimeout(z,400));
    const r2=activeRoster();const p=r2.postBattle;const inj=pbgInjuriesMarkup(r2,true);const hist=fighterHistoryMarkup(r2.fighters.find(x=>x.instance===id),r2);
    return {group:/Out of Action/.test(m1)&&/is-ooa/.test(m1),rout1,rout0,note:/ambush/.test(note),ooaKept:(lg?.ooa||[]).includes(id),games,total:rr.fighters.length,pbBtn:/Post-battle of/.test(modal),result:p.result,heroesOk:!(p.survivingHeroIds||[]).includes(id)&&(p.survivingHeroIds||[]).length===heroes.length-1,mode:localStorage.getItem(PB_MODE_KEY),injFlag:/was-ooa/.test(inj),jNote:(r2.valueLog||[]).slice(-1)[0]?.note,hist:/went out of action/.test(hist)&&/Bridge Fight/.test(hist)}});
  expect(out.group&&out.rout1===1&&out.rout0===0,'a fighter marked Out of Action drops to its group and moves the rout counter: '+JSON.stringify(out));
  expect(out.note&&out.ooaKept&&out.games===out.total,'note, who went down and each fighter\'s game are kept at the end: '+JSON.stringify(out));
  expect(out.pbBtn&&out.result==='win'&&out.heroesOk&&out.mode==='guided','the summary leads to the guided post-battle with result and surviving heroes filled in: '+JSON.stringify(out));
  expect(out.injFlag&&out.jNote==='ambush at the bridge'&&out.hist,'injury step flags the fallen, journal gets the note, fighter history shows the game: '+JSON.stringify(out));
});
await test('[desktop] shopping list, delete warning, glossary links, search filter, reading mode',null,async page=>{
  await seed(page);
  const out=await page.evaluate(async()=>{const r=activeRoster();const f=faction(r);const w=(f.warriors||[]).find(q=>q.type==='Leader')||f.warriors[0];r.fighters.push({...w,profile:(w.profile||[]).slice(),baseProfile:(w.profile||[]).slice(),sourceName:w.name,wid:w.id,instance:crypto.randomUUID(),name:w.name,xp:5,equipmentSelected:[],skills:[],spells:[],advancements:[{}],injuries:[]});save(true);
    openFighterCard(0);equipmentTab='band';equipmentOpen=true;const x=activeRoster().fighters[0];
    const items=equipmentPool('band',x).filter(q=>{const p=equipmentPrice(q,f,'band',x);return p>0&&p<=60&&canEquip(x,q).ok&&!q.bandOnlyIntrinsic}).slice(0,2);
    items.forEach(q=>buyDraftAdd(encodeURIComponent(q.name)));render('fighter');const bar=!!document.querySelector('.buy-draft');
    const g0=Number(activeRoster().gold);const sum=buyDraft.items.reduce((n,i)=>n+i.price,0);const cntEq=y=>(fighterUsesLoadouts(y)?(y.equipmentStash||[]):(y.equipmentSelected||[])).length;const n0=cntEq(activeRoster().fighters[0]);
    buyDraftCommit();const x2=activeRoster().fighters[0];const n1=cntEq(x2);
    const warn=fighterLossWarning(x2);
    navigateApp('/rules');await new Promise(z=>setTimeout(z,300));const term=referenceEntries('traits').find(t=>t.name&&t.name.length>4&&!/\(/.test(t.name));const probe=document.createElement('div');probe.className='rule-page-text';probe.innerHTML=`<p>A model with ${term.name} is tough. ${term.name} again.</p><h4>${term.name}</h4>`;document.getElementById('content').appendChild(probe);glossarySweep();const links=probe.querySelectorAll('.gl-auto').length;probe.remove();
    siteSearchQuery='sword';siteSearchFilter='';openSiteSearch();const chips=document.querySelectorAll('.site-search-chips button').length;const key=searchRun('sword')[0]?.key;siteSearchFilter=key;drawSiteSearch();const groupsShown=document.querySelectorAll('#siteSearchResults .site-search-group').length;closeSiteSearch();siteSearchFilter='';
    readModeToggle(true);const rm=document.body.classList.contains('read-mode')&&!!document.getElementById('readModeBar');readModeScale(0.1);readModeToggle(false);
    return {bar,cnt:items.length,sum,spent:g0-Number(activeRoster().gold),added:n1-n0,warn:/5 XP/.test(warn)&&/advancement/.test(warn),links,chips,groupsShown,rm,hl:/<mark>/.test(searchHl('Hired Swords','hired sw')),offRm:!document.body.classList.contains('read-mode')}});
  expect(out.cnt===2&&out.bar&&out.added===2&&out.spent===out.sum,'the shopping list buys everything at once: '+JSON.stringify(out));
  expect(out.warn,'deleting warns about XP and advancements: '+JSON.stringify(out));
  expect(out.links===1,'the first mention of a trait in rule text becomes a link (not the heading, not twice): '+JSON.stringify(out));
  expect(out.chips>=2&&out.groupsShown===1&&out.hl,'search results can be filtered by category and highlight the words: '+JSON.stringify(out));
  expect(out.rm&&out.offRm,'reading mode turns on and off: '+JSON.stringify(out));
});
await test('[desktop] animations on actions, advance in one tap, reminders, table mode, roster filter, error log, backups',null,async page=>{
  await seed(page);
  const out=await page.evaluate(async()=>{const r=activeRoster();const f=faction(r);const mk=(w,xp)=>({...w,profile:(w.profile||[]).slice(),baseProfile:(w.profile||[]).slice(),sourceName:w.name,wid:w.id,instance:crypto.randomUUID(),name:w.name,xp,equipmentSelected:[],skills:[],spells:[],advancements:[],injuries:[]});
    (f.warriors||[]).slice(0,4).forEach((w,i)=>r.fighters.push(mk(w,i===0?40:0)));r.fighters[1].skills=['Sprint'];save(true);
    navigateApp(warbandPath('smoke'));await new Promise(z=>setTimeout(z,400));
    // 10 tab slide
    setGangTab('stats');const slide=document.querySelector('.warroom-main')?.className||'';setGangTab('roster');
    // 18 filter
    rosterFilterSet('sprint');const vis=[...document.querySelectorAll('.roster-sections [data-fx-inst^="card:"]')].filter(el=>(el.closest('.fighter-card-wrap,.draggable-fighter,[data-fighter-index]')||el).style.display!=='none').length;rosterFilterSet('');
    // 7 new card
    const w=(f.warriors||[]).find(q=>q.type==='Henchman')||f.warriors[f.warriors.length-1];const n0=activeRoster().fighters.length;await addFighter(w.id);await new Promise(z=>setTimeout(z,300));const added=activeRoster().fighters.length-n0;
    // 9 rout levels
    const lv=[playRoutLevel(5,0),playRoutLevel(6,1),playRoutLevel(5,1),playRoutLevel(5,5)];
    // 16 reminders
    const rem=homeReminders().map(x=>x.k);
    // 15 advance tap
    openFighterAdvance(activeRoster().fighters[0].instance);const adv={tab:fighterTab,open:progressionOpen};
    // 17 table mode
    state.rosters.push({id:'smoke2',name:'Second Band',factionId:r.factionId,gold:100,fighters:[mk(f.warriors[0],0)]});save(true);
    const ps=blankPlaySession();playEnsureSlots(ps,2);ps.slots[0]={...ps.slots[0],source:'own',rosterId:'smoke',rosterName:'a'};ps.slots[1]={...ps.slots[1],source:'own',rosterId:'smoke2',rosterName:'b'};state.playSession=ps;
    ['smoke','smoke2'].forEach(id=>{const rr=state.rosters.find(q=>q.id===id);const e=playEngEntry(ps,rr);e.picks=rr.fighters.map(x=>x.instance);e.validated=true});
    playTableMode=true;const tm=playFightersMarkup(ps);playTableMode=false;state.playSession=null;
    // 19 error log
    localStorage.removeItem(ERRLOG_KEY);errLogAdd('Boom test','x.js:1:2');const el=errLogRead();openErrorLog();const elModal=/Boom test/.test(document.getElementById('modalContent').innerHTML);closeModal();
    // 20 backups
    window.siteConfirm=async()=>true;await bkSnapshot(true);const before=activeRoster().fighters.length;const nm=state.rosters.find(q=>q.id==='smoke').name;state.rosters.find(q=>q.id==='smoke').name='Changed';save(true);
    const list=await bkList();await bkRestore(list[0].ts,'smoke');const back=state.rosters.find(q=>q.id==='smoke');
    return {slide,vis,added,fxQueued:true,lv,rem,adv,cols:(tm.match(/play-table-col/g)||[]).length,el:el.length===1&&el[0].action!==undefined,elModal,snaps:list.length,restored:back.name===nm,cnt:back.fighters.length===before}});
  expect(/tab-in-r/.test(out.slide),'tabs slide in: '+JSON.stringify(out));
  expect(out.vis===1,'the roster filter keeps only the fighter with Sprint: '+JSON.stringify(out));
  expect(out.added===1,'recruit still works with the animation hook: '+JSON.stringify(out));
  expect(out.lv.join()==='0,1,2,3','rout levels 6+/5+/flee: '+JSON.stringify(out));
  expect(out.rem.some(k=>k.startsWith('adv:smoke')),'home reminds that a fighter can advance: '+JSON.stringify(out));
  expect(out.adv.tab==='progression'&&out.adv.open,'Advance opens the progression: '+JSON.stringify(out));
  expect(out.cols===2,'table mode shows one column per warband: '+JSON.stringify(out));
  expect(out.el&&out.elModal,'errors are kept and shown: '+JSON.stringify(out));
  expect(out.snaps>=1&&out.restored&&out.cnt,'a warband can be restored from a backup: '+JSON.stringify(out));
});
await test('[desktop] stats split and timeline, stat-up flash, veteran edges, victory card',null,async page=>{
  await seed(page);
  const out=await page.evaluate(async()=>{const r=activeRoster();const f=faction(r);const mk=w=>({...w,profile:(w.profile||[]).slice(),baseProfile:(w.profile||[]).slice(),sourceName:w.name,wid:w.id,instance:crypto.randomUUID(),name:w.name,xp:20,equipmentSelected:[],skills:[],spells:[],advancements:[],injuries:[]});
    (f.warriors||[]).slice(0,4).forEach(w=>r.fighters.push(mk(w)));const t0=Date.now()-5*864e5;r.valueLog=[{pb:'a',ts:t0,value:300,res:'win',scenario:'Bridge',hero:'',dead:0},{pb:'b',ts:t0+2*864e5,value:280,res:'loss',scenario:'Well',hero:'',dead:1}];
    r.history=[{id:'h1',category:'xp',text:'<b>'+r.fighters[1].name+'</b> advancement: WS +1',ts:t0+36e5},{id:'h2',category:'fighters',text:'<b>'+r.fighters[2].name+'</b> dead',ts:t0+2*864e5+36e5}];
    r.fighters[0].advancements=Array.from({length:8},()=>({id:crypto.randomUUID(),label:'x',xp:1}));r.fighters[1].games=Array.from({length:5},(_,i)=>({key:'k'+i,ts:t0+i,scenario:'S'}));save(true);
    navigateApp(warbandPath(r.id));await new Promise(z=>setTimeout(z,300));setGangTab('stats');await new Promise(z=>setTimeout(z,200));
    const split=document.querySelectorAll('.st-split-bar i').length;const tl=document.querySelectorAll('.st-tl-item').length;const evs=document.querySelectorAll('.st-tl-ev').length;
    statsTlFilter='dead';render('builder');const deadOnly=document.querySelectorAll('.st-tl-item').length;statsTlFilter='all';
    setGangTab('roster');await new Promise(z=>setTimeout(z,250));readToolsSync();const gold=!!document.querySelector('.owned-card.vet-gold .vet-badge'),silver=!!document.querySelector('.owned-card.vet-silver');
    openFighterCard(1);fighterTab='progression';progressionOpen=true;render('fighter');await new Promise(z=>setTimeout(z,150));
    const b=activeRoster().fighters[1].profile.slice();const btn=[...document.querySelectorAll('.progression-block button')].find(x=>/buyStatAdvancement/.test(x.getAttribute('onclick')||''));if(btn)btn.click();const flashed=!!document.querySelector('.fx-statup');
    const snap={scenario:'Bridge',date:'1/1',bands:[{rid:r.id,name:r.name,faction:'',color:'#6fb3e0',total:300,own:true,fighters:[],ooa:[],down:0,result:'win'}],hero:'',note:'held the bridge'};const card=playSummaryCardMarkup(snap,true);let canvasOk=false;try{canvasOk=playSummaryCanvas(snap).width===1080}catch(e){}
    return {split,tl,evs,deadOnly,gold,silver,clicked:!!btn,flashed,win:/gsum-win/.test(card)&&/VICTORY/.test(card)&&/held the bridge/.test(card),canvasOk}});
  expect(out.split>=1&&out.tl===2&&out.evs>=2&&out.deadOnly===1,'stats show the value split and a filterable timeline: '+JSON.stringify(out));
  expect(out.gold&&out.silver,'veterans get a silver or gold edge: '+JSON.stringify(out));
  expect(!out.clicked||out.flashed,'buying a characteristic flashes the cell: '+JSON.stringify(out));
  expect(out.win&&out.canvasOk,'a won game gets the victory card and image: '+JSON.stringify(out));
});
await test('[desktop] animated background: setting, mist and embers, off in Day mode',null,async page=>{
  const out=await page.evaluate(()=>{const n=()=>({fog:document.querySelectorAll('#ambientFx .amb-fog').length,ash:document.querySelectorAll('#ambientFx .amb-ash').length});
    setAmbientMode('both');const both=n();const tex=getComputedStyle(document.querySelector('#ambientFx .amb-fog.f1')).backgroundImage.includes('data:image/svg');const cont=!document.getElementById('ambientFx').classList.contains('amb-fog');setAmbientMode('fog');const fog=n();setAmbientMode('ash');const ash=n();setAmbientMode('off');const off=!document.getElementById('ambientFx');
    setAmbientMode('both');setSiteTheme('light');const light=!document.getElementById('ambientFx');setSiteTheme('dark');const back=!!document.getElementById('ambientFx');
    navigateApp('/account');return {tex,cont,both,fog,ash,off,light,back,select:!!document.querySelector('.ambient-select')}});
  expect(out.both.fog===3&&out.both.ash>=40&&out.fog.ash===0&&out.ash.fog===0&&out.off,'the setting picks mist, embers, both or none: '+JSON.stringify(out));
  expect(out.light&&out.back,'off in Day mode, back afterwards: '+JSON.stringify(out));
  expect(out.tex&&out.cont,'the mist texture is really applied and the container is not styled as a layer: '+JSON.stringify(out));
});
await test('[desktop] My Campaigns never stays on Loading: last known campaign shown, bounded retries',null,async page=>{
  let fail=true,n=0;await page.route(/\/api\/account\/campaigns/,r=>{n++;fail?r.fulfill({status:429,contentType:'application/json',body:'{"error":"RATE_LIMITED"}'}):r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({entries:[{campaignId:'lus',campaignName:'Lustrie',campaignColor:'#3fae6a',rosterId:'A',rosterName:'Band',leftAt:null}]})})});
  await page.route(/\/api\/campaigns(\?|$)/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({campaigns:[{id:'lus',name:'Lustrie',color:'#3fae6a',status:'published',memberCount:7}]})}));
  await page.evaluate(()=>{siteLanguage='en';localStorage.removeItem(CAMP_LS_MINE);localStorage.setItem(ACCOUNT_SESSION_KEY,JSON.stringify({id:'u-smoke',username:'smoke'}));const f=D.factions[0];state.rosters=[{id:'A',name:'Band',factionId:f.id,gold:100,fighters:[],campaignId:'lus',campaignName:'Lustrie',campaignColor:'#3fae6a'}];state.active='A';save(true);navigateApp('/campaigns')});
  await page.waitForTimeout(2500);const t1=await page.textContent('#content');const n1=n;
  fail=false;await page.evaluate(()=>myCampaignEntriesRetry());await page.waitForTimeout(1200);const t2=await page.textContent('#content');
  expect(!/Loading…/.test(t1)&&/Lustrie/.test(t1)&&/Retry/.test(t1),'a failed answer still shows the warband\'s campaign with a Retry button: '+t1.slice(0,200));
  expect(n1<=2,'no request storm after a failure: '+n1);
  expect(/UP TO DATE|Up to date/i.test(t2)&&!/Retry/.test(t2),'Retry loads the real list: '+t2.slice(0,200));
});
await test('[desktop] light catalog: book text loads on demand; heavy pictures are re-encoded smaller',null,async page=>{
  const out=await page.evaluate(async()=>{const before={split:!!D.bookSplit,pages:(D.pages||[]).length,text:(D.factions||[]).filter(f=>f.text).length};
    await ensureBook();const after={pages:(D.pages||[]).length,text:(D.factions||[]).filter(f=>f.text).length};
    const c=document.createElement('canvas');c.width=2000;c.height=1500;const g=c.getContext('2d');for(let i=0;i<4000;i++){g.fillStyle=`hsl(${i%360},70%,${30+i%40}%)`;g.fillRect(Math.random()*2000,Math.random()*1500,30,30)}
    const big=c.toDataURL('image/png');const obj={image:big};const done=await imgShrinkInPlace(obj,'image',IMG_MAX_FIGHTER);
    const dim=await new Promise(r=>{const im=new Image();im.onload=()=>r(Math.max(im.naturalWidth,im.naturalHeight));im.src=obj.image});
    return {before,after,done,smaller:obj.image.length<big.length,webp:obj.image.startsWith('data:image/webp'),dim}});
  expect(out.before.split&&out.before.pages===0&&out.before.text===0,'the startup catalog no longer carries the book text: '+JSON.stringify(out));
  expect(out.after.pages>100&&out.after.text>=10,'the book loads when asked: '+JSON.stringify(out));
  expect(out.done&&out.smaller&&out.webp&&out.dim<=640,'a heavy portrait is re-encoded to a 640px WebP: '+JSON.stringify(out));
});
await test('[desktop] undo 10 changes, warband check, two-device conflict, compact list, scenario rules, button names',null,async page=>{
  await seed(page);
  const out=await page.evaluate(async()=>{const r=activeRoster();const f=faction(r);const w=f.warriors[0];r.fighters.push({...w,profile:w.profile.slice(),baseProfile:w.profile.slice(),sourceName:w.name,wid:w.id,instance:'i1',name:'Hero',xp:0,equipmentSelected:[],skills:[],spells:[],advancements:[],injuries:[]});save(true);
    navigateApp(warbandPath('smoke'));await new Promise(z=>setTimeout(z,300));readToolsSync();
    // 9 undo: three separate changes, then go back two steps
    const g0=activeRoster().gold;for(const d of [10,20,30]){const rr=state.rosters.find(q=>q.id==='smoke');rr.gold=Number(rr.gold)+d;undoHist.get('smoke')&&undoHist.get('smoke').forEach(e=>e.ts-=5000);save(true)}
    const n=undoList('smoke').length;undoRestore('smoke',n-2);const gAfter=state.rosters.find(q=>q.id==='smoke').gold;
    // 8 check: break things, list them, fix one
    const rr=state.rosters.find(q=>q.id==='smoke');rr.gold=-5;rr.fighters[0].xp=-3;rr.fighters.push({...rr.fighters[0]});save(true);const issues=rosterIssues(activeRoster()).map(x=>x.k);openRosterCheck();const modal=document.getElementById('modalContent').innerHTML;rosterFixOne('gold-neg');const goldFixed=state.rosters.find(q=>q.id==='smoke').gold;closeModal();
    // 10 conflict: two copies edited on the same synced revision
    localStorage.removeItem(SYNC_CONFLICT_KEY);const base=JSON.parse(JSON.stringify(state.rosters.find(q=>q.id==='smoke')));const A={...base,name:'Phone edit',updatedSeq:7e13+1000,updatedAt:1000};const B={...base,name:'PC edit',updatedSeq:7e13+2000,updatedAt:2000};
    const merged=mergeAccountData({rosters:[A]},{rosters:[B]});const conflicts=syncConflicts().map(c=>c.name);const C={...base,name:'Old',updatedSeq:6e13+1,updatedAt:1};localStorage.removeItem(SYNC_CONFLICT_KEY);mergeAccountData({rosters:[C]},{rosters:[B]});const noFalse=syncConflicts().length;
    localStorage.removeItem(SYNC_CONFLICT_KEY);mergeAccountData({rosters:[A]},{rosters:[B]});readToolsSync();const banner=!!document.querySelector('.sync-conflict');localStorage.removeItem(SYNC_CONFLICT_KEY);
    // 14 scenario rules
    const term=referenceEntries('traits').find(t=>t.name&&t.name.length>4&&!/\(/.test(t.name));const sc={id:'sx',name:'X',bandsMin:2,bandsMax:2,battlefield:{terrainType:'Ruins',setupInstructions:'Warriors with '+term.name+' may move.'},victory:{major:'Win'}};const secs=scenarioSections(sc,true,'');
    // 17 names
    document.getElementById('content').insertAdjacentHTML('beforeend','<button id="a11yProbe" type="button">⋯</button>');a11ySweep();const lbl=document.getElementById('a11yProbe').getAttribute('aria-label');
    return {n,g0,gAfter,issues,modal:/Fix/.test(modal),goldFixed,winner:merged.rosters[0].name,conflicts,noFalse,banner,first:secs[0]?.title,hasTerm:secs[0]?.body.includes(term.name),lbl,listFn:typeof printWarbandList==='function'}});
  expect(out.n>=3&&out.gAfter===out.g0+10,'undo goes back to an earlier change: '+JSON.stringify(out));
  expect(out.issues.includes('gold-neg')&&out.issues.some(k=>k.startsWith('xp-'))&&out.issues.some(k=>k.startsWith('dup-'))&&out.modal&&out.goldFixed===0,'the warband check lists problems and fixes one when asked: '+JSON.stringify(out));
  expect(out.winner==='PC edit'&&out.conflicts.includes('Phone edit')&&out.noFalse===0&&out.banner,'a two-device edit keeps the newest and puts the other aside, without false alarms: '+JSON.stringify(out));
  expect(out.first==='Rules used'&&out.hasTerm,'a scenario starts with the rules it uses: '+JSON.stringify(out));
  expect(out.lbl&&out.listFn,'icon-only buttons get a name: '+JSON.stringify(out));
});
await test('[desktop] error reports sent only when turned on, big uploads compressed',null,async page=>{
  const sent=[];await page.route(/\/api\/errors$/,r=>{sent.push(JSON.parse(r.request().postData()||'{}'));r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})});
  let put=null;await page.route(/\/api\/account\/data$/,r=>{if(r.request().method()==='PUT'){put={enc:r.request().headers()['content-encoding'],len:(r.request().postDataBuffer()||[]).length};r.fulfill({status:200,contentType:'application/json',body:'{"revision":2}'})}else r.continue()});
  await page.evaluate(()=>{siteLanguage='en';localStorage.removeItem('mu_errlog_send');localStorage.removeItem('mu_errlog');errLogAdd('Smoke failure A','/x.js:1:1');errLogAdd('Smoke failure A','/x.js:1:1');openErrorLog()});
  await page.waitForTimeout(300);expect(sent.length===0,'nothing is sent while the option is off');
  expect(await page.isVisible('.errlog-send input'),'the error report offers the automatic sending option');
  await page.click('.errlog-send input');await page.waitForTimeout(800);
  expect(sent.length===1&&sent[0].errors?.[0]?.n===2&&/Smoke failure A/.test(sent[0].errors[0].msg),'turning it on sends the recorded errors once with their count: '+JSON.stringify(sent));
  expect(!JSON.stringify(sent).includes('u-smoke')&&!('user' in sent[0]),'the report carries no account');
  await page.evaluate(()=>errSendNow(false));await page.waitForTimeout(500);expect(sent.length===1,'an error already sent is not sent again');
  await page.evaluate(()=>{localStorage.removeItem('mu_errlog_send');localStorage.removeItem('mu_errlog');closeModal()});
  const big={rosters:[{id:'z',name:'Big',fighters:Array.from({length:60},(_,i)=>({name:'F'+i,notes:'lorem ipsum '.repeat(30)}))}]};
  await page.evaluate(d=>window.MordheimundaAPI.saveData(d,1),big);
  expect(put&&put.enc==='gzip'&&put.len<JSON.stringify(big).length/4,'a big account upload is sent gzip-compressed: '+JSON.stringify(put));
});
await test('[desktop] admin code is not part of the page and loads for the admin panel',null,async page=>{
  // (the test server counts as an admin session, which preloads the code after 1.5 s; players never do)
  const before=await page.evaluate(async()=>{const html=await (await fetch('/')).text();return {inPage:/admin(\.min)?\.js/.test(html)}});
  expect(!before.inPage,'the page itself never loads the admin code: '+JSON.stringify(before));
  await page.evaluate(()=>navigateApp('/admin')); // localhost counts as an admin session
  await page.waitForFunction(()=>typeof adminReal==='function',null,{timeout:8000});await page.waitForTimeout(400);
  const t=await page.textContent('#content');
  expect(!/Loading the admin panel|Chargement du panneau admin/.test(t)&&/admin-section-tabs|Gestion|Content|Site/.test(await page.innerHTML('#content')),'opening the panel loads its code and shows it: '+t.slice(0,160));
});
await test('[desktop] campaign map: admin places settlements and paths, players see residents',null,async page=>{
  await page.evaluate(()=>{siteLanguage='fr';const f=D.factions[0];state.rosters=[{id:'A',name:'Corbeaux',color:'#c0392b',factionId:f.id,gold:100,fighters:[],campaignId:'mapc',campaignResidence:'s1'}];state.active='A';save(true);
    campaignDetailCache.set('mapc',{id:'mapc',name:'Lustrie',color:'#3fae6a',status:'published',definition:{settlements:[{id:'s1',name:'Port A',excluded:[]},{id:'s2',name:'Port B',excluded:[]}]},members:[{rosterId:'A',rosterName:'Corbeaux'},{rosterId:'B',rosterName:'Lézards',stats:{residence:'s1',color:'#2e86de'}}]});
    window.MordheimundaAPI.adminUpdateCampaign=async(id,p)=>({campaign:{...campaignDetailCache.get(id),definition:p.definition}});window.MordheimundaAPI.adminCampaign=async()=>({campaign:campaignDetailCache.get('mapc')});
    navigateApp('/campaigns/mapc/locations')});
  await page.waitForTimeout(600);
  await page.evaluate(()=>ensureAdminCode());
  await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=800;c.height=500;const g=c.getContext('2d');g.fillStyle='#2a6';g.fillRect(0,0,800,500);openCampMapEditor('mapc');campMapEd.map.image=c.toDataURL('image/png');campMapEd.map.w=800;campMapEd.map.h=500;campMapEdRender()});
  const bb=await (await page.$('#cmapStage')).boundingBox();
  await page.click('.cmap-row:has-text("Port A")');await page.mouse.click(bb.x+bb.width*.25,bb.y+bb.height*.5);
  await page.click('.cmap-row:has-text("Port B")');await page.mouse.click(bb.x+bb.width*.75,bb.y+bb.height*.3);
  await page.evaluate(()=>campMapEdMode('paths'));
  for(const id of ['ss1','ss2']){const pb=await (await page.$(`[data-pin="${id}"] i`)).boundingBox();await page.mouse.click(pb.x+pb.width/2,pb.y+pb.height/2);await page.waitForTimeout(80)}
  await page.evaluate(()=>campMapEdSave());await page.waitForTimeout(500);
  const r=await page.evaluate(()=>{const m=campaignDetailCache.get('mapc').definition.map;return {pins:m?.pins?.length,paths:m?.paths?.length,x:m?.pins?.[0]?.x,shown:!!document.querySelector('.cmap-panel .cmap'),bands:document.querySelectorAll('.cmap-pin.mine .cmap-bands b').length}});
  expect(r.pins===2&&r.paths===1&&Math.abs(r.x-25)<2,'pins and the path are saved in % of the picture: '+JSON.stringify(r));
  expect(r.shown&&r.bands===2,'the Locations tab shows the map with both warbands at their residence, yours circled: '+JSON.stringify(r));
});
await test('[desktop] create warband: race banners with colour, motif, emblem; warband logo falls back to the race emblem',null,async page=>{
  await page.evaluate(()=>{siteLanguage='en';const R=RACE_CATEGORIES;D.factions.filter(f=>!f.packId).slice(0,2).forEach(f=>raceTagMap.set(f.id,R[0]));
    raceLooks={races:{[R[0]]:{color:'#3a7bd5',motif:'scales',tagline:'Test tagline',image:'data:image/png;base64,iVBORw0KGgo='}},factions:{},packs:{}};raceLooksLoaded=true;createSelectedRace=null;render('create')});
  await page.waitForTimeout(300);
  const r=await page.evaluate(()=>{const t=document.querySelector('.faction-choice.bn');return {cls:t?.className,style:t?.getAttribute('style'),kick:t?.querySelector('.bn-kick')?.textContent,img:!!t?.querySelector('img'),n:document.querySelectorAll('.faction-choice.bn').length}});
  expect(r.n===8&&/motif-scales/.test(r.cls)&&/--rc:#3a7bd5/.test(r.style)&&r.kick==='Test tagline'&&r.img,'race tiles use the colour, motif, tagline and emblem: '+JSON.stringify(r));
  await page.evaluate(()=>selectCreateRace(RACE_CATEGORIES[0]));await page.waitForTimeout(300);
  const f=await page.evaluate(()=>[...document.querySelectorAll('.faction-choice.bn')].map(t=>!!t.querySelector('img')));
  expect(f.length===2&&f.every(Boolean),'a warband without a logo shows its race emblem: '+JSON.stringify(f));
  await page.evaluate(()=>{raceLooks={races:{},factions:{},packs:{}};createSelectedRace=null});
});
await test('[desktop] create warband: sub-factions get a banner right after their mother warband and pick its supplement',null,async page=>{
  const r=await page.evaluate(async()=>{siteLanguage='en';const m=D.factions.find(f=>!f.packId&&availableSupplementsForFaction(f.id).length);if(!m)return {skip:true};raceTagMap.set(m.id,'Undead');render('create');await new Promise(z=>setTimeout(z,200));selectCreateRace('Undead');await new Promise(z=>setTimeout(z,200));
    const tiles=[...document.querySelectorAll('.faction-choice.bn')];const i=tiles.findIndex(t=>t.dataset.faction===m.id&&!t.dataset.supp);const sub=tiles[i+1];
    sub?.click();await new Promise(z=>setTimeout(z,100));
    return {after:!!sub&&sub.dataset.faction===m.id&&!!sub.dataset.supp,kick:sub?.querySelector('.bn-kick')?.textContent||'',supp:selectedSupplements(),fac:selectedFaction,mother:m.id,sel:sub?.classList.contains('selected')}});
  if(r.skip)return;
  expect(r.after&&/Sub-faction of/.test(r.kick),'the sub-faction tile comes right after its mother warband and says so: '+JSON.stringify(r));
  expect(r.fac===r.mother&&r.supp.length===1&&r.sel,'picking it selects the mother warband with that supplement ticked: '+JSON.stringify(r));
  await page.evaluate(()=>{createSelectedRace=null});
});
await test('[desktop] a fighter with a portrait keeps its role emblem next to the name',null,async page=>{
  const r=await page.evaluate(()=>{const f=D.factions[0];const mk=(w,i,img)=>({...w,profile:w.profile.slice(),baseProfile:w.profile.slice(),sourceName:w.name,wid:w.id,instance:'e'+i,name:'Emb'+i,equipmentSelected:[],skills:[],spells:[],advancements:[],injuries:[],image:img});
    state.rosters=[{id:'EM',name:'Emb',factionId:f.id,gold:100,fighters:[mk(f.warriors[0],0,'data:image/png;base64,iVBORw0KGgo='),mk(f.warriors[1],1,'')]}];state.active='EM';
    const a=ownedFighterCard(state.rosters[0].fighters[0],0,f),b=ownedFighterCard(state.rosters[0].fighters[1],1,f);
    return {withImg:/name-emblem/.test(a),without:/name-emblem/.test(b)}});
  expect(r.withImg&&!r.without,'emblem before the name only when a portrait replaced it: '+JSON.stringify(r));
});
await test('[desktop] parchment version of a fighter sheet (optional view, printable)',null,async page=>{
  const r=await page.evaluate(()=>{siteLanguage='en';const f=D.factions[0];const w=f.warriors[f.warriors.length-1];state.rosters=[{id:'PA',name:'Ravens',factionId:f.id,gold:0,fighters:[{...w,profile:w.profile.slice(),baseProfile:w.profile.slice(),sourceName:w.name,wid:w.id,instance:'p1',name:'Parch',xp:7,equipmentSelected:[{name:'Sword',price:10}],skills:['Resilient'],spells:[],advancements:[],injuries:[]}]}];state.active='PA';editingIndex=0;openParchmentSheet();
    const m=document.querySelector('#modalContent .parch');return {ok:!!m,txt:m?.textContent||'',print:!!document.querySelector('#modalContent [onclick="printParchmentSheet()"]')}});
  expect(r.ok&&/Parch/.test(r.txt)&&/7 XP/.test(r.txt)&&r.print,'the parchment sheet opens with the fighter and a print button: '+JSON.stringify(r).slice(0,200));
  await page.evaluate(()=>closeModal());
});
await test('[desktop] book pages added: characteristics and scenario rules in Rules, founding a warband in Rules: Warbands',null,async page=>{
  const r=await page.evaluate(async()=>{await ensureRulesBook();const ids=RULES_BOOK.map(s=>s.id);const grp=RULES_NAV_GROUPS.flatMap(g=>g.ids);
    siteLanguage='en';navigateApp('/rules/warbands');setWarbandsRulesCategory('founding');await new Promise(z=>setTimeout(z,300));
    return {has:['characteristics','founding','scenariorules'].every(i=>ids.includes(i)),nav:grp.includes('characteristics')&&grp.includes('scenariorules')&&!grp.includes('founding'),wb:/Starting a warband/i.test(document.getElementById('content').textContent),side:/Founding a Warband/.test(document.getElementById('content').textContent)}});
  expect(r.has&&r.nav&&r.wb&&r.side,'new book pages are in place: '+JSON.stringify(r));
  await page.evaluate(()=>setWarbandsRulesCategory('directory'));
});
await test('[desktop] site search covers Dramatis Personae, scenario text, campaign pages, pages and custom content',null,async page=>{
  const out=await page.evaluate(()=>{
    state.customFighters=[{customFighterId:'dp-s',name:'Zorvak the Unbound',type:'Hired Sword',hiredSword:true,dramatis:true,cost:80,upkeep:0,max:1,profile:[5,4,4,4,3,2,4,1,8,7,7,7],ruleNames:[],skillAccess:{},magicAccess:{},defaultEquipment:[],hsChoices:[],hsFactions:[],hsExcluded:[],dpRules:[{name:'Gloomwalker',text:'Ignores difficult ground.'}]}];
    state.customSpecialRules=[{id:'cr1',name:'Quorlax frenzy',text:'x'}];
    SCENARIOS_CACHE=[...(SCENARIOS_CACHE||[]),{id:'scn-x',name:'Plain Fight',summary:'',specialRules:'The Bloodmoonrise lasts until turn 4.'}];
    campaignsCache=[...(campaignsCache||[]),{id:'camp-x',name:'Test Campaign',status:'published',definition:{pages:[{id:'p1',title:'2. Volcanic Vents',text:'Each turn roll for Ashfall.'}],artifacts:[{name:'Crown of Xylmar',text:'+1 Leadership'}]}}];
    const has=(q,key,title)=>searchRun(q).some(g=>(!key||g.key===key)&&g.items.some(i=>!title||i.title===title));
    return {dp:has('zorvak','hiredSwords','Zorvak the Unbound'),dpRule:has('gloomwalker','hiredSwords'),scn:has('bloodmoonrise','scenarios','Plain Fight'),camp:has('ashfall','campaigns','2. Volcanic Vents'),art:has('xylmar','campaigns','Crown of Xylmar'),page:has('armurerie','pages')||has('armory','pages'),mine:has('quorlax','custom')};
  });
  expect(Object.values(out).every(Boolean),'search misses some content: '+JSON.stringify(out));
});
await test('[desktop] item penalties: stat lists, clause-level conditions, Strength exemption',null,async page=>{
  const out=await page.evaluate(()=>{const t='Encumbered: Due to the extra weight and restricted movement of this armour, the warrior’s Ballistic Skill and Initiative are reduced by 1, and their Movement by 1" when making a Charge action. Warriors with Strength 5 or higher ignore these penalties.';
    const sh=r=>r.map(b=>`${b.stat}${b.delta}${b.conditional?'c':''}`).sort().join(' ');
    return {s3:sh(detectStatBonusesInText(t,{profile:[4,3,3,3,3,1,3,1,7]})),s5:sh(detectStatBonusesInText(t,{profile:[4,3,3,5,3,1,3,1,7]})),charge:sh(detectStatBonusesInText('+1 Strength when charging.'))}});
  expect(out.s3==='BS-1 I-1 M-1c','Strength 3 should get BS-1 and I-1 for good, Movement -1 only when charging: '+out.s3);
  expect(out.s5==='','Strength 5 should ignore every penalty: '+out.s5);
  expect(out.charge==='S1c','a plain conditional bonus changed: '+out.charge);
});
await test('[desktop] admin page and its sections render',null,async page=>{
  await page.evaluate(()=>{window.isAdminSession=()=>true;navigateApp('/admin')});await page.waitForTimeout(600);
  for(const cat of ['quests','trophies','backup','scenarios']){await page.evaluate(c=>{adminOpenCategory=c;render('admin')},cat);await page.waitForTimeout(300);
    expect((await page.textContent('#content')).length>200,`admin section ${cat} is empty`)}
});

await browser.close();
for(const r of results)console.log(r[0]==='PASS'?'✔':'✘',r[1],r[2]?'\n    → '+r[2]:'');
console.log(`\n${results.length-failed} passed, ${failed} failed`);
process.exit(failed?1:0);
