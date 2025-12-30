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
      },
      {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        provider: 'gemini',
        supportsVision: true,
        maxTokens: 8192,
        supportsStreaming: false,
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

    const contents: any[] = req.messages
      .filter((m) => m.role !== 'system')
      .map((message) => {
        if (message.role === 'user' && message === lastUser) {
          return { role: 'user', parts };
        }
        return { role: message.role, parts: [{ text: message.content }] };
      });

    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: req.options?.temperature ?? 0.7,
        maxOutputTokens: req.options?.maxTokens ?? 2048,
      },
    };

    if (systemMessage) {
      requestBody.systemInstruction = {
        parts: [{ text: systemMessage }],
      };
    }

    const requestBodyJson = JSON.stringify(requestBody);
    const primary = await this.callGenerateContent('v1', modelName, apiKey, requestBodyJson);
    let response = primary.response;
    let responseText = primary.text;

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
    const contents = req.messages
      .filter((m) => m.role !== 'system')
      .map((message) => ({
        role: message.role,
        parts: [{ text: message.content }],
      }));

    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: req.options?.temperature ?? 0.7,
        maxOutputTokens: req.options?.maxTokens ?? 2048,
      },
    };

    if (systemMessage) {
      requestBody.systemInstruction = {
        parts: [{ text: systemMessage }],
      };
    }

    const requestBodyJson = JSON.stringify(requestBody);
    const primary = await this.callGenerateContent('v1', modelName, apiKey, requestBodyJson);
    let response = primary.response;
    let responseText = primary.text;

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
