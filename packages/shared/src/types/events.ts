export interface BaseEvent {
    type: string;
    payload: any;
    id?: string;
    timestamp?: number;
}

export interface OverlayToggleRequest extends BaseEvent {
    type: 'overlay.toggle';
    payload: {};
}

export interface OverlayToggleResponse extends BaseEvent {
    type: 'overlay.toggle.response';
    payload: { visible: boolean };
}

export interface SttStartRequest extends BaseEvent {
    type: 'stt.start';
    payload: { language?: 'en' | 'pt' };
}

export interface SttPartialEvent extends BaseEvent {
    type: 'stt.partial';
    payload: { text: string; confidence: number };
}

export interface SttFinalEvent extends BaseEvent {
    type: 'stt.final';
    payload: { text: string; timestamp: number };
}

export interface TranslatePartialEvent extends BaseEvent {
    type: 'translate.partial';
    payload: {
        original: string;
        translated: string;
        source: 'en';
        target: 'pt';
    };
}

export interface SttStartResponse extends BaseEvent {
    type: 'stt.start.response';
    payload: { success: boolean; state: string };
}

export interface SttStopResponse extends BaseEvent {
    type: 'stt.stop.response';
    payload: { success: boolean; state: string };
}
