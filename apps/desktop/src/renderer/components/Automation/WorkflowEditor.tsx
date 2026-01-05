import { useState, useEffect } from 'react';
import {
  Workflow,
  WorkflowStep,
  AutomationAction,
  AutomationActionType,
  MappingPoint,
  ImageTemplate,
} from '@ricky/shared';
import './WorkflowEditor.css';
import { CustomSelect } from '../Modals/SettingsSections/CustomSelect';

interface WorkflowEditorProps {
  workflow: Workflow | null;
  mappings: { points: MappingPoint[]; templates: ImageTemplate[] };
  onSave: () => void;
  onCancel: () => void;
}

export function WorkflowEditor({
  workflow,
  mappings,
  onSave,
  onCancel,
}: WorkflowEditorProps): JSX.Element {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setDescription(workflow.description || '');
      setEnabled(workflow.enabled);
      setSteps([...workflow.steps].sort((a, b) => a.order - b.order));
    } else {
      setName('');
      setDescription('');
      setEnabled(true);
      setSteps([]);
    }
  }, [workflow]);

  const addStep = (actionType: AutomationActionType) => {
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action: createDefaultAction(actionType),
      order: steps.length,
    };
    setSteps([...steps, newStep]);
    setEditingStep(newStep);
  };

  const createDefaultAction = (type: AutomationActionType): AutomationAction => {
    const baseId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    switch (type) {
      case 'click':
        return { id: baseId, type: 'click', params: { button: 'left' } };
      case 'clickAt':
        return { id: baseId, type: 'clickAt', params: { x: 0, y: 0, button: 'left' } };
      case 'type':
        return { id: baseId, type: 'type', params: { text: '' } };
      case 'pressKey':
        return { id: baseId, type: 'pressKey', params: { key: 'Enter', modifiers: [] } };
      case 'wait':
        return { id: baseId, type: 'wait', params: { ms: 1000 } };
      case 'screenshot':
        return { id: baseId, type: 'screenshot', params: {} };
      case 'findImage':
        return { id: baseId, type: 'findImage', params: { templateName: '', timeout: 5000, confidence: 0.8 } };
      case 'moveMouse':
        return { id: baseId, type: 'moveMouse', params: { x: 0, y: 0 } };
      case 'drag':
        return { id: baseId, type: 'drag', params: { fromX: 0, fromY: 0, toX: 0, toY: 0, button: 'left' } };
      case 'loop':
        return { id: baseId, type: 'loop', params: { count: 1, actions: [] } };
      case 'condition':
        return { id: baseId, type: 'condition', params: { condition: 'imageFound', templateName: '', ifTrue: [], ifFalse: [] } };
      default:
        return { id: baseId, type: 'wait', params: { ms: 1000 } };
    }
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    setSteps(steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)));
  };

  const deleteStep = (stepId: string) => {
    setSteps(steps.filter((s) => s.id !== stepId).map((s, idx) => ({ ...s, order: idx })));
    if (editingStep?.id === stepId) {
      setEditingStep(null);
    }
  };

  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    const index = steps.findIndex((s) => s.id === stepId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === steps.length - 1) return;

    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    newSteps.forEach((s, idx) => (s.order = idx));
    setSteps(newSteps);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Nome do workflow é obrigatório');
      return;
    }

    try {
      setError(null);
      const workflowData: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(),
        description: description.trim() || undefined,
        steps: steps.map((s, idx) => ({ ...s, order: idx })),
        enabled,
      };

      if (workflow) {
        await window.automation.updateWorkflow(workflow.id, workflowData);
      } else {
        await window.automation.createWorkflow(workflowData);
      }
      onSave();
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar workflow');
    }
  };

  const actionTypes: { type: AutomationActionType; label: string }[] = [
    { type: 'click', label: 'Clicar em Ponto Mapeado' },
    { type: 'clickAt', label: 'Clicar em Coordenadas' },
    { type: 'type', label: 'Digitar Texto' },
    { type: 'pressKey', label: 'Pressionar Tecla' },
    { type: 'wait', label: 'Aguardar' },
    { type: 'screenshot', label: 'Capturar Screenshot' },
    { type: 'findImage', label: 'Encontrar Imagem' },
    { type: 'moveMouse', label: 'Mover Mouse' },
    { type: 'drag', label: 'Arrastar' },
    { type: 'loop', label: 'Loop' },
    { type: 'condition', label: 'Condição' },
  ];

  return (
    <div className="workflow-editor">
      <div className="workflow-editor-header">
        <h2>{workflow ? 'Editar Workflow' : 'Criar Workflow'}</h2>
        <div className="workflow-editor-actions">
          <button className="btn btn-primary" onClick={handleSave}>
            💾 Salvar
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>

      {error && (
        <div className="workflow-editor-alert workflow-editor-alert-error">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="workflow-editor-form">
        <div className="workflow-editor-field">
          <label>Nome do Workflow *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="workflow-editor-input"
            placeholder="Ex: Abrir aplicativo e fazer login"
          />
        </div>

        <div className="workflow-editor-field">
          <label>Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="workflow-editor-textarea"
            placeholder="Descreva o que este workflow faz..."
            rows={3}
          />
        </div>

        <div className="workflow-editor-field">
          <label className="workflow-editor-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Workflow Habilitado</span>
          </label>
        </div>
      </div>

      <div className="workflow-editor-steps">
        <div className="workflow-editor-steps-header">
          <h3>Passos do Workflow</h3>
          <div className="workflow-editor-add-actions">
            {actionTypes.map(({ type, label }) => (
              <button
                key={type}
                className="btn btn-sm btn-secondary"
                onClick={() => addStep(type)}
              >
                ➕ {label}
              </button>
            ))}
          </div>
        </div>

        {steps.length === 0 ? (
          <div className="workflow-editor-empty">
            <p>Nenhum passo adicionado</p>
            <p className="workflow-editor-hint">Adicione ações usando os botões acima</p>
          </div>
        ) : (
          <div className="workflow-editor-steps-list">
            {steps.map((step, index) => (
              <div key={step.id} className="workflow-editor-step">
                <div className="workflow-editor-step-header">
                  <span className="workflow-editor-step-number">{index + 1}</span>
                  <span className="workflow-editor-step-type">{step.action.type}</span>
                  <div className="workflow-editor-step-actions">
                    <button
                      className="btn btn-xs"
                      onClick={() => moveStep(step.id, 'up')}
                      disabled={index === 0}
                    >
                      ⬆️
                    </button>
                    <button
                      className="btn btn-xs"
                      onClick={() => moveStep(step.id, 'down')}
                      disabled={index === steps.length - 1}
                    >
                      ⬇️
                    </button>
                    <button
                      className="btn btn-xs"
                      onClick={() => setEditingStep(step)}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-xs btn-danger"
                      onClick={() => deleteStep(step.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                {editingStep?.id === step.id && (
                  <StepEditor
                    step={step}
                    mappings={mappings}
                    onUpdate={(updates) => updateStep(step.id, updates)}
                    onClose={() => setEditingStep(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StepEditorProps {
  step: WorkflowStep;
  mappings: { points: MappingPoint[]; templates: ImageTemplate[] };
  onUpdate: (updates: Partial<WorkflowStep>) => void;
  onClose: () => void;
}

function StepEditor({ step, mappings, onUpdate, onClose }: StepEditorProps): JSX.Element {
  const action = step.action;

  const renderActionParams = () => {
    switch (action.type) {
      case 'click':
        return (
          <div className="step-editor-params">
            <label>
              Ponto Mapeado:
              <CustomSelect
                value={(action.params as any).mappingPoint || ''}
                onChange={(val) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, mappingPoint: val } },
                  })
                }
                options={[
                  { label: 'Selecione...', value: '' },
                  ...mappings.points.map((p) => ({
                    label: `${p.name} (${p.x}, ${p.y})`,
                    value: p.name
                  }))
                ]}
              />
            </label>
            <label>
              Ou coordenadas X:
              <input
                type="number"
                value={(action.params as any).x || ''}
                onChange={(e) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, x: parseInt(e.target.value) || 0 } },
                  })
                }
              />
            </label>
            <label>
              Y:
              <input
                type="number"
                value={(action.params as any).y || ''}
                onChange={(e) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, y: parseInt(e.target.value) || 0 } },
                  })
                }
              />
            </label>
            <label>
              Botão:
              <CustomSelect
                value={(action.params as any).button || 'left'}
                onChange={(val) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, button: val } },
                  })
                }
                options={[
                  { label: 'Esquerdo', value: 'left' },
                  { label: 'Direito', value: 'right' },
                  { label: 'Meio', value: 'middle' }
                ]}
              />
            </label>
          </div>
        );

      case 'clickAt':
        return (
          <div className="step-editor-params">
            <label>
              X:
              <input
                type="number"
                value={(action.params as any).x || 0}
                onChange={(e) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, x: parseInt(e.target.value) || 0 } },
                  })
                }
              />
            </label>
            <label>
              Y:
              <input
                type="number"
                value={(action.params as any).y || 0}
                onChange={(e) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, y: parseInt(e.target.value) || 0 } },
                  })
                }
              />
            </label>
            <label>
              Botão:
              <CustomSelect
                value={(action.params as any).button || 'left'}
                onChange={(val) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, button: val } },
                  })
                }
                options={[
                  { label: 'Esquerdo', value: 'left' },
                  { label: 'Direito', value: 'right' },
                  { label: 'Meio', value: 'middle' }
                ]}
              />
            </label>
          </div>
        );

      case 'type':
        return (
          <div className="step-editor-params">
            <label>
              Texto:
              <textarea
                value={(action.params as any).text || ''}
                onChange={(e) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, text: e.target.value } },
                  })
                }
                rows={3}
              />
            </label>
          </div>
        );

      case 'pressKey':
        return (
          <div className="step-editor-params">
            <label>
              Tecla:
              <input
                type="text"
                value={(action.params as any).key || ''}
                onChange={(e) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, key: e.target.value } },
                  })
                }
                placeholder="Ex: Enter, Escape, Tab"
              />
            </label>
          </div>
        );

      case 'wait':
        return (
          <div className="step-editor-params">
            <label>
              Tempo (ms):
              <input
                type="number"
                value={(action.params as any).ms || 1000}
                onChange={(e) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, ms: parseInt(e.target.value) || 1000 } },
                  })
                }
              />
            </label>
            <label>
              Ou aguardar até encontrar imagem:
              <CustomSelect
                value={(action.params as any).orUntilImage || ''}
                onChange={(val) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, orUntilImage: val || undefined } },
                  })
                }
                options={[
                  { label: 'Não usar', value: '' },
                  ...mappings.templates.map((t) => ({ label: t.name, value: t.name }))
                ]}
              />
            </label>
          </div>
        );

      case 'findImage':
        return (
          <div className="step-editor-params">
            <label>
              Template:
              <CustomSelect
                value={(action.params as any).templateName || ''}
                onChange={(val) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, templateName: val } },
                  })
                }
                options={[
                  { label: 'Selecione...', value: '' },
                  ...mappings.templates.map((t) => ({ label: t.name, value: t.name }))
                ]}
              />
            </label>
            <label>
              Timeout (ms):
              <input
                type="number"
                value={(action.params as any).timeout || 5000}
                onChange={(e) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, timeout: parseInt(e.target.value) || 5000 } },
                  })
                }
              />
            </label>
          </div>
        );

      case 'moveMouse':
        return (
          <div className="step-editor-params">
            <label>
              X:
              <input
                type="number"
                value={(action.params as any).x || 0}
                onChange={(e) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, x: parseInt(e.target.value) || 0 } },
                  })
                }
              />
            </label>
            <label>
              Y:
              <input
                type="number"
                value={(action.params as any).y || 0}
                onChange={(e) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, y: parseInt(e.target.value) || 0 } },
                  })
                }
              />
            </label>
          </div>
        );

      case 'drag':
        return (
          <div className="step-editor-params">
            <label>
              De X:
              <input
                type="number"
                value={(action.params as any).fromX || 0}
                onChange={(e) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, fromX: parseInt(e.target.value) || 0 } },
                  })
                }
              />
            </label>
            <label>
              De Y:
              <input
                type="number"
                value={(action.params as any).fromY || 0}
                onChange={(e) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, fromY: parseInt(e.target.value) || 0 } },
                  })
                }
              />
            </label>
            <label>
              Para X:
              <input
                type="number"
                value={(action.params as any).toX || 0}
                onChange={(e) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, toX: parseInt(e.target.value) || 0 } },
                  })
                }
              />
            </label>
            <label>
              Para Y:
              <input
                type="number"
                value={(action.params as any).toY || 0}
                onChange={(e) =>
                  onUpdate({
                    action: { ...action, params: { ...action.params, toY: parseInt(e.target.value) || 0 } },
                  })
                }
              />
            </label>
          </div>
        );

      default:
        return <div className="step-editor-params">Parâmetros não configuráveis para este tipo de ação</div>;
    }
  };

  return (
    <div className="step-editor">
      <div className="step-editor-header">
        <h4>Editar Ação: {action.type}</h4>
        <button className="btn btn-xs" onClick={onClose}>
          ✕
        </button>
      </div>
      {renderActionParams()}
    </div>
  );
}

