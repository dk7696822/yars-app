import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import CreateOrder from "./pages/CreateOrder";
import EditOrder from "./pages/EditOrder";
import OrderDetails from "./pages/OrderDetails";
import Customers from "./pages/Customers";
import CreateCustomer from "./pages/CreateCustomer";
import CustomerDetails from "./pages/CustomerDetails";
import EditCustomer from "./pages/EditCustomer";
import PlateTypes from "./pages/PlateTypes";
import CreatePlateType from "./pages/CreatePlateType";
import EditPlateType from "./pages/EditPlateType";
import ProductSizes from "./pages/ProductSizes";
import CreateProductSize from "./pages/CreateProductSize";
import EditProductSize from "./pages/EditProductSize";
import Expenses from "./pages/Expenses";
import CreateExpense from "./pages/CreateExpense";
import EditExpense from "./pages/EditExpense";
import ExpenseCategories from "./pages/ExpenseCategories";
import CreateExpenseCategory from "./pages/CreateExpenseCategory";
import EditExpenseCategory from "./pages/EditExpenseCategory";
import Invoices from "./pages/Invoices";
import GenerateInvoice from "./pages/GenerateInvoice";
import InvoiceDetails from "./pages/InvoiceDetails";
import NotFound from "./pages/NotFound";
import "./assets/styles/index.css";
import "./styles/button-override.css";
import "./styles/datepicker-override.css";
import "./styles/datepicker-dark.css";
import "./styles/select-override.css";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Dashboard />} />

                <Route path="orders">
                  <Route index element={<Orders />} />
                  <Route path="new" element={<CreateOrder />} />
                  <Route path="edit/:id" element={<EditOrder />} />
                  <Route path=":id" element={<OrderDetails />} />
                </Route>

                <Route path="customers">
                  <Route index element={<Customers />} />
                  <Route path="new" element={<CreateCustomer />} />
                  <Route path="edit/:id" element={<EditCustomer />} />
                  <Route path=":id" element={<CustomerDetails />} />
                </Route>

                <Route path="plate-types">
                  <Route index element={<PlateTypes />} />
                  <Route path="new" element={<CreatePlateType />} />
                  <Route path="edit/:id" element={<EditPlateType />} />
                </Route>

                <Route path="product-sizes">
                  <Route index element={<ProductSizes />} />
                  <Route path="new" element={<CreateProductSize />} />
                  <Route path="edit/:id" element={<EditProductSize />} />
                </Route>

                <Route path="expenses">
                  <Route index element={<Expenses />} />
                  <Route path="new" element={<CreateExpense />} />
                  <Route path="edit/:id" element={<EditExpense />} />
                </Route>

                <Route path="expense-categories">
                  <Route index element={<ExpenseCategories />} />
                  <Route path="new" element={<CreateExpenseCategory />} />
                  <Route path="edit/:id" element={<EditExpenseCategory />} />
                </Route>

                <Route path="invoices">
                  <Route index element={<Invoices />} />
                  <Route path="generate" element={<GenerateInvoice />} />
                  <Route path=":id" element={<InvoiceDetails />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
