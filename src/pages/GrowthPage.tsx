import { useErrorToast } from "../components/Toast";
import { useEffect, useState } from "react";
import { sharing, type GrowthRow } from "../api/sharing";
import { friendlyError } from "../api/errors";
import { useApp } from "../store/AppContext";
import "../styles/sharing.css";
export function GrowthPage() {
  const { session } = useApp();
  const [days, setDays] = useState(30),
    [rows, setRows] = useState<GrowthRow[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  useErrorToast(error);
  useEffect(() => {
    if (session?.user.role !== "admin") return;
    let live = true;
    setBusy(true);
    setError("");
    sharing
      .stats(days)
      .then((r) => {
        if (live) setRows(r.rows);
      })
      .catch((e) => {
        if (live) setError(friendlyError(e));
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [days, attempt, session?.user.role]);
  if (session?.user.role !== "admin")
    return (
      <main className="page">
        <p>此页面仅管理员可访问。</p>
      </main>
    );
  const totals = rows.reduce(
    (a, r) => ({
      visits: a.visits + r.visits,
      registrations: a.registrations + r.registrations,
      preparations: a.preparations + r.preparations,
      videos: a.videos + r.videos,
    }),
    { visits: 0, registrations: 0, preparations: 0, videos: 0 },
  );
  return (
    <main className="page growth">
      <div className="page-head">
        <h2 className="page-head__title">分享转化</h2>
        <select
          aria-label="统计时间范围"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>近 7 天</option>
          <option value={30}>近 30 天</option>
          <option value={90}>近 90 天</option>
        </select>
        <button
          className="btn btn--quiet btn--slim"
          disabled={busy}
          onClick={() => setAttempt((v) => v + 1)}
        >
          刷新
        </button>
      </div>
      {busy ? <p role="status">正在加载统计…</p> : null}
      <div className="growth__totals">
        {[
          ["链接访客", totals.visits],
          ["新注册", totals.registrations],
          ["首次备课", totals.preparations],
          ["首次成片", totals.videos],
        ].map(([label, n]) => (
          <div className="card" key={label}>
            <strong>{n}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="muted">
        按事件发生时间统计，访客按浏览器与分享链接去重，跨链接会重复。排除已登录访问；注册、备课和成片由后端确认。最多展示
        500 条分享。
      </p>
      {rows.length === 0 && !busy && !error ? (
        <div className="card">暂无分享数据</div>
      ) : null}
      {rows.map((r) => (
        <article className="card growth__row" key={r.code}>
          <header>
            <h3>{r.title}</h3>
            <span className="pill">{r.revokedAt ? "已撤销" : "分享中"}</span>
          </header>
          <p className="muted">
            {r.ownerName} · {new Date(r.createdAt).toLocaleDateString("zh-CN")}
          </p>
          <dl>
            {[
              ["访问", r.visits],
              ["播放", r.plays],
              ["点击制作", r.clicks],
              ["注册", r.registrations],
              ["首次备课", r.preparations],
              ["提交视频", r.requests],
              ["首次成片", r.videos],
              ["奖励已发", r.rewards],
              ["奖励待发", r.pendingRewards],
              ["达到上限", r.cappedRewards],
            ].map(([label, n]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{n}</dd>
              </div>
            ))}
          </dl>
          <a
            className="share-inline"
            href={"/s/" + r.code}
            target="_blank"
            rel="noreferrer"
          >
            查看分享页
          </a>
        </article>
      ))}
    </main>
  );
}
