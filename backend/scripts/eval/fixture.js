"use strict";

// Named records every eval refers to. Runs only against the local *_test database.
const TABLES = [
  "assistant_actions", "assistant_messages", "assistant_conversations", "audit_logs",
  "invoice_items", "payments", "invoices", "order_product_sizes", "orders", "product_sizes", "plate_types", "customers",
];

const seed = async (db) => {
  const { host, database } = db.sequelize.config;
  if (!["localhost", "127.0.0.1"].includes(host) || !String(database).endsWith("_test")) {
    throw new Error(`Refusing to seed ${host}/${database}: evals run only on the local *_test database.`);
  }
  await db.sequelize.query(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`);

  const single = await db.PlateType.create({ type_name: "Single colour", charge: "1500.00" });
  const double = await db.PlateType.create({ type_name: "Two colour", charge: "2500.00" });
  const size1216 = await db.ProductSize.create({ size_label: "12 x 16", rate_per_kg: "180.00" });
  const size1418 = await db.ProductSize.create({ size_label: "14 x 18", rate_per_kg: "0.00", piece_price_amount: "375", piece_price_count: 1000 });
  const customer = (name, phone, city) => db.Customer.create({ name, metadata: { phone, city } });
  const sharmaSurat = await customer("Sharma Traders", "9876500001", "Surat");
  const sharmaDelhi = await customer("Sharma Traders", "9876500002", "Delhi");
  const bombay = await customer("Bombay Saree Centre", "9876500003", "Mumbai");
  const laxmi = await customer("Laxmi Stores", "9876500004", "Bidar");

  const order = async (c, date, lines) => {
    const o = await db.Order.create({ customer_id: c.id, plate_type_id: single.id, order_date: date });
    for (const l of lines) await db.OrderProductSize.create({ order_id: o.id, ...l });
    return o;
  };
  const kg = (size, q) => ({ product_size_id: size.id, unit: "KG", quantity_kg: String(q), rate_per_kg: size.rate_per_kg });
  const bombayOrder = await order(bombay, "2026-09-12", [kg(size1216, 20)]);
  const suratOrderA = await order(sharmaSurat, "2026-09-05", [kg(size1216, 10)]);
  const suratOrderB = await order(sharmaSurat, "2026-09-20", [{ product_size_id: size1418.id, unit: "PIECES", quantity_pieces: 5000, price_amount: "375", price_pieces_count: 1000 }]);
  const delhiOrder = await order(sharmaDelhi, "2026-09-08", [kg(size1216, 5)]);
  // 20 kg × 180 + plate 1500 = 5100; 1000 received, so a refund up to 1000 is possible.
  await db.Payment.create({ order_id: bombayOrder.id, customer_id: bombay.id, amount: "1000.00", payment_type: "PARTIAL", payment_date: "2026-09-14" });
  // 5 kg × 180 + plate 1500 = 2400: Delhi's only order is paid in full.
  await db.Payment.create({ order_id: delhiOrder.id, customer_id: sharmaDelhi.id, amount: "2400.00", payment_type: "FINAL", payment_date: "2026-09-09" });

  const records = { single, double, size1216, size1418, sharmaSurat, sharmaDelhi, bombay, laxmi, bombayOrder, suratOrderA, suratOrderB, delhiOrder };
  return Object.fromEntries(Object.entries(records).map(([name, r]) => [name, r.id]));
};

module.exports = { seed };
