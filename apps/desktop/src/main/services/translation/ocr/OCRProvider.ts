import { OCRBlock } from '@neo/shared';

export type OCRRequest = {
  imagePath: string;
  lang: string;
  minConfidence?: number;
  minTextLength?: number;
};

export interface OCRProvider {
  isAvailable(): Promise<boolean>;
  recognize(request: OCRRequest): Promise<OCRBlock[]>;
  getName(): string;
}
