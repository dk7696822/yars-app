import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Customer API
export const customerAPI = {
  getAll: (params) => api.get("/customers", { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post("/customers", data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
};

// Product Size API
export const productSizeAPI = {
  getAll: (params) => api.get("/product-sizes", { params }),
  getById: (id) => api.get(`/product-sizes/${id}`),
  create: (data) => api.post("/product-sizes", data),
  update: (id, data) => api.put(`/product-sizes/${id}`, data),
  delete: (id) => api.delete(`/product-sizes/${id}`),
};

// Plate Type API
export const plateTypeAPI = {
  getAll: (params) => api.get("/plate-types", { params }),
  getById: (id) => api.get(`/plate-types/${id}`),
  create: (data) => api.post("/plate-types", data),
  update: (id, data) => api.put(`/plate-types/${id}`, data),
  delete: (id) => api.delete(`/plate-types/${id}`),
};

// Order API
export const orderAPI = {
  getAll: (params) => api.get("/orders", { params }),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post("/orders", data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  delete: (id) => api.delete(`/orders/${id}`),
};

export default api;
