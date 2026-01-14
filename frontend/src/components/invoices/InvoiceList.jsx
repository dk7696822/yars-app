import { useState } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { FaEye, FaTrash, FaFileDownload, FaCheckCircle, FaTimesCircle, FaFileInvoiceDollar, FaUser, FaCalendarAlt, FaRupeeSign, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../ui/Table";
import { Badge } from "../ui/Badge";
import ActionButton from "../ui/action-button";
import MobileActionDropdown from "../ui/MobileActionDropdown";
import { invoiceAPI } from "../../services/api";

const InvoiceList = ({ invoices, onDelete, onStatusChange }) => {
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);

  const toggleInvoiceDetails = (invoiceId) => {
    if (expandedInvoiceId === invoiceId) {
      setExpandedInvoiceId(null);
    } else {
      setExpandedInvoiceId(invoiceId);
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case "PAID":
        return "success";
      case "PENDING":
        return "warning";
      case "CANCELLED":
        return "danger";
      default:
        return "secondary";
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "PAID":
        return {
          bg: "bg-emerald-100 dark:bg-emerald-500/20",
          text: "text-emerald-700 dark:text-emerald-400",
          border: "border-emerald-200 dark:border-emerald-500/30",
        };
      case "PENDING":
        return {
          bg: "bg-amber-100 dark:bg-amber-500/20",
          text: "text-amber-700 dark:text-amber-400",
          border: "border-amber-200 dark:border-amber-500/30",
        };
      case "CANCELLED":
        return {
          bg: "bg-red-100 dark:bg-red-500/20",
          text: "text-red-700 dark:text-red-400",
          border: "border-red-200 dark:border-red-500/30",
        };
      default:
        return {
          bg: "bg-gray-100 dark:bg-gray-500/20",
          text: "text-gray-700 dark:text-gray-400",
          border: "border-gray-200 dark:border-gray-500/30",
        };
    }
  };

  const handleDownloadPdf = (invoiceId) => {
    const pdfUrl = invoiceAPI.getPdfUrl(invoiceId);
    window.open(pdfUrl, "_blank");
  };

  if (!invoices || invoices.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No invoices found. Try adjusting your filters or generate a new invoice.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        {invoices.map((invoice) => {
          const statusConfig = getStatusConfig(invoice.status);
          const isExpanded = expandedInvoiceId === invoice.id;

          return (
            <div
              key={invoice.id}
              className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-700/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                      <FaFileInvoiceDollar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{invoice.invoice_number}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                        <FaUser className="w-3 h-3" />
                        {invoice.customer.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${statusConfig.bg} ${statusConfig.text}`}>
                      {invoice.status}
                    </span>
                    <MobileActionDropdown
                      actions={[
                        { title: "View", icon: FaEye, iconColor: "text-gray-600 dark:text-gray-300", to: `/invoices/${invoice.id}` },
                        { title: "Download PDF", icon: FaFileDownload, iconColor: "text-blue-500 dark:text-blue-400", onClick: () => handleDownloadPdf(invoice.id) },
                        ...(invoice.status === "PENDING"
                          ? [
                              { title: "Mark as Paid", icon: FaCheckCircle, iconColor: "text-green-500 dark:text-green-400", onClick: () => onStatusChange(invoice.id, "PAID") },
                              { title: "Cancel Invoice", icon: FaTimesCircle, iconColor: "text-orange-500 dark:text-orange-400", onClick: () => onStatusChange(invoice.id, "CANCELLED") },
                            ]
                          : []),
                        { title: "Delete", icon: FaTrash, iconColor: "text-red-500 dark:text-red-400", onClick: () => onDelete(invoice.id) },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* Card Body - Key Info */}
              <div className="p-4 space-y-3">
                {/* Amount - Prominent */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                      <FaRupeeSign className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Amount</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(invoice.final_amount)}</span>
                </div>

                {/* Dates */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                      <FaCalendarAlt className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Invoice Date</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatDate(invoice.invoice_date)}</span>
                </div>

                {/* Expandable Details */}
                <button
                  onClick={() => toggleInvoiceDetails(invoice.id)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <FaChevronUp className="w-3 h-3" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <FaChevronDown className="w-3 h-3" />
                      Show Due Date
                    </>
                  )}
                </button>

                {isExpanded && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Due Date</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {invoice.payment_due_date ? formatDate(invoice.payment_due_date) : "N/A"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer - Quick Actions */}
              <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700/50 flex gap-2">
                <Link
                  to={`/invoices/${invoice.id}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <FaEye className="w-3 h-3" />
                  View
                </Link>
                <button
                  onClick={() => handleDownloadPdf(invoice.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                >
                  <FaFileDownload className="w-3 h-3" />
                  PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-xl">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50/80 dark:bg-gray-800/50">
              <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Invoice #</th>
              <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Customer</th>
              <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Date</th>
              <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Due Date</th>
              <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Status</th>
              <th className="h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Amount</th>
              <th className="h-12 px-4 text-right align-middle text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200/60 dark:border-gray-700/60">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                <td className="p-4 align-middle">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                      <FaFileInvoiceDollar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{invoice.invoice_number}</span>
                  </div>
                </td>
                <td className="p-4 align-middle text-gray-700 dark:text-gray-300">{invoice.customer.name}</td>
                <td className="p-4 align-middle text-gray-600 dark:text-gray-400">{formatDate(invoice.invoice_date)}</td>
                <td className="p-4 align-middle text-gray-600 dark:text-gray-400">{invoice.payment_due_date ? formatDate(invoice.payment_due_date) : <span className="text-gray-400 dark:text-gray-500">N/A</span>}</td>
                <td className="p-4 align-middle">
                  <Badge variant={getStatusBadgeVariant(invoice.status)}>{invoice.status}</Badge>
                </td>
                <td className="p-4 align-middle font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(invoice.final_amount)}</td>
                <td className="p-4 align-middle text-right">
                  <MobileActionDropdown
                    actions={[
                      {
                        title: "View",
                        icon: FaEye,
                        iconColor: "text-gray-600 dark:text-gray-300",
                        to: `/invoices/${invoice.id}`,
                      },
                      {
                        title: "Download PDF",
                        icon: FaFileDownload,
                        iconColor: "text-blue-500 dark:text-blue-400",
                        onClick: () => handleDownloadPdf(invoice.id),
                      },
                      ...(invoice.status === "PENDING"
                        ? [
                            {
                              title: "Mark as Paid",
                              icon: FaCheckCircle,
                              iconColor: "text-green-500 dark:text-green-400",
                              onClick: () => onStatusChange(invoice.id, "PAID"),
                            },
                            {
                              title: "Cancel Invoice",
                              icon: FaTimesCircle,
                              iconColor: "text-orange-500 dark:text-orange-400",
                              onClick: () => onStatusChange(invoice.id, "CANCELLED"),
                            },
                          ]
                        : []),
                      {
                        title: "Delete",
                        icon: FaTrash,
                        iconColor: "text-red-500 dark:text-red-400",
                        onClick: () => onDelete(invoice.id),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

InvoiceList.propTypes = {
  invoices: PropTypes.array.isRequired,
  onDelete: PropTypes.func.isRequired,
  onStatusChange: PropTypes.func.isRequired,
};

export default InvoiceList;
