import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaBoxes, FaUsers, FaMoneyBillWave, FaExclamationCircle } from "react-icons/fa";
import { orderAPI } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import OrderList from "../components/orders/OrderList";

const Dashboard = () => {
  const [recentOrders, setRecentOrders] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalCustomers: 0,
    totalBusinessValue: 0,
    totalReceived: 0,
    totalReceivable: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch recent orders
        const ordersResponse = await orderAPI.getAll({ limit: 5 });
        setRecentOrders(ordersResponse.data.data);

        // Calculate stats
        const allOrders = ordersResponse.data.data;
        const uniqueCustomers = new Set(allOrders.map((order) => order.customer_id));

        // Calculate total business value
        const totalBusinessValue = allOrders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);

        // Calculate total received payments
        const totalReceived = allOrders.reduce((sum, order) => {
          if (order.payment_summary) {
            return sum + parseFloat(order.payment_summary.total_payments || 0);
          } else if (order.payments) {
            return sum + order.payments.reduce((paidSum, payment) => paidSum + parseFloat(payment.amount || 0), 0);
          } else {
            return sum + parseFloat(order.advance_received || 0);
          }
        }, 0);

        // Calculate remaining receivable
        const totalReceivable = allOrders.reduce((sum, order) => {
          // Always use remaining_balance from payment_summary if available
          // This is the most accurate as it accounts for all payments
          if (order.payment_summary) {
            return sum + parseFloat(order.payment_summary.remaining_balance || 0);
          }
          // Fall back to totalReceivable - total_paid if we have both
          else if (order.totalReceivable !== undefined && order.payments) {
            const totalPaid = order.payments.reduce((paidSum, payment) => paidSum + parseFloat(payment.amount || 0), 0);
            return sum + Math.max(0, parseFloat(order.totalReceivable || 0) - totalPaid);
          }
          // Last resort: just use total_amount minus advance_received
          else {
            const advanceReceived = parseFloat(order.advance_received || 0);
            return sum + parseFloat(order.total_amount || 0) - advanceReceived;
          }
        }, 0);

        setStats({
          totalOrders: allOrders.length,
          totalCustomers: uniqueCustomers.size,
          totalBusinessValue,
          totalReceived,
          totalReceivable,
        });
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to load dashboard data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleDeleteOrder = async (orderId) => {
    if (window.confirm("Are you sure you want to delete this order?")) {
      try {
        await orderAPI.delete(orderId);
        setRecentOrders((prev) => prev.filter((order) => order.id !== orderId));
      } catch (err) {
        console.error("Error deleting order:", err);
        setError("Failed to delete order. Please try again.");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="mt-4 text-gray-500">Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <FaExclamationCircle className="text-red-500 mt-0.5 mr-3 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/orders/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <FaPlus className="mr-2 h-4 w-4" /> New Order
          </Link>
          <Link
            to="/customers/new"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <FaPlus className="mr-2 h-4 w-4" /> New Customer
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6 ring-1 ring-black ring-opacity-5">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
              <FaBoxes className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Orders</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalOrders}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6 ring-1 ring-black ring-opacity-5">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300">
              <FaUsers className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Customers</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalCustomers}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6 ring-1 ring-black ring-opacity-5">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300">
              <FaMoneyBillWave className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Outstanding Balance</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(stats.totalReceivable)}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6 ring-1 ring-black ring-opacity-5">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300">
              <FaMoneyBillWave className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Business Value</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(stats.totalBusinessValue)}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6 ring-1 ring-black ring-opacity-5">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300">
              <FaMoneyBillWave className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Received</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(stats.totalReceived)}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden ring-1 ring-black ring-opacity-5">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Recent Orders</h2>
        </div>
        <div className="p-6">
          {recentOrders.length > 0 ? (
            <>
              <OrderList orders={recentOrders} onDelete={handleDeleteOrder} />
              <div className="mt-6 text-center">
                <Link to="/orders" className="text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 hover:underline font-medium">
                  View All Orders
                </Link>
              </div>
            </>
          ) : (
            <div className="rounded-md bg-gray-100 dark:bg-gray-700 p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">No orders found. Create your first order to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
