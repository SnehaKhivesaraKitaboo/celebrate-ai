import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'hosting-dist');

fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), destination, { recursive: true });
fs.cpSync(path.join(root, 'shared'), path.join(destination, 'shared'), { recursive: true });
