import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orderAPI, productSizeAPI, plateTypeAPI } from "../../services/api";
import { keys, invalidateMoney } from "../../lib/queryKeys";

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

const notFound = (err) => err?.response?.status === 404;

export const useOrder = (id) =>
  useQuery({
    queryKey: keys.orders.detail(id),
    queryFn: () => orderAPI.getById(id).then(body),
    enabled: Boolean(id),
    retry: (count, err) => !notFound(err) && count < 1,
  });

export const useOrderStatus = (id) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (status) => orderAPI.update(id, { status }).then(body), onSuccess: () => invalidateMoney(qc) });
};

export const useDeleteOrder = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => orderAPI.delete(id), onSuccess: () => invalidateMoney(qc) });
};

/** Sizes and plate types change rarely: cached for 5 minutes. */
export const useSizes = () => useQuery({ queryKey: keys.catalog.sizes, queryFn: () => productSizeAPI.getAll().then(body), staleTime: 5 * 60_000 });
export const usePlates = () => useQuery({ queryKey: keys.catalog.plates, queryFn: () => plateTypeAPI.getAll().then(body), staleTime: 5 * 60_000 });

export const useSaveOrder = (id) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload) => (id ? orderAPI.update(id, payload) : orderAPI.create(payload)).then(body), onSuccess: () => invalidateMoney(qc) });
};
