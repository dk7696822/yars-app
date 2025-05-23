import PropTypes from "prop-types";
import { FaFileDownload, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { invoiceAPI } from "../../services/api";
import PaymentSummary from "../payments/PaymentSummary";

const InvoiceDetails = ({ invoice, onStatusChange, onAddPayment }) => {
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

  const handleDownloadPdf = () => {
    const pdfUrl = invoiceAPI.getPdfUrl(invoice.id);
    window.open(pdfUrl, "_blank");
  };

  if (!invoice) {
    return (
      <div className="rounded-md bg-muted/50 p-8 text-center">
        <p className="text-muted-foreground">Invoice not found or still loading...</p>
      </div>
    );
  }

  return (
    <div className="invoice-details">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Invoice #{invoice.invoice_number}</h2>
          <p className="text-gray-500 dark:text-gray-400">Created on {formatDate(invoice.created_at)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleDownloadPdf} variant="outline" className="flex items-center gap-2">
            <FaFileDownload /> Download PDF
          </Button>

          {invoice.status === "PENDING" && (
            <>
              <Button onClick={() => onStatusChange(invoice.id, "PAID")} variant="success" className="flex items-center gap-2">
                <FaCheckCircle /> Mark as Paid
              </Button>

              <Button onClick={() => onStatusChange(invoice.id, "CANCELLED")} variant="destructive" className="flex items-center gap-2">
                <FaTimesCircle /> Cancel Invoice
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Invoice Information</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Invoice Date</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDate(invoice.invoice_date)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Due Date</p>
              <p className="font-medium text-gray-900 dark:text-white">{invoice.payment_due_date ? formatDate(invoice.payment_due_date) : "N/A"}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Billing Period</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {formatDate(invoice.billing_period_start)} - {formatDate(invoice.billing_period_end)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
              <Badge variant={getStatusBadgeVariant(invoice.status)}>{invoice.status}</Badge>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Customer Information</h3>

          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Customer Name</p>
            <p className="font-medium text-gray-900 dark:text-white">{invoice.customer.name}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm mb-8">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Invoice Items</h3>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit Price</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {invoice.invoiceItems.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{item.description}</td>
                  <td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">{item.quantity}</td>
                  <td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">{formatCurrency(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <div className="flex flex-col items-end">
          <div className="w-full md:w-1/3 space-y-2">
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(invoice.total_amount)}</span>
            </div>

            {/* Calculate and show advance payment if any */}
            {invoice.invoiceItems.some((item) => item.description.includes("Advance Payment")) && (
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Advance Paid</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(invoice.invoiceItems.filter((item) => item.description.includes("Advance Payment")).reduce((total, item) => total + Math.abs(parseFloat(item.total_price)), 0))}
                </span>
              </div>
            )}

            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Tax ({invoice.tax_percent}%)</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(invoice.tax_amount)}</span>
            </div>

            <div className="flex justify-between py-2 text-lg font-bold">
              <span className="text-gray-900 dark:text-white">Total Payable</span>
              <span className="text-gray-900 dark:text-white">{formatCurrency(invoice.final_amount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer text */}
      {/* Payment Summary Section */}
      <PaymentSummary invoice={invoice} onAddPayment={onAddPayment} />

      <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 italic">This invoice is computer-generated and does not require any physical signature.</div>
    </div>
  );
};

InvoiceDetails.propTypes = {
  invoice: PropTypes.object,
  onStatusChange: PropTypes.func.isRequired,
  onAddPayment: PropTypes.func.isRequired,
};

export default InvoiceDetails;
