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
  await page.waitForTimeout(800);
  return {ctx,page,errors};
}
async function test(name,viewport,fn){
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
    const card=x2?ownedFighterCard(x2,0,f):'';const rulesPage=hiredSwordsRulesPageMarkup();
    return {listed,hired:!!x,dramatis:!!x2?.dramatis,xp:x2?.xp,canXp:fighterCanEarnXp(x2),card:/Wanderer/.test(card),catalogue:!!referenceFind('special','Wanderer'),rulesPage:/Wanderer/.test(rulesPage)&&/DRAMATIS PERSONAE/.test(rulesPage),progress:/Dramatis Personae/.test(progressionStatsMarkup(x2))}});
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
    const sum=hiredSwordsRulesPageMarkup();
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
await test('[desktop] Ogre rules: Slow Witted doubles XP costs, Difficult Customers -3 Rare, Cannibals Hired Sword ban',null,async page=>{
  const out=await page.evaluate(()=>{state.customSpecialRules=[{id:'sw1',name:'Slow Witted',text:'Ogres only improve at half the rate of everyone else. They earn half the usual number of experience points (to a minimum of 1).'}];try{__refEntriesCache=null}catch(e){}
    const f=D.factions.find(x=>!x.__official&&x.warriors?.some(w=>w.type==='Leader'));const L=f.warriors.find(w=>w.type==='Leader');const keep=f.specialRules;
    f.specialRules=[...(keep||[]),{name:'Difficult Customers',text:'Ogre Heroes suffer -3 when rolling to find Rare items that are not exclusively available to Ogres.'},{name:'Cannibals',text:'An Ogre warband may never hire any Hired Swords, except for Halflings (Scout, Thief, etc.) and the Ogre Bodyguard, or unless stated otherwise.'}];
    const ogre={...JSON.parse(JSON.stringify(L)),wid:L.id,instance:'o1',ruleNames:[...(L.ruleNames||[]),'Slow Witted'],extraRuleNames:['Slow Witted'],equipmentSelected:[],status:{}};const human={...JSON.parse(JSON.stringify(L)),wid:L.id,instance:'h1',equipmentSelected:[],status:{}};
    state.rosters=[{id:'og',name:'OG',factionId:f.id,gold:0,fighters:[ogre,human]}];state.active='og';const r=activeRoster();
    const e=ADVANCEMENT_MAIN.find(a=>a.kind!=='veteranPromote'&&Number(a.xp)>0);const slow=advancementCost(r.fighters[0],e),normal=advancementCost(r.fighters[1],e);
    const rare=bandRareSearchMod(r).mod;const hs=n=>hiredSwordAvailableFor({name:n,race:''},f,r);const ban={body:hs('Ogre Bodyguard'),half:hs('Halfling Scout'),pit:hs('Pit Fighter')};
    f.specialRules=keep;return {slow,normal,rare,ban}});
  expect(out.slow===out.normal*2,'Slow Witted must double advancement costs: '+JSON.stringify(out));
  expect(out.rare===-3,'Difficult Customers must give -3 to Rare searches: '+JSON.stringify(out));
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
