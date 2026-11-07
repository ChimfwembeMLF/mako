import { decryptToken, encryptToken } from '../../../common/utils/token-crypto.util';
import type { AgentCustomAction, BotGraph } from './whatsapp-bot.types';

/**
 * Secrets for an AI agent's custom actions (the Bearer token sent to the business's own
 * system). They are encrypted in the saved graph and never sent back to the browser:
 * the builder only learns that one is set (`hasSecret`).
 */

type StoredAction = AgentCustomAction & { secretEnc?: string; hasSecret?: boolean };

function actionsOf(graph: BotGraph): Array<{ nodeId: string; actions: StoredAction[] }> {
  return (graph?.nodes ?? [])
    .filter((n) => n.type === 'ai_agent' && Array.isArray(n.data?.customActions))
    .map((n) => ({ nodeId: n.id, actions: n.data.customActions as StoredAction[] }));
}

/**
 * Before saving: encrypts newly typed secrets and keeps the saved one for actions the
 * builder marked `hasSecret` without retyping it.
 */
export function sealActionSecrets(next: BotGraph, previous?: BotGraph | null): BotGraph {
  const before = new Map<string, StoredAction[]>(
    previous ? actionsOf(previous).map((x) => [x.nodeId, x.actions]) : [],
  );
  for (const { nodeId, actions } of actionsOf(next)) {
    const old = before.get(nodeId) ?? [];
    for (const a of actions) {
      const typed = typeof a.secret === 'string' ? a.secret.trim() : '';
      if (typed) {
        a.secretEnc = encryptToken(typed.slice(0, 500));
      } else if (a.hasSecret) {
        const match = old.find((o) => o.name === a.name) ?? old.find((o) => o.url === a.url);
        const kept = match?.secretEnc ?? (match?.secret ? encryptToken(match.secret) : undefined);
        if (kept) a.secretEnc = kept;
        else delete a.secretEnc;
      } else {
        delete a.secretEnc;
      }
      delete a.secret;
      delete a.hasSecret;
    }
  }
  return next;
}

/** For anything returned to the browser: drops secrets and says whether one is set. */
export function redactActionSecrets(graph: BotGraph): BotGraph {
  const copy = JSON.parse(JSON.stringify(graph ?? { nodes: [], edges: [] })) as BotGraph;
  for (const { actions } of actionsOf(copy)) {
    for (const a of actions) {
      const has = Boolean(a.secretEnc || a.secret);
      delete a.secretEnc;
      delete a.secret;
      if (has) a.hasSecret = true;
      else delete a.hasSecret;
    }
  }
  return copy;
}

/** The plain secret to send when the agent calls the action. */
export function actionSecret(action: AgentCustomAction): string | undefined {
  const stored = action as StoredAction;
  if (stored.secretEnc) {
    try {
      return decryptToken(stored.secretEnc);
    } catch {
      return undefined;
    }
  }
  // Bots saved before secrets were encrypted.
  return stored.secret || undefined;
}
