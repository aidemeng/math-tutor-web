import { useEffect, useState } from "react";

/** Time is measured locally; phase labels only change on actual server events. */
export function AgentProgress({
  status,
  startedAt,
  lastActivityAt,
}: {
  status?: string;
  startedAt?: number;
  lastActivityAt?: number;
}) {
  const [mountedAt] = useState(Date.now);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const start = startedAt ?? mountedAt;
  const elapsed = Math.max(0, Math.floor((now - start) / 1000));
  const slow = now - (lastActivityAt ?? start) >= 45000;
  return (
    <div className="agent__progress">
      <div className="agent__typing" role="status" aria-live="polite">
        <span className="agent__dot" />
        <span className="agent__dot" />
        <span className="agent__dot" />
        <span className="agent__status">{status || "正在处理…"}</span>
        <span className="agent__elapsed" aria-hidden="true">
          已用时 {Math.floor(elapsed / 60)}:
          {String(elapsed % 60).padStart(2, "0")}
        </span>
      </div>
      {slow ? (
        <p className="agent__slow">本次处理时间较长，完成后会自动显示结果。</p>
      ) : null}
    </div>
  );
}
