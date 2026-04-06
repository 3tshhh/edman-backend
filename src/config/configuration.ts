export default () => ({
  database: { url: process.env.DATABASE_URL },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  jwt: {
    accessSecret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    prefix: 'Bearer',
    accessExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  otp: {
    sessionSecret: process.env.JWT_SECRET,
    expiresIn: '5m',
    saltRounds: parseInt(process.env.SALT_ROUNDS || '10'),
    devCode: process.env.OTP_DEV_CODE || null,
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS || '300'),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5'),
    attemptsWindowSeconds: parseInt(
      process.env.OTP_ATTEMPTS_WINDOW_SECONDS || '3600',
    ),
  },
  location: {
    proximityDefaultMeters: parseInt(
      process.env.PROXIMITY_THRESHOLD_METERS || '300',
    ),
    checkIntervalSeconds: parseInt(
      process.env.SESSION_LOCATION_INTERVAL_SECONDS || '30',
    ),
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    s3Bucket: process.env.AWS_BUCKET,
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  },
});
