import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'ricky:shared-chat-input';

type SharedInputState = {
  value: string;
};

let state: SharedInputState = { value: '' };
let initialized = false;
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const readStorageValue = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const writeStorageValue = (value: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore storage errors
  }
};

const setStateValue = (value: string, writeStorage: boolean): void => {
  const next = value ?? '';
  if (next === state.value) {
    if (writeStorage) {
      writeStorageValue(next);
    }
    return;
  }
  state = { value: next };
  emit();
  if (writeStorage) {
    writeStorageValue(next);
  }
};

const ensureInit = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  state = { value: readStorageValue() };
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    setStateValue(event.newValue || '', false);
  });
};

export const setSharedInputValue = (value: string): void => {
  ensureInit();
  setStateValue(value, true);
};

export const subscribeSharedInput = (listener: () => void): (() => void) => {
  ensureInit();
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getSharedInputValue = (): string => {
  ensureInit();
  return state.value;
};

export const useSharedInputValue = (): [string, (value: string) => void] => {
  ensureInit();
  const value = useSyncExternalStore(
    subscribeSharedInput,
    getSharedInputValue,
    getSharedInputValue
  );
  return [value, setSharedInputValue];
};
