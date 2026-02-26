/**
 * IPC handlers for OAuth authentication.
 * Follows the same pattern as aiIpc.ts — all handlers registered in one function.
 */
import { ipcMain, BrowserWindow } from 'electron';
import { getOAuthController } from '../auth/openaiOAuth';
import { updateOAuthConfig, getOAuthConfig } from '../auth/authConfig';
import { getLogger } from '@neo/logger';

const logger = getLogger();

function broadcast(channel: string, payload: any): void {
    for (const win of BrowserWindow.getAllWindows()) {
        try {
            win.webContents.send(channel, payload);
        } catch {
            // window may be destroyed
        }
    }
}

export function registerAuthIpc(): void {
    const controller = getOAuthController();

    // Listen for status changes and broadcast to renderer
    controller.onStatusChanged((state) => {
        broadcast('auth:status-changed', state);
    });

    // ── Login Flow ──

    ipcMain.handle('auth:login-openai', async (_event, profileId?: string, label?: string) => {
        try {
            return await controller.startLogin(profileId || 'default', label || 'Personal');
        } catch (err: any) {
            logger.error({ err }, 'auth:login-openai failed');
            return { success: false, error: err?.message || 'Login failed' };
        }
    });

    ipcMain.handle('auth:finish-login-manual', async (_event, profileId: string, codeOrUrl: string, label?: string) => {
        try {
            return await controller.finishLoginManual(profileId, codeOrUrl, label);
        } catch (err: any) {
            logger.error({ err }, 'auth:finish-login-manual failed');
            return { success: false, error: err?.message || 'Manual login failed' };
        }
    });

    ipcMain.handle('auth:cancel-login', async (_event, profileId: string) => {
        controller.cancelFlow(profileId || 'default');
        return { success: true };
    });

    // ── Logout ──

    ipcMain.handle('auth:logout', async (_event, profileId: string) => {
        try {
            controller.logout(profileId);
            return { success: true };
        } catch (err: any) {
            logger.error({ err }, 'auth:logout failed');
            return { success: false, error: err?.message };
        }
    });

    // ── Token Access ──

    ipcMain.handle('auth:get-access-token', async (_event, profileId?: string) => {
        try {
            const token = await controller.getAccessToken(profileId);
            return { success: true, token };
        } catch (err: any) {
            logger.error({ err }, 'auth:get-access-token failed');
            return { success: false, error: err?.message };
        }
    });

    // ── Profiles ──

    ipcMain.handle('auth:get-profiles', async () => {
        try {
            const store = controller.getTokenStore();
            return store.listProfiles();
        } catch (err: any) {
            logger.error({ err }, 'auth:get-profiles failed');
            return [];
        }
    });

    ipcMain.handle('auth:set-active-profile', async (_event, profileId: string) => {
        try {
            controller.getTokenStore().setActiveProfileId(profileId);
            return { success: true };
        } catch (err: any) {
            logger.error({ err }, 'auth:set-active-profile failed');
            return { success: false, error: err?.message };
        }
    });

    ipcMain.handle('auth:set-profile-enabled', async (_event, profileId: string, isEnabled: boolean) => {
        try {
            controller.getTokenStore().setProfileEnabled(profileId, isEnabled);
            broadcast('auth:status-changed', controller.getStatus(profileId)); // Re-broadcast status
            return { success: true };
        } catch (err: any) {
            logger.error({ err }, 'auth:set-profile-enabled failed');
            return { success: false, error: err?.message };
        }
    });

    // ── Status ──

    ipcMain.handle('auth:get-status', async (_event, profileId?: string) => {
        try {
            return controller.getStatus(profileId);
        } catch (err: any) {
            logger.error({ err }, 'auth:get-status failed');
            return { connected: false, profileId: null, flowStatus: 'error' };
        }
    });

    // ── OAuth Config ──

    ipcMain.handle('auth:get-config', async () => {
        const config = getOAuthConfig();
        // Don't expose the full config — just what the UI needs
        return {
            clientId: config.clientId,
            scopes: config.scopes,
            authorizeUrl: config.authorizeUrl,
            redirectUri: config.redirectUri,
        };
    });

    ipcMain.handle('auth:update-config', async (_event, patch: Record<string, any>) => {
        try {
            const updated = updateOAuthConfig(patch);
            return {
                success: true,
                clientId: updated.clientId,
                scopes: updated.scopes,
            };
        } catch (err: any) {
            logger.error({ err }, 'auth:update-config failed');
            return { success: false, error: err?.message };
        }
    });

    logger.info('Auth IPC handlers registered');
}
