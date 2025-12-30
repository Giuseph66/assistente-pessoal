import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { mkdir, writeFile, readdir, stat, readFile, unlink } from 'fs/promises'
import { spawn } from 'child_process'
import { pathToFileURL } from 'url'
import { extname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupErrorHandlers, setShuttingDown } from './error-handler'
import { getOverlayManager } from './overlay'
import { getHotkeysManager } from './hotkeys'
import { getConfigManager } from '@ricky/config'
import { getLogger } from '@ricky/logger'
import { DatabaseManager } from './database'
import { Gateway } from './gateway'
import { getEngineManager } from './engine-manager'
import { captureAreaInteractive, captureScreenshot } from './screenshot'
import { registerSttIpc } from './ipc/sttIpc'
import { registerModelIpc } from './ipc/modelIpc'
import { registerSystemAudioIpc } from './ipc/systemAudioIpc'
import { registerRecorderIpc } from './ipc/recorderIpc'
import { registerTranscribeFileIpc } from './ipc/transcribeFileIpc'
import { registerAIIpc } from './ipc/aiIpc'
import { registerSystemSttIpc } from './ipc/systemSttIpc'
import { registerScreenshotIpc } from './ipc/screenshotIpc'
import { registerTranslationIpc } from './ipc/translationIpc'
import { getModelManager, getSttController } from './stt/sttService'
import { SystemAudioSourceManager } from './audio/system/SystemAudioSourceManager'
import { RecorderService } from './audio/recording/RecorderService'
import { SystemSttController } from './stt/SystemSttController'
import { ScreenTranslateService } from './services/translation/ScreenTranslateService'

function createWindow(): void {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 900,
        height: 670,
        show: false,
        autoHideMenuBar: true,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        hasShadow: false,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show();
        // Ativa content protection para tornar a janela invisível no compartilhamento de tela
        // Isso previne que a janela seja capturada por Google Meet, Zoom, etc.
        try {
            mainWindow.setContentProtection(true);
            logger.info('Content protection enabled for main window (invisible in screen sharing)');
        } catch (error) {
            logger.warn({ err: error }, 'Failed to set content protection for main window (may not be supported on this system)');
        }
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// Setup error handlers
setupErrorHandlers();

// Initialize logger
const logger = getLogger();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.ricky.assistant')

    // Initialize config
    const config = getConfigManager();
    logger.info('Configuration loaded');

    // Initialize database
    const db = new DatabaseManager();
    logger.info('Database initialized');

    // Initialize WebSocket gateway
    const gateway = new Gateway(8788);
    gateway.setDatabase(db);
    logger.info('Gateway initialized');

    // Start engine process (async, não bloqueia)
    const engineManager = getEngineManager();
    engineManager.start().catch((error) => {
      logger.error({ err: error }, 'Failed to start engine (continuing without STT)');
    });

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    // Create overlay window
    const overlayManager = getOverlayManager();
    
    // Register overlay IPC handlers BEFORE creating window to ensure they're available
    // IPC handlers for overlay
    ipcMain.on('overlay:minimize', () => {
        const window = overlayManager.getWindow();
        if (window) {
            if (window.isMinimizable()) {
                window.minimize();
            } else {
                window.hide();
            }
        }
    });

    ipcMain.on('overlay:close', () => {
        const window = overlayManager.getWindow();
        if (window) {
            window.close();
        }
    });

    // IPC handlers for content protection
    ipcMain.handle('overlay:setContentProtection', async (_event, enabled: boolean) => {
        try {
            overlayManager.setContentProtection(enabled);
            return { success: true };
        } catch (error: any) {
            logger.error({ err: error }, 'Failed to set content protection via IPC');
            return { success: false, error: error?.message || 'Unknown error' };
        }
    });

    ipcMain.handle('overlay:getContentProtection', async () => {
        try {
            const overlayManager = getOverlayManager();
            const currentState = overlayManager.getCurrentContentProtection();
            const platformInfo = overlayManager.getPlatformInfo();
            
            // Retorna estado interno se disponível, senão usa config como fallback
            const enabled = currentState !== null ? currentState : true;
            
            return { 
                enabled,
                platform: platformInfo.platform,
                supportsContentProtection: platformInfo.supportsContentProtection,
                usingWorkarounds: !platformInfo.supportsContentProtection
            };
        } catch (error: any) {
            logger.error({ err: error }, 'Failed to get content protection via IPC');
            return { 
                enabled: true, 
                platform: process.platform, 
                supportsContentProtection: false, 
                usingWorkarounds: true 
            };
        }
    });

    // Handler para obter número de monitores
    ipcMain.handle('overlay:getDisplayCount', async () => {
        try {
            const overlayManager = getOverlayManager();
            const count = overlayManager.getDisplayCount();
            return { count };
        } catch (error: any) {
            logger.error({ err: error }, 'Failed to get display count via IPC');
            return { count: 1 };
        }
    });

    // Handler para mover janela para próximo monitor
    ipcMain.handle('overlay:moveToNextMonitor', async () => {
        try {
            const overlayManager = getOverlayManager();
            const success = overlayManager.moveToNextMonitor();
            return { success };
        } catch (error: any) {
            logger.error({ err: error }, 'Failed to move to next monitor via IPC');
            return { success: false, error: error?.message || 'Unknown error' };
        }
    });

    // IPC handler for panic button (apenas altera content protection, mantém janela visível)
    ipcMain.on('overlay:panic', (_event, { hide }: { hide: boolean }) => {
        try {
            if (hide) {
                // Desabilitar content protection: janela fica visível para você, mas invisível no compartilhamento
                overlayManager.setContentProtection(false);
                // Garante que a janela está visível (caso tenha sido escondida antes)
                overlayManager.show();
                logger.info('Panic mode: content protection disabled (window remains visible to you)');
            } else {
                // Habilitar content protection: janela fica protegida do compartilhamento
                overlayManager.setContentProtection(true);
                // Garante que a janela está visível
                overlayManager.show();
                logger.info('Panic mode: content protection enabled (window invisible in screen sharing)');
            }
        } catch (error: any) {
            logger.error({ err: error }, 'Failed to toggle panic mode');
        }
    });

    registerScreenshotIpc();
    
    overlayManager.createWindow();

    // Initialize STT pipeline + IPC
    const modelManager = getModelManager();
    const sttController = getSttController();
    registerModelIpc(modelManager);
    registerSttIpc(sttController);
    const systemAudioManager = new SystemAudioSourceManager();
    const recorderService = new RecorderService(db);
    registerSystemAudioIpc(systemAudioManager);
    registerRecorderIpc(recorderService);
    registerTranscribeFileIpc(db, modelManager);
    const systemSttController = new SystemSttController(modelManager);
    registerSystemSttIpc(systemSttController);

    const translationService = new ScreenTranslateService();
    registerTranslationIpc(translationService);
    
    // Initialize AI IPC
    registerAIIpc(db);
    
    // Initialize default AI providers in database
    try {
      db.saveAIProvider({ id: 'gemini', display_name: 'Google Gemini', base_url: 'https://generativelanguage.googleapis.com' });
      db.saveAIProvider({ id: 'openai', display_name: 'OpenAI', base_url: 'https://api.openai.com' });
      logger.info('Default AI providers initialized');
    } catch (error) {
      logger.warn({ err: error }, 'Failed to initialize default AI providers (may already exist)');
    }

    const runInteractiveCapture = async () => {
      overlayManager.hide();
      try {
        const captureResult = await captureAreaInteractive(db);
        if (captureResult.success) {
          const screenshots = db.getScreenshots(1);
          if (screenshots.length > 0) {
            gateway.broadcast({
              type: 'screenshot.captured',
              payload: { screenshot: screenshots[0] },
            });
          }
        }
        return captureResult;
      } catch (error: any) {
        logger.error({ err: error }, 'Failed to capture screenshot');
        return {
          success: false,
          error: error?.message || 'Unknown error',
        };
      } finally {
        overlayManager.show();
      }
    };

    const runFullscreenCapture = async () => {
      // Esconde overlay e janela de tradução (se estiver visível)
      overlayManager.hide();
      overlayManager.hideTranslationWindow();
      // Aguarda um pouco para garantir que animações de minimizar/restaurar/fullscreen terminem
      // antes de capturar o screenshot (evita que animações apareçam na captura)
      // 500ms é suficiente para a maioria das animações do sistema
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const captureResult = await captureScreenshot({ mode: 'fullscreen' }, db);
        if (captureResult.success) {
          const screenshots = db.getScreenshots(1);
          if (screenshots.length > 0) {
            gateway.broadcast({
              type: 'screenshot.captured',
              payload: { screenshot: screenshots[0] },
            });
          }
        }
        return captureResult;
      } catch (error: any) {
        logger.error({ err: error }, 'Failed to capture fullscreen screenshot');
        return {
          success: false,
          error: error?.message || 'Unknown error',
        };
      } finally {
        overlayManager.show();
      }
    };

    // Configure screenshot capture callbacks for gateway
    logger.info('Configuring screenshot callbacks');
    gateway.setScreenshotCallbacks(
      async () => {
        logger.debug('Screenshot startCapture callback called');
        const result = await runInteractiveCapture();
        if (!result.success && result.error && result.error !== 'Selecao cancelada') {
          throw new Error(result.error);
        }
      },
      async () => {
        // Cancel capture: interactive tools handle cancel internally
        logger.debug('Screenshot cancel requested (interactive)');
        overlayManager.show();
      }
    );

    // IPC handler direto para iniciar captura (alternativa ao WebSocket)
    ipcMain.on('screenshot:startCapture', () => {
      logger.info('IPC screenshot:startCapture received');
      runInteractiveCapture();
    });

    ipcMain.handle('screenshot:captureFullscreen', async () => {
      logger.info('IPC screenshot:captureFullscreen received');
      return runFullscreenCapture();
    });

    // Register global hotkeys
    const hotkeysManager = getHotkeysManager();
    hotkeysManager.registerAll();

    const convertToWav = async (inputPath: string, outputPath: string): Promise<void> => {
        await new Promise<void>((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-y',
                '-i',
                inputPath,
                '-ac',
                '1',
                '-ar',
                '44100',
                outputPath,
            ]);

            ffmpeg.on('error', (error) => reject(error));
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`ffmpeg exited with code ${code}`));
                }
            });
        });
    };

    ipcMain.handle('audio:save', async (_, { buffer, mimeType }) => {
        const recordingsDir = join(app.getPath('userData'), 'recordings');
        await mkdir(recordingsDir, { recursive: true });

        const safeType = typeof mimeType === 'string' ? mimeType : 'audio/webm';
        const filenameBase = `recording-${Date.now()}`;

        if (safeType.includes('wav')) {
            const filePath = join(recordingsDir, `${filenameBase}.wav`);
            const data = Buffer.from(buffer as ArrayBuffer);
            await writeFile(filePath, data);
            return { filePath, fileUrl: pathToFileURL(filePath).toString() };
        }

        const tempPath = join(app.getPath('temp'), `${filenameBase}.webm`);
        const outputPath = join(recordingsDir, `${filenameBase}.wav`);
        const data = Buffer.from(buffer as ArrayBuffer);
        await writeFile(tempPath, data);
        try {
            await convertToWav(tempPath, outputPath);
        } finally {
            await unlink(tempPath).catch(() => undefined);
        }
        return { filePath: outputPath, fileUrl: pathToFileURL(outputPath).toString() };
    });

    ipcMain.handle('audio:list', async () => {
        const recordingsDir = join(app.getPath('userData'), 'recordings');
        await mkdir(recordingsDir, { recursive: true });
        const entries = await readdir(recordingsDir, { withFileTypes: true });

        const files = await Promise.all(
            entries
                .filter((entry) => entry.isFile())
                .map(async (entry) => {
                    const filePath = join(recordingsDir, entry.name);
                    const info = await stat(filePath);
                    return {
                        filePath,
                        fileUrl: pathToFileURL(filePath).toString(),
                        fileName: entry.name,
                        size: info.size,
                        createdAt: info.mtimeMs,
                    };
                })
        );

        return files
            .filter((file) => /\.(webm|ogg|wav)$/i.test(file.fileName))
            .sort((a, b) => b.createdAt - a.createdAt);
    });

    ipcMain.handle('audio:read', async (_, { filePath }) => {
        const data = await readFile(filePath as string);
        const ext = extname(filePath as string).toLowerCase();
        const mimeType =
            ext === '.wav'
                ? 'audio/wav'
                : ext === '.ogg'
                    ? 'audio/ogg'
                    : 'audio/webm';
        return { buffer: data, mimeType };
    });

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            overlayManager.createWindow();
        }
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// Cleanup on quit
app.on('will-quit', async (event) => {
    // Marcar que estamos em processo de shutdown
    // Isso permite filtrar erros esperados de workers durante o encerramento
    setShuttingDown(true);
    
    const hotkeysManager = getHotkeysManager();
    hotkeysManager.unregisterAll();
    
    // Aguardar encerramento dos serviços com timeout para evitar travamento
    const shutdownPromises: Promise<void>[] = [];
    
    const engineManager = getEngineManager();
    shutdownPromises.push(
        Promise.resolve().then(() => {
            engineManager.stop();
        })
    );

    const sttController = getSttController();
    shutdownPromises.push(
        sttController.stop().catch((error) => {
            // Logar mas não bloquear o shutdown
            logger.warn({ err: error }, 'Error stopping STT controller during shutdown');
        })
    );
    
    try {
        // Aguardar até 5 segundos para o encerramento dos serviços
        await Promise.race([
            Promise.all(shutdownPromises),
            new Promise<void>((resolve) => {
                setTimeout(() => {
                    logger.warn('Shutdown timeout reached, forcing exit');
                    resolve();
                }, 5000);
            })
        ]);
    } catch (error) {
        // Logar mas não bloquear o shutdown
        logger.warn({ err: error }, 'Error during shutdown cleanup');
    }
    
    logger.info('Application quitting');
})
