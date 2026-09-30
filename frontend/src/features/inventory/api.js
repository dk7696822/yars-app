import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { stockAPI, inventoryItemAPI, inventoryCategoryAPI, itemAttributesAPI, supplierAPI, purchaseOrderAPI, stockIssueAPI } from "../../services/inventoryAPI";
import { keys } from "../../lib/queryKeys";

const notFound = (err) => err?.response?.status === 404;
const retry = (n, err) => !notFound(err) && n < 1;

/** A paged list (the server pages at most 100). New filters keep the old list dimmed until they load. */
export const usePaged = (key, fetchPage, params, limit = 50, enabled = true) =>
  useInfiniteQuery({
    queryKey: key,
    enabled,
    queryFn: ({ pageParam }) => fetchPage({ ...params, page: pageParam, limit }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    placeholderData: (previous) => previous,
  });

export const rowsOf = (q) => (q.data?.pages || []).flatMap((p) => p.rows);

export const useStockList = (params, enabled = true) => usePaged(keys.stock.list(params), stockAPI.getStock, params, 50, enabled);
export const useStockSummary = () => useQuery({ queryKey: keys.stock.summary, queryFn: stockAPI.getSummary });
export const useItemStock = (id) => useQuery({ queryKey: keys.stock.item(id), queryFn: () => stockAPI.getItemStock(id), enabled: Boolean(id), retry });
export const useMovements = (id, params) => usePaged(keys.stock.movements(id, params), (p) => stockAPI.getItemMovements(id, p), params, 30);

export const useItemsPicker = () => useQuery({ queryKey: keys.items.picker, queryFn: inventoryItemAPI.getAllForPicker });
export const useItemList = (params) => usePaged(keys.items.list(params), inventoryItemAPI.getAll, params);
export const useItem = (id) => useQuery({ queryKey: keys.items.detail(id), queryFn: () => inventoryItemAPI.getById(id), enabled: Boolean(id), retry });
export const useInvCategories = () => useQuery({ queryKey: keys.inventory.categories, queryFn: () => inventoryCategoryAPI.getAll() });
export const useAttributes = () => useQuery({ queryKey: keys.inventory.attributes, queryFn: itemAttributesAPI.getAll });

export const useSupplierList = (params) => usePaged(keys.suppliers.list(params), supplierAPI.getAll, params);
export const useSuppliersPicker = () => useQuery({ queryKey: keys.suppliers.picker, queryFn: supplierAPI.getAllForPicker });
export const useSupplier = (id) => useQuery({ queryKey: keys.suppliers.detail(id), queryFn: () => supplierAPI.getById(id), enabled: Boolean(id), retry });

export const usePoList = (params) => usePaged(keys.purchaseOrders.list(params), purchaseOrderAPI.getAll, params, 30);
export const usePo = (id) => useQuery({ queryKey: keys.purchaseOrders.detail(id), queryFn: () => purchaseOrderAPI.getById(id), enabled: Boolean(id), retry });
export const useIssueList = (params) => usePaged(keys.stockIssues.list(params), stockIssueAPI.getAll, params, 30);

/** After anything that moves stock or changes a master list: refresh every inventory screen. */
export const refreshStock = (qc) =>
  Promise.all([keys.stock.all, keys.items.all, keys.purchaseOrders.all, keys.stockIssues.all, keys.suppliers.all, keys.inventory.categories, keys.inventory.attributes]
    .map((queryKey) => qc.invalidateQueries({ queryKey })));
