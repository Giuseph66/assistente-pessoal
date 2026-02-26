import { ModelInfo, VisionRequest, VisionResponse, ChatRequest, AIProviderId } from '@neo/shared';

/**
 * Interface base para providers de visão computacional
 */
export interface VisionProvider {
  id: AIProviderId;
  listModels(): Promise<ModelInfo[]>;
  analyzeImage(req: VisionRequest, apiKey: string): Promise<VisionResponse>;
  analyzeText(req: ChatRequest, apiKey: string): Promise<VisionResponse>;
}

