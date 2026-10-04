/**
 * 媒体对象缓存：把需要鉴权头的二进制资源转成浏览器可直接用的 object URL。
 * 同一个 key 只下载一次，取消或登出时统一释放。
 */
export class MediaCache {
  private entries = new Map<string, Promise<string>>();
  private urls = new Set<string>();
  private disposed = false;

  get(key: string, loader: () => Promise<Blob>): Promise<string> {
    if (this.disposed) return Promise.reject(new Error('MEDIA_CACHE_DISPOSED'));
    const existing = this.entries.get(key);
    if (existing) return existing;

    const pending = loader()
      .then((blob) => {
        if (this.disposed) throw new Error('MEDIA_CACHE_DISPOSED');
        const url = URL.createObjectURL(blob);
        this.urls.add(url);
        return url;
      })
      .catch((error) => {
        this.entries.delete(key);
        throw error;
      });

    this.entries.set(key, pending);
    return pending;
  }

  clear(): void {
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.clear();
    this.entries.clear();
  }

  dispose(): void {
    this.disposed = true;
    this.clear();
  }
}
