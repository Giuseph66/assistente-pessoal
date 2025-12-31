import type {
  LiveTranscriptionProviderId,
  STTConfig,
  STTFinalEvent,
  STTPartialEvent,
  STTStatus,
} from './types.js';

export type STTStartEvent = {
  type: 'stt.start';
  payload: { config: STTConfig };
};

export type STTStopEvent = {
  type: 'stt.stop';
  payload: {};
};

export type STTStatusEvent = {
  type: 'stt.status';
  payload: STTStatus;
};

export type STTPartialPushEvent = {
  type: 'stt.partial';
  payload: STTPartialEvent;
};

export type STTFinalPushEvent = {
  type: 'stt.final';
  payload: STTFinalEvent;
};

export type STTErrorEvent = {
  type: 'stt.error';
  payload: {
    message: string;
    code?: string;
    debug?: string;
    providerId?: LiveTranscriptionProviderId;
    ts: number;
  };
};

export type STTEvent =
  | STTStartEvent
  | STTStopEvent
  | STTStatusEvent
  | STTPartialPushEvent
  | STTFinalPushEvent
  | STTErrorEvent;
