import PropTypes from "prop-types";
import { FaEdit, FaTrash } from "react-icons/fa";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../ui/Table";
import { Badge } from "../ui/Badge";
import ActionButton from "../ui/action-button";

const PaymentList = ({ payments, onEdit, onDelete }) => {
  const getPaymentMethodBadge = (method) => {
    switch (method) {
      case "CASH":
        return <Badge variant="success">Cash</Badge>;
      case "BANK_TRANSFER":
        return <Badge variant="info">Bank Transfer</Badge>;
      case "UPI":
        return <Badge variant="primary">UPI</Badge>;
      case "CHECK":
        return <Badge variant="warning">Check</Badge>;
      case "OTHER":
        return <Badge variant="secondary">Other</Badge>;
      default:
        return <Badge variant="secondary">{method}</Badge>;
    }
  };

  if (!payments || payments.length === 0) {
    return (
      <div className="rounded-md bg-muted/50 p-8 text-center">
        <p className="text-muted-foreground">No payments found. Record a payment to get started.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="[&_.border-b]:border-gray-200 [&_.border-b]:dark:border-gray-700 [&_tbody]:divide-y [&_tbody]:divide-gray-100 [&_tbody]:dark:divide-gray-700 [&_tr]:border-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-medium">{formatDate(payment.payment_date)}</TableCell>
                <TableCell>{payment.invoice?.invoice_number || "N/A"}</TableCell>
                <TableCell>{payment.customer?.name || "N/A"}</TableCell>
                <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
                <TableCell>{getPaymentMethodBadge(payment.payment_method)}</TableCell>
                <TableCell>{payment.reference_number || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end items-center space-x-2">
                    <ActionButton onClick={() => onEdit(payment)} title="Edit" icon={FaEdit} iconColor="text-blue-500 dark:text-blue-400" />
                    <ActionButton onClick={() => onDelete(payment.id)} title="Delete" icon={FaTrash} iconColor="text-red-500 dark:text-red-400" />
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

PaymentList.propTypes = {
  payments: PropTypes.array.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default PaymentList;
