import { webcrypto } from 'node:crypto';

/** Node.js may lack global crypto — required by some SDKs. */
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
}
