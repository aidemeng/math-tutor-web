import { afterEach, expect, it, vi } from 'vitest';
import { createClient } from '../src/api/client';
import { ApiError, friendlyError } from '../src/api/errors';
import { createTeacherStore } from '../src/store/teacherStore';
import type { TutorClient } from '../src/api/client';

afterEach(() => vi.unstubAllGlobals());
it('redeems credits through the authenticated endpoint and preserves server balance', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ available: 3, added: 3 }));
  vi.stubGlobal('fetch', fetch);
  expect(await createClient({ getToken: () => 'session-token' }).redeemCredits('CODE')).toEqual({ available: 3, added: 3 });
  expect(fetch).toHaveBeenCalledWith('/v1/credits/redeem', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ code: 'CODE' }),
    headers: expect.objectContaining({ Authorization: 'Bearer session-token' }),
  }));
});
it('explains already redeemed and exhausted codes without implying a service outage', () => {
  expect(friendlyError(new ApiError('CREDIT_CODE_REDEEMED'))).toContain('已兑换');
  expect(friendlyError(new ApiError('CREDIT_CODE_EXHAUSTED'))).toContain('已用完');
});

it('recovers the committed balance when a lost redemption response is retried', async () => {
  const networkError = new ApiError('NETWORK_ERROR');
  const redeemedError = new ApiError('CREDIT_CODE_REDEEMED', 409);
  const redeemCredits = vi.fn().mockRejectedValueOnce(networkError).mockRejectedValueOnce(redeemedError);
  const credits = vi.fn().mockResolvedValue({ available: 3 });
  const store = createTeacherStore({ client: {
    redeemCredits, credits, listVideoJobs: async () => ({ jobs: [] }),
  } as unknown as TutorClient });
  store.state.credits = 0;
  try {
    await expect(store.redeemCredits('K7TM-4R9X')).rejects.toBe(networkError);
    await expect(store.redeemCredits('K7TM-4R9X')).rejects.toBe(redeemedError);
    expect(store.state.credits).toBe(3);
    expect(credits).toHaveBeenCalledTimes(1);
    expect(redeemCredits).toHaveBeenCalledTimes(2);
  } finally {
    store.dispose();
  }
});

it('reports failed balance recovery instead of implying that the display is synchronized', async () => {
  const refreshError = new ApiError('NETWORK_ERROR');
  const store = createTeacherStore({ client: {
    redeemCredits: async () => { throw new ApiError('CREDIT_CODE_REDEEMED', 409); },
    credits: async () => { throw refreshError; },
    listVideoJobs: async () => ({ jobs: [] }),
  } as unknown as TutorClient });
  store.state.credits = 0;
  try {
    await expect(store.redeemCredits('K7TM-4R9X')).rejects.toBe(refreshError);
    expect(store.state.credits).toBe(0);
  } finally {
    store.dispose();
  }
});
