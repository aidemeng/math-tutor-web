import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import { Icon } from "./Icon";
import "../styles/sheet.css";

interface SheetProps {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  navigation?: ReactNode;
  fitContent?: boolean;
}

/** 底部抽屉：点遮罩、按 Esc、下滑都可关闭。 */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
  navigation,
  fitContent = false,
}: SheetProps) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setDragY(0);
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const onTouchStart = (event: TouchEvent) => {
    // 内容已滚到顶部时，才把下滑手势交给抽屉
    if ((bodyRef.current?.scrollTop ?? 0) > 0) return;
    startY.current = event.touches[0].clientY;
  };
  const onTouchMove = (event: TouchEvent) => {
    if (startY.current === null) return;
    const delta = event.touches[0].clientY - startY.current;
    setDragY(Math.max(0, delta));
  };
  const onTouchEnd = () => {
    if (dragY > 110) onClose();
    setDragY(0);
    startY.current = null;
  };

  return (
    <div
      className="sheet-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="sheet-mask" onClick={onClose} />
      <section
        className={fitContent ? "sheet sheet--fit" : "sheet"}
        style={
          dragY
            ? { transform: `translateY(${dragY}px)`, transition: "none" }
            : undefined
        }
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="sheet__grabber" />
        <header className="sheet__header">
          <h2 className="sheet__title">{title}</h2>
          <button
            type="button"
            className="iconbtn iconbtn--plain"
            onClick={onClose}
            aria-label="关闭"
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        {navigation ? (
          <div className="sheet__navigation">{navigation}</div>
        ) : null}
        <div className="sheet__body" ref={bodyRef}>
          {children}
        </div>
        {footer ? <footer className="sheet__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
