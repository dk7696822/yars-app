import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expenseAPI, expenseCategoryAPI } from "../../services/api";
import { keys } from "../../lib/queryKeys";

const body = (res) => res.data.data;
const notFound = (err) => err?.response?.status === 404;
const refresh = (qc) => qc.invalidateQueries({ queryKey: keys.expenses.all });

export const useExpenses = (params) =>
  useQuery({ queryKey: keys.expenses.list(params), queryFn: () => expenseAPI.getAll(params).then(body), placeholderData: (previous) => previous });

export const useExpense = (id) =>
  useQuery({ queryKey: keys.expenses.detail(id), queryFn: () => expenseAPI.getById(id).then(body), enabled: Boolean(id), retry: (n, err) => !notFound(err) && n < 1 });

export const useExpenseCategories = () =>
  useQuery({ queryKey: keys.expenses.categories, queryFn: () => expenseCategoryAPI.getAll().then(body), staleTime: 5 * 60_000 });

export const useSaveExpense = (id) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload) => (id ? expenseAPI.update(id, payload) : expenseAPI.create(payload)).then(body), onSuccess: () => refresh(qc) });
};

export const useDeleteExpense = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id) => expenseAPI.delete(id), onSuccess: () => refresh(qc) });
};

/** For NameListEditor and the picker's "＋ New category". */
export const useCategoryMutations = () => {
  const qc = useQueryClient();
  return {
    add: async (name) => { const created = body(await expenseCategoryAPI.create({ name })); await refresh(qc); return created; },
    rename: async (item, name) => { await expenseCategoryAPI.update(item.id, { name }); await refresh(qc); },
    remove: async (item) => { await expenseCategoryAPI.delete(item.id); await refresh(qc); },
  };
};
