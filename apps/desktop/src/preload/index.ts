import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

const sttApi = {
    start: (config?: any) => ipcRenderer.invoke('stt.start', config),
    stop: () => ipcRenderer.invoke('stt.stop'),
    getStatus: () => ipcRenderer.invoke('stt.getStatus'),
    getConfig: () => ipcRenderer.invoke('stt.getConfig'),
    updateConfig: (config: any) => ipcRenderer.invoke('stt.updateConfig', config),
    sendAudio: (chunk: ArrayBuffer) => ipcRenderer.send('stt.audio', { chunk }),
    onPartial: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('stt.partial', listener)
        return () => ipcRenderer.removeListener('stt.partial', listener)
    },
    onLevel: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('stt.level', listener)
        return () => ipcRenderer.removeListener('stt.level', listener)
    },
    onFinal: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('stt.final', listener)
        return () => ipcRenderer.removeListener('stt.final', listener)
    },
    onStatus: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('stt.status', listener)
        return () => ipcRenderer.removeListener('stt.status', listener)
    },
    onError: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('stt.error', listener)
        return () => ipcRenderer.removeListener('stt.error', listener)
    },
    onDebug: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('stt.debug', listener)
        return () => ipcRenderer.removeListener('stt.debug', listener)
    },
}

const modelApi = {
    listInstalled: () => ipcRenderer.invoke('models.listInstalled'),
    listCatalog: () => ipcRenderer.invoke('models.listCatalog'),
    install: (modelId: string) => ipcRenderer.invoke('models.install', modelId),
    remove: (modelId: string) => ipcRenderer.invoke('models.remove', modelId),
    import: (path: string, options?: { language?: string; label?: string }) =>
        ipcRenderer.invoke('models.import', { path, ...options }),
    setActive: (modelId: string) => ipcRenderer.invoke('models.setActive', modelId),
    getActive: () => ipcRenderer.invoke('models.getActive'),
    onInstallProgress: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('model.install.progress', listener)
        return () => ipcRenderer.removeListener('model.install.progress', listener)
    },
    onInstallDone: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('model.install.done', listener)
        return () => ipcRenderer.removeListener('model.install.done', listener)
    },
    onInstallError: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('model.install.error', listener)
        return () => ipcRenderer.removeListener('model.install.error', listener)
    },
}

const systemAudioApi = {
    listSources: () => ipcRenderer.invoke('systemAudio.listSources'),
    detectDefaultMonitor: () => ipcRenderer.invoke('systemAudio.detectDefaultMonitor'),
}

const recorderApi = {
    start: (options: any) => ipcRenderer.invoke('recorder.start', options),
    stop: () => ipcRenderer.invoke('recorder.stop'),
    getStatus: () => ipcRenderer.invoke('recorder.getStatus'),
    listRecent: (limit?: number) => ipcRenderer.invoke('recorder.listRecent', limit),
    delete: (path: string) => ipcRenderer.invoke('recorder.delete', path),
    getFileUrl: (path: string) => ipcRenderer.invoke('recorder.getFileUrl', path),
    openFolder: () => ipcRenderer.invoke('recorder.openFolder'),
    open: (path: string) => ipcRenderer.invoke('recorder.open', path),
    onStatus: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('recorder.status', listener)
        return () => ipcRenderer.removeListener('recorder.status', listener)
    },
    onError: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('recorder.error', listener)
        return () => ipcRenderer.removeListener('recorder.error', listener)
    },
    onLevel: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('recorder.level', listener)
        return () => ipcRenderer.removeListener('recorder.level', listener)
    },
}

const transcribeFileApi = {
    start: (payload: any) => ipcRenderer.invoke('transcribeFile.start', payload),
    saveSegments: (payload: any) => ipcRenderer.invoke('transcribeFile.saveSegments', payload),
    onProgress: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('transcribe.progress', listener)
        return () => ipcRenderer.removeListener('transcribe.progress', listener)
    },
    onDone: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('transcribe.done', listener)
        return () => ipcRenderer.removeListener('transcribe.done', listener)
    },
    onError: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('transcribe.error', listener)
        return () => ipcRenderer.removeListener('transcribe.error', listener)
    },
}

const systemSttApi = {
    start: (options: any) => ipcRenderer.invoke('systemStt.start', options),
    stop: () => ipcRenderer.invoke('systemStt.stop'),
    getStatus: () => ipcRenderer.invoke('systemStt.getStatus'),
    onPartial: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('systemStt.partial', listener)
        return () => ipcRenderer.removeListener('systemStt.partial', listener)
    },
    onFinal: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('systemStt.final', listener)
        return () => ipcRenderer.removeListener('systemStt.final', listener)
    },
    onStatus: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('systemStt.status', listener)
        return () => ipcRenderer.removeListener('systemStt.status', listener)
    },
    onError: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('systemStt.error', listener)
        return () => ipcRenderer.removeListener('systemStt.error', listener)
    },
    onDebug: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('systemStt.debug', listener)
        return () => ipcRenderer.removeListener('systemStt.debug', listener)
    },
    onLevel: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('systemStt.level', listener)
        return () => ipcRenderer.removeListener('systemStt.level', listener)
    },
}

const overlayApi = {
    setContentProtection: (enabled: boolean) => ipcRenderer.invoke('overlay:setContentProtection', enabled),
    getContentProtection: () => ipcRenderer.invoke('overlay:getContentProtection'),
    getDisplayCount: () => ipcRenderer.invoke('overlay:getDisplayCount'),
    moveToNextMonitor: () => ipcRenderer.invoke('overlay:moveToNextMonitor'),
}

const translationApi = {
    start: (options: any) => ipcRenderer.invoke('translation.start', options),
    stop: () => ipcRenderer.invoke('translation.stop'),
    refresh: () => ipcRenderer.invoke('translation.refresh'),
    getStatus: () => ipcRenderer.invoke('translation.getStatus'),
    onStatus: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('translation.status', listener)
        return () => ipcRenderer.removeListener('translation.status', listener)
    },
    onResult: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('translation.result', listener)
        return () => ipcRenderer.removeListener('translation.result', listener)
    },
    onError: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('translation.error', listener)
        return () => ipcRenderer.removeListener('translation.error', listener)
    },
}

const aiApi = {
    getConfig: () => ipcRenderer.invoke('ai.getConfig'),
    saveConfig: (config: any) => ipcRenderer.invoke('ai.saveConfig', config),
    listProviders: () => ipcRenderer.invoke('ai.listProviders'),
    listModels: (providerId: string) => ipcRenderer.invoke('ai.listModels', providerId),
    addKey: (providerId: string, key: string, alias: string) => ipcRenderer.invoke('ai.addKey', { providerId, key, alias }),
    removeKey: (keyId: number) => ipcRenderer.invoke('ai.removeKey', keyId),
    updateKeyStatus: (keyId: number, status: 'active' | 'cooldown' | 'disabled') => ipcRenderer.invoke('ai.updateKeyStatus', { keyId, status }),
    listKeys: (providerId?: string) => ipcRenderer.invoke('ai.listKeys', providerId),
    testKey: (keyId: number, providerId: string) => ipcRenderer.invoke('ai.testKey', { keyId, providerId }),
    analyzeScreenshot: (request: any) => ipcRenderer.invoke('ai.analyzeScreenshot', request),
    analyzeText: (request: any) => ipcRenderer.invoke('ai.analyzeText', request),
    extractText: (screenshotId: number) => ipcRenderer.invoke('ai.extractText', screenshotId),
    getSessions: (screenshotId: number) => ipcRenderer.invoke('ai.getSessions', screenshotId),
    getMessages: (sessionId: number) => ipcRenderer.invoke('ai.getMessages', sessionId),
    createSession: (screenshotId: number) => ipcRenderer.invoke('ai.createSession', screenshotId),
    savePromptTemplate: (template: any) => ipcRenderer.invoke('ai.savePromptTemplate', template),
    getPromptTemplates: (category?: string) => ipcRenderer.invoke('ai.getPromptTemplates', category),
    deletePromptTemplate: (id: number) => ipcRenderer.invoke('ai.deletePromptTemplate', id),
    onAnalysisStarted: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('ai.analysis.started', listener)
        return () => ipcRenderer.removeListener('ai.analysis.started', listener)
    },
    onAnalysisCompleted: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('ai.analysis.completed', listener)
        return () => ipcRenderer.removeListener('ai.analysis.completed', listener)
    },
    onAnalysisError: (cb: (event: any) => void) => {
        const listener = (_event: any, payload: any) => cb(payload)
        ipcRenderer.on('ai.analysis.error', listener)
        return () => ipcRenderer.removeListener('ai.analysis.error', listener)
    },
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', api)
        contextBridge.exposeInMainWorld('stt', sttApi)
        contextBridge.exposeInMainWorld('models', modelApi)
        contextBridge.exposeInMainWorld('systemAudio', systemAudioApi)
        contextBridge.exposeInMainWorld('recorder', recorderApi)
        contextBridge.exposeInMainWorld('transcribeFile', transcribeFileApi)
        contextBridge.exposeInMainWorld('systemStt', systemSttApi)
        contextBridge.exposeInMainWorld('overlay', overlayApi)
        contextBridge.exposeInMainWorld('translation', translationApi)
        contextBridge.exposeInMainWorld('ai', aiApi)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = electronAPI
    // @ts-ignore (define in dts)
    window.api = api
    // @ts-ignore (define in dts)
    window.stt = sttApi
    // @ts-ignore (define in dts)
    window.models = modelApi
    // @ts-ignore (define in dts)
    window.systemAudio = systemAudioApi
    // @ts-ignore (define in dts)
    window.recorder = recorderApi
    // @ts-ignore (define in dts)
    window.transcribeFile = transcribeFileApi
    // @ts-ignore (define in dts)
    window.systemStt = systemSttApi
    // @ts-ignore (define in dts)
    window.overlay = overlayApi
    // @ts-ignore (define in dts)
    window.translation = translationApi
    // @ts-ignore (define in dts)
    window.ai = aiApi
}
