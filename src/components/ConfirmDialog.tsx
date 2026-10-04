import { useEffect, type ReactNode } from 'react';
import '../styles/sheet.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  busy?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

/** 居中确认弹窗：对应小程序里的 wx.showModal 场景。 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dialog-mask" onClick={() => !busy && onCancel()} />
      <div className="dialog">
        <h2 className="dialog__title">{title}</h2>
        {description ? <div className="dialog__body">{description}</div> : null}
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost dialog__btn" onClick={onCancel} disabled={busy}>
            {cancelText}
          </button>
          <button type="button" className="btn btn--primary dialog__btn" onClick={onConfirm} disabled={busy}>
            {busy ? '提交中…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
