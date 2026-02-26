import React, { useEffect, useMemo, useState } from 'react';
import { CustomSelect } from './CustomSelect';
import './NotificationsSection.css';

// Re-using types from previous version
type NotificationLevel = 'info' | 'warn' | 'error';
type NotificationSource = 'app' | 'system';

type NotificationItem = {
    id: string;
    createdAt: number;
    source: NotificationSource;
    os: string;
    appName?: string | null;
    title: string;
    body: string;
    level: NotificationLevel;
    category?: string | null;
    meta?: Record<string, unknown> | null;
    raw?: Record<string, unknown> | null;
};

type NotificationSettingsState = {
    storeAppNotifications: boolean;
    captureSystemNotifications: boolean;
    retentionDays: 7 | 30 | 90;
    blockedApps: string[];
    collector: {
        platform: string;
        supported: boolean;
        enabled: boolean;
        mode: 'official' | 'experimental' | 'planned' | 'unsupported';
        lastError: string | null;
    };
};

type NotificationsSectionProps = {
    showToast: (message: string) => void;
};

const PAGE_SIZE = 20;

const periodOptions: Array<{ value: string; label: string; days?: number }> = [
    { value: 'all', label: 'Todo período' },
    { value: '24h', label: 'Últimas 24h', days: 1 },
    { value: '7d', label: 'Últimos 7 dias', days: 7 },
    { value: '30d', label: 'Últimos 30 dias', days: 30 },
    { value: '90d', label: 'Últimos 90 dias', days: 90 },
];

const levelLabel: Record<NotificationLevel, string> = {
    info: 'Info',
    warn: 'Aviso',
    error: 'Erro',
};

const formatDateTime = (timestamp: number): string => {
    try {
        return new Date(timestamp).toLocaleString();
    } catch {
        return '-';
    }
};

const truncate = (text: string, max = 120): string => {
    if (!text) return '';
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
};

// Icon Components (Simple SVG)
const SettingsIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
);

const FilterIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
    </svg>
);

const EyeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
);

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({ showToast }) => {
    const [settings, setSettings] = useState<NotificationSettingsState | null>(null);
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState<'all' | NotificationSource>('all');
    const [levelFilter, setLevelFilter] = useState<'all' | NotificationLevel>('all');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [periodFilter, setPeriodFilter] = useState('7d');

    const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
    const [showCaptureConfirm, setShowCaptureConfirm] = useState(false);
    const [blockedAppInput, setBlockedAppInput] = useState('');

    const [reloadToken, setReloadToken] = useState(0);

    // Modal Control
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);

    const fromTo = useMemo(() => {
        const option = periodOptions.find((entry) => entry.value === periodFilter);
        if (!option || !option.days) return {};
        const from = Date.now() - option.days * 24 * 60 * 60 * 1000;
        return { from };
    }, [periodFilter]);

    const loadSettings = async () => {
        try {
            const next = await window.notifications.getSettings();
            setSettings(next as NotificationSettingsState);
        } catch (error) {
            console.error('Failed to load notification settings:', error);
            showToast('Erro ao carregar configurações de notificações.');
        }
    };

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const response = await window.notifications.list({
                search: search || undefined,
                source: sourceFilter,
                level: levelFilter,
                category: categoryFilter.trim() || undefined,
                from: fromTo.from,
                page,
                pageSize: PAGE_SIZE,
            });

            setItems(response.items as NotificationItem[]);
            setTotal(response.total);
            setTotalPages(response.totalPages);

            if (page > response.totalPages && response.totalPages > 0) {
                setPage(response.totalPages);
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
            showToast('Erro ao carregar histórico de notificações.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 250);
        return () => clearTimeout(timeout);
    }, [searchInput]);

    useEffect(() => {
        loadSettings();
    }, []);

    useEffect(() => {
        loadNotifications();
    }, [search, sourceFilter, levelFilter, categoryFilter, periodFilter, page, reloadToken]);

    useEffect(() => {
        const offUpdated = window.notifications.onUpdated(() => {
            setReloadToken((current) => current + 1);
        });
        const offSettings = window.notifications.onSettingsUpdated((payload) => {
            setSettings(payload as NotificationSettingsState);
        });
        return () => {
            offUpdated?.();
            offSettings?.();
        };
    }, []);

    const applySettings = async (
        patch: Partial<Omit<NotificationSettingsState, 'collector'>>
    ): Promise<NotificationSettingsState | null> => {
        try {
            const next = await window.notifications.setSettings(patch);
            const typed = next as NotificationSettingsState;
            setSettings(typed);
            return typed;
        } catch (error) {
            console.error('Failed to update notification settings:', error);
            showToast('Erro ao atualizar configurações de notificações.');
            return null;
        }
    };

    const handleEnableSystemCapture = async () => {
        setShowCaptureConfirm(false);
        const next = await applySettings({ captureSystemNotifications: true });
        if (next?.captureSystemNotifications) {
            showToast('Captura de notificações do sistema ativada.');
        } else {
            showToast('Captura do sistema indisponível neste ambiente.');
        }
    };

    const handleDisableSystemCapture = async () => {
        await applySettings({ captureSystemNotifications: false });
        showToast('Captura de notificações do sistema desativada.');
    };

    const handleAddBlockedApp = async () => {
        if (!settings) return;
        const appName = blockedAppInput.trim();
        if (!appName) return;
        if (settings.blockedApps.some((entry) => entry.toLowerCase() === appName.toLowerCase())) {
            setBlockedAppInput('');
            return;
        }
        await applySettings({ blockedApps: [...settings.blockedApps, appName] });
        setBlockedAppInput('');
    };

    const handleRemoveBlockedApp = async (appName: string) => {
        if (!settings) return;
        await applySettings({
            blockedApps: settings.blockedApps.filter((entry) => entry !== appName),
        });
    };

    const handleClearAll = async () => {
        if (!window.confirm('Tem certeza que deseja apagar todo o histórico de notificações?')) return;
        const result = await window.notifications.clear();
        if (result.success) {
            showToast(`Histórico limpo (${result.deleted} itens removidos).`);
            setPage(1);
            setReloadToken((current) => current + 1);
            setSelectedNotification(null);
        }
    };

    const handleClearByRetention = async () => {
        if (!settings) return;
        const result = await window.notifications.clear({ days: settings.retentionDays });
        if (result.success) {
            showToast(`Notificações antigas removidas (${result.deleted}).`);
            setPage(1);
            setReloadToken((current) => current + 1);
        }
    };

    const handleClearCurrentPeriod = async () => {
        if (!fromTo.from) {
            showToast('Selecione um período específico para limpar.');
            return;
        }
        if (!window.confirm('Deseja apagar as notificações do período filtrado atualmente?')) {
            return;
        }
        const result = await window.notifications.clear({
            from: fromTo.from,
            to: Date.now(),
        });
        if (result.success) {
            showToast(`Período filtrado limpo (${result.deleted}).`);
            setPage(1);
            setReloadToken((current) => current + 1);
        }
    };

    const handleExport = async (format: 'json' | 'csv') => {
        const result = await window.notifications.export(format, {
            search: search || undefined,
            source: sourceFilter,
            level: levelFilter,
            category: categoryFilter.trim() || undefined,
            from: fromTo.from,
        });

        if (result.canceled) {
            return;
        }

        if (result.success) {
            showToast(`Exportação concluída (${result.count} itens em ${result.filePath}).`);
        } else {
            showToast('Falha ao exportar notificações.');
        }
    };

    const handleDelete = async (id: string) => {
        const result = await window.notifications.delete(id);
        if (result.success) {
            if (selectedNotification?.id === id) {
                setSelectedNotification(null);
            }
            setReloadToken((current) => current + 1);
        }
    };

    const handleSelectNotification = async (id: string) => {
        try {
            const item = await window.notifications.get(id);
            setSelectedNotification(item as NotificationItem | null);
        } catch (error) {
            console.error('Failed to load notification details:', error);
        }
    };

    const handleTestNotification = async () => {
        const result = await window.notifications.notify({
            title: 'Teste da Central de Notificações',
            body: 'Esta notificação foi gerada pelo NEO e salva no histórico local.',
            level: 'info',
            category: 'manual-test',
            meta: { source: 'settings-notifications-section' },
        });
        if (result.success) {
            showToast('Notificação de teste enviada.');
        } else {
            showToast('Falha ao enviar notificação de teste.');
        }
    };

    return (
        <div className="settings-content-inner">
            <div className="content-header">
                <h3>Notificações</h3>
                <p className="header-desc">
                    Histórico local das notificações do app. Clique nos ícones para configurar ou filtrar.
                </p>
            </div>

            <div className="notifications-body">
                <div className="notifications-header-controls">
                    <button
                        className={`icon-control-btn ${showFilterModal ? 'active' : ''}`}
                        onClick={() => setShowFilterModal(true)}
                        title="Filtros e Ações"
                    >
                        <FilterIcon />
                    </button>
                    <button
                        className={`icon-control-btn ${showSettingsModal ? 'active' : ''}`}
                        onClick={() => setShowSettingsModal(true)}
                        title="Configurações de Coleta"
                    >
                        <SettingsIcon />
                    </button>
                </div>

                <div className="notifications-table-container">
                    <div className="notifications-table-header">
                        <strong>Histórico</strong>
                        <span>{total} itens</span>
                    </div>

                    <div className="notifications-scroll-area">
                        <table className="notifications-table">
                            <thead>
                                <tr>
                                    <th className="col-date">Data/Hora</th>
                                    <th className="col-source">Origem</th>
                                    <th className="col-title">Título</th>
                                    <th className="col-body">Resumo</th>
                                    <th className="col-actions">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!loading && items.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="notifications-empty-state">
                                            Nenhuma notificação encontrada.
                                        </td>
                                    </tr>
                                )}
                                {items.map((item) => (
                                    <tr key={item.id}>
                                        <td className="col-date">{formatDateTime(item.createdAt)}</td>
                                        <td className="col-source">{item.source === 'app' ? 'NEO' : (item.appName || 'system')}</td>
                                        <td className="col-title">{item.title || '-'}</td>
                                        <td className="col-body">
                                            <div className="col-summary-content" title={item.body}>
                                                {truncate(item.body || '-', 100)}
                                            </div>
                                        </td>
                                        <td className="col-actions">
                                            <div className="notifications-row-actions">
                                                <button className="icon-action-btn" onClick={() => handleSelectNotification(item.id)} title="Ver detalhes">
                                                    <EyeIcon />
                                                </button>
                                                <button className="icon-action-btn delete" onClick={() => handleDelete(item.id)} title="Apagar">
                                                    <TrashIcon />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="notifications-pagination">
                        <div className="notifications-pagination-info">
                            Mostrando {items.length} de {total} itens
                        </div>
                        <div className="pagination-controls">
                            <button
                                className="btn-secondary-compact"
                                disabled={page <= 1}
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                            >
                                Anterior
                            </button>
                            <span>{page} / {Math.max(1, totalPages)}</span>
                            <button
                                className="btn-secondary-compact"
                                disabled={page >= totalPages}
                                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Configurações */}
            {showSettingsModal && (
                <div className="notifications-modal-overlay" onClick={() => setShowSettingsModal(false)}>
                    <div className="notifications-modal-card" onClick={(event) => event.stopPropagation()}>
                        <div className="notifications-modal-header">
                            <h4>Configurações de Coleta</h4>
                            <div className="notifications-modal-actions">
                                <button className="btn-secondary-compact" onClick={handleTestNotification}>
                                    Testar
                                </button>
                                <button className="btn-secondary-compact" onClick={() => setShowSettingsModal(false)}>Fechar</button>
                            </div>
                        </div>
                        <div className="notifications-setting-card">
                            <div className="notifications-privacy-warning">
                                <strong>Aviso:</strong> capturar notificações do sistema pode registrar conteúdo sensível. Tudo fica salvo localmente.
                            </div>

                            <div className="notifications-toggle-row">
                                <div>
                                    <strong>Salvar notificações do app</strong>
                                    <p>Mantém registro local das notificações criadas pelo NEO.</p>
                                </div>
                                <button
                                    className={`switch-toggle-button ${settings?.storeAppNotifications ? 'active' : ''}`}
                                    disabled={!settings}
                                    onClick={() => applySettings({ storeAppNotifications: !settings?.storeAppNotifications })}
                                    aria-label="Toggle store app notifications"
                                />
                            </div>

                            <div className="notifications-toggle-row">
                                <div>
                                    <strong>Capturar notificações do sistema (experimental)</strong>
                                    <p>Status: {settings?.collector.supported ? 'Suportado' : 'Não suportado'}</p>
                                </div>
                                <button
                                    className={`switch-toggle-button ${settings?.captureSystemNotifications ? 'active' : ''}`}
                                    disabled={!settings?.collector.supported}
                                    onClick={() => {
                                        if (!settings?.captureSystemNotifications) {
                                            setShowCaptureConfirm(true);
                                            return;
                                        }
                                        handleDisableSystemCapture();
                                    }}
                                    aria-label="Toggle capture system notifications"
                                />
                            </div>

                            <div className="notifications-form-row">
                                <label>Período de Retenção</label>
                                <CustomSelect
                                    value={String(settings?.retentionDays ?? 30)}
                                    onChange={(val: string) => applySettings({ retentionDays: Number(val) as 7 | 30 | 90 })}
                                    options={[
                                        { label: '7 dias', value: '7' },
                                        { label: '30 dias', value: '30' },
                                        { label: '90 dias', value: '90' },
                                    ]}
                                />
                            </div>

                            <div className="notifications-form-row">
                                <label>Blocklist (origem/app)</label>
                                <div className="notifications-inline-form">
                                    <input
                                        value={blockedAppInput}
                                        onChange={(event) => setBlockedAppInput(event.target.value)}
                                        placeholder="Ex.: slack, discord"
                                    />
                                    <button className="btn-secondary-compact" onClick={handleAddBlockedApp}>Add</button>
                                </div>
                                <div className="notifications-chip-list">
                                    {(settings?.blockedApps || []).map((appName) => (
                                        <button key={appName} className="notifications-chip" onClick={() => handleRemoveBlockedApp(appName)}>
                                            {appName} ×
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Filtros e Ações */}
            {showFilterModal && (
                <div className="notifications-modal-overlay" onClick={() => setShowFilterModal(false)}>
                    <div className="notifications-modal-card" onClick={(event) => event.stopPropagation()}>
                        <div className="notifications-modal-header">
                            <h4>Filtros e Ações</h4>
                            <button className="btn-secondary-compact" onClick={() => setShowFilterModal(false)}>Fechar</button>
                        </div>
                        <div className="notifications-filters-grid">
                            <div className="notifications-form-row">
                                <label>Texto</label>
                                <input
                                    value={searchInput}
                                    onChange={(event) => setSearchInput(event.target.value)}
                                    placeholder="Buscar conteúdo..."
                                />
                            </div>
                            <div className="notifications-form-row">
                                <label>Origem</label>
                                <CustomSelect
                                    value={sourceFilter}
                                    onChange={(val: string) => { setSourceFilter(val as 'all' | NotificationSource); setPage(1); }}
                                    options={[
                                        { label: 'Todas', value: 'all' },
                                        { label: 'App (NEO)', value: 'app' },
                                        { label: 'Sistema', value: 'system' },
                                    ]}
                                />
                            </div>
                            <div className="notifications-form-row">
                                <label>Nível</label>
                                <CustomSelect
                                    value={levelFilter}
                                    onChange={(val: string) => { setLevelFilter(val as 'all' | NotificationLevel); setPage(1); }}
                                    options={[
                                        { label: 'Todos', value: 'all' },
                                        { label: 'Info', value: 'info' },
                                        { label: 'Aviso', value: 'warn' },
                                        { label: 'Erro', value: 'error' },
                                    ]}
                                />
                            </div>
                            <div className="notifications-form-row">
                                <label>Período</label>
                                <CustomSelect
                                    value={periodFilter}
                                    onChange={(val: string) => { setPeriodFilter(val); setPage(1); }}
                                    options={periodOptions}
                                />
                            </div>
                        </div>

                        <div className="notifications-actions-row">
                            <button className="btn-secondary-compact" onClick={() => handleExport('json')}>Exportar JSON</button>
                            <button className="btn-secondary-compact" onClick={() => handleExport('csv')}>Exportar CSV</button>
                            <button className="btn-danger-outline" onClick={handleClearCurrentPeriod}>Limpar período filtrado</button>
                            <button className="btn-danger-outline" onClick={handleClearAll}>Limpar TUDO</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detalhes da Notificação (Existente) */}
            {selectedNotification && (
                <div className="notifications-modal-overlay" onClick={() => setSelectedNotification(null)}>
                    <div className="notifications-modal-card" onClick={(event) => event.stopPropagation()}>
                        <div className="notifications-modal-header">
                            <h4>Detalhes</h4>
                            <button className="btn-secondary-compact" onClick={() => setSelectedNotification(null)}>Fechar</button>
                        </div>
                        <div className="notifications-modal-body">
                            <pre style={{ maxHeight: '400px', overflow: 'auto' }}>
                                {JSON.stringify(selectedNotification, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmação de Captura (Existente) */}
            {showCaptureConfirm && (
                <div className="notifications-modal-overlay" onClick={() => setShowCaptureConfirm(false)}>
                    <div className="notifications-modal-card compact" onClick={(event) => event.stopPropagation()}>
                        <div className="notifications-modal-header">
                            <h4>Ativar captura do sistema?</h4>
                        </div>
                        <div className="notifications-modal-body">
                            <p>Esta opção pode registrar conteúdo sensível de outros aplicativos. Tudo fica salvo localmente.</p>
                            <div className="notifications-actions-row">
                                <button className="btn-secondary-compact" onClick={() => setShowCaptureConfirm(false)}>Cancelar</button>
                                <button className="btn-danger-outline" onClick={handleEnableSystemCapture}>Confirmar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

