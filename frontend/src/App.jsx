import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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
const Orders = lazy(() => import("./pages/Orders"));
const CreateOrder = lazy(() => import("./pages/CreateOrder"));
const EditOrder = lazy(() => import("./pages/EditOrder"));
const OrderDetails = lazy(() => import("./pages/OrderDetails"));
const Customers = lazy(() => import("./pages/Customers"));
const CreateCustomer = lazy(() => import("./pages/CreateCustomer"));
const CustomerDetails = lazy(() => import("./pages/CustomerDetails"));
const EditCustomer = lazy(() => import("./pages/EditCustomer"));
const PlateTypes = lazy(() => import("./pages/PlateTypes"));
const CreatePlateType = lazy(() => import("./pages/CreatePlateType"));
const EditPlateType = lazy(() => import("./pages/EditPlateType"));
const ProductSizes = lazy(() => import("./pages/ProductSizes"));
const CreateProductSize = lazy(() => import("./pages/CreateProductSize"));
const EditProductSize = lazy(() => import("./pages/EditProductSize"));
const Expenses = lazy(() => import("./pages/Expenses"));
const CreateExpense = lazy(() => import("./pages/CreateExpense"));
const EditExpense = lazy(() => import("./pages/EditExpense"));
const ExpenseCategories = lazy(() => import("./pages/ExpenseCategories"));
const CreateExpenseCategory = lazy(() => import("./pages/CreateExpenseCategory"));
const EditExpenseCategory = lazy(() => import("./pages/EditExpenseCategory"));
const Invoices = lazy(() => import("./pages/Invoices"));
const GenerateInvoice = lazy(() => import("./pages/GenerateInvoice"));
const InvoiceDetails = lazy(() => import("./pages/InvoiceDetails"));
const History = lazy(() => import("./pages/History"));
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
                          <Route index element={old(<Orders />)} />
                          <Route path="new" element={old(<CreateOrder />)} />
                          <Route path="edit/:id" element={old(<EditOrder />)} />
                          <Route path=":id" element={old(<OrderDetails />)} />
                        </Route>

                        <Route path="customers">
                          <Route index element={old(<Customers />)} />
                          <Route path="new" element={old(<CreateCustomer />)} />
                          <Route path="edit/:id" element={old(<EditCustomer />)} />
                          <Route path=":id" element={old(<CustomerDetails />)} />
                        </Route>

                        <Route path="plate-types">
                          <Route index element={old(<PlateTypes />)} />
                          <Route path="new" element={old(<CreatePlateType />)} />
                          <Route path="edit/:id" element={old(<EditPlateType />)} />
                        </Route>

                        <Route path="product-sizes">
                          <Route index element={old(<ProductSizes />)} />
                          <Route path="new" element={old(<CreateProductSize />)} />
                          <Route path="edit/:id" element={old(<EditProductSize />)} />
                        </Route>

                        <Route path="expenses">
                          <Route index element={old(<Expenses />)} />
                          <Route path="new" element={old(<CreateExpense />)} />
                          <Route path="edit/:id" element={old(<EditExpense />)} />
                        </Route>

                        <Route path="expense-categories">
                          <Route index element={old(<ExpenseCategories />)} />
                          <Route path="new" element={old(<CreateExpenseCategory />)} />
                          <Route path="edit/:id" element={old(<EditExpenseCategory />)} />
                        </Route>

                        <Route path="invoices">
                          <Route index element={old(<Invoices />)} />
                          <Route path="generate" element={old(<GenerateInvoice />)} />
                          <Route path=":id" element={old(<InvoiceDetails />)} />
                        </Route>

                        <Route path="history" element={old(<History />)} />

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
