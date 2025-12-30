import { parentPort } from 'worker_threads';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { existsSync, openSync, readSync, closeSync, createReadStream } from 'fs';
import { join, resolve } from 'path';

const messenger = parentPort
  ? {
      on: parentPort.on.bind(parentPort),
      send: parentPort.postMessage.bind(parentPort),
    }
  : null;

if (!messenger) {
  throw new Error('Worker must have parentPort');
}

type WordInfo = {
  word: string;
  start: number;
  end: number;
};

let pythonProcess: ChildProcessWithoutNullStreams | null = null;
let stdoutBuffer = '';

const send = (type: string, payload?: any) => messenger.send({ type, payload });

const pythonScript = String.raw`import sys, json, argparse

def emit(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()

def main():
    try:
        from vosk import Model, KaldiRecognizer
    except Exception:
        emit({"type": "error", "payload": {"message": "Python Vosk nao instalado (pip install vosk)"}})
        return 1

    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--sample-rate", type=float, required=True)
    parser.add_argument("--chunk-bytes", type=int, required=True)
    args = parser.parse_args()

    model = Model(args.model)
    rec = KaldiRecognizer(model, args.sample_rate)
    rec.SetWords(True)
    try:
        rec.SetPartialWords(True)
    except Exception:
        pass

    emit({"type": "ready"})

    while True:
        data = sys.stdin.buffer.read(args.chunk_bytes)
        if not data:
            break
        if rec.AcceptWaveform(data):
            try:
                result = json.loads(rec.Result())
            except Exception:
                result = {}
            emit({"type": "result", "payload": result})
        else:
            try:
                partial = json.loads(rec.PartialResult())
            except Exception:
                partial = {}
            text = partial.get("partial", "")
            if text:
                emit({"type": "partial", "payload": {"text": text}})

    try:
        final = json.loads(rec.FinalResult())
    except Exception:
        final = {}
    emit({"type": "result", "payload": final})
    emit({"type": "done"})
    return 0

if __name__ == "__main__":
    sys.exit(main())
`;

const safeJsonParse = (line: string): any => {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
};

const resolvePythonExec = (): string => {
  const envPath = process.env.RICKY_STT_PYTHON_PATH;
  if (envPath && existsSync(envPath)) return envPath;

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

const readWavHeader = (filePath: string) => {
  const fd = openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(4096);
    const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
    const view = buffer.slice(0, bytesRead);
    if (view.toString('ascii', 0, 4) !== 'RIFF' || view.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('Arquivo WAV invalido');
    }

    let offset = 12;
    let fmtFound = false;
    let dataOffset = 0;
    let dataSize = 0;
    let sampleRate = 0;
    let channels = 0;
    let bits = 0;

    while (offset + 8 <= view.length) {
      const chunkId = view.toString('ascii', offset, offset + 4);
      const chunkSize = view.readUInt32LE(offset + 4);
      const chunkDataStart = offset + 8;
      if (chunkId === 'fmt ') {
        fmtFound = true;
        const audioFormat = view.readUInt16LE(chunkDataStart);
        channels = view.readUInt16LE(chunkDataStart + 2);
        sampleRate = view.readUInt32LE(chunkDataStart + 4);
        bits = view.readUInt16LE(chunkDataStart + 14);
        if (audioFormat !== 1) {
          throw new Error('Formato WAV nao suportado (apenas PCM)');
        }
      } else if (chunkId === 'data') {
        dataOffset = chunkDataStart;
        dataSize = chunkSize;
        break;
      }
      offset = chunkDataStart + chunkSize;
    }

    if (!fmtFound || !dataOffset || !dataSize) {
      throw new Error('Nao foi possivel ler o header WAV');
    }

    return { sampleRate, channels, bits, dataOffset, dataSize };
  } finally {
    closeSync(fd);
  }
};

messenger.on('message', async (message: any) => {
  if (message.type !== 'start') return;
  const { wavPath, modelPath } = message.payload as {
    wavPath: string;
    modelPath: string;
  };

  try {
    const header = readWavHeader(wavPath);
    if (header.channels !== 1 || header.bits !== 16) {
      throw new Error('WAV precisa ser PCM 16-bit mono');
    }

    const sampleRate = header.sampleRate;
    const totalBytes = header.dataSize;
    const chunkBytes = Math.max(320, Math.floor(sampleRate * 0.1) * 2);
    const pythonExec = resolvePythonExec();

    const words: WordInfo[] = [];
    let lastProgress = 0;
    let processed = 0;
    let lastPartial = '';

    pythonProcess = spawn(pythonExec, [
      '-u',
      '-c',
      pythonScript,
      '--model',
      modelPath,
      '--sample-rate',
      String(sampleRate),
      '--chunk-bytes',
      String(chunkBytes),
    ]);

    pythonProcess.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      let idx = stdoutBuffer.indexOf('\n');
      while (idx !== -1) {
        const line = stdoutBuffer.slice(0, idx).trim();
        stdoutBuffer = stdoutBuffer.slice(idx + 1);
        if (line) {
          const msg = safeJsonParse(line);
          if (msg?.type === 'partial') {
            lastPartial = msg?.payload?.text || '';
          }
          if (msg?.type === 'result') {
            const payload = msg?.payload || {};
            if (Array.isArray(payload.result)) {
              payload.result.forEach((item: any) => {
                if (item?.word) {
                  words.push({ word: item.word, start: item.start, end: item.end });
                }
              });
            }
          }
          if (msg?.type === 'error') {
            send('error', { message: msg?.payload?.message || 'Erro no Python Vosk' });
          }
        }
        idx = stdoutBuffer.indexOf('\n');
      }
    });

    pythonProcess.stderr.on('data', (chunk) => {
      send('debug', { message: chunk.toString().trim() });
    });

    pythonProcess.on('error', (error) => {
      send('error', { message: `Falha ao iniciar Python: ${error.message}` });
    });

    const stream = createReadStream(wavPath, {
      start: header.dataOffset,
      end: header.dataOffset + header.dataSize - 1,
      highWaterMark: chunkBytes,
    });

    stream.on('data', (chunk) => {
      processed += chunk.length;
      pythonProcess?.stdin.write(chunk);
      const percent = Math.floor((processed / totalBytes) * 100);
      if (percent !== lastProgress) {
        lastProgress = percent;
        const currentTimeMs = Math.round((processed / (sampleRate * header.channels * 2)) * 1000);
        send('progress', {
          percent,
          currentTimeMs,
          textPartial: lastPartial || undefined,
        });
      }
    });

    stream.on('end', () => {
      pythonProcess?.stdin.end();
    });

    pythonProcess.on('close', (code) => {
      if (code && code !== 0) {
        send('error', { message: `Python encerrou com codigo ${code}` });
        return;
      }
      const durationMs = Math.round((totalBytes / (sampleRate * header.channels * 2)) * 1000);
      send('done', { words, durationMs, sampleRate });
    });
  } catch (error: any) {
    send('error', { message: error?.message || 'Falha ao transcrever arquivo' });
  }
});
