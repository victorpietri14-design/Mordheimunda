// Lists top-level functions in assets/app.js and assets/admin.js that nothing
// calls any more: no call, no reference, no mention in an onclick string,
// in another script, in index.html, the data files or the smoke tests. CI fails when the list
// grows beyond tools/dead-allowed.json, so new dead code is caught when it
// appears. Run: node tools/check-dead.mjs [--update]
// Needs acorn (TOOLS_DIR pointing at a folder whose node_modules has it,
// like build-min.mjs).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const req=createRequire(path.join(process.env.TOOLS_DIR||root,'package.json'));
const acorn=req('acorn');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const files=['assets/app.js','assets/admin.js'];
const others=['index.html','tests/smoke.mjs',...fs.readdirSync(path.join(root,'assets/core')).map(f=>'assets/core/'+f),...fs.readdirSync(path.join(root,'data'),{recursive:true}).filter(f=>/\.js$/.test(f)&&!/catalog-book|rules-book/.test(f)).map(f=>'data/'+f)];
const words=new Map();const count=t=>{for(const m of t.matchAll(/[A-Za-z_$][\w$]*/g))words.set(m[0],(words.get(m[0])||0)+1)};
for(const f of [...files,...others])count(read(f));
const dead=[];
for(const f of files){const src=read(f);const ast=acorn.parse(src,{ecmaVersion:2022,sourceType:'script'});
  for(const n of ast.body)if(n.type==='FunctionDeclaration'){const k=n.id.name;
    // its own declaration counts once; a recursive call inside itself doesn't make it used
    const own=(src.slice(n.start,n.end).match(new RegExp('\\b'+k.replace(/\$/g,'\\$')+'\\b','g'))||[]).length;
    if((words.get(k)||0)-own<=0)dead.push(k)}}
dead.sort();
const allowedPath=path.join(root,'tools/dead-allowed.json');
if(process.argv.includes('--update')){fs.writeFileSync(allowedPath,JSON.stringify(dead,null,1)+'\n');console.log(`${dead.length} unused functions recorded in tools/dead-allowed.json`);process.exit(0)}
const allowed=new Set(fs.existsSync(allowedPath)?JSON.parse(fs.readFileSync(allowedPath,'utf8')):[]);
const fresh=dead.filter(k=>!allowed.has(k));
if(fresh.length){console.error('New unused functions (delete them, or run node tools/check-dead.mjs --update if they are kept on purpose):\n  '+fresh.join('\n  '));process.exit(1)}
console.log(`No new unused function (${dead.length} known).`);
