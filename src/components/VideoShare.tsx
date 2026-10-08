import { useEffect, useRef, useState } from "react";
import { sharing, type ShareInfo, type ReferralRewards } from "../api/sharing";
import { useApp } from "../store/AppContext";
import { API_BASE_URL } from "../api/client";
import { friendlyError } from "../api/errors";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";
import { toast } from "./Toast";
import "../styles/sharing.css";
export function VideoShare({ jobId, title }: { jobId: string; title: string }) {
  const { store } = useApp();
  const [open, setOpen] = useState(false),
    [share, setShare] = useState<ShareInfo | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [showLink, setShowLink] = useState(false),
    [thumbnailError, setThumbnailError] = useState(false);
  const [rewards, setRewards] = useState<ReferralRewards | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    sharing
      .rewards()
      .then((r) => {
        if (live) {
          setRewards(r);
          void store?.refreshJobs().catch(() => {});
        }
      })
      .catch(() => {
        if (live) setRewards(null);
      });
    return () => {
      live = false;
    };
  }, [open, store]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let live = true;
    setLoading(true);
    sharing
      .get(jobId)
      .then((r) => {
        if (live) setShare(r.share);
      })
      .catch((e) => {
        if (live) setError(friendlyError(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [jobId]);
  const url = share ? new URL(share.path, window.location.origin).href : "";
  async function create() {
    setBusy(true);
    setError("");
    try {
      setShare(await sharing.create(jobId));
      toast("分享链接已生成");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast("链接已复制");
    } catch {
      setShowLink(true);
      setError("请长按或手动复制链接");
    }
  }
  return (
    <>
      <button
        type="button"
        className="btn btn--quiet btn--block"
        onClick={() => {
          setShowLink(false);
          setThumbnailError(false);
          setOpen(true);
        }}
      >
        <Icon name="share" size={18} />
        分享视频
      </button>
      <Sheet
        open={open}
        title="分享视频"
        fitContent
        onClose={() => !busy && setOpen(false)}
      >
        <div className="share-controls">
          <div className="share-reward">
            <span>邀请新老师注册，送你 1 次视频制作额度</span>
            <small>
              {rewards
                ? `本月已获 ${rewards.earned}/${rewards.limit} 次${rewards.pending ? ` · ${rewards.pending} 笔待处理` : ""}`
                : "每人每月最多 3 次 · 同一访客仅奖励一次"}
            </small>
          </div>
          {!share ? <h3>{title}</h3> : null}
          {loading ? (
            <p>正在读取分享状态…</p>
          ) : share ? (
            <>
              <a
                className="share-preview"
                href={share.path}
                target="_blank"
                rel="noreferrer"
                aria-label={`预览分享页：${title}`}
              >
                <div className="share-preview__media">
                  {!thumbnailError && open ? (
                    <video
                      src={`${API_BASE_URL}/v1/public/shares/${share.code}/video#t=1`}
                      preload="metadata"
                      muted
                      playsInline
                      aria-hidden="true"
                      tabIndex={-1}
                      onError={() => setThumbnailError(true)}
                    />
                  ) : null}
                  <span className="share-preview__play">
                    <Icon name="play" size={22} />
                  </span>
                </div>
                <div className="share-preview__info">
                  <h3>{title}</h3>
                  <span>
                    数学备课助手 · 点击预览
                    <Icon name="external" size={13} />
                  </span>
                </div>
              </a>
              <div className="share-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => void copy()}
                >
                  <Icon name="copy" size={18} />
                  复制链接
                </button>
              </div>
              {showLink ? (
                <label className="share-link-fallback">
                  分享链接
                  <input
                    ref={input}
                    autoFocus
                    className="field"
                    value={url}
                    readOnly
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </label>
              ) : null}
            </>
          ) : (
            <>
              <p>
                确认视频讲解无误、题目适合公开后，即可创建免登录观看的分享链接。
              </p>
              <p className="muted">
                公开内容包括本题题干、题目配图和成片。请检查其中没有个人信息。不会公开账号、聊天记录、解析文本或原始上传照片。
              </p>
              <p className="muted">
                分享后任何获得链接的人都可观看，已下载的内容无法收回。
              </p>
              <button
                type="button"
                className="btn btn--primary btn--block"
                disabled={busy}
                onClick={() => void create()}
              >
                {busy ? "正在创建…" : "确认内容可公开，创建链接"}
              </button>
            </>
          )}
          {error ? (
            <p className="notice notice--danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}
