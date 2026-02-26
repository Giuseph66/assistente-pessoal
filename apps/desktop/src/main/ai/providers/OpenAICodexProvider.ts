import { OpenAIProvider } from './OpenAIProvider';

export class OpenAICodexProvider extends OpenAIProvider {
  constructor() {
    super({
      id: 'openai-codex',
      transport: 'codex',
    });
  }
}
