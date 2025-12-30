import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { TranslateProvider } from './TranslateProvider';

export class ArgosProvider implements TranslateProvider {
  private pythonPath: string | null = null;

  async isAvailable(): Promise<boolean> {
    const python = await this.findPython();
    if (!python) return false;
    return this.hasArgos(python);
  }

  getName(): string {
    return 'argos-translate';
  }

  async translate(text: string, fromLang: string, toLang: string): Promise<string> {
    const results = await this.translateBatch([text], fromLang, toLang);
    return results[0] || '';
  }

  async translateBatch(texts: string[], fromLang: string, toLang: string): Promise<string[]> {
    const python = await this.findPython();
    if (!python) {
      throw new Error('Python nao encontrado para Argos Translate.');
    }

    const hasArgos = await this.hasArgos(python);
    if (!hasArgos) {
      throw new Error('Argos Translate nao instalado. Rode: pip install argostranslate');
    }

    const normalizedFrom = this.normalizeLang(fromLang);
    const normalizedTo = this.normalizeLang(toLang);

    const payload = JSON.stringify({
      texts,
      from: normalizedFrom,
      to: normalizedTo,
    });

    const script = `
import sys, json
from argostranslate import translate
data = json.loads(sys.stdin.read())
texts = data.get("texts", [])
src = data.get("from")
tgt = data.get("to")
out = []
for text in texts:
    out.append(translate.translate(text, src, tgt))
sys.stdout.write(json.dumps(out, ensure_ascii=False))
`;

    const output = await this.runPython(python, script, payload);
    try {
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed)) {
        return parsed.map((value) => String(value));
      }
    } catch {
      // ignore
    }
    return texts.map(() => output);
  }

  private normalizeLang(lang: string): string {
    const normalized = lang.toLowerCase();
    if (normalized === 'auto') return 'en';
    if (normalized.startsWith('pt')) return 'pt';
    if (normalized.startsWith('en')) return 'en';
    if (normalized.startsWith('es')) return 'es';
    return normalized;
  }

  private async findPython(): Promise<string | null> {
    if (this.pythonPath) return this.pythonPath;
    const candidates: string[] = [];
    const envOverride = process.env.RICKY_ARGOS_PYTHON;
    if (envOverride) {
      candidates.push(envOverride);
    }

    const cwd = process.cwd();
    const cwdVenv = path.join(cwd, '.venv', 'bin', 'python');
    if (existsSync(cwdVenv)) {
      candidates.push(cwdVenv);
    }

    const repoVenv = path.resolve(cwd, 'apps', 'desktop', '.venv', 'bin', 'python');
    if (existsSync(repoVenv)) {
      candidates.push(repoVenv);
    }

    const appRoot = path.resolve(__dirname, '../../../../..');
    const appVenv = path.join(appRoot, '.venv', 'bin', 'python');
    if (existsSync(appVenv)) {
      candidates.push(appVenv);
    }

    candidates.push('python3', 'python');
    for (const candidate of candidates) {
      const ok = await new Promise<boolean>((resolve) => {
        const child = spawn(candidate, ['--version']);
        child.on('error', () => resolve(false));
        child.on('close', (code) => resolve(code === 0));
      });
      if (ok) {
        this.pythonPath = candidate;
        return candidate;
      }
    }
    return null;
  }

  private async hasArgos(python: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn(python, ['-c', 'import argostranslate']);
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    });
  }

  private runPython(python: string, script: string, payload: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(python, ['-c', script]);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      child.on('error', (error) => reject(error));
      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Argos failed: ${stderr || stdout || 'unknown error'}`));
        }
      });

      child.stdin.write(payload);
      child.stdin.end();
    });
  }
}
