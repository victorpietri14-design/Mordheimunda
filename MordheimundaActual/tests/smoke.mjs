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
  const ctx=await browser.newContext(viewport==='mobile'?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1300,height:900}});
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
    expect(await page.isVisible('text=Smoke Test Band'),'warband page did not open');
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
await test('[desktop] admin page and its sections render',null,async page=>{
  await page.evaluate(()=>{window.isAdminSession=()=>true;navigateApp('/admin')});await page.waitForTimeout(600);
  for(const cat of ['quests','trophies','backup','scenarios']){await page.evaluate(c=>{adminOpenCategory=c;render('admin')},cat);await page.waitForTimeout(300);
    expect((await page.textContent('#content')).length>200,`admin section ${cat} is empty`)}
});

await browser.close();
for(const r of results)console.log(r[0]==='PASS'?'✔':'✘',r[1],r[2]?'\n    → '+r[2]:'');
console.log(`\n${results.length-failed} passed, ${failed} failed`);
process.exit(failed?1:0);
