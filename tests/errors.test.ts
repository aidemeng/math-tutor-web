import {afterEach, expect, it, vi} from 'vitest';
import {ApiError, friendlyError} from '../src/api/errors';
import {createClient} from '../src/api/client';
afterEach(()=>vi.unstubAllGlobals());
it('request timeouts are distinguished from connection failures',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new DOMException('The operation timed out','TimeoutError')));
  await expect(createClient({getToken:()=>null}).me()).rejects.toMatchObject({code:'REQUEST_TIMEOUT'});
  expect(friendlyError(new DOMException('The operation timed out','TimeoutError'))).toBe('请求超时，请重试');
  expect(friendlyError(new ApiError('REQUEST_TIMEOUT'))).toBe('请求超时，请重试');
});
it('a successful HTTP response with invalid JSON rejects as an invalid response',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('upstream returned HTML',{status:200})));
  await expect(createClient({getToken:()=>null}).me()).rejects.toMatchObject({code:'INVALID_RESPONSE'});
});
