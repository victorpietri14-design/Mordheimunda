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
const pub=u=>({id:u.id,username:u.username,email:u.email||null,emailVerified:!!u.email_verified_at});
const safeCompare=async(password,hashValue)=>bcrypt.compare(password,hashValue);

app.disable('x-powered-by');
app.set('trust proxy',config.trustProxy);
app.use(helmet({contentSecurityPolicy:false,referrerPolicy:{policy:'no-referrer'}}));
app.use(cors({origin:config.clientOrigin,credentials:true}));
app.use(cookieParser());
app.use(express.json({limit:'6mb'}));
app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next()});
app.use('/api/auth/',rateLimit({windowMs:15*60*1000,max:30,standardHeaders:true,legacyHeaders:false,message:{error:'RATE_LIMITED'}}));
app.use('/api/account/',rateLimit({windowMs:60*1000,max:120,standardHeaders:true,legacyHeaders:false,message:{error:'RATE_LIMITED'}}));

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
    const q=await pool.query(`SELECT s.id AS session_id,s.user_id,u.username,u.email,u.email_verified_at
      FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at>NOW()`,[hash(raw)]);
    if(!q.rows[0]){res.clearCookie('mordheimunda_session',cookie);return res.status(401).json({error:'NOT_AUTHENTICATED'});}
    req.user=q.rows[0];next();
  }catch(e){next(e)}
}

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
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'INVALID_EMAIL'});
  if(password.length<10||password.length>128)return res.status(400).json({error:'INVALID_PASSWORD'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const ex=await client.query('SELECT 1 FROM users WHERE lower(username)=lower($1) OR ($2::text IS NOT NULL AND lower(email)=lower($2)) LIMIT 1',[username,email]);
    if(ex.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'ACCOUNT_EXISTS'});}
    const id=crypto.randomUUID(),ph=await bcrypt.hash(password,12);
    const q=await client.query('INSERT INTO users(id,username,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id,username,email,email_verified_at',[id,username,email,ph]);
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
    const q=await pool.query("SELECT id,username,email,password_hash,email_verified_at FROM users WHERE lower(username)=lower($1) OR lower(coalesce(email,''))=lower($1) LIMIT 1",[login]);
    if(!q.rows[0]||!(await safeCompare(password,q.rows[0].password_hash)))return res.status(401).json({error:'INVALID_CREDENTIALS'});
    const t=token();
    await pool.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+($4::int*INTERVAL '1 day'))",[crypto.randomUUID(),q.rows[0].id,hash(t),config.sessionDays]);
    await pool.query('DELETE FROM sessions WHERE user_id=$1 AND expires_at<=NOW()',[q.rows[0].id]);
    res.cookie('mordheimunda_session',t,{...cookie,maxAge:config.sessionDays*86400000});
    res.json({user:pub(q.rows[0])});
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
app.put('/api/account/data',requireDb,requireSameOrigin,auth,async(req,res,next)=>{
  const data=req.body?.data;if(!data||typeof data!=='object'||Array.isArray(data))return res.status(400).json({error:'INVALID_DATA'});
  const payload=JSON.stringify(data);if(Buffer.byteLength(payload)>5*1024*1024)return res.status(413).json({error:'DATA_TOO_LARGE'});
  try{
    const expectedRevision=Number.isInteger(req.body?.expectedRevision)?req.body.expectedRevision:null;
    const q=expectedRevision===null
      ?await pool.query(`INSERT INTO user_data(user_id,schema_version,payload,revision,updated_at) VALUES($1,4,$2,1,NOW()) ON CONFLICT(user_id) DO UPDATE SET payload=EXCLUDED.payload,schema_version=4,revision=user_data.revision+1,updated_at=NOW() RETURNING revision,updated_at`,[req.user.user_id,payload])
      :await pool.query(`UPDATE user_data SET payload=$1,schema_version=4,revision=revision+1,updated_at=NOW() WHERE user_id=$2 AND revision=$3 RETURNING revision,updated_at`,[payload,req.user.user_id,expectedRevision]);
    if(!q.rows[0])return res.status(409).json({error:'DATA_CONFLICT'});
    res.json({ok:true,revision:q.rows[0].revision,updatedAt:q.rows[0].updated_at});
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
