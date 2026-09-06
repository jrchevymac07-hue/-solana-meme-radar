import { checkedCursor, checkedHandle, counts, record, remoteId, socialJson, string, type SocialPage, type SocialPostInput, type SocialProvider } from "./provider";

/** Business Discovery for eligible professional accounts; no consumer/private scraping fallback. */
export function createInstagramProvider(config: { handle: string; token: string; viewerAccountId: string; graphVersion: string }, transport: typeof fetch = fetch): SocialProvider {
  checkedHandle(config.handle, "instagram"); remoteId(config.viewerAccountId);
  if (!/^v\d+\.0$/.test(config.graphVersion)) throw new Error("Set a supported Meta Graph API version");
  return { platform: "instagram", handle: config.handle, async fetchPage(cursor, signal): Promise<SocialPage> {
    checkedCursor(cursor);
    const fetchMedia = async (after: string | null) => {
      const media = `media.limit(50)${after ? `.after(${after})` : ""}{id,caption,timestamp,permalink,like_count,comments_count}`;
      const url = new URL(`https://graph.facebook.com/${config.graphVersion}/${config.viewerAccountId}`);
      url.searchParams.set("fields", `business_discovery.username(${config.handle}){id,username,${media}}`);
      const body = await socialJson(url, config.token, signal, transport);
      const account = record(body.business_discovery);
      const accountId = remoteId(account.id), handle = string(account.username, 30);
      if (handle.toLowerCase() !== config.handle.toLowerCase()) throw new Error("Instagram account mismatch");
      const data = record(account.media);
      if (!Array.isArray(data.data) || data.data.length > 50) throw new Error("Instagram media unavailable");
      const posts: SocialPostInput[] = data.data.map(value => {
        const row = record(value), externalId = remoteId(row.id);
        if (row.caption !== undefined && typeof row.caption !== "string") throw new Error("Invalid Instagram caption");
        return { externalId, text: (row.caption as string | undefined) ?? "", publishedAt: new Date(string(row.timestamp)),
          permalink: string(row.permalink), editIds: [externalId], metrics: counts(row, ["like_count", "comments_count"]) };
      });
      const paging = data.paging === undefined ? {} : record(data.paging);
      // Never follow paging.next: it can embed credentials. Rebuild our fixed-host request.
      const nextCursor = paging.next ? checkedCursor(string(record(paging.cursors).after, 2048)) : null;
      return { accountId, handle, posts, nextCursor };
    };
    const page = await fetchMedia(cursor);
    const recent = cursor ? await fetchMedia(null) : page;
    if (recent.accountId !== page.accountId) throw new Error("Instagram identity changed during scan");
    return { ...page, posts: [...new Map([...page.posts, ...recent.posts].map(p => [p.externalId, p])).values()] };
  } };
}
