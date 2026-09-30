import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentAPI } from "../../services/api";
import { invalidateMoney } from "../../lib/queryKeys";

export const useSavePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => (id ? paymentAPI.update(id, body) : paymentAPI.create(body)).then((r) => r.data.data),
    onSuccess: () => invalidateMoney(qc),
  });
};

export const useDeletePayment = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => paymentAPI.delete(id), onSuccess: () => invalidateMoney(qc) });
};
