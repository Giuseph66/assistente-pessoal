import { BrowserWindow, ipcMain } from 'electron';
import { DatabaseManager } from '../database';

const broadcast = (channel: string, payload: any) => {
    BrowserWindow.getAllWindows().forEach((win) => {
        if (win.isDestroyed()) return;
        const contents = win.webContents;
        if (contents.isDestroyed() || contents.isCrashed()) return;
        try {
            contents.send(channel, payload);
        } catch {
            // ignore
        }
    });
};

export function registerSessionIpc(db: DatabaseManager): void {
    let currentTranscriptionSessionId: number | null = null;

    // --- Transcription Sessions (Legacy/Audio only) ---

    ipcMain.on('session:start-listening', async (event) => {
        try {
            // Create session in DB
            currentTranscriptionSessionId = db.createTranscriptionSession('pt'); // Default to pt for now

            // Broadcast session started
            broadcast('session:started', { sessionId: currentTranscriptionSessionId });

            console.log(`[Session] Started transcription session #${currentTranscriptionSessionId}`);
        } catch (error) {
            console.error('[Session] Failed to start session:', error);
        }
    });

    ipcMain.on('session:stop-listening', async () => {
        try {
            if (currentTranscriptionSessionId !== null) {
                db.endTranscriptionSession(currentTranscriptionSessionId);
                console.log(`[Session] Ended transcription session #${currentTranscriptionSessionId}`);
                currentTranscriptionSessionId = null;
            }

            broadcast('session:stopped', {});
        } catch (error) {
            console.error('[Session] Failed to stop session:', error);
        }
    });

    ipcMain.handle('session:getCurrentId', async () => {
        return currentTranscriptionSessionId;
    });

    // --- AI Chat Sessions (New) ---

    ipcMain.handle('session:list', async (_event, { date }: { date?: number }) => {
        try {
            const targetDate = date || Date.now();
            const startOfDay = new Date(targetDate).setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate).setHours(23, 59, 59, 999);

            const sessions = db.getAISessionsByDate(startOfDay, endOfDay);
            return sessions.map(s => ({
                id: s.id,
                createdAt: s.created_at,
                modelName: s.model_name,
                providerId: s.provider_id,
                screenshotId: s.screenshot_id
            }));
        } catch (error) {
            console.error('[Session] Failed to list sessions:', error);
            return [];
        }
    });

    ipcMain.handle('session:get', async (_event, sessionId: number) => {
        try {
            const session = db.getAISessionById(sessionId);
            if (!session) return null;

            const messages = db.getAIMessages(sessionId);
            return {
                ...session,
                messages: messages.map(m => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    recognizedText: m.recognized_text,
                    createdAt: m.created_at
                }))
            };
        } catch (error) {
            console.error('[Session] Failed to get session:', error);
            return null;
        }
    });

    ipcMain.handle('session:create', async (_event, { providerId, modelName }: { providerId: string, modelName: string }) => {
        try {
            const sessionId = db.saveAISession({
                providerId: providerId,
                modelName: modelName,
                screenshotId: undefined // Explicitly undefined for chat-only sessions
            });
            return { sessionId };
        } catch (error) {
            console.error('[Session] Failed to create session:', error);
            throw error;
        }
    });

    ipcMain.on('session:activate', (_event, sessionId: number) => {
        broadcast('session:activated', { sessionId });
    });
}
