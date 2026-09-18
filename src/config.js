require('dotenv').config();

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return value.toLowerCase() === 'true';
}

module.exports = {
  host: process.env.MC_HOST || 'localhost',
  port: Number(process.env.MC_PORT) || 25565,
  username: process.env.MC_USERNAME || 'BossSlayerBot',
  password: process.env.MC_PASSWORD || undefined,
  version: process.env.MC_VERSION || false,
  auth: process.env.MC_AUTH || 'offline',
  admin: process.env.MC_ADMIN || null,
  wardenAvoidOnly: bool(process.env.WARDEN_AVOID_ONLY, true),
};
