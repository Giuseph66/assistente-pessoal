import { execFile } from 'child_process';
import { promisify } from 'util';
import { SystemAudioSourceInfo } from '@neo/shared';
import { getLogger } from '@neo/logger';

const execFileAsync = promisify(execFile);
const logger = getLogger();

const runPactl = async (args: string[]): Promise<string> => {
  try {
    const { stdout } = await execFileAsync('pactl', args, { encoding: 'utf8' });
    return stdout;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw new Error('pactl nao encontrado. Instale pipewire-pulse ou pulseaudio-utils.');
    }
    throw new Error(error?.message || 'Falha ao executar pactl');
  }
};

const parseDescriptions = (output: string): Map<string, string> => {
  const map = new Map<string, string>();
  const lines = output.split('\n');
  let currentName = '';
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('Name:')) {
      currentName = line.replace('Name:', '').trim();
      continue;
    }
    if (line.startsWith('Description:') && currentName) {
      const desc = line.replace('Description:', '').trim();
      map.set(currentName, desc);
    }
  }
  return map;
};

export class SystemAudioSourceManager {
  async listSources(): Promise<SystemAudioSourceInfo[]> {
    const [shortSources, descriptionOutput, defaultMonitor] = await Promise.all([
      runPactl(['list', 'short', 'sources']),
      runPactl(['list', 'sources']).catch(() => ''),
      this.detectDefaultMonitor().catch(() => null),
    ]);

    const descriptions = parseDescriptions(descriptionOutput);
    const lines = shortSources.split('\n').map((line) => line.trim()).filter(Boolean);

    const sources = lines.map((line) => {
      const parts = line.split(/\t+/).filter(Boolean);
      const name = parts[1] || '';
      const isMonitor = name.endsWith('.monitor');
      const friendly = descriptions.get(name) || name;
      return {
        id: name,
        name: friendly,
        isMonitor,
        isDefaultCandidate: defaultMonitor ? name === defaultMonitor : false,
      } satisfies SystemAudioSourceInfo;
    });

    return sources;
  }

  async detectDefaultMonitor(): Promise<string | null> {
    try {
      const output = await runPactl(['get-default-sink']);
      const sinkName = output.trim();
      if (!sinkName) return null;
      return `${sinkName}.monitor`;
    } catch (error) {
      logger.warn({ err: error }, 'Failed to detect default sink');
      return null;
    }
  }
}
