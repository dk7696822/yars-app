import axios from "axios";
import { attachAuthInterceptors } from "./api";

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});
attachAuthInterceptors(api);

/**
 * Unwrap a paginated response.
 * The backend envelope is { success, message, data: { data: [...], pagination: {...} } },
 * so the rows live two levels down. Always go through this rather than digging
 * into the axios response by hand.
 */
const unwrapPaginated = (response) => ({
  rows: response.data.data.data,
  pagination: response.data.data.pagination,
});

/** Unwrap a plain (non-paginated) response. */
const unwrap = (response) => response.data.data;

// --- Categories (never paginated) ---
export const inventoryCategoryAPI = {
  getAll: async (params) => unwrap(await api.get("/inventory-categories", { params })),
  getById: async (id) => unwrap(await api.get(`/inventory-categories/${id}`)),
  create: (data) => api.post("/inventory-categories", data),
  update: (id, data) => api.put(`/inventory-categories/${id}`, data),
  delete: (id) => api.delete(`/inventory-categories/${id}`),
};

// --- Item attributes (never paginated — small master list, values nested) ---
export const itemAttributesAPI = {
  getAll: async () => unwrap(await api.get("/item-attributes")),
  create: (data) => api.post("/item-attributes", data),
  update: (id, data) => api.put(`/item-attributes/${id}`, data),
  delete: (id) => api.delete(`/item-attributes/${id}`),
  createValue: (attributeId, data) => api.post(`/item-attributes/${attributeId}/values`, data),
  updateValue: (valueId, data) => api.put(`/item-attributes/values/${valueId}`, data),
  deleteValue: (valueId) => api.delete(`/item-attributes/values/${valueId}`),
};

// --- Suppliers ---
export const supplierAPI = {
  getAll: async (params) => unwrapPaginated(await api.get("/suppliers", { params })),
  /** Unpaginated — for dropdowns. */
  getAllForPicker: async () => unwrap(await api.get("/suppliers", { params: { all: "true" } })),
  getById: async (id) => unwrap(await api.get(`/suppliers/${id}`)),
  create: (data) => api.post("/suppliers", data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
};

// --- Items ---
export const inventoryItemAPI = {
  getAll: async (params) => unwrapPaginated(await api.get("/inventory-items", { params })),
  /** Unpaginated — for item pickers. */
  getAllForPicker: async () => unwrap(await api.get("/inventory-items", { params: { all: "true" } })),
  getById: async (id) => unwrap(await api.get(`/inventory-items/${id}`)),
  create: (data) => api.post("/inventory-items", data),
  update: (id, data) => api.put(`/inventory-items/${id}`, data),
  delete: (id) => api.delete(`/inventory-items/${id}`),
};

// --- Purchase orders ---
export const purchaseOrderAPI = {
  getAll: async (params) => unwrapPaginated(await api.get("/purchase-orders", { params })),
  getById: async (id) => unwrap(await api.get(`/purchase-orders/${id}`)),
  create: (data) => api.post("/purchase-orders", data),
  update: (id, data) => api.put(`/purchase-orders/${id}`, data),
  delete: (id) => api.delete(`/purchase-orders/${id}`),
  receive: (id, data) => api.post(`/purchase-orders/${id}/receive`, data),
};

// --- Goods receipts ---
export const goodsReceiptAPI = {
  getAll: async (params) => unwrapPaginated(await api.get("/goods-receipts", { params })),
  getById: async (id) => unwrap(await api.get(`/goods-receipts/${id}`)),
  create: (data) => api.post("/goods-receipts", data),
};

// --- Stock issues / wastage / adjustments ---
export const stockIssueAPI = {
  getAll: async (params) => unwrapPaginated(await api.get("/stock-issues", { params })),
  getById: async (id) => unwrap(await api.get(`/stock-issues/${id}`)),
  create: (data) => api.post("/stock-issues", data),
};

// --- Stock ---
export const stockAPI = {
  getStock: async (params) => unwrapPaginated(await api.get("/stock", { params })),
  getSummary: async () => unwrap(await api.get("/stock/summary")),
  getItemStock: async (itemId) => unwrap(await api.get(`/stock/${itemId}`)),
  getItemMovements: async (itemId, params) =>
    unwrapPaginated(await api.get(`/stock/${itemId}/movements`, { params })),
};

// --- Export ---
export const inventoryExportAPI = {
  download: (params) => api.get("/export/inventory", { params, responseType: "blob" }),
};
