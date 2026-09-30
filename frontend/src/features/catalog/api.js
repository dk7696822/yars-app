import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productSizeAPI, plateTypeAPI } from "../../services/api";
import { keys, invalidateMoney } from "../../lib/queryKeys";

export { useSizes, usePlates } from "../orders/api";

const body = (res) => res.data.data;
const notFound = (err) => err?.response?.status === 404;

export const useSize = (id) =>
  useQuery({ queryKey: [...keys.catalog.sizes, id], queryFn: () => productSizeAPI.getById(id).then(body), enabled: Boolean(id), retry: (n, err) => !notFound(err) && n < 1 });

export const usePlate = (id) =>
  useQuery({ queryKey: [...keys.catalog.plates, id], queryFn: () => plateTypeAPI.getById(id).then(body), enabled: Boolean(id), retry: (n, err) => !notFound(err) && n < 1 });

/** A new weight can fill earlier pieces lines (their kg), so orders refresh too. */
export const useSaveSize = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => (id ? productSizeAPI.update(id, payload) : productSizeAPI.create(payload)).then(body),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: keys.catalog.sizes }), invalidateMoney(qc)]),
  });
};

export const useDeleteSize = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => productSizeAPI.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: keys.catalog.sizes }) });
};

/** Orders without their own plate charge use the plate type's charge, so a new charge changes their totals: refresh money too. */
export const useSavePlate = (id) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => (id ? plateTypeAPI.update(id, payload) : plateTypeAPI.create(payload)).then(body),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: keys.catalog.plates }), invalidateMoney(qc)]),
  });
};

export const useDeletePlate = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => plateTypeAPI.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: keys.catalog.plates }) });
};
