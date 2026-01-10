export type FeaturePermission = 'microphone' | 'systemAudio' | 'screenCapture';

const STORAGE_PREFIX = 'permissions:';

function keyFor(feature: FeaturePermission): string {
  return `${STORAGE_PREFIX}${feature}`;
}

export function getFeaturePermission(feature: FeaturePermission): boolean {
  try {
    const raw = localStorage.getItem(keyFor(feature));
    // default: allowed
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    // if storage is unavailable, don't block the user by default
    return true;
  }
}

export function setFeaturePermission(feature: FeaturePermission, allowed: boolean): void {
  try {
    localStorage.setItem(keyFor(feature), String(allowed));
  } catch {
    // ignore
  }
}


