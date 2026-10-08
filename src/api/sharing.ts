import { readSession } from "../auth/session";
import { API_BASE_URL } from "./client";
import { ApiError } from "./errors";
import type { Diagram } from "../lib/questionDiagram";
export interface ShareInfo {
  code: string;
  path: string;
  createdAt: number;
}
export interface PublicQuestion {
  title: string;
  stem: string;
  source: string;
  assets: string[];
  path?: string;
  diagrams: Diagram[];
}
export interface GrowthRow {
  code: string;
  ownerId: string;
  ownerName: string;
  jobId: string;
  title: string;
  createdAt: number;
  revokedAt: number | null;
  visits: number;
  plays: number;
  clicks: number;
  registrations: number;
  preparations: number;
  requests: number;
  videos: number;
  rewards: number;
  pendingRewards: number;
  cappedRewards: number;
}
export async function shareRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = readSession()?.token;
  const r = await fetch(API_BASE_URL + path, {
    credentials: "same-origin",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token && token !== "cookie"
        ? { Authorization: "Bearer " + token }
        : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new ApiError(body.error || "NETWORK_ERROR", r.status);
  }
  return r.status === 204 ? (undefined as T) : await r.json();
}
export interface ReferralRewards {
  month: string;
  amount: number;
  limit: number;
  earned: number;
  pending: number;
  records: {
    shareCode: string;
    month: string;
    amount: number;
    status: "pending" | "granted" | "capped" | "blocked";
    createdAt: number;
    settledAt: number | null;
  }[];
}
export const sharing = {
  rewards: () => shareRequest<ReferralRewards>("/v1/referral-rewards"),
  get: (id: string) =>
    shareRequest<{ share: ShareInfo | null }>(
      `/v1/video-jobs/${encodeURIComponent(id)}/share`,
    ),
  create: (id: string) =>
    shareRequest<ShareInfo>(`/v1/video-jobs/${encodeURIComponent(id)}/share`, {
      method: "POST",
      body: JSON.stringify({ confirmed: true }),
    }),
  revoke: (id: string) =>
    shareRequest<void>(`/v1/video-jobs/${encodeURIComponent(id)}/share`, {
      method: "DELETE",
    }),
  read: (code: string) =>
    shareRequest<{ code: string; question: PublicQuestion; videoPath: string }>(
      `/v1/public/shares/${encodeURIComponent(code)}`,
    ),
  event: (code: string, event: "visit" | "play" | "cta") =>
    shareRequest<void>(`/v1/public/shares/${encodeURIComponent(code)}/events`, {
      method: "POST",
      body: JSON.stringify({ event }),
    }),
  stats: (days: number) =>
    shareRequest<{ days: number; rows: GrowthRow[]; limit: number }>(
      `/v1/admin/growth?days=${days}`,
    ),
};
