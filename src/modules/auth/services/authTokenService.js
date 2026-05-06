import jwt from 'jsonwebtoken';

const DEFAULT_EXPIRES_IN = '1d';

function parseDurationMs(value = DEFAULT_EXPIRES_IN) {
  const match = String(value).trim().match(/^(\d+)([smhd])$/i);
  if (!match) return 24 * 60 * 60 * 1000;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return secret || 'dev_secret_change_me';
}

export function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN;
}

export function signAuthToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    getJwtSecret(),
    { expiresIn: getJwtExpiresIn() }
  );
}

export function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: process.env.AUTH_COOKIE_SAMESITE || (isProduction ? 'none' : 'lax'),
    path: '/',
    maxAge: parseDurationMs(getJwtExpiresIn()),
  };

  if (process.env.AUTH_COOKIE_DOMAIN) {
    options.domain = process.env.AUTH_COOKIE_DOMAIN;
  }

  return options;
}

export function setAuthCookie(res, token) {
  res.cookie('token', token, getAuthCookieOptions());
}

export function clearAuthCookie(res) {
  const { maxAge, ...options } = getAuthCookieOptions();
  res.clearCookie('token', options);
}
