import {
  CommandPaletteAction,
  CommandPaletteActionDefinition,
  CommandPaletteExecuteResult,
} from './types';

const normalizeText = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const toSearchIndex = <Ctx>(action: CommandPaletteActionDefinition<Ctx>): string =>
  normalizeText(
    [
      action.title,
      action.subtitle || '',
      action.category,
      ...(action.aliases || []),
      ...(action.keywords || []),
    ].join(' ')
  );

export class CommandRegistry<Ctx> {
  private readonly actions: CommandPaletteActionDefinition<Ctx>[];

  constructor(actions: CommandPaletteActionDefinition<Ctx>[]) {
    this.actions = [...actions];
  }

  list(ctx: Ctx, query?: string): CommandPaletteAction[] {
    const normalizedQuery = normalizeText(query || '');
    const queryTokens = normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : [];

    const mapped = this.actions.map((action) => {
      const enabled = action.enabled ? action.enabled(ctx) : true;
      return {
        id: action.id,
        title: action.title,
        subtitle: action.subtitle,
        category: action.category,
        aliases: [...(action.aliases || [])],
        keywords: [...(action.keywords || [])],
        enabled,
        searchIndex: toSearchIndex(action),
      };
    });

    const filtered = mapped.filter((action) => {
      if (queryTokens.length === 0) return true;
      return queryTokens.every((token) => action.searchIndex.includes(token));
    });

    return filtered.map(({ searchIndex: _searchIndex, ...safeAction }) => safeAction);
  }

  async execute(
    actionId: string,
    ctx: Ctx,
    context?: Record<string, unknown>
  ): Promise<CommandPaletteExecuteResult> {
    const action = this.actions.find((candidate) => candidate.id === actionId);

    if (!action) {
      return {
        actionId,
        success: false,
        error: 'command_not_found',
      };
    }

    const enabled = action.enabled ? action.enabled(ctx) : true;
    if (!enabled) {
      return {
        actionId,
        success: false,
        error: 'command_disabled',
      };
    }

    try {
      const result = await Promise.resolve(action.run(ctx, context));
      return {
        actionId,
        success: result.success,
        message: result.message,
        error: result.error,
      };
    } catch (error: any) {
      return {
        actionId,
        success: false,
        error: error?.message || 'command_execution_failed',
      };
    }
  }
}
