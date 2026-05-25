import jwt from 'jsonwebtoken';

const DEFAULT_EXPIRES_IN = '1d';
const DEFAULT_EXTENSION_EXPIRES_IN = '15m';
export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'billbot_auth';
const LEGACY_AUTH_COOKIE_NAME = 'token';
const JWT_ALGORITHM = 'HS256';

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

export function getJwtIssuer() {
  return process.env.JWT_ISSUER || 'billbot-legal';
}

export function getJwtAudience() {
  return process.env.JWT_AUDIENCE || 'billbot-frontend';
}

export function getExtensionJwtAudience() {
  return process.env.EXTENSION_JWT_AUDIENCE || 'billbot-extension';
}

export function getJwtVerifyOptions() {
  return {
    algorithms: [JWT_ALGORITHM],
    issuer: getJwtIssuer(),
    audience: [getJwtAudience(), getExtensionJwtAudience()],
    clockTolerance: Number(process.env.JWT_CLOCK_TOLERANCE_SECONDS || 5),
  };
}

export function signAuthToken(user, options = {}) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      ...(options.purpose ? { purpose: options.purpose } : {}),
    },
    getJwtSecret(),
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: options.expiresIn || getJwtExpiresIn(),
      issuer: getJwtIssuer(),
      audience: options.audience || getJwtAudience(),
    }
  );
}

export function getExtensionJwtExpiresIn() {
  return process.env.EXTENSION_JWT_EXPIRES_IN || DEFAULT_EXTENSION_EXPIRES_IN;
}

export function signExtensionToken(user) {
  return signAuthToken(user, {
    audience: getExtensionJwtAudience(),
    expiresIn: getExtensionJwtExpiresIn(),
    purpose: 'chrome_extension_capture',
  });
}

export function verifyAuthToken(token) {
  return jwt.verify(token, getJwtSecret(), getJwtVerifyOptions());
}

export function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const sameSite = process.env.AUTH_COOKIE_SAMESITE || (isProduction ? 'none' : 'lax');
  const secure = process.env.AUTH_COOKIE_SECURE
    ? process.env.AUTH_COOKIE_SECURE === 'true'
    : isProduction || String(sameSite).toLowerCase() === 'none';
  const options = {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: parseDurationMs(getJwtExpiresIn()),
  };

  if (process.env.AUTH_COOKIE_DOMAIN) {
    options.domain = process.env.AUTH_COOKIE_DOMAIN;
  }

  return options;
}

export function setAuthCookie(res, token) {
  const options = getAuthCookieOptions();
  const { maxAge, ...clearOptions } = options;
  res.cookie(AUTH_COOKIE_NAME, token, options);
  if (AUTH_COOKIE_NAME !== LEGACY_AUTH_COOKIE_NAME) {
    res.clearCookie(LEGACY_AUTH_COOKIE_NAME, clearOptions);
  }
}

export function clearAuthCookie(res) {
  const { maxAge, ...options } = getAuthCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, options);
  if (AUTH_COOKIE_NAME !== LEGACY_AUTH_COOKIE_NAME) {
    res.clearCookie(LEGACY_AUTH_COOKIE_NAME, options);
  }
}

export function getAuthTokenFromRequest(req) {
  const authorization = req.get?.('authorization') || '';
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer || req.cookies?.[AUTH_COOKIE_NAME] || req.cookies?.[LEGACY_AUTH_COOKIE_NAME];
}
