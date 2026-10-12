export type VoiceState = 'idle' | 'requesting' | 'recording' | 'transcribing';
export function encodeWav(samples: Float32Array): ArrayBuffer {
  const b = new ArrayBuffer(44 + samples.length * 2),
    v = new DataView(b);
  for (const [at, s] of [
    [0, 'RIFF'],
    [8, 'WAVE'],
    [12, 'fmt '],
    [36, 'data'],
  ] as const)
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  v.setUint32(4, b.byteLength - 8, true);
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  v.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) =>
    v.setInt16(
      44 + i * 2,
      Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 32768 : 32767),
      true,
    ),
  );
  return b;
}
async function normalizeAudio(blob: Blob): Promise<ArrayBuffer> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    if (decoded.duration > 61) throw new Error('录音最长60秒，请分段输入');
    const offline = new OfflineAudioContext(
      1,
      Math.ceil(decoded.duration * 16000),
      16000,
    );
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    return encodeWav((await offline.startRendering()).getChannelData(0));
  } finally {
    await context.close();
  }
}
export function createVoiceInput(options: {
  transcribe(
    audio: ArrayBuffer,
    signal: AbortSignal,
  ): Promise<{ text: string }>;
  onText(text: string): void;
  onState(state: VoiceState, seconds: number): void;
  onError(message: string): void;
}) {
  let generation = 0,
    state: VoiceState = 'idle',
    stream: MediaStream | null = null,
    recorder: MediaRecorder | null = null;
  let timer: ReturnType<typeof setInterval> | undefined,
    abort: AbortController | undefined;
  const set = (s: VoiceState, seconds = 0) => {
    state = s;
    options.onState(s, seconds);
  };
  const release = () => {
    clearInterval(timer);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };
  function cancel() {
    generation++;
    abort?.abort();
    if (recorder?.state === 'recording') recorder.stop();
    recorder = null;
    release();
    set('idle');
  }
  function stop() {
    if (state === 'recording' && recorder?.state === 'recording') {
      set('transcribing');
      clearInterval(timer);
      recorder.stop();
    }
  }
  async function start() {
    if (state !== 'idle') return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      options.onError(
        '当前浏览器不支持录音，请使用最新版浏览器并通过 HTTPS 打开',
      );
      return;
    }
    const current = ++generation;
    set('requesting');
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (current !== generation) {
        acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = acquired;
      const chunks: Blob[] = [];
      recorder = new MediaRecorder(acquired);
      const recording = recorder;
      recording.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recording.onerror = () => {
        if (current === generation) {
          cancel();
          options.onError('录音中断，请重试');
        }
      };
      recording.onstop = async () => {
        if (current !== generation) return;
        release();
        set('transcribing');
        abort = new AbortController();
        try {
          const audio = await normalizeAudio(
            new Blob(chunks, { type: recording.mimeType }),
          );
          if (current !== generation) return;
          const result = await options.transcribe(audio, abort.signal);
          if (current === generation) options.onText(result.text);
        } catch (error) {
          if (current === generation)
            options.onError(
              error instanceof Error ? error.message : '语音识别失败，请重试',
            );
        } finally {
          if (current === generation) {
            recorder = null;
            set('idle');
          }
        }
      };
      recording.start();
      set('recording');
      const started = Date.now();
      timer = setInterval(() => {
        const seconds = Math.min(60, Math.floor((Date.now() - started) / 1000));
        set('recording', seconds);
        if (seconds >= 60) stop();
      }, 250);
    } catch (error) {
      if (current !== generation) return;
      release();
      set('idle');
      options.onError(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? '请允许麦克风权限后再试'
          : '无法开启麦克风，请检查设备后重试',
      );
    }
  }
  return { start, stop, cancel };
}
