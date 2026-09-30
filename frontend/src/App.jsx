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
import Legacy from "./app/Legacy";
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
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Dues = lazy(() => import("./pages/Dues"));
const Assistant = lazy(() => import("./pages/Assistant"));
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
const Stock = lazy(() => import("./pages/Stock"));
const StockItemDetail = lazy(() => import("./pages/StockItemDetail"));
const InventoryItems = lazy(() => import("./pages/InventoryItems"));
const CreateInventoryItem = lazy(() => import("./pages/CreateInventoryItem"));
const EditInventoryItem = lazy(() => import("./pages/EditInventoryItem"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const CreatePurchaseOrder = lazy(() => import("./pages/CreatePurchaseOrder"));
const PurchaseOrderDetail = lazy(() => import("./pages/PurchaseOrderDetail"));
const ReceivePurchaseOrder = lazy(() => import("./pages/ReceivePurchaseOrder"));
const StockIssues = lazy(() => import("./pages/StockIssues"));
const CreateStockIssue = lazy(() => import("./pages/CreateStockIssue"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const CreateSupplier = lazy(() => import("./pages/CreateSupplier"));
const EditSupplier = lazy(() => import("./pages/EditSupplier"));
const SupplierDetail = lazy(() => import("./pages/SupplierDetail"));
const InventoryCategories = lazy(() => import("./pages/InventoryCategories"));
const ItemAttributes = lazy(() => import("./pages/ItemAttributes"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** A page that hasn't been redesigned yet keeps its old look. */
const old = (page) => <Legacy>{page}</Legacy>;

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
                    <Route path="/login" element={old(<Login />)} />

                    <Route element={<ProtectedRoute />}>
                      <Route path="/" element={<MainLayout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="assistant" element={old(<Assistant />)} />
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
                          <Route index element={old(<Stock />)} />
                          <Route path=":itemId" element={old(<StockItemDetail />)} />
                        </Route>

                        <Route path="inventory-items">
                          <Route index element={old(<InventoryItems />)} />
                          <Route path="new" element={old(<CreateInventoryItem />)} />
                          <Route path="edit/:id" element={old(<EditInventoryItem />)} />
                        </Route>

                        <Route path="purchase-orders">
                          <Route index element={old(<PurchaseOrders />)} />
                          <Route path="new" element={old(<CreatePurchaseOrder />)} />
                          <Route path=":id" element={old(<PurchaseOrderDetail />)} />
                          <Route path=":id/receive" element={old(<ReceivePurchaseOrder />)} />
                        </Route>

                        <Route path="stock-issues">
                          <Route index element={old(<StockIssues />)} />
                          <Route path="new" element={old(<CreateStockIssue />)} />
                        </Route>

                        <Route path="suppliers">
                          <Route index element={old(<Suppliers />)} />
                          <Route path="new" element={old(<CreateSupplier />)} />
                          <Route path="edit/:id" element={old(<EditSupplier />)} />
                          <Route path=":id" element={old(<SupplierDetail />)} />
                        </Route>

                        <Route path="inventory-categories" element={old(<InventoryCategories />)} />
                        <Route path="item-attributes" element={old(<ItemAttributes />)} />

                        <Route path="*" element={old(<NotFound />)} />
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
