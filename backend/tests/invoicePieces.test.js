"use strict";

const db = require("../src/models");
const { generateInvoice } = require("../src/controllers/invoiceController");
const { formatInvoiceRate, formatInvoiceQty } = require("../src/services/invoiceItemFormat");
const { mockRes } = require("./helpers/http");
const { createCustomer, createPlateType, createSize, createOrderWithLines } = require("./helpers/orderFactories");

describe("invoice item text", () => {
  test("legacy items (unit null) render exactly as before", () => {
    expect(formatInvoiceRate({ unit: null, unit_price: "181.25" })).toBe("Rs. 181.25");
    expect(formatInvoiceQty({ unit: null, quantity: "12.35" })).toBe("12.35");
    expect(formatInvoiceRate({ unit: null, unit_price: "-2000.00" })).toBe("Rs. 2000.00");
  });
  test("kg and pieces items", () => {
    expect(formatInvoiceRate({ unit: "KG", unit_price: "180.00" })).toBe("Rs. 180.00 / kg");
    expect(formatInvoiceQty({ unit: "KG", quantity: "50.00" })).toBe("50 kg");
    expect(formatInvoiceRate({ unit: "PIECES", price_amount: "375.0000", price_pieces_count: 1000 })).toBe("Rs. 375.00 / 1,000 pcs");
    expect(formatInvoiceRate({ unit: "PIECES", price_amount: "0.3750", price_pieces_count: 1 })).toBe("Rs. 0.375 / pc");
    expect(formatInvoiceQty({ unit: "PIECES", quantity: "5000.00" })).toBe("5,000 pcs");
  });
});

describe("generateInvoice with pieces lines", () => {
  test("mixed order invoice totals equal the order total to the paisa", async () => {
    const customer = await createCustomer();
    const plateType = await createPlateType("500.00");
    const size = await createSize({ rate_per_kg: "150.00" });
    const order = await createOrderWithLines({
      customer, plateType, round_off_amount: "0.00",
      lines: [
        { product_size_id: size.id, unit: "KG", quantity_kg: "10.00", rate_per_kg: "150.00" },
        { product_size_id: size.id, unit: "PIECES", quantity_pieces: 1001, price_amount: "1.0050", price_pieces_count: 1 },
      ],
    });

    const res = mockRes();
    await generateInvoice({ body: { customer_id: customer.id, order_ids: [order.id] } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const invoice = res.json.mock.calls[0][0].data;

    expect(Number(invoice.total_amount)).toBe(1500 + 1006.01 + 500);
    const items = await db.InvoiceItem.findAll({ where: { invoice_id: invoice.id } });
    const pcs = items.find((i) => i.unit === "PIECES");
    expect(Number(pcs.quantity)).toBe(1001);
    expect(Number(pcs.total_price)).toBe(1006.01);
    expect(Number(pcs.price_amount)).toBe(1.005);
    expect(pcs.price_pieces_count).toBe(1);
    expect(items.find((i) => i.unit === "KG")).toBeTruthy();
    const plate = items.find((i) => i.description.startsWith("Plate Charge"));
    expect(plate.unit).toBeNull();
    const sum = items.reduce((s, i) => s + Number(i.total_price), 0);
    expect(sum).toBeCloseTo(Number(invoice.total_amount), 2);
  });
});
