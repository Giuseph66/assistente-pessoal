import { z } from 'zod';

/**
 * Schema de validação para configurações do aplicativo
 */
const ScreenshotRegionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  monitorIndex: z.number().int().optional(),
  displayId: z.number().int().optional(),
});

export const AppConfigSchema = z.object({
  overlay: z.object({
    position: z.object({
      x: z.number().int().default(100),
      y: z.number().int().default(100),
    }),
    size: z.object({
      width: z.number().int().min(300).max(2000).default(600),
      height: z.number().int().min(200).max(1500).default(400),
    }),
    opacity: z.number().min(0).max(100).default(90),
    alwaysOnTop: z.boolean().default(true),
    presentationMode: z.boolean().default(false),
    contentProtection: z.boolean().default(true), // Torna janela invisível no compartilhamento de tela
  }),
  hotkeys: z.object({
    toggleOverlay: z.string().default('CommandOrControl+Alt+O'),
    startStopSTT: z.string().default('CommandOrControl+Alt+C'),
    screenshot: z.string().default('CommandOrControl+Alt+S'),
    presentationMode: z.string().default('CommandOrControl+Alt+P'),
    panicMode: z.string().default('CommandOrControl+Alt+H'), // Botão de pânico
    textHighlight: z.string().default('Ctrl+E'),
    textHighlightClear: z.string().default('Escape'),
    // Ctrl+Shift+. (ponto). Usar "." ao invés de "Period" para compatibilidade com accelerator do Electron.
    pasteSttText: z.string().default('CommandOrControl+Shift+.'), // Colar texto STT em app externo
  }),
  stt: z.object({
    provider: z.enum(['sherpa', 'whisper', 'vosk']).default('whisper'),
    language: z.enum(['en', 'pt']).default('en'),
    modelPath: z.string().optional(),
  }),
  translate: z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(['argos', 'libre']).default('argos'),
    source: z.string().default('en'),
    target: z.string().default('pt'),
  }),
  screenshots: z.object({
    savePath: z.string().default(''),
    format: z.enum(['png', 'jpg']).default('png'),
    quality: z.number().min(0).max(100).default(90),
    ocrMode: z.enum(['local', 'ai']).default('local'),
    ocrCaptureMode: z.enum(['fullscreen', 'area']).default('fullscreen'),
    lastRegion: ScreenshotRegionSchema.nullable().default(null),
  }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

/**
 * Valores padrão para configuração
 */
export const defaultConfig: AppConfig = {
  overlay: {
    position: { x: 100, y: 100 },
    size: { width: 600, height: 400 },
    opacity: 90,
    alwaysOnTop: true,
    presentationMode: false,
    contentProtection: true, // Torna janela invisível no compartilhamento de tela
  },
  hotkeys: {
    toggleOverlay: 'CommandOrControl+Alt+O',
    startStopSTT: 'CommandOrControl+Alt+C',
    screenshot: 'CommandOrControl+Alt+S',
    presentationMode: 'CommandOrControl+Alt+P',
    panicMode: 'CommandOrControl+Alt+H', // Botão de pânico
    textHighlight: 'Ctrl+E',
    textHighlightClear: 'Escape',
    pasteSttText: 'CommandOrControl+Shift+.', // Colar texto STT em app externo
  },
  stt: {
    provider: 'whisper',
    language: 'en',
  },
  translate: {
    enabled: false,
    provider: 'argos',
    source: 'en',
    target: 'pt',
  },
  screenshots: {
    savePath: '',
    format: 'png',
    quality: 90,
    ocrMode: 'local',
    ocrCaptureMode: 'fullscreen',
    lastRegion: null,
  },
};
