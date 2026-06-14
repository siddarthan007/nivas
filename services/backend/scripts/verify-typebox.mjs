import { Unsafe } from '@sinclair/typebox';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('@sinclair/typebox/package.json');

if (!Unsafe) {
  throw new Error('@sinclair/typebox is missing Unsafe (Elysia needs >= 0.34)');
}

const [major, minor] = version.split('.').map(Number);
if (major === 0 && minor < 34) {
  throw new Error(`@sinclair/typebox@${version} is too old; need >= 0.34.15`);
}

console.log(`@sinclair/typebox@${version} OK`);
