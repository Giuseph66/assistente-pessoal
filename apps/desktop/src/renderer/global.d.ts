import {
  STTConfig,
  STTFinalEvent,
  STTPartialEvent,
  STTStatus,
  ModelDescriptor,
  InstalledModel,
  SystemAudioSourceInfo,
  RecorderStartOptions,
  RecorderStatus,
  RecordingEntry,
  SubtitleSegment,
  TranscribeFileRequest,
  TranscribeProgress,
  TranscribeDone,
  TranslationStartOptions,
  TranslationResult,
  TranslationStatus,
  AIConfig,
  AnalyzeScreenshotRequest,
  AnalyzeScreenshotResponse,
  AnalyzeChatRequest,
  AnalyzeChatResponse,
  PromptTemplate,
  TextHighlightBox,
  AutomationConfig,
  MappingPoint,
  ImageTemplate,
  Workflow,
  ExecutionStatus,
  AutomationAction,
  WorkflowGraph,
  FlowExecutionStatus,
  FlowExecutionNodeStartedEvent,
  FlowExecutionNodeFinishedEvent,
} from '@ricky/shared';

declare global {
  interface Window {
    stt: {
      start: (config?: STTConfig) => Promise<boolean>;
      stop: () => Promise<boolean>;
      getStatus: () => Promise<STTStatus>;
      getConfig: () => Promise<STTConfig>;
      updateConfig: (config: Partial<STTConfig>) => Promise<STTConfig>;
      sendAudio: (chunk: ArrayBuffer) => void;
      onPartial: (cb: (event: STTPartialEvent) => void) => () => void;
      onLevel: (cb: (event: { level: number; rms: number; ts: number }) => void) => () => void;
      onFinal: (cb: (event: STTFinalEvent) => void) => () => void;
      onStatus: (cb: (event: STTStatus) => void) => () => void;
      onError: (cb: (event: { message: string; debug?: string; providerId?: string; ts: number }) => void) => () => void;
      onDebug: (cb: (event: { message: string; ts: number }) => void) => () => void;
    };
    models: {
      listInstalled: () => Promise<InstalledModel[]>;
      listCatalog: () => Promise<ModelDescriptor[]>;
      install: (modelId: string) => Promise<InstalledModel>;
      remove: (modelId: string) => Promise<void>;
      import: (path: string, options?: { language?: string; label?: string }) => Promise<InstalledModel>;
      setActive: (modelId: string) => Promise<void>;
      getActive: () => Promise<string>;
      onInstallProgress: (cb: (event: { modelId: string; progress: number }) => void) => () => void;
      onInstallDone: (cb: (event: { modelId: string; installPath: string }) => void) => () => void;
      onInstallError: (cb: (event: { modelId: string; message: string }) => void) => () => void;
    };
    systemAudio: {
      listSources: () => Promise<SystemAudioSourceInfo[]>;
      detectDefaultMonitor: () => Promise<string | null>;
    };
    recorder: {
      start: (options: RecorderStartOptions) => Promise<RecorderStatus>;
      stop: () => Promise<RecorderStatus>;
      getStatus: () => Promise<RecorderStatus>;
      listRecent: (limit?: number) => Promise<RecordingEntry[]>;
      delete: (path: string) => Promise<void>;
      getFileUrl: (path: string) => Promise<string>;
      openFolder: () => Promise<void>;
      open: (path: string) => Promise<void>;
      onStatus: (cb: (event: RecorderStatus) => void) => () => void;
      onError: (cb: (event: { message: string }) => void) => () => void;
      onLevel: (cb: (event: { level: number; rms: number; ts: number }) => void) => () => void;
    };
    transcribeFile: {
      start: (payload: TranscribeFileRequest) => Promise<{
        segments: SubtitleSegment[];
        vttPath?: string;
        srtPath?: string;
      }>;
      saveSegments: (payload: { wavPath: string; segments: SubtitleSegment[] }) => Promise<TranscribeDone>;
      onProgress: (cb: (event: TranscribeProgress & { wavPath?: string }) => void) => () => void;
      onDone: (cb: (event: TranscribeDone & { wavPath?: string }) => void) => () => void;
      onError: (cb: (event: { message: string }) => void) => () => void;
    };
    systemStt: {
      start: (options: { sourceId: string }) => Promise<boolean>;
      stop: () => Promise<boolean>;
      getStatus: () => Promise<STTStatus>;
      onPartial: (cb: (event: STTPartialEvent) => void) => () => void;
      onFinal: (cb: (event: STTFinalEvent) => void) => () => void;
      onStatus: (cb: (event: STTStatus) => void) => () => void;
      onError: (cb: (event: { message: string; debug?: string; providerId?: string; ts: number }) => void) => () => void;
      onDebug: (cb: (event: { message: string; ts: number }) => void) => () => void;
      onLevel: (cb: (event: { level: number; rms: number; ts: number }) => void) => () => void;
    };
    ai: {
      getConfig: () => Promise<AIConfig>;
      saveConfig: (config: Partial<AIConfig>) => Promise<AIConfig>;
      listProviders: () => Promise<Array<{ id: string; name: string }>>;
      listModels: (providerId: string) => Promise<Array<{ id: string; name: string; provider: string; supportsVision: boolean; maxTokens?: number; supportsStreaming?: boolean }>>;
      addKey: (providerId: string, key: string, alias: string) => Promise<{ success: boolean; keyId: number }>;
      removeKey: (keyId: number) => Promise<{ success: boolean }>;
      updateKeyStatus: (keyId: number, status: 'active' | 'cooldown' | 'disabled') => Promise<{ success: boolean }>;
      listKeys: (providerId?: string) => Promise<Array<{ id: number; providerId: string; alias: string; last4: string; status: string; cooldownUntil?: number; successCount: number; failureCount: number; lastErrorCode?: string; lastUsedAt?: number }>>;
      testKey: (keyId: number, providerId: string) => Promise<{ success: boolean; error?: string }>;
      analyzeScreenshot: (request: AnalyzeScreenshotRequest) => Promise<AnalyzeScreenshotResponse>;
      analyzeText: (request: AnalyzeChatRequest) => Promise<AnalyzeChatResponse>;
      extractText: (screenshotId: number) => Promise<{ success: boolean; text?: string; error?: string }>;
      getSessions: (screenshotId: number) => Promise<Array<{ id: number; screenshotId: number | null; providerId: string; modelName: string; createdAt: number }>>;
      getMessages: (sessionId: number) => Promise<Array<{ id: number; sessionId: number; role: string; content: string; recognizedText?: string; createdAt: number }>>;
      createSession: (screenshotId: number) => Promise<{ sessionId: number }>;
      savePromptTemplate: (template: Omit<PromptTemplate, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; id: number }>;
      getPromptTemplates: (category?: string) => Promise<Array<{ id: number; name: string; promptText: string; category?: string; createdAt: number; updatedAt: number }>>;
      deletePromptTemplate: (id: number) => Promise<{ success: boolean }>;
      getActivePersonality: () => Promise<{ promptId: number } | null>;
      onAnalysisStarted: (cb: (event: { mode: 'screenshot' | 'chat'; screenshotId?: number; sessionId?: number; startedAt?: number; timeoutMs?: number; prompt?: string }) => void) => () => void;
      onAnalysisCompleted: (cb: (event: { mode: 'screenshot' | 'chat'; screenshotId?: number; sessionId?: number; success: boolean; usage?: { tokensIn?: number; tokensOut?: number }; model?: string; provider?: string }) => void) => () => void;
      onAnalysisError: (cb: (event: { mode: 'screenshot' | 'chat'; screenshotId?: number; sessionId?: number; error: string }) => void) => () => void;
    };
    translation: {
      start: (options: TranslationStartOptions) => Promise<{ success: boolean }>;
      prepareSelection: (options: TranslationStartOptions) => Promise<{ success: boolean }>;
      cancelSelection: () => Promise<{ success: boolean }>;
      stop: () => Promise<{ success: boolean }>;
      refresh: () => Promise<{ success: boolean }>;
      getStatus: () => Promise<TranslationStatus>;
      getOptions: () => Promise<TranslationStartOptions | null>;
      setOverlayVisible: (visible: boolean) => Promise<{ success: boolean }>;
      onStatus: (cb: (event: TranslationStatus) => void) => () => void;
      onResult: (cb: (event: TranslationResult) => void) => () => void;
      onError: (cb: (event: { message: string }) => void) => () => void;
      onSelectRegion: (cb: (event: TranslationStartOptions) => void) => () => void;
      onOptions: (cb: (event: TranslationStartOptions) => void) => () => void;
    };
    overlay: {
      setContentProtection: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
      getContentProtection: () => Promise<{
        enabled: boolean;
        platform: string;
        supportsContentProtection: boolean;
        usingWorkarounds: boolean;
      }>;
      getDisplayCount: () => Promise<{ count: number }>;
      moveToNextMonitor: () => Promise<{ success: boolean; error?: string }>;
    };
    textHighlightAPI: {
      onBoxes: (cb: (payload: { boxes: TextHighlightBox[]; ttlMs?: number }) => void) => () => void;
      onClear: (cb: () => void) => () => void;
      onLoading: (cb: (payload: { loading: boolean }) => void) => () => void;
      onTranscription: (cb: (payload: { text: string; mode: 'local' | 'ai'; createdAt: number }) => void) => () => void;
      getLastTranscription: () => Promise<{ text: string; mode: 'local' | 'ai'; createdAt: number } | null>;
      getMode: () => Promise<{ mode: 'local' | 'ai' }>;
      setMode: (mode: 'local' | 'ai') => Promise<{ mode: 'local' | 'ai' }>;
      getCaptureMode: () => Promise<{ mode: 'fullscreen' | 'area' }>;
      setCaptureMode: (mode: 'fullscreen' | 'area') => Promise<{ mode: 'fullscreen' | 'area' }>;
    };
    automation: {
      getConfig: () => Promise<AutomationConfig>;
      saveConfig: (config: Partial<AutomationConfig>) => Promise<AutomationConfig>;
      startMappingMode: () => Promise<{ success: boolean }>;
      stopMappingMode: () => Promise<{ success: boolean }>;
      isMappingMode: () => Promise<boolean>;
      recordClick: (x: number, y: number, name: string, type?: string) => Promise<MappingPoint>;
      captureTemplate: (name: string, region?: { x: number; y: number; width: number; height: number }) => Promise<ImageTemplate>;
      captureTemplateInteractive: () => Promise<{ success: boolean; path?: string; region?: { x: number; y: number; width: number; height: number }; error?: string }>;
      listMappings: () => Promise<{ points: MappingPoint[]; templates: ImageTemplate[] }>;
      getMappingPoint: (id: string) => Promise<MappingPoint | undefined>;
      updateMappingPoint: (id: string, updates: Partial<Omit<MappingPoint, 'id' | 'createdAt'>>) => Promise<MappingPoint | null>;
      deleteMapping: (id: string, type: 'point' | 'template') => Promise<{ success: boolean }>;
      getImageTemplate: (id: string) => Promise<ImageTemplate | undefined>;
      importImageTemplate: (name: string, dataUrl: string) => Promise<ImageTemplate>;
      updateImageTemplate: (id: string, updates: Partial<Omit<ImageTemplate, 'id' | 'createdAt'>>) => Promise<ImageTemplate | null>;
      resizeImageTemplate: (id: string, size: { width?: number; height?: number; keepAspect?: boolean }) => Promise<ImageTemplate | null>;
      replaceImageTemplate: (id: string, dataUrl: string) => Promise<ImageTemplate | null>;
      cropImageTemplate: (id: string, rect: { x: number; y: number; width: number; height: number }) => Promise<ImageTemplate | null>;
      findTemplateOnScreen: (templateName: string, confidence?: number, timeout?: number) => Promise<{ x: number; y: number; width: number; height: number } | null>;
      createWorkflow: (workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Workflow>;
      updateWorkflow: (id: string, workflow: Partial<Omit<Workflow, 'id' | 'createdAt'>>) => Promise<Workflow | null>;
      deleteWorkflow: (id: string) => Promise<boolean>;
      listWorkflows: () => Promise<Workflow[]>;
      getWorkflow: (id: string) => Promise<Workflow | undefined>;
      executeWorkflow: (workflowId: string) => Promise<{ success: boolean; error?: string }>;
      pauseExecution: () => Promise<{ success: boolean }>;
      resumeExecution: () => Promise<{ success: boolean }>;
      stopExecution: () => Promise<{ success: boolean }>;
      getExecutionStatus: () => Promise<ExecutionStatus>;
      testAction: (action: AutomationAction) => Promise<{ success: boolean; error?: string }>;
      getMousePosition: () => Promise<{ x: number; y: number }>;
      getScreenSize: () => Promise<{ width: number; height: number }>;
      onExecutionStarted: (cb: (event: any) => void) => () => void;
      onExecutionCompleted: (cb: (event: any) => void) => () => void;
      onExecutionError: (cb: (event: any) => void) => () => void;
      onExecutionProgress: (cb: (event: any) => void) => () => void;
      onExecutionStatus: (cb: (status: ExecutionStatus) => void) => () => void;
      onMappingModeChanged: (cb: (event: { active: boolean }) => void) => () => void;
      onMappingPointAdded: (cb: (point: MappingPoint) => void) => () => void;
      onTemplateAdded: (cb: (template: ImageTemplate) => void) => () => void;
      onTemplateUpdated: (cb: (template: ImageTemplate) => void) => () => void;
      onTemplateDeleted: (cb: (data: { id: string }) => void) => () => void;
      onPointCaptured: (cb: (data: { x: number; y: number }) => void) => (() => void) | undefined;
      onTemplateCaptured: (cb: (data: { region: { x: number; y: number; width: number; height: number }; screenshotPath?: string }) => void) => (() => void) | undefined;
      onMappingError: (cb: (data: { message: string }) => void) => (() => void) | undefined;
      recordPointFromHotkey: (x: number, y: number, name: string, type?: string) => Promise<MappingPoint>;
      recordTemplateFromHotkey: (name: string, region: { x: number; y: number; width: number; height: number }, screenshotPath?: string) => Promise<ImageTemplate>;
      onWorkflowCreated: (cb: (workflow: Workflow) => void) => () => void;
      flow: {
        listWorkflows: () => Promise<WorkflowGraph[]>;
        getWorkflow: (id: string) => Promise<WorkflowGraph | undefined>;
        saveWorkflow: (graph: WorkflowGraph) => Promise<WorkflowGraph>;
        deleteWorkflow: (id: string) => Promise<boolean>;
        validateWorkflow: (graph: WorkflowGraph) => Promise<{ errors: any[]; warnings: any[] }>;
        runWorkflow: (id: string) => Promise<{ success: boolean; error?: string }>;
        pause: () => Promise<{ success: boolean }>;
        resume: () => Promise<{ success: boolean }>;
        stop: () => Promise<{ success: boolean }>;
        getExecutionStatus: () => Promise<FlowExecutionStatus>;
        onStatus: (cb: (status: FlowExecutionStatus) => void) => () => void;
        onNodeStarted: (cb: (data: FlowExecutionNodeStartedEvent) => void) => () => void;
        onNodeFinished: (cb: (data: FlowExecutionNodeFinishedEvent) => void) => () => void;
      };
    };
    electron: {
      ipcRenderer: {
        send: (channel: string, ...args: any[]) => void;
        on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
        once: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
        removeListener: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
        invoke: (channel: string, ...args: any[]) => Promise<any>;
      };
    };
  }
}

export { };
