import { useEffect, useState } from 'react';
import '../styles/sheet.css';

export interface ToastItem {
  id: number;
  text: string;
}

let sequence = 0;
const handlers = new Set<(item: ToastItem) => void>();

/** 全局轻提示：任何模块都可以直接调用。 */
export function toast(text: string): void {
  const item = { id: ++sequence, text };
  for (const handler of handlers) handler(item);
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (item: ToastItem) => {
      setItems((current) => [...current, item]);
      window.setTimeout(() => {
        setItems((current) => current.filter((value) => value.id !== item.id));
      }, 2600);
    };
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className="toast">
          {item.text}
        </div>
      ))}
    </div>
  );
}
