/**
 * @nestjs/typeorm calls crypto.randomUUID() without importing.
 * ts-node does not always expose global crypto — preload this before AppModule.
 */
import { webcrypto } from 'node:crypto';

if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}
