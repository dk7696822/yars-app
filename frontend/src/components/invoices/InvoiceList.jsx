import { useState } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { FaEye, FaTrash, FaFileDownload, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../ui/Table";
import { Badge } from "../ui/Badge";
import ActionButton from "../ui/action-button";
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

  const handleDownloadPdf = (invoiceId) => {
    const pdfUrl = invoiceAPI.getPdfUrl(invoiceId);
    window.open(pdfUrl, "_blank");
  };

  if (!invoices || invoices.length === 0) {
    return (
      <div className="rounded-md bg-muted/50 p-8 text-center">
        <p className="text-muted-foreground">No invoices found. Try adjusting your filters or generate a new invoice.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="[&_.border-b]:border-gray-200 [&_.border-b]:dark:border-gray-700 [&_tbody]:divide-y [&_tbody]:divide-gray-100 [&_tbody]:dark:divide-gray-700 [&_tr]:border-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id} className={expandedInvoiceId === invoice.id ? "bg-muted/50 dark:bg-gray-700/50" : ""}>
                <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                <TableCell>{invoice.customer.name}</TableCell>
                <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                <TableCell>{invoice.payment_due_date ? formatDate(invoice.payment_due_date) : "N/A"}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(invoice.status)}>{invoice.status}</Badge>
                </TableCell>
                <TableCell className="font-medium">{formatCurrency(invoice.final_amount)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end items-center space-x-2">
                    <ActionButton to={`/invoices/${invoice.id}`} title="View" icon={FaEye} iconColor="text-gray-600 dark:text-gray-300" />
                    <ActionButton onClick={() => handleDownloadPdf(invoice.id)} title="Download PDF" icon={FaFileDownload} iconColor="text-blue-500 dark:text-blue-400" />
                    {invoice.status === "PENDING" && (
                      <ActionButton onClick={() => onStatusChange(invoice.id, "PAID")} title="Mark as Paid" icon={FaCheckCircle} iconColor="text-green-500 dark:text-green-400" />
                    )}
                    {invoice.status === "PENDING" && (
                      <ActionButton onClick={() => onStatusChange(invoice.id, "CANCELLED")} title="Cancel Invoice" icon={FaTimesCircle} iconColor="text-orange-500 dark:text-orange-400" />
                    )}
                    <ActionButton onClick={() => onDelete(invoice.id)} title="Delete" icon={FaTrash} iconColor="text-red-500 dark:text-red-400" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
