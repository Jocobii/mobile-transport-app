import type { FeedStatus } from "@transit/core";
import type { FeedStatusDto } from "@transit/contracts";

export function mapFeedStatus(status: FeedStatus): FeedStatusDto {
  return {
    feedId: status.feedId,
    ok: status.ok,
    dataTimestamp: status.dataTimestamp,
    fetchedAt: status.fetchedAt,
  };
}
