/**
 * Multi-profile token store with encrypted persistence.
 * Uses the existing KeyStorage (safeStorage / AES-GCM fallback)
 * for encrypting tokens on disk.
 *
 * Runtime cache avoids Keychain reads on every access.
 */
import { app } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { KeyStorage } from '../ai/storage/KeyStorage';
import { getLogger } from '@neo/logger';

const logger = getLogger();

export interface AuthProfile {
    profileId: string;
    label: string;
    provider: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // Unix timestamp (ms)
    accountId?: string;
    isEnabled?: boolean; // Whether this profile is active for generation
}

/** What gets serialized to disk (tokens encrypted) */
interface PersistedProfile {
    profileId: string;
    label: string;
    provider: string;
    encAccessToken: string;
    encRefreshToken: string;
    expiresAt: number;
    accountId?: string;
    isEnabled?: boolean;
}

interface PersistedData {
    profiles: PersistedProfile[];
    activeProfileId: string | null;
}

/** Mask a token for safe logging: first 4 + last 4 chars */
export function maskToken(token: string): string {
    if (token.length <= 10) return '****';
    return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

export class TokenStore {
    private cache: Map<string, AuthProfile> = new Map();
    private activeProfileId: string | null = null;
    private keyStorage: KeyStorage;
    private filePath: string;
    private loaded = false;

    constructor(keyStorage?: KeyStorage) {
        this.keyStorage = keyStorage || new KeyStorage();
        const dataDir = join(app.getPath('userData'), 'auth');
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
        }
        this.filePath = join(dataDir, 'profiles.enc');
    }

    /** Lazy-load from disk on first access */
    private ensureLoaded(): void {
        if (this.loaded) return;
        this.loaded = true;
        this.loadFromDisk();
    }

    private loadFromDisk(): void {
        if (!existsSync(this.filePath)) {
            logger.debug('No auth profiles file found — starting fresh');
            return;
        }

        try {
            const raw = readFileSync(this.filePath, 'utf-8');
            const decrypted = this.keyStorage.decrypt(raw);
            const data: PersistedData = JSON.parse(decrypted);

            this.activeProfileId = data.activeProfileId;
            this.cache.clear();

            for (const p of data.profiles) {
                try {
                    const profile: AuthProfile = {
                        profileId: p.profileId,
                        label: p.label,
                        provider: p.provider,
                        accessToken: this.keyStorage.decrypt(p.encAccessToken),
                        refreshToken: this.keyStorage.decrypt(p.encRefreshToken),
                        expiresAt: p.expiresAt,
                        accountId: p.accountId,
                        isEnabled: p.isEnabled !== false, // Default to true if missing
                    };
                    this.cache.set(profile.profileId, profile);
                } catch (err) {
                    logger.error({ profileId: p.profileId, err }, 'Failed to decrypt profile tokens');
                }
            }

            logger.info({ count: this.cache.size }, 'Loaded auth profiles');
        } catch (err) {
            logger.error({ err }, 'Failed to load auth profiles from disk');
        }
    }

    private saveToDisk(): void {
        try {
            const profiles: PersistedProfile[] = [];

            for (const p of this.cache.values()) {
                profiles.push({
                    profileId: p.profileId,
                    label: p.label,
                    provider: p.provider,
                    encAccessToken: this.keyStorage.encrypt(p.accessToken),
                    encRefreshToken: this.keyStorage.encrypt(p.refreshToken),
                    expiresAt: p.expiresAt,
                    accountId: p.accountId,
                    isEnabled: p.isEnabled,
                });
            }

            const data: PersistedData = {
                profiles,
                activeProfileId: this.activeProfileId,
            };

            const json = JSON.stringify(data);
            const encrypted = this.keyStorage.encrypt(json);
            writeFileSync(this.filePath, encrypted, { mode: 0o600 });

            logger.debug({ count: profiles.length }, 'Saved auth profiles to disk');
        } catch (err) {
            logger.error({ err }, 'Failed to save auth profiles to disk');
        }
    }

    // ── Public API ──

    saveProfile(profile: AuthProfile): void {
        this.ensureLoaded();
        this.cache.set(profile.profileId, { ...profile });
        logger.info(
            { profileId: profile.profileId, token: maskToken(profile.accessToken) },
            'Saved auth profile'
        );
        this.saveToDisk();
    }

    getProfile(profileId: string): AuthProfile | null {
        this.ensureLoaded();
        return this.cache.get(profileId) || null;
    }

    removeProfile(profileId: string): void {
        this.ensureLoaded();
        this.cache.delete(profileId);
        if (this.activeProfileId === profileId) {
            this.activeProfileId = null;
        }
        logger.info({ profileId }, 'Removed auth profile');
        this.saveToDisk();
    }

    listProfiles(): Array<{
        profileId: string;
        label: string;
        provider: string;
        expiresAt: number;
        accountId?: string;
        isActive: boolean;
        isExpired: boolean;
        isEnabled: boolean;
    }> {
        this.ensureLoaded();
        const result: Array<{
            profileId: string;
            label: string;
            provider: string;
            expiresAt: number;
            accountId?: string;
            isActive: boolean;
            isExpired: boolean;
            isEnabled: boolean;
        }> = [];

        for (const p of this.cache.values()) {
            result.push({
                profileId: p.profileId,
                label: p.label,
                provider: p.provider,
                expiresAt: p.expiresAt,
                accountId: p.accountId,
                isActive: p.profileId === this.activeProfileId,
                isExpired: p.expiresAt < Date.now(),
                isEnabled: p.isEnabled !== false,
            });
        }
        return result;
    }

    getActiveProfileId(): string | null {
        this.ensureLoaded();
        return this.activeProfileId;
    }

    setActiveProfileId(profileId: string): void {
        this.ensureLoaded();
        if (!this.cache.has(profileId)) {
            throw new Error(`Profile "${profileId}" not found`);
        }
        this.activeProfileId = profileId;
        this.saveToDisk();
        logger.info({ profileId }, 'Set active auth profile');
    }

    setProfileEnabled(profileId: string, isEnabled: boolean): void {
        this.ensureLoaded();
        const profile = this.cache.get(profileId);
        if (!profile) {
            throw new Error(`Profile "${profileId}" not found`);
        }
        profile.isEnabled = isEnabled;
        this.saveToDisk();
        logger.info({ profileId, isEnabled }, 'Toggled auth profile enabled state');
    }

    /** Update tokens after a refresh */
    updateTokens(
        profileId: string,
        accessToken: string,
        refreshToken: string,
        expiresAt: number
    ): void {
        this.ensureLoaded();
        const profile = this.cache.get(profileId);
        if (!profile) throw new Error(`Profile "${profileId}" not found`);

        profile.accessToken = accessToken;
        profile.refreshToken = refreshToken;
        profile.expiresAt = expiresAt;

        logger.debug(
            { profileId, token: maskToken(accessToken), expiresAt },
            'Updated tokens for profile'
        );
        this.saveToDisk();
    }
}
