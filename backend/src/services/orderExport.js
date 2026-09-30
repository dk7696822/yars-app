"use strict";

const { lineAmount, lineKg, orderTotal, plateCharge, volumeSummary } = require("./orderMath");

const priceText = (line) =>
  Number(line.price_pieces_count) === 1
    ? `₹${Number(line.price_amount)}/pc`
    : `₹${Number(line.price_amount)} / ${line.price_pieces_count} pcs`;

const round3 = (x) => Math.round(x * 1000) / 1000;

/** Dashboard Excel rows: one row per order line, a blank row, then totals. */
const buildOrderExportRows = (orders) => {
  const excelData = [];
  let grandTotalAmount = 0;
  let grandTotalReceivable = 0;

  for (const order of orders) {
    const lines = order.orderProductSizes || [];
    const productAmount = lines.reduce((sum, line) => sum + lineAmount(line), 0);
    const charge = plateCharge(order);
    const roundOffAmount = parseFloat(order.round_off_amount || 0);
    const totalOrderAmount = orderTotal(order);

    // Pre-existing semantics kept: export "paid" is the sum of ALL payments.
    const totalPaid = (order.payments || []).reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    const remainingAmount = totalOrderAmount - totalPaid;

    grandTotalAmount += totalOrderAmount;
    grandTotalReceivable += remainingAmount;

    let paymentStatusText = "PENDING";
    if (totalPaid >= totalOrderAmount) paymentStatusText = "PAID";
    else if (totalPaid > 0) paymentStatusText = "PARTIAL";

    const baseRowData = {
      "Order ID": order.id,
      "Order Date": new Date(order.order_date).toLocaleDateString(),
      "Customer Name": order.customer.name,
      "Company Name": order.customer.metadata?.company_name || "",
      "Customer Phone": order.customer.metadata?.phone || "",
      "Customer Email": order.customer.metadata?.email || "",
      "Order Status": order.status,
      "Payment Status": paymentStatusText,
      "Plate Type": order.plateType.type_name,
      "Plate Charge": charge,
      "Custom Plate Charge": order.custom_plate_charge ? "Yes" : "No",
      "Round Off Amount": roundOffAmount,
      "Product Amount": productAmount,
      "Total Order Amount": totalOrderAmount,
      "Advance Received": parseFloat(order.advance_received || 0),
      "Total Paid": totalPaid,
      "Remaining Amount": remainingAmount,
      "Created At": new Date(order.created_at).toLocaleDateString(),
    };

    if (lines.length === 0) {
      excelData.push({
        ...baseRowData,
        "Product Size": "", "Product Category": "", "Unit": "",
        "Quantity (kg)": 0, "Rate per kg": 0, "Quantity (pcs)": "", "Price": "", "Est. kg": "", "Weight source": "",
        "Custom Rate": "No", "Product Line Total": 0,
      });
      continue;
    }

    for (const item of lines) {
      const isPieces = item.unit === "PIECES";
      const kg = isPieces ? lineKg(item) : null;
      excelData.push({
        ...baseRowData,
        "Product Size": item.productSize.size_label,
        "Product Category": item.productSize.category || "",
        "Unit": isPieces ? "PIECES" : "KG",
        "Quantity (kg)": isPieces ? "" : parseFloat(item.quantity_kg),
        "Rate per kg": isPieces ? "" : parseFloat(item.rate_per_kg),
        "Quantity (pcs)": isPieces ? Number(item.quantity_pieces) : "",
        "Price": isPieces ? priceText(item) : "",
        "Est. kg": kg === null ? "" : round3(kg),
        "Weight source": !isPieces || !item.weight_source ? "" : item.weight_source === "MANUAL" ? "Measured" : "Size",
        "Custom Rate": isPieces
          ? (Number(item.price_amount) !== Number(item.productSize.piece_price_amount) ||
             Number(item.price_pieces_count) !== Number(item.productSize.piece_price_count) ? "Yes" : "No")
          : item.rate_per_kg !== item.productSize.rate_per_kg ? "Yes" : "No",
        "Product Line Total": lineAmount(item),
      });
    }
  }

  const volume = volumeSummary(orders);
  excelData.push({});
  excelData.push({
    "Order ID": "SUMMARY TOTALS",
    "Total Order Amount": grandTotalAmount,
    "Remaining Amount": grandTotalReceivable,
    "Quantity (kg)": volume.kgFromKgLines,
    "Quantity (pcs)": volume.piecesTotal,
    "Est. kg": volume.kgFromPieces,
    "Total kg sold": volume.kgSold,
    "Pcs without weight": volume.piecesWithoutWeight,
  });

  return excelData;
};

module.exports = { buildOrderExportRows };
