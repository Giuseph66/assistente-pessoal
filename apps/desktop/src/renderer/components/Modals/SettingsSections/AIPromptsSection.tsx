import React, { useState, useEffect } from 'react';
import './AIPromptsSection.css';

interface PromptTemplate {
    id: number;
    name: string;
    promptText: string;
    category?: string;
    createdAt: number;
    updatedAt: number;
}

interface TemplatePreset {
    name: string;
    promptText: string;
    icon: React.ReactNode;
    description: string;
    tags: string[];
}

const ProfessionalIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
);

const EducationalIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
);

const CreativeIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r=".5" />
        <circle cx="17.5" cy="10.5" r=".5" />
        <circle cx="8.5" cy="7.5" r=".5" />
        <circle cx="6.5" cy="12.5" r=".5" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.707-.484 2.15-1.208.402-.666 1.162-1.077 1.942-1.077.727 0 1.547.247 2.348.673A2 2 0 0 0 21.036 18c.632-1.748.964-3.62.964-5.542 0-5.808-4.432-10.458-10-10.458z" />
    </svg>
);

const TechnicalIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
);

const CoachIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
);

interface AIPromptsSectionProps {
    showToast?: (message: string) => void;
}

const TEMPLATE_PRESETS: TemplatePreset[] = [
    {
        name: 'Assistente Profissional',
        description: 'Para ajuda com tarefas profissionais e corporativas',
        icon: <ProfessionalIcon />,
        tags: ['trabalho', 'formal'],
        promptText: `Você é um assistente profissional experiente. Suas características:

- Comunicação formal e objetiva
- Foco em produtividade e eficiência
- Sugestões baseadas em melhores práticas corporativas
- Respostas estruturadas e organizadas
- Linguagem técnica quando apropriado

Sempre priorize clareza, profissionalismo e resultados práticos.`
    },
    {
        name: 'Tutor Educacional',
        description: 'Para ensino e aprendizado de novos conceitos',
        icon: <EducationalIcon />,
        tags: ['educação', 'ensino'],
        promptText: `Você é um tutor paciente e didático. Suas características:

- Explica conceitos de forma clara e progressiva
- Usa analogias e exemplos práticos
- Adapta o nível de complexidade ao contexto
- Estimula o pensamento crítico com perguntas
- Oferece exercícios e desafios quando relevante

Sempre busque facilitar o aprendizado de forma engajadora e acessível.`
    },
    {
        name: 'Assistente Criativo',
        description: 'Para brainstorms, ideias e projetos criativos',
        icon: <CreativeIcon />,
        tags: ['criatividade', 'ideias'],
        promptText: `Você é um assistente criativo e inovador. Suas características:

- Pensa fora da caixa e sugere ideias originais
- Combina conceitos de formas inesperadas
- Usa linguagem inspiradora e energética
- Explora múltiplas perspectivas
- Incentiva a experimentação

Sempre busque inspirar e expandir as possibilidades criativas.`
    },
    {
        name: 'Consultor Técnico',
        description: 'Para programação, tecnologia e troubleshooting',
        icon: <TechnicalIcon />,
        tags: ['programação', 'técnico'],
        promptText: `Você é um consultor técnico especializado. Suas características:

- Domínio de programação e arquitetura de software
- Explicações técnicas precisas e code examples
- Foco em boas práticas e padrões de design
- Troubleshooting metódico e eficiente
- Atualizado com tecnologias modernas

Sempre forneça soluções robustas e bem fundamentadas tecnicamente.`
    },
    {
        name: 'Coach Pessoal',
        description: 'Para desenvolvimento pessoal e metas',
        icon: <CoachIcon />,
        tags: ['desenvolvimento', 'pessoal'],
        promptText: `Você é um coach motivacional e empático. Suas características:

- Linguagem encorajadora e positiva
- Foco em metas e ações práticas
- Ajuda a identificar obstáculos e soluções
- Estimula autorreflexão e crescimento
- Celebra progresso e conquistas

Sempre busque empoderar e motivar rumo aos objetivos pessoais.`
    }
];

const SparklesIcon = ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z" />
        <path d="M5 3v4" />
        <path d="M19 17v4" />
        <path d="M3 5h4" />
        <path d="M17 19h4" />
    </svg>
);

export const AIPromptsSection: React.FC<AIPromptsSectionProps> = ({ showToast }) => {
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ name: '', promptText: '', tags: '' });
    const [activePromptId, setActivePromptId] = useState<number | null>(null);

    useEffect(() => {
        loadPrompts();
        loadActivePersonality();
    }, []);

    const loadActivePersonality = async () => {
        try {
            const result = await (globalThis as any).window.ai.getActivePersonality();
            if (result?.promptId) {
                setActivePromptId(result.promptId);
            }
        } catch (error) {
            console.error('Failed to load active personality:', error);
        }
    };

    const loadPrompts = async (skipDefaultCreation = false) => {
        try {
            const templates = await (globalThis as any).window.ai.getPromptTemplates('personality');
            setPrompts(templates);

            // Apenas criar personalidade base se não houver NENHUMA personalidade
            // e se não foi solicitado para pular a criação (após deletar/editar)
            if (!skipDefaultCreation && templates.length === 0) {
                await createDefaultPersonality();
            }
        } catch (error) {
            console.error('Failed to load prompts:', error);
        }
    };

    const createDefaultPersonality = async () => {
        try {
            // Verificar novamente antes de criar para evitar race conditions
            const existing = await (globalThis as any).window.ai.getPromptTemplates('personality');

            // Se já existir alguma personalidade, não criar
            if (existing.length > 0) {
                setPrompts(existing);
                return;
            }

            const defaultPrompt = {
                name: 'Assistente Base',
                promptText: `Você é um assistente pessoal inteligente e prestativo. Suas características principais são:

- Comunicativo e claro: Você se expressa de forma direta e fácil de entender
- Proativo: Você oferece sugestões úteis e antecipa necessidades
- Empático: Você demonstra compreensão e consideração pelas situações do usuário
- Organizado: Você ajuda a estruturar informações e tarefas de forma lógica
- Respeitoso: Você mantém um tom profissional mas amigável

Sempre busque ser útil, preciso e respeitoso em todas as interações.`,
                category: 'personality',
            };

            await (globalThis as any).window.ai.savePromptTemplate(defaultPrompt);
            // Recarregar após criar
            const templates = await (globalThis as any).window.ai.getPromptTemplates('personality');
            setPrompts(templates);
        } catch (error) {
            console.error('Failed to create default personality:', error);
        }
    };

    const handleSave = async () => {
        try {
            if (!formData.name.trim() || !formData.promptText.trim()) {
                if (showToast) showToast('⚠️ Por favor, preencha todos os campos.');
                return;
            }

            if (editingId !== null) {
                // For editing, we need to delete and recreate (if no update API exists)
                await (globalThis as any).window.ai.deletePromptTemplate(editingId);
            }

            await (globalThis as any).window.ai.savePromptTemplate({
                name: formData.name,
                promptText: formData.promptText,
                category: 'personality',
            });

            setFormData({ name: '', promptText: '', tags: '' });
            setIsCreating(false);
            setShowTemplates(false);
            setEditingId(null);
            // Pular criação automática após salvar/editar
            loadPrompts(true);
            if (showToast) showToast(editingId !== null ? '✓ Personalidade atualizada!' : '✓ Personalidade criada com sucesso!');
        } catch (error) {
            console.error('Failed to save prompt:', error);
            if (showToast) showToast('✗ Erro ao salvar personalidade.');
        }
    };

    const handleEdit = (prompt: PromptTemplate) => {
        setFormData({ name: prompt.name, promptText: prompt.promptText, tags: '' });
        setEditingId(prompt.id);
        setIsCreating(true);
        setShowTemplates(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir esta personalidade?')) return;

        try {
            await (globalThis as any).window.ai.deletePromptTemplate(id);
            // Pular criação automática após deletar - só cria se ficar sem nenhuma
            loadPrompts(true);
            if (showToast) showToast('✓ Personalidade excluída.');
        } catch (error) {
            console.error('Failed to delete prompt:', error);
            if (showToast) showToast('✗ Erro ao excluir personalidade.');
        }
    };

    const handleCancel = () => {
        setFormData({ name: '', promptText: '', tags: '' });
        setIsCreating(false);
        setShowTemplates(false);
        setEditingId(null);
    };

    const handleSelectTemplate = (template: TemplatePreset) => {
        setFormData({
            name: template.name,
            promptText: template.promptText,
            tags: template.tags.join(', ')
        });
        setShowTemplates(false);
        setIsCreating(true);
    };

    return (
        <div className="ai-prompts-container">
            <div className="prompts-header">
                <div>
                    <h2>Personalidades da IA</h2>
                    <p className="subtitle">Customize como a IA se comporta em diferentes contextos</p>
                </div>
                <div className="header-actions">
                    {!isCreating && !showTemplates && (
                        <>
                            <button className="btn-templates" onClick={() => setShowTemplates(true)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="7" height="7" />
                                    <rect x="14" y="3" width="7" height="7" />
                                    <rect x="14" y="14" width="7" height="7" />
                                    <rect x="3" y="14" width="7" height="7" />
                                </svg>
                                Templates
                            </button>
                            <button className="btn-create-prompt" onClick={() => setIsCreating(true)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Criar do Zero
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Template Gallery */}
            {showTemplates && (
                <div className="template-gallery">
                    <div className="gallery-header">
                        <h3>Escolha um Template</h3>
                        <button className="btn-close-gallery" onClick={() => setShowTemplates(false)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                    <div className="templates-grid">
                        {TEMPLATE_PRESETS.map((template, idx) => (
                            <div key={idx} className="template-card" onClick={() => handleSelectTemplate(template)}>
                                <div className="template-icon">{template.icon}</div>
                                <h4>{template.name}</h4>
                                <p>{template.description}</p>
                                <div className="template-tags">
                                    {template.tags.map((tag, i) => (
                                        <span key={i} className="tag">{tag}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isCreating && (
                <div className="prompt-form-card">
                    <h3>{editingId !== null ? 'Editar Personalidade' : 'Nova Personalidade'}</h3>
                    <div className="form-group">
                        <label>Nome</label>
                        <input
                            type="text"
                            placeholder="Ex: Assistente Profissional, Tutor Paciente, etc."
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label>Prompt / Instruções</label>
                        <textarea
                            placeholder="Descreva como a IA deve se comportar com esta personalidade..."
                            value={formData.promptText}
                            onChange={(e) => setFormData({ ...formData, promptText: e.target.value })}
                            rows={8}
                        />
                    </div>
                    <div className="form-actions">
                        <button className="btn-cancel" onClick={handleCancel}>Cancelar</button>
                        <button className="btn-save" onClick={handleSave}>
                            {editingId !== null ? 'Atualizar' : 'Salvar'}
                        </button>
                    </div>
                </div>
            )}

            <div className="prompts-grid">
                {prompts.length === 0 && !isCreating && (
                    <div className="empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                        <p>Nenhuma personalidade criada</p>
                        <span>Clique em "Nova Personalidade" para começar</span>
                    </div>
                )}

                {prompts.map((prompt) => (
                    <div key={prompt.id} className={`prompt-card ${activePromptId === prompt.id ? 'active' : ''}`}>
                        <div className="prompt-card-header">
                            <div className="title-with-icon">
                                <SparklesIcon size={16} />
                                <h3>{prompt.name}</h3>
                            </div>
                            {activePromptId === prompt.id && (
                                <span className="active-badge">Ativa</span>
                            )}
                        </div>
                        <p className="prompt-preview">{prompt.promptText.slice(0, 120)}...</p>
                        <div className="prompt-card-actions">
                            <button
                                className="btn-activate"
                                onClick={async () => {
                                    setActivePromptId(prompt.id);
                                    try {
                                        await (globalThis as any).window.ai.setActivePersonality(prompt.id);
                                        if (showToast) showToast('✓ Personalidade ativada!');
                                    } catch (error) {
                                        console.error('Failed to set active personality:', error);
                                        if (showToast) showToast('✗ Erro ao ativar personalidade.');
                                    }
                                }}
                                disabled={activePromptId === prompt.id}
                            >
                                {activePromptId === prompt.id ? 'Em Uso' : 'Usar'}
                            </button>
                            <button className="btn-icon" onClick={() => handleEdit(prompt)} title="Editar">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                            </button>
                            <button className="btn-icon btn-delete" onClick={() => handleDelete(prompt.id)} title="Excluir">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
