import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit,{ipKeyGenerator} from 'express-rate-limit';
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
const clientIp=req=>String(req.ip||'').replace(/^::ffff:/,'').slice(0,64);
// V154: every login path mints its session here so the device metadata
// (User-Agent, IP, last activity) shown in Account → Connected devices is
// always recorded. Returns the raw token to set as the cookie.
async function createSession(db,user,req){
  const t=token();
  await db.query("INSERT INTO sessions(id,user_id,token_hash,expires_at,token_version,user_agent,ip,last_seen_at) VALUES($1,$2,$3,NOW()+($4::int*INTERVAL '1 day'),$5,$6,$7,NOW())",[crypto.randomUUID(),user.id,hash(t),config.sessionDays,user.token_version||0,String(req.get('user-agent')||'').slice(0,512)||null,clientIp(req)||null]);
  return t;
}
function describeUserAgent(ua){
  ua=String(ua||'');
  const os=/iPhone|iPad|iPod/.test(ua)?'iOS':/Android/.test(ua)?'Android':/Windows/.test(ua)?'Windows':/Mac OS X/.test(ua)?'macOS':/CrOS/.test(ua)?'ChromeOS':/Linux/.test(ua)?'Linux':null;
  const browser=/Edg\//.test(ua)?'Edge':/OPR\/|Opera/.test(ua)?'Opera':/Firefox\//.test(ua)?'Firefox':/SamsungBrowser/.test(ua)?'Samsung Internet':/Chrome\/|CriOS/.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':null;
  return {browser,os,mobile:/Mobi|iPhone|iPod|Android/.test(ua)};
}
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

async function buildTransport(){
  const {default:nodemailer}=await import('nodemailer');
  return nodemailer.createTransport({host:config.smtpHost,port:config.smtpPort,secure:config.smtpSecure,auth:config.smtpUser?{user:config.smtpUser,pass:config.smtpPassword}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
}
async function sendMail({to,subject,text,html}){
  if(!config.smtpHost){
    if(isProd){console.error(`[MAIL] SMTP_HOST is not set — cannot send "${subject}" to ${to}`);throw Error('SMTP_NOT_CONFIGURED');}
    console.log(`[DEV EMAIL]\nTo: ${to}\nSubject: ${subject}\n${text}`);return;
  }
  const transporter=await buildTransport();
  try{await transporter.sendMail({from:config.smtpFrom,to,subject,text,...(html?{html}:{})});}
  catch(e){console.error(`[MAIL] send failed to=${to} subject="${subject}" host=${config.smtpHost}:${config.smtpPort} secure=${config.smtpSecure} from=${config.smtpFrom} :: ${e.code||''} ${e.responseCode||''} ${e.message}`);throw e}
}
// Public recovery endpoints must answer {ok:true} whether or not the mail
// went out: a 500 here would both show "Server error" to a legitimate user
// and tell an attacker the address exists (the send only happens for real
// accounts). Failures are logged loudly above for the operator instead.
const sendMailQuietly=opts=>sendMail(opts).then(()=>true,()=>false);

// V152: HTML+text branded body for a password-reset email. Dark Warhammer
// aesthetic to match the rest of the app, plain-text fallback for clients
// that block HTML. English copy per plan; the reset link expires in 15 min.
function passwordResetEmail({username,link}){
  const safe=String(username||'').replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[c]));
  const text=`Hail ${username},\n\nA password reset was requested for your Mordheimunda account.\n\nOpen the link below to choose a new password:\n${link}\n\nThis link expires in 15 minutes and can only be used once.\nIf you did not request this, you can safely ignore this email — your password will not change.\n\n— Mordheimunda`;
  return {text,html:brandedEmail({title:'Reset your password',safeUsername:safe,intro:'A password reset was requested for your Mordheimunda account. Click the button below to choose a new password.',cta:'Reset password',link,note:'This link <strong style="color:#c98a5a">expires in 15 minutes</strong> and can only be used once. If you did not request this reset, you can safely ignore this email — your password will not change.'})};
}

// V153: HTML+text body for the "confirm your email" mail sent right after
// signup. Same template as password reset (shared brandedEmail() below);
// only the copy and CTA change.
function verifyEmailEmail({username,link}){
  const safe=String(username||'').replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[c]));
  const text=`Hail ${username},\n\nWelcome to Mordheimunda. Confirm your email address so we can send you password-recovery links and important account notices.\n\nOpen the link below to verify your email:\n${link}\n\nThis link expires in 24 hours.\nIf you did not create an account, you can safely ignore this email.\n\n— Mordheimunda`;
  return {text,html:brandedEmail({title:'Confirm your email',safeUsername:safe,intro:'Welcome to Mordheimunda. Confirm your email address so we can send you password-recovery links and important account notices.',cta:'Verify email',link,note:'This link <strong style="color:#c98a5a">expires in 24 hours</strong>. If you did not create an account, you can safely ignore this email.'})};
}

// Shared branded envelope for every transactional email so both flows share
// the same dark-Warhammer look; only the title/intro/cta/note vary.
function brandedEmail({title,safeUsername,intro,cta,link,note}){
  return `<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#0b0908;font-family:Georgia,'Times New Roman',serif;color:#d9c9a3">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0908;padding:32px 12px">
 <tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141210;border:1px solid #3a2a1a;border-radius:2px">
   <tr><td style="padding:28px 32px 8px 32px;border-bottom:1px solid #3a2a1a">
    <div style="font-family:'Cinzel',Georgia,serif;font-weight:700;font-size:22px;letter-spacing:.14em;color:#c98a5a;text-transform:uppercase">Mordheimunda</div>
    <div style="font-size:11px;letter-spacing:.18em;color:#7a6a4a;text-transform:uppercase;margin-top:4px">M17 Roster Manager</div>
   </td></tr>
   <tr><td style="padding:28px 32px 8px 32px">
    <h1 style="font-family:'Cinzel',Georgia,serif;font-size:20px;letter-spacing:.08em;color:#e8d9b5;margin:0 0 14px 0">${title}</h1>
    <p style="line-height:1.55;color:#c9b990;margin:0 0 14px 0">Hail <strong style="color:#e8d9b5">${safeUsername}</strong>,</p>
    <p style="line-height:1.55;color:#c9b990;margin:0 0 14px 0">${intro}</p>
   </td></tr>
   <tr><td align="center" style="padding:8px 32px 20px 32px">
    <a href="${link}" style="display:inline-block;padding:13px 26px;background:#3a1f10;border:1px solid #c98a5a;color:#f2e4c3;text-decoration:none;font-family:'Cinzel',Georgia,serif;font-size:13px;letter-spacing:.18em;text-transform:uppercase;border-radius:2px">${cta}</a>
   </td></tr>
   <tr><td style="padding:0 32px 24px 32px">
    <p style="line-height:1.55;color:#8a7a5a;font-size:13px;margin:0 0 10px 0">Or paste this link into your browser:</p>
    <p style="word-break:break-all;font-family:'Courier New',monospace;font-size:12px;color:#c98a5a;background:#0b0908;border:1px solid #2a1e14;padding:10px 12px;margin:0">${link}</p>
   </td></tr>
   <tr><td style="padding:0 32px 28px 32px;border-top:1px solid #2a1e14">
    <p style="line-height:1.55;color:#7a6a4a;font-size:12px;margin:16px 0 0 0">${note}</p>
   </td></tr>
   <tr><td style="padding:14px 32px;background:#0b0908;border-top:1px solid #2a1e14">
    <div style="font-size:10px;letter-spacing:.18em;color:#5a4a2f;text-transform:uppercase">Mordheimunda 26 · M17 Edition</div>
   </td></tr>
  </table>
 </td></tr>
</table></body></html>`;
}

// V153: fire off an email-verification token+mail for a freshly-created or
// email-changed account. Best-effort: an SMTP failure here must never
// prevent registration itself, so the caller passes {silent:true} and any
// throw is swallowed and logged (the user still lands on the site logged
// in, and can hit "Resend verification email" from the in-app banner).
async function issueVerificationEmail(user,{silent=false}={}){
  try{
    if(!user?.email)return false;
    await pool.query("UPDATE recovery_tokens SET used_at=NOW() WHERE user_id=$1 AND kind='verify_email' AND used_at IS NULL",[user.id]);
    const t=token();
    await pool.query("INSERT INTO recovery_tokens(id,user_id,token_hash,kind,expires_at) VALUES($1,$2,$3,'verify_email',NOW()+INTERVAL '24 hours')",[crypto.randomUUID(),user.id,hash(t)]);
    const link=`${config.frontendUrl}/verify-email.html?token=${encodeURIComponent(t)}`;
    const {text,html}=verifyEmailEmail({username:user.username,link});
    await sendMail({to:user.email,subject:'Confirm your Mordheimunda email',text,html});
    return true;
  }catch(e){
    if(!silent)throw e;
    console.error('issueVerificationEmail failed (continuing):',e.message);
    return false;
  }
}

async function auth(req,res,next){
  try{
    const raw=req.cookies.mordheimunda_session;
    if(!raw)return res.status(401).json({error:'NOT_AUTHENTICATED'});
    const q=await pool.query(`SELECT s.id AS session_id,s.user_id,s.token_version AS session_token_version,s.last_seen_at,u.username,u.email,u.email_verified_at,u.is_admin,u.token_version AS user_token_version
      FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at>NOW()`,[hash(raw)]);
    if(!q.rows[0]){res.clearCookie('mordheimunda_session',cookie);return res.status(401).json({error:'NOT_AUTHENTICATED'});}
    // V152: a password reset bumps users.token_version. Any pre-reset session
    // whose snapshotted version no longer matches is treated as expired, on
    // top of the existing DELETE FROM sessions the reset also runs.
    if(q.rows[0].session_token_version!==q.rows[0].user_token_version){
      await pool.query('DELETE FROM sessions WHERE id=$1',[q.rows[0].session_id]).catch(()=>{});
      res.clearCookie('mordheimunda_session',cookie);
      return res.status(401).json({error:'NOT_AUTHENTICATED'});
    }
    req.user=q.rows[0];
    // V154: refresh last_seen_at at most every 5 minutes (fire-and-forget)
    // so the device list stays meaningful without a write on every request.
    const seen=q.rows[0].last_seen_at?new Date(q.rows[0].last_seen_at).getTime():0;
    if(Date.now()-seen>5*60*1000)pool.query('UPDATE sessions SET last_seen_at=NOW(),ip=COALESCE($2,ip) WHERE id=$1',[req.user.session_id,clientIp(req)||null]).catch(()=>{});
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
    const q=await client.query('INSERT INTO users(id,username,email,password_hash,is_admin) VALUES($1,$2,$3,$4,$5) RETURNING id,username,email,email_verified_at,is_admin,token_version',[id,username,email,ph,isAdmin]);
    await client.query('INSERT INTO user_data(user_id,schema_version,payload,revision) VALUES($1,4,$2,1)',[id,JSON.stringify({rosters:[],active:null})]);
    await client.query('COMMIT');
    const t=await createSession(client,{id,token_version:q.rows[0].token_version},req);
    res.cookie('mordheimunda_session',t,{...cookie,maxAge:config.sessionDays*86400000});
    // V153: fire-and-forget the verification email; a failure here (bad
    // SMTP, transient network) must never block the signup itself — the
    // user is already logged in, and the in-app banner will offer "Resend
    // verification email" to try again.
    issueVerificationEmail({id,username:q.rows[0].username,email:q.rows[0].email},{silent:true}).catch(()=>{});
    res.status(201).json({user:pub(q.rows[0])});
  }catch(e){try{await client.query('ROLLBACK')}catch{};next(e)}finally{client.release()}
});

app.post('/api/auth/login',requireDb,requireSameOrigin,async(req,res,next)=>{
  try{
    const login=String(req.body?.login||'').trim(),password=String(req.body?.password||'');
    const q=await pool.query("SELECT id,username,email,password_hash,email_verified_at,is_admin,token_version FROM users WHERE lower(username)=lower($1) OR lower(coalesce(email,''))=lower($1) LIMIT 1",[login]);
    if(!q.rows[0]||!(await safeCompare(password,q.rows[0].password_hash)))return res.status(401).json({error:'INVALID_CREDENTIALS'});
    const u=q.rows[0];
    if(!u.is_admin && isBootstrapAdminEmail(u.email)){await pool.query('UPDATE users SET is_admin=true WHERE id=$1',[u.id]);u.is_admin=true;}
    const t=await createSession(pool,u,req);
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
    let u=(await pool.query('SELECT id,username,email,email_verified_at,is_admin,token_version FROM users WHERE lower(username)=lower($1)',[username])).rows[0];
    if(!u){
      const id=crypto.randomUUID(),ph=await bcrypt.hash(crypto.randomBytes(24).toString('hex'),12);
      u=(await pool.query('INSERT INTO users(id,username,email,password_hash,is_admin) VALUES($1,$2,$3,$4,true) RETURNING id,username,email,email_verified_at,is_admin,token_version',[id,username,email,ph])).rows[0];
      await pool.query('INSERT INTO user_data(user_id,schema_version,payload,revision) VALUES($1,4,$2,1)',[id,JSON.stringify({rosters:[],active:null})]);
    }
    const t=await createSession(pool,u,req);
    res.cookie('mordheimunda_session',t,{...cookie,maxAge:config.sessionDays*86400000});
    res.json({user:pub(u)});
  }catch(e){next(e)}
});

// V152: Dedicated rate limits for the password-reset request flow — 3/h per
// IP AND 3/h per email, on top of the generic /api/auth/ 30/15min limiter
// above. Two chained limiters (rather than one keyed by "ip|email") because
// the plan is strict: "3 req/h par IP et par email" — either quota alone
// tripping counts. The email limiter's key is lowercased+trimmed to match
// how the route itself normalizes the address, so casing tricks can't be
// used to bypass it. The `ip` here is whatever `req.ip` resolves to after
// `trust proxy` (set from TRUST_PROXY on Vercel), which express-rate-limit
// handles safely for both IPv4 and IPv6 via its default keyGenerator.
const forgotPasswordIpLimiter=rateLimit({windowMs:60*60*1000,max:3,standardHeaders:true,legacyHeaders:false,message:{error:'RATE_LIMITED'}});
const forgotPasswordEmailLimiter=rateLimit({windowMs:60*60*1000,max:3,standardHeaders:true,legacyHeaders:false,message:{error:'RATE_LIMITED'},keyGenerator:req=>String(req.body?.email||'').trim().toLowerCase()||ipKeyGenerator(req.ip)});

app.post('/api/auth/forgot-password',requireDb,requireSameOrigin,forgotPasswordIpLimiter,forgotPasswordEmailLimiter,async(req,res,next)=>{
  const email=String(req.body?.email||'').trim().toLowerCase();
  try{
    // Anti-enumeration: the response is identical whether the email matches
    // an account or not (both success and "no such account" return {ok:true}
    // after the same-ish latency). Only the email actually gets sent to a
    // real address on our end.
    if(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      const q=await pool.query('SELECT id,username,email,email_verified_at FROM users WHERE lower(email)=lower($1) LIMIT 1',[email]);
      // V153: skip the send silently for accounts whose email was never
      // confirmed. The response stays {ok:true} (anti-enumeration), so an
      // attacker can't tell an unverified account from a non-existent one;
      // a legitimate owner of an unverified account has to click "Resend
      // verification email" from the in-app banner first.
      if(q.rows[0]&&q.rows[0].email_verified_at){
        // Invalidate every previously-issued unused password token for this
        // user before minting the new one, so an attacker who intercepted an
        // older link (or the user retrying a lost email) can't race two live
        // tokens against each other.
        await pool.query("UPDATE recovery_tokens SET used_at=NOW() WHERE user_id=$1 AND kind='password' AND used_at IS NULL",[q.rows[0].id]);
        const t=token();
        await pool.query("INSERT INTO recovery_tokens(id,user_id,token_hash,kind,expires_at) VALUES($1,$2,$3,'password',NOW()+INTERVAL '15 minutes')",[crypto.randomUUID(),q.rows[0].id,hash(t)]);
        const link=`${config.frontendUrl}/reset-password.html?token=${encodeURIComponent(t)}`;
        const {text,html}=passwordResetEmail({username:q.rows[0].username,link});
        await sendMailQuietly({to:q.rows[0].email,subject:'Reset your Mordheimunda password',text,html});
      }
    }
    res.json({ok:true});
  }catch(e){next(e)}
});

app.post('/api/auth/reset-password',requireDb,requireSameOrigin,async(req,res,next)=>{
  const t=String(req.body?.token||''),password=String(req.body?.password||'');
  // V152 policy: 8+ chars, at least one letter AND at least one digit.
  // Kept intentionally loose ("raisonnable, pas frustrant" per plan) on top
  // of the length bound the existing account-side change-password uses.
  const passwordOk=password.length>=8&&password.length<=128&&/[A-Za-z]/.test(password)&&/[0-9]/.test(password);
  if(t.length<20||!passwordOk)return res.status(400).json({error:'INVALID_RESET'});
  try{
    const q=await pool.query("SELECT id,user_id FROM recovery_tokens WHERE token_hash=$1 AND kind='password' AND used_at IS NULL AND expires_at>NOW() LIMIT 1",[hash(t)]);
    if(!q.rows[0])return res.status(400).json({error:'INVALID_RESET'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      // Bump the user's token_version alongside updating the password — the
      // auth middleware compares this to the version snapshotted on each
      // session at issue time, so any pre-reset session that somehow
      // survives the DELETE below (replica lag, cached row on another pod)
      // still stops working immediately.
      await client.query('UPDATE users SET password_hash=$1,token_version=token_version+1,updated_at=NOW() WHERE id=$2',[await bcrypt.hash(password,12),q.rows[0].user_id]);
      await client.query('UPDATE recovery_tokens SET used_at=NOW() WHERE id=$1',[q.rows[0].id]);
      await client.query('DELETE FROM sessions WHERE user_id=$1',[q.rows[0].user_id]);
      await client.query('COMMIT');
    }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
    res.json({ok:true});
  }catch(e){next(e)}
});

app.post('/api/auth/forgot-username',requireDb,requireSameOrigin,async(req,res,next)=>{const email=String(req.body?.email||'').trim().toLowerCase();try{const q=await pool.query('SELECT username,email FROM users WHERE lower(email)=lower($1) LIMIT 1',[email]);if(q.rows[0])await sendMailQuietly({to:q.rows[0].email,subject:'Mordheimunda — Nom d’utilisateur',text:`Votre nom d’utilisateur Mordheimunda est : ${q.rows[0].username}`});res.json({ok:true})}catch(e){next(e)}});

// V153: confirm an email address from the link sent in verifyEmailEmail().
// Public (token-based, no session required): the click could come from a
// mail client on a device where the user isn't logged in. Marks the token
// used and stamps users.email_verified_at only if not already stamped, so
// re-clicking an already-valid link is a no-op rather than an error.
app.post('/api/auth/verify-email',requireDb,requireSameOrigin,async(req,res,next)=>{
  const t=String(req.body?.token||'');
  if(t.length<20)return res.status(400).json({error:'INVALID_TOKEN'});
  try{
    const q=await pool.query("SELECT id,user_id FROM recovery_tokens WHERE token_hash=$1 AND kind='verify_email' AND used_at IS NULL AND expires_at>NOW() LIMIT 1",[hash(t)]);
    if(!q.rows[0])return res.status(400).json({error:'INVALID_TOKEN'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query('UPDATE users SET email_verified_at=COALESCE(email_verified_at,NOW()),updated_at=NOW() WHERE id=$1',[q.rows[0].user_id]);
      await client.query('UPDATE recovery_tokens SET used_at=NOW() WHERE id=$1',[q.rows[0].id]);
      await client.query('COMMIT');
    }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
    res.json({ok:true});
  }catch(e){next(e)}
});

// V153: resend the verification email for the currently signed-in user.
// Auth-only (the in-app banner calls it), rate-limited to 3/h per user id
// so a stuck banner cannot become an email bomb. If the account is
// already verified we return {ok:true,alreadyVerified:true} rather than
// generating another token — the banner should just hide itself.
const resendVerificationLimiter=rateLimit({windowMs:60*60*1000,max:3,standardHeaders:true,legacyHeaders:false,message:{error:'RATE_LIMITED'},keyGenerator:req=>req.user?.user_id||ipKeyGenerator(req.ip)});
app.post('/api/auth/resend-verification',requireDb,requireSameOrigin,auth,resendVerificationLimiter,async(req,res,next)=>{
  try{
    if(!req.user.email)return res.status(400).json({error:'NO_EMAIL'});
    if(req.user.email_verified_at)return res.json({ok:true,alreadyVerified:true});
    await issueVerificationEmail({id:req.user.user_id,username:req.user.username,email:req.user.email});
    res.json({ok:true});
  }catch(e){next(e)}
});

app.get('/api/account/me',requireDb,auth,(req,res)=>res.json({user:pub(req.user)}));
app.post('/api/account/change-password',requireDb,requireSameOrigin,auth,async(req,res,next)=>{const cur=String(req.body?.currentPassword||''),nextPassword=String(req.body?.newPassword||'');if(nextPassword.length<10||nextPassword.length>128)return res.status(400).json({error:'INVALID_PASSWORD'});try{const q=await pool.query('SELECT password_hash FROM users WHERE id=$1',[req.user.user_id]);if(!q.rows[0]||!(await safeCompare(cur,q.rows[0].password_hash)))return res.status(401).json({error:'INVALID_CREDENTIALS'});await pool.query('UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2',[await bcrypt.hash(nextPassword,12),req.user.user_id]);await pool.query('DELETE FROM sessions WHERE user_id=$1 AND id<>$2',[req.user.user_id,req.user.session_id]);res.json({ok:true})}catch(e){next(e)}});

// V154: change the signed-in user's email address. Requires the current
// password (so a hijacked-but-unlocked browser can't silently redirect
// recovery mails), un-verifies the account and sends a fresh confirmation
// link to the NEW address; the OLD address gets a plain heads-up so the
// real owner can react if it wasn't them. 5/h per user (every attempt,
// including a wrong password, counts) on top of the generic limiter.
const changeEmailLimiter=rateLimit({windowMs:60*60*1000,max:5,standardHeaders:true,legacyHeaders:false,message:{error:'RATE_LIMITED'},keyGenerator:req=>req.user?.user_id||ipKeyGenerator(req.ip)});
app.post('/api/account/change-email',requireDb,requireSameOrigin,auth,changeEmailLimiter,async(req,res,next)=>{
  const email=String(req.body?.newEmail||'').trim().toLowerCase(),cur=String(req.body?.currentPassword||'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return res.status(400).json({error:'INVALID_EMAIL'});
  if(email===String(req.user.email||'').toLowerCase())return res.status(400).json({error:'SAME_EMAIL'});
  try{
    const q=await pool.query('SELECT password_hash FROM users WHERE id=$1',[req.user.user_id]);
    if(!q.rows[0]||!(await safeCompare(cur,q.rows[0].password_hash)))return res.status(401).json({error:'INVALID_CREDENTIALS'});
    const ex=await pool.query('SELECT 1 FROM users WHERE lower(email)=lower($1) AND id<>$2 LIMIT 1',[email,req.user.user_id]);
    if(ex.rowCount)return res.status(409).json({error:'ACCOUNT_EXISTS'});
    const u=(await pool.query('UPDATE users SET email=$1,email_verified_at=NULL,updated_at=NOW() WHERE id=$2 RETURNING id,username,email,email_verified_at,is_admin,token_version',[email,req.user.user_id])).rows[0];
    const verificationSent=await issueVerificationEmail({id:u.id,username:u.username,email:u.email},{silent:true});
    const oldEmail=req.user.email;
    if(oldEmail)sendMail({to:oldEmail,subject:'Your Mordheimunda email was changed',text:`Hail ${u.username},\n\nThe email address on your Mordheimunda account was just changed to: ${email}\n\nIf you made this change, no action is needed.\nIf you did NOT make this change, sign in and change your password immediately, then sign out all other devices from Account → Connected devices.\n\n— Mordheimunda`}).catch(e=>console.error('change-email notice failed:',e.message));
    res.json({ok:true,verificationSent,user:pub(u)});
  }catch(e){next(e)}
});

// V154: per-device session manager. Lists every live session of the
// signed-in user (current one first), lets them revoke a single device, or
// sign out everything else at once. "Revoke others" bumps users.token_version
// — the same lever the password reset uses — and re-stamps only the current
// session with the new version, so any other session anywhere is rejected by
// auth() on its very next request even before the DELETE has propagated.
const isUuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s||''));
app.get('/api/account/sessions',requireDb,auth,async(req,res,next)=>{
  try{
    const q=await pool.query('SELECT id,created_at,last_seen_at,expires_at,user_agent,ip FROM sessions WHERE user_id=$1 AND expires_at>NOW() ORDER BY (id=$2) DESC,COALESCE(last_seen_at,created_at) DESC',[req.user.user_id,req.user.session_id]);
    res.json({sessions:q.rows.map(s=>({id:s.id,current:s.id===req.user.session_id,createdAt:s.created_at,lastSeenAt:s.last_seen_at||s.created_at,expiresAt:s.expires_at,ip:s.ip||null,...describeUserAgent(s.user_agent)}))});
  }catch(e){next(e)}
});
app.delete('/api/account/sessions/:id',requireDb,requireSameOrigin,auth,async(req,res,next)=>{
  const id=String(req.params.id||'');
  if(!isUuid(id))return res.status(404).json({error:'SESSION_NOT_FOUND'});
  if(id===req.user.session_id)return res.status(400).json({error:'CURRENT_SESSION'});
  try{
    const r=await pool.query('DELETE FROM sessions WHERE id=$1 AND user_id=$2',[id,req.user.user_id]);
    if(!r.rowCount)return res.status(404).json({error:'SESSION_NOT_FOUND'});
    res.json({ok:true});
  }catch(e){next(e)}
});
app.post('/api/account/sessions/revoke-others',requireDb,requireSameOrigin,auth,async(req,res,next)=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const v=await client.query('UPDATE users SET token_version=token_version+1,updated_at=NOW() WHERE id=$1 RETURNING token_version',[req.user.user_id]);
    await client.query('UPDATE sessions SET token_version=$1 WHERE id=$2',[v.rows[0].token_version,req.user.session_id]);
    const r=await client.query('DELETE FROM sessions WHERE user_id=$1 AND id<>$2',[req.user.user_id,req.user.session_id]);
    await client.query('COMMIT');
    res.json({ok:true,revoked:r.rowCount});
  }catch(e){try{await client.query('ROLLBACK')}catch{};next(e)}finally{client.release()}
});

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
// V-POOLSCOPEALL: mirrors app.js's own CONTENT_POOL_WARBAND_NAME — the
// synthetic "No warband (available to every warband)" container the Custom-
// tab officialize picker creates on demand (ensureContentPoolWarbandId).
// Needed here too so toOfficialFaction below can tell a pool-published item
// apart from one genuinely scoped to a single real warband.
const CONTENT_POOL_WARBAND_NAME='◇ Contenu Sans Warband (Système — ne pas supprimer)';
// V-WARBANDIDSHAPE (Task #80): official_warbands.id is a raw UUID everywhere
// server-side, but the client has historically used TWO different shapes
// for "which warband": the raw UUID (every admin-list-driven flow — Manage,
// Publish/Unpublish, and importOfficialWarbandForEditing) and the
// `official-<uuid>` form toOfficialFaction hands back as the MERGED
// FACTION's id (which confirmOfficializeCustomWarband mistakenly stored
// straight into cw.officialId). A request built from that second shape
// never matched a row here — silently 404ing instead of saving. Stripping
// an optional 'official-' prefix here makes every one of these routes
// accept either shape, so a stale prefixed id already saved client-side
// keeps working without a separate client migration.
const rawWarbandId=req=>String(req.params.id||'').trim().replace(/^official-/,'');
const toOfficialFaction=row=>{
  const id=`official-${row.id}`;
  // A genuinely custom equipment item (carries customEquipmentId) was scoped
  // to the admin's original custom warband via its old `.factions` id, which
  // is meaningless now. Re-scope it to this new official faction id so the
  // client's existing per-faction equipment restriction keeps working.
  // V-POOLSCOPEALL: EXCEPT when this warband is the "No warband (available
  // to every warband)" content pool — officializing an item there (picking
  // that option in the Custom-tab picker) is the admin explicitly choosing
  // universal availability, but rescoping it to the pool's own synthetic
  // faction id like every other warband made it match NO real warband's id,
  // so warriorBandAllowed/customEquipmentForFaction (client) silently
  // rejected it from every fighter's Band List everywhere — the opposite of
  // "available to every warband" (reported: Lance/Barding/Fireglaive/Iron
  // Fist pushed this way never appeared in any warband's buying list, on any
  // account, while still showing fine in the Référentiel since that lookup
  // never checks factions at all). The '__ALL__' sentinel is recognized by
  // customEquipmentForFaction client-side as "matches every faction".
  const isPool=row.name===CONTENT_POOL_WARBAND_NAME;
  const equipment=arr(row.definition?.equipment).map(e=>e&&e.customEquipmentId?{...e,factions:isPool?['__ALL__']:[id]}:e);
  return {
    id,displayName:row.name,group:'OFFICIAL',budget:1000,
    warriors:arr(row.definition?.warriors),equipment,
    skillTrees:arr(row.definition?.skillTrees),skills:arr(row.definition?.skills),
    magicDomains:arr(row.definition?.magicDomains),spells:arr(row.definition?.spells),
    traits:arr(row.definition?.traits),specialRules:arr(row.definition?.specialRules),
    choices:row.definition?.choices&&typeof row.definition.choices==='object'?row.definition.choices:null,
    bandRuleNames:arr(row.definition?.bandRuleNames),
    creatures:arr(row.definition?.creatures),
    // V-WARBANDIDSHAPE (Task #80): whether an admin has directly edited this
    // warband via the Admin → Gestion editor (PUT with viaAdminEditor:true,
    // below) — the client uses this to stop the ORIGINAL custom-warband
    // owner's "Publier les modifications" republish from silently
    // overwriting whatever the admin added there (a full replace either way,
    // and republishing rebuilds its payload from the owner's own local
    // draft, which never saw the admin's direct edit).
    adminEditedAt:row.admin_edited_at||null,
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
  try{const q=await pool.query("SELECT id,name,definition,supplement_of,admin_edited_at FROM official_warbands WHERE status='published' ORDER BY created_at ASC");res.json({warbands:q.rows.map(toOfficialFaction)})}catch(e){next(e)}
});

app.get('/api/admin/warbands',requireDb,auth,requireAdmin,async(req,res,next)=>{
  try{
    const q=await pool.query(`SELECT ow.id,ow.slug,ow.name,ow.status,ow.supplement_of,ow.created_at,ow.updated_at,ow.admin_edited_at,u.username AS created_by_username
      FROM official_warbands ow LEFT JOIN users u ON u.id=ow.created_by ORDER BY ow.created_at DESC`);
    res.json({warbands:q.rows});
  }catch(e){next(e)}
});

// Full definition of one official warband, for prefilling the edit form —
// the list endpoint above deliberately omits it (it can be sizeable).
app.get('/api/admin/warbands/:id',requireDb,auth,requireAdmin,async(req,res,next)=>{
  try{
    const q=await pool.query('SELECT id,name,status,supplement_of,admin_edited_at,definition FROM official_warbands WHERE id=$1',[rawWarbandId(req)]);
    if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    const row=q.rows[0];
    res.json({warband:{id:row.id,name:row.name,status:row.status,supplementOf:row.supplement_of||null,adminEditedAt:row.admin_edited_at||null,...row.definition}});
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
  // Animals & Mounts (Custom > Animaux & Montures) individually officialized
  // onto this warband — same shape as the client's own state.customCreatures
  // rows ({customCreatureId,kind,name,cost,profile,sv,ruleNames,rules}).
  // Mount-kind entries are turned back into purchasable equipment client-side
  // (see mountCreatureAsEquipment/allCustomCreatureList in app.js); Animal-kind
  // ones are carried here ready for a future standalone-recruitment feature.
  const creatures=arr(body?.creatures);
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
  if(!warriors||!warriors.length||warriors.length>150||equipment.length>600)return {error:'INVALID_DEFINITION'};
  // 500 (was 80): the shared "no warband" content pool carries every
  // free-standing rule/skill/spell, which quickly went past 80.
  if([skillTrees,skills,magicDomains,spells,traits,specialRules].some(a=>a.length>500))return {error:'INVALID_DEFINITION'};
  if(creatures.length>300)return {error:'INVALID_DEFINITION'};
  // Warband choices (tribe at creation, per-fighter Marks, Eye of the Gods…):
  // plain data rendered escaped client-side; kept as an object, size-capped.
  let choices=body?.choices&&typeof body.choices==='object'&&!Array.isArray(body.choices)?body.choices:null;
  if(choices&&Buffer.byteLength(JSON.stringify(choices))>200*1024)return {error:'DATA_TOO_LARGE'};
  if(choices&&!Array.isArray(choices.groups))choices=null;
  const definition={warriors,equipment,skillTrees,skills,magicDomains,spells,traits,specialRules,bandRuleNames,creatures,choices};
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
    if(v.name!==CONTENT_POOL_WARBAND_NAME)await addNews('warband',`${v.name} — new warband`,`/rules/warbands/official-${id}`,req.user.user_id);
    else await newsForWarbandEdit(v.name,'published',null,JSON.parse(v.payload),req.user.user_id);
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
  const id=rawWarbandId(req);
  // V-WARBANDLOCK (Task #80): two different screens can both push a full
  // replacement definition here — the Admin → Gestion direct editor
  // (viaAdminEditor:true below) and the original custom-warband owner's
  // "Publier les modifications" republish (rebuilt from THEIR OWN local
  // draft, which never sees whatever the admin added directly, e.g. a
  // vampire's exclusive skill). Once an admin has edited a warband directly,
  // this warband is "locked" to that editor: a republish from the owner's
  // draft is rejected instead of silently overwriting the admin's changes.
  const viaAdminEditor=!!req.body?.viaAdminEditor;
  try{
    const cur=await pool.query('SELECT admin_edited_at,definition,status FROM official_warbands WHERE id=$1',[id]);
    if(!cur.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    if(cur.rows[0].admin_edited_at&&!viaAdminEditor)return res.status(409).json({error:'ADMIN_LOCKED'});
    // An edit that doesn't mention `choices` keeps the warband's existing ones.
    let payload=v.payload;
    if(req.body?.choices===undefined&&cur.rows[0].definition?.choices){const d=JSON.parse(payload);d.choices=cur.rows[0].definition.choices;payload=JSON.stringify(d)}
    const q=await pool.query(`UPDATE official_warbands SET name=$1,definition=$2,updated_at=NOW()${viaAdminEditor?',admin_edited_at=NOW()':''} WHERE id=$3 RETURNING id,name,definition,supplement_of,admin_edited_at`,[v.name,payload,id]);
    if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    await newsForWarbandEdit(v.name,cur.rows[0].status,cur.rows[0].definition,JSON.parse(payload),req.user.user_id);
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
    const q=await pool.query('UPDATE official_warbands SET supplement_of=$1,updated_at=NOW() WHERE id=$2 RETURNING id,supplement_of',[baseFactionId,rawWarbandId(req)]);
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
    const prev=await pool.query('SELECT status,name FROM official_warbands WHERE id=$1',[rawWarbandId(req)]);
    const q=await pool.query('UPDATE official_warbands SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,status',[status,rawWarbandId(req)]);
    if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    if(status==='published'&&prev.rows[0]?.status==='draft'&&prev.rows[0].name!==CONTENT_POOL_WARBAND_NAME)await addNews('warband',`${prev.rows[0].name} — published again`,`/rules/warbands/official-${q.rows[0].id}`,req.user.user_id);
    res.json({ok:true,status:q.rows[0].status});
  }catch(e){next(e)}
});

// Permanent deletion is only allowed once a warband has been pulled back to
// draft — an admin cannot delete a warband that's still live for every
// account in a single click. Unpublish first (PATCH .../status), confirm,
// then delete.
app.delete('/api/admin/warbands/:id',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{
    const id=rawWarbandId(req);
    const cur=await pool.query('SELECT status FROM official_warbands WHERE id=$1',[id]);
    if(!cur.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    if(cur.rows[0].status!=='draft')return res.status(409).json({error:'MUST_UNPUBLISH_FIRST'});
    const q=await pool.query('DELETE FROM official_warbands WHERE id=$1 RETURNING id',[id]);
    res.json({ok:true});
  }catch(e){next(e)}
});

// ---- Scenarios (admin-authored "battle plans") ----------------------------
// Same whole-payload-replace shape and draft/published lifecycle as official
// warbands above. `definition` carries every section of the scenario; see
// schema.sql for the full field list. The client never builds these from
// book data — they only ever come from here, admin-written.
const SCENARIO_CATEGORIES=['1v1','multiplayers','campaign','event','history'];
const toScenario=row=>({
  id:row.id,name:row.name,category:row.category,
  categories:Array.isArray(row.categories)&&row.categories.length?row.categories:[row.category||'1v1'],
  status:row.status,
  createdAt:row.created_at,updatedAt:row.updated_at,
  ...row.definition
});
function validateScenarioDefinition(body){
  const name=String(body?.name||'').trim();
  // V-SCENARIOS-MULTICAT: a scenario can carry several categories now.
  // `categories` is the real list (deduped, valid values only, at least one);
  // `category` (singular) is kept = categories[0] for any code/query that
  // still reads the old column.
  const rawCats=Array.isArray(body?.categories)?body.categories:(body?.category?[body.category]:[]);
  let categories=[...new Set(rawCats.filter(c=>SCENARIO_CATEGORIES.includes(c)))].slice(0,5);
  if(!categories.length)categories=['1v1'];
  const category=categories[0];
  if(!name||name.length>120)return {error:'INVALID_NAME'};
  const str=(v,max)=>typeof v==='string'?v.slice(0,max):'';
  const num=(v,min,max,def)=>Number.isFinite(+v)?Math.max(min,Math.min(max,+v)):def;
  const arrOf=(v,max,itemMax)=>Array.isArray(v)?v.slice(0,max).map(x=>typeof x==='string'?x.slice(0,itemMax):x):[];
  const definition={
    summary:str(body?.summary,500),
    // V-MAPBUILDER2 / V-PLAYMODE: which fixed table size(s) this scenario
    // can be played on — the deployment-map picker AND the Play-mode random
    // deployment generator only offer/produce maps for an allowed size,
    // since a 48x48 zone layout doesn't make sense stretched onto a 48x72
    // table. tableSizes is the real list (one or both); tableSize (singular)
    // is kept = tableSizes[0] for any older code that still reads it.
    tableSizes:(()=>{const t=[...new Set((Array.isArray(body?.tableSizes)?body.tableSizes:(body?.tableSize?[body.tableSize]:[])).filter(x=>['48x48','48x72'].includes(x)))];return t.length?t:['48x48']})(),
    get tableSize(){return this.tableSizes[0]},
    bandsMin:Number.isFinite(+body?.bandsMin)?Math.max(1,Math.min(10,+body.bandsMin)):2,
    bandsMax:Number.isFinite(+body?.bandsMax)?Math.max(1,Math.min(10,+body.bandsMax)):2,
    battlefield:{terrainType:str(body?.battlefield?.terrainType,300),setupInstructions:str(body?.battlefield?.setupInstructions,2000)},
    roles:{attacker:str(body?.roles?.attacker,1000),defender:str(body?.roles?.defender,1000)},
    preparation:{enabled:!!body?.preparation?.enabled,text:str(body?.preparation?.text,2000)},
    // V-SCNPLAINRULES: plain explanatory text now, not a "Name | Text" rule
    // list — a list fragmented a pasted paragraph into bogus per-line rules.
    // Accepts a plain string going forward; a legacy array (saved before
    // this change) is flattened into one paragraph so older scenarios don't
    // lose their text the next time they're saved.
    specialRules:typeof body?.specialRules==='string'?str(body.specialRules,4000):(Array.isArray(body?.specialRules)?body.specialRules.slice(0,40).map(r=>[r?.name,r?.text].filter(x=>typeof x==='string'&&x).join(' — ')).join('\n\n').slice(0,4000):''),
    // V-SCENARIOS-FORMULA: how many fighters EACH warband fields, decided
    // per band (never pooled/shared across bands). Three modes:
    //  - custom: admin types the exact value/text, shown verbatim, never computed.
    //  - random: a dice formula (count D faces), rolled per band.
    //  - hybrid: a fixed base + one roll of a die, plus automatically half
    //    of that band's own total fighters.
    bandsFormula:{
      mode:['custom','random','hybrid'].includes(body?.bandsFormula?.mode)?body.bandsFormula.mode:'custom',
      customText:str(body?.bandsFormula?.customText,300),
      adjacentText:str(body?.bandsFormula?.adjacentText,500),
      randomDiceCount:num(body?.bandsFormula?.randomDiceCount,1,10,1),
      randomDiceFaces:num(body?.bandsFormula?.randomDiceFaces,2,100,6),
      hybridBase:num(body?.bandsFormula?.hybridBase,0,50,0),
      hybridDieFaces:num(body?.bandsFormula?.hybridDieFaces,2,100,6)
    },
    // V-SCNPLAINRULES: same fix as specialRules — plain text, not a
    // "Threshold | Reward" list (which fragmented a pasted paragraph).
    underdogBonus:typeof body?.underdogBonus==='string'?str(body.underdogBonus,2000):(Array.isArray(body?.underdogBonus)?body.underdogBonus.slice(0,10).map(u=>[u?.threshold,u?.reward].filter(x=>typeof x==='string'&&x).join(' — ')).join('\n\n').slice(0,2000):''),
    deployment:{tableEdgeRule:str(body?.deployment?.tableEdgeRule,2000),zones:arrOf(body?.deployment?.zones,20,200),mapIds:Array.isArray(body?.deployment?.mapIds)?body.deployment.mapIds.filter(x=>typeof x==='string').slice(0,200):[]},
    experience:Array.isArray(body?.experience)?body.experience.slice(0,20).map(x=>({name:str(x?.name,120),text:str(x?.text,500)})):[],
    objectives:{primary:str(body?.objectives?.primary,2000),secondary:str(body?.objectives?.secondary,2000)},
    endCondition:str(body?.endCondition,2000),
    victory:{major:str(body?.victory?.major,1000),minor:str(body?.victory?.minor,1000),draw:str(body?.victory?.draw,1000)},
    rewards:arrOf(body?.rewards,30,300),
    campaignSeries:{seriesId:str(body?.campaignSeries?.seriesId,120),seriesName:str(body?.campaignSeries?.seriesName,120),position:str(body?.campaignSeries?.position,20)},
    eventWindow:{start:str(body?.eventWindow?.start,40),end:str(body?.eventWindow?.end,40)},
    // Only real images: an uploaded data:image (png/jpeg/webp/gif) or an https URL.
    thumbnail:(()=>{const v=str(body?.thumbnail,2*1024*1024);return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v)||/^https:\/\/[^\s"'<>]+$/.test(v)?v:''})(),
    thumbnailFocus:(()=>{const f=body?.thumbnailFocus;if(!f||typeof f!=='object')return null;const n=(v,lo,hi,d)=>{const x=Number(v);return Number.isFinite(x)?Math.max(lo,Math.min(hi,x)):d};return {x:n(f.x,0,1,0.5),y:n(f.y,0,1,0.5),zoom:n(f.zoom,1,2.5,1)}})()
  };
  const payload=JSON.stringify(definition);
  if(Buffer.byteLength(payload)>4*1024*1024)return {error:'DATA_TOO_LARGE'};
  return {name,category,categories,payload};
}

app.get('/api/scenarios',requireDb,async(req,res,next)=>{
  // Public feed: published only, same semantics as /api/warbands/official.
  try{const q=await pool.query("SELECT id,name,category,categories,status,definition,created_at,updated_at FROM scenarios WHERE status='published' ORDER BY created_at ASC");res.json({scenarios:q.rows.map(toScenario)})}catch(e){next(e)}
});

app.get('/api/admin/scenarios',requireDb,auth,requireAdmin,async(req,res,next)=>{
  try{const q=await pool.query('SELECT id,name,category,categories,status,created_at,updated_at FROM scenarios ORDER BY created_at DESC');res.json({scenarios:q.rows.map(toScenario)})}catch(e){next(e)}
});

app.get('/api/admin/scenarios/:id',requireDb,auth,requireAdmin,async(req,res,next)=>{
  try{
    const q=await pool.query('SELECT id,name,category,categories,status,definition,created_at,updated_at FROM scenarios WHERE id=$1',[req.params.id]);
    if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    res.json({scenario:toScenario(q.rows[0])});
  }catch(e){next(e)}
});

app.post('/api/admin/scenarios',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const v=validateScenarioDefinition(req.body);
  if(v.error)return res.status(v.error==='DATA_TOO_LARGE'?413:400).json({error:v.error});
  try{
    const base=slugify(v.name)||'scenario';
    let slug=base,suffix=1;
    // eslint-disable-next-line no-constant-condition
    while(true){
      const clash=await pool.query('SELECT 1 FROM scenarios WHERE slug=$1',[slug]);
      if(!clash.rowCount)break;
      slug=`${base}-${++suffix}`;
    }
    const id=crypto.randomUUID();
    const q=await pool.query('INSERT INTO scenarios(id,slug,name,category,categories,definition,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,category,categories,status,definition,created_at,updated_at',[id,slug,v.name,v.category,JSON.stringify(v.categories),v.payload,req.user.user_id]);
    res.status(201).json({scenario:toScenario(q.rows[0])});
  }catch(e){next(e)}
});

app.put('/api/admin/scenarios/:id',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const v=validateScenarioDefinition(req.body);
  if(v.error)return res.status(v.error==='DATA_TOO_LARGE'?413:400).json({error:v.error});
  try{
    const q=await pool.query('UPDATE scenarios SET name=$1,category=$2,categories=$3,definition=$4,updated_at=NOW() WHERE id=$5 RETURNING id,name,category,categories,status,definition,created_at,updated_at',[v.name,v.category,JSON.stringify(v.categories),v.payload,req.params.id]);
    if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    res.json({scenario:toScenario(q.rows[0])});
  }catch(e){next(e)}
});

app.patch('/api/admin/scenarios/:id/status',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const status=req.body?.status;
  if(status!=='draft'&&status!=='published')return res.status(400).json({error:'INVALID_STATUS'});
  try{
    const prev=await pool.query('SELECT status,name FROM scenarios WHERE id=$1',[req.params.id]);
    const q=await pool.query('UPDATE scenarios SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,status',[status,req.params.id]);
    if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    if(status==='published'&&prev.rows[0]?.status!=='published')await addNews('scenario',`${prev.rows[0].name} — new scenario`,`/rules/scenarios/${req.params.id}`,req.user.user_id);
    res.json({ok:true,status:q.rows[0].status});
  }catch(e){next(e)}
});

app.delete('/api/admin/scenarios/:id',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{
    const cur=await pool.query('SELECT status FROM scenarios WHERE id=$1',[req.params.id]);
    if(!cur.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    if(cur.rows[0].status!=='draft')return res.status(409).json({error:'MUST_UNPUBLISH_FIRST'});
    await pool.query('DELETE FROM scenarios WHERE id=$1',[req.params.id]);
    res.json({ok:true});
  }catch(e){next(e)}
});

// ---- Campaigns (V-CAMPAIGNS) ----------------------------------------------
// Admins create and edit campaigns; players read the published ones and
// enter / withdraw their own warbands (one campaign per warband at a time).
const CAMPAIGN_COLOR=/^#[0-9a-f]{6}$/i;
const campaignCode=()=>crypto.randomBytes(5).toString('base64url').replace(/[^A-Za-z0-9]/g,'').slice(0,6).toUpperCase().padEnd(6,'X');
function validateCampaign(body){
  const name=String(body?.name||'').trim();
  if(!name||name.length>80)return {error:'INVALID_NAME'};
  const color=CAMPAIGN_COLOR.test(String(body?.color||''))?String(body.color):'#ff8a3d';
  const def=body?.definition&&typeof body.definition==='object'&&!Array.isArray(body.definition)?body.definition:{};
  const payload=JSON.stringify(def);
  if(Buffer.byteLength(payload)>2*1024*1024)return {error:'DATA_TOO_LARGE'};
  return {name,color,payload};
}
const toCampaign=(row,members)=>({id:row.id,name:row.name,color:row.color,status:row.status,joinCode:row.join_code,definition:row.definition||{},createdAt:row.created_at,updatedAt:row.updated_at,...(members?{members}:{})});
const toMember=r=>({rosterId:r.roster_id,userId:r.user_id,username:r.username||'',rosterName:r.roster_name,faction:r.faction,stats:r.stats||{},joinedAt:r.joined_at,leftAt:r.left_at});
async function campaignMembers(id){const q=await pool.query('SELECT m.*,u.username FROM campaign_members m LEFT JOIN users u ON u.id=m.user_id WHERE m.campaign_id=$1 ORDER BY m.joined_at ASC',[id]);return q.rows.map(toMember)}
app.get('/api/campaigns',requireDb,async(req,res,next)=>{
  try{const q=await pool.query("SELECT c.*,(SELECT COUNT(*) FROM campaign_members m WHERE m.campaign_id=c.id AND m.left_at IS NULL)::int AS member_count FROM campaigns c WHERE status='published' ORDER BY created_at ASC");res.json({campaigns:q.rows.map(r=>({...toCampaign(r),joinCode:undefined,memberCount:r.member_count}))})}catch(e){next(e)}
});
app.get('/api/campaigns/:id',requireDb,async(req,res,next)=>{
  try{const q=await pool.query("SELECT * FROM campaigns WHERE id=$1 AND status='published'",[req.params.id]);if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});res.json({campaign:{...toCampaign(q.rows[0],await campaignMembers(req.params.id)),joinCode:undefined}})}catch(e){next(e)}
});
// The signed-in player's entries (and the campaigns they are in).
app.get('/api/account/campaigns',requireDb,auth,async(req,res,next)=>{
  try{const q=await pool.query('SELECT m.*,c.name AS campaign_name,c.color AS campaign_color,c.status AS campaign_status FROM campaign_members m JOIN campaigns c ON c.id=m.campaign_id WHERE m.user_id=$1 ORDER BY m.joined_at DESC',[req.user.user_id]);res.json({entries:q.rows.map(r=>({...toMember(r),campaignId:r.campaign_id,campaignName:r.campaign_name,campaignColor:r.campaign_color,campaignStatus:r.campaign_status}))})}catch(e){next(e)}
});
async function joinCampaign(req,res,campaignRow){
  const rosterId=String(req.body?.rosterId||'').trim().slice(0,120);
  if(!rosterId)return res.status(400).json({error:'INVALID_ROSTER'});
  const rosterName=String(req.body?.rosterName||'').trim().slice(0,80),faction=String(req.body?.faction||'').trim().slice(0,80);
  const other=await pool.query('SELECT campaign_id FROM campaign_members WHERE user_id=$1 AND roster_id=$2 AND left_at IS NULL AND campaign_id<>$3',[req.user.user_id,rosterId,campaignRow.id]);
  if(other.rowCount)return res.status(409).json({error:'ALREADY_IN_A_CAMPAIGN'});
  const taken=await pool.query('SELECT user_id FROM campaign_members WHERE campaign_id=$1 AND roster_id=$2',[campaignRow.id,rosterId]);
  if(taken.rowCount&&taken.rows[0].user_id!==req.user.user_id)return res.status(409).json({error:'ROSTER_ID_TAKEN'});
  await pool.query(`INSERT INTO campaign_members(campaign_id,roster_id,user_id,roster_name,faction) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT (campaign_id,roster_id) DO UPDATE SET roster_name=EXCLUDED.roster_name,faction=EXCLUDED.faction,left_at=NULL,joined_at=CASE WHEN campaign_members.left_at IS NULL THEN campaign_members.joined_at ELSE NOW() END`,[campaignRow.id,rosterId,req.user.user_id,rosterName,faction]);
  res.json({ok:true,campaign:{id:campaignRow.id,name:campaignRow.name,color:campaignRow.color}});
}
app.post('/api/campaigns/:id/join',requireDb,requireSameOrigin,auth,async(req,res,next)=>{
  try{const q=await pool.query("SELECT * FROM campaigns WHERE id=$1 AND status='published'",[req.params.id]);if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});await joinCampaign(req,res,q.rows[0])}catch(e){next(e)}
});
app.post('/api/campaigns/join-code',requireDb,requireSameOrigin,auth,async(req,res,next)=>{
  try{const code=String(req.body?.code||'').trim().toUpperCase();const q=await pool.query("SELECT * FROM campaigns WHERE join_code=$1 AND status='published'",[code]);if(!q.rowCount)return res.status(404).json({error:'CODE_NOT_FOUND'});await joinCampaign(req,res,q.rows[0])}catch(e){next(e)}
});
app.post('/api/campaigns/:id/leave',requireDb,requireSameOrigin,auth,async(req,res,next)=>{
  try{const rosterId=String(req.body?.rosterId||'');const q=await pool.query('UPDATE campaign_members SET left_at=NOW() WHERE campaign_id=$1 AND roster_id=$2 AND user_id=$3 AND left_at IS NULL',[req.params.id,rosterId,req.user.user_id]);res.json({ok:true,left:q.rowCount})}catch(e){next(e)}
});
// Updates the public line of the player's own entry (name, rating…).
app.put('/api/campaigns/:id/entry',requireDb,requireSameOrigin,auth,async(req,res,next)=>{
  try{const rosterId=String(req.body?.rosterId||'');const stats=req.body?.stats&&typeof req.body.stats==='object'?req.body.stats:{};if(Buffer.byteLength(JSON.stringify(stats))>20000)return res.status(413).json({error:'DATA_TOO_LARGE'});
    const q=await pool.query('UPDATE campaign_members SET roster_name=COALESCE($4,roster_name),stats=$5 WHERE campaign_id=$1 AND roster_id=$2 AND user_id=$3 RETURNING roster_id',[req.params.id,rosterId,req.user.user_id,req.body?.rosterName?String(req.body.rosterName).slice(0,80):null,JSON.stringify(stats)]);res.json({ok:true,updated:q.rowCount})}catch(e){next(e)}
});
app.get('/api/admin/campaigns',requireDb,auth,requireAdmin,async(req,res,next)=>{
  try{const q=await pool.query('SELECT * FROM campaigns ORDER BY created_at DESC');res.json({campaigns:q.rows.map(r=>toCampaign(r))})}catch(e){next(e)}
});
app.get('/api/admin/campaigns/:id',requireDb,auth,requireAdmin,async(req,res,next)=>{
  try{const q=await pool.query('SELECT * FROM campaigns WHERE id=$1',[req.params.id]);if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});res.json({campaign:toCampaign(q.rows[0],await campaignMembers(req.params.id))})}catch(e){next(e)}
});
app.post('/api/admin/campaigns',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const v=validateCampaign(req.body);if(v.error)return res.status(v.error==='DATA_TOO_LARGE'?413:400).json({error:v.error});
  try{let code=campaignCode();for(let i=0;i<5;i++){const c=await pool.query('SELECT 1 FROM campaigns WHERE join_code=$1',[code]);if(!c.rowCount)break;code=campaignCode()}
    const q=await pool.query('INSERT INTO campaigns(id,name,color,join_code,definition,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[crypto.randomUUID(),v.name,v.color,code,v.payload,req.user.user_id]);res.status(201).json({campaign:toCampaign(q.rows[0])})}catch(e){next(e)}
});
app.put('/api/admin/campaigns/:id',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const v=validateCampaign(req.body);if(v.error)return res.status(v.error==='DATA_TOO_LARGE'?413:400).json({error:v.error});
  try{const q=await pool.query('UPDATE campaigns SET name=$1,color=$2,definition=$3,updated_at=NOW() WHERE id=$4 RETURNING *',[v.name,v.color,v.payload,req.params.id]);if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});res.json({campaign:toCampaign(q.rows[0])})}catch(e){next(e)}
});
app.patch('/api/admin/campaigns/:id/status',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const status=req.body?.status==='published'?'published':'draft';
  try{const prev=await pool.query('SELECT status,name FROM campaigns WHERE id=$1',[req.params.id]);const q=await pool.query('UPDATE campaigns SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,status',[status,req.params.id]);if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});if(status==='published'&&prev.rows[0]?.status!=='published')await addNews('campaign',`${prev.rows[0].name} — campaign opened`,`/rules/campaign/${req.params.id}`,req.user.user_id);res.json({ok:true,status})}catch(e){next(e)}
});
app.post('/api/admin/campaigns/:id/code',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{const code=campaignCode();const q=await pool.query('UPDATE campaigns SET join_code=$1 WHERE id=$2 RETURNING join_code',[code,req.params.id]);if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});res.json({joinCode:q.rows[0].join_code})}catch(e){next(e)}
});
app.delete('/api/admin/campaigns/:id',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{const cur=await pool.query('SELECT status FROM campaigns WHERE id=$1',[req.params.id]);if(!cur.rowCount)return res.status(404).json({error:'NOT_FOUND'});if(cur.rows[0].status!=='draft')return res.status(409).json({error:'MUST_UNPUBLISH_FIRST'});await pool.query('DELETE FROM campaigns WHERE id=$1',[req.params.id]);res.json({ok:true})}catch(e){next(e)}
});

// ---- Home page: site news + Active Event (V-HOME) -------------------------
const NEWS_KINDS=['warband','hired-sword','fighter','campaign','scenario','update'];
async function addNews(kind,title,link,userId){
  try{await pool.query('INSERT INTO site_news(id,kind,title,link,created_by) VALUES($1,$2,$3,$4,$5)',[crypto.randomUUID(),NEWS_KINDS.includes(kind)?kind:'update',String(title||'').slice(0,160),String(link||'').slice(0,300),userId||null])}catch(e){console.warn('addNews failed',e.message)}
}
const toNews=r=>({id:r.id,kind:r.kind,title:r.title,link:r.link,createdAt:r.created_at});
const warriorIsHS=w=>!!w&&(w.hiredSword===true||w.type==='Hired Sword');
// New warriors of an edited, published warband become news — Hired Swords
// on their own, others as "X joins <warband>".
async function newsForWarbandEdit(name,status,before,after,userId){
  if(status!=='published')return;
  const old=new Set((before?.warriors||[]).map(w=>String(w?.name||'').toLowerCase()));
  for(const w of (after?.warriors||[])){
    const n=String(w?.name||'');if(!n||old.has(n.toLowerCase()))continue;
    if(warriorIsHS(w))await addNews('hired-sword',`${n} — new Hired Sword`,'/rules/warbands/hired-swords',userId);
    else if(name!==CONTENT_POOL_WARBAND_NAME)await addNews('fighter',`${n} joins ${name}`,'',userId);
  }
}
app.get('/api/home',requireDb,async(req,res,next)=>{
  try{
    const n=await pool.query('SELECT * FROM site_news ORDER BY created_at DESC LIMIT 12');
    const e=await pool.query("SELECT value,updated_at FROM site_settings WHERE key='activeEvent'");
    res.json({news:n.rows.map(toNews),event:e.rowCount?{...e.rows[0].value,updatedAt:e.rows[0].updated_at}:null});
  }catch(e){next(e)}
});
app.put('/api/admin/home/event',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const b=req.body||{};const clip=(v,n)=>String(v||'').slice(0,n);
  const value={title:clip(b.title,120),text:clip(b.text,2000),campaignId:clip(b.campaignId,80),link:clip(b.link,300),label:clip(b.label,40)};
  try{
    if(!value.title&&!value.text){await pool.query("DELETE FROM site_settings WHERE key='activeEvent'");return res.json({event:null})}
    await pool.query("INSERT INTO site_settings(key,value,updated_at) VALUES('activeEvent',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",[JSON.stringify(value)]);
    res.json({event:value});
  }catch(e){next(e)}
});
app.post('/api/admin/news',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const title=String(req.body?.title||'').trim();if(!title)return res.status(400).json({error:'INVALID_TITLE'});
  try{await addNews(req.body?.kind||'update',title,req.body?.link||'',req.user.user_id);res.status(201).json({ok:true})}catch(e){next(e)}
});
app.delete('/api/admin/news/:id',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{await pool.query('DELETE FROM site_news WHERE id=$1',[req.params.id]);res.json({ok:true})}catch(e){next(e)}
});

// ---- Deployment maps (admin-managed library of numbered map images) ------
// A map is EITHER an uploaded raster image (inline data URL, same convention
// app.js already uses for fighter/warband portraits) OR a vector map built
// in the admin's own in-browser map builder (V-MAPBUILDER2) — a small shape
// list on a fixed 48"x48" or 48"x72" table, rendered client-side as flat
// SVG, so nothing here depends on any outside artwork. Visible to everyone
// (needed to render a drawn card in Play), writable by admins.
const toDeploymentMap=row=>({id:row.id,number:row.number,name:row.name,image:row.image,shapes:row.shapes&&row.shapes.tableInches&&Array.isArray(row.shapes.items)?row.shapes:{tableInches:{w:48,h:48},items:[]}});
const DEPLOY_SHAPE_TYPES=['circle','rect','tri','line','token','text'];
const DEPLOY_PALETTE_KEYS=['accent','accent2','muted','danger','info','wip','arcane','line','text'];
const DEPLOY_TOKEN_ICONS=['dot','star','skull','flag','cross','chest','warning','ring'];
// V-MAPFIELDLOSS: the client (assets/app.js) always works with the 48"x72"
// table expressed in ITS OWN landscape convention ({w:72,h:48} — see its own
// DEPLOY_TABLE_SIZES and mapShapesToLandscape, which runs unconditionally on
// every map-builder load) — never the portrait {w:48,h:72} this list used to
// require. Every save of a non-square map therefore failed this exact-match
// check, silently fell back to the 48x48 default, and corrupted the table's
// whole coordinate space (positions shifting/landing off-canvas, reading as
// "shapes disappeared"). Both orientations are accepted here so a save never
// depends on which convention happened to be in memory, and legacy rows
// saved the old (portrait) way still match too.
const DEPLOY_TABLE_SIZES=[{w:48,h:48},{w:48,h:72},{w:72,h:48}];
function validateDeploymentShapes(raw){
  const tiRaw=raw?.tableInches;
  const tableInches=DEPLOY_TABLE_SIZES.find(s=>s.w===+tiRaw?.w&&s.h===+tiRaw?.h)||{w:48,h:48};
  const num=v=>Number.isFinite(+v)?+v:0;
  const str=(v,max)=>typeof v==='string'?v.slice(0,max):'';
  const col=v=>DEPLOY_PALETTE_KEYS.includes(v)?v:'accent';
  // V-MAPFIELDLOSS: these optional per-item fields are genuine, user-set map-
  // builder state (arrival-marker glyph, "circle outline hidden" toggle,
  // per-axis "don't show the wall-distance number" toggle, border anchoring
  // for circles) that the client reads back on every render/resize — they
  // were being silently dropped on every save because this validator never
  // copied them through, which is also why "only some shapes" looked broken
  // (only the ones actually using one of these optional fields).
  const bool=v=>v===true;
  // V-AXISANCHOR: an axis can be independently unset (null) — e.g. a circle
  // pinned to the vertical center line (fx:0.5) with its Y free to keep a
  // fixed wall distance (fy:null). The old check ran every axis through
  // fracs.includes(+v.fx) — and +null is 0, which IS one of the fracs — so a
  // free axis was silently coerced into "locked at 0%" on every save,
  // corrupting the per-axis anchor the moment it left the client. Each axis
  // is now validated independently, with null staying null.
  const anchorAxis=f=>{
    if(f==null)return null;
    const fracs=[0,0.25,0.5,0.75,1];
    return fracs.includes(+f)?+f:null;
  };
  const anchor=v=>{
    if(!v||typeof v!=='object')return null;
    const fx=anchorAxis(v.fx),fy=anchorAxis(v.fy);
    if(fx==null&&fy==null)return null;
    return {fx,fy};
  };
  const items=(Array.isArray(raw?.items)?raw.items:[]).slice(0,120).map(it=>{
    if(!DEPLOY_SHAPE_TYPES.includes(it?.type))return null;
    const base={type:it.type,color:col(it.color),label:str(it.label,60)};
    if(it.type==='circle'){
      const o={...base,cx:num(it.cx),cy:num(it.cy),r:Math.max(4,num(it.r))};
      if(it.marker==='turn1'||it.marker==='turn2')o.marker=it.marker;
      if(bool(it.noCircle))o.noCircle=true;
      if(bool(it.noDimX))o.noDimX=true;
      if(bool(it.noDimY))o.noDimY=true;
      const a=anchor(it.anchor);if(a)o.anchor=a;
      return o;
    }
    if(it.type==='rect'){
      const o={...base,x:num(it.x),y:num(it.y),w:Math.max(4,num(it.w)),h:Math.max(4,num(it.h))};
      if(bool(it.noDimX))o.noDimX=true;
      if(bool(it.noDimY))o.noDimY=true;
      return o;
    }
    if(it.type==='tri')return {...base,corner:['nw','ne','sw','se'].includes(it.corner)?it.corner:'nw',size:Math.max(4,num(it.size))};
    if(it.type==='line')return {...base,x1:num(it.x1),y1:num(it.y1),x2:num(it.x2),y2:num(it.y2),dash:!!it.dash};
    if(it.type==='token')return {...base,cx:num(it.cx),cy:num(it.cy),number:str(it.number,10),icon:DEPLOY_TOKEN_ICONS.includes(it.icon)?it.icon:'dot'};
    if(it.type==='text')return {...base,x:num(it.x),y:num(it.y),text:str(it.text,80),size:Math.max(8,Math.min(28,num(it.size)||11))};
    return null;
  }).filter(Boolean);
  return {tableInches,items};
}

app.get('/api/deployment-maps',requireDb,async(req,res,next)=>{
  try{const q=await pool.query('SELECT id,number,name,image,shapes FROM deployment_maps ORDER BY number ASC');res.json({maps:q.rows.map(toDeploymentMap)})}catch(e){next(e)}
});

app.post('/api/admin/deployment-maps',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const name=String(req.body?.name||'').trim().slice(0,120);
  const image=String(req.body?.image||'');
  const hasImage=image.startsWith('data:image/');
  const shapes=validateDeploymentShapes(req.body?.shapes);
  if(!hasImage&&!shapes.items.length)return res.status(400).json({error:'INVALID_MAP'});
  if(hasImage&&Buffer.byteLength(image)>3*1024*1024)return res.status(413).json({error:'DATA_TOO_LARGE'});
  try{
    const id=crypto.randomUUID();
    const q=await pool.query('INSERT INTO deployment_maps(id,name,image,shapes,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id,number,name,image,shapes',[id,name,hasImage?image:'',JSON.stringify(shapes),req.user.user_id]);
    res.status(201).json({map:toDeploymentMap(q.rows[0])});
  }catch(e){next(e)}
});

app.put('/api/admin/deployment-maps/:id',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const name=String(req.body?.name||'').trim().slice(0,120);
  const shapes=validateDeploymentShapes(req.body?.shapes);
  try{
    const q=shapes.items.length
      ? await pool.query('UPDATE deployment_maps SET name=$1,shapes=$2 WHERE id=$3 RETURNING id,number,name,image,shapes',[name,JSON.stringify(shapes),req.params.id])
      : await pool.query('UPDATE deployment_maps SET name=$1 WHERE id=$2 RETURNING id,number,name,image,shapes',[name,req.params.id]);
    if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    res.json({map:toDeploymentMap(q.rows[0])});
  }catch(e){next(e)}
});

app.delete('/api/admin/deployment-maps/:id',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{
    await pool.query('DELETE FROM deployment_maps WHERE id=$1',[req.params.id]);
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
// V-RULEIMAGES: an admin uploads a picture (data URL, already downscaled
// client-side), gets an id, and the rule text carries [IMG id=…]. Served
// publicly with a long cache: an id never changes content.
const RULE_IMAGE_TYPES=['image/png','image/jpeg','image/webp','image/gif'];
app.post('/api/admin/rule-images',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const m=String(req.body?.dataUrl||'').match(/^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/);
  if(!m||!RULE_IMAGE_TYPES.includes(m[1]))return res.status(400).json({error:'INVALID_IMAGE'});
  const buf=Buffer.from(m[2],'base64');
  if(!buf.length||buf.length>3*1024*1024)return res.status(413).json({error:'IMAGE_TOO_LARGE'});
  try{const id=crypto.randomUUID();await pool.query('INSERT INTO rule_images(id,mime,data,created_by) VALUES($1,$2,$3,$4)',[id,m[1],buf,req.user.user_id]);res.status(201).json({id})}catch(e){next(e)}
});
app.get('/api/rule-images/:id',requireDb,async(req,res,next)=>{
  if(!/^[0-9a-f-]{36}$/i.test(req.params.id))return res.status(404).end();
  try{const q=await pool.query('SELECT mime,data FROM rule_images WHERE id=$1',[req.params.id]);if(!q.rowCount)return res.status(404).end();
    res.setHeader('Content-Type',q.rows[0].mime);res.setHeader('Cache-Control','public, max-age=31536000, immutable');res.send(q.rows[0].data)}catch(e){next(e)}
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
    const q=await pool.query('SELECT faction_id,warriors,equipment,band_rule_names,traits,special_rules,skill_trees,skills,magic_domains,spells,updated_at,display_name FROM catalog_overrides');
    res.json({overrides:q.rows.map(r=>({factionId:r.faction_id,displayName:r.display_name||null,warriors:r.warriors,equipment:r.equipment,bandRuleNames:r.band_rule_names,traits:r.traits,specialRules:r.special_rules,skillTrees:r.skill_trees,skills:r.skills,magicDomains:r.magic_domains,spells:r.spells,updatedAt:r.updated_at}))});
  }catch(e){next(e)}
});
app.put('/api/admin/catalog/overrides/:factionId',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const factionId=String(req.params.factionId||'').trim();
  const warriors=Array.isArray(req.body?.warriors)?req.body.warriors:null;
  const equipment=Array.isArray(req.body?.equipment)?req.body.equipment:null;
  // V151: the rest of the warband-linked content (rules/traits/skills/magic),
  // same optional-and-defaulted-to-[] shape as official_warbands.definition.
  const bandRuleNames=Array.isArray(req.body?.bandRuleNames)?req.body.bandRuleNames:[];
  const traits=Array.isArray(req.body?.traits)?req.body.traits:[];
  const specialRules=Array.isArray(req.body?.specialRules)?req.body.specialRules:[];
  const skillTrees=Array.isArray(req.body?.skillTrees)?req.body.skillTrees:[];
  const skills=Array.isArray(req.body?.skills)?req.body.skills:[];
  const magicDomains=Array.isArray(req.body?.magicDomains)?req.body.magicDomains:[];
  const spells=Array.isArray(req.body?.spells)?req.body.spells:[];
  const displayName=String(req.body?.displayName||'').trim().slice(0,80)||null;
  if(!factionId||!warriors||!warriors.length||warriors.length>80||!equipment||equipment.length>400)return res.status(400).json({error:'INVALID_OVERRIDE'});
  if(bandRuleNames.length>200||traits.length>200||specialRules.length>200||skillTrees.length>40||skills.length>400||magicDomains.length>40||spells.length>400)return res.status(400).json({error:'INVALID_OVERRIDE'});
  const wPayload=JSON.stringify(warriors),ePayload=JSON.stringify(equipment);
  const brnPayload=JSON.stringify(bandRuleNames),trPayload=JSON.stringify(traits),srPayload=JSON.stringify(specialRules);
  const stPayload=JSON.stringify(skillTrees),skPayload=JSON.stringify(skills),mdPayload=JSON.stringify(magicDomains),spPayload=JSON.stringify(spells);
  const totalBytes=[wPayload,ePayload,brnPayload,trPayload,srPayload,stPayload,skPayload,mdPayload,spPayload].reduce((s,p)=>s+Buffer.byteLength(p),0);
  if(totalBytes>2*1024*1024)return res.status(413).json({error:'DATA_TOO_LARGE'});
  try{
    await pool.query(`INSERT INTO catalog_overrides(faction_id,warriors,equipment,band_rule_names,traits,special_rules,skill_trees,skills,magic_domains,spells,updated_by,updated_at,display_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),$12)
      ON CONFLICT (faction_id) DO UPDATE SET warriors=EXCLUDED.warriors,equipment=EXCLUDED.equipment,band_rule_names=EXCLUDED.band_rule_names,traits=EXCLUDED.traits,special_rules=EXCLUDED.special_rules,skill_trees=EXCLUDED.skill_trees,skills=EXCLUDED.skills,magic_domains=EXCLUDED.magic_domains,spells=EXCLUDED.spells,updated_by=EXCLUDED.updated_by,updated_at=NOW(),display_name=EXCLUDED.display_name`,
      [factionId,wPayload,ePayload,brnPayload,trPayload,srPayload,stPayload,skPayload,mdPayload,spPayload,req.user.user_id,displayName]);
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

// Racial stat maximums (V-RACEMAX): public read, admin-only write.
app.get('/api/catalog/race-maximums',requireDb,async(req,res,next)=>{
  try{
    const q=await pool.query('SELECT race,maxima,updated_at FROM race_stat_maximums');
    res.json({maximums:q.rows.map(r=>({race:r.race,maxima:r.maxima,updatedAt:r.updated_at}))});
  }catch(e){next(e)}
});
app.put('/api/admin/catalog/race-maximums/:race',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const race=String(req.params.race||'').trim();
  const raw=req.body?.maxima;
  if(!race||race.length>RACE_TAG_MAX_LEN||!Array.isArray(raw)||raw.length>20)return res.status(400).json({error:'INVALID_RACE_MAXIMUMS'});
  const maxima=raw.map(v=>v===null||v===''||v===undefined?null:Number(v)).map(v=>v===null||!Number.isFinite(v)?null:Math.max(0,Math.min(99,Math.round(v))));
  try{
    await pool.query(`INSERT INTO race_stat_maximums(race,maxima,updated_by,updated_at) VALUES($1,$2,$3,NOW())
      ON CONFLICT (race) DO UPDATE SET maxima=EXCLUDED.maxima,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[race,JSON.stringify(maxima),req.user.user_id]);
    res.json({ok:true});
  }catch(e){next(e)}
});
app.delete('/api/admin/catalog/race-maximums/:race',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{
    await pool.query('DELETE FROM race_stat_maximums WHERE race=$1',[String(req.params.race||'').trim()]);
    res.json({ok:true});
  }catch(e){next(e)}
});

// Warband categories (V-WBCATEGORIES): "créer des catégories qui
// ressembleraient à une warband pour en mettre des warband officielle en
// sous warband. Mais la grande serait vide" — an empty, race-scoped
// organizational shell (e.g. "Human Mercenaries") that several standalone,
// fully playable warbands can be grouped under on the Rules: Warbands
// directory. It never carries a roster/definition of its own and has no
// detail page — purely a label a faction_id can be filed under. Distinct
// from official_warbands.supplement_of (one warband that IS a variant of a
// single base warband, e.g. Blood Dragons of Undead): a category groups
// several independent warbands side by side. Public read, admin-only write.
const FACTION_CATEGORY_NAME_MAX_LEN=60;
app.get('/api/catalog/faction-categories',requireDb,async(req,res,next)=>{
  try{
    const cats=await pool.query('SELECT id,race,name,sort_order,updated_at FROM faction_categories ORDER BY race,sort_order,name');
    const mem=await pool.query('SELECT faction_id,category_id FROM faction_category_members');
    res.json({
      categories:cats.rows.map(r=>({id:r.id,race:r.race,name:r.name,sortOrder:r.sort_order,updatedAt:r.updated_at})),
      members:mem.rows.map(r=>({factionId:r.faction_id,categoryId:r.category_id}))
    });
  }catch(e){next(e)}
});
app.post('/api/admin/catalog/faction-categories',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const race=String(req.body?.race||'').trim();
  const name=String(req.body?.name||'').trim();
  if(!race||!name||name.length>FACTION_CATEGORY_NAME_MAX_LEN)return res.status(400).json({error:'INVALID_CATEGORY'});
  try{
    const id=crypto.randomUUID();
    await pool.query('INSERT INTO faction_categories(id,race,name,updated_by,updated_at) VALUES($1,$2,$3,$4,NOW())',[id,race,name,req.user.user_id]);
    res.json({ok:true,id});
  }catch(e){next(e)}
});
app.put('/api/admin/catalog/faction-categories/:id',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const sets=[],vals=[];let i=1;
  if(req.body?.name!=null){
    const name=String(req.body.name).trim();
    if(!name||name.length>FACTION_CATEGORY_NAME_MAX_LEN)return res.status(400).json({error:'INVALID_CATEGORY'});
    sets.push(`name=$${i++}`);vals.push(name);
  }
  if(req.body?.race!=null){
    const race=String(req.body.race).trim();
    if(!race)return res.status(400).json({error:'INVALID_CATEGORY'});
    sets.push(`race=$${i++}`);vals.push(race);
  }
  if(req.body?.sortOrder!=null){sets.push(`sort_order=$${i++}`);vals.push(toInt(req.body.sortOrder)||0);}
  if(!sets.length)return res.status(400).json({error:'INVALID_CATEGORY'});
  sets.push(`updated_by=$${i++}`);vals.push(req.user.user_id);
  sets.push('updated_at=NOW()');
  vals.push(req.params.id);
  try{
    const q=await pool.query(`UPDATE faction_categories SET ${sets.join(',')} WHERE id=$${i} RETURNING id`,vals);
    if(!q.rows[0])return res.status(404).json({error:'CATEGORY_NOT_FOUND'});
    res.json({ok:true});
  }catch(e){next(e)}
});
app.delete('/api/admin/catalog/faction-categories/:id',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{
    // ON DELETE CASCADE on faction_category_members clears its members too —
    // those warbands just become unassigned, nothing about them changes.
    await pool.query('DELETE FROM faction_categories WHERE id=$1',[req.params.id]);
    res.json({ok:true});
  }catch(e){next(e)}
});
app.put('/api/admin/catalog/faction-category-members/:factionId',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const factionId=String(req.params.factionId||'').trim();
  const categoryId=String(req.body?.categoryId||'').trim();
  if(!factionId||!categoryId)return res.status(400).json({error:'INVALID_CATEGORY_MEMBER'});
  try{
    const cat=await pool.query('SELECT id FROM faction_categories WHERE id=$1',[categoryId]);
    if(!cat.rows[0])return res.status(404).json({error:'CATEGORY_NOT_FOUND'});
    await pool.query(`INSERT INTO faction_category_members(faction_id,category_id,updated_by,updated_at) VALUES($1,$2,$3,NOW())
      ON CONFLICT (faction_id) DO UPDATE SET category_id=EXCLUDED.category_id,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[factionId,categoryId,req.user.user_id]);
    res.json({ok:true});
  }catch(e){next(e)}
});
app.delete('/api/admin/catalog/faction-category-members/:factionId',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{
    await pool.query('DELETE FROM faction_category_members WHERE faction_id=$1',[req.params.factionId]);
    res.json({ok:true});
  }catch(e){next(e)}
});

// Official magic-domain display overrides (Task #56): admin-only rename +
// frame color for a BOOK domain/prayer list, shown in the Référentiel.
// domain_key is the domain's permanent key in MAGIC_DOMAINS and is never
// itself changed here — only the DISPLAYED name/color are, so every
// existing magicAccess grant / spell.domain match (all keyed on that same
// original name) keeps working unmodified. Public read, admin-only write.
app.get('/api/catalog/domain-overrides',requireDb,async(req,res,next)=>{
  try{
    const q=await pool.query('SELECT domain_key,name,color,updated_at FROM magic_domain_overrides');
    res.json({overrides:q.rows.map(r=>({domainKey:r.domain_key,name:r.name,color:r.color,updatedAt:r.updated_at}))});
  }catch(e){next(e)}
});
app.put('/api/admin/catalog/domain-overrides/:domainKey',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const domainKey=String(req.params.domainKey||'').trim();
  const name=req.body?.name!=null?String(req.body.name).trim().slice(0,80):null;
  const color=req.body?.color!=null?String(req.body.color).trim().slice(0,20):null;
  if(!domainKey)return res.status(400).json({error:'INVALID_DOMAIN'});
  try{
    await pool.query(`INSERT INTO magic_domain_overrides(domain_key,name,color,updated_by,updated_at) VALUES($1,$2,$3,$4,NOW())
      ON CONFLICT (domain_key) DO UPDATE SET name=EXCLUDED.name,color=EXCLUDED.color,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[domainKey,name,color,req.user.user_id]);
    res.json({ok:true});
  }catch(e){next(e)}
});
app.delete('/api/admin/catalog/domain-overrides/:domainKey',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{
    await pool.query('DELETE FROM magic_domain_overrides WHERE domain_key=$1',[req.params.domainKey]);
    res.json({ok:true});
  }catch(e){next(e)}
});

// Admin-attached weapon profile for a BOOK spell (V-SPELLWEAPON-BOOK, made
// shared in Task #84) — same public-read/admin-write pattern as the override
// tables above. Previously saved only through the ordinary account-data
// endpoint (private to the admin's own account); moved here so every player
// sees the same base version.
app.get('/api/catalog/spell-weapon-profiles',requireDb,async(req,res,next)=>{
  try{
    const q=await pool.query('SELECT entry_id,data,updated_at FROM spell_weapon_profile_overrides');
    res.json({overrides:q.rows.map(r=>({entryId:r.entry_id,data:r.data,updatedAt:r.updated_at}))});
  }catch(e){next(e)}
});
app.put('/api/admin/catalog/spell-weapon-profiles/:entryId',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const entryId=String(req.params.entryId||'').trim();
  const data=req.body?.data;
  if(!entryId)return res.status(400).json({error:'INVALID_ENTRY'});
  if(!data||typeof data!=='object'||Array.isArray(data))return res.status(400).json({error:'INVALID_DATA'});
  try{
    await pool.query(`INSERT INTO spell_weapon_profile_overrides(entry_id,data,updated_by,updated_at) VALUES($1,$2,$3,NOW())
      ON CONFLICT (entry_id) DO UPDATE SET data=EXCLUDED.data,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[entryId,JSON.stringify(data),req.user.user_id]);
    res.json({ok:true});
  }catch(e){next(e)}
});
app.delete('/api/admin/catalog/spell-weapon-profiles/:entryId',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{
    await pool.query('DELETE FROM spell_weapon_profile_overrides WHERE entry_id=$1',[req.params.entryId]);
    res.json({ok:true});
  }catch(e){next(e)}
});

// Rules-page nav categories (V151) — admin-editable grouping of the
// RULES_BOOK sections shown as theme cards on the Règles page. A single
// row (id=1) holds the whole ordered list; no row yet means "use the app's
// baked-in default groups", which the client already has, so `groups` comes
// back null in that case rather than an error.
function validateRuleNavGroups(body){
  const groups=Array.isArray(body?.groups)?body.groups:null;
  if(!groups||!groups.length||groups.length>40)return {error:'INVALID_GROUPS'};
  for(const g of groups){
    if(!g||typeof g!=='object')return {error:'INVALID_GROUPS'};
    if(typeof g.id!=='string'||!g.id.trim()||g.id.length>60)return {error:'INVALID_GROUPS'};
    if(typeof g.fr!=='string'||!g.fr.trim()||g.fr.length>120)return {error:'INVALID_GROUPS'};
    if(typeof g.en!=='string'||!g.en.trim()||g.en.length>120)return {error:'INVALID_GROUPS'};
    if(typeof g.icon!=='string'||g.icon.length>8)return {error:'INVALID_GROUPS'};
    if(typeof g.pages!=='string'||g.pages.length>60)return {error:'INVALID_GROUPS'};
    if(!Array.isArray(g.ids)||!g.ids.every(x=>typeof x==='string')||g.ids.length>80)return {error:'INVALID_GROUPS'};
  }
  const payload=JSON.stringify(groups);
  if(Buffer.byteLength(payload)>512*1024)return {error:'DATA_TOO_LARGE'};
  return {payload};
}
app.get('/api/rules/nav-groups',requireDb,async(req,res,next)=>{
  try{
    const q=await pool.query('SELECT groups,updated_at FROM rule_nav_groups WHERE id=1');
    res.json({groups:q.rowCount?q.rows[0].groups:null,updatedAt:q.rowCount?q.rows[0].updated_at:null});
  }catch(e){next(e)}
});
app.put('/api/admin/rules/nav-groups',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  const v=validateRuleNavGroups(req.body);
  if(v.error)return res.status(v.error==='DATA_TOO_LARGE'?413:400).json({error:v.error});
  try{
    await pool.query(`INSERT INTO rule_nav_groups(id,groups,updated_by,updated_at) VALUES(1,$1,$2,NOW())
      ON CONFLICT (id) DO UPDATE SET groups=EXCLUDED.groups,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[v.payload,req.user.user_id]);
    res.json({ok:true});
  }catch(e){next(e)}
});
// Reverts to the app's baked-in default groups (removes the override row).
app.delete('/api/admin/rules/nav-groups',requireDb,requireSameOrigin,auth,requireAdmin,async(req,res,next)=>{
  try{
    await pool.query('DELETE FROM rule_nav_groups WHERE id=1');
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

// V-PLAYMODE: the one deliberate, narrow exception to "friendship never
// grants data access" above — when setting up a game in Play mode, a player
// can field a friend's warband (e.g. running a game for people at their own
// table who don't have accounts open on this device). This returns only a
// minimal, read-only roster summary (id/name/faction/fighter count), never
// the friend's full warband definition or any other account data, and only
// once the two are mutual friends. Not logged like admin support access —
// this is an ordinary permission the player granted by accepting the
// friend request, not a staff bypass.
app.get('/api/friends/:userId/warbands',requireDb,auth,async(req,res,next)=>{
  try{
    const isFriend=await pool.query('SELECT 1 FROM friendships WHERE user_id=$1 AND friend_id=$2',[req.user.user_id,req.params.userId]);
    if(!isFriend.rowCount)return res.status(403).json({error:'NOT_FRIENDS'});
    const u=await pool.query('SELECT username FROM users WHERE id=$1',[req.params.userId]);
    if(!u.rowCount)return res.status(404).json({error:'NOT_FOUND'});
    const d=await pool.query('SELECT payload FROM user_data WHERE user_id=$1',[req.params.userId]);
    const rosters=Array.isArray(d.rows[0]?.payload?.rosters)?d.rows[0].payload.rosters:[];
    const warbands=rosters.map(r=>({id:r.id,name:r.name||'',factionId:r.factionId||'',fighterCount:Array.isArray(r.fighters)?r.fighters.length:0}));
    res.json({username:u.rows[0].username,warbands});
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

// Full roster of registered accounts (not just the 30 most recently active,
// and not gated behind typing 2+ characters of a query first) — lets an
// admin browse everyone who has ever signed up, the way they'd browse a
// friends list, and jump straight into any of their warbands. This is a
// listing only: it does NOT touch user_data and is NOT written to
// admin_support_access_log — that log stays reserved for actual lookups/
// edits of a specific account's saved content (see /api/admin/support/:userId
// just below), so merely seeing a username in this list is never recorded as
// "consulted".
app.get('/api/admin/support/all',requireDb,auth,requireAdmin,async(req,res,next)=>{
  try{
    const r=await pool.query(`SELECT u.id,u.username,u.email,u.created_at,(d.payload IS NOT NULL) AS has_data FROM users u LEFT JOIN user_data d ON d.user_id=u.id ORDER BY u.username ASC LIMIT 5000`);
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

// V152: One-shot manual migration endpoint. schema.sql is already re-run on
// every cold boot (see ensureSchema above), so this is only here to give the
// operator a way to force-apply it on demand — e.g. when a deploy is
// suspected of having missed the boot step, or to sanity-check a fresh
// column landed on the live database. Guarded by a shared secret in
// MIGRATE_TOKEN (Authorization: Bearer <token> OR ?token=<token>); when
// MIGRATE_TOKEN is unset in the environment the endpoint refuses every
// request, so a route that outlives its usefulness can never be triggered
// by a stranger.
app.post('/api/admin/migrate',requireDb,async(req,res,next)=>{
  const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'')||String(req.query.token||'');
  if(!config.migrateToken||supplied!==config.migrateToken)return res.status(403).json({error:'FORBIDDEN'});
  try{
    const schemaPath=path.join(publicDir,'server','db','schema.sql');
    const sql=fs.readFileSync(schemaPath,'utf8');
    await pool.query(sql);
    res.json({ok:true,applied:true});
  }catch(e){next(e)}
});

// V155: operator-only SMTP diagnostic, same MIGRATE_TOKEN guard. Verifies
// the connection/login against the configured relay and, if ?to= is given,
// sends a real test mail there — returning the transport's exact error
// (code + server response) instead of the generic 500 the public recovery
// endpoints deliberately hide. Never reveals the SMTP password.
app.get('/api/admin/smtp-check',async(req,res)=>{
  const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'')||String(req.query.token||'');
  if(!config.migrateToken||supplied!==config.migrateToken)return res.status(403).json({error:'FORBIDDEN'});
  const cfg={host:config.smtpHost||null,port:config.smtpPort,secure:config.smtpSecure,user:config.smtpUser||null,from:config.smtpFrom,passwordSet:!!config.smtpPassword};
  if(!config.smtpHost)return res.status(200).json({ok:false,step:'config',error:'SMTP_HOST is not set in this environment',config:cfg});
  const to=String(req.query.to||'').trim();
  try{
    const transporter=await buildTransport();
    await transporter.verify();
    if(!to)return res.json({ok:true,step:'verify',config:cfg,hint:'Connection + login OK. Add ?to=you@example.com to send a real test mail.'});
    const info=await transporter.sendMail({from:config.smtpFrom,to,subject:'Mordheimunda SMTP test',text:`SMTP test from Mordheimunda at ${new Date().toISOString()}. If you read this, password-recovery emails will go out.`});
    res.json({ok:true,step:'send',config:cfg,to,messageId:info.messageId,response:info.response});
  }catch(e){res.status(200).json({ok:false,step:to?'send':'verify',config:cfg,error:e.message,code:e.code||null,responseCode:e.responseCode||null,response:e.response||null})}
});

// V152: dedicated static HTML pages for the password-reset flow. Served
// explicitly (rather than through the /assets or /data static mounts) so
// the request hits Express directly on Vercel; vercel.json's catch-all
// rewrite is updated in the same commit to leave these two paths alone.
const sendResetPage=name=>(_req,res)=>res.sendFile(path.join(publicDir,name),{headers:{'Cache-Control':'no-store'}});
app.get('/forgot-password.html',sendResetPage('forgot-password.html'));
app.get('/reset-password.html',sendResetPage('reset-password.html'));
app.get('/verify-email.html',sendResetPage('verify-email.html'));

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
