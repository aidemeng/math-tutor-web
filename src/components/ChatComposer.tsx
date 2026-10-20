import { useEffect, useRef, useState, type RefObject } from "react";
import { Icon } from "./Icon";
import { friendlyError } from "../api/errors";
import { readPhotoFile, type PhotoPayload } from "../lib/photo";
import "../styles/composer.css";
import { useApp } from "../store/AppContext";
import { createVoiceInput, type VoiceState } from "../lib/voice";

interface ComposerProps {
  value: string;
  photo: PhotoPayload | null;
  busy?: boolean;
  autoFocus?: boolean;
  autoGrow?: boolean;
  placeholder?: string;
  onChange(value: string): void;
  onPhotoChange(photo: PhotoPayload | null): void;
  onSend(): void;
  onError(message: string): void;
  fileInputRef?: RefObject<HTMLInputElement | null>;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}

/**
 * 输入框：题干/需求文本 + 拍照上传，回车发送、Shift+回车换行。
 * 图片在本地先做与后端一致的校验，失败立即给出可读提示。
 */
export function ChatComposer({
  value,
  photo,
  busy = false,
  autoFocus = false,
  autoGrow = true,
  placeholder = "输入题干或备课需求",
  onChange,
  onPhotoChange,
  onSend,
  onError,
  fileInputRef,
  inputRef,
}: ComposerProps) {
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef || internalTextareaRef;
  const internalFileRef = useRef<HTMLInputElement>(null);
  const fileRef = fileInputRef || internalFileRef;

  const { client } = useApp();
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const callbacks = useRef({ value, onChange, onError, client });
  callbacks.current = { value, onChange, onError, client };
  const voiceRef = useRef<ReturnType<typeof createVoiceInput> | null>(null);
  if (!voiceRef.current)
    voiceRef.current = createVoiceInput({
      transcribe: (audio, signal) =>
        callbacks.current.client.transcribeSpeech(audio, signal),
      onText: (text) => {
        const current = callbacks.current;
        current.onChange(
          [current.value.trim(), text].filter(Boolean).join(" ").slice(0, 4000),
        );
        textareaRef.current?.focus();
      },
      onState: (state, seconds) => {
        setVoiceState(state);
        setVoiceSeconds(seconds);
      },
      onError: (message) => callbacks.current.onError(friendlyError(message)),
    });
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) voiceRef.current?.cancel();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      voiceRef.current?.cancel();
    };
  }, []);
  useEffect(() => {
    if (busy) voiceRef.current?.cancel();
  }, [busy]);
  const inputBusy = busy || voiceState !== "idle";
  const canSend = !inputBusy && (value.trim().length > 0 || !!photo);

  // 自适应高度，最多约 6 行
  useEffect(() => {
    const node = textareaRef.current;
    if (!node || !autoGrow) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 138)}px`;
  }, [value, autoGrow, voiceState]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      onPhotoChange(await readPhotoFile(file));
    } catch (error) {
      onError(friendlyError(error));
    }
  }

  return (
    <div className="composer">
      {photo ? (
        <div className="composer__attachment">
          <img
            src={photo.preview}
            alt="待上传的题目照片"
            className="composer__thumb"
          />
          <div className="composer__attachment-meta">
            <span className="pill">题目照片</span>
            <span className="muted">发送后由助手识别并检索真题</span>
          </div>
          <button
            type="button"
            className="iconbtn iconbtn--plain"
            onClick={() => onPhotoChange(null)}
            aria-label="移除照片"
            disabled={inputBusy}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      ) : null}

      <div className="composer__row">
        <button
          type="button"
          className="composer__icon composer__icon--photo"
          hidden={voiceState !== "idle"}
          onClick={() => fileRef.current?.click()}
          disabled={inputBusy}
          aria-label="拍照或上传题目"
        >
          <Icon name="camera" size={21} />
        </button>

        {voiceState !== "idle" && (
          <div className="composer__voice" role="status" aria-live="polite">
            <span
              className={
                voiceState === "recording" ? "composer__recording-dot" : ""
              }
            />
            <span>
              {voiceState === "requesting"
                ? "正在开启麦克风…"
                : voiceState === "recording"
                  ? `正在录音 ${voiceSeconds}s / 60s`
                  : "正在识别…"}
            </span>
            <button type="button" onClick={() => voiceRef.current?.cancel()}>
              取消
            </button>
          </div>
        )}
        <div
          className={`composer__field ${autoGrow ? "" : "composer__field--fixed"}`}
          hidden={voiceState !== "idle"}
        >
          <textarea
            ref={textareaRef}
            className={`composer__input ${autoGrow ? "" : "composer__input--fixed"}`}
            hidden={voiceState !== "idle"}
            value={value}
            rows={1}
            maxLength={4000}
            placeholder={placeholder}
            disabled={inputBusy}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (canSend) onSend();
              }
            }}
          />
        </div>

        <button
          type="button"
          className={`composer__icon composer__icon--voice ${voiceState === "recording" ? "is-recording" : ""}`}
          aria-label={voiceState === "recording" ? "结束录音" : "语音输入"}
          disabled={
            busy || voiceState === "requesting" || voiceState === "transcribing"
          }
          onClick={() =>
            voiceState === "recording"
              ? voiceRef.current?.stop()
              : void voiceRef.current?.start()
          }
        >
          <Icon name={voiceState === "recording" ? "stop" : "mic"} size={20} />
        </button>
        <button
          type="button"
          className="composer__icon composer__icon--send"
          hidden={voiceState !== "idle"}
          onClick={onSend}
          disabled={!canSend}
          aria-label="发送"
        >
          <Icon name="send" size={20} />
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
