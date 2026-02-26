import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './CommandBar.css';

interface CommandBarProps {
    isOpen: boolean;
    onClose: () => void;
}

type PaletteAction = {
    id: string;
    title: string;
    subtitle?: string;
    category: string;
    aliases: string[];
    keywords: string[];
    enabled: boolean;
};

const normalizeText = (value: string): string =>
    value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const matchesAction = (action: PaletteAction, query: string): boolean => {
    const normalized = normalizeText(query);
    if (!normalized) return true;

    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return true;

    const haystack = normalizeText(
        [
            action.title,
            action.subtitle || '',
            action.category,
            ...action.aliases,
            ...action.keywords,
        ].join(' ')
    );

    return tokens.every((token) => haystack.includes(token));
};

export const CommandBar: React.FC<CommandBarProps> = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [actions, setActions] = useState<PaletteAction[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const loadActions = useCallback(async () => {
        setIsLoading(true);
        try {
            const list = await window.commandPalette.listActions();
            setActions(Array.isArray(list) ? list : []);
        } catch (loadError: any) {
            setActions([]);
            setError(loadError?.message || 'Falha ao carregar comandos');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        setQuery('');
        setSelectedIndex(0);
        setError(null);
        void loadActions();
    }, [isOpen, loadActions]);

    useEffect(() => {
        if (!isOpen) return;
        inputRef.current?.focus();
    }, [isOpen]);

    const filteredActions = useMemo(
        () => actions.filter((action) => matchesAction(action, query)),
        [actions, query]
    );

    useEffect(() => {
        setSelectedIndex((current) => {
            if (filteredActions.length === 0) return 0;
            if (current < filteredActions.length) return current;
            return filteredActions.length - 1;
        });
    }, [filteredActions.length]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    const executeAction = useCallback(async (action: PaletteAction) => {
        if (!action.enabled || isExecuting) return;

        setIsExecuting(true);
        setError(null);

        try {
            const result = await window.commandPalette.execute(action.id);
            if (result.success) {
                onClose();
                return;
            }

            setError(result.error || 'Falha ao executar comando');
            await loadActions();
        } catch (executeError: any) {
            setError(executeError?.message || 'Falha ao executar comando');
        } finally {
            setIsExecuting(false);
        }
    }, [isExecuting, loadActions, onClose]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        if (!isOpen) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (filteredActions.length === 0) return;
            setSelectedIndex((current) => (current + 1) % filteredActions.length);
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (filteredActions.length === 0) return;
            setSelectedIndex((current) => (current - 1 + filteredActions.length) % filteredActions.length);
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            const selectedAction = filteredActions[selectedIndex];
            if (selectedAction) {
                void executeAction(selectedAction);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="command-palette-overlay" onClick={onClose}>
            <div className="command-palette-shell" onClick={(event) => event.stopPropagation()} onKeyDown={handleKeyDown}>
                <div className="command-palette-header">
                    <input
                        ref={inputRef}
                        type="text"
                        className="command-palette-input"
                        placeholder="Buscar comandos..."
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    <span className="command-palette-hint">Esc</span>
                </div>

                {error ? <div className="command-palette-error">{error}</div> : null}

                <div className="command-palette-results">
                    {isLoading ? <div className="command-palette-empty">Carregando comandos...</div> : null}
                    {!isLoading && filteredActions.length === 0 ? (
                        <div className="command-palette-empty">Nenhum comando encontrado.</div>
                    ) : null}

                    {!isLoading && filteredActions.length > 0 ? (
                        <ul className="command-palette-list" role="listbox" aria-label="Lista de comandos">
                            {filteredActions.map((action, index) => {
                                const isSelected = selectedIndex === index;
                                const classNames = [
                                    'command-palette-item',
                                    isSelected ? 'is-selected' : '',
                                    !action.enabled ? 'is-disabled' : '',
                                ]
                                    .filter(Boolean)
                                    .join(' ');

                                return (
                                    <li key={action.id}>
                                        <button
                                            type="button"
                                            className={classNames}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                            onClick={() => void executeAction(action)}
                                            disabled={!action.enabled || isExecuting}
                                        >
                                            <div className="command-palette-item-main">
                                                <span className="command-palette-item-title">{action.title}</span>
                                                {action.subtitle ? (
                                                    <span className="command-palette-item-subtitle">{action.subtitle}</span>
                                                ) : null}
                                            </div>
                                            <div className="command-palette-item-side">
                                                <span className="command-palette-category">{action.category}</span>
                                                {!action.enabled ? (
                                                    <span className="command-palette-disabled">Indisponivel</span>
                                                ) : null}
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : null}
                </div>

                <div className="command-palette-footer">
                    <span>↑↓ navegar</span>
                    <span>Enter executar</span>
                    <span>Esc fechar</span>
                </div>
            </div>
        </div>
    );
};
