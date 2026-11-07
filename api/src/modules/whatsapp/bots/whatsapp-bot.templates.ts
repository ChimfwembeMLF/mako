import type { WhatsappMenuItem } from '../whatsapp-menu.types';
import type { BotEdge, BotGraph, BotNode } from './whatsapp-bot.types';

export type BotTemplate = 'blank' | 'menu' | 'agent' | 'lead_capture';

const at = (x: number, y: number) => ({ x, y });
const edge = (source: string, target: string, sourceHandle = 'next'): BotEdge => ({
  id: `e-${source}-${sourceHandle}-${target}`,
  source,
  target,
  sourceHandle,
});

/** Starting points offered when creating a bot. */
export function templateGraph(template: BotTemplate, businessName = 'our business'): BotGraph {
  const start: BotNode = { id: 'start', type: 'start', position: at(0, 0), data: { label: 'Start' } };

  if (template === 'agent') {
    return {
      nodes: [
        start,
        {
          id: 'agent',
          type: 'ai_agent',
          position: at(0, 160),
          data: {
            label: 'AI agent',
            text: `Hi! I'm the ${businessName} assistant. How can I help?`,
            instructions: 'Answer customer questions about our products, prices and opening hours. Collect their name and email if they want us to follow up.',
            useKnowledge: true,
            exitKeywords: ['menu', 'stop'],
            builtInActions: ['save_lead', 'handoff', 'end_conversation'],
            customActions: [],
          },
        },
        { id: 'handoff', type: 'handoff', position: at(260, 380), data: { label: 'Hand to a person' } },
        { id: 'end', type: 'end', position: at(-260, 380), data: { label: 'End', text: 'Thanks for chatting with us!' } },
      ],
      edges: [edge('start', 'agent'), edge('agent', 'handoff', 'handoff'), edge('agent', 'end', 'exit')],
    };
  }

  if (template === 'lead_capture') {
    return {
      nodes: [
        start,
        { id: 'ask_name', type: 'ask', position: at(0, 160), data: { label: 'Ask name', text: `Welcome to ${businessName}! What's your name?`, variable: 'full_name', validation: 'text' } },
        { id: 'ask_need', type: 'ask', position: at(0, 320), data: { label: 'Ask need', text: 'Thanks {{full_name}}! What can we help you with?', variable: 'need', validation: 'text' } },
        { id: 'ask_email', type: 'ask', position: at(0, 480), data: { label: 'Ask email', text: 'What email should we use to get back to you?', variable: 'email', validation: 'email' } },
        { id: 'save', type: 'save_lead', position: at(0, 640), data: { label: 'Save lead' } },
        { id: 'end', type: 'end', position: at(0, 800), data: { label: 'Done', text: 'Got it, {{full_name}}. Someone from our team will be in touch soon.' } },
      ],
      edges: [edge('start', 'ask_name'), edge('ask_name', 'ask_need'), edge('ask_need', 'ask_email'), edge('ask_email', 'save'), edge('save', 'end')],
    };
  }

  if (template === 'menu') {
    return menuGraph(
      [
        { id: 'prices', title: 'Prices', response: 'Here are our prices: …' },
        { id: 'hours', title: 'Opening hours', response: 'We are open Monday to Friday, 08:00–17:00.' },
        { id: 'person', title: 'Talk to a person', response: '' },
      ],
      `Welcome to ${businessName}! How can we help?`,
    );
  }

  return { nodes: [start], edges: [] };
}

/**
 * Rebuilds the old one-level menu bot as a flow: a menu block, one message (or AI agent)
 * per option, then back to the menu.
 */
export function menuGraph(items: WhatsappMenuItem[], welcome: string): BotGraph {
  const nodes: BotNode[] = [
    { id: 'start', type: 'start', position: at(0, 0), data: { label: 'Start' } },
    {
      id: 'menu',
      type: 'menu',
      position: at(0, 160),
      data: {
        label: 'Main menu',
        text: welcome,
        buttonLabel: 'Options',
        options: items.slice(0, 10).map((i) => ({ id: i.id, title: i.title.slice(0, 24), ...(i.description ? { description: i.description } : {}) })),
      },
    },
  ];
  const edges: BotEdge[] = [edge('start', 'menu')];
  const spacing = 280;
  const left = -((items.length - 1) * spacing) / 2;

  items.slice(0, 10).forEach((item, i) => {
    const id = `opt_${i + 1}`;
    const x = left + i * spacing;
    const talksToPerson = !item.response?.trim() && !item.aiGenerate;
    if (talksToPerson) {
      nodes.push({ id, type: 'handoff', position: at(x, 360), data: { label: item.title } });
    } else if (item.aiGenerate) {
      nodes.push({
        id,
        type: 'ai_agent',
        position: at(x, 360),
        data: { label: item.title, instructions: item.response || `Help the customer with: ${item.title}`, useKnowledge: true, exitKeywords: ['menu'], builtInActions: ['handoff'] },
      });
      edges.push(edge(id, 'menu', 'exit'));
    } else {
      nodes.push({ id, type: 'message', position: at(x, 360), data: { label: item.title, text: item.response } });
      nodes.push({ id: `${id}_back`, type: 'goto', position: at(x, 520), data: { label: 'Back to menu', targetNodeId: 'menu' } });
      edges.push(edge(id, `${id}_back`));
    }
    edges.push(edge('menu', id, item.id));
  });
  return { nodes, edges };
}
