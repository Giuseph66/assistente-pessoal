export interface TranslateProvider {
  isAvailable(): Promise<boolean>;
  translate(text: string, fromLang: string, toLang: string): Promise<string>;
  translateBatch?(
    texts: string[],
    fromLang: string,
    toLang: string
  ): Promise<string[]>;
  getName(): string;
}
