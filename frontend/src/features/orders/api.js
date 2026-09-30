import { useInfiniteQuery } from "@tanstack/react-query";
import { orderAPI } from "../../services/api";
import { keys } from "../../lib/queryKeys";

export const body = (res) => res.data.data;

/** Orders screen, 30 per page. While a new filter loads, the previous list stays (dimmed). */
export const useOrderList = (params) =>
  useInfiniteQuery({
    queryKey: keys.orders.list(params),
    queryFn: ({ pageParam }) => orderAPI.list({ ...params, page: pageParam, limit: 30 }).then(body),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: (previous) => previous,
  });
