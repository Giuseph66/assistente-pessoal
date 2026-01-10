import { BaseVisionProvider } from './BaseProvider';
import { VisionRequest, VisionResponse, ChatRequest, ModelInfo, AIProviderId } from '@ricky/shared';
import { getLogger } from '@ricky/logger';
import { getModelsForProvider } from '../modelCatalog';

const logger = getLogger();

/**
 * Provider para Google Gemini Vision API
 */
export class GeminiProvider extends BaseVisionProvider {
  id: AIProviderId = 'gemini';
  private baseUrl = 'https://generativelanguage.googleapis.com';

  async listModels(): Promise<ModelInfo[]> {
    const fallback: ModelInfo[] = [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'gemini',
        supportsVision: true,
        maxTokens: 8192,
        supportsStreaming: false,
        metadata: {
          category: 'Modelos de saida de texto',
        },
      },
      {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        provider: 'gemini',
        supportsVision: true,
        maxTokens: 8192,
        supportsStreaming: false,
        metadata: {
          category: 'Modelos de saida de texto',
        },
      },
      {
        id: 'gemini-2.5-flash-tts',
        name: 'Gemini 2.5 Flash TTS',
        provider: 'gemini',
        supportsVision: true,
        supportsStreaming: false,
        metadata: {
          category: 'Modelos generativos multimodais',
        },
      },
      {
        id: 'gemini-3-flash',
        name: 'Gemini 3 Flash',
        provider: 'gemini',
        supportsVision: true,
        supportsStreaming: false,
        metadata: {
          category: 'Modelos de saida de texto',
        },
      },
      {
        id: 'gemini-robotics-er-1.5-preview',
        name: 'Gemini Robotics ER 1.5 Preview',
        provider: 'gemini',
        supportsVision: false,
        supportsStreaming: false,
        metadata: {
          category: 'Outros modelos',
        },
      },
      {
        id: 'gemma-3-12b',
        name: 'Gemma 3 12B',
        provider: 'gemini',
        supportsVision: false,
        supportsStreaming: false,
        metadata: {
          category: 'Outros modelos',
        },
      },
      {
        id: 'gemma-3-1b',
        name: 'Gemma 3 1B',
        provider: 'gemini',
        supportsVision: false,
        supportsStreaming: false,
        metadata: {
          category: 'Outros modelos',
        },
      },
      {
        id: 'gemma-3-27b',
        name: 'Gemma 3 27B',
        provider: 'gemini',
        supportsVision: false,
        supportsStreaming: false,
        metadata: {
          category: 'Outros modelos',
        },
      },
      {
        id: 'gemma-3-2b',
        name: 'Gemma 3 2B',
        provider: 'gemini',
        supportsVision: false,
        supportsStreaming: false,
        metadata: {
          category: 'Outros modelos',
        },
      },
      {
        id: 'gemma-3-4b',
        name: 'Gemma 3 4B',
        provider: 'gemini',
        supportsVision: false,
        supportsStreaming: false,
        metadata: {
          category: 'Outros modelos',
        },
      },
      {
        id: 'gemini-2.5-flash-native-audio-dialog',
        name: 'Gemini 2.5 Flash Native Audio Dialog',
        provider: 'gemini',
        supportsVision: false,
        supportsStreaming: false,
        metadata: {
          category: 'API Live',
        },
      },
      {
        id: 'gemini-2.5-flash-native-audio-preview-12-2025',
        name: 'Gemini 2.5 Flash Native Audio Preview 12-2025',
        provider: 'gemini',
        supportsVision: false,
        supportsStreaming: false,
        metadata: {
          category: 'API Live (preview)',
        },
      },
      {
        id: 'gemini-live-2.5-flash-preview',
        name: 'Gemini Live 2.5 Flash Preview',
        provider: 'gemini',
        supportsVision: false,
        supportsStreaming: false,
        metadata: {
          category: 'API Live (preview)',
        },
      },
    ];

    return getModelsForProvider('gemini', fallback);
  }

  protected async analyzeImageInternal(
    req: VisionRequest,
    apiKey: string
  ): Promise<VisionResponse> {
    const rawModelName = req.options?.modelName || 'gemini-2.5-flash';
    const modelName = rawModelName.replace('-vision', '');
    
    // Converte imagem para base64 se necessário
    const imageBase64 = req.image.base64Raw || req.image.base64;
    if (!imageBase64) {
      throw new Error('Image base64 required');
    }
    const imageData = {
      base64: imageBase64,
      mimeType: req.image.mimeType,
    };

    // Constrói mensagens no formato Gemini
    const parts: any[] = [];
    
    // Adiciona imagem
    parts.push({
      inline_data: {
        mime_type: imageData.mimeType,
        data: imageData.base64,
      },
    });

    const userMessages = req.messages.filter((m) => m.role === 'user');
    const lastUser = userMessages[userMessages.length - 1];
    if (lastUser?.content) {
      parts.push({ text: lastUser.content });
    }

    const systemMessage = req.messages.find((m) => m.role === 'system')?.content;

    const isSystemInstructionError = (text: string) =>
      text.includes('systemInstruction') && text.includes('Unknown name');

    const buildContents = (injectSystemAsUser: boolean) => {
      const contents: any[] = req.messages
        .filter((m) => m.role !== 'system')
        .map((message) => {
          if (message.role === 'user' && message === lastUser) {
            const partsWithSystem = injectSystemAsUser && systemMessage
              ? [{ text: systemMessage }, ...parts]
              : parts;
            return { role: 'user', parts: partsWithSystem };
          }
          let role = message.role;
          if (role === 'assistant') {
            role = 'model';
          }
          return { role: role as 'user' | 'model', parts: [{ text: message.content }] };
        });

      if (injectSystemAsUser && systemMessage && contents.length > 0 && contents[0].role === 'user') {
        if (!contents[0].parts?.some((p: any) => p.text === systemMessage)) {
          contents[0].parts = [{ text: systemMessage }, ...(contents[0].parts || [])];
        }
      }

      return contents;
    };

    const buildRequestBody = (includeSystemInstruction: boolean, injectSystemAsUser: boolean) => {
      const requestBody: any = {
        contents: buildContents(injectSystemAsUser),
        generationConfig: {
          temperature: req.options?.temperature ?? 0.7,
          maxOutputTokens: req.options?.maxTokens ?? 2048,
        },
      };

      if (includeSystemInstruction && systemMessage) {
        requestBody.systemInstruction = {
          parts: [{ text: systemMessage }],
        };
      }

      return requestBody;
    };

    let requestBody = buildRequestBody(true, false);
    let requestBodyJson = JSON.stringify(requestBody);
    let primary = await this.callGenerateContent('v1', modelName, apiKey, requestBodyJson);
    let response = primary.response;
    let responseText = primary.text;

    if (!response.ok && isSystemInstructionError(responseText)) {
      requestBody = buildRequestBody(false, true);
      requestBodyJson = JSON.stringify(requestBody);
      primary = await this.callGenerateContent('v1', modelName, apiKey, requestBodyJson);
      response = primary.response;
      responseText = primary.text;
    }

    if (!response.ok && this.shouldRetryOnBeta(response.status, responseText)) {
      const fallback = await this.callGenerateContent('v1beta', modelName, apiKey, requestBodyJson);
      response = fallback.response;
      responseText = fallback.text;
    }

    if (!response.ok) {
      logger.error(
        { status: response.status, error: responseText },
        'Gemini API error'
      );

      throw new Error(`Gemini API error: ${response.status} - ${this.sanitizeError({ message: responseText })}`);
    }

    const data = responseText ? JSON.parse(responseText) : await response.json();

    // Extrai resposta do Gemini
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('No response from Gemini');
    }

    const content = candidate.content?.parts?.[0]?.text || '';
    
    // Tenta extrair texto reconhecido (se houver)
    const recognizedText = this.extractRecognizedText(data);

    return {
      recognizedText,
      answerText: content,
      raw: data,
      usage: {
        tokensIn: data.usageMetadata?.promptTokenCount,
        tokensOut: data.usageMetadata?.candidatesTokenCount,
      },
      modelUsed: modelName,
      providerUsed: 'gemini',
    };
  }

  protected async analyzeTextInternal(
    req: ChatRequest,
    apiKey: string
  ): Promise<VisionResponse> {
    const rawModelName = req.options?.modelName || 'gemini-2.5-flash';
    const modelName = rawModelName.replace('-vision', '');

    const systemMessage = req.messages.find((m) => m.role === 'system')?.content;
    const isSystemInstructionError = (text: string) =>
      text.includes('systemInstruction') && text.includes('Unknown name');

    const buildContents = (injectSystemAsUser: boolean) => {
      const contents = req.messages
        .filter((m) => m.role !== 'system')
        .map((message) => {
          let role = message.role;
          if (role === 'assistant') {
            role = 'model';
          }
          return {
            role: role as 'user' | 'model',
            parts: [{ text: message.content }],
          };
        });

      if (injectSystemAsUser && systemMessage) {
        if (contents.length > 0 && contents[0].role === 'user') {
          contents[0].parts = [{ text: systemMessage }, ...(contents[0].parts || [])];
        } else {
          contents.unshift({ role: 'user', parts: [{ text: systemMessage }] });
        }
      }

      return contents;
    };

    const buildRequestBody = (includeSystemInstruction: boolean, injectSystemAsUser: boolean) => {
      const requestBody: any = {
        contents: buildContents(injectSystemAsUser),
        generationConfig: {
          temperature: req.options?.temperature ?? 0.7,
          maxOutputTokens: req.options?.maxTokens ?? 2048,
        },
      };

      if (includeSystemInstruction && systemMessage) {
        requestBody.systemInstruction = {
          parts: [{ text: systemMessage }],
        };
      }

      return requestBody;
    };

    let requestBody = buildRequestBody(true, false);
    let requestBodyJson = JSON.stringify(requestBody);
    let primary = await this.callGenerateContent('v1', modelName, apiKey, requestBodyJson);
    let response = primary.response;
    let responseText = primary.text;

    if (!response.ok && isSystemInstructionError(responseText)) {
      requestBody = buildRequestBody(false, true);
      requestBodyJson = JSON.stringify(requestBody);
      primary = await this.callGenerateContent('v1', modelName, apiKey, requestBodyJson);
      response = primary.response;
      responseText = primary.text;
    }

    if (!response.ok && this.shouldRetryOnBeta(response.status, responseText)) {
      const fallback = await this.callGenerateContent('v1beta', modelName, apiKey, requestBodyJson);
      response = fallback.response;
      responseText = fallback.text;
    }

    if (!response.ok) {
      logger.error(
        { status: response.status, error: responseText },
        'Gemini API error'
      );

      throw new Error(`Gemini API error: ${response.status} - ${this.sanitizeError({ message: responseText })}`);
    }

    const data = responseText ? JSON.parse(responseText) : await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('No response from Gemini');
    }

    const content = candidate.content?.parts?.[0]?.text || '';
    const recognizedText = this.extractRecognizedText(data);

    return {
      recognizedText,
      answerText: content,
      raw: data,
      usage: {
        tokensIn: data.usageMetadata?.promptTokenCount,
        tokensOut: data.usageMetadata?.candidatesTokenCount,
      },
      modelUsed: modelName,
      providerUsed: 'gemini',
    };
  }

  private async callGenerateContent(
    apiVersion: 'v1' | 'v1beta',
    modelName: string,
    apiKey: string,
    body: string
  ): Promise<{ response: Response; text: string }> {
    const url = `${this.baseUrl}/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;

    logger.debug({ model: modelName, apiVersion, url: url.replace(apiKey, '***') }, 'Calling Gemini API');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    const text = await response.text().catch(() => '');
    return { response, text };
  }

  private shouldRetryOnBeta(status: number, message: string): boolean {
    if (status !== 404) return false;
    const normalized = message.toLowerCase();
    return normalized.includes('api version v1') || normalized.includes('not found');
  }

  /**
   * Tenta extrair texto reconhecido da resposta (OCR)
   */
  private extractRecognizedText(data: any): string | undefined {
    // Gemini pode retornar texto extraído em diferentes formatos
    // Por enquanto, retornamos undefined e deixamos o modelo fazer OCR
    // Futuramente, podemos usar a API de OCR específica se necessário
    return undefined;
  }
}
