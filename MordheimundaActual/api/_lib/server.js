import express from 'express';
import cors from 'cors';
import path from 'node:path';
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
const pool=config.databaseUrl?new Pool({connectionString:config.databaseUrl,ssl:config.databaseSsl?{rejectUnauthorized:false}:undefined,max:10,idleTimeoutMillis:30000}):null;
const cookie={httpOnly:true,secure:isProd,sameSite:'lax',path:'/'};
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
const token=()=>crypto.randomBytes(32).toString('base64url');
const pub=u=>({id:u.id,username:u.username,email:u.email||null,emailVerified:!!u.email_verified_at,isAdmin:!!u.is_admin});
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

app.get('/api/account/data',requireDb,auth,async(req,res,next)=>{try{const q=await pool.query('SELECT schema_version,payload,revision,updated_at FROM user_data WHERE user_id=$1',[req.user.user_id]);res.json(q.rows[0]||{schema_version:4,payload:{rosters:[],active:null},revision:1,updated_at:null})}catch(e){next(e)}});
app.get('/api/account/data/revision',requireDb,auth,async(req,res,next)=>{try{const q=await pool.query('SELECT revision,updated_at FROM user_data WHERE user_id=$1',[req.user.user_id]);res.json(q.rows[0]||{revision:1,updated_at:null})}catch(e){next(e)}});
app.put('/api/account/data',requireDb,requireSameOrigin,auth,async(req,res,next)=>{
  const data=req.body?.data;if(!data||typeof data!=='object'||Array.isArray(data))return res.status(400).json({error:'INVALID_DATA'});
  const payload=JSON.stringify(data);if(Buffer.byteLength(payload)>5*1024*1024)return res.status(413).json({error:'DATA_TOO_LARGE'});
  try{
    const expectedRevision=Number.isInteger(req.body?.expectedRevision)?req.body.expectedRevision:null;
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
      ?await pool.query(`INSERT INTO user_data(user_id,schema_version,payload,revision,updated_at) VALUES($1,4,$2,1,NOW()) ON CONFLICT(user_id) DO NOTHING RETURNING revision,updated_at`,[req.user.user_id,payload])
      :await pool.query(`UPDATE user_data SET payload=$1,schema_version=4,revision=revision+1,updated_at=NOW() WHERE user_id=$2 AND revision=$3 RETURNING revision,updated_at`,[payload,req.user.user_id,expectedRevision]);
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
    traits:arr(row.definition?.traits),specialRules:arr(row.definition?.specialRules)
  };
};

app.get('/api/warbands/official',requireDb,async(req,res,next)=>{
  try{const q=await pool.query('SELECT id,name,definition FROM official_warbands ORDER BY created_at ASC');res.json({warbands:q.rows.map(toOfficialFaction)})}catch(e){next(e)}
});

app.get('/api/admin/warbands',requireDb,auth,requireAdmin,async(req,res,next)=>{
  try{
    const q=await pool.query(`SELECT ow.id,ow.slug,ow.name,ow.created_at,ow.updated_at,u.username AS created_by_username
      FROM official_warbands ow LEFT JOIN users u ON u.id=ow.created_by ORDER BY ow.created_at DESC`);
    res.json({warbands:q.rows});
  }catch(e){next(e)}
});

app.post('/api/admin/warbands',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const name=String(req.body?.name||'').trim();
  const warriors=Array.isArray(req.body?.warriors)?req.body.warriors:null;
  const equipment=Array.isArray(req.body?.equipment)?req.body.equipment:[];
  // Optional bundled custom content the warband's fighters/equipment reference
  // (skill trees & their skills, magic domains & their spells, traits, special
  // rules) — merged client-side into the shared catalog for every account.
  const skillTrees=arr(req.body?.skillTrees),skills=arr(req.body?.skills);
  const magicDomains=arr(req.body?.magicDomains),spells=arr(req.body?.spells);
  const traits=arr(req.body?.traits),specialRules=arr(req.body?.specialRules);
  if(!name||name.length>80)return res.status(400).json({error:'INVALID_NAME'});
  if(!warriors||!warriors.length||warriors.length>60||equipment.length>300)return res.status(400).json({error:'INVALID_DEFINITION'});
  if([skillTrees,skills,magicDomains,spells,traits,specialRules].some(a=>a.length>80))return res.status(400).json({error:'INVALID_DEFINITION'});
  const definition={warriors,equipment,skillTrees,skills,magicDomains,spells,traits,specialRules};
  const payload=JSON.stringify(definition);
  if(Buffer.byteLength(payload)>2*1024*1024)return res.status(413).json({error:'DATA_TOO_LARGE'});
  try{
    const base=slugify(name)||'warband';
    let slug=base,suffix=1;
    // eslint-disable-next-line no-constant-condition
    while(true){
      const clash=await pool.query('SELECT 1 FROM official_warbands WHERE slug=$1',[slug]);
      if(!clash.rowCount)break;
      slug=`${base}-${++suffix}`;
    }
    const id=crypto.randomUUID();
    const q=await pool.query('INSERT INTO official_warbands(id,slug,name,created_by,definition) VALUES($1,$2,$3,$4,$5) RETURNING id,name,definition',[id,slug,name,req.user.user_id,payload]);
    res.status(201).json({warband:toOfficialFaction(q.rows[0])});
  }catch(e){next(e)}
});

app.delete('/api/admin/warbands/:id',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{const q=await pool.query('DELETE FROM official_warbands WHERE id=$1 RETURNING id',[req.params.id]);if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});res.json({ok:true})}catch(e){next(e)}
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
