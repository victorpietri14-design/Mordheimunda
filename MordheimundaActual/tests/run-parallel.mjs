// Runs tests/smoke.mjs in N parallel shards and merges the results.
// Usage: node tests/run-parallel.mjs [baseUrl] [shards=3]
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const base=process.argv[2]||'http://localhost:8765';const n=Math.max(1,Number(process.argv[3]||3));
const t0=Date.now();
const runs=Array.from({length:n},(_,k)=>new Promise(res=>{const p=spawn(process.execPath,[path.join(here,'smoke.mjs'),base],{env:{...process.env,SHARD:`${k}/${n}`}});let out='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>out+=d);p.on('close',code=>res({k,code,out}))}));
const all=await Promise.all(runs);let pass=0,fail=0;
for(const r of all){process.stdout.write(r.out.replace(/^\d+ passed, \d+ failed\s*$/m,''));const m=r.out.match(/(\d+) passed, (\d+) failed/);if(m){pass+=Number(m[1]);fail+=Number(m[2])}else fail++}
console.log(`\n${pass} passed, ${fail} failed · ${n} shards · ${Math.round((Date.now()-t0)/1000)}s`);
process.exit(fail||all.some(r=>r.code)?1:0);
