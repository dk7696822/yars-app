"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("stock_movements", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      movement_type: {
        type: Sequelize.ENUM("RECEIPT", "ISSUE", "WASTAGE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"),
        allowNull: false,
      },
      // Signed: positive = into stock, negative = out of stock.
      quantity: { type: Sequelize.DECIMAL(12, 3), allowNull: false },
      stock_batch_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "stock_batches", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      unit_cost: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      total_cost: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      reference_type: {
        type: Sequelize.ENUM("GOODS_RECEIPT", "STOCK_ISSUE", "STOCK_ADJUSTMENT"),
        allowNull: false,
      },
      reference_id: { type: Sequelize.UUID, allowNull: false },
      order_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      movement_date: { type: Sequelize.DATEONLY, allowNull: false },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("stock_movements", ["item_id", "movement_date"]);
    await queryInterface.addIndex("stock_movements", ["reference_type", "reference_id"]);
    await queryInterface.addIndex("stock_movements", ["movement_type"]);
    await queryInterface.addIndex("stock_movements", ["order_id"]);
    await queryInterface.addIndex("stock_movements", ["stock_batch_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("stock_movements");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_stock_movements_movement_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_stock_movements_reference_type";');
  },
};
