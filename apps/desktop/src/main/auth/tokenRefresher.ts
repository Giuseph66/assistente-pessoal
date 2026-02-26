/**
 * Token Refresher with per-profile mutex lock.
 * Ensures only one refresh happens at a time per profile to prevent
 * concurrent refresh calls from invalidating refresh tokens.
 */
import { getLogger } from '@neo/logger';
import { TokenStore, maskToken } from './tokenStore';
import { getOAuthConfig } from './authConfig';

const logger = getLogger();

/** Margin in ms — refresh if token expires within this window */
const EXPIRY_MARGIN_MS = 60_000; // 60 seconds

export class MissingScopesError extends Error {
    public missingScopes: string[];
    constructor(scopes: string[]) {
        super(`Missing required scopes: ${scopes.join(', ')}. Re-login with correct scopes.`);
        this.name = 'MissingScopesError';
        this.missingScopes = scopes;
    }
}

export class TokenRefreshError extends Error {
    public reason: string;
    constructor(message: string, reason: string) {
        super(message);
        this.name = 'TokenRefreshError';
        this.reason = reason;
    }
}

export class TokenRefresher {
    private tokenStore: TokenStore;
    /** Per-profile mutex: stores in-flight refresh promises */
    private refreshLocks: Map<string, Promise<string>> = new Map();

    constructor(tokenStore: TokenStore) {
        this.tokenStore = tokenStore;
    }

    /**
     * Returns a valid access token for the given profile.
     * Automatically refreshes if expired or about to expire.
     * Uses a lock to prevent concurrent refresh races.
     */
    async getValidAccessToken(profileId?: string): Promise<string> {
        const id = profileId || this.tokenStore.getActiveProfileId();
        if (!id) {
            throw new Error('No active auth profile. Please log in first.');
        }

        const profile = this.tokenStore.getProfile(id);
        if (!profile) {
            throw new Error(`Auth profile "${id}" not found. Please log in again.`);
        }

        // Token still valid?
        if (profile.expiresAt > Date.now() + EXPIRY_MARGIN_MS) {
            return profile.accessToken;
        }

        // Need to refresh — use mutex
        return this.refreshWithLock(id);
    }

    private async refreshWithLock(profileId: string): Promise<string> {
        // If a refresh is already in flight for this profile, wait for it
        const existing = this.refreshLocks.get(profileId);
        if (existing) {
            logger.debug({ profileId }, 'Waiting for in-flight token refresh');
            return existing;
        }

        const refreshPromise = this.doRefresh(profileId).finally(() => {
            this.refreshLocks.delete(profileId);
        });

        this.refreshLocks.set(profileId, refreshPromise);
        return refreshPromise;
    }

    private async doRefresh(profileId: string): Promise<string> {
        const profile = this.tokenStore.getProfile(profileId);
        if (!profile) {
            throw new Error(`Auth profile "${profileId}" not found`);
        }

        if (!profile.refreshToken) {
            this.tokenStore.removeProfile(profileId);
            throw new TokenRefreshError(
                'No refresh token available. Please log in again.',
                'no_refresh_token'
            );
        }

        const config = getOAuthConfig();
        logger.info({ profileId, token: maskToken(profile.refreshToken) }, 'Refreshing access token');

        try {
            const body = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: profile.refreshToken,
                client_id: config.clientId,
            });

            const response = await fetch(config.tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString(),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'unknown' }));
                const errorCode = errorData.error || 'unknown';

                logger.error(
                    { profileId, status: response.status, error: errorCode },
                    'Token refresh failed'
                );

                // If refresh token is invalid/expired, remove the profile
                if (errorCode === 'invalid_grant' || response.status === 401) {
                    this.tokenStore.removeProfile(profileId);
                    throw new TokenRefreshError(
                        'Refresh token is invalid or expired. Please log in again.',
                        'invalid_grant'
                    );
                }

                throw new TokenRefreshError(
                    `Token refresh failed: ${errorCode} (${response.status})`,
                    errorCode
                );
            }

            const data = await response.json();

            const newAccessToken = data.access_token;
            const newRefreshToken = data.refresh_token || profile.refreshToken;
            const expiresIn = data.expires_in || 3600;
            const expiresAt = Date.now() + expiresIn * 1000;

            this.tokenStore.updateTokens(profileId, newAccessToken, newRefreshToken, expiresAt);

            logger.info(
                { profileId, token: maskToken(newAccessToken), expiresIn },
                'Token refreshed successfully'
            );

            return newAccessToken;
        } catch (err) {
            if (err instanceof TokenRefreshError) throw err;
            logger.error({ profileId, err }, 'Unexpected error during token refresh');
            throw new TokenRefreshError(
                'Token refresh failed unexpectedly. Please try again.',
                'unexpected'
            );
        }
    }
}
