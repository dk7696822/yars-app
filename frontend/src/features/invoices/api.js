import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoiceAPI, orderAPI } from "../../services/api";
import { keys, invalidateMoney } from "../../lib/queryKeys";

const body = (res) => res.data.data;
const notFound = (err) => err?.response?.status === 404;

export const useInvoiceList = (params) =>
  useInfiniteQuery({
    queryKey: keys.invoices.list(params),
    queryFn: ({ pageParam }) => invoiceAPI.list({ ...params, page: pageParam, limit: 30 }).then(body),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: (previous) => previous,
  });

export const useInvoice = (id) =>
  useQuery({ queryKey: keys.invoices.detail(id), queryFn: () => invoiceAPI.getById(id).then(body), enabled: Boolean(id), retry: (n, err) => !notFound(err) && n < 1 });

export const useInvoiceStatus = (id) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (status) => invoiceAPI.updateStatus(id, { status }), onSuccess: () => invalidateMoney(qc) });
};

export const useDeleteInvoice = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => invoiceAPI.delete(id), onSuccess: () => invalidateMoney(qc) });
};

/** A customer's orders not yet on an invoice (full orders, so totals use orderMath). */
export const useUnbilledOrders = (customerId) =>
  useQuery({ queryKey: keys.orders.unbilled(customerId), queryFn: () => orderAPI.getAll({ customer_id: customerId, invoice_id: "null" }).then(body), enabled: Boolean(customerId) });

export const useGenerateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload) => invoiceAPI.generate(payload).then(body), onSuccess: () => invalidateMoney(qc) });
};
