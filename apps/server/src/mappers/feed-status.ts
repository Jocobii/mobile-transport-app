import type { FeedStatusDto } from "@transit/contracts";
import type { FeedStatus } from "@transit/core";

export function mapFeedStatus(status: FeedStatus): FeedStatusDto {
  return {
    feedId: status.feedId,
    ok: status.ok,
    dataTimestamp: status.dataTimestamp,
    fetchedAt: status.fetchedAt,
  };
}
