import express from 'express';
import { createApp } from './server/app.js';

const app = createApp();

if (typeof express !== 'function') {
  throw new Error('Express is unavailable.');
}

export default app;
