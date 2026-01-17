import { FaPlus, FaEdit, FaTrash, FaMoneyBillWave, FaBoxes, FaArrowRight } from "react-icons/fa";
import { Badge } from "../ui/Badge";
import { formatCurrency } from "../../utils/formatters";

const HistoryList = ({ logs }) => {
  const getActionIcon = (action) => {
    switch (action) {
      case "CREATE":
        return <FaPlus className="w-3 h-3" />;
      case "UPDATE":
        return <FaEdit className="w-3 h-3" />;
      case "DELETE":
        return <FaTrash className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getActionBadgeVariant = (action) => {
    switch (action) {
      case "CREATE":
        return "success";
      case "UPDATE":
        return "default";
      case "DELETE":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getEntityIcon = (entityType) => {
    return entityType === "PAYMENT" ? (
      <FaMoneyBillWave className="w-5 h-5 text-emerald-500 history-icon-payment transition-colors duration-200" />
    ) : (
      <FaBoxes className="w-5 h-5 text-blue-500 transition-colors duration-200" />
    );
  };

  const getItemClasses = (log) => {
    const baseClasses = "history-item relative flex gap-4 p-4 rounded-xl border transition-all duration-200 cursor-default";
    const lightClasses = "bg-gray-50 border-gray-100 hover:border-gray-200 hover:bg-gray-100/50";
    const darkClasses = "dark:bg-gray-800/40 dark:border-gray-700/50 dark:hover:border-gray-600/50 dark:hover:bg-gray-800/60";

    let actionClass = "";
    if (log.entity_type === "PAYMENT" && log.action === "CREATE") {
      actionClass = "history-item-payment-create";
    } else if (log.action === "DELETE") {
      actionClass = "history-item-delete";
    }

    return `${baseClasses} ${lightClasses} ${darkClasses} ${actionClass}`;
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return new Intl.DateTimeFormat("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const renderPaymentDetails = (log) => {
    const { metadata, action } = log;
    const amount = metadata?.amount || log.new_values?.amount || log.old_values?.amount || 0;
    const paymentType = metadata?.payment_type || log.new_values?.payment_type || log.old_values?.payment_type || "";

    return (
      <div className="space-y-3">
        {/* Amount display */}
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold transition-all duration-200 ${
            action === "DELETE"
              ? "text-red-600 dark:text-red-400 history-value-negative"
              : "text-emerald-600 dark:text-emerald-400 history-value-positive"
          }`}>
            {action === "DELETE" ? "-" : "+"}{formatCurrency(amount)}
          </span>
          {paymentType && (
            <Badge variant="secondary" className="history-badge text-xs">
              {paymentType}
            </Badge>
          )}
        </div>

        {/* Metrics impact */}
        {metadata?.before_metrics && metadata?.after_metrics && (
          <div className="history-metrics bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-2 border border-gray-100 dark:border-gray-700/30">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Impact</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="history-metrics-row flex items-center justify-between gap-2 p-2 -m-2 rounded-lg">
                <span className="text-gray-600 dark:text-gray-400 font-medium">Received:</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <span className="text-gray-400 dark:text-gray-500 text-xs">{formatCurrency(metadata.before_metrics.total_received)}</span>
                  <FaArrowRight className="history-arrow w-2.5 h-2.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(metadata.after_metrics.total_received)}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    metadata.after_metrics.total_received >= metadata.before_metrics.total_received
                      ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 history-value-positive"
                      : "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 history-value-negative"
                  }`}>
                    {metadata.after_metrics.total_received >= metadata.before_metrics.total_received ? "+" : ""}
                    {formatCurrency(metadata.after_metrics.total_received - metadata.before_metrics.total_received)}
                  </span>
                </div>
              </div>
              <div className="history-metrics-row flex items-center justify-between gap-2 p-2 -m-2 rounded-lg">
                <span className="text-gray-600 dark:text-gray-400 font-medium">Outstanding:</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <span className="text-gray-400 dark:text-gray-500 text-xs">{formatCurrency(metadata.before_metrics.outstanding)}</span>
                  <FaArrowRight className="history-arrow w-2.5 h-2.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(metadata.after_metrics.outstanding)}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    metadata.after_metrics.outstanding <= metadata.before_metrics.outstanding
                      ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 history-value-positive"
                      : "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 history-value-negative"
                  }`}>
                    {metadata.after_metrics.outstanding <= metadata.before_metrics.outstanding ? "" : "+"}
                    {formatCurrency(metadata.after_metrics.outstanding - metadata.before_metrics.outstanding)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Update details */}
        {action === "UPDATE" && log.changed_fields && log.changed_fields.length > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium">Changed:</span> {log.changed_fields.join(", ")}
          </p>
        )}
      </div>
    );
  };

  const renderOrderDetails = (log) => {
    const { metadata, action } = log;

    if (action === "CREATE") {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="success" className="history-badge">New Order</Badge>
          {metadata?.status && (
            <Badge variant="secondary" className="history-badge">{metadata.status}</Badge>
          )}
        </div>
      );
    }

    if (metadata?.is_soft_delete) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="history-badge">Order Archived</Badge>
        </div>
      );
    }

    if (metadata?.previous_status && metadata?.new_status) {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Status:</span>
          <Badge variant="secondary" className="history-badge">{metadata.previous_status}</Badge>
          <FaArrowRight className="history-arrow w-3 h-3 text-gray-400" />
          <Badge variant="default" className="history-badge">{metadata.new_status}</Badge>
        </div>
      );
    }

    return null;
  };

  if (logs.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="history-empty-icon w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center mx-auto mb-5 shadow-lg dark:shadow-gray-900/50 border border-gray-200/50 dark:border-gray-700/50">
          <FaBoxes className="w-9 h-9 text-gray-300 dark:text-gray-600" />
        </div>
        <div className="history-empty-text">
          <p className="text-gray-600 dark:text-gray-300 text-lg font-semibold">No history entries found</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2 max-w-xs mx-auto">Activity will appear here when orders or payments are created, updated, or deleted</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log, index) => (
        <div
          key={log.id}
          className={getItemClasses(log)}
          style={{ animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}
        >
          {/* Entity Icon */}
          <div className="flex-shrink-0">
            <div className="history-icon-wrapper w-11 h-11 rounded-xl bg-white dark:bg-gray-700/80 flex items-center justify-center shadow-sm border border-gray-100 dark:border-gray-600/50">
              {getEntityIcon(log.entity_type)}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={getActionBadgeVariant(log.action)}
                  className="history-badge history-badge-create gap-1.5 shadow-sm"
                >
                  {getActionIcon(log.action)}
                  <span>{log.action}</span>
                </Badge>
                <Badge variant="outline" className="history-badge history-badge-type">
                  {log.entity_type}
                </Badge>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap font-medium">
                {formatDateTime(log.created_at)}
              </span>
            </div>

            {/* Customer name */}
            {log.metadata?.customer_name && (
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                {log.metadata.customer_name}
              </p>
            )}

            {/* Entity-specific details */}
            {log.entity_type === "PAYMENT" ? renderPaymentDetails(log) : renderOrderDetails(log)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default HistoryList;
