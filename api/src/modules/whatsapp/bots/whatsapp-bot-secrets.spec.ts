import { actionSecret, redactActionSecrets, sealActionSecrets } from './whatsapp-bot-secrets';
import type { BotGraph } from './whatsapp-bot.types';

const agent = (actions: Array<Record<string, unknown>>): BotGraph => ({
  nodes: [
    { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
    { id: 'ai', type: 'ai_agent', position: { x: 0, y: 0 }, data: { instructions: 'Help', customActions: actions as never } },
  ],
  edges: [],
});
const actions = (g: BotGraph) => g.nodes[1].data.customActions as Array<Record<string, unknown>>;
const base = { name: 'check_order', description: 'Looks up an order', url: 'https://shop.example/api', parameters: ['order_number'] };

describe('custom action secrets', () => {
  it('encrypts a typed secret and never stores it in plain text', () => {
    const saved = sealActionSecrets(agent([{ ...base, secret: 'tok_123' }]));
    expect(actions(saved)[0].secret).toBeUndefined();
    expect(String(actions(saved)[0].secretEnc)).not.toContain('tok_123');
    expect(actionSecret(actions(saved)[0] as never)).toBe('tok_123');
  });

  it('shows the browser only that a secret is set', () => {
    const saved = sealActionSecrets(agent([{ ...base, secret: 'tok_123' }]));
    const shown = redactActionSecrets(saved);
    expect(actions(shown)[0]).toMatchObject({ hasSecret: true });
    expect(JSON.stringify(shown)).not.toContain('secretEnc');
    // The saved graph itself is untouched.
    expect(actions(saved)[0].secretEnc).toBeDefined();
  });

  it('keeps the saved secret when the builder sends it back untouched', () => {
    const saved = sealActionSecrets(agent([{ ...base, secret: 'tok_123' }]));
    const resent = sealActionSecrets(redactActionSecrets(saved), saved);
    expect(actionSecret(actions(resent)[0] as never)).toBe('tok_123');
  });

  it('removes the secret when the builder clears it', () => {
    const saved = sealActionSecrets(agent([{ ...base, secret: 'tok_123' }]));
    const cleared = sealActionSecrets(agent([{ ...base, hasSecret: false }]), saved);
    expect(actionSecret(actions(cleared)[0] as never)).toBeUndefined();
  });

  it('still uses secrets saved in plain text by older versions', () => {
    expect(actionSecret({ ...base, secret: 'legacy' })).toBe('legacy');
    const resealed = sealActionSecrets(agent([{ ...base, hasSecret: true }]), agent([{ ...base, secret: 'legacy' }]));
    expect(actions(resealed)[0].secret).toBeUndefined();
    expect(actionSecret(actions(resealed)[0] as never)).toBe('legacy');
  });
});
