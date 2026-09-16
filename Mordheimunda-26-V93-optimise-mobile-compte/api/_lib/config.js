export const config={
  port:Number(process.env.PORT||3000),
  clientOrigin:process.env.CLIENT_ORIGIN||'http://localhost:3000',
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
  appVersion:process.env.APP_VERSION||'26-V88'
};
