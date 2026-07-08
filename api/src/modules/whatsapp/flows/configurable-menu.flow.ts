import { Injectable } from '@nestjs/common';
import {
  FlowInboundInput,
  FlowOutboundMessage,
  FlowStepResult,
  FLOW_STATES,
} from '../whatsapp-flow.types';
import { WhatsappMenuItem } from '../whatsapp-menu.types';

export type ConfigurableMenuContext = {
  menuItems: WhatsappMenuItem[];
  welcomeMessage?: string;
};

@Injectable()
export class ConfigurableMenuFlow {
  handle(
    state: string,
    input: FlowInboundInput,
    context: Record<string, unknown>,
  ): FlowStepResult {
    const menuItems = (context.menuItems as WhatsappMenuItem[]) ?? [];
    const welcomeMessage = context.welcomeMessage as string | undefined;
    const aiFallbackEnabled = input.aiFallbackEnabled !== false;

    if (!menuItems.length) {
      return {
        nextState: FLOW_STATES.MAIN_MENU,
        context: { menuItems, welcomeMessage },
        messages: [
          {
            kind: 'text',
            body: 'This menu is not set up yet. The business owner needs to add menu options in Lead Agent → WhatsApp → Menu bot.',
          },
        ],
      };
    }

    const choice = this.normalizeChoice(input);
    const welcomeTriggers = ((context.welcomeTriggers as string[]) ?? []).map(
      (t) => t.toLowerCase(),
    );

    if (
      choice === 'menu' ||
      choice === '0' ||
      choice === 'back' ||
      choice === 'main_menu' ||
      welcomeTriggers.includes(choice)
    ) {
      return this.mainMenu(input.serviceName, menuItems, welcomeMessage);
    }

    if (state === FLOW_STATES.MAIN_MENU || !state) {
      const item = this.resolveMenuChoice(choice, menuItems);
      if (!item) {
        if (
          aiFallbackEnabled &&
          input.text.trim() &&
          !this.isMenuCommand(choice)
        ) {
          return {
            nextState: FLOW_STATES.MAIN_MENU,
            context: { menuItems, welcomeMessage },
            aiFreeText: input.text.trim(),
            messages: [],
          };
        }
        return this.mainMenu(
          input.serviceName,
          menuItems,
          welcomeMessage,
          true,
        );
      }
      return this.showItemResponse(item, menuItems, welcomeMessage);
    }

    const item = this.resolveMenuChoice(choice, menuItems);
    if (item) {
      return this.showItemResponse(item, menuItems, welcomeMessage);
    }

    if (aiFallbackEnabled && input.text.trim()) {
      return {
        nextState: FLOW_STATES.MAIN_MENU,
        context: { menuItems, welcomeMessage },
        aiFreeText: input.text.trim(),
        messages: [],
      };
    }

    return this.mainMenu(input.serviceName, menuItems, welcomeMessage, true);
  }

  private isMenuCommand(choice: string): boolean {
    return (
      choice === 'menu' ||
      choice === '0' ||
      choice === 'back' ||
      choice === 'main_menu'
    );
  }

  private normalizeChoice(input: FlowInboundInput): string {
    if (input.interactiveId) return input.interactiveId.trim().toLowerCase();
    return input.text.trim().toLowerCase();
  }

  private resolveMenuChoice(
    choice: string,
    menuItems: WhatsappMenuItem[],
  ): WhatsappMenuItem | null {
    if (!choice) return null;

    const byId = menuItems.find((item) => item.id.toLowerCase() === choice);
    if (byId) return byId;

    const numeric = parseInt(choice, 10);
    if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= menuItems.length) {
      return menuItems[numeric - 1];
    }

    const byTitle = menuItems.find(
      (item) => item.title.toLowerCase() === choice,
    );
    return byTitle ?? null;
  }

  private mainMenu(
    serviceName: string,
    menuItems: WhatsappMenuItem[],
    welcomeMessage?: string,
    invalidChoice = false,
  ): FlowStepResult {
    const intro =
      welcomeMessage?.trim().replace(/\{serviceName\}/gi, serviceName) ||
      `Welcome to ${serviceName}`;

    const messages: FlowOutboundMessage[] = [];

    if (invalidChoice) {
      messages.push({
        kind: 'text',
        body: 'Sorry, that option is not recognized. Please choose from the menu below.',
      });
    }

    if (menuItems.length <= 3) {
      messages.push({
        kind: 'buttons',
        body: `${intro}\n\nTap an option:`,
        buttons: menuItems.map((item) => ({
          id: item.id,
          title: item.title.slice(0, 20),
        })),
      });
    } else {
      messages.push({
        kind: 'list',
        body: `${intro}\n\nChoose what you need:`,
        buttonLabel: 'View options',
        sections: [
          {
            title: 'Menu',
            rows: menuItems.map((item, index) => ({
              id: item.id,
              title: `${index + 1}. ${item.title}`.slice(0, 24),
              description: item.description,
            })),
          },
        ],
      });
    }

    messages.push({
      kind: 'text',
      body: `Tip: reply with a number (1–${menuItems.length}) like USSD, or tap the menu above.`,
    });

    return {
      nextState: FLOW_STATES.MAIN_MENU,
      context: { menuItems, welcomeMessage },
      messages,
    };
  }

  private showItemResponse(
    item: WhatsappMenuItem,
    menuItems: WhatsappMenuItem[],
    welcomeMessage?: string,
  ): FlowStepResult {
    if (item.aiGenerate) {
      return {
        nextState: FLOW_STATES.MAIN_MENU,
        context: { menuItems, welcomeMessage },
        aiMenuItem: item,
        messages: [],
      };
    }

    return {
      nextState: FLOW_STATES.MAIN_MENU,
      context: { menuItems, welcomeMessage },
      messages: [
        { kind: 'text', body: item.response },
        {
          kind: 'buttons',
          body: 'Anything else?',
          buttons: [{ id: 'main_menu', title: 'Main menu' }],
        },
      ],
    };
  }
}
