import { ModelDescriptor } from '@neo/shared';

export const modelCatalog: ModelDescriptor[] = [
  {
    id: 'vosk-en-us-small-0.15',
    language: 'en-US',
    label: 'English (US) - Small',
    sizeMB: 50,
    accuracyHint: 'rapido',
    source: 'remote',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
    defaultSampleRate: 16000,
  },
  {
    id: 'vosk-en-us-0.22',
    language: 'en-US',
    label: 'English (US) - Large',
    sizeMB: 1800,
    accuracyHint: 'melhor',
    source: 'remote',
    url: 'https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip',
    defaultSampleRate: 16000,
  },
  {
    id: 'vosk-pt-br-small-0.3',
    language: 'pt-BR',
    label: 'Portugues (Brasil) - Small',
    sizeMB: 50,
    accuracyHint: 'rapido',
    source: 'remote',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip',
    defaultSampleRate: 16000,
  },
  {
    id: 'vosk-pt-br-0.3',
    language: 'pt-BR',
    label: 'Portugues (Brasil) - Large (FalaBrasil)',
    sizeMB: 1600,
    accuracyHint: 'melhor',
    source: 'remote',
    url: 'https://alphacephei.com/vosk/models/vosk-model-pt-fb-v0.1.1-20220516_2113.zip',
    defaultSampleRate: 16000,
  },
];
