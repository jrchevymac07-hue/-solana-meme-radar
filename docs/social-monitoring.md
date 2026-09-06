# Social research monitoring

PonsVault (https://x.com/PonsVault) is a separate user-supplied project account. It is not linked to Unipcs. The supplied address 0xfdae23ce76018da62507bb5ef20e6ef5450e8312 is retained as an unverified address candidate; its chain and whether it represents a token, wallet, or contract are unknown. No Instagram profile has been supplied.

## Implemented
- Official X public timeline adapter, excluding reposts and including replies. Resolves and pins numeric account ID; an ownership change stops ingestion.
- Meta Instagram Business Discovery adapter for eligible professional accounts using a configured Graph API version. No private/consumer account or scraping fallback.
- Separate social tables and additive migration. Immutable publication/first-observation timestamps; one text/engagement sample per post per five-minute bucket. First sample wins on retries. Edited X IDs retained for downstream deduplication.
- Bounded history pagination with latest-page refresh each run. Cursor updates and observations commit together; failed pages do not advance. API errors are redacted. Fixed API hosts and header-only credentials; never follow credential-bearing pagination URLs.
- Authenticated collection and recent-post endpoints; independent opt-in GitHub schedule.
- Unverified address/cashtag extraction and as-of research hook with score adjustment zero. No live trading or changes to market snapshot/outcome collection.

## Activation
Deploy the reviewed PR and run Prisma migrations. In the server environment configure:
- SOCIAL_MONITORING_ENABLED=true and a new SOCIAL_CRON_SECRET.
- X_MONITOR_HANDLE=PonsVault and X_BEARER_TOKEN from an X developer project with timeline read access and adequate API credits/limits.
- For Instagram: INSTAGRAM_MONITOR_HANDLE, INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_VIEWER_ACCOUNT_ID (your eligible professional Instagram account linked to a Facebook Page), META_GRAPH_VERSION (a currently supported version). Configure Meta application permissions/review appropriate to Business Discovery. A browser login alone does not grant server API access.

Set GitHub repository variable SOCIAL_MONITORING_ENABLED=true and GitHub secret SOCIAL_CRON_SECRET to the same value. Run Social Research Collector manually first. Inspect authenticated GET /api/social/posts for lastSuccessAt, account IDs and actual observations before relying on the schedule. The scheduler calls POST /api/cron/social approximately every five minutes; GitHub scheduling can be delayed.

Missing Instagram configuration is reported separately and does not prevent configured X collection. Source failures return HTTP 503 while independent successful sources retain their committed data. Both features are disabled by default. API tokens belong only in deployment secrets, never in chat or source control.

## Limits and interpretation
This is code readiness, not a verified live connection. No production credentials, migration, paid API purchase, or production activation was performed during implementation. The source configuration status explicitly says configured_not_verified until observed data/lastSuccessAt demonstrate successful access.

X timeline history is API limited (up to its supported recent timeline window); this is not a guaranteed complete archive. The first page is refreshed during backfill; extremely high posting volumes can outrun polling. Expired cursors stop collection and require operator review/reset; never silently skip. Instagram results depend on account eligibility and app permissions. Text/captions only: no image/video OCR, Stories, private content, or Instagram personal-account access. Old posts are refreshed as pagination cycles; engagement histories are sampled, not complete.

Published timestamps differ from when the system learned about a post. Research must use observedAt as well as publishedAt, and deduplicate X edit-history IDs before counting distinct posts. Mentions alone do not establish endorsement, ownership, token identity, or predict virality. No social weighting is enabled. Platform deletions are not inferred from missing timeline entries; before operating the dataset, implement retention/deletion handling required by your approved API access terms.

Official references:
- https://docs.x.com/x-api/posts/timelines/integrate
- https://docs.x.com/x-api/users/get-user-by-username
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api

