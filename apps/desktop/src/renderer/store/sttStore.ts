import { useSyncExternalStore } from 'react';
import { STTFinalEvent, STTPartialEvent, STTStatus } from '@neo/shared';

export type SttState = {
  status: STTStatus;
  partial: STTPartialEvent | null;
  finals: STTFinalEvent[];
};

const defaultStatus: STTStatus = { state: 'idle' };
let state: SttState = { status: defaultStatus, partial: null, finals: [] };
let initialized = false;
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

export const initSttStore = () => {
  if (initialized) return;
  if (!window.stt) {
    setTimeout(() => initSttStore(), 250);
    return;
  }
  initialized = true;

  window.stt.getStatus().then((status) => {
    state = { ...state, status: status || defaultStatus };
    console.log('[STT] status init', status);
    emit();
  });

  window.stt.onStatus((status) => {
    state = { ...state, status };
    console.log('[STT] status', status);
    emit();
  });

  window.stt.onPartial((event) => {
    state = { ...state, partial: event };
    console.log('[STT] partial', event);
    emit();
  });

  window.stt.onFinal((event) => {
    state = { ...state, finals: [event, ...state.finals].slice(0, 20), partial: null };
    console.log('[STT] final', event);
    emit();
  });
};

export const subscribeSttStore = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getSttState = () => state;

export const useSttState = () =>
  useSyncExternalStore(subscribeSttStore, getSttState, getSttState);
