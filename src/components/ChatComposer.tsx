import { useEffect, useRef, type RefObject } from 'react';
import { Icon } from './Icon';
import { friendlyError } from '../api/errors';
import { readPhotoFile, type PhotoPayload } from '../lib/photo';
import '../styles/composer.css';

interface ComposerProps {
  value: string;
  photo: PhotoPayload | null;
  busy?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  onChange(value: string): void;
  onPhotoChange(photo: PhotoPayload | null): void;
  onSend(): void;
  onError(message: string): void;
  fileInputRef?: RefObject<HTMLInputElement | null>;
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
  placeholder = '输入题干或备课需求',
  onChange,
  onPhotoChange,
  onSend,
  onError,
  fileInputRef,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const internalFileRef = useRef<HTMLInputElement>(null);
  const fileRef = fileInputRef || internalFileRef;

  const canSend = !busy && (value.trim().length > 0 || !!photo);

  // 自适应高度，最多约 6 行
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 138)}px`;
  }, [value]);

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
          <img src={photo.preview} alt="待上传的题目照片" className="composer__thumb" />
          <div className="composer__attachment-meta">
            <span className="pill">题目照片</span>
            <span className="muted">发送后由助手识别并检索真题</span>
          </div>
          <button
            type="button"
            className="iconbtn iconbtn--plain"
            onClick={() => onPhotoChange(null)}
            aria-label="移除照片"
            disabled={busy}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      ) : null}

      <div className="composer__row">
        <button
          type="button"
          className="composer__icon composer__icon--photo"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label="拍照或上传题目"
        >
          <Icon name="camera" size={21} />
        </button>

        <textarea
          ref={textareaRef}
          className="composer__input"
          value={value}
          rows={1}
          maxLength={4000}
          placeholder={placeholder}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
        />

        <button
          type="button"
          className="composer__icon composer__icon--send"
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
          event.target.value = '';
        }}
      />
    </div>
  );
}
