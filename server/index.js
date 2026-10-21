import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApp({ config });

const host = '0.0.0.0';
app.listen(config.port, host, () => {
  console.log(`CelebrateAI listening on ${host}:${config.port}`);
  console.log(config.geminiApiKey
    ? `Gemini planning configured (${config.geminiModel}).`
    : 'Gemini planning is not configured. Set GEMINI_API_KEY to enable it.');
});
