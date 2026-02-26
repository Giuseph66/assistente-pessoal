export type CommandPaletteAction = {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  aliases: string[];
  keywords: string[];
  enabled: boolean;
};

export type CommandPaletteExecuteResult = {
  actionId: string;
  success: boolean;
  message?: string;
  error?: string;
};

export type CommandPaletteActionDefinition<Ctx> = {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  aliases?: string[];
  keywords?: string[];
  enabled?: (ctx: Ctx) => boolean;
  run: (ctx: Ctx, context?: Record<string, unknown>) => Promise<Omit<CommandPaletteExecuteResult, 'actionId'>> | Omit<CommandPaletteExecuteResult, 'actionId'>;
};

export type CommandPaletteUpdateListener = (actions: CommandPaletteAction[]) => void;
