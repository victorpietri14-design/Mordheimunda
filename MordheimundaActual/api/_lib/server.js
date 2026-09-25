import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const publicDir=path.resolve(__dirname,'../../');
const app=express();
const isProd=config.nodeEnv==='production';
// Local-dev convenience: on your own machine (never on Vercel — VERCEL is
// always set to '1' there, in prod AND in preview deployments — and never
// when NODE_ENV=production), every logged-in account is treated as admin.
// This never reaches the live site: both guards would have to be false at
// once, which only happens running `npm start`/`node api/_lib/server.js`
// directly on a machine with no VERCEL env var set.
const localDevAdmin=!isProd && process.env.VERCEL!=='1';
const pool=config.databaseUrl?new Pool({connectionString:config.databaseUrl,ssl:config.databaseSsl?{rejectUnauthorized:false}:undefined,max:10,idleTimeoutMillis:30000}):null;

// Self-healing schema: db/schema.sql is the source of truth, but historically
// it had to be re-run by hand against the live database whenever a new table
// was added (e.g. rule_overrides), and forgetting that step is exactly what
// produced 500s like "relation rule_overrides does not exist" when an admin
// tried to edit a rule. schema.sql is fully idempotent (CREATE TABLE IF NOT
// EXISTS / additive ALTERs only), so it's safe to replay it on every boot —
// this keeps the live database in sync automatically, with no manual step,
// and prevents this whole class of bug for any future table/column too.
async function ensureSchema(){
  if(!pool)return;
  try{
    const schemaPath=path.join(publicDir,'server','db','schema.sql');
    const sql=fs.readFileSync(schemaPath,'utf8');
    await pool.query(sql);
    console.log('Database schema is up to date.');
  }catch(e){
    console.error('Schema sync failed (continuing — existing tables are unaffected):',e.message);
  }
}
await ensureSchema();
const cookie={httpOnly:true,secure:isProd,sameSite:'lax',path:'/'};
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
const token=()=>crypto.randomBytes(32).toString('base64url');
const pub=u=>({id:u.id,username:u.username,email:u.email||null,emailVerified:!!u.email_verified_at,isAdmin:localDevAdmin||!!u.is_admin});
const safeCompare=async(password,hashValue)=>bcrypt.compare(password,hashValue);
const isBootstrapAdminEmail=email=>!!email&&config.adminEmails.includes(String(email).toLowerCase());
const slugify=s=>String(s||'').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);

app.disable('x-powered-by');
app.set('trust proxy',config.trustProxy);
app.use(helmet({contentSecurityPolicy:false,referrerPolicy:{policy:'no-referrer'}}));
app.use(cors({origin:config.clientOrigin,credentials:true}));
app.use(cookieParser());
app.use(express.json({limit:'6mb'}));
app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next()});
app.use('/api/auth/',rateLimit({windowMs:15*60*1000,max:30,standardHeaders:true,legacyHeaders:false,message:{error:'RATE_LIMITED'}}));
app.use('/api/account/',rateLimit({windowMs:60*1000,max:120,standardHeaders:true,legacyHeaders:false,message:{error:'RATE_LIMITED'}}));
app.use('/api/admin/',rateLimit({windowMs:60*1000,max:60,standardHeaders:true,legacyHeaders:false,message:{error:'RATE_LIMITED'}}));

const requireDb=(req,res,next)=>pool?next():res.status(503).json({error:'DATABASE_NOT_CONFIGURED'});
const requireSameOrigin=(req,res,next)=>{
  if(!isProd)return next();
  const origin=req.get('origin');
  if(origin && origin!==config.clientOrigin)return res.status(403).json({error:'BAD_ORIGIN'});
  next();
};

async function sendMail({to,subject,text}){
  if(!config.smtpHost){
    if(isProd)throw Error('SMTP_NOT_CONFIGURED');
    console.log(`[DEV EMAIL]\nTo: ${to}\nSubject: ${subject}\n${text}`);return;
  }
  const {default:nodemailer}=await import('nodemailer');
  const transporter=nodemailer.createTransport({host:config.smtpHost,port:config.smtpPort,secure:config.smtpSecure,auth:config.smtpUser?{user:config.smtpUser,pass:config.smtpPassword}:undefined});
  await transporter.sendMail({from:config.smtpFrom,to,subject,text});
}

async function auth(req,res,next){
  try{
    const raw=req.cookies.mordheimunda_session;
    if(!raw)return res.status(401).json({error:'NOT_AUTHENTICATED'});
    const q=await pool.query(`SELECT s.id AS session_id,s.user_id,u.username,u.email,u.email_verified_at,u.is_admin
      FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at>NOW()`,[hash(raw)]);
    if(!q.rows[0]){res.clearCookie('mordheimunda_session',cookie);return res.status(401).json({error:'NOT_AUTHENTICATED'});}
    req.user=q.rows[0];
    // Bootstrap admin(s) from ADMIN_EMAILS stay admin even if the DB flag was
    // ever reset by hand; this keeps the env var authoritative for them.
    if(!req.user.is_admin && isBootstrapAdminEmail(req.user.email)){
      await pool.query('UPDATE users SET is_admin=true WHERE id=$1',[req.user.user_id]);
      req.user.is_admin=true;
    }
    // See localDevAdmin above: local-only, never true on Vercel/production.
    if(localDevAdmin)req.user.is_admin=true;
    next();
  }catch(e){next(e)}
}
const requireAdmin=(req,res,next)=>req.user?.is_admin?next():res.status(403).json({error:'ADMIN_REQUIRED'});

app.get('/api/health',async(_req,res)=>{
  let db=false;
  if(pool){try{await pool.query('SELECT 1');db=true}catch{}}
  res.status(db||!pool?200:503).json({ok:!!(db||!pool),service:'mordheimunda-account-api',database:db,email:!!config.smtpHost,version:config.appVersion});
});

app.post('/api/auth/register',requireDb,requireSameOrigin,async(req,res,next)=>{
  const username=String(req.body?.username||'').trim();
  const email=String(req.body?.email||'').trim().toLowerCase()||null;
  const password=String(req.body?.password||'');
  if(!/^[A-Za-z0-9_-]{3,24}$/.test(username))return res.status(400).json({error:'INVALID_USERNAME'});
  // Email is required (not just for recovery): it's also how an account gets
  // matched against ADMIN_EMAILS and how an existing admin promotes another
  // account later, so an account with no email can never become admin.
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'INVALID_EMAIL'});
  if(password.length<10||password.length>128)return res.status(400).json({error:'INVALID_PASSWORD'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const ex=await client.query('SELECT 1 FROM users WHERE lower(username)=lower($1) OR ($2::text IS NOT NULL AND lower(email)=lower($2)) LIMIT 1',[username,email]);
    if(ex.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'ACCOUNT_EXISTS'});}
    const id=crypto.randomUUID(),ph=await bcrypt.hash(password,12),isAdmin=isBootstrapAdminEmail(email);
    const q=await client.query('INSERT INTO users(id,username,email,password_hash,is_admin) VALUES($1,$2,$3,$4,$5) RETURNING id,username,email,email_verified_at,is_admin',[id,username,email,ph,isAdmin]);
    await client.query('INSERT INTO user_data(user_id,schema_version,payload,revision) VALUES($1,4,$2,1)',[id,JSON.stringify({rosters:[],active:null})]);
    await client.query('COMMIT');
    const t=token();
    await client.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+($4::int*INTERVAL '1 day'))",[crypto.randomUUID(),id,hash(t),config.sessionDays]);
    res.cookie('mordheimunda_session',t,{...cookie,maxAge:config.sessionDays*86400000});
    res.status(201).json({user:pub(q.rows[0])});
  }catch(e){try{await client.query('ROLLBACK')}catch{};next(e)}finally{client.release()}
});

app.post('/api/auth/login',requireDb,requireSameOrigin,async(req,res,next)=>{
  try{
    const login=String(req.body?.login||'').trim(),password=String(req.body?.password||'');
    const q=await pool.query("SELECT id,username,email,password_hash,email_verified_at,is_admin FROM users WHERE lower(username)=lower($1) OR lower(coalesce(email,''))=lower($1) LIMIT 1",[login]);
    if(!q.rows[0]||!(await safeCompare(password,q.rows[0].password_hash)))return res.status(401).json({error:'INVALID_CREDENTIALS'});
    const u=q.rows[0];
    if(!u.is_admin && isBootstrapAdminEmail(u.email)){await pool.query('UPDATE users SET is_admin=true WHERE id=$1',[u.id]);u.is_admin=true;}
    const t=token();
    await pool.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+($4::int*INTERVAL '1 day'))",[crypto.randomUUID(),u.id,hash(t),config.sessionDays]);
    await pool.query('DELETE FROM sessions WHERE user_id=$1 AND expires_at<=NOW()',[u.id]);
    res.cookie('mordheimunda_session',t,{...cookie,maxAge:config.sessionDays*86400000});
    res.json({user:pub(u)});
  }catch(e){next(e)}
});

app.post('/api/auth/logout',requireDb,requireSameOrigin,async(req,res,next)=>{try{const t=req.cookies.mordheimunda_session;if(t)await pool.query('DELETE FROM sessions WHERE token_hash=$1',[hash(t)]);res.clearCookie('mordheimunda_session',cookie);res.json({ok:true})}catch(e){next(e)}});

// Local-dev only (see localDevAdmin above): signs in as a standing
// "local-admin" account — created on first call if it doesn't exist yet —
// instead of making you go through signup/login by hand on your own
// machine. Refuses outright on Vercel/production, same guard as
// localDevAdmin itself, so this can never be reached from the live site.
app.post('/api/auth/dev-admin',requireDb,requireSameOrigin,async(req,res,next)=>{
  if(!localDevAdmin)return res.status(403).json({error:'ADMIN_REQUIRED'});
  try{
    const username='local-admin',email='local-admin@mordheimunda.local';
    let u=(await pool.query('SELECT id,username,email,email_verified_at,is_admin FROM users WHERE lower(username)=lower($1)',[username])).rows[0];
    if(!u){
      const id=crypto.randomUUID(),ph=await bcrypt.hash(crypto.randomBytes(24).toString('hex'),12);
      u=(await pool.query('INSERT INTO users(id,username,email,password_hash,is_admin) VALUES($1,$2,$3,$4,true) RETURNING id,username,email,email_verified_at,is_admin',[id,username,email,ph])).rows[0];
      await pool.query('INSERT INTO user_data(user_id,schema_version,payload,revision) VALUES($1,4,$2,1)',[id,JSON.stringify({rosters:[],active:null})]);
    }
    const t=token();
    await pool.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+($4::int*INTERVAL '1 day'))",[crypto.randomUUID(),u.id,hash(t),config.sessionDays]);
    res.cookie('mordheimunda_session',t,{...cookie,maxAge:config.sessionDays*86400000});
    res.json({user:pub(u)});
  }catch(e){next(e)}
});

app.post('/api/auth/forgot-password',requireDb,requireSameOrigin,async(req,res,next)=>{
  const email=String(req.body?.email||'').trim().toLowerCase();
  try{
    const q=await pool.query('SELECT id,username,email FROM users WHERE lower(email)=lower($1) LIMIT 1',[email]);
    if(q.rows[0]){
      await pool.query("UPDATE recovery_tokens SET used_at=NOW() WHERE user_id=$1 AND kind='password' AND used_at IS NULL",[q.rows[0].id]);
      const t=token();
      await pool.query("INSERT INTO recovery_tokens(id,user_id,token_hash,kind,expires_at) VALUES($1,$2,$3,'password',NOW()+INTERVAL '1 hour')",[crypto.randomUUID(),q.rows[0].id,hash(t)]);
      await sendMail({to:q.rows[0].email,subject:'Mordheimunda — Réinitialisation du mot de passe',text:`Bonjour ${q.rows[0].username},\n\nRéinitialisez votre mot de passe : ${config.clientOrigin.replace(/\/$/,'')}/?reset=${encodeURIComponent(t)}\n\nLe lien expire dans 1 heure.`});
    }
    res.json({ok:true});
  }catch(e){next(e)}
});

app.post('/api/auth/reset-password',requireDb,requireSameOrigin,async(req,res,next)=>{
  const t=String(req.body?.token||''),password=String(req.body?.password||'');
  if(t.length<20||password.length<10||password.length>128)return res.status(400).json({error:'INVALID_RESET'});
  try{
    const q=await pool.query("SELECT id,user_id FROM recovery_tokens WHERE token_hash=$1 AND kind='password' AND used_at IS NULL AND expires_at>NOW() LIMIT 1",[hash(t)]);
    if(!q.rows[0])return res.status(400).json({error:'INVALID_RESET'});
    const client=await pool.connect();
    try{await client.query('BEGIN');await client.query('UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2',[await bcrypt.hash(password,12),q.rows[0].user_id]);await client.query('UPDATE recovery_tokens SET used_at=NOW() WHERE id=$1',[q.rows[0].id]);await client.query('DELETE FROM sessions WHERE user_id=$1',[q.rows[0].user_id]);await client.query('COMMIT')}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
    res.json({ok:true});
  }catch(e){next(e)}
});

app.post('/api/auth/forgot-username',requireDb,requireSameOrigin,async(req,res,next)=>{const email=String(req.body?.email||'').trim().toLowerCase();try{const q=await pool.query('SELECT username,email FROM users WHERE lower(email)=lower($1) LIMIT 1',[email]);if(q.rows[0])await sendMail({to:q.rows[0].email,subject:'Mordheimunda — Nom d’utilisateur',text:`Votre nom d’utilisateur Mordheimunda est : ${q.rows[0].username}`});res.json({ok:true})}catch(e){next(e)}});

app.get('/api/account/me',requireDb,auth,(req,res)=>res.json({user:pub(req.user)}));
app.post('/api/account/change-password',requireDb,requireSameOrigin,auth,async(req,res,next)=>{const cur=String(req.body?.currentPassword||''),nextPassword=String(req.body?.newPassword||'');if(nextPassword.length<10||nextPassword.length>128)return res.status(400).json({error:'INVALID_PASSWORD'});try{const q=await pool.query('SELECT password_hash FROM users WHERE id=$1',[req.user.user_id]);if(!q.rows[0]||!(await safeCompare(cur,q.rows[0].password_hash)))return res.status(401).json({error:'INVALID_CREDENTIALS'});await pool.query('UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2',[await bcrypt.hash(nextPassword,12),req.user.user_id]);await pool.query('DELETE FROM sessions WHERE user_id=$1 AND id<>$2',[req.user.user_id,req.user.session_id]);res.json({ok:true})}catch(e){next(e)}});

// `revision` is BIGINT in Postgres, and node-postgres returns int8/BIGINT
// columns as JS *strings* by default (to avoid silent precision loss above
// 2^53) — every plain `SELECT revision` or `RETURNING revision` handed that
// string straight to the client. The client's own revision checks are all
// `Number.isInteger(x)`, which is false for a string, so `state.meta.
// cloudRevision` ended up a string after the very first successful save;
// every later save then computed expectedRevision as null and — since a
// null expectedRevision now correctly refuses to touch an existing row
// instead of blindly overwriting it — got permanently, deterministically
// stuck in a 409 loop that no amount of retrying could ever resolve.
// Reproduced live and confirmed: this is the root cause of the persistent
// "flushCloudSave 409 DATA_CONFLICT" that kept recurring. Casting to
// integer here means every revision this API ever returns is a genuine JS
// number, which is more than enough range for a per-account save counter.
const toInt=v=>{const n=typeof v==='string'?parseInt(v,10):v;return Number.isInteger(n)?n:null;};
app.get('/api/account/data',requireDb,auth,async(req,res,next)=>{try{const q=await pool.query('SELECT schema_version,payload,revision::int AS revision,updated_at FROM user_data WHERE user_id=$1',[req.user.user_id]);res.json(q.rows[0]||{schema_version:4,payload:{rosters:[],active:null},revision:1,updated_at:null})}catch(e){next(e)}});
app.get('/api/account/data/revision',requireDb,auth,async(req,res,next)=>{try{const q=await pool.query('SELECT revision::int AS revision,updated_at FROM user_data WHERE user_id=$1',[req.user.user_id]);res.json(q.rows[0]||{revision:1,updated_at:null})}catch(e){next(e)}});
app.put('/api/account/data',requireDb,requireSameOrigin,auth,async(req,res,next)=>{
  const data=req.body?.data;if(!data||typeof data!=='object'||Array.isArray(data))return res.status(400).json({error:'INVALID_DATA'});
  const payload=JSON.stringify(data);if(Buffer.byteLength(payload)>5*1024*1024)return res.status(413).json({error:'DATA_TOO_LARGE'});
  try{
    // Accept a numeric string too (defense in depth: an already-cached old
    // client, or any future BIGINT-as-string slip, should self-heal rather
    // than being permanently locked into the null-revision path).
    const expectedRevision=toInt(req.body?.expectedRevision);
    // IMPORTANT: a null expectedRevision must NEVER blindly overwrite a row
    // that already exists server-side. It used to (ON CONFLICT DO UPDATE,
    // no revision check at all), which meant any client that didn't yet
    // know its current revision — a device linking to an account for the
    // first time, or a save that raced ahead of the initial revision fetch
    // on page load — would silently clobber whatever another device had
    // already saved, with no merge and no 409. That is the exact shape of
    // "two devices each keep only their own custom content" reports: the
    // last blind null-revision write erases the other device's exclusive
    // data outright. Now a null expectedRevision is only ever allowed to
    // INSERT a brand-new row (DO NOTHING on conflict); if the row already
    // exists this returns 409 like any other stale write, which routes the
    // client through its existing merge-then-retry conflict path instead
    // of an overwrite.
    const q=expectedRevision===null
      ?await pool.query(`INSERT INTO user_data(user_id,schema_version,payload,revision,updated_at) VALUES($1,4,$2,1,NOW()) ON CONFLICT(user_id) DO NOTHING RETURNING revision::int AS revision,updated_at`,[req.user.user_id,payload])
      :await pool.query(`UPDATE user_data SET payload=$1,schema_version=4,revision=revision+1,updated_at=NOW() WHERE user_id=$2 AND revision=$3 RETURNING revision::int AS revision,updated_at`,[payload,req.user.user_id,expectedRevision]);
    if(!q.rows[0])return res.status(409).json({error:'DATA_CONFLICT'});
    res.json({ok:true,revision:q.rows[0].revision,updatedAt:q.rows[0].updated_at});
  }catch(e){next(e)}
});

// ---- Official (admin-published) warbands ---------------------------------
// A custom warband an admin has "officialized" is stored here and merged by
// every client into the normal faction list — same shape the client already
// builds for a book faction (id/displayName/group/budget/warriors/equipment) —
// plus whatever custom skills/spells/traits/special rules that warband's
// fighters and equipment actually reference (the client resolves and bundles
// those before sending). The custom-defined recruitment restrictions travel
// untouched; only the starting budget is normalized to the standard 1000 GC
// (forced here, not trusted from the client).
const arr=v=>Array.isArray(v)?v:[];
const toOfficialFaction=row=>{
  const id=`official-${row.id}`;
  // A genuinely custom equipment item (carries customEquipmentId) was scoped
  // to the admin's original custom warband via its old `.factions` id, which
  // is meaningless now. Re-scope it to this new official faction id so the
  // client's existing per-faction equipment restriction keeps working.
  const equipment=arr(row.definition?.equipment).map(e=>e&&e.customEquipmentId?{...e,factions:[id]}:e);
  return {
    id,displayName:row.name,group:'OFFICIAL',budget:1000,
    warriors:arr(row.definition?.warriors),equipment,
    skillTrees:arr(row.definition?.skillTrees),skills:arr(row.definition?.skills),
    magicDomains:arr(row.definition?.magicDomains),spells:arr(row.definition?.spells),
    traits:arr(row.definition?.traits),specialRules:arr(row.definition?.specialRules),
    bandRuleNames:arr(row.definition?.bandRuleNames),
    // V150: when set, this warband is a Supplement — an alternative/
    // replacement for the named base faction id (a book slug or another
    // `official-<uuid>` id) rather than a standalone top-level faction. The
    // client assigns packId/baseFactionId from this when merging into
    // D.factions, which the existing pack-resolution logic (faction(r),
    // availableSupplementsForFaction) already knows how to handle.
    supplementOf:row.supplement_of||null
  };
};

app.get('/api/warbands/official',requireDb,async(req,res,next)=>{
  // Public feed merged into every account's faction list: published only.
  // A draft (new or unpublished-for-correction) stays admin-only until
  // it's republished — see PATCH /api/admin/warbands/:id/status below.
  try{const q=await pool.query("SELECT id,name,definition,supplement_of FROM official_warbands WHERE status='published' ORDER BY created_at ASC");res.json({warbands:q.rows.map(toOfficialFaction)})}catch(e){next(e)}
});

app.get('/api/admin/warbands',requireDb,auth,requireAdmin,async(req,res,next)=>{
  try{
    const q=await pool.query(`SELECT ow.id,ow.slug,ow.name,ow.status,ow.supplement_of,ow.created_at,ow.updated_at,u.username AS created_by_username
      FROM official_warbands ow LEFT JOIN users u ON u.id=ow.created_by ORDER BY ow.created_at DESC`);
    res.json({warbands:q.rows});
  }catch(e){next(e)}
});

// Full definition of one official warband, for prefilling the edit form —
// the list endpoint above deliberately omits it (it can be sizeable).
app.get('/api/admin/warbands/:id',requireDb,auth,requireAdmin,async(req,res,next)=>{
  try{
    const q=await pool.query('SELECT id,name,status,supplement_of,definition FROM official_warbands WHERE id=$1',[req.params.id]);
    if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    const row=q.rows[0];
    res.json({warband:{id:row.id,name:row.name,status:row.status,supplementOf:row.supplement_of||null,...row.definition}});
  }catch(e){next(e)}
});

// Shared by create (POST) and edit (PUT): same shape, same limits either way.
function validateWarbandDefinition(body){
  const name=String(body?.name||'').trim();
  const warriors=Array.isArray(body?.warriors)?body.warriors:null;
  const equipment=Array.isArray(body?.equipment)?body.equipment:[];
  // Optional bundled custom content the warband's fighters/equipment reference
  // (skill trees & their skills, magic domains & their spells, traits, special
  // rules) — merged client-side into the shared catalog for every account.
  const skillTrees=arr(body?.skillTrees),skills=arr(body?.skills);
  const magicDomains=arr(body?.magicDomains),spells=arr(body?.spells);
  const traits=arr(body?.traits),specialRules=arr(body?.specialRules);
  // Names (from `traits`/`specialRules` above) that apply to the WHOLE
  // warband rather than one specific fighter/weapon — e.g. "Undead don't
  // check Rout". Kept as a separate name list because `traits`/`specialRules`
  // is a flat union of band-wide AND per-fighter/per-weapon rules once
  // bundled; without this, the client can't tell which ones to auto-apply to
  // every recruited fighter versus which are already scoped to their own
  // profile/weapon.
  const bandRuleNames=arr(body?.bandRuleNames).filter(n=>typeof n==='string').slice(0,80);
  // Optional (V150): marks this warband as a Supplement of another faction
  // id at create time, so it never shows as a standalone top-level faction.
  // Same string can also be set/cleared later via the dedicated
  // PATCH /api/admin/warbands/:id/supplement endpoint below.
  let supplementOf=body?.supplementOf;
  supplementOf=(typeof supplementOf==='string'&&supplementOf.trim())?supplementOf.trim().slice(0,120):null;
  if(!name||name.length>80)return {error:'INVALID_NAME'};
  if(!warriors||!warriors.length||warriors.length>60||equipment.length>300)return {error:'INVALID_DEFINITION'};
  if([skillTrees,skills,magicDomains,spells,traits,specialRules].some(a=>a.length>80))return {error:'INVALID_DEFINITION'};
  const definition={warriors,equipment,skillTrees,skills,magicDomains,spells,traits,specialRules,bandRuleNames};
  const payload=JSON.stringify(definition);
  if(Buffer.byteLength(payload)>2*1024*1024)return {error:'DATA_TOO_LARGE'};
  return {name,payload,supplementOf};
}

app.post('/api/admin/warbands',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const v=validateWarbandDefinition(req.body);
  if(v.error)return res.status(v.error==='DATA_TOO_LARGE'?413:400).json({error:v.error});
  try{
    const base=slugify(v.name)||'warband';
    let slug=base,suffix=1;
    // eslint-disable-next-line no-constant-condition
    while(true){
      const clash=await pool.query('SELECT 1 FROM official_warbands WHERE slug=$1',[slug]);
      if(!clash.rowCount)break;
      slug=`${base}-${++suffix}`;
    }
    const id=crypto.randomUUID();
    const q=await pool.query('INSERT INTO official_warbands(id,slug,name,created_by,definition,supplement_of) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,definition,supplement_of',[id,slug,v.name,req.user.user_id,v.payload,v.supplementOf]);
    res.status(201).json({warband:toOfficialFaction(q.rows[0])});
  }catch(e){next(e)}
});

// Edit an already-published (or draft) official warband in place — same
// validation as creating one, but the slug and status are left untouched so
// editing never changes the warband's URL/id shape or silently republishes
// a draft that was pulled back on purpose.
app.put('/api/admin/warbands/:id',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const v=validateWarbandDefinition(req.body);
  if(v.error)return res.status(v.error==='DATA_TOO_LARGE'?413:400).json({error:v.error});
  try{
    const q=await pool.query('UPDATE official_warbands SET name=$1,definition=$2,updated_at=NOW() WHERE id=$3 RETURNING id,name,definition,supplement_of',[v.name,v.payload,req.params.id]);
    if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    res.json({warband:toOfficialFaction(q.rows[0])});
  }catch(e){next(e)}
});

// Set or clear whether an already-published (or draft) official warband is a
// Supplement of another faction (V150) — used both at officialize time (via
// the `supplementOf` field on POST above) and, separately, to retroactively
// convert an existing warband into a Supplement or back into an independent
// one, without touching its name/definition. `baseFactionId` is the id of
// the faction it should appear under in Create Warband (a book slug or
// another warband's `official-<uuid>` id); null/omitted clears it.
app.patch('/api/admin/warbands/:id/supplement',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  let baseFactionId=req.body?.baseFactionId;
  baseFactionId=(typeof baseFactionId==='string'&&baseFactionId.trim())?baseFactionId.trim().slice(0,120):null;
  try{
    const q=await pool.query('UPDATE official_warbands SET supplement_of=$1,updated_at=NOW() WHERE id=$2 RETURNING id,supplement_of',[baseFactionId,req.params.id]);
    if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    res.json({ok:true,supplementOf:q.rows[0].supplement_of});
  }catch(e){next(e)}
});

// Unpublish (pull back for corrections) or republish. Never deletes data —
// unpublishing just drops the warband out of GET /api/warbands/official
// until it's flipped back, so an admin can safely rework it without racing
// against accounts that already merged the old version this session.
app.patch('/api/admin/warbands/:id/status',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const status=req.body?.status;
  if(status!=='draft'&&status!=='published')return res.status(400).json({error:'INVALID_STATUS'});
  try{
    const q=await pool.query('UPDATE official_warbands SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,status',[status,req.params.id]);
    if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    res.json({ok:true,status:q.rows[0].status});
  }catch(e){next(e)}
});

// Permanent deletion is only allowed once a warband has been pulled back to
// draft — an admin cannot delete a warband that's still live for every
// account in a single click. Unpublish first (PATCH .../status), confirm,
// then delete.
app.delete('/api/admin/warbands/:id',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{
    const cur=await pool.query('SELECT status FROM official_warbands WHERE id=$1',[req.params.id]);
    if(!cur.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    if(cur.rows[0].status!=='draft')return res.status(409).json({error:'MUST_UNPUBLISH_FIRST'});
    const q=await pool.query('DELETE FROM official_warbands WHERE id=$1 RETURNING id',[req.params.id]);
    res.json({ok:true});
  }catch(e){next(e)}
});

// ---- Admin management ------------------------------------------------------
app.get('/api/admin/admins',requireDb,auth,requireAdmin,async(req,res,next)=>{
  try{const q=await pool.query('SELECT id,username,email FROM users WHERE is_admin=true ORDER BY username ASC');res.json({admins:q.rows})}catch(e){next(e)}
});

// Accepts either an email or a username, so accounts created before email
// was made mandatory (which may have no email at all) can still be promoted.
app.post('/api/admin/promote',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const identifier=String(req.body?.identifier||req.body?.email||'').trim().toLowerCase();
  if(!identifier)return res.status(400).json({error:'INVALID_IDENTIFIER'});
  try{
    const q=await pool.query('UPDATE users SET is_admin=true,updated_at=NOW() WHERE lower(email)=lower($1) OR lower(username)=lower($1) RETURNING id,username,email',[identifier]);
    if(!q.rows[0])return res.status(404).json({error:'ACCOUNT_NOT_FOUND'});
    res.json({user:q.rows[0]});
  }catch(e){next(e)}
});

app.post('/api/admin/demote',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const identifier=String(req.body?.identifier||req.body?.email||'').trim().toLowerCase();
  if(!identifier)return res.status(400).json({error:'INVALID_IDENTIFIER'});
  try{
    const q=await pool.query('UPDATE users SET is_admin=false,updated_at=NOW() WHERE lower(email)=lower($1) OR lower(username)=lower($1) RETURNING id,username,email',[identifier]);
    if(!q.rows[0])return res.status(404).json({error:'ACCOUNT_NOT_FOUND'});
    res.json({user:q.rows[0]});
  }catch(e){next(e)}
});

// ---- Rulebook text overrides (V145) ---------------------------------------
// The rulebook itself is baked into the client (RULES_BOOK in app.js) so the
// Règles tab works offline and never depends on the API. This table only
// carries admin corrections layered on top of that baked-in text, so the
// read is public (same audience as the rulebook it patches) and the write
// is admin-only.
app.get('/api/rules/overrides',requireDb,async(req,res,next)=>{
  try{
    const q=await pool.query('SELECT section_id,page,text,updated_at FROM rule_overrides');
    res.json({overrides:q.rows.map(r=>({sectionId:r.section_id,page:r.page,text:r.text,updatedAt:r.updated_at}))});
  }catch(e){next(e)}
});
app.put('/api/admin/rules/overrides',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const sectionId=String(req.body?.sectionId||'').trim();
  const page=Number(req.body?.page);
  const text=String(req.body?.text??'');
  if(!sectionId||!Number.isInteger(page))return res.status(400).json({error:'INVALID_OVERRIDE'});
  try{
    if(!text.trim()){
      await pool.query('DELETE FROM rule_overrides WHERE section_id=$1 AND page=$2',[sectionId,page]);
      return res.json({ok:true,removed:true});
    }
    await pool.query(`INSERT INTO rule_overrides(section_id,page,text,updated_by,updated_at) VALUES($1,$2,$3,$4,NOW())
      ON CONFLICT (section_id,page) DO UPDATE SET text=EXCLUDED.text,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[sectionId,page,text,req.user.user_id]);
    res.json({ok:true});
  }catch(e){next(e)}
});
app.delete('/api/admin/rules/overrides/:sectionId/:page',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const page=Number(req.params.page);
  if(!req.params.sectionId||!Number.isInteger(page))return res.status(400).json({error:'INVALID_OVERRIDE'});
  try{
    await pool.query('DELETE FROM rule_overrides WHERE section_id=$1 AND page=$2',[req.params.sectionId,page]);
    res.json({ok:true});
  }catch(e){next(e)}
});

// ---- Base M17 catalog overrides (V147) -------------------------------------
// Same idea as rule_overrides, but for a book faction's fighter profiles and
// equipment (data/catalog.js, baked into the client). Public read (it's
// reference content everyone needs to see the corrected values), admin-only
// write. The server has no knowledge of catalog.js's baseline content — same
// as rule_overrides not knowing RULES_BOOK's baseline text — so the client
// always sends the full warriors/equipment arrays; there is nothing to merge
// server-side, only to store and hand back.
app.get('/api/catalog/overrides',requireDb,async(req,res,next)=>{
  try{
    const q=await pool.query('SELECT faction_id,warriors,equipment,updated_at FROM catalog_overrides');
    res.json({overrides:q.rows.map(r=>({factionId:r.faction_id,warriors:r.warriors,equipment:r.equipment,updatedAt:r.updated_at}))});
  }catch(e){next(e)}
});
app.put('/api/admin/catalog/overrides/:factionId',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const factionId=String(req.params.factionId||'').trim();
  const warriors=Array.isArray(req.body?.warriors)?req.body.warriors:null;
  const equipment=Array.isArray(req.body?.equipment)?req.body.equipment:null;
  if(!factionId||!warriors||!warriors.length||warriors.length>80||!equipment||equipment.length>400)return res.status(400).json({error:'INVALID_OVERRIDE'});
  const wPayload=JSON.stringify(warriors),ePayload=JSON.stringify(equipment);
  if(Buffer.byteLength(wPayload)+Buffer.byteLength(ePayload)>2*1024*1024)return res.status(413).json({error:'DATA_TOO_LARGE'});
  try{
    await pool.query(`INSERT INTO catalog_overrides(faction_id,warriors,equipment,updated_by,updated_at) VALUES($1,$2,$3,$4,NOW())
      ON CONFLICT (faction_id) DO UPDATE SET warriors=EXCLUDED.warriors,equipment=EXCLUDED.equipment,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[factionId,wPayload,ePayload,req.user.user_id]);
    res.json({ok:true});
  }catch(e){next(e)}
});
app.delete('/api/admin/catalog/overrides/:factionId',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{
    await pool.query('DELETE FROM catalog_overrides WHERE faction_id=$1',[req.params.factionId]);
    res.json({ok:true});
  }catch(e){next(e)}
});

// Shared weapon/gear pool corrections and additions (V148). D.weapons is the
// pool every faction/warband draws its equipment from (a faction's own
// `equipment` array is only ever item NAMES into it — see catalog_overrides
// above). Keyed by the weapon's exact name; public read, admin-only write.
app.get('/api/catalog/weapon-overrides',requireDb,async(req,res,next)=>{
  try{
    const q=await pool.query('SELECT weapon_name,data,updated_at FROM weapon_overrides');
    res.json({overrides:q.rows.map(r=>({name:r.weapon_name,data:r.data,updatedAt:r.updated_at}))});
  }catch(e){next(e)}
});
app.put('/api/admin/catalog/weapon-overrides/:name',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const name=String(req.params.name||'').trim();
  const data=req.body?.data&&typeof req.body.data==='object'&&!Array.isArray(req.body.data)?req.body.data:null;
  if(!name||!data||typeof data.name!=='string'||!data.name.trim())return res.status(400).json({error:'INVALID_WEAPON'});
  const payload=JSON.stringify(data);
  if(Buffer.byteLength(payload)>200*1024)return res.status(413).json({error:'DATA_TOO_LARGE'});
  try{
    await pool.query(`INSERT INTO weapon_overrides(weapon_name,data,updated_by,updated_at) VALUES($1,$2,$3,NOW())
      ON CONFLICT (weapon_name) DO UPDATE SET data=EXCLUDED.data,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[name,payload,req.user.user_id]);
    res.json({ok:true});
  }catch(e){next(e)}
});
app.delete('/api/admin/catalog/weapon-overrides/:name',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{
    await pool.query('DELETE FROM weapon_overrides WHERE weapon_name=$1',[req.params.name]);
    res.json({ok:true});
  }catch(e){next(e)}
});

// Race-category tags for the "Create warband" picker (V149). Public read,
// admin-only write. `race` is free text validated client-side against a
// fixed list — kept unconstrained here (no CHECK) the same way
// official_warbands.status is, since this file re-runs on every deploy.
const RACE_TAG_MAX_LEN=40;
app.get('/api/catalog/race-tags',requireDb,async(req,res,next)=>{
  try{
    const q=await pool.query('SELECT faction_id,race,updated_at FROM faction_race_tags');
    res.json({tags:q.rows.map(r=>({factionId:r.faction_id,race:r.race,updatedAt:r.updated_at}))});
  }catch(e){next(e)}
});
app.put('/api/admin/catalog/race-tags/:factionId',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const factionId=String(req.params.factionId||'').trim();
  const race=String(req.body?.race||'').trim();
  if(!factionId||!race||race.length>RACE_TAG_MAX_LEN)return res.status(400).json({error:'INVALID_RACE_TAG'});
  try{
    await pool.query(`INSERT INTO faction_race_tags(faction_id,race,updated_by,updated_at) VALUES($1,$2,$3,NOW())
      ON CONFLICT (faction_id) DO UPDATE SET race=EXCLUDED.race,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[factionId,race,req.user.user_id]);
    res.json({ok:true});
  }catch(e){next(e)}
});
app.delete('/api/admin/catalog/race-tags/:factionId',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{
    await pool.query('DELETE FROM faction_race_tags WHERE faction_id=$1',[req.params.factionId]);
    res.json({ok:true});
  }catch(e){next(e)}
});

// ---- Friends (V89) ---------------------------------------------------------
// A friendship is a contact list only: it never grants access to another
// account's warbands or custom content (that stays strictly 1:1 via
// user_data). Two directed `friendships` rows are written on acceptance so
// either side can unfriend independently.
app.use('/api/friends',rateLimit({windowMs:60*1000,max:60,standardHeaders:true,legacyHeaders:false,message:{error:'RATE_LIMITED'}}));
const pubFriend=u=>({id:u.id,username:u.username});

app.get('/api/friends',requireDb,auth,async(req,res,next)=>{
  try{
    const friends=await pool.query(`SELECT u.id,u.username FROM friendships f JOIN users u ON u.id=f.friend_id WHERE f.user_id=$1 ORDER BY u.username ASC`,[req.user.user_id]);
    const incoming=await pool.query(`SELECT r.id,u.id AS user_id,u.username,r.created_at FROM friend_requests r JOIN users u ON u.id=r.requester_id WHERE r.recipient_id=$1 AND r.status='pending' ORDER BY r.created_at ASC`,[req.user.user_id]);
    const outgoing=await pool.query(`SELECT r.id,u.id AS user_id,u.username,r.created_at FROM friend_requests r JOIN users u ON u.id=r.recipient_id WHERE r.requester_id=$1 AND r.status='pending' ORDER BY r.created_at ASC`,[req.user.user_id]);
    res.json({friends:friends.rows.map(pubFriend),incoming:incoming.rows,outgoing:outgoing.rows});
  }catch(e){next(e)}
});

app.post('/api/friends/requests',requireDb,requireSameOrigin,auth,async(req,res,next)=>{
  const identifier=String(req.body?.identifier||'').trim().toLowerCase();
  if(!identifier)return res.status(400).json({error:'INVALID_IDENTIFIER'});
  try{
    const target=await pool.query('SELECT id,username FROM users WHERE lower(username)=lower($1) OR lower(coalesce(email,\'\'))=lower($1) LIMIT 1',[identifier]);
    if(!target.rows[0])return res.status(404).json({error:'ACCOUNT_NOT_FOUND'});
    if(target.rows[0].id===req.user.user_id)return res.status(400).json({error:'CANNOT_ADD_SELF'});
    const already=await pool.query('SELECT 1 FROM friendships WHERE user_id=$1 AND friend_id=$2',[req.user.user_id,target.rows[0].id]);
    if(already.rowCount)return res.status(409).json({error:'ALREADY_FRIENDS'});
    // A pending request already exists in either direction — surface it
    // rather than creating a duplicate (the UNIQUE constraint would 500).
    const existing=await pool.query(`SELECT id FROM friend_requests WHERE status='pending' AND ((requester_id=$1 AND recipient_id=$2) OR (requester_id=$2 AND recipient_id=$1))`,[req.user.user_id,target.rows[0].id]);
    if(existing.rowCount)return res.status(409).json({error:'REQUEST_ALREADY_PENDING'});
    const id=crypto.randomUUID();
    await pool.query(`INSERT INTO friend_requests(id,requester_id,recipient_id) VALUES($1,$2,$3)
      ON CONFLICT (requester_id,recipient_id) DO UPDATE SET status='pending',created_at=NOW(),responded_at=NULL`,[id,req.user.user_id,target.rows[0].id]);
    res.status(201).json({ok:true,recipient:pubFriend(target.rows[0])});
  }catch(e){next(e)}
});

// Accept/decline only act on a request addressed to the caller; cancelling
// only acts on one the caller sent — both routed through the same id so the
// client doesn't need to know in advance which side of the row it's on.
app.post('/api/friends/requests/:id/accept',requireDb,requireSameOrigin,auth,async(req,res,next)=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const q=await client.query(`SELECT requester_id,recipient_id FROM friend_requests WHERE id=$1 AND recipient_id=$2 AND status='pending' FOR UPDATE`,[req.params.id,req.user.user_id]);
    if(!q.rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'NOT_FOUND'});}
    const {requester_id,recipient_id}=q.rows[0];
    await client.query(`UPDATE friend_requests SET status='accepted',responded_at=NOW() WHERE id=$1`,[req.params.id]);
    await client.query(`INSERT INTO friendships(user_id,friend_id) VALUES($1,$2),($2,$1) ON CONFLICT DO NOTHING`,[requester_id,recipient_id]);
    await client.query('COMMIT');
    res.json({ok:true});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});next(e)}finally{client.release()}
});

app.post('/api/friends/requests/:id/decline',requireDb,requireSameOrigin,auth,async(req,res,next)=>{
  try{
    const q=await pool.query(`UPDATE friend_requests SET status='declined',responded_at=NOW() WHERE id=$1 AND recipient_id=$2 AND status='pending' RETURNING id`,[req.params.id,req.user.user_id]);
    if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    res.json({ok:true});
  }catch(e){next(e)}
});

app.delete('/api/friends/requests/:id',requireDb,requireSameOrigin,auth,async(req,res,next)=>{
  try{
    const q=await pool.query(`UPDATE friend_requests SET status='cancelled',responded_at=NOW() WHERE id=$1 AND requester_id=$2 AND status='pending' RETURNING id`,[req.params.id,req.user.user_id]);
    if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    res.json({ok:true});
  }catch(e){next(e)}
});

app.delete('/api/friends/:userId',requireDb,requireSameOrigin,auth,async(req,res,next)=>{
  try{
    await pool.query('DELETE FROM friendships WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)',[req.user.user_id,req.params.userId]);
    res.json({ok:true});
  }catch(e){next(e)}
});

// ---- Admin support access (V89, write added V146) --------------------------
// An admin can look up — and, since V146, directly edit — another account's
// saved warbands/custom content, WITHOUT that account having to share
// anything first (no friendship needed, no consent flow — this is an admin
// capability, not a social one). Every lookup AND every write is logged
// (with which of the two it was), and the consulted user can read that log
// about themselves via GET /api/account/access-log. Official-warband
// editing (a separate, already-shared resource) still goes through
// /api/admin/warbands and is unaffected by this.
app.get('/api/admin/support/search',requireDb,auth,requireAdmin,async(req,res,next)=>{
  const q=String(req.query.q||'').trim();
  try{
    // An empty query browses the most recently active accounts instead of
    // forcing the admin to already know a username — needed for "which
    // warband is that player asking about" support flows, and for the
    // live-edit panel where the admin may not have a query in hand yet.
    const r=q.length<2
      ?await pool.query(`SELECT u.id,u.username,u.email FROM users u LEFT JOIN user_data d ON d.user_id=u.id ORDER BY d.updated_at DESC NULLS LAST, u.username ASC LIMIT 30`)
      :await pool.query(`SELECT id,username,email FROM users WHERE lower(username) LIKE lower($1) OR lower(coalesce(email,'')) LIKE lower($1) ORDER BY username ASC LIMIT 30`,[`%${q}%`]);
    res.json({users:r.rows});
  }catch(e){next(e)}
});

app.get('/api/admin/support/:userId',requireDb,auth,requireAdmin,async(req,res,next)=>{
  try{
    const u=await pool.query('SELECT id,username,email FROM users WHERE id=$1',[req.params.userId]);
    if(!u.rows[0])return res.status(404).json({error:'ACCOUNT_NOT_FOUND'});
    const d=await pool.query('SELECT schema_version,payload,revision::int AS revision,updated_at FROM user_data WHERE user_id=$1',[req.params.userId]);
    // The consultation is recorded before the data is returned, so a
    // request that fails partway still leaves an honest trail.
    await pool.query('INSERT INTO admin_support_access_log(id,admin_id,target_user_id,action) VALUES($1,$2,$3,$4)',[crypto.randomUUID(),req.user.user_id,req.params.userId,'view']);
    res.json({user:u.rows[0],data:d.rows[0]||{schema_version:4,payload:{rosters:[],active:null},revision:1,updated_at:null}});
  }catch(e){next(e)}
});

// Write side of admin support access (V146): lets an admin correct or
// update another account's saved data directly — e.g. fixing a warband
// after an in-person campaign session — without that player having to make
// the change themselves. Mirrors PUT /api/account/data's shape and
// optimistic-concurrency guard (a null expectedRevision only ever creates a
// row; an existing row requires the caller's expectedRevision to match, or
// this returns 409 so the admin reloads the latest copy before overwriting
// anything). Every write is logged the same way a read is, but as its own
// 'edit' action, so the consulted player can tell a lookup from a change.
app.put('/api/admin/support/:userId/data',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const data=req.body?.data;if(!data||typeof data!=='object'||Array.isArray(data))return res.status(400).json({error:'INVALID_DATA'});
  const payload=JSON.stringify(data);if(Buffer.byteLength(payload)>5*1024*1024)return res.status(413).json({error:'DATA_TOO_LARGE'});
  try{
    const u=await pool.query('SELECT id FROM users WHERE id=$1',[req.params.userId]);
    if(!u.rows[0])return res.status(404).json({error:'ACCOUNT_NOT_FOUND'});
    const expectedRevision=toInt(req.body?.expectedRevision);
    const q=expectedRevision===null
      ?await pool.query(`INSERT INTO user_data(user_id,schema_version,payload,revision,updated_at) VALUES($1,4,$2,1,NOW()) ON CONFLICT(user_id) DO NOTHING RETURNING revision::int AS revision,updated_at`,[req.params.userId,payload])
      :await pool.query(`UPDATE user_data SET payload=$1,schema_version=4,revision=revision+1,updated_at=NOW() WHERE user_id=$2 AND revision=$3 RETURNING revision::int AS revision,updated_at`,[payload,req.params.userId,expectedRevision]);
    if(!q.rows[0])return res.status(409).json({error:'DATA_CONFLICT'});
    await pool.query('INSERT INTO admin_support_access_log(id,admin_id,target_user_id,action) VALUES($1,$2,$3,$4)',[crypto.randomUUID(),req.user.user_id,req.params.userId,'edit']);
    res.json({ok:true,revision:q.rows[0].revision,updatedAt:q.rows[0].updated_at});
  }catch(e){next(e)}
});

// Self-service: "who has looked at my data, and when" — visible to the
// consulted account itself, never aggregated across other accounts.
app.get('/api/account/access-log',requireDb,auth,async(req,res,next)=>{
  try{
    const r=await pool.query(`SELECT l.accessed_at,l.action,u.username AS admin_username FROM admin_support_access_log l JOIN users u ON u.id=l.admin_id WHERE l.target_user_id=$1 ORDER BY l.accessed_at DESC LIMIT 50`,[req.user.user_id]);
    res.json({entries:r.rows});
  }catch(e){next(e)}
});

// Periodic housekeeping keeps expired credentials from accumulating forever.
if(pool)setInterval(()=>pool.query("DELETE FROM sessions WHERE expires_at<=NOW(); DELETE FROM recovery_tokens WHERE expires_at<=NOW() OR used_at IS NOT NULL").catch(e=>console.error('housekeeping',e)),60*60*1000).unref();

// Only the actual client assets are servable as static files — never the whole
// project root (which would otherwise also expose server source, the DB schema,
// .env.example, docs and scratch scripts to anyone who guesses the path).
const staticOpts={etag:true,maxAge:isProd?'1h':0};
app.use('/assets',express.static(path.join(publicDir,'assets'),staticOpts));
app.use('/data',express.static(path.join(publicDir,'data'),staticOpts));
const sendIndex=(_req,res)=>res.sendFile(path.join(publicDir,'index.html'),{headers:{'Cache-Control':'no-cache'}});
app.get('/',sendIndex);
app.get(/.*/,sendIndex);
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'INTERNAL_SERVER_ERROR'})});

if(pool)pool.on('error',e=>console.error('PostgreSQL pool error',e));

// Vercel imports this module as a serverless function. Local development can still
// run the same Express app with `npm start`.
if(process.env.VERCEL !== '1') {
  const server=app.listen(config.port,()=>console.log(`Mordheimunda server listening on http://localhost:${config.port}`));
  const shutdown=async()=>{server.close(async()=>{if(pool)await pool.end();process.exit(0)})};
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}

export default app;
