import { parentPort } from 'worker_threads';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import type { Model, Recognizer } from 'vosk';
import { STTConfig, STTFinalEvent, STTPartialEvent } from '@ricky/shared';

type Messenger = {
  on: (event: 'message', handler: (message: any) => void) => void;
  send: (message: any) => void;
};

const messenger: Messenger | null = parentPort
  ? {
      on: parentPort.on.bind(parentPort),
      send: parentPort.postMessage.bind(parentPort),
    }
  : typeof process.send === 'function'
    ? {
        on: process.on.bind(process),
        send: process.send.bind(process),
      }
    : null;

if (!messenger) {
  throw new Error('Worker must have parentPort or IPC channel');
}

let model: Model | null = null;
let recognizer: Recognizer | null = null;
let config: STTConfig | null = null;
let lastPartialTs = 0;
let samplesSinceFinal = 0;
let VoskModel: typeof import('vosk').Model | null = null;
let VoskRecognizer: typeof import('vosk').Recognizer | null = null;
let VoskSetLogLevel: typeof import('vosk').setLogLevel | null = null;
let statsTimer: NodeJS.Timeout | null = null;
let statBytes = 0;
let statSamples = 0;
let statAbsMax = 0;
let statSumSquares = 0;
let statAccepted = 0;
let statPartial = 0;
let statFinal = 0;
let lastPartialText = '';
let pythonProcess: ChildProcessWithoutNullStreams | null = null;
let pythonStdoutBuffer = '';
let pythonMode = false;
let pythonConfig: { chunkBytes: number; enablePartial: boolean; partialDebounceMs: number } | null = null;

const send = (type: string, payload?: any) => {
  messenger.send({ type, payload });
};

const pythonScript = String.raw`import sys, json, argparse, time

def emit(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()

def main():
    try:
        from vosk import Model, KaldiRecognizer
    except Exception:
        emit({"type": "error", "payload": {"message": "Python Vosk nao instalado (crie venv e pip install vosk)"}})
        return 1

    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--sample-rate", type=float, required=True)
    parser.add_argument("--chunk-bytes", type=int, required=True)
    parser.add_argument("--partial", type=int, default=1)
    parser.add_argument("--partial-debounce", type=int, default=200)
    args = parser.parse_args()

    model = Model(args.model)
    rec = KaldiRecognizer(model, args.sample_rate)
    rec.SetWords(True)
    try:
        rec.SetPartialWords(True)
    except Exception:
        pass

    language = "pt-BR" if "pt" in args.model else "en-US"
    emit({"type": "ready", "payload": {"language": language}})

    last_partial = 0.0
    while True:
        data = sys.stdin.buffer.read(args.chunk_bytes)
        if not data:
            break
        if rec.AcceptWaveform(data):
            try:
                result = json.loads(rec.Result())
            except Exception:
                result = {}
            text = result.get("text", "")
            if text:
                emit({"type": "final", "payload": {"text": text}})
        else:
            if args.partial:
                now = time.time() * 1000.0
                if now - last_partial >= args.partial_debounce:
                    try:
                        partial = json.loads(rec.PartialResult())
                    except Exception:
                        partial = {}
                    text = partial.get("partial", "")
                    if text:
                        emit({"type": "partial", "payload": {"text": text}})
                        last_partial = now

    try:
        final = json.loads(rec.FinalResult())
    except Exception:
        final = {}
    if final.get("text"):
        emit({"type": "final", "payload": {"text": final.get("text", "")}})
    return 0

if __name__ == "__main__":
    sys.exit(main())
`;

const safeJsonParse = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const formatInitError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : 'Falha ao iniciar Vosk';
  const lower = message.toLowerCase();
  if (
    lower.includes('native') ||
    lower.includes('self-register') ||
    lower.includes('abi') ||
    lower.includes('elf') ||
    lower.includes('libffi') ||
    lower.includes('node-gyp')
  ) {
    return `${message} (rebuild:electron e verifique libffi-dev)`;
  }
  return message;
};

const resetStats = () => {
  statBytes = 0;
  statSamples = 0;
  statAbsMax = 0;
  statSumSquares = 0;
  statAccepted = 0;
  statPartial = 0;
  statFinal = 0;
};

const startStatsTimer = () => {
  if (statsTimer) return;
  statsTimer = setInterval(() => {
    const rms = statSamples > 0 ? Math.sqrt(statSumSquares / statSamples) : 0;
    let partialInfo = '';
    if (recognizer && config) {
      try {
        const partial = safeJsonParse(recognizer.partialResult());
        if (typeof partial.partial === 'string') {
          lastPartialText = partial.partial;
          const preview = partial.partial.slice(0, 24);
          partialInfo = ` partialLen=${partial.partial.length} partial="${preview}"`;
        }
      } catch {
        // ignore
      }
    }
    send('debug', {
      message: `audio stats: bytes=${statBytes} samples=${statSamples} rms=${rms.toFixed(1)} peak=${statAbsMax} accepted=${statAccepted} partial=${statPartial} final=${statFinal}${partialInfo}`,
    });
    resetStats();
  }, 1000);
};

const stopStatsTimer = () => {
  if (!statsTimer) return;
  clearInterval(statsTimer);
  statsTimer = null;
};

const resolvePythonExec = (): string => {
  const envPath = process.env.RICKY_STT_PYTHON_PATH;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  const venv = process.env.VIRTUAL_ENV;
  if (venv) {
    const candidate = join(venv, 'bin', 'python');
    if (existsSync(candidate)) return candidate;
  }

  const cwd = process.cwd();
  const candidates = [
    join(cwd, '.venv', 'bin', 'python'),
    join(resolve(cwd, '..'), '.venv', 'bin', 'python'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return 'python3';
};

const shouldFallbackToPython = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes('native callback') ||
    lower.includes('ffi') ||
    lower.includes('dlopen') ||
    lower.includes('self-register')
  );
};

const startPythonBackend = (modelPath: string, sttConfig: STTConfig) => {
  const chunkBytes = Math.max(320, Math.floor(sttConfig.sampleRate * 0.1) * 2);
  pythonConfig = {
    chunkBytes,
    enablePartial: sttConfig.enablePartial,
    partialDebounceMs: sttConfig.partialDebounceMs,
  };
  pythonMode = true;
  pythonStdoutBuffer = '';
  const pythonExec = resolvePythonExec();

  pythonProcess = spawn(pythonExec, [
    '-u',
    '-c',
    pythonScript,
    '--model',
    modelPath,
    '--sample-rate',
    String(sttConfig.sampleRate),
    '--chunk-bytes',
    String(chunkBytes),
    '--partial',
    sttConfig.enablePartial ? '1' : '0',
    '--partial-debounce',
    String(sttConfig.partialDebounceMs || 200),
  ]);

  pythonProcess.stdout.on('data', (chunk) => {
    pythonStdoutBuffer += chunk.toString();
    let idx = pythonStdoutBuffer.indexOf('\n');
    while (idx !== -1) {
      const line = pythonStdoutBuffer.slice(0, idx).trim();
      pythonStdoutBuffer = pythonStdoutBuffer.slice(idx + 1);
      if (line) {
        const msg = safeJsonParse(line);
        const type = msg?.type;
        if (type === 'ready') {
          send('ready', { language: msg?.payload?.language || (modelPath.includes('pt') ? 'pt-BR' : 'en-US') });
        } else if (type === 'partial') {
          const text = msg?.payload?.text || '';
          if (text && text !== lastPartialText) {
            lastPartialText = text;
            statPartial += 1;
            send('partial', { text, ts: Date.now() } satisfies STTPartialEvent);
          }
        } else if (type === 'final') {
          const text = msg?.payload?.text || '';
          if (text) {
            statFinal += 1;
            send('final', { text, ts: Date.now() } satisfies STTFinalEvent);
          }
        } else if (type === 'error') {
          send('error', { message: msg?.payload?.message || 'Falha no backend Python' });
        } else if (type === 'debug') {
          send('debug', { message: msg?.payload?.message || 'python debug' });
        }
      }
      idx = pythonStdoutBuffer.indexOf('\n');
    }
  });

  pythonProcess.stderr.on('data', (chunk) => {
    send('debug', { message: `python stderr: ${chunk.toString().trim()}` });
  });

  pythonProcess.on('error', (error) => {
    send('error', { message: `Falha ao iniciar Python Vosk: ${error.message}` });
  });

  pythonProcess.on('exit', () => {
    pythonProcess = null;
  });

  startStatsTimer();
  send('debug', { message: `fallback python backend ativo (exec=${pythonExec})` });
};

messenger.on('message', (message) => {
  if (message.type === 'init') {
    const { config: sttConfig, modelPath } = message.payload as {
      config: STTConfig;
      modelPath: string;
    };

    try {
      if (!VoskModel || !VoskRecognizer || !VoskSetLogLevel) {
        const vosk = require('vosk') as typeof import('vosk');
        VoskModel = vosk.Model;
        VoskRecognizer = vosk.Recognizer;
        VoskSetLogLevel = vosk.setLogLevel;
      }
      VoskSetLogLevel?.(-1);
      if (!VoskModel || !VoskRecognizer) {
        throw new Error('Falha ao carregar o Vosk');
      }
      send('debug', { message: `init modelPath=${modelPath}` });
      model = new VoskModel(modelPath);
      recognizer = new VoskRecognizer({
        model,
        sampleRate: sttConfig.sampleRate,
      });
      recognizer.setMaxAlternatives(0);
      recognizer.setWords(true);
      recognizer.setPartialWords(true);
      config = sttConfig;
      lastPartialTs = 0;
      samplesSinceFinal = 0;
      resetStats();
      startStatsTimer();
      send('ready', { language: modelPath.includes('pt') ? 'pt-BR' : 'en-US' });
    } catch (error) {
      if (shouldFallbackToPython(error)) {
        config = sttConfig;
        lastPartialTs = 0;
        samplesSinceFinal = 0;
        resetStats();
        send('debug', { message: `fallback python: ${formatInitError(error)}` });
        try {
          startPythonBackend(modelPath, sttConfig);
        } catch (fallbackError) {
          send('error', { message: formatInitError(fallbackError) });
        }
      } else {
        send('error', { message: formatInitError(error) });
      }
    }
    return;
  }

  if (message.type === 'audio') {
    if (pythonMode && pythonProcess?.stdin) {
      const rawChunk = message.payload.chunk;
      const chunk = Buffer.isBuffer(rawChunk)
        ? rawChunk
        : Buffer.from(rawChunk?.data ?? rawChunk);
      statBytes += chunk.length;
      const sampleCount = Math.floor(chunk.length / 2);
      statSamples += sampleCount;
      for (let i = 0; i < chunk.length; i += 2) {
        const sample = chunk.readInt16LE(i);
        const abs = Math.abs(sample);
        if (abs > statAbsMax) statAbsMax = abs;
        statSumSquares += sample * sample;
      }
      pythonProcess.stdin.write(chunk);
      return;
    }
    if (!recognizer || !config) {
      return;
    }
    const rawChunk = message.payload.chunk;
    const chunk = Buffer.isBuffer(rawChunk)
      ? rawChunk
      : Buffer.from(rawChunk?.data ?? rawChunk);
    statBytes += chunk.length;
    const sampleCount = Math.floor(chunk.length / 2);
    statSamples += sampleCount;
    for (let i = 0; i < chunk.length; i += 2) {
      const sample = chunk.readInt16LE(i);
      const abs = Math.abs(sample);
      if (abs > statAbsMax) statAbsMax = abs;
      statSumSquares += sample * sample;
    }
    const accepted = recognizer.acceptWaveform(chunk);
    if (accepted) statAccepted += 1;
    samplesSinceFinal += chunk.length / 2;

    if (accepted) {
      const result = safeJsonParse(recognizer.result());
      if (result.text) {
        const finalEvent: STTFinalEvent = {
          text: result.text,
          confidence: result.confidence,
          ts: Date.now(),
        };
        send('final', finalEvent);
        statFinal += 1;
      }
      samplesSinceFinal = 0;
      return;
    }

    if (config.enablePartial) {
      const now = Date.now();
      if (now - lastPartialTs >= config.partialDebounceMs) {
        const partial = safeJsonParse(recognizer.partialResult());
        if (partial.partial) {
          if (partial.partial !== lastPartialText) {
            const partialEvent: STTPartialEvent = {
              text: partial.partial,
              ts: now,
            };
            send('partial', partialEvent);
            statPartial += 1;
            lastPartialText = partial.partial;
          }
          lastPartialTs = now;
        }
      }
    }

    if (samplesSinceFinal >= config.maxSegmentSeconds * config.sampleRate) {
      const result = safeJsonParse(recognizer.finalResult());
      if (result.text) {
        const finalEvent: STTFinalEvent = {
          text: result.text,
          confidence: result.confidence,
          ts: Date.now(),
        };
        send('final', finalEvent);
        statFinal += 1;
      }
      recognizer.reset();
      samplesSinceFinal = 0;
    }
    return;
  }

  if (message.type === 'stop') {
    if (pythonMode) {
      const proc = pythonProcess;
      pythonMode = false;
      pythonProcess = null;
      if (proc?.stdin) {
        proc.stdin.end();
      }
      const finalize = () => {
        stopStatsTimer();
        send('stopped');
        process.exit(0);
      };
      if (proc) {
        proc.once('exit', finalize);
        setTimeout(finalize, 500);
      } else {
        finalize();
      }
      return;
    }

    if (recognizer) {
      try {
        const final = safeJsonParse(recognizer.finalResult());
        if (final.text) {
          const finalEvent: STTFinalEvent = {
            text: final.text,
            confidence: final.confidence,
            ts: Date.now(),
          };
          send('final', finalEvent);
          send('debug', { message: `final on stop len=${final.text.length}` });
        } else if (lastPartialText) {
          send('debug', { message: `final on stop vazio (lastPartialLen=${lastPartialText.length})` });
        } else {
          send('debug', { message: 'final on stop vazio' });
        }
      } catch (error) {
        send('debug', { message: 'falha ao gerar final no stop' });
      }
    }
    recognizer?.free();
    model?.free();
    recognizer = null;
    model = null;
    config = null;
    stopStatsTimer();
    send('stopped');
    process.exit(0);
  }
});
