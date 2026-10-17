export const config={
  port:Number(process.env.PORT||3000),
  clientOrigin:process.env.CLIENT_ORIGIN||'http://localhost:3000',
  // Public base URL used to build the password-reset links inside the email
  // (V152). Falls back to CLIENT_ORIGIN so a single-domain deploy (which is
  // by far the common case here) keeps working with no extra env var; a
  // split-frontend deploy can point FRONTEND_URL at the public app URL
  // separately from the API's CORS origin.
  frontendUrl:(process.env.FRONTEND_URL||process.env.CLIENT_ORIGIN||'http://localhost:3000').replace(/\/$/,''),
  databaseUrl:process.env.DATABASE_URL||'',
  databaseSsl:process.env.DATABASE_SSL==='true',
  sessionDays:Math.max(1,Math.min(90,Number(process.env.SESSION_DAYS||30))),
  nodeEnv:process.env.NODE_ENV||'development',
  trustProxy:process.env.TRUST_PROXY==='true',
  smtpHost:process.env.SMTP_HOST||'',
  smtpPort:Number(process.env.SMTP_PORT||587),
  smtpSecure:process.env.SMTP_SECURE==='true',
  smtpUser:process.env.SMTP_USER||'',
  smtpPassword:process.env.SMTP_PASSWORD||'',
  smtpFrom:process.env.SMTP_FROM||'no-reply@mordheimunda.local',
  appVersion:process.env.APP_VERSION||'26-V88',
  // Bootstrap admin accounts: comma-separated emails. Matching accounts are
  // (re)promoted to admin on every login/session check, so this env var is
  // the durable source of truth for the initial admin(s); further admins can
  // then be promoted from the in-app Admin tab (stored in users.is_admin).
  adminEmails:String(process.env.ADMIN_EMAILS||'').split(',').map(e=>e.trim().toLowerCase()).filter(Boolean),
  // One-shot secret for the /api/admin/migrate endpoint (V152). Deliberately
  // empty by default: when unset, the endpoint refuses every request, so a
  // forgotten-to-remove migrate route can never be triggered by a stranger.
  migrateToken:process.env.MIGRATE_TOKEN||'',
  // V-AUTOTRANSLATE: automatic translation of English-only texts. Google
  // Cloud Translation (GOOGLE_TRANSLATE_API_KEY) is the main service;
  // Microsoft Translator (AZURE_TRANSLATOR_KEY + AZURE_TRANSLATOR_REGION) is
  // a fallback. Without a key nothing is translated. *_URL only for tests.
  googleTranslateApiKey:process.env.GOOGLE_TRANSLATE_API_KEY||'',
  // Hard caps on characters sent for translation (Google's free allowance
  // is 500,000 a month): beyond them the site simply stops sending new texts
  // until the next day / month; texts already translated stay available.
  // V-TRAFFICCAP: hard daily ceilings on heavy traffic (MB), so no bug can
  // ever use up the host's or the database's monthly transfer allowance.
  trafficAccountDailyMb:Math.max(1,Number(process.env.TRAFFIC_ACCOUNT_DAILY_MB||80)),
  trafficSiteDailyMb:Math.max(1,Number(process.env.TRAFFIC_SITE_DAILY_MB||250)),
  translateDailyCharLimit:Math.max(0,Number(process.env.TRANSLATE_DAILY_CHAR_LIMIT||15000)),
  translateMonthlyCharLimit:Math.max(0,Number(process.env.TRANSLATE_MONTHLY_CHAR_LIMIT||450000)),
  googleTranslateApiUrl:process.env.GOOGLE_TRANSLATE_API_URL||'',
  azureTranslatorKey:process.env.AZURE_TRANSLATOR_KEY||'',
  azureTranslatorRegion:process.env.AZURE_TRANSLATOR_REGION||'',
  azureTranslatorUrl:process.env.AZURE_TRANSLATOR_URL||''
};
