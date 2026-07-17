import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { FaEdit, FaEye, FaTrash, FaChevronDown, FaChevronUp, FaBoxes, FaMoneyBillWave, FaBalanceScale } from "react-icons/fa";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../ui/Table";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import ActionButton from "../ui/action-button";
import MobileActionDropdown from "../ui/MobileActionDropdown";

const OrderList = ({ orders, onDelete, showSummary = true, allOrders }) => {
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // Use allOrders for summary if provided, otherwise use orders
  const ordersForSummary = allOrders || orders;

  const toggleOrderDetails = (orderId) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(orderId);
    }
  };

  // Calculate summary statistics from all orders (not just paginated)
  const summary = useMemo(() => {
    let totalKg = 0;
    let totalAmount = 0;
    let totalReceivable = 0;

    ordersForSummary.forEach((order) => {
      // Calculate total KG
      if (order.orderProductSizes) {
        order.orderProductSizes.forEach((item) => {
          totalKg += parseFloat(item.quantity_kg || 0);
        });
      }

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
  }, [ordersForSummary]);

  if (!orders || orders.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No orders found. Try adjusting your filters or create a new order.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        {orders.map((order) => (
          <div
            key={order.id}
            className="bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden"
          >
            {/* Card Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-700/50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{order.customer.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{formatDate(order.order_date)}</p>
                </div>
                <MobileActionDropdown
                  actions={[
                    { title: "View Details", icon: FaEye, iconColor: "text-gray-600 dark:text-gray-300", to: `/orders/${order.id}` },
                    { title: "Edit", icon: FaEdit, iconColor: "text-blue-500 dark:text-blue-400", to: `/orders/edit/${order.id}` },
                    { title: "Delete", icon: FaTrash, iconColor: "text-red-500 dark:text-red-400", onClick: () => onDelete(order.id) },
                  ]}
                />
              </div>
            </div>

            {/* Card Body */}
            <div className="p-4 space-y-3">
              {/* Status Badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant={order.status === "COMPLETED" ? "success" : order.status === "IN_PROGRESS" ? "warning" : "secondary"}>
                  {order.status.replace("_", " ")}
                </Badge>
                {order.payment_summary ? (
                  <Badge variant={order.payment_summary.is_fully_paid ? "success" : "warning"}>
                    {order.payment_summary.is_fully_paid ? "FULLY PAID" : "PARTIALLY PAID"}
                  </Badge>
                ) : (
                  <Badge variant="secondary">UNPAID</Badge>
                )}
              </div>

              {/* Order Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs uppercase tracking-wide">Plate Type</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{order.plateType.type_name}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs uppercase tracking-wide">Items</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{order.orderProductSizes.length} items</span>
                </div>
              </div>

              {/* Total Amount */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Amount</span>
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(order.total_amount || 0)}</span>
              </div>

              {/* Expand Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleOrderDetails(order.id)}
                className="w-full justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
              >
                {expandedOrderId === order.id ? "Hide Details" : "View Details"}
                {expandedOrderId === order.id ? <FaChevronUp className="h-3 w-3 ml-2" /> : <FaChevronDown className="h-3 w-3 ml-2" />}
              </Button>
            </div>

            {/* Expanded Details */}
            {expandedOrderId === order.id && (
              <div className="border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/30 p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Order Items</h4>
                <div className="space-y-2">
                  {order.orderProductSizes.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/30 last:border-0">
                      <div>
                        <span className="text-gray-900 dark:text-gray-100 font-medium">{item.productSize.size_label}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">({item.quantity_kg} kg)</span>
                      </div>
                      <span className="text-gray-900 dark:text-gray-100 font-medium">{formatCurrency(item.quantity_kg * (item.rate_per_kg || item.productSize.rate_per_kg))}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg px-3 mt-2">
                    <span className="text-gray-700 dark:text-gray-200 font-medium">Plate Charge</span>
                    <span className="text-gray-700 dark:text-gray-200">{formatCurrency(order.custom_plate_charge || order.plateType.charge)}</span>
                  </div>
                  {order.round_off_amount && parseFloat(order.round_off_amount) !== 0 && (
                    <div className="flex items-center justify-between py-2 bg-orange-50 dark:bg-orange-500/10 rounded-lg px-3">
                      <span className="text-orange-700 dark:text-orange-400 font-medium">Round Off</span>
                      <span className="text-orange-700 dark:text-orange-400">-{formatCurrency(Math.abs(parseFloat(order.round_off_amount)))}</span>
                    </div>
                  )}
                  {order.payment_summary && (
                    <div className="flex items-center justify-between py-2 bg-primary/5 dark:bg-primary/10 rounded-lg px-3 mt-2">
                      <span className="text-gray-900 dark:text-gray-50 font-bold">Balance</span>
                      {order.payment_summary.is_fully_paid ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">PAID</span>
                      ) : (
                        <span className="text-gray-900 dark:text-gray-50 font-bold">{formatCurrency(order.payment_summary.remaining_balance)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block [&_.border-b]:border-gray-200 [&_.border-b]:dark:border-gray-700 [&_tbody]:divide-y [&_tbody]:divide-gray-100 [&_tbody]:dark:divide-gray-700 [&_tr]:border-0">
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
                <TableRow key={order.id} className={expandedOrderId === order.id ? "bg-gray-50/50 dark:bg-gray-700/30" : ""}>
                  <TableCell className="font-medium text-gray-900 dark:text-gray-100">{order.customer.name}</TableCell>
                  <TableCell className="text-gray-700 dark:text-gray-300">{formatDate(order.order_date)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => toggleOrderDetails(order.id)} className="flex items-center gap-1 px-2 h-8 text-gray-700 dark:text-gray-300">
                      {order.orderProductSizes.length} items
                      {expandedOrderId === order.id ? <FaChevronUp className="h-3 w-3 ml-1" /> : <FaChevronDown className="h-3 w-3 ml-1" />}
                    </Button>
                  </TableCell>
                  <TableCell className="text-gray-700 dark:text-gray-300">{order.plateType.type_name}</TableCell>
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
                  <TableCell className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(order.total_amount || 0)}</TableCell>
                  <TableCell className="text-right">
                    <MobileActionDropdown
                      actions={[
                        {
                          title: "View Details",
                          icon: FaEye,
                          iconColor: "text-gray-600 dark:text-gray-300",
                          to: `/orders/${order.id}`,
                        },
                        {
                          title: "Edit",
                          icon: FaEdit,
                          iconColor: "text-blue-500 dark:text-blue-400",
                          to: `/orders/edit/${order.id}`,
                        },
                        {
                          title: "Delete",
                          icon: FaTrash,
                          iconColor: "text-red-500 dark:text-red-400",
                          onClick: () => onDelete(order.id),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
                {expandedOrderId === order.id && (
                  <TableRow className="bg-gray-50/50 dark:bg-gray-800/40">
                    <TableCell colSpan={8} className="p-0">
                      <div className="p-4">
                        <h4 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">Order Details</h4>
                        <div className="border border-gray-200 dark:border-gray-700/60 rounded-xl overflow-hidden bg-white dark:bg-gray-800/50">
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
                                    <TableCell className="text-gray-900 dark:text-gray-100">{item.productSize.size_label}</TableCell>
                                    <TableCell className="text-gray-700 dark:text-gray-300">{item.quantity_kg}</TableCell>
                                    <TableCell className="text-gray-700 dark:text-gray-300">{formatCurrency(item.rate_per_kg || item.productSize.rate_per_kg)}</TableCell>
                                    <TableCell className="text-right text-gray-900 dark:text-gray-100">{formatCurrency(item.quantity_kg * (item.rate_per_kg || item.productSize.rate_per_kg))}</TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="bg-gray-50/50 dark:bg-gray-700/20">
                                  <TableCell colSpan={3} className="font-medium text-gray-700 dark:text-gray-200">
                                    Plate Charge ({order.plateType.type_name}){order.custom_plate_charge && <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">(Custom)</span>}
                                  </TableCell>
                                  <TableCell className="text-right text-gray-700 dark:text-gray-200">{formatCurrency(order.custom_plate_charge || order.plateType.charge)}</TableCell>
                                </TableRow>
                                {order.round_off_amount && parseFloat(order.round_off_amount) !== 0 && (
                                  <TableRow className="bg-orange-50 dark:bg-orange-500/10">
                                    <TableCell colSpan={3} className="font-medium text-orange-700 dark:text-orange-400">
                                      Round Off Amount
                                    </TableCell>
                                    <TableCell className="text-right text-orange-700 dark:text-orange-400">-{formatCurrency(Math.abs(parseFloat(order.round_off_amount)))}</TableCell>
                                  </TableRow>
                                )}
                                <TableRow className="bg-gray-50/50 dark:bg-gray-700/20">
                                  <TableCell colSpan={3} className="font-medium text-gray-800 dark:text-gray-100">
                                    Total Order Amount
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-gray-800 dark:text-gray-100">{formatCurrency(order.total_amount)}</TableCell>
                                </TableRow>

                                {order.payment_summary?.advance_received > 0 && (
                                  <TableRow className="bg-emerald-50/50 dark:bg-emerald-500/10">
                                    <TableCell colSpan={3} className="font-medium text-gray-700 dark:text-gray-200">
                                      Advance Received
                                    </TableCell>
                                    <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(order.payment_summary.advance_received)}</TableCell>
                                  </TableRow>
                                )}

                                {order.payment_summary?.total_paid > 0 && (
                                  <TableRow className="bg-emerald-50/50 dark:bg-emerald-500/10">
                                    <TableCell colSpan={3} className="font-medium text-gray-700 dark:text-gray-200">
                                      Additional Payments
                                    </TableCell>
                                    <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(order.payment_summary.total_paid)}</TableCell>
                                  </TableRow>
                                )}

                                <TableRow className="bg-primary/5 dark:bg-primary/10">
                                  <TableCell colSpan={3} className="font-bold text-gray-900 dark:text-gray-50">
                                    Remaining Balance
                                  </TableCell>
                                  <TableCell className="text-right font-bold">
                                    {order.payment_summary?.is_fully_paid ? (
                                      <span className="text-emerald-600 dark:text-emerald-400">PAID</span>
                                    ) : (
                                      <span className="text-gray-900 dark:text-gray-50">{formatCurrency(order.payment_summary?.remaining_balance || order.total_amount)}</span>
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
        </Table>
      </div>

      {/* Orders Summary - visible on both mobile and desktop */}
      {showSummary && ordersForSummary.length > 0 && (
        <div className="mt-4 p-4 bg-white dark:bg-[#111916] rounded-xl border border-gray-200/60 dark:border-emerald-900/20">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-emerald-100/80 mb-3">Orders Summary</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Quantity Card */}
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#0d1411] rounded-xl border border-gray-200/60 dark:border-emerald-900/30 p-3 sm:p-4">
              <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <FaBoxes className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-emerald-100/50 uppercase tracking-wide">Quantity</p>
                <h3 className="text-lg font-bold text-gray-900 dark:text-emerald-100 font-display">{summary.totalKg} kg</h3>
              </div>
            </div>

            {/* Amount Card */}
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#0d1411] rounded-xl border border-gray-200/60 dark:border-emerald-900/30 p-3 sm:p-4">
              <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <FaMoneyBillWave className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-emerald-100/50 uppercase tracking-wide">Amount</p>
                <h3 className="text-lg font-bold text-gray-900 dark:text-emerald-100 font-display truncate">{formatCurrency(summary.totalAmount)}</h3>
              </div>
            </div>

            {/* Receivable Card */}
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#0d1411] rounded-xl border border-gray-200/60 dark:border-emerald-900/30 p-3 sm:p-4">
              <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <FaBalanceScale className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-emerald-100/50 uppercase tracking-wide">Receivable</p>
                <h3 className="text-lg font-bold text-gray-900 dark:text-amber-300 font-display truncate">{formatCurrency(summary.totalReceivable)}</h3>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

OrderList.propTypes = {
  orders: PropTypes.array.isRequired,
  onDelete: PropTypes.func.isRequired,
  showSummary: PropTypes.bool,
  allOrders: PropTypes.array, // All filtered orders for summary calculation
};

export default OrderList;
