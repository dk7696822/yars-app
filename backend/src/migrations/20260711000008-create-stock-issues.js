"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("stock_issues", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      issue_number: { type: Sequelize.TEXT, allowNull: false, unique: true },
      issue_date: { type: Sequelize.DATEONLY, allowNull: false },
      issue_type: {
        type: Sequelize.ENUM("ISSUE", "WASTAGE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"),
        allowNull: false,
        defaultValue: "ISSUE",
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: true, // optional tag: which customer order consumed this
        references: { model: "orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      reason: { type: Sequelize.TEXT, allowNull: true }, // REQUIRED for adjustments (enforced in service)
      notes: { type: Sequelize.TEXT, allowNull: true },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("stock_issue_items", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      stock_issue_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "stock_issues", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      quantity: { type: Sequelize.DECIMAL(12, 3), allowNull: false },
      total_cost: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      wastage_quantity: { type: Sequelize.DECIMAL(12, 3), allowNull: false, defaultValue: 0 },
      wastage_cost: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("stock_issues", ["issue_date"]);
    await queryInterface.addIndex("stock_issues", ["issue_type"]);
    await queryInterface.addIndex("stock_issues", ["order_id"]);
    await queryInterface.addIndex("stock_issue_items", ["stock_issue_id"]);
    await queryInterface.addIndex("stock_issue_items", ["item_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("stock_issue_items");
    await queryInterface.dropTable("stock_issues");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_stock_issues_issue_type";');
  },
};
