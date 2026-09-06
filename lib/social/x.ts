import { checkedCursor, checkedHandle, counts, record, remoteId, socialJson, string, type SocialPage, type SocialPostInput, type SocialProvider } from "./provider";

export function createXProvider(handle: string, token: string, transport: typeof fetch = fetch): SocialProvider {
  checkedHandle(handle, "x");
  return { platform: "x", handle, async fetchPage(cursor, signal): Promise<SocialPage> {
    checkedCursor(cursor);
    const identity = record((await socialJson(new URL(`https://api.x.com/2/users/by/username/${handle}`), token, signal, transport)).data);
    const accountId = remoteId(identity.id), actualHandle = string(identity.username, 15);
    if (actualHandle.toLowerCase() !== handle.toLowerCase()) throw new Error("X account mismatch");
    const fetchPosts = async (pageToken: string | null) => {
      const url = new URL(`https://api.x.com/2/users/${accountId}/tweets`);
      url.searchParams.set("max_results", "100");
      url.searchParams.set("exclude", "retweets");
      url.searchParams.set("tweet.fields", "author_id,created_at,public_metrics,edit_history_tweet_ids");
      if (pageToken) url.searchParams.set("pagination_token", pageToken);
      const body = await socialJson(url, token, signal, transport);
      const meta = record(body.meta);
      const raw = body.data ?? [];
      if (!Array.isArray(raw) || raw.length > 100 || meta.result_count !== raw.length) throw new Error("Invalid X timeline");
      const posts: SocialPostInput[] = raw.map(value => {
        const row = record(value), externalId = remoteId(row.id);
        if (row.author_id !== accountId || typeof row.text !== "string") throw new Error("X post author mismatch");
        const editIds = row.edit_history_tweet_ids ?? [externalId];
        if (!Array.isArray(editIds)) throw new Error("Invalid X edit history");
        return { externalId, text: row.text, publishedAt: new Date(string(row.created_at)),
          permalink: `https://x.com/${actualHandle}/status/${externalId}`, editIds: editIds.map(remoteId),
          metrics: counts(row.public_metrics, ["like_count", "retweet_count", "reply_count", "quote_count", "bookmark_count", "impression_count"]) };
      });
      const nextCursor = meta.next_token === undefined ? null : checkedCursor(string(meta.next_token, 2048));
      return { posts, nextCursor };
    };
    const page = await fetchPosts(cursor);
    // Refresh latest posts during history traversal so metrics/current posts do not starve.
    const recent = cursor ? await fetchPosts(null) : page;
    const posts = [...new Map([...page.posts, ...recent.posts].map(p => [p.externalId, p])).values()];
    return { accountId, handle: actualHandle, posts, nextCursor: page.nextCursor };
  } };
}
