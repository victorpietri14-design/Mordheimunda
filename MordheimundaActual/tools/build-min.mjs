// Builds the minified files the site serves: assets/app.min.js and
// assets/styles.min.css, from assets/app.js and assets/styles.css.
// Run after editing either source:  node tools/build-min.mjs
// Needs terser and lightningcss (npm i --no-save terser lightningcss), or
// TOOLS_DIR pointing at a folder whose node_modules has them.
// CI runs it with --check and fails when the committed files are stale.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const req=createRequire(path.join(process.env.TOOLS_DIR||root,'package.json'));
const { minify }=req('terser');const { transform }=req('lightningcss');
const check=process.argv.includes('--check');
const js=fs.readFileSync(path.join(root,'assets/app.js'),'utf8');
// top-level names stay as they are: inline onclick="…" handlers call them by name
const out=await minify({'app.js':js},{ecma:2020,toplevel:false,keep_fnames:true,compress:{passes:1,drop_debugger:false},mangle:{toplevel:false},format:{comments:false}});
const css=fs.readFileSync(path.join(root,'assets/styles.css'));
const cssOut=transform({filename:'styles.css',code:css,minify:true}).code.toString();
const files={'assets/app.min.js':out.code+'\n','assets/styles.min.css':cssOut};
let stale=[];
for(const [f,content] of Object.entries(files)){const p=path.join(root,f);if(check){const cur=fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';if(cur!==content)stale.push(f)}else fs.writeFileSync(p,content)}
if(check){if(stale.length){console.error('Stale minified files, run: node tools/build-min.mjs\n  '+stale.join('\n  '));process.exit(1)}console.log('Minified files are up to date.')}
else console.log(`app.js ${js.length} -> ${out.code.length} · styles.css ${css.length} -> ${cssOut.length}`);
