import { webcrypto } from 'node:crypto';
import { WebSocket as NodeWebSocket } from 'ws';

/** Node.js may lack global crypto — required by some SDKs. */
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
}

/**
 * Node.js < 22 has no native WebSocket. @supabase/supabase-js constructs a
 * Realtime client (even for storage-only usage) and needs WebSocket on globalThis.
 */
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = NodeWebSocket as unknown as typeof WebSocket;
}
