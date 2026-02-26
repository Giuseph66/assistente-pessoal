import React from 'react';
import { AIBrainData } from '@neo/shared';
import { FlowIcon } from './FlowIcons';

interface AIBrainNodePropertiesProps {
  data: AIBrainData;
  onUpdate: (field: keyof AIBrainData, value: any) => void;
}

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--workflow-text-secondary)',
  display: 'block',
  marginTop: '16px',
  marginBottom: '4px',
};

const normalizeRoutes = (routes?: string[]): string[] => {
  if (!Array.isArray(routes)) return [];
  const dedupe = new Set<string>();
  for (const route of routes) {
    const next = (route || '').trim();
    if (next && next !== 'ERROR') dedupe.add(next);
  }
  return Array.from(dedupe);
};

const normalizeChannels = (channels?: string[]): string[] => {
  if (!Array.isArray(channels)) return [];
  return channels.map((c) => c.trim()).filter(Boolean);
};

export function AIBrainNodeProperties({ data, onUpdate }: AIBrainNodePropertiesProps) {
  const routes = normalizeRoutes(data.routes);
  const toolChannels = normalizeChannels(data.toolChannels);
  const captureRegion = data.captureRegion || { x: 0, y: 0, width: 300, height: 200 };
  const currentDefaultRoute = routes.includes(data.defaultRoute) ? data.defaultRoute : (routes[0] || '');

  const updateRoutes = (nextRoutes: string[]) => {
    const normalized = normalizeRoutes(nextRoutes);
    onUpdate('routes', normalized);
    if (!normalized.includes(currentDefaultRoute)) {
      onUpdate('defaultRoute', normalized[0] || '');
    }
  };

  const onRouteChange = (index: number, value: string) => {
    const next = [...routes];
    next[index] = value;
    updateRoutes(next);
  };

  const addRoute = () => {
    const baseName = 'ROUTE';
    let suffix = routes.length + 1;
    let next = `${baseName}_${suffix}`;
    while (routes.includes(next)) {
      suffix += 1;
      next = `${baseName}_${suffix}`;
    }
    updateRoutes([...routes, next]);
  };

  const removeRoute = (index: number) => {
    updateRoutes(routes.filter((_, idx) => idx !== index));
  };

  return (
    <>
      <div style={{
        padding: '12px',
        background: 'rgba(59, 130, 246, 0.08)',
        borderRadius: '8px',
        fontSize: '12px',
        color: 'var(--workflow-text-secondary)',
        border: '1px solid rgba(96, 165, 250, 0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FlowIcon name="brain" size={14} />
          O nó IA decide a rota, chama ferramentas e orquestra o fluxo.
        </div>
      </div>

      <div>
        <label style={labelStyle}>Instrução da IA (obrigatória)</label>
        <textarea
          className="workflow-input"
          style={{ minHeight: '110px', resize: 'vertical' }}
          value={data.instruction || ''}
          onChange={(e) => onUpdate('instruction', e.target.value)}
          placeholder="Explique objetivo, regras e formato JSON de saída."
        />
      </div>

      <div>
        <label style={labelStyle}>Template de Contexto (opcional)</label>
        <textarea
          className="workflow-input"
          style={{ minHeight: '90px', resize: 'vertical' }}
          value={data.contextTemplate || ''}
          onChange={(e) => onUpdate('contextTemplate', e.target.value)}
          placeholder="Informações adicionais para o prompt."
        />
      </div>

      <div>
        <label style={labelStyle}>Modo de Entrada</label>
        <select
          className="workflow-select"
          value={data.inputMode || 'hybrid'}
          onChange={(e) => onUpdate('inputMode', e.target.value)}
        >
          <option value="context">context</option>
          <option value="visual">visual</option>
          <option value="hybrid">hybrid</option>
        </select>
      </div>

      {(data.inputMode === 'visual' || data.inputMode === 'hybrid') && (
        <>
          <div>
            <label style={labelStyle}>Escopo da Captura</label>
            <select
              className="workflow-select"
              value={data.captureScope || 'fullscreen'}
              onChange={(e) => onUpdate('captureScope', e.target.value)}
            >
              <option value="fullscreen">fullscreen</option>
              <option value="region">region</option>
            </select>
          </div>

          {data.captureScope === 'region' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>X</label>
                <input
                  type="number"
                  className="workflow-input"
                  value={captureRegion.x}
                  onChange={(e) => onUpdate('captureRegion', { ...captureRegion, x: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label style={labelStyle}>Y</label>
                <input
                  type="number"
                  className="workflow-input"
                  value={captureRegion.y}
                  onChange={(e) => onUpdate('captureRegion', { ...captureRegion, y: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label style={labelStyle}>Width</label>
                <input
                  type="number"
                  className="workflow-input"
                  value={captureRegion.width}
                  onChange={(e) => onUpdate('captureRegion', { ...captureRegion, width: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label style={labelStyle}>Height</label>
                <input
                  type="number"
                  className="workflow-input"
                  value={captureRegion.height}
                  onChange={(e) => onUpdate('captureRegion', { ...captureRegion, height: Number(e.target.value) || 1 })}
                />
              </div>
            </div>
          )}
        </>
      )}

      <div>
        <label style={labelStyle}>Rotas Dinâmicas</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {routes.map((route, index) => (
            <div key={`${route}-${index}`} style={{ display: 'flex', gap: '8px' }}>
              <input
                className="workflow-input"
                value={route}
                onChange={(e) => onRouteChange(index, e.target.value)}
                placeholder="Nome da rota"
              />
              <button
                type="button"
                className="btn-workflow"
                onClick={() => removeRoute(index)}
                title="Remover rota"
              >
                <FlowIcon name="trash" size={13} />
              </button>
            </div>
          ))}
          <button type="button" className="btn-workflow" onClick={addRoute}>
            + Adicionar rota
          </button>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Rota Padrão</label>
        <select
          className="workflow-select"
          value={currentDefaultRoute}
          onChange={(e) => onUpdate('defaultRoute', e.target.value)}
        >
          {routes.length === 0 ? <option value="">Sem rotas</option> : null}
          {routes.map((route) => (
            <option key={route} value={route}>{route}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Tool Channels (um por linha, aceita *)</label>
        <textarea
          className="workflow-input"
          style={{ minHeight: '90px', resize: 'vertical' }}
          value={toolChannels.length ? toolChannels.join('\n') : ''}
          onChange={(e) => {
            const nextChannels = e.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean);
            onUpdate('toolChannels', nextChannels);
          }}
          placeholder="*\nautomation.click\nmapping.findTemplateOnScreen"
        />
      </div>

      <div>
        <label style={labelStyle}>Temperature (opcional)</label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="2"
          className="workflow-input"
          value={typeof data.temperature === 'number' ? data.temperature : ''}
          onChange={(e) => onUpdate('temperature', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Ex: 0.2"
        />
      </div>

      <div>
        <label style={labelStyle}>Max Tokens (opcional)</label>
        <input
          type="number"
          min="1"
          className="workflow-input"
          value={typeof data.maxTokens === 'number' ? data.maxTokens : ''}
          onChange={(e) => onUpdate('maxTokens', e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder="Ex: 500"
        />
      </div>

      <div>
        <label style={labelStyle}>Fail-safe Max Tool Calls</label>
        <input
          type="number"
          min="1"
          className="workflow-input"
          value={data.failSafeMaxToolCalls || 200}
          onChange={(e) => onUpdate('failSafeMaxToolCalls', Number(e.target.value) || 200)}
        />
      </div>
    </>
  );
}
