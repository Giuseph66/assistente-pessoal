// Shared types and constants
export const APP_NAME = 'Ricky Assistant';

export * from './types/events.js';
export * from './types/database.js';
export * from './stt/types.js';
export * from './stt/events.js';
export * from './stt/schemas.js';
export * from './stt/modelTypes.js';
export * from './audio/types.js';
export * from './subtitles/types.js';
export * from './translation/types.js';
export * from './ai/types.js';

export enum IpcChannels {
    OVERLAY_TOGGLE = 'overlay.toggle',
    STT_START = 'stt.start',
    STT_STOP = 'stt.stop',
    TRANSLATE_PARTIAL = 'translate.partial'
}
