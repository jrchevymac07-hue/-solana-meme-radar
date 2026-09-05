-- CreateTable
CREATE TABLE "SocialSource" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "remoteAccountId" TEXT,
    "cursor" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),

    CONSTRAINT "SocialSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "firstObservedAt" TIMESTAMP(3) NOT NULL,
    "permalink" TEXT NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPostObservation" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "bucket" TIMESTAMP(3) NOT NULL,
    "text" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "mentions" JSONB NOT NULL,
    "editIds" JSONB NOT NULL,

    CONSTRAINT "SocialPostObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialPost_firstObservedAt_idx" ON "SocialPost"("firstObservedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPost_sourceId_externalId_key" ON "SocialPost"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "SocialPostObservation_observedAt_idx" ON "SocialPostObservation"("observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPostObservation_postId_bucket_key" ON "SocialPostObservation"("postId", "bucket");

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SocialSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPostObservation" ADD CONSTRAINT "SocialPostObservation_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
