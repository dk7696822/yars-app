import api from "./api";

export const dashboardAPI = {
  overview: () => api.get("/dashboard/overview"),
  period: (params) => api.get("/dashboard/period", { params }),
  trends: () => api.get("/dashboard/trends"),
};
