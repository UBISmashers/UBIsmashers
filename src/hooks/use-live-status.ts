import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@/lib/api";

const publicApi = createApiClient(() => null, () => {});

export const LIVE_STATUS_QUERY_KEY = ["youtubeLiveStatus"] as const;

export function useLiveStatus() {
  return useQuery({
    queryKey: LIVE_STATUS_QUERY_KEY,
    queryFn: () => publicApi.getYouTubeLiveStatus(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 1,
    staleTime: 25_000,
  });
}
