import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaBoxes, FaUsers, FaMoneyBillWave, FaExclamationCircle, FaArrowRight, FaChartLine } from "react-icons/fa";
import { orderAPI } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import OrderList from "../components/orders/OrderList";

const StatCard = ({ icon: Icon, title, value, subtitle, color, delay }) => {
  const colorClasses = {
    primary: "from-primary/10 to-primary/5 text-primary border-primary/20",
    green: "from-green-500/10 to-green-500/5 text-green-600 dark:text-green-400 border-green-500/20",
    amber: "from-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20",
    purple: "from-purple-500/10 to-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/20",
  };

  const iconBgClasses = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colorClasses[color]} border p-5 md:p-6 hover-lift animate-fade-in-up`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Background decoration */}
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-current opacity-[0.03]" />

      <div className="relative flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white font-display tracking-tight">
            {value}
          </h3>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
          )}
        </div>
        <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${iconBgClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

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
          if (order.payment_summary) {
            return sum + parseFloat(order.payment_summary.remaining_balance || 0);
          } else if (order.totalReceivable !== undefined && order.payments) {
            const totalPaid = order.payments.reduce((paidSum, payment) => paidSum + parseFloat(payment.amount || 0), 0);
            return sum + Math.max(0, parseFloat(order.totalReceivable || 0) - totalPaid);
          } else {
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
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="relative">
          <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 rounded-full bg-primary/10" />
          </div>
        </div>
        <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6 md:space-y-8">
      {/* Error alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Overview of your business metrics
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/orders/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 active:scale-95"
          >
            <FaPlus className="h-4 w-4" /> New Order
          </Link>
          <Link
            to="/customers/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all active:scale-95"
          >
            <FaPlus className="h-4 w-4" /> New Customer
          </Link>
        </div>
      </div>

      {/* Stats grid - 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <StatCard
          icon={FaBoxes}
          title="Total Orders"
          value={stats.totalOrders}
          subtitle="All time orders"
          color="primary"
          delay={0}
        />
        <StatCard
          icon={FaUsers}
          title="Total Customers"
          value={stats.totalCustomers}
          subtitle="Unique customers"
          color="green"
          delay={75}
        />
        <StatCard
          icon={FaMoneyBillWave}
          title="Outstanding Balance"
          value={formatCurrency(stats.totalReceivable)}
          subtitle="Amount pending"
          color="amber"
          delay={150}
        />
      </div>

      {/* Stats grid - 2 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <StatCard
          icon={FaChartLine}
          title="Total Business Value"
          value={formatCurrency(stats.totalBusinessValue)}
          subtitle="Lifetime revenue"
          color="purple"
          delay={225}
        />
        <StatCard
          icon={FaMoneyBillWave}
          title="Total Received"
          value={formatCurrency(stats.totalReceived)}
          subtitle="Payments collected"
          color="green"
          delay={300}
        />
      </div>

      {/* Recent orders section */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 shadow-soft overflow-hidden animate-fade-in-up" style={{ animationDelay: '375ms' }}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 md:px-6 py-4">
          <h2 className="section-title">Recent Orders</h2>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
          >
            View All <FaArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="p-4 md:p-6">
          {recentOrders.length > 0 ? (
            <OrderList orders={recentOrders} onDelete={handleDeleteOrder} />
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FaBoxes className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-medium mb-1">No orders yet</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Create your first order to get started.</p>
              <Link
                to="/orders/new"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-700"
              >
                <FaPlus className="w-3 h-3" /> Create Order
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
