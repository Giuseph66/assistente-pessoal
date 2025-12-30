export class TranslationCache {
  private cache = new Map<string, string>();

  get(from: string, to: string, text: string): string | undefined {
    return this.cache.get(this.makeKey(from, to, text));
  }

  set(from: string, to: string, text: string, translated: string): void {
    this.cache.set(this.makeKey(from, to, text), translated);
  }

  clear(): void {
    this.cache.clear();
  }

  private makeKey(from: string, to: string, text: string): string {
    return `${from}|${to}|${text}`;
  }
}
