import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { FaEdit, FaEye, FaTrash, FaChevronDown, FaChevronUp, FaBoxes, FaMoneyBillWave, FaBalanceScale } from "react-icons/fa";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableFooter } from "../ui/Table";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import ActionButton from "../ui/action-button";

const OrderList = ({ orders, onDelete }) => {
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const toggleOrderDetails = (orderId) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(orderId);
    }
  };

  // Calculate summary statistics
  const summary = useMemo(() => {
    let totalKg = 0;
    let totalAmount = 0;
    let totalReceivable = 0;

    orders.forEach((order) => {
      // Calculate total KG
      order.orderProductSizes.forEach((item) => {
        totalKg += parseFloat(item.quantity_kg || 0);
      });

      // Calculate total amount
      totalAmount += parseFloat(order.total_amount || 0);

      // Calculate total receivable
      if (order.payment_summary) {
        totalReceivable += parseFloat(order.payment_summary.remaining_balance || 0);
      } else {
        // If no payment summary, assume the whole amount is receivable
        totalReceivable += parseFloat(order.total_amount || 0);
      }
    });

    return {
      totalKg: totalKg.toFixed(2),
      totalAmount,
      totalReceivable,
    };
  }, [orders]);

  if (!orders || orders.length === 0) {
    return (
      <div className="rounded-md bg-muted/50 p-8 text-center">
        <p className="text-muted-foreground">No orders found. Try adjusting your filters or create a new order.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="[&_.border-b]:border-gray-200 [&_.border-b]:dark:border-gray-700 [&_tbody]:divide-y [&_tbody]:divide-gray-100 [&_tbody]:dark:divide-gray-700 [&_tr]:border-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Product Sizes</TableHead>
              <TableHead>Plate Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <>
                <TableRow key={order.id} className={expandedOrderId === order.id ? "bg-muted/50 dark:bg-gray-700/50" : ""}>
                  <TableCell className="font-medium">{order.customer.name}</TableCell>
                  <TableCell>{formatDate(order.order_date)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => toggleOrderDetails(order.id)} className="flex items-center gap-1 px-2 h-8">
                      {order.orderProductSizes.length} items
                      {expandedOrderId === order.id ? <FaChevronUp className="h-3 w-3 ml-1" /> : <FaChevronDown className="h-3 w-3 ml-1" />}
                    </Button>
                  </TableCell>
                  <TableCell>{order.plateType.type_name}</TableCell>
                  <TableCell>
                    <Badge variant={order.status === "COMPLETED" ? "success" : order.status === "IN_PROGRESS" ? "warning" : "secondary"}>{order.status.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    {order.payment_summary ? (
                      <Badge variant={order.payment_summary.is_fully_paid ? "success" : "warning"}>{order.payment_summary.is_fully_paid ? "FULLY PAID" : "PARTIALLY PAID"}</Badge>
                    ) : (
                      <Badge variant="secondary">UNPAID</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(order.total_amount || 0)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center space-x-2">
                      <ActionButton to={`/orders/${order.id}`} title="View Details" icon={FaEye} iconColor="text-gray-600 dark:text-gray-300" />
                      <ActionButton to={`/orders/edit/${order.id}`} title="Edit" icon={FaEdit} iconColor="text-blue-500 dark:text-blue-400" />
                      <ActionButton onClick={() => onDelete(order.id)} title="Delete" icon={FaTrash} iconColor="text-red-500 dark:text-red-400" />
                    </div>
                  </TableCell>
                </TableRow>
                {expandedOrderId === order.id && (
                  <TableRow className="bg-muted/30 dark:bg-gray-700/30">
                    <TableCell colSpan={8} className="p-0">
                      <div className="p-4">
                        <h4 className="text-sm font-semibold mb-3">Order Details</h4>
                        <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                          <div className="[&_.border-b]:border-gray-200 [&_.border-b]:dark:border-gray-700 [&_tbody]:divide-y [&_tbody]:divide-gray-100 [&_tbody]:dark:divide-gray-700 [&_tr]:border-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Product Size</TableHead>
                                  <TableHead>Quantity (kg)</TableHead>
                                  <TableHead>Rate per kg</TableHead>
                                  <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {order.orderProductSizes.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell>{item.productSize.size_label}</TableCell>
                                    <TableCell>{item.quantity_kg}</TableCell>
                                    <TableCell>{formatCurrency(item.rate_per_kg || item.productSize.rate_per_kg)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.quantity_kg * (item.rate_per_kg || item.productSize.rate_per_kg))}</TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="bg-muted/30 dark:bg-gray-700/30">
                                  <TableCell colSpan={3} className="font-medium">
                                    Plate Charge ({order.plateType.type_name})
                                  </TableCell>
                                  <TableCell className="text-right">{formatCurrency(order.plateType.charge)}</TableCell>
                                </TableRow>
                                <TableRow className="bg-muted/30 dark:bg-gray-700/30">
                                  <TableCell colSpan={3} className="font-medium">
                                    Total Order Amount
                                  </TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(order.total_amount)}</TableCell>
                                </TableRow>

                                {order.payment_summary?.advance_received > 0 && (
                                  <TableRow className="bg-muted/30 dark:bg-gray-700/30">
                                    <TableCell colSpan={3} className="font-medium">
                                      Advance Received
                                    </TableCell>
                                    <TableCell className="text-right text-green-600 dark:text-green-400">{formatCurrency(order.payment_summary.advance_received)}</TableCell>
                                  </TableRow>
                                )}

                                {order.payment_summary?.total_paid > 0 && (
                                  <TableRow className="bg-muted/30 dark:bg-gray-700/30">
                                    <TableCell colSpan={3} className="font-medium">
                                      Additional Payments
                                    </TableCell>
                                    <TableCell className="text-right text-green-600 dark:text-green-400">{formatCurrency(order.payment_summary.total_paid)}</TableCell>
                                  </TableRow>
                                )}

                                <TableRow className="bg-primary/5 dark:bg-primary-900/20">
                                  <TableCell colSpan={3} className="font-bold">
                                    Remaining Balance
                                  </TableCell>
                                  <TableCell className="text-right font-bold">
                                    {order.payment_summary?.is_fully_paid ? (
                                      <span className="text-green-600 dark:text-green-400">PAID</span>
                                    ) : (
                                      formatCurrency(order.payment_summary?.remaining_balance || order.total_amount)
                                    )}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-gray-100 dark:bg-gray-700 font-medium">
              <TableCell colSpan={8} className="p-0">
                <div className="p-4">
                  <h4 className="text-sm font-semibold mb-3">Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                        <FaBoxes className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Quantity</p>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{summary.totalKg} kg</h3>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300">
                        <FaMoneyBillWave className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Amount</p>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(summary.totalAmount)}</h3>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300">
                        <FaBalanceScale className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Receivable</p>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(summary.totalReceivable)}</h3>
                      </div>
                    </div>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
};

OrderList.propTypes = {
  orders: PropTypes.array.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default OrderList;
