import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerAPI } from "../../services/api";
import { keys, invalidateMoney } from "../../lib/queryKeys";

const body = (res) => res.data.data;
const notFound = (err) => err?.response?.status === 404;

/** Customers screen / pickers: 100 per page (rows are small). */
export const useDirectory = (params) =>
  useInfiniteQuery({
    queryKey: keys.customers.directory(params),
    queryFn: ({ pageParam }) => customerAPI.directory({ ...params, page: pageParam, limit: 100 }).then(body),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: (previous) => previous,
  });

export const useCustomerSummary = (id) =>
  useQuery({ queryKey: keys.customers.summary(id), queryFn: () => customerAPI.summary(id).then(body), enabled: Boolean(id), retry: (n, err) => !notFound(err) && n < 1 });

export const useCustomer = (id) =>
  useQuery({ queryKey: keys.customers.detail(id), queryFn: () => customerAPI.getById(id).then(body), enabled: Boolean(id), retry: (n, err) => !notFound(err) && n < 1 });

/** "Already a customer?" while typing — from 3 letters. */
export const useSimilar = (name, excludeId) => {
  const term = name.trim();
  return useQuery({
    queryKey: keys.customers.similar(term, excludeId),
    queryFn: () => customerAPI.similar({ name: term, excludeId }).then(body),
    enabled: term.length >= 3,
    staleTime: 60_000,
  });
};

/** A rename shows on orders and invoices too, so everything with money refreshes. */
export const useSaveCustomer = (id) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload) => (id ? customerAPI.update(id, payload) : customerAPI.create(payload)).then(body), onSuccess: () => invalidateMoney(qc) });
};

export const useDeleteCustomer = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => customerAPI.delete(id), onSuccess: () => invalidateMoney(qc) });
};
