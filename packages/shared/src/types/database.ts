export interface Note {
    id: number;
    content: string;
    created_at: number;
    updated_at: number;
    panel_type: 'notes' | 'transcription' | 'translation';
}

export interface TranscriptionSession {
    id: number;
    started_at: number;
    ended_at?: number;
    language: 'en' | 'pt';
    total_segments: number;
}

export interface TranscriptionSegment {
    id: number;
    session_id: number;
    text: string;
    translated_text?: string;
    confidence: number;
    timestamp: number;
}

export interface Screenshot {
    id: number;
    file_path: string;
    file_size: number;
    width: number;
    height: number;
    mode: 'fullscreen' | 'window' | 'area';
    source_app?: string;
    monitor_index?: number;
    created_at: number;
    optimized_path?: string;
    tags_json?: string;
}

export interface AIProvider {
    id: string;
    display_name: string;
    base_url?: string;
    created_at: number;
    updated_at: number;
}

export interface AIModel {
    id: number;
    provider_id: string;
    model_name: string;
    enabled: number;
    metadata_json?: string;
    created_at: number;
}

export interface AIApiKey {
    id: number;
    provider_id: string;
    alias: string;
    encrypted_key: string;
    last4: string;
    status: 'active' | 'cooldown' | 'disabled';
    cooldown_until?: number;
    success_count: number;
    failure_count: number;
    last_error_code?: string;
    last_used_at?: number;
    created_at: number;
    updated_at: number;
}

export interface AISession {
    id: number;
    screenshot_id: number | null;
    provider_id: string;
    model_name: string;
    created_at: number;
}

export interface AIMessage {
    id: number;
    session_id: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    recognized_text?: string;
    created_at: number;
}

export interface AIRun {
    id: number;
    session_id: number;
    provider_id: string;
    model_name: string;
    api_key_id?: number;
    status: 'success' | 'error';
    duration_ms?: number;
    error_code?: string;
    error_message_redacted?: string;
    created_at: number;
}

export interface PromptTemplate {
    id: number;
    name: string;
    prompt_text: string;
    category?: string;
    created_at: number;
    updated_at: number;
}
