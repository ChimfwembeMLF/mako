/**
 * Runtime polyfills for ts-node scripts (seed, storage migrate, etc.)
 */
import '../src/websocket-polyfill';
import { webcrypto } from 'node:crypto';

if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}
