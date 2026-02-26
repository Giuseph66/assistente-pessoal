import { safeStorage } from 'electron';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { getLogger } from '@neo/logger';
import { app } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const logger = getLogger();

/**
 * Gerenciador de criptografia para API keys
 * Usa safeStorage do Electron quando disponível, fallback para AES-GCM
 */
export class KeyStorage {
  private encryptionKey: Buffer | null = null;
  private useSafeStorage: boolean;

  constructor() {
    // Verifica se safeStorage está disponível
    this.useSafeStorage = safeStorage.isEncryptionAvailable();

    if (!this.useSafeStorage) {
      logger.warn('safeStorage not available, using fallback encryption');
      this.initializeFallbackKey();
    }
  }

  /**
   * Inicializa chave de criptografia para fallback
   */
  private initializeFallbackKey(): void {
    const keyPath = join(app.getPath('userData'), '.encryption_key');

    if (existsSync(keyPath)) {
      try {
        this.encryptionKey = Buffer.from(readFileSync(keyPath, 'utf-8'), 'hex');
      } catch (error) {
        logger.error({ err: error }, 'Failed to load encryption key');
        this.generateNewKey(keyPath);
      }
    } else {
      this.generateNewKey(keyPath);
    }
  }

  /**
   * Gera nova chave de criptografia
   */
  private generateNewKey(keyPath: string): void {
    // Gera chave derivada do app path + salt fixo
    const salt = Buffer.from('ricky-ai-encryption-salt-v1', 'utf-8');
    const appPath = app.getPath('userData');
    this.encryptionKey = scryptSync(appPath, salt, 32);

    try {
      const keyDir = join(keyPath, '..');
      if (!existsSync(keyDir)) {
        mkdirSync(keyDir, { recursive: true });
      }
      writeFileSync(keyPath, this.encryptionKey.toString('hex'), { mode: 0o600 });
    } catch (error) {
      logger.error({ err: error }, 'Failed to save encryption key');
    }
  }

  /**
   * Criptografa uma API key
   */
  encrypt(plaintext: string): string {
    if (this.useSafeStorage) {
      try {
        const buffer = safeStorage.encryptString(plaintext);
        // Retorna como string hex para evitar problemas de serialização em JSON/SQLite
        return buffer.toString('hex');
      } catch (error) {
        logger.error({ err: error }, 'Failed to encrypt with safeStorage');
        throw error;
      }
    }

    // Fallback: AES-256-GCM
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const iv = randomBytes(12); // 96 bits para GCM
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Formato: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Descriptografa uma API key
   */
  decrypt(ciphertext: string): string {
    if (this.useSafeStorage) {
      try {
        // Tenta limpar casos onde o JSON serializou um Buffer incorretamente como "[object Object]"
        if (typeof ciphertext !== 'string') {
          throw new Error('Ciphertext is not a string');
        }

        // Se a string contiver apenas caracteres hexadecimais, converte de volta para Buffer
        // (Isso é para nossa nova implementação)
        if (/^[0-9a-fA-F]+$/.test(ciphertext) && ciphertext.length % 2 === 0) {
          const buffer = Buffer.from(ciphertext, 'hex');
          return safeStorage.decryptString(buffer);
        }

        // Tenta descriptografar direto se for base64 ou formato antigo em memória
        // O TS reclama que decryptString requer um Buffer, mas a documentação antiga permitia string.
        // O correto é sempre passar um Buffer.
        const buffer = Buffer.from(ciphertext, 'utf8');
        return safeStorage.decryptString(buffer);
      } catch (error) {
        logger.error({ err: error }, 'Failed to decrypt with safeStorage');
        throw error;
      }
    }

    // Fallback: AES-256-GCM
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
  }

  /**
   * Extrai os últimos 4 caracteres de uma key (para exibição)
   */
  getLast4(key: string): string {
    if (key.length <= 4) {
      return key;
    }
    return key.slice(-4);
  }

  /**
   * Verifica se a criptografia está disponível
   */
  isEncryptionAvailable(): boolean {
    return this.useSafeStorage || this.encryptionKey !== null;
  }
}


