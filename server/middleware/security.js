import express from 'express';
import helmet from 'helmet';

const CDN_ORIGIN = 'https://cdn.jsdelivr.net';
const FIREBASE_SDK = 'https://www.gstatic.com';
const RECAPTCHA = 'https://www.google.com';
const AI_LOGIC = 'https://firebasevertexai.googleapis.com';
const APP_CHECK = 'https://content-firebaseappcheck.googleapis.com';
const JSON_BODY_LIMIT = '32kb';

export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", FIREBASE_SDK, RECAPTCHA],
        styleSrc: ["'self'", CDN_ORIGIN],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", AI_LOGIC, APP_CHECK, RECAPTCHA, FIREBASE_SDK],
        fontSrc: ["'self'", CDN_ORIGIN],
        objectSrc: ["'none'"],
        frameSrc: [RECAPTCHA, 'https://recaptcha.google.com'],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}

export function jsonBody() {
  return express.json({ limit: JSON_BODY_LIMIT });
}

const ALLOW_METHODS = 'GET, POST, OPTIONS';
const ALLOW_HEADERS = 'Content-Type, Accept';

function appendVaryOrigin(res) {
  const current = res.getHeader('Vary');
  const parts = String(current ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.some((part) => part.toLowerCase() === 'origin')) parts.push('Origin');
  res.setHeader('Vary', parts.join(', '));
}

/** Lets the browser read API responses fetched from Firebase Hosting. */
export function crossOriginApi() {
  return function crossOriginApiHeaders(_req, res, next) {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  };
}

/**
 * Reflects an allow-listed Origin. Other origins receive no CORS headers.
 * OPTIONS is answered here so preflight does not reach the planning routes.
 */
export function corsAllowList(allowedOrigins = []) {
  const allowed = new Set(allowedOrigins);
  return function cors(req, res, next) {
    const origin = req.get('origin');
    if (origin && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
      res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
      appendVaryOrigin(res);
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}
