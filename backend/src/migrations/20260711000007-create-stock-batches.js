"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("stock_batches", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      goods_receipt_item_id: {
        type: Sequelize.UUID,
        allowNull: true, // null for ADJUSTMENT_IN batches, which have no receipt
        references: { model: "goods_receipt_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      received_date: { type: Sequelize.DATEONLY, allowNull: false },
      quantity_received: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      quantity_remaining: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      rate: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    // Every FIFO walk hits this index: open batches for an item, oldest first.
    await queryInterface.addIndex("stock_batches", ["item_id", "received_date"]);

    // Stock can never go negative. Enforce it in the database, not just in JS.
    await queryInterface.sequelize.query(`
      ALTER TABLE stock_batches
      ADD CONSTRAINT stock_batches_qty_remaining_non_negative
      CHECK (quantity_remaining >= 0);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("stock_batches");
  },
};
