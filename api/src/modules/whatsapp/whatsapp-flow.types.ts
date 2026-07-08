import type { WhatsappMenuItem } from './whatsapp-menu.types';

export type FlowInboundInput = {
  tenantId: string;
  phone: string;
  text: string;
  interactiveId?: string;
  serviceName: string;
  aiFallbackEnabled?: boolean;
};

export type FlowOutboundMessage =
  | { kind: 'text'; body: string }
  | {
      kind: 'buttons';
      body: string;
      buttons: Array<{ id: string; title: string }>;
    }
  | {
      kind: 'list';
      body: string;
      buttonLabel: string;
      sections: Array<{
        title?: string;
        rows: Array<{ id: string; title: string; description?: string }>;
      }>;
    };

export type FlowStepResult = {
  messages: FlowOutboundMessage[];
  nextState: string;
  context?: Record<string, unknown>;
  endSession?: boolean;
  aiMenuItem?: WhatsappMenuItem;
  aiFreeText?: string;
};

export const FLOW_STATES = {
  MAIN_MENU: 'MAIN_MENU',
} as const;
