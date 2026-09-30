import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { queryClient } from "./lib/queryClient";
import MainLayout from "./components/layout/MainLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { PageSkeleton } from "./ui/States";
import "./assets/styles/index.css";
import "./styles/button-override.css";
import "./styles/datepicker-override.css";
import "./styles/datepicker-dark.css";
import "./styles/select-override.css";
import "./styles/history-animations.css";
import "./styles/page-animations.css";
import "./styles/dark-theme.css";

// Each page is its own chunk: opening the app only downloads what it shows.
const LoginPage = lazy(() => import("./features/auth/LoginPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Dues = lazy(() => import("./pages/Dues"));
const AssistantPage = lazy(() => import("./features/assistant/AssistantPage"));
const OrdersPage = lazy(() => import("./features/orders/OrdersPage"));
const OrderFormPage = lazy(() => import("./features/orders/form/OrderFormPage"));
const OrderPage = lazy(() => import("./features/orders/OrderPage"));
const CustomersPage = lazy(() => import("./features/customers/CustomersPage"));
const CustomerFormPage = lazy(() => import("./features/customers/CustomerFormPage"));
const CustomerPage = lazy(() => import("./features/customers/CustomerPage"));
const PlateTypesPage = lazy(() => import("./features/catalog/PlateTypesPage"));
const PlateFormPage = lazy(() => import("./features/catalog/PlateFormPage"));
const SizesPage = lazy(() => import("./features/catalog/SizesPage"));
const SizeFormPage = lazy(() => import("./features/catalog/SizeFormPage"));
const ExpensesPage = lazy(() => import("./features/expenses/ExpensesPage"));
const ExpenseFormPage = lazy(() => import("./features/expenses/ExpenseFormPage"));
const ExpenseCategoriesPage = lazy(() => import("./features/expenses/ExpenseCategoriesPage"));
const InvoicesPage = lazy(() => import("./features/invoices/InvoicesPage"));
const NewInvoicePage = lazy(() => import("./features/invoices/NewInvoicePage"));
const InvoicePage = lazy(() => import("./features/invoices/InvoicePage"));
const HistoryPage = lazy(() => import("./features/history/HistoryPage"));
const StockPage = lazy(() => import("./features/inventory/StockPage"));
const StockItemPage = lazy(() => import("./features/inventory/StockItemPage"));
const ItemsPage = lazy(() => import("./features/inventory/ItemsPage"));
const ItemFormPage = lazy(() => import("./features/inventory/ItemFormPage"));
const PurchaseOrdersPage = lazy(() => import("./features/inventory/PurchaseOrdersPage"));
const NewPurchaseOrderPage = lazy(() => import("./features/inventory/NewPurchaseOrderPage"));
const PurchaseOrderPage = lazy(() => import("./features/inventory/PurchaseOrderPage"));
const ReceivePage = lazy(() => import("./features/inventory/ReceivePage"));
const StockIssuesPage = lazy(() => import("./features/inventory/StockIssuesPage"));
const NewStockIssuePage = lazy(() => import("./features/inventory/NewStockIssuePage"));
const SuppliersPage = lazy(() => import("./features/inventory/SuppliersPage"));
const SupplierFormPage = lazy(() => import("./features/inventory/SupplierFormPage"));
const SupplierPage = lazy(() => import("./features/inventory/SupplierPage"));
const InventoryCategoriesPage = lazy(() => import("./features/inventory/InventoryCategoriesPage"));
const ItemAttributesPage = lazy(() => import("./features/inventory/ItemAttributesPage"));
const NotFoundPage = lazy(() => import("./app/NotFoundPage"));

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <ToastProvider>
            <AuthProvider>
              <Router>
                <Suspense fallback={<PageSkeleton />}>
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />

                    <Route element={<ProtectedRoute />}>
                      <Route path="/" element={<MainLayout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="assistant" element={<AssistantPage />} />
                        <Route path="dues" element={<Dues />} />

                        <Route path="orders">
                          <Route index element={<OrdersPage />} />
                          <Route path="new" element={<OrderFormPage />} />
                          <Route path="edit/:id" element={<OrderFormPage />} />
                          <Route path=":id" element={<OrderPage />} />
                        </Route>

                        <Route path="customers">
                          <Route index element={<CustomersPage />} />
                          <Route path="new" element={<CustomerFormPage />} />
                          <Route path="edit/:id" element={<CustomerFormPage />} />
                          <Route path=":id" element={<CustomerPage />} />
                        </Route>

                        <Route path="plate-types">
                          <Route index element={<PlateTypesPage />} />
                          <Route path="new" element={<PlateFormPage />} />
                          <Route path="edit/:id" element={<PlateFormPage />} />
                        </Route>

                        <Route path="product-sizes">
                          <Route index element={<SizesPage />} />
                          <Route path="new" element={<SizeFormPage />} />
                          <Route path="edit/:id" element={<SizeFormPage />} />
                        </Route>

                        <Route path="expenses">
                          <Route index element={<ExpensesPage />} />
                          <Route path="new" element={<ExpenseFormPage />} />
                          <Route path="edit/:id" element={<ExpenseFormPage />} />
                        </Route>

                        <Route path="expense-categories">
                          <Route index element={<ExpenseCategoriesPage />} />
                          <Route path="new" element={<Navigate to="/expense-categories" replace />} />
                          <Route path="edit/:id" element={<Navigate to="/expense-categories" replace />} />
                        </Route>

                        <Route path="invoices">
                          <Route index element={<InvoicesPage />} />
                          <Route path="new" element={<NewInvoicePage />} />
                          <Route path="generate" element={<Navigate to="/invoices/new" replace />} />
                          <Route path=":id" element={<InvoicePage />} />
                        </Route>

                        <Route path="history" element={<HistoryPage />} />

                        <Route path="stock">
                          <Route index element={<StockPage />} />
                          <Route path=":itemId" element={<StockItemPage />} />
                        </Route>

                        <Route path="inventory-items">
                          <Route index element={<ItemsPage />} />
                          <Route path="new" element={<ItemFormPage />} />
                          <Route path="edit/:id" element={<ItemFormPage />} />
                        </Route>

                        <Route path="purchase-orders">
                          <Route index element={<PurchaseOrdersPage />} />
                          <Route path="new" element={<NewPurchaseOrderPage />} />
                          <Route path=":id" element={<PurchaseOrderPage />} />
                          <Route path=":id/receive" element={<ReceivePage />} />
                        </Route>

                        <Route path="stock-issues">
                          <Route index element={<StockIssuesPage />} />
                          <Route path="new" element={<NewStockIssuePage />} />
                        </Route>

                        <Route path="suppliers">
                          <Route index element={<SuppliersPage />} />
                          <Route path="new" element={<SupplierFormPage />} />
                          <Route path="edit/:id" element={<SupplierFormPage />} />
                          <Route path=":id" element={<SupplierPage />} />
                        </Route>

                        <Route path="inventory-categories" element={<InventoryCategoriesPage />} />
                        <Route path="item-attributes" element={<ItemAttributesPage />} />

                        <Route path="*" element={<NotFoundPage />} />
                      </Route>
                    </Route>
                  </Routes>
                </Suspense>
              </Router>
            </AuthProvider>
          </ToastProvider>
        </MotionConfig>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
