import React, { useState, useEffect } from 'react';
import { FlowNode, FlowNodeType, MappingPoint, ImageTemplate } from '@ricky/shared';
import { CustomSelect } from '../Modals/SettingsSections/CustomSelect';

// --- Node Palette ---

const PALETTE_ITEMS: { type: FlowNodeType; label: string; icon: string; category: string }[] = [
    { type: 'start', label: 'Início', icon: '▶', category: 'Controle' },
    { type: 'end', label: 'Fim', icon: '■', category: 'Controle' },
    { type: 'action.clickMappedPoint', label: 'Clique Mapeado', icon: '🖱️', category: 'Ações' },
    { type: 'action.clickCoordinates', label: 'Clique Coord.', icon: '📍', category: 'Ações' },
    { type: 'action.clickFoundImage', label: 'Clicar Imagem Encontrada', icon: '🎯', category: 'Ações' },
    { type: 'action.typeText', label: 'Digitar Texto', icon: '⌨️', category: 'Ações' },
    { type: 'action.pressKey', label: 'Pressionar Tecla', icon: '🎹', category: 'Ações' },
    { type: 'action.wait', label: 'Aguardar', icon: '⏳', category: 'Ações' },
    { type: 'condition.findImage', label: 'Buscar Imagem', icon: '🔍', category: 'Condições' },
    { type: 'logic.loop', label: 'Loop', icon: '🔁', category: 'Lógica' },
];

export function NodePalette() {
    const onDragStart = (event: React.DragEvent, nodeType: FlowNodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    const categories = Array.from(new Set(PALETTE_ITEMS.map((item) => item.category)));

    return (
        <div className="workflow-panel workflow-palette">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--workflow-text-secondary)' }}>Blocos Disponíveis</h3>
            {categories.map((category) => (
                <div key={category} className="palette-category">
                    <div className="palette-category-title">{category}</div>
                    {PALETTE_ITEMS.filter((item) => item.category === category).map((item) => (
                        <div
                            key={item.type}
                            className="palette-item"
                            draggable
                            onDragStart={(e) => onDragStart(e, item.type)}
                        >
                            <div className="palette-item-icon">{item.icon}</div>
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>{item.label}</span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

// --- Properties Panel ---

interface NodePropertiesPanelProps {
    node: FlowNode | null;
    onChange: (nodeId: string, updates: any) => void;
    onTestLog?: (level: 'info' | 'success' | 'error' | 'warning', message: string) => void;
}

export function NodePropertiesPanel({ node, onChange, onTestLog }: NodePropertiesPanelProps) {
    const [mappings, setMappings] = useState<{ points: MappingPoint[]; templates: ImageTemplate[] }>({
        points: [],
        templates: [],
    });
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        const loadMappings = async () => {
            try {
                if (window.automation && window.automation.listMappings) {
                    const result = await window.automation.listMappings();
                    setMappings(result);
                }
            } catch (e) {
                console.error("Failed to load mappings", e);
            }
        };
        loadMappings();
    }, []);

    if (!node) {
        return (
            <div className="workflow-panel workflow-properties">
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '200px',
                    color: 'var(--workflow-text-secondary)',
                    textAlign: 'center',
                    gap: '12px'
                }}>
                    <div style={{ fontSize: '24px', opacity: 0.5 }}>👆</div>
                    <p style={{ fontSize: '13px', margin: 0 }}>Selecione um bloco para<br />editar suas propriedades.</p>
                </div>
            </div>
        );
    }

    const updateData = (field: string, value: any) => {
        onChange(node.id, {
            ...node.data,
            data: {
                ...node.data.data,
                [field]: value,
            },
        });
    };

    const labelStyle = {
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--workflow-text-secondary)',
        display: 'block',
        marginTop: '16px',
        marginBottom: '4px'
    };

    const logMessage = (level: 'info' | 'success' | 'error' | 'warning', message: string) => {
        if (onTestLog) {
            onTestLog(level, message);
        } else {
            const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const colors = {
                info: '#94a3b8',
                success: '#10b981',
                error: '#ef4444',
                warning: '#f59e0b'
            };
            console.log(`%c[${timestamp}] ${message}`, `color: ${colors[level]}`);
        }
    };

    const testFindImage = async (templateName: string, threshold?: number, timeoutMs?: number) => {
        if (!templateName) {
            logMessage('error', 'Por favor, selecione um template de imagem primeiro.');
            return;
        }

        setTesting(true);
        logMessage('info', `Testando busca da imagem "${templateName}"...`);

        try {
            const found = await window.automation.findTemplateOnScreen(
                templateName,
                threshold,
                timeoutMs
            );

            if (found) {
                logMessage('success', `Imagem "${templateName}" encontrada em (${found.x}, ${found.y}) - ${found.width}x${found.height}px`);
            } else {
                logMessage('warning', `Imagem "${templateName}" não encontrada na tela.`);
            }
        } catch (error: any) {
            logMessage('error', `Erro ao testar busca: ${error?.message || 'Erro desconhecido'}`);
        } finally {
            setTesting(false);
            // Finalizar status de teste após um pequeno delay
            if (onTestLog) {
                setTimeout(() => {
                    onTestLog('info', 'Teste finalizado.');
                }, 100);
            }
        }
    };

    const testClickFoundImage = async (
        templateName: string | undefined,
        clickPosition: string,
        button: string,
        clickCount: number,
        offsetX: number,
        offsetY: number,
        threshold?: number,
        timeoutMs?: number
    ) => {
        setTesting(true);
        logMessage('info', templateName ? `Testando clique na imagem "${templateName}"...` : 'Testando clique na última imagem encontrada...');

        try {
            // Se templateName não foi especificado, não podemos testar (precisa ter sido encontrado antes)
            if (!templateName) {
                logMessage('warning', 'Nenhum template especificado. Este nó usa a última imagem encontrada, que só estará disponível durante a execução do workflow.');
                setTesting(false);
                return;
            }

            const found = await window.automation.findTemplateOnScreen(
                templateName,
                threshold,
                timeoutMs
            );

            if (!found) {
                logMessage('error', `Imagem "${templateName}" não encontrada na tela. Não é possível executar o clique.`);
                setTesting(false);
                return;
            }

            logMessage('success', `Imagem "${templateName}" encontrada em (${found.x}, ${found.y}) - ${found.width}x${found.height}px`);

            // Calcular posição do clique baseado em clickPosition
            let clickX = found.x;
            let clickY = found.y;

            switch (clickPosition || 'center') {
                case 'center':
                    clickX = found.x + Math.floor(found.width / 2);
                    clickY = found.y + Math.floor(found.height / 2);
                    break;
                case 'top-left':
                    clickX = found.x;
                    clickY = found.y;
                    break;
                case 'top-right':
                    clickX = found.x + found.width;
                    clickY = found.y;
                    break;
                case 'bottom-left':
                    clickX = found.x;
                    clickY = found.y + found.height;
                    break;
                case 'bottom-right':
                    clickX = found.x + found.width;
                    clickY = found.y + found.height;
                    break;
            }

            // Aplicar offsets
            const parsedOffsetX = Number(offsetX);
            const parsedOffsetY = Number(offsetY);
            const finalOffsetX = Number.isFinite(parsedOffsetX) ? parsedOffsetX : 0;
            const finalOffsetY = Number.isFinite(parsedOffsetY) ? parsedOffsetY : 0;

            clickX += finalOffsetX;
            clickY += finalOffsetY;

            logMessage('info', `Executando ${clickCount} clique(s) em (${clickX}, ${clickY}) com botão ${button}...`);

            // Executar os cliques
            for (let i = 0; i < clickCount; i++) {
                const result = await window.automation.testAction({
                    type: 'clickAt',
                    params: {
                        x: clickX,
                        y: clickY,
                        button: button as any
                    }
                } as any);

                if (!result.success) {
                    logMessage('error', `Erro ao executar clique ${i + 1}/${clickCount}: ${result.error || 'Erro desconhecido'}`);
                    setTesting(false);
                    return;
                }

                if (i < clickCount - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100)); // Pequeno delay entre cliques
                }
            }

            logMessage('success', `Clique(s) executado(s) com sucesso em (${clickX}, ${clickY})`);
        } catch (error: any) {
            logMessage('error', `Erro ao testar clique: ${error?.message || 'Erro desconhecido'}`);
        } finally {
            setTesting(false);
            // Finalizar status de teste após um pequeno delay
            if (onTestLog) {
                setTimeout(() => {
                    onTestLog('info', 'Teste finalizado.');
                }, 100);
            }
        }
    };

    // Componente para configurar tecla principal com captura
    const PressKeyConfig = ({ data, updateData, onTestLog, testing, setTesting }: any) => {
        const keyCombo = data.keyCombo || 'Enter';
        const keyArray = Array.isArray(keyCombo) ? keyCombo : [keyCombo];
        const mainKey = keyArray[keyArray.length - 1] || 'Enter';
        const modifiers = keyArray.slice(0, -1);
        
        const [listeningKey, setListeningKey] = useState(false);
        const [keyValidation, setKeyValidation] = useState<{ isValid: boolean; message?: string } | null>(null);

        // Mapear códigos de tecla do navegador para nomes do sistema
        const mapBrowserKeyToSystemKey = (event: KeyboardEvent): string => {
            // Ignorar modificadores quando estão sendo pressionados sozinhos
            if (event.key === 'Control' || event.key === 'Alt' || event.key === 'Shift' || event.key === 'Meta') {
                return '';
            }

            // Mapear teclas especiais
            const specialKeys: Record<string, string> = {
                'Enter': 'Enter',
                'Escape': 'Escape',
                'Tab': 'Tab',
                ' ': 'Space',
                'Backspace': 'Backspace',
                'Delete': 'Delete',
                'ArrowUp': 'ArrowUp',
                'ArrowDown': 'ArrowDown',
                'ArrowLeft': 'ArrowLeft',
                'ArrowRight': 'ArrowRight',
                'Home': 'Home',
                'End': 'End',
                'PageUp': 'PageUp',
                'PageDown': 'PageDown',
                'F1': 'F1',
                'F2': 'F2',
                'F3': 'F3',
                'F4': 'F4',
                'F5': 'F5',
                'F6': 'F6',
                'F7': 'F7',
                'F8': 'F8',
                'F9': 'F9',
                'F10': 'F10',
                'F11': 'F11',
                'F12': 'F12',
            };

            if (specialKeys[event.key]) {
                return specialKeys[event.key];
            }

            // Para caracteres normais, retornar em minúsculas
            if (event.key.length === 1) {
                return event.key.toLowerCase();
            }

            return event.key;
        };

        // Verificar se a tecla é suportada pelo sistema
        const isKeySupported = (key: string): boolean => {
            const supportedKeys = [
                'Enter', 'Escape', 'Tab', 'Space', 'Backspace', 'Delete',
                'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                'Home', 'End', 'PageUp', 'PageDown',
                'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
                'Control', 'Alt', 'Shift', 'Meta'
            ];

            // Se está na lista de suportadas
            if (supportedKeys.includes(key)) {
                return true;
            }

            // Se é um caractere único (letra, número, símbolo)
            if (key.length === 1) {
                return true;
            }

            return false;
        };

        const updateMainKey = (key: string) => {
            const newKeyCombo = modifiers.length > 0 ? [...modifiers, key] : key;
            updateData('keyCombo', newKeyCombo);
        };

        // Capturar tecla do teclado
        useEffect(() => {
            if (!listeningKey) return;

            const handleKeyDown = (event: KeyboardEvent) => {
                event.preventDefault();
                event.stopPropagation();

                const capturedKey = mapBrowserKeyToSystemKey(event);
                
                if (!capturedKey) {
                    return; // Ignorar se for apenas modificador
                }

                const isValid = isKeySupported(capturedKey);
                
                if (isValid) {
                    setKeyValidation({ isValid: true });
                    updateMainKey(capturedKey);
                    setTimeout(() => {
                        setKeyValidation(null);
                    }, 2000);
                } else {
                    setKeyValidation({ 
                        isValid: false, 
                        message: `Tecla "${capturedKey}" não está cadastrada no sistema` 
                    });
                }

                setListeningKey(false);
            };

            window.addEventListener('keydown', handleKeyDown);
            return () => {
                window.removeEventListener('keydown', handleKeyDown);
            };
        }, [listeningKey, modifiers, updateData]);

        const toggleModifier = (mod: string) => {
            const newModifiers = modifiers.includes(mod)
                ? modifiers.filter((m: string) => m !== mod)
                : [...modifiers, mod];
            const newKeyCombo = newModifiers.length > 0 ? [...newModifiers, mainKey] : mainKey;
            updateData('keyCombo', newKeyCombo);
        };

        const logMessage = (level: 'info' | 'success' | 'error' | 'warning', message: string) => {
            if (onTestLog) {
                onTestLog(level, message);
            } else {
                const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const colors = {
                    info: '#94a3b8',
                    success: '#10b981',
                    error: '#ef4444',
                    warning: '#f59e0b'
                };
                console.log(`%c[${timestamp}] ${message}`, `color: ${colors[level]}`);
            }
        };

        const testPressKey = async () => {
            setTesting(true);
            const combo = Array.isArray(keyCombo) ? keyCombo : [keyCombo];
            const main = combo[combo.length - 1] || 'Enter';
            const mods = combo.slice(0, -1);
            
            logMessage('info', `Testando pressionar tecla: ${mods.length > 0 ? mods.join(' + ') + ' + ' : ''}${main}`);

            try {
                const result = await window.automation.testAction({
                    type: 'pressKey',
                    params: {
                        key: main,
                        modifiers: mods
                    }
                } as any);

                if (result.success) {
                    logMessage('success', `Tecla pressionada com sucesso: ${mods.length > 0 ? mods.join(' + ') + ' + ' : ''}${main}`);
                } else {
                    logMessage('error', `Erro ao pressionar tecla: ${result.error || 'Erro desconhecido'}`);
                }
            } catch (error: any) {
                logMessage('error', `Erro ao testar tecla: ${error?.message || 'Erro desconhecido'}`);
            } finally {
                setTesting(false);
                if (onTestLog) {
                    setTimeout(() => {
                        onTestLog('info', 'Teste finalizado.');
                    }, 100);
                }
            }
        };

        const labelStyle = {
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--workflow-text-secondary)',
            display: 'block',
            marginTop: '16px',
            marginBottom: '4px'
        };

        return (
            <>
                <div>
                    <label style={labelStyle}>Tecla Principal</label>
                    <div style={{ position: 'relative' }}>
                        <button
                            type="button"
                            onClick={() => setListeningKey(true)}
                            disabled={listeningKey || testing}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                background: listeningKey 
                                    ? 'rgba(99, 102, 241, 0.2)' 
                                    : keyValidation?.isValid === true
                                        ? 'rgba(16, 185, 129, 0.2)'
                                        : keyValidation?.isValid === false
                                            ? 'rgba(239, 68, 68, 0.2)'
                                            : 'rgba(255, 255, 255, 0.05)',
                                border: `2px solid ${
                                    listeningKey 
                                        ? '#6366f1' 
                                        : keyValidation?.isValid === true
                                            ? '#10b981'
                                            : keyValidation?.isValid === false
                                                ? '#ef4444'
                                                : 'rgba(255, 255, 255, 0.1)'
                                }`,
                                borderRadius: '6px',
                                color: listeningKey 
                                    ? '#6366f1' 
                                    : keyValidation?.isValid === true
                                        ? '#10b981'
                                        : keyValidation?.isValid === false
                                            ? '#ef4444'
                                            : 'var(--workflow-text)',
                                fontSize: '13px',
                                fontWeight: 500,
                                cursor: listeningKey || testing ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                        >
                            <span>
                                {listeningKey 
                                    ? '⏳ Pressione uma tecla...' 
                                    : mainKey || 'Clique para capturar tecla'}
                            </span>
                            {keyValidation?.isValid === true && <span style={{ fontSize: '16px' }}>✓</span>}
                            {keyValidation?.isValid === false && <span style={{ fontSize: '16px' }}>✗</span>}
                        </button>
                        {keyValidation && (
                            <div style={{
                                marginTop: '6px',
                                padding: '8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                background: keyValidation.isValid 
                                    ? 'rgba(16, 185, 129, 0.1)' 
                                    : 'rgba(239, 68, 68, 0.1)',
                                color: keyValidation.isValid ? '#10b981' : '#ef4444',
                                border: `1px solid ${keyValidation.isValid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                            }}>
                                {keyValidation.isValid 
                                    ? `✓ Tecla "${mainKey}" cadastrada e suportada` 
                                    : keyValidation.message || `✗ Tecla não suportada`}
                            </div>
                        )}
                    </div>
                </div>
                <div>
                    <label style={labelStyle}>Modificadores</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        {['Control', 'Alt', 'Shift', 'Meta'].map((mod) => (
                            <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                <input
                                    type="checkbox"
                                    checked={modifiers.includes(mod)}
                                    onChange={() => toggleModifier(mod)}
                                    style={{ cursor: 'pointer' }}
                                />
                                <span>{mod === 'Control' ? 'Ctrl' : mod === 'Meta' ? 'Cmd/Win' : mod}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div style={{
                    padding: '10px',
                    background: 'rgba(99, 102, 241, 0.1)',
                    borderRadius: '6px',
                    marginTop: '12px',
                    fontSize: '12px',
                    color: 'var(--workflow-text-secondary)',
                    border: '1px solid rgba(99, 102, 241, 0.2)'
                }}>
                    <strong>Combinação:</strong> {modifiers.length > 0 ? modifiers.map((m: string) => m === 'Control' ? 'Ctrl' : m === 'Meta' ? 'Cmd/Win' : m).join(' + ') + ' + ' : ''}{mainKey}
                </div>
                <div style={{ marginTop: '16px' }}>
                    <button
                        className="btn-workflow"
                        onClick={testPressKey}
                        disabled={testing}
                        style={{
                            width: '100%',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        {testing ? '⏳ Testando...' : '🧪 Testar Tecla'}
                    </button>
                    <div style={{ fontSize: '11px', color: 'var(--workflow-text-secondary)', marginTop: '4px', textAlign: 'center' }}>
                        Verifique o console para ver os resultados
                    </div>
                </div>
            </>
        );
    };

    const renderFields = () => {
        const { nodeType, data } = node.data;

        switch (nodeType) {
            case 'action.clickMappedPoint':
                return (
                    <>
                        <div>
                            <label style={labelStyle}>Ponto Mapeado</label>
                            <CustomSelect
                                value={data.mappingName || ''}
                                onChange={(val) => updateData('mappingName', val)}
                                options={[
                                    { label: 'Selecione...', value: '' },
                                    ...mappings.points.map((p) => ({ label: p.name, value: p.name }))
                                ]}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Botão do Mouse</label>
                            <CustomSelect
                                value={data.button || 'left'}
                                onChange={(val) => updateData('button', val)}
                                options={[
                                    { label: 'Esquerdo', value: 'left' },
                                    { label: 'Direito', value: 'right' },
                                    { label: 'Meio', value: 'middle' }
                                ]}
                            />
                        </div>
                    </>
                );

            case 'action.clickFoundImage':
                return (
                    <>
                        <div style={{
                            padding: '12px',
                            background: 'rgba(99, 102, 241, 0.1)',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            fontSize: '12px',
                            color: 'var(--workflow-text-secondary)',
                            border: '1px solid rgba(99, 102, 241, 0.2)'
                        }}>
                            💡 Este bloco clica na última imagem encontrada por um bloco "Buscar Imagem" anterior.
                        </div>
                        <div>
                            <label style={labelStyle}>Template (Opcional)</label>
                            <CustomSelect
                                value={data.templateName || ''}
                                onChange={(val) => updateData('templateName', val || undefined)}
                                options={[
                                    { label: 'Usar última imagem encontrada', value: '' },
                                    ...mappings.templates.map((t) => ({ label: t.name, value: t.name }))
                                ]}
                            />
                            <div style={{ fontSize: '11px', color: 'var(--workflow-text-secondary)', marginTop: '4px' }}>
                                Se deixar vazio, usa a última imagem encontrada. Se especificar, usa as coordenadas daquele template específico.
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Posição do Clique</label>
                            <CustomSelect
                                value={data.clickPosition || 'center'}
                                onChange={(val) => updateData('clickPosition', val)}
                                options={[
                                    { label: 'Centro', value: 'center' },
                                    { label: 'Canto Superior Esquerdo', value: 'top-left' },
                                    { label: 'Canto Superior Direito', value: 'top-right' },
                                    { label: 'Canto Inferior Esquerdo', value: 'bottom-left' },
                                    { label: 'Canto Inferior Direito', value: 'bottom-right' }
                                ]}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Botão do Mouse</label>
                            <CustomSelect
                                value={data.button || 'left'}
                                onChange={(val) => updateData('button', val)}
                                options={[
                                    { label: 'Esquerdo', value: 'left' },
                                    { label: 'Direito', value: 'right' },
                                    { label: 'Meio', value: 'middle' }
                                ]}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Número de Cliques</label>
                            <input
                                type="number"
                                className="workflow-input"
                                value={data.clickCount || 1}
                                onChange={(e) => updateData('clickCount', parseInt(e.target.value) || 1)}
                                min="1"
                                max="10"
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Deslocamento X (px)</label>
                            <input
                                type="number"
                                className="workflow-input"
                                value={(data as any).offsetX || 0}
                                onChange={(e) => updateData('offsetX', parseInt(e.target.value) || 0)}
                            />
                            <div style={{ fontSize: '11px', color: 'var(--workflow-text-secondary)', marginTop: '4px' }}>
                                Valores negativos movem para a esquerda.
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Deslocamento Y (px)</label>
                            <input
                                type="number"
                                className="workflow-input"
                                value={(data as any).offsetY || 0}
                                onChange={(e) => updateData('offsetY', parseInt(e.target.value) || 0)}
                            />
                            <div style={{ fontSize: '11px', color: 'var(--workflow-text-secondary)', marginTop: '4px' }}>
                                Valores negativos movem para cima.
                            </div>
                        </div>
                        {data.templateName && (
                            <div style={{ marginTop: '16px' }}>
                                <button
                                    className="btn-workflow"
                                    onClick={() => testClickFoundImage(
                                        data.templateName,
                                        data.clickPosition || 'center',
                                        data.button || 'left',
                                        data.clickCount || 1,
                                        (data as any).offsetX || 0,
                                        (data as any).offsetY || 0,
                                        undefined, // threshold - usar padrão
                                        undefined  // timeoutMs - usar padrão
                                    )}
                                    disabled={testing}
                                    style={{
                                        width: '100%',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {testing ? '⏳ Testando...' : '🧪 Testar e Clicar'}
                                </button>
                                <div style={{ fontSize: '11px', color: 'var(--workflow-text-secondary)', marginTop: '4px', textAlign: 'center' }}>
                                    Verifique o console para ver os resultados
                                </div>
                            </div>
                        )}
                    </>
                );

            case 'action.typeText':
                return (
                    <div>
                        <label style={labelStyle}>Texto para Digitar</label>
                        <textarea
                            className="workflow-input" style={{ minHeight: '80px', resize: 'vertical' }}
                            value={data.text || ''}
                            onChange={(e) => updateData('text', e.target.value)}
                            placeholder="Digite o texto aqui..."
                        />
                    </div>
                );

            case 'action.pressKey':
                return (
                    <PressKeyConfig 
                        data={data} 
                        updateData={updateData} 
                        onTestLog={onTestLog}
                        testing={testing}
                        setTesting={setTesting}
                    />
                );

            case 'action.wait':
                return (
                    <div>
                        <label style={labelStyle}>Tempo de Espera (ms)</label>
                        <input
                            type="number"
                            className="workflow-input"
                            value={data.ms || 1000}
                            onChange={(e) => updateData('ms', parseInt(e.target.value) || 0)}
                        />
                        <div style={{ fontSize: '11px', color: 'var(--workflow-text-secondary)', marginTop: '4px' }}>
                            1000ms = 1 segundo
                        </div>
                    </div>
                );

            case 'condition.findImage':
                return (
                    <>
                        <div>
                            <label style={labelStyle}>Template de Imagem</label>
                            <CustomSelect
                                value={data.templateName || ''}
                                onChange={(val) => updateData('templateName', val)}
                                options={[
                                    { label: 'Selecione...', value: '' },
                                    ...mappings.templates.map((t) => ({ label: t.name, value: t.name }))
                                ]}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Confiança Mínima ({((data.threshold || 0.8) * 100).toFixed(0)}%)</label>
                            <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.05"
                                style={{ width: '100%', marginTop: '8px' }}
                                value={data.threshold || 0.8}
                                onChange={(e) => updateData('threshold', parseFloat(e.target.value) || 0.8)}
                            />
                        </div>
                        {data.templateName && (
                            <div style={{ marginTop: '16px' }}>
                                <button
                                    className="btn-workflow"
                                    onClick={() => testFindImage(data.templateName, data.threshold, data.timeoutMs)}
                                    disabled={testing}
                                    style={{
                                        width: '100%',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {testing ? '⏳ Testando...' : '🧪 Testar Busca'}
                                </button>
                                <div style={{ fontSize: '11px', color: 'var(--workflow-text-secondary)', marginTop: '4px', textAlign: 'center' }}>
                                    Verifique o console para ver os resultados
                                </div>
                            </div>
                        )}
                    </>
                );

            case 'logic.loop':
                return (
                    <>
                        <div>
                            <label style={labelStyle}>Tipo de Loop</label>
                            <CustomSelect
                                value={data.mode || 'count'}
                                onChange={(val) => updateData('mode', val)}
                                options={[
                                    { label: 'Repetir N vezes', value: 'count' },
                                    { label: 'Repetir até encontrar imagem', value: 'until' }
                                ]}
                            />
                        </div>
                        {data.mode === 'count' ? (
                            <div>
                                <label style={labelStyle}>Número de Repetições</label>
                                <input
                                    type="number"
                                    className="workflow-input"
                                    value={data.count || 1}
                                    onChange={(e) => updateData('count', parseInt(e.target.value) || 1)}
                                />
                            </div>
                        ) : (
                            <div>
                                <label style={labelStyle}>Parar quando encontrar</label>
                                <CustomSelect
                                    value={data.untilTemplateName || ''}
                                    onChange={(val) => updateData('untilTemplateName', val)}
                                    options={[
                                        { label: 'Selecione...', value: '' },
                                        ...mappings.templates.map((t) => ({ label: t.name, value: t.name }))
                                    ]}
                                />
                            </div>
                        )}
                        <div>
                            <label style={labelStyle}>Limite de Segurança (Max Iterações)</label>
                            <input
                                type="number"
                                className="workflow-input"
                                value={data.maxIterations || 10}
                                onChange={(e) => updateData('maxIterations', parseInt(e.target.value) || 10)}
                            />
                        </div>
                    </>
                );

            default:
                return (
                    <div style={{
                        padding: '12px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px',
                        marginTop: '12px',
                        fontSize: '12px',
                        color: 'var(--workflow-text-secondary)'
                    }}>
                        Este bloco não possui configurações adicionais.
                    </div>
                );
        }
    };

    return (
        <div className="workflow-panel workflow-properties">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--workflow-text-secondary)' }}>Propriedades</h3>

            <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--workflow-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo do Bloco</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--workflow-text)', marginTop: '4px' }}>
                    {PALETTE_ITEMS.find(i => i.type === node.data.nodeType)?.label || node.type}
                </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--workflow-border)', margin: '0 0 8px 0' }} />

            {renderFields()}
        </div>
    );
}

// --- Floating Toolbar ---

interface FloatingToolbarProps {
    onBack: () => void;
    onToggleFullscreen: () => void;
    isFullscreen: boolean;
    onValidate: () => void;
    onSave: () => void;
    onRun: () => void;
    isSaving: boolean;
}

export function FloatingToolbar({
    onBack,
    onToggleFullscreen,
    isFullscreen,
    onValidate,
    onSave,
    onRun,
    isSaving
}: FloatingToolbarProps) {
    return (
        <div className="workflow-panel workflow-toolbar">
            <button className="btn-workflow" onClick={onBack} title="Voltar">
                <span style={{ fontSize: '16px' }}>←</span> Voltar
            </button>
            <div style={{ width: '1px', background: 'var(--workflow-border)', margin: '0 4px', height: '20px', alignSelf: 'center' }} />
           
            <button className="btn-workflow" onClick={onValidate} title="Verificar erros">
                <span style={{ fontSize: '16px' }}>✓</span> Validar
            </button>
            <button className="btn-workflow" onClick={onSave} disabled={isSaving} title="Salvar alterações">
                <span style={{ fontSize: '16px' }}>💾</span> {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
            <div style={{ width: '1px', background: 'var(--workflow-border)', margin: '0 4px', height: '20px', alignSelf: 'center' }} />
            <button className="btn-workflow btn-workflow-primary" onClick={onRun} title="Executar Workflow">
                <span style={{ fontSize: '16px' }}>▶</span> Executar
            </button>
        </div>
    );
}

// --- Execution Monitor ---

import { FlowExecutionStatus } from '@ricky/shared';

interface ExecutionMonitorProps {
    status: FlowExecutionStatus | null;
    onRun: () => void;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
    onClose: () => void;
}

export function ExecutionMonitor({
    status,
    onRun,
    onPause,
    onResume,
    onStop,
    onClose,
}: ExecutionMonitorProps) {
    if (!status || status.status === 'idle') {
        return null; // Don't show if idle, use toolbar button
    }

    const { status: state, logs, error } = status;
    const isTest = status.runId?.startsWith('test_') || false;

    return (
        <div className="workflow-panel execution-monitor">
            <div className="monitor-header">
                <div className="monitor-status">
                    <div className="monitor-status-dot" style={{
                        background: state === 'running' ? '#10b981' : state === 'error' ? '#ef4444' : '#f59e0b',
                        boxShadow: state === 'running' ? '0 0 8px #10b981' : 'none'
                    }} />
                    <span className="monitor-status-text">
                        {isTest && state === 'running' ? 'Testando...' :
                            isTest && state === 'completed' ? 'Teste Concluído' :
                            state === 'running' ? 'Executando...' :
                            state === 'paused' ? 'Pausado' :
                            state === 'completed' ? 'Concluído' :
                            state === 'error' ? 'Erro na Execução' : state}
                    </span>
                </div>

                <div className="monitor-controls">
                    {state === 'running' && (
                        <button className="btn-workflow" onClick={onPause}>⏸ Pausar</button>
                    )}
                    {state === 'paused' && (
                        <button className="btn-workflow" onClick={onResume}>▶ Retomar</button>
                    )}
                    {(state === 'running' || state === 'paused') && (
                        <button className="btn-workflow" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }} onClick={onStop}>⏹ Parar</button>
                    )}
                    {(state === 'completed' || state === 'error' || state === 'stopped') && (
                        <button className="btn-workflow" onClick={onClose}>✕ Fechar</button>
                    )}
                </div>
            </div>

            {error && (
                <div className="monitor-error">
                    <span>⚠️</span>
                    {error}
                </div>
            )}

            <div className="monitor-logs">
                {logs.map((log, i) => (
                    <div key={i} className="log-entry" style={{ color: log.level === 'error' ? '#ef4444' : log.level === 'success' ? '#10b981' : '#94a3b8' }}>
                        <span className="log-timestamp">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span>{log.message}</span>
                    </div>
                ))}
                {logs.length === 0 && <div style={{ textAlign: 'center', opacity: 0.3, padding: '20px' }}>Aguardando logs de execução...</div>}
            </div>
        </div>
    );
}
