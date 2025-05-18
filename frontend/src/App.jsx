import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import CreateOrder from "./pages/CreateOrder";
import EditOrder from "./pages/EditOrder";
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
import NotFound from "./pages/NotFound";
import "./assets/styles/index.css";

function App() {
  return (
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

              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
