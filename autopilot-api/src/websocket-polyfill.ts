import { WebSocket as NodeWebSocket } from 'ws';

/**
 * Node.js < 22 has no native WebSocket. @supabase/supabase-js always constructs a
 * Realtime client (even for storage-only usage) and needs WebSocket on globalThis
 * or via realtime.transport.
 */
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = NodeWebSocket as unknown as typeof WebSocket;
}
