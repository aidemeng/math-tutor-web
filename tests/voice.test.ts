import { it, expect, vi, afterEach } from 'vitest';
import { encodeWav, createVoiceInput } from '../src/lib/voice';
afterEach(() => vi.unstubAllGlobals());
it('encodes mono PCM with correct clipping and WAV header', () => {
  const b = encodeWav(new Float32Array([-2, 0, 2]));
  const v = new DataView(b);
  expect(b.byteLength).toBe(50);
  expect(v.getUint32(24, true)).toBe(16000);
  expect(v.getInt16(44, true)).toBe(-32768);
  expect(v.getInt16(48, true)).toBe(32767);
});
it('cancelling while microphone permission is pending stops tracks and never transcribes', async () => {
  let resolve!: (v: any) => void;
  const stop = vi.fn(),
    transcribe = vi.fn(),
    onText = vi.fn();
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: () => new Promise((r) => (resolve = r)) },
  });
  vi.stubGlobal('MediaRecorder', class {});
  const voice = createVoiceInput({
    transcribe,
    onText,
    onState: vi.fn(),
    onError: vi.fn(),
  });
  const pending = voice.start();
  voice.cancel();
  resolve({ getTracks: () => [{ stop }] });
  await pending;
  expect(stop).toHaveBeenCalled();
  expect(transcribe).not.toHaveBeenCalled();
  expect(onText).not.toHaveBeenCalled();
});
it('reports permission denied without starting a recording', async () => {
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: async () => {
        throw new DOMException('Denied', 'NotAllowedError');
      },
    },
  });
  vi.stubGlobal('MediaRecorder', class {});
  const onError = vi.fn();
  const voice = createVoiceInput({
    transcribe: vi.fn(),
    onText: vi.fn(),
    onState: vi.fn(),
    onError,
  });
  await voice.start();
  expect(onError).toHaveBeenCalledWith('请允许麦克风权限后再试');
});
it('only returns editable text after stop, and ignores an old stop event after a new recording starts', async () => {
  const tracks = [vi.fn(), vi.fn()];
  let acquired = 0;
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: async () => ({
        getTracks: () => [{ stop: tracks[acquired++] }],
      }),
    },
  });
  const recordings: any[] = [];
  vi.stubGlobal(
    'MediaRecorder',
    class {
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: any;
      onstop: any;
      constructor() {
        recordings.push(this);
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
      }
    },
  );
  vi.stubGlobal(
    'AudioContext',
    class {
      async decodeAudioData() {
        return { duration: 1 };
      }
      async close() {}
    },
  );
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      destination = {};
      createBufferSource() {
        return { connect() {}, start() {} };
      }
      async startRendering() {
        return { getChannelData: () => new Float32Array(16000) };
      }
    },
  );
  const onText = vi.fn(),
    transcribe = vi.fn(async () => ({ text: '生成一节切线微课' }));
  const voice = createVoiceInput({
    onText,
    transcribe,
    onState: vi.fn(),
    onError: vi.fn(),
  });
  await voice.start();
  expect(onText).not.toHaveBeenCalled();
  voice.cancel();
  await voice.start();
  await recordings[0].onstop();
  expect(tracks[1]).not.toHaveBeenCalled();
  voice.stop();
  await recordings[1].onstop();
  expect(onText).toHaveBeenCalledExactlyOnceWith('生成一节切线微课');
  expect(transcribe).toHaveBeenCalledTimes(1);
});
