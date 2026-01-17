import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaBoxes, FaUsers, FaMoneyBillWave, FaExclamationCircle, FaArrowRight, FaChartLine, FaReceipt, FaChevronLeft, FaChevronRight, FaBalanceScale, FaWeight } from "react-icons/fa";
import { orderAPI } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import OrderList from "../components/orders/OrderList";

// Geometric pattern SVG for backgrounds
const GridPattern = ({ className = "" }) => (
  <svg className={`absolute inset-0 w-full h-full ${className}`} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <path d="M0 32V0h32" fill="none" stroke="currentColor" strokeOpacity="0.03" strokeWidth="1"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
);

// Hero Stat Card - Primary metric with constrained width
const HeroStatCard = ({ icon: Icon, title, value, subtitle, trend }) => (
  <div className="dashboard-hero-card relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary via-primary-600 to-primary-800 p-5 sm:p-6 text-white group max-w-md shadow-xl shadow-primary/20 dark:shadow-primary/30">
    {/* Background pattern */}
    <div className="absolute inset-0 opacity-10">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="heroPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1.5" fill="currentColor"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#heroPattern)"/>
      </svg>
    </div>

    {/* Floating shapes */}
    <div className="absolute top-4 right-4 w-20 sm:w-24 lg:w-32 h-20 sm:h-24 lg:h-32 rounded-full bg-white/5 blur-xl" />
    <div className="absolute -bottom-8 -left-8 w-24 sm:w-32 h-24 sm:h-32 rounded-full bg-accent/20 blur-2xl" />

    <div className="relative z-10">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <p className="text-sm sm:text-base font-medium text-white/90">{title}</p>
        </div>
        {trend && (
          <span className="hidden sm:inline-flex items-center text-[10px] sm:text-xs font-medium px-2 py-1 rounded-full bg-white/15 border border-white/10 whitespace-nowrap">
            {trend}
          </span>
        )}
      </div>

      {/* Value - responsive sizing */}
      <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-display font-bold tracking-tight mb-1 sm:mb-2 break-all">
        {value}
      </h2>

      <span className="text-xs sm:text-sm text-white/70">{subtitle}</span>
    </div>
  </div>
);

// Mobile-optimized Stat Card with enhanced dark mode
const StatCard = ({ icon: Icon, title, value, subtitle, variant = "default", delay = 0 }) => {
  const variants = {
    default: {
      bg: "bg-white",
      darkBg: "dark:bg-[#161d1a]",
      iconBg: "bg-gray-100 dark:bg-emerald-500/10 text-gray-600 dark:text-emerald-300",
      border: "border-gray-200/60 dark:border-emerald-900/30",
      accent: "text-gray-900 dark:text-emerald-50",
      glow: "dark:shadow-[0_0_25px_-10px_rgba(16,185,129,0.2)]",
    },
    success: {
      bg: "bg-white",
      darkBg: "dark:bg-[#0f1a16]",
      iconBg: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-200/50 dark:border-emerald-500/25",
      accent: "text-emerald-700 dark:text-emerald-300",
      glow: "dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.4)]",
    },
    warning: {
      bg: "bg-white",
      darkBg: "dark:bg-[#1a1710]",
      iconBg: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
      border: "border-amber-200/50 dark:border-amber-500/25",
      accent: "text-amber-700 dark:text-amber-300",
      glow: "dark:shadow-[0_0_30px_-10px_rgba(245,158,11,0.4)]",
    },
    purple: {
      bg: "bg-white",
      darkBg: "dark:bg-[#151419]",
      iconBg: "bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400",
      border: "border-violet-200/50 dark:border-violet-500/25",
      accent: "text-violet-700 dark:text-violet-300",
      glow: "dark:shadow-[0_0_30px_-10px_rgba(139,92,246,0.4)]",
    },
  };

  const v = variants[variant];

  return (
    <div
      className={`dashboard-stat-card relative overflow-hidden rounded-xl sm:rounded-2xl ${v.bg} ${v.darkBg} border ${v.border} p-4 sm:p-5 hover-lift ${v.glow} transition-all duration-300`}
    >
      {/* Subtle gradient overlay for dark mode */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent dark:from-white/[0.04] pointer-events-none" />

      <div className="relative flex items-center gap-3 sm:gap-4">
        {/* Icon */}
        <div className={`flex-shrink-0 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl ${v.iconBg}`}>
          <Icon className="w-5 h-5 sm:w-5 sm:h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">{title}</p>
          <h3 className={`text-xl sm:text-2xl lg:text-2xl font-display font-bold ${v.accent} tracking-tight leading-tight`}>
            {value}
          </h3>
        </div>
      </div>

      {subtitle && (
        <p className="relative text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-2 pl-[56px] sm:pl-[64px]">{subtitle}</p>
      )}
    </div>
  );
};

// Compact stat for mobile scrollable row with enhanced dark mode
const CompactStat = ({ icon: Icon, title, value, color = "primary" }) => {
  const colors = {
    primary: {
      icon: "bg-primary/15 dark:bg-emerald-500/20 text-primary dark:text-emerald-400",
      border: "border-primary/20 dark:border-emerald-900/30",
      glow: "dark:shadow-[0_0_20px_-8px_rgba(16,185,129,0.5)]",
      value: "text-gray-900 dark:text-emerald-300",
    },
    green: {
      icon: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-200/50 dark:border-emerald-500/25",
      glow: "dark:shadow-[0_0_20px_-8px_rgba(16,185,129,0.5)]",
      value: "text-gray-900 dark:text-emerald-300",
    },
    purple: {
      icon: "bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400",
      border: "border-violet-200/50 dark:border-violet-500/25",
      glow: "dark:shadow-[0_0_20px_-8px_rgba(139,92,246,0.5)]",
      value: "text-gray-900 dark:text-violet-300",
    },
    amber: {
      icon: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
      border: "border-amber-200/50 dark:border-amber-500/25",
      glow: "dark:shadow-[0_0_20px_-8px_rgba(245,158,11,0.5)]",
      value: "text-gray-900 dark:text-amber-300",
    },
  };

  const c = colors[color];

  return (
    <div className={`dashboard-compact-stat flex-shrink-0 w-[150px] sm:w-[160px] bg-white dark:bg-[#161d1a] rounded-xl border ${c.border} p-3.5 ${c.glow} transition-all`}>
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${c.icon} mb-2`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-[10px] font-semibold text-gray-500 dark:text-emerald-100/60 uppercase tracking-wider mb-1">{title}</p>
      <p className={`text-sm font-bold ${c.value} font-display`}>{value}</p>
    </div>
  );
};

// Quick action button - touch optimized
const QuickAction = ({ to, icon: Icon, label, primary = false }) => (
  <Link
    to={to}
    className={`
      dashboard-quick-action inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold
      transition-all duration-200 active:scale-95 min-h-[48px] flex-1 sm:flex-none
      ${primary
        ? "bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:bg-primary-700"
        : "bg-white dark:bg-[#161d1a] border border-gray-200 dark:border-emerald-900/30 text-gray-700 dark:text-emerald-100 hover:bg-gray-50 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
      }
    `}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </Link>
);

// Summary Stat Pill - Compact, non-truncating design with enhanced dark mode
const SummaryStatPill = ({ icon: Icon, label, value, color = "blue" }) => {
  const colorClasses = {
    blue: {
      bg: "bg-blue-50 dark:bg-[#111920]",
      icon: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400",
      border: "border-blue-200/50 dark:border-blue-500/25",
      text: "text-blue-700 dark:text-blue-300",
      glow: "dark:shadow-[0_0_20px_-8px_rgba(59,130,246,0.4)]",
    },
    green: {
      bg: "bg-emerald-50 dark:bg-[#0f1a16]",
      icon: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-200/50 dark:border-emerald-500/25",
      text: "text-emerald-700 dark:text-emerald-300",
      glow: "dark:shadow-[0_0_20px_-8px_rgba(16,185,129,0.4)]",
    },
    amber: {
      bg: "bg-amber-50 dark:bg-[#1a1710]",
      icon: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
      border: "border-amber-200/50 dark:border-amber-500/25",
      text: "text-amber-700 dark:text-amber-300",
      glow: "dark:shadow-[0_0_20px_-8px_rgba(245,158,11,0.4)]",
    },
  };

  const c = colorClasses[color];

  return (
    <div className={`dashboard-summary-pill flex flex-col ${c.bg} ${c.border} border rounded-xl p-3 sm:p-4 ${c.glow} transition-all`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${c.icon}`}>
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-emerald-100/60">{label}</span>
      </div>
      <p className={`text-lg sm:text-xl font-bold font-display ${c.text} break-all leading-tight`}>{value}</p>
    </div>
  );
};

const ORDERS_PER_PAGE = 5;

const Dashboard = () => {
  const [allOrders, setAllOrders] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalCustomers: 0,
    totalBusinessValue: 0,
    totalReceived: 0,
    totalReceivable: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate paginated orders
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ORDERS_PER_PAGE;
    return allOrders.slice(startIndex, startIndex + ORDERS_PER_PAGE);
  }, [allOrders, currentPage]);

  const totalPages = Math.ceil(allOrders.length / ORDERS_PER_PAGE);

  // Calculate summary for ALL orders
  const ordersSummary = useMemo(() => {
    let totalKg = 0;
    let totalAmount = 0;
    let totalReceivable = 0;

    allOrders.forEach((order) => {
      if (order.orderProductSizes) {
        order.orderProductSizes.forEach((item) => {
          totalKg += parseFloat(item.quantity_kg || 0);
        });
      }
      totalAmount += parseFloat(order.total_amount || 0);
      if (order.payment_summary) {
        totalReceivable += parseFloat(order.payment_summary.remaining_balance || 0);
      } else {
        totalReceivable += parseFloat(order.total_amount || 0);
      }
    });

    return { totalKg: totalKg.toFixed(2), totalAmount, totalReceivable };
  }, [allOrders]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Fetch more orders for pagination (e.g., 20)
        const ordersResponse = await orderAPI.getAll({ limit: 20 });
        const orders = ordersResponse.data.data || [];
        setAllOrders(orders);

        const uniqueCustomers = new Set(orders.map((order) => order.customer_id));
        const totalBusinessValue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);

        const totalReceived = orders.reduce((sum, order) => {
          if (order.payment_summary) {
            return sum + parseFloat(order.payment_summary.total_payments || 0);
          } else if (order.payments) {
            return sum + order.payments.reduce((paidSum, payment) => paidSum + parseFloat(payment.amount || 0), 0);
          } else {
            return sum + parseFloat(order.advance_received || 0);
          }
        }, 0);

        const totalReceivable = orders.reduce((sum, order) => {
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
          totalOrders: orders.length,
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
        setAllOrders((prev) => prev.filter((order) => order.id !== orderId));
      } catch (err) {
        console.error("Error deleting order:", err);
        setError("Failed to delete order. Please try again.");
      }
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
          <div className="absolute inset-0 w-14 h-14 rounded-full border-[3px] border-transparent border-t-primary dark:border-t-emerald-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-primary dark:bg-emerald-400 animate-pulse" />
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Error alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-3 sm:p-4 flex items-start gap-3 animate-fade-in">
          <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0 w-4 h-4" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Mobile Header - Simplified */}
      <div className="sm:hidden">
        <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white mb-1">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Business overview</p>
      </div>

      {/* Desktop Header */}
      <div className="dashboard-header hidden sm:block relative overflow-hidden rounded-2xl lg:rounded-3xl bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-[#111916] dark:via-[#0d1210] dark:to-[#0a0f0d] border border-gray-200/60 dark:border-emerald-900/20 p-5 lg:p-8 dark:shadow-[0_0_60px_-15px_rgba(0,0,0,0.5)]">
        <GridPattern className="text-gray-900 dark:text-emerald-500/30" />
        {/* Ambient glow for dark mode */}
        <div className="hidden dark:block absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6">
          <div>
            <div className="flex items-center gap-2 text-primary dark:text-primary-400 mb-1">
              <div className="w-6 h-1 rounded-full bg-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider">Overview</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-gray-900 dark:text-white tracking-tight">
              Dashboard
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:gap-3">
            <QuickAction to="/orders/new" icon={FaPlus} label="New Order" primary />
            <QuickAction to="/customers/new" icon={FaUsers} label="Customer" />
            <QuickAction to="/invoices" icon={FaReceipt} label="Invoices" />
          </div>
        </div>
      </div>

      {/* Mobile Quick Actions */}
      <div className="sm:hidden flex gap-2">
        <QuickAction to="/orders/new" icon={FaPlus} label="Order" primary />
        <QuickAction to="/customers/new" icon={FaUsers} label="Customer" />
      </div>

      {/* Hero Card - Outstanding Balance (Full width on mobile) */}
      <HeroStatCard
        icon={FaMoneyBillWave}
        title="Outstanding"
        value={formatCurrency(stats.totalReceivable)}
        subtitle="Pending collection"
        trend={stats.totalReceivable > 0 ? "Needs attention" : "All clear"}
      />

      {/* Mobile: Horizontal scroll stats */}
      <div className="sm:hidden -mx-4 px-4">
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          <CompactStat
            icon={FaBoxes}
            title="Orders"
            value={stats.totalOrders}
            color="primary"
          />
          <CompactStat
            icon={FaUsers}
            title="Customers"
            value={stats.totalCustomers}
            color="green"
          />
          <CompactStat
            icon={FaChartLine}
            title="Revenue"
            value={formatCurrency(stats.totalBusinessValue)}
            color="purple"
          />
          <CompactStat
            icon={FaMoneyBillWave}
            title="Received"
            value={formatCurrency(stats.totalReceived)}
            color="green"
          />
        </div>
      </div>

      {/* Desktop/Tablet: Grid stats */}
      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          icon={FaBoxes}
          title="Orders"
          value={stats.totalOrders}
          subtitle="All time"
          variant="default"
          delay={100}
        />
        <StatCard
          icon={FaUsers}
          title="Customers"
          value={stats.totalCustomers}
          subtitle="Active"
          variant="success"
          delay={150}
        />
        <StatCard
          icon={FaChartLine}
          title="Revenue"
          value={formatCurrency(stats.totalBusinessValue)}
          subtitle="Lifetime"
          variant="purple"
          delay={200}
        />
        <StatCard
          icon={FaMoneyBillWave}
          title="Received"
          value={formatCurrency(stats.totalReceived)}
          subtitle="Collected"
          variant="success"
          delay={250}
        />
      </div>

      {/* Recent Orders Section */}
      <div className="dashboard-orders-section relative overflow-hidden bg-white dark:bg-[#111916] rounded-xl sm:rounded-2xl border border-gray-200/60 dark:border-emerald-900/20 shadow-soft dark:shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)]">
        {/* Ambient light for dark mode */}
        <div className="hidden dark:block absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="hidden dark:block absolute -bottom-20 -left-20 w-48 h-48 bg-emerald-500/3 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header */}
        <div className="relative flex items-center justify-between border-b border-gray-100 dark:border-emerald-900/20 px-4 sm:px-5 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-emerald-400">
              <FaBoxes className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-display font-semibold text-gray-900 dark:text-gray-100">Recent Orders</h2>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                {allOrders.length} total orders
              </p>
            </div>
          </div>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary hover:text-primary-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
          >
            View All
            <FaArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Orders Summary Bar */}
        {allOrders.length > 0 && (
          <div className="relative border-b border-gray-100 dark:border-emerald-900/20 px-4 sm:px-5 py-4 dark:bg-[#0d1210]/50">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <SummaryStatPill
                icon={FaWeight}
                label="Quantity"
                value={`${ordersSummary.totalKg} kg`}
                color="blue"
              />
              <SummaryStatPill
                icon={FaMoneyBillWave}
                label="Amount"
                value={formatCurrency(ordersSummary.totalAmount)}
                color="green"
              />
              <SummaryStatPill
                icon={FaBalanceScale}
                label="Receivable"
                value={formatCurrency(ordersSummary.totalReceivable)}
                color="amber"
              />
            </div>
          </div>
        )}

        {/* Orders Content */}
        <div className="p-3 sm:p-5">
          {paginatedOrders.length > 0 ? (
            <>
              <OrderList orders={paginatedOrders} onDelete={handleDeleteOrder} showSummary={false} />

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-emerald-900/20">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-emerald-100/60">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={goToPrevPage}
                      disabled={currentPage === 1}
                      className="dashboard-pagination-btn inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-gray-200 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] text-gray-600 dark:text-emerald-100/70 hover:bg-gray-50 dark:hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <FaChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>

                    {/* Page numbers - hidden on mobile */}
                    <div className="hidden sm:flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                            page === currentPage
                              ? "bg-primary text-white"
                              : "bg-white dark:bg-[#161d1a] border border-gray-200 dark:border-emerald-900/30 text-gray-600 dark:text-emerald-100/70 hover:bg-gray-50 dark:hover:bg-emerald-500/10"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      className="dashboard-pagination-btn inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-gray-200 dark:border-emerald-900/30 bg-white dark:bg-[#161d1a] text-gray-600 dark:text-emerald-100/70 hover:bg-gray-50 dark:hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <FaChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10 sm:py-14">
              <div className="dashboard-empty-icon relative inline-flex items-center justify-center mb-4 sm:mb-6">
                <div className="absolute w-20 h-20 rounded-full bg-primary/5 dark:bg-emerald-500/10 animate-pulse" />
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 dark:bg-[#161d1a] rounded-2xl flex items-center justify-center border border-gray-200/50 dark:border-emerald-900/30">
                  <FaBoxes className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400 dark:text-emerald-500/50" />
                </div>
              </div>
              <div className="dashboard-empty-text">
                <h3 className="text-lg sm:text-xl font-display font-semibold text-gray-900 dark:text-emerald-50 mb-2">
                  No orders yet
                </h3>
                <p className="text-gray-500 dark:text-emerald-100/50 text-sm mb-5 max-w-xs mx-auto px-4">
                  Create your first order to start tracking business transactions.
                </p>
              </div>
              <Link
                to="/orders/new"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-semibold text-sm shadow-lg shadow-primary/25 dark:shadow-primary/40 hover:bg-primary-700 transition-all active:scale-95"
              >
                <FaPlus className="w-4 h-4" />
                Create Order
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
