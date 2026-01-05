import { BaseVisionProvider } from './BaseProvider';
import { VisionRequest, VisionResponse, ChatRequest, ModelInfo, AIProviderId } from '@ricky/shared';
import { getLogger } from '@ricky/logger';
import { getModelsForProvider } from '../modelCatalog';

const logger = getLogger();

/**
 * Provider para OpenAI Vision API
 */
export class OpenAIProvider extends BaseVisionProvider {
  id: AIProviderId = 'openai';
  private baseUrl = 'https://api.openai.com/v1';

  async listModels(): Promise<ModelInfo[]> {
    const fallback: ModelInfo[] = [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        supportsVision: true,
        maxTokens: 4096,
        supportsStreaming: false,
      },
    ];

    return getModelsForProvider('openai', fallback);
  }

  protected async analyzeImageInternal(
    req: VisionRequest,
    apiKey: string
  ): Promise<VisionResponse> {
    const modelName = req.options?.modelName || 'gpt-4o';
    
    // Converte imagem para base64 se necessário
    let imageUrl: string;
    if (req.image.base64DataUrl) {
      imageUrl = req.image.base64DataUrl;
    } else if (req.image.base64Raw || req.image.base64) {
      const raw = req.image.base64Raw || req.image.base64;
      imageUrl = `data:${req.image.mimeType};base64,${raw}`;
    } else {
      throw new Error('Image base64 required');
    }

    // Constrói mensagens no formato OpenAI
    const messages: any[] = [];

    // System message (se houver)
    const systemMessage = req.messages.find((m) => m.role === 'system')?.content;
    if (systemMessage) {
      messages.push({
        role: 'system',
        content: systemMessage,
      });
    }

    const userMessages = req.messages.filter((m) => m.role === 'user');
    const lastUser = userMessages[userMessages.length - 1];
    const otherMessages = req.messages.filter((m) => m.role !== 'system');
    otherMessages.forEach((message) => {
      if (message.role === 'user' && message === lastUser) {
        messages.push({
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
              },
            },
            {
              type: 'text',
              text: lastUser?.content || '',
            },
          ],
        });
      } else {
        messages.push({
          role: message.role,
          content: message.content,
        });
      }
    });

    const maxTokens = this.normalizeMaxTokens(req.options?.maxTokens);
    const requestBody: any = {
      model: modelName,
      messages,
      temperature: req.options?.temperature ?? 0.7,
    };
    if (typeof maxTokens === 'number') {
      requestBody.max_tokens = maxTokens;
    }

    const url = `${this.baseUrl}/chat/completions`;

    logger.debug({ model: modelName }, 'Calling OpenAI API');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      const errorMessage = errorData.error?.message || 'Unknown error';
      
      logger.error(
        { status: response.status, error: errorMessage },
        'OpenAI API error'
      );
      
      // Mapeia códigos de erro
      const error: any = new Error(`OpenAI API error: ${response.status} - ${this.sanitizeError({ message: errorMessage })}`);
      error.statusCode = response.status;
      error.code = errorData.error?.code || 'API_ERROR';
      throw error;
    }

    const data = await response.json();

    // Extrai resposta do OpenAI
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No response from OpenAI');
    }

    const content = choice.message?.content || '';
    
    // OpenAI não retorna texto reconhecido separadamente, mas pode estar na resposta
    const recognizedText = this.extractRecognizedText(content);

    return {
      recognizedText,
      answerText: content,
      raw: data,
      usage: {
        tokensIn: data.usage?.prompt_tokens,
        tokensOut: data.usage?.completion_tokens,
      },
      modelUsed: modelName,
      providerUsed: 'openai',
    };
  }

  protected async analyzeTextInternal(
    req: ChatRequest,
    apiKey: string
  ): Promise<VisionResponse> {
    const modelName = req.options?.modelName || 'gpt-4o';

    const messages: any[] = [];
    const systemMessage = req.messages.find((m) => m.role === 'system')?.content;
    if (systemMessage) {
      messages.push({
        role: 'system',
        content: systemMessage,
      });
    }

    req.messages
      .filter((m) => m.role !== 'system')
      .forEach((message) => {
        messages.push({
          role: message.role,
          content: message.content,
        });
      });

    const maxTokens = this.normalizeMaxTokens(req.options?.maxTokens);
    const requestBody: any = {
      model: modelName,
      messages,
      temperature: req.options?.temperature ?? 0.7,
    };
    if (typeof maxTokens === 'number') {
      requestBody.max_tokens = maxTokens;
    }

    const url = `${this.baseUrl}/chat/completions`;

    logger.debug({ model: modelName }, 'Calling OpenAI API (text)');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      const errorMessage = errorData.error?.message || 'Unknown error';

      logger.error(
        { status: response.status, error: errorMessage },
        'OpenAI API error'
      );

      const error: any = new Error(`OpenAI API error: ${response.status} - ${this.sanitizeError({ message: errorMessage })}`);
      error.statusCode = response.status;
      error.code = errorData.error?.code || 'API_ERROR';
      throw error;
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No response from OpenAI');
    }

    const content = choice.message?.content || '';
    const recognizedText = this.extractRecognizedText(content);

    return {
      recognizedText,
      answerText: content,
      raw: data,
      usage: {
        tokensIn: data.usage?.prompt_tokens,
        tokensOut: data.usage?.completion_tokens,
      },
      modelUsed: modelName,
      providerUsed: 'openai',
    };
  }

  /**
   * Tenta extrair texto reconhecido da resposta (OCR)
   */
  private extractRecognizedText(content: string): string | undefined {
    // Se a resposta começa com algo como "Texto extraído:" ou similar, podemos tentar extrair
    // Por enquanto, retornamos undefined e deixamos o modelo fazer OCR
    return undefined;
  }

  private normalizeMaxTokens(maxTokens?: number): number | undefined {
    if (typeof maxTokens === 'number' && Number.isFinite(maxTokens) && maxTokens > 0) {
      return Math.floor(maxTokens);
    }
    return undefined;
  }
}
