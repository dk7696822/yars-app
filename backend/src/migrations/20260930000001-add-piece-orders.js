"use strict";

/**
 * Piece-based orders — spec: docs/superpowers/specs/2026-09-30-piece-orders-design.md
 *
 * Purely additive on real customer data: new nullable columns, one NOT NULL
 * column whose constant default ('KG') Postgres stores in the catalog (no
 * table rewrite), and DROP NOT NULLs. No existing value is written. One
 * transaction: if any existing row violated a new CHECK, nothing changes.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });

      await run(`CREATE TYPE "enum_order_product_sizes_unit" AS ENUM ('KG', 'PIECES');`);
      await run(`CREATE TYPE "enum_order_product_sizes_weight_source" AS ENUM ('SIZE', 'MANUAL');`);
      await run(`CREATE TYPE "enum_invoice_items_unit" AS ENUM ('KG', 'PIECES');`);

      // --- product_sizes ---------------------------------------------------
      await run(`
        ALTER TABLE product_sizes
          ALTER COLUMN rate_per_kg DROP NOT NULL,
          ADD COLUMN piece_price_amount DECIMAL(12,4),
          ADD COLUMN piece_price_count INTEGER,
          ADD COLUMN weight_kg DECIMAL(12,3),
          ADD COLUMN weight_pieces_count INTEGER;`);
      await run(`
        ALTER TABLE product_sizes
          ADD CONSTRAINT product_sizes_piece_price_pair_chk
            CHECK ((piece_price_amount IS NULL) = (piece_price_count IS NULL)),
          ADD CONSTRAINT product_sizes_piece_price_values_chk
            CHECK (piece_price_count IS NULL OR (piece_price_count >= 1 AND piece_price_amount >= 0)),
          ADD CONSTRAINT product_sizes_weight_pair_chk
            CHECK ((weight_kg IS NULL) = (weight_pieces_count IS NULL)),
          ADD CONSTRAINT product_sizes_weight_values_chk
            CHECK (weight_pieces_count IS NULL OR (weight_pieces_count >= 1 AND weight_kg > 0)),
          ADD CONSTRAINT product_sizes_has_price_chk
            CHECK (rate_per_kg IS NOT NULL OR piece_price_amount IS NOT NULL);`);

      // --- order_product_sizes ---------------------------------------------
      await run(`
        ALTER TABLE order_product_sizes
          ALTER COLUMN quantity_kg DROP NOT NULL,
          ALTER COLUMN rate_per_kg DROP NOT NULL,
          ADD COLUMN unit "enum_order_product_sizes_unit" NOT NULL DEFAULT 'KG',
          ADD COLUMN quantity_pieces INTEGER,
          ADD COLUMN price_amount DECIMAL(12,4),
          ADD COLUMN price_pieces_count INTEGER,
          ADD COLUMN weight_kg DECIMAL(12,3),
          ADD COLUMN weight_pieces_count INTEGER,
          ADD COLUMN weight_source "enum_order_product_sizes_weight_source";`);
      await run(`
        ALTER TABLE order_product_sizes
          ADD CONSTRAINT order_product_sizes_values_chk CHECK (
            (quantity_pieces IS NULL OR quantity_pieces >= 1)
            AND (price_pieces_count IS NULL OR (price_pieces_count >= 1 AND price_amount >= 0))
            AND (weight_pieces_count IS NULL OR (weight_pieces_count >= 1 AND weight_kg > 0))
          ),
          -- The no-double-counting rule: a line is exactly one of KG / PIECES.
          -- The KG branch deliberately does not require rate_per_kg (legacy
          -- rows may rely on the size's rate).
          ADD CONSTRAINT order_product_sizes_unit_chk CHECK (
            (unit = 'KG'
              AND quantity_kg IS NOT NULL
              AND quantity_pieces IS NULL AND price_amount IS NULL AND price_pieces_count IS NULL
              AND weight_kg IS NULL AND weight_pieces_count IS NULL AND weight_source IS NULL)
            OR
            (unit = 'PIECES'
              AND quantity_pieces IS NOT NULL AND quantity_kg IS NULL AND rate_per_kg IS NULL
              AND price_amount IS NOT NULL AND price_pieces_count IS NOT NULL
              AND ((weight_kg IS NULL AND weight_pieces_count IS NULL AND weight_source IS NULL)
                OR (weight_kg IS NOT NULL AND weight_pieces_count IS NOT NULL AND weight_source IS NOT NULL)))
          );`);

      // --- invoice_items -----------------------------------------------------
      await run(`
        ALTER TABLE invoice_items
          ADD COLUMN unit "enum_invoice_items_unit",
          ADD COLUMN price_amount DECIMAL(12,4),
          ADD COLUMN price_pieces_count INTEGER;`);
      await run(`
        ALTER TABLE invoice_items
          ADD CONSTRAINT invoice_items_price_pair_chk
            CHECK ((price_amount IS NULL) = (price_pieces_count IS NULL));`);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });

      // Rolling back would destroy pieces data / leave kg-less sizes invalid.
      const [[{ lines }]] = await run(`SELECT COUNT(*)::int AS lines FROM order_product_sizes WHERE unit = 'PIECES'`);
      const [[{ sizes }]] = await run(`SELECT COUNT(*)::int AS sizes FROM product_sizes WHERE rate_per_kg IS NULL`);
      if (lines > 0 || sizes > 0) {
        throw new Error(`Refusing to roll back: ${lines} pieces order lines and ${sizes} sizes without a kg rate exist.`);
      }

      await run(`
        ALTER TABLE invoice_items
          DROP CONSTRAINT invoice_items_price_pair_chk,
          DROP COLUMN unit, DROP COLUMN price_amount, DROP COLUMN price_pieces_count;`);
      await run(`
        ALTER TABLE order_product_sizes
          DROP CONSTRAINT order_product_sizes_unit_chk,
          DROP CONSTRAINT order_product_sizes_values_chk,
          DROP COLUMN unit, DROP COLUMN quantity_pieces, DROP COLUMN price_amount,
          DROP COLUMN price_pieces_count, DROP COLUMN weight_kg, DROP COLUMN weight_pieces_count,
          DROP COLUMN weight_source,
          ALTER COLUMN quantity_kg SET NOT NULL,
          ALTER COLUMN rate_per_kg SET NOT NULL;`);
      await run(`
        ALTER TABLE product_sizes
          DROP CONSTRAINT product_sizes_piece_price_pair_chk,
          DROP CONSTRAINT product_sizes_piece_price_values_chk,
          DROP CONSTRAINT product_sizes_weight_pair_chk,
          DROP CONSTRAINT product_sizes_weight_values_chk,
          DROP CONSTRAINT product_sizes_has_price_chk,
          DROP COLUMN piece_price_amount, DROP COLUMN piece_price_count,
          DROP COLUMN weight_kg, DROP COLUMN weight_pieces_count,
          ALTER COLUMN rate_per_kg SET NOT NULL;`);
      await run(`DROP TYPE "enum_invoice_items_unit";`);
      await run(`DROP TYPE "enum_order_product_sizes_weight_source";`);
      await run(`DROP TYPE "enum_order_product_sizes_unit";`);
    });
  },
};
