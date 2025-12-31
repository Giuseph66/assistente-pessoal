import { useEffect, useState } from 'react';
import { AIConfig, AIProviderId } from '@ricky/shared';
import './AIAgentSettings.css';

export function AIAgentSettings(): JSX.Element {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([]);
  const [models, setModels] = useState<Array<{
    id: string;
    name: string;
    provider: string;
    supportsVision: boolean;
    maxTokens?: number;
    supportsStreaming?: boolean;
  }>>([]);
  const [selectedModel, setSelectedModel] = useState<{
    id: string;
    name: string;
    provider: string;
    supportsVision: boolean;
    maxTokens?: number;
    supportsStreaming?: boolean;
  } | null>(null);
  const [keys, setKeys] = useState<Array<{
    id: number;
    providerId: string;
    alias: string;
    last4: string;
    status: string;
    cooldownUntil?: number;
    successCount: number;
    failureCount: number;
    lastUsedAt?: number;
    lastErrorCode?: string;
  }>>([]);
  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>('gemini');
  const [newKeyAlias, setNewKeyAlias] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showAddKey, setShowAddKey] = useState(false);
  const [testingKey, setTestingKey] = useState<number | null>(null);
  const [testingConfig, setTestingConfig] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (config?.providerId) {
      loadModels(config.providerId);
      loadKeys(config.providerId);
    }
  }, [config?.providerId]);

  useEffect(() => {
    if (config?.modelName && models.length > 0) {
      const model = models.find(m => m.id === config.modelName);
      setSelectedModel(model || null);
    }
  }, [config?.modelName, models]);

  const loadData = async () => {
    try {
      const [configValue, providersValue] = await Promise.all([
        window.ai.getConfig(),
        window.ai.listProviders(),
      ]);
      setConfig(configValue);
      setProviders(providersValue || []);
      if (configValue?.providerId) {
        setSelectedProvider(configValue.providerId);
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar configurações');
    }
  };

  const loadModels = async (providerId: string) => {
    setLoadingModels(true);
    try {
      const modelsValue = await window.ai.listModels(providerId);
      setModels(modelsValue || []);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar modelos');
    } finally {
      setLoadingModels(false);
    }
  };

  const loadKeys = async (providerId?: string) => {
    try {
      const keysValue = await window.ai.listKeys(providerId);
      setKeys(keysValue || []);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar chaves');
    }
  };

  const handleConfigChange = async (patch: Partial<AIConfig>) => {
    if (!config) return;
    try {
      setError(null);
      // Envia apenas o patch para evitar reenviar campos antigos (ex.: modelName)
      const updated = await window.ai.saveConfig(patch);
      setConfig(updated);
      setSuccess('Configuração salva com sucesso');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar configuração');
    }
  };

  const handleProviderChange = async (providerId: AIProviderId) => {
    setSelectedProvider(providerId);
    setError(null);
    setSuccess(null);
    try {
      setLoadingModels(true);
      const modelsValue = await window.ai.listModels(providerId);
      const nextModels = modelsValue || [];
      setModels(nextModels);

      const nextModelId = nextModels[0]?.id;
      const updated = await window.ai.saveConfig(
        nextModelId ? { providerId, modelName: nextModelId } : { providerId }
      );
      setConfig(updated);

      await loadKeys(providerId);
      setSuccess('Configuração salva com sucesso');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar configuração');
    } finally {
      setLoadingModels(false);
    }
  };

  const handleModelChange = async (modelId: string) => {
    await handleConfigChange({ modelName: modelId });
  };

  const handleAddKey = async () => {
    if (!newKeyAlias || !newKeyValue) {
      setError('Preencha alias e chave');
      return;
    }
    try {
      setError(null);
      await window.ai.addKey(selectedProvider, newKeyValue, newKeyAlias);
      setNewKeyAlias('');
      setNewKeyValue('');
      setShowAddKey(false);
      await loadKeys(selectedProvider);
      setSuccess('Chave adicionada com sucesso');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Falha ao adicionar chave');
    }
  };

  const handleRemoveKey = async (keyId: number) => {
    if (!confirm('Tem certeza que deseja remover esta chave?')) return;
    try {
      await window.ai.removeKey(keyId);
      await loadKeys(selectedProvider);
      setSuccess('Chave removida com sucesso');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Falha ao remover chave');
    }
  };

  const handleTestKey = async (keyId: number) => {
    setTestingKey(keyId);
    setError(null);
    setSuccess(null);
    try {
      const result = await window.ai.testKey(keyId, selectedProvider);
      if (result.success) {
        setSuccess('Chave testada com sucesso');
        await loadKeys(selectedProvider);
      } else {
        setError(result.error || 'Falha ao testar chave');
      }
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
    } catch (err: any) {
      setError(err?.message || 'Falha ao testar chave');
    } finally {
      setTestingKey(null);
    }
  };

  const handleTestConfig = async () => {
    if (!config) return;
    setTestingConfig(true);
    setError(null);
    setSuccess(null);
    try {
      // Testa usando a primeira key ativa do provider
      const activeKey = providerKeys.find(k => k.status === 'active');
      if (!activeKey) {
        setError('Nenhuma chave ativa encontrada para este provider');
        return;
      }
      const result = await window.ai.testKey(activeKey.id, selectedProvider);
      if (result.success) {
        setSuccess('Configuração testada com sucesso! Provider e modelo estão funcionando.');
      } else {
        setError(result.error || 'Falha ao testar configuração');
      }
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
    } catch (err: any) {
      setError(err?.message || 'Falha ao testar configuração');
    } finally {
      setTestingConfig(false);
    }
  };

  const handleUpdateKeyStatus = async (keyId: number, status: 'active' | 'cooldown' | 'disabled') => {
    try {
      await window.ai.updateKeyStatus(keyId, status);
      await loadKeys(selectedProvider);
    } catch (err: any) {
      setError(err?.message || 'Falha ao atualizar status');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'status-badge status-active';
      case 'cooldown':
        return 'status-badge status-cooldown';
      case 'disabled':
        return 'status-badge status-disabled';
      default:
        return 'status-badge';
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Nunca';
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  if (!config) {
    return <div className="ai-settings-loading">Carregando configurações...</div>;
  }

  const providerKeys = keys.filter((k) => k.providerId === selectedProvider);
  const activeKeysCount = providerKeys.filter(k => k.status === 'active').length;

  return (
    <div className="ai-settings-container">
      <div className="ai-settings-header">
        <h2>Configurações do Agente de IA</h2>
        <button
          className="btn btn-primary"
          onClick={handleTestConfig}
          disabled={testingConfig || activeKeysCount === 0}
          title={activeKeysCount === 0 ? 'Adicione uma chave API primeiro' : 'Testar configuração atual'}
        >
          {testingConfig ? 'Testando...' : '🧪 Testar Configuração'}
        </button>
      </div>

      {error && (
        <div className="ai-settings-alert ai-settings-alert-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {success && (
        <div className="ai-settings-alert ai-settings-alert-success">
          <span>✅</span> {success}
        </div>
      )}

      {/* Seção 1: Provider e Modelo */}
      <section className="ai-settings-section">
        <div className="ai-settings-section-header">
          <h3>Provider e Modelo</h3>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => loadModels(selectedProvider)}
            disabled={loadingModels}
          >
            {loadingModels ? 'Carregando...' : '🔄 Atualizar Lista'}
          </button>
        </div>

        <div className="ai-settings-card">
          <div className="ai-settings-field">
            <label>Provedor</label>
            <select
              value={selectedProvider}
              onChange={(e) => handleProviderChange(e.target.value as AIProviderId)}
              className="ai-settings-select"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ai-settings-field">
            <label>Modelo</label>
            <select
              value={config.modelName}
              onChange={(e) => handleModelChange(e.target.value)}
              className="ai-settings-select"
              disabled={models.length === 0}
            >
              {models.length === 0 ? (
                <option>Carregando modelos...</option>
              ) : (
                models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedModel && (
            <div className="ai-settings-model-info">
              <h4>Informações do Modelo</h4>
              <div className="ai-settings-model-details">
                <div className="model-detail-item">
                  <span className="model-detail-label">Nome:</span>
                  <span className="model-detail-value">{selectedModel.name}</span>
                </div>
                <div className="model-detail-item">
                  <span className="model-detail-label">Suporte a Visão:</span>
                  <span className="model-detail-value">
                    {selectedModel.supportsVision ? '✅ Sim' : '❌ Não'}
                  </span>
                </div>
                {selectedModel.maxTokens && (
                  <div className="model-detail-item">
                    <span className="model-detail-label">Max Tokens:</span>
                    <span className="model-detail-value">{selectedModel.maxTokens.toLocaleString()}</span>
                  </div>
                )}
                <div className="model-detail-item">
                  <span className="model-detail-label">Streaming:</span>
                  <span className="model-detail-value">
                    {selectedModel.supportsStreaming ? '✅ Suportado' : '❌ Não suportado'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Seção 2: API Keys */}
      <section className="ai-settings-section">
        <div className="ai-settings-section-header">
          <h3>API Keys</h3>
          <span className="ai-settings-badge">
            {activeKeysCount} {activeKeysCount === 1 ? 'chave ativa' : 'chaves ativas'}
          </span>
        </div>

        <div className="ai-settings-card">
          {!showAddKey ? (
            <button
              className="btn btn-primary"
              onClick={() => setShowAddKey(true)}
            >
              ➕ Adicionar Nova Chave
            </button>
          ) : (
            <div className="ai-settings-add-key-form">
              <h4>Adicionar Nova Chave</h4>
              <div className="ai-settings-field">
                <label>Alias (Nome para identificar)</label>
                <input
                  type="text"
                  value={newKeyAlias}
                  onChange={(e) => setNewKeyAlias(e.target.value)}
                  placeholder="Ex: Gemini Key 1, OpenAI Production Key"
                  className="ai-settings-input"
                />
              </div>
              <div className="ai-settings-field">
                <label>API Key</label>
                <input
                  type="password"
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  placeholder="Cole sua API key aqui"
                  className="ai-settings-input"
                />
              </div>
              <div className="ai-settings-form-actions">
                <button
                  className="btn btn-success"
                  onClick={handleAddKey}
                  disabled={!newKeyAlias || !newKeyValue}
                >
                  💾 Salvar
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAddKey(false);
                    setNewKeyAlias('');
                    setNewKeyValue('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="ai-settings-keys-list">
            {providerKeys.length === 0 ? (
              <div className="ai-settings-empty-state">
                <p>Nenhuma chave cadastrada para este provider</p>
                <p className="ai-settings-hint">Adicione uma chave API para começar a usar o agente de IA</p>
              </div>
            ) : (
              providerKeys.map((key) => (
                <div key={key.id} className="ai-settings-key-card">
                  <div className="ai-settings-key-header">
                    <div className="ai-settings-key-info">
                      <h4>{key.alias}</h4>
                      <span className={getStatusBadgeClass(key.status)}>
                        {key.status === 'active' ? '🟢 Ativa' : key.status === 'cooldown' ? '🟡 Cooldown' : '🔴 Desabilitada'}
                      </span>
                    </div>
                    <div className="ai-settings-key-actions">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleTestKey(key.id)}
                        disabled={testingKey === key.id}
                        title="Testar chave"
                      >
                        {testingKey === key.id ? '⏳ Testando...' : '🧪 Testar'}
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleUpdateKeyStatus(key.id, key.status === 'active' ? 'disabled' : 'active')}
                        title={key.status === 'active' ? 'Desabilitar chave' : 'Habilitar chave'}
                      >
                        {key.status === 'active' ? '🔴 Desabilitar' : '🟢 Habilitar'}
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveKey(key.id)}
                        title="Remover chave"
                      >
                        🗑️ Remover
                      </button>
                    </div>
                  </div>
                  <div className="ai-settings-key-details">
                    <div className="key-detail-row">
                      <span className="key-detail-label">Chave:</span>
                      <span className="key-detail-value">***{key.last4}</span>
                    </div>
                    <div className="key-detail-row">
                      <span className="key-detail-label">Estatísticas:</span>
                      <span className="key-detail-value">
                        ✅ {key.successCount} sucessos | ❌ {key.failureCount} falhas
                      </span>
                    </div>
                    {key.lastUsedAt && (
                      <div className="key-detail-row">
                        <span className="key-detail-label">Última utilização:</span>
                        <span className="key-detail-value">{formatDate(key.lastUsedAt)}</span>
                      </div>
                    )}
                    {key.cooldownUntil && key.cooldownUntil > Date.now() && (
                      <div className="key-detail-row">
                        <span className="key-detail-label">Cooldown até:</span>
                        <span className="key-detail-value">{formatDate(key.cooldownUntil)}</span>
                      </div>
                    )}
                    {key.lastErrorCode && (
                      <div className="key-detail-row">
                        <span className="key-detail-label">Último erro:</span>
                        <span className="key-detail-value error-code">{key.lastErrorCode}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Seção 3: Configurações Avançadas */}
      <section className="ai-settings-section">
        <h3>Configurações Avançadas</h3>
        <div className="ai-settings-card">
          <div className="ai-settings-grid">
            <div className="ai-settings-field">
              <label>
                Timeout (ms)
                <span className="ai-settings-hint">Tempo máximo de espera por resposta</span>
              </label>
              <input
                type="number"
                value={config.timeoutMs}
                onChange={(e) => handleConfigChange({ timeoutMs: parseInt(e.target.value) || 30000 })}
                className="ai-settings-input"
                min="1000"
                max="300000"
                step="1000"
              />
            </div>

            <div className="ai-settings-field">
              <label>
                Tentativas (Retries)
                <span className="ai-settings-hint">Número de tentativas em caso de falha</span>
              </label>
              <input
                type="number"
                value={config.retries}
                onChange={(e) => handleConfigChange({ retries: parseInt(e.target.value) || 2 })}
                className="ai-settings-input"
                min="0"
                max="10"
              />
            </div>

            <div className="ai-settings-field">
              <label>
                Dimensão Máxima da Imagem (px)
                <span className="ai-settings-hint">Imagens maiores serão redimensionadas</span>
              </label>
              <input
                type="number"
                value={config.maxImageDimension}
                onChange={(e) => handleConfigChange({ maxImageDimension: parseInt(e.target.value) || 1280 })}
                className="ai-settings-input"
                min="256"
                max="4096"
                step="128"
              />
            </div>
          </div>

          <div className="ai-settings-toggles">
            <label className="ai-settings-toggle">
              <input
                type="checkbox"
                checked={config.streaming}
                onChange={(e) => handleConfigChange({ streaming: e.target.checked })}
                disabled={!selectedModel?.supportsStreaming}
              />
              <span>
                Streaming
                {!selectedModel?.supportsStreaming && <span className="ai-settings-hint"> (Modelo não suporta)</span>}
              </span>
            </label>

            <label className="ai-settings-toggle">
              <input
                type="checkbox"
                checked={config.saveHistory}
                onChange={(e) => handleConfigChange({ saveHistory: e.target.checked })}
              />
              <span>Salvar respostas no histórico</span>
            </label>
          </div>
        </div>
      </section>

      {/* Seção 4: Política de Fallback */}
      <section className="ai-settings-section">
        <h3>Política de Fallback</h3>
        <div className="ai-settings-card">
          <div className="ai-settings-grid">
            <div className="ai-settings-field">
              <label>
                Máximo de Tentativas por Requisição
                <span className="ai-settings-hint">Número máximo de chaves a tentar</span>
              </label>
              <input
                type="number"
                value={config.fallbackMaxAttempts}
                onChange={(e) => handleConfigChange({ fallbackMaxAttempts: parseInt(e.target.value) || 3 })}
                className="ai-settings-input"
                min="1"
                max="10"
              />
            </div>

            <div className="ai-settings-field">
              <label>
                Cooldown (minutos)
                <span className="ai-settings-hint">Tempo de espera antes de reutilizar uma chave em cooldown</span>
              </label>
              <input
                type="number"
                value={config.fallbackCooldownMinutes}
                onChange={(e) => handleConfigChange({ fallbackCooldownMinutes: parseInt(e.target.value) || 10 })}
                className="ai-settings-input"
                min="1"
                max="1440"
              />
            </div>
          </div>

          <div className="ai-settings-info-box">
            <h4>📋 Códigos de Erro que Disparam Fallback</h4>
            <ul>
              <li><strong>429</strong> - Rate Limit (muitas requisições)</li>
              <li><strong>5xx</strong> - Erros do servidor</li>
              <li><strong>Timeout</strong> - Requisição excedeu o tempo limite</li>
              <li><strong>Connection errors</strong> - Erros de conexão</li>
            </ul>
            <p className="ai-settings-warning">
              <strong>⚠️ Nota:</strong> Erros <strong>401</strong> (Não autorizado) e <strong>403</strong> (Proibido) 
              desabilitam a chave permanentemente, pois indicam problema de autenticação.
            </p>
          </div>
        </div>
      </section>

      {/* Seção 5: Segurança */}
      <section className="ai-settings-section">
        <h3>Segurança</h3>
        <div className="ai-settings-card">
          <div className="ai-settings-info-box">
            <h4>🔒 Criptografia de Chaves</h4>
            <p>
              As chaves API são armazenadas criptografadas usando <strong>safeStorage</strong> do Electron 
              (quando disponível) ou <strong>AES-256-GCM</strong> como fallback.
            </p>
            <h4>🛡️ Segurança do Renderer</h4>
            <p>
              As chaves <strong>nunca são expostas</strong> ao renderer process. Todas as operações são feitas 
              via IPC no main process, garantindo que as chaves permaneçam seguras.
            </p>
            <p className="ai-settings-hint">
              As chaves são descriptografadas apenas quando necessário para fazer chamadas à API, e nunca são 
              logadas ou expostas em mensagens de erro.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
