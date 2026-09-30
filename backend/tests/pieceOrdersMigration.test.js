"use strict";

const { Sequelize } = require("sequelize");
const db = require("../src/models");
const migration = require("../src/migrations/20260930000001-add-piece-orders");

const qi = db.sequelize.getQueryInterface();
const q = (sql) => db.sequelize.query(sql).then(([rows]) => rows);

const hasColumn = async (table, column) =>
  (await q(`SELECT 1 FROM information_schema.columns WHERE table_name = '${table}' AND column_name = '${column}'`)).length > 0;

// Leave the schema migrated no matter how a test exits — later suites need it.
// afterEach, not afterAll: tests/setup.js closes the connection in its own
// afterAll, which runs before this file's.
afterEach(async () => {
  if (!(await hasColumn("order_product_sizes", "unit"))) await migration.up(qi, Sequelize);
});

describe("migration 20260930000001-add-piece-orders", () => {
  test("existing rows keep every value; old lines become KG with no pieces fields", async () => {
    await migration.down(qi, Sequelize);

    // Legacy-shaped data, written with raw SQL because the models already know the new columns.
    await q(`INSERT INTO customers (id, name, is_archived, metadata, created_at, updated_at)
             VALUES ('11111111-1111-1111-1111-111111111111', 'Legacy Co', false, '{}', now(), now())`);
    await q(`INSERT INTO plate_types (id, type_name, charge, is_archived, created_at, updated_at)
             VALUES ('22222222-2222-2222-2222-222222222222', '4 Colour', 1500.00, false, now(), now())`);
    await q(`INSERT INTO product_sizes (id, size_label, rate_per_kg, is_archived, created_at, updated_at)
             VALUES ('33333333-3333-3333-3333-333333333333', '8x10', 180.00, false, now(), now())`);
    await q(`INSERT INTO orders (id, customer_id, order_date, advance_received, plate_type_id, status, is_archived, round_off_amount, created_at, updated_at)
             VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '2026-01-05', 2000.00,
                     '22222222-2222-2222-2222-222222222222', 'DELIVERED', false, 5.00, now(), now())`);
    await q(`INSERT INTO order_product_sizes (id, order_id, product_size_id, quantity_kg, rate_per_kg)
             VALUES ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444',
                     '33333333-3333-3333-3333-333333333333', 12.35, 181.25)`);
    await q(`INSERT INTO invoices (id, customer_id, invoice_number, invoice_date, billing_period_start, billing_period_end, total_amount, tax_percent, tax_amount, final_amount, status, is_archived, created_at, updated_at)
             VALUES ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '00000001', '2026-01-31', '2026-01-01', '2026-01-31',
                     3733.44, 0, 0, 3733.44, 'PENDING', false, now(), now())`);
    await q(`INSERT INTO invoice_items (id, invoice_id, order_id, description, quantity, unit_price, total_price, created_at, updated_at)
             VALUES ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444',
                     '8x10 (2026-01-05)', 12.35, 181.25, 2238.44, now(), now())`);

    const snapshot = async () => ({
      sizes: await q(`SELECT id, size_label, rate_per_kg, is_archived FROM product_sizes ORDER BY id`),
      orders: await q(`SELECT id, advance_received, round_off_amount, status FROM orders ORDER BY id`),
      lines: await q(`SELECT id, order_id, product_size_id, quantity_kg, rate_per_kg FROM order_product_sizes ORDER BY id`),
      invoices: await q(`SELECT id, total_amount, tax_amount, final_amount FROM invoices ORDER BY id`),
      items: await q(`SELECT id, description, quantity, unit_price, total_price FROM invoice_items ORDER BY id`),
    });

    const before = await snapshot();
    await migration.up(qi, Sequelize);
    expect(await snapshot()).toEqual(before);

    const [line] = await q(`SELECT unit, quantity_pieces, price_amount, price_pieces_count, weight_kg, weight_pieces_count, weight_source FROM order_product_sizes`);
    expect(line).toEqual({ unit: "KG", quantity_pieces: null, price_amount: null, price_pieces_count: null, weight_kg: null, weight_pieces_count: null, weight_source: null });
    const [item] = await q(`SELECT unit, price_amount, price_pieces_count FROM invoice_items`);
    expect(item).toEqual({ unit: null, price_amount: null, price_pieces_count: null });
  });

  describe("constraints", () => {
    let order;
    let size;
    beforeEach(async () => {
      const customer = await db.Customer.create({ name: "C" });
      const plate = await db.PlateType.create({ type_name: "P", charge: "100.00" });
      size = await db.ProductSize.create({ size_label: "8x10", rate_per_kg: "180.00" });
      order = await db.Order.create({ customer_id: customer.id, plate_type_id: plate.id, order_date: "2026-09-01" });
    });

    const insertLine = (fields) => db.OrderProductSize.create({ order_id: order.id, product_size_id: size.id, ...fields });

    test("a valid PIECES line is accepted", async () => {
      await expect(insertLine({ unit: "PIECES", quantity_pieces: 5000, price_amount: "0.5", price_pieces_count: 1 })).resolves.toBeTruthy();
    });

    test("a line cannot be both kg and pieces", async () => {
      await expect(insertLine({ unit: "PIECES", quantity_kg: "10", quantity_pieces: 5000, price_amount: "0.5", price_pieces_count: 1 })).rejects.toThrow(/order_product_sizes_unit_chk/);
      await expect(insertLine({ unit: "KG", quantity_kg: "10", rate_per_kg: "180", quantity_pieces: 5000 })).rejects.toThrow(/order_product_sizes_unit_chk/);
    });

    test("a PIECES line needs a price and no kg rate", async () => {
      await expect(insertLine({ unit: "PIECES", quantity_pieces: 5000 })).rejects.toThrow(/order_product_sizes_unit_chk/);
      await expect(insertLine({ unit: "PIECES", quantity_pieces: 5000, price_amount: "0.5", price_pieces_count: 1, rate_per_kg: "180" })).rejects.toThrow(/order_product_sizes_unit_chk/);
    });

    test("weight is all-or-nothing and positive", async () => {
      await expect(insertLine({ unit: "PIECES", quantity_pieces: 10, price_amount: "1", price_pieces_count: 1, weight_kg: "1" })).rejects.toThrow(/order_product_sizes_unit_chk/);
      await expect(insertLine({ unit: "PIECES", quantity_pieces: 10, price_amount: "1", price_pieces_count: 1, weight_kg: "0", weight_pieces_count: 100, weight_source: "SIZE" })).rejects.toThrow(/order_product_sizes_values_chk/);
    });

    test("a size needs at least one price and complete pairs", async () => {
      await expect(db.ProductSize.create({ size_label: "X", rate_per_kg: null })).rejects.toThrow(/product_sizes_has_price_chk/);
      await expect(db.ProductSize.create({ size_label: "X", rate_per_kg: null, piece_price_amount: "0.5", piece_price_count: 1 })).resolves.toBeTruthy();
      await expect(db.ProductSize.create({ size_label: "Y", rate_per_kg: "100", weight_kg: "1" })).rejects.toThrow(/product_sizes_weight_pair_chk/);
    });

    test("down refuses once pieces lines exist", async () => {
      await insertLine({ unit: "PIECES", quantity_pieces: 5000, price_amount: "0.5", price_pieces_count: 1 });
      await expect(migration.down(qi, Sequelize)).rejects.toThrow(/Refusing to roll back/);
      expect(await hasColumn("order_product_sizes", "unit")).toBe(true);
    });
  });
});
