import { useSyncExternalStore } from 'react';

let analyser: AnalyserNode | null = null;
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

export const setSttMicAnalyser = (next: AnalyserNode | null) => {
  analyser = next;
  emit();
};

export const getSttMicAnalyser = () => analyser;

export const subscribeSttMicAnalyser = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useSttMicAnalyser = () =>
  useSyncExternalStore(subscribeSttMicAnalyser, getSttMicAnalyser, getSttMicAnalyser);
