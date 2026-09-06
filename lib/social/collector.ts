import type { PrismaClient } from "@prisma/client";
import { validateSocialPage, type SocialProvider } from "./provider";
import { extractMentions } from "./research";

export async function collectSocial(db: PrismaClient, provider: SocialProvider, signal: AbortSignal) {
  const id = provider.platform + ":" + provider.handle.toLowerCase();
  const state = await db.socialSource.upsert({ where: { id }, create: { id, platform: provider.platform, handle: provider.handle }, update: {} });
  const page = await provider.fetchPage(state.cursor, signal);
  const observedAt = new Date();
  validateSocialPage(provider, page, observedAt);
  if (state.remoteAccountId && state.remoteAccountId !== page.accountId) throw new Error("Social identity changed; manual review required");
  const bucket = new Date(Math.floor(observedAt.getTime() / 300_000) * 300_000);
  return db.$transaction(async tx => {
    const updated = await tx.socialSource.updateMany({ where: { id, revision: state.revision },
      data: { remoteAccountId: page.accountId, cursor: page.nextCursor, revision: { increment: 1 }, lastSuccessAt: observedAt } });
    if (updated.count !== 1) throw new Error("Concurrent social collection; retry");
    let observations = 0;
    for (const input of page.posts) {
      const post = await tx.socialPost.upsert({ where: { sourceId_externalId: { sourceId: id, externalId: input.externalId } },
        create: { sourceId: id, externalId: input.externalId, publishedAt: input.publishedAt, firstObservedAt: observedAt, permalink: input.permalink }, update: {} });
      if (post.publishedAt.getTime() !== input.publishedAt.getTime()) throw new Error("Post publication timestamp changed");
      const result = await tx.socialPostObservation.createMany({ data: [{ postId: post.id, observedAt, bucket,
        text: input.text, metrics: input.metrics, mentions: extractMentions(input.text), editIds: input.editIds }], skipDuplicates: true });
      observations += result.count;
    }
    return { source: id, status: "collected", posts: page.posts.length, observations, historyPending: page.nextCursor !== null };
  }, { timeout: 20_000 });
}

