import express from 'express';
import helmet from 'helmet';

const CDN_ORIGIN = 'https://cdn.jsdelivr.net';
const JSON_BODY_LIMIT = '32kb';

export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", CDN_ORIGIN],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", CDN_ORIGIN],
        objectSrc: ["'none'"],
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
