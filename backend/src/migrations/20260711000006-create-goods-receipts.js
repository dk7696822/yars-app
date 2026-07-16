"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("goods_receipts", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      receipt_number: { type: Sequelize.TEXT, allowNull: false, unique: true },
      purchase_order_id: {
        type: Sequelize.UUID,
        allowNull: true, // material can arrive with no PO
        references: { model: "purchase_orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      supplier_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "suppliers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      receipt_date: { type: Sequelize.DATEONLY, allowNull: false },
      supplier_bill_ref: { type: Sequelize.TEXT, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("goods_receipt_items", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      goods_receipt_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "goods_receipts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      purchase_order_item_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "purchase_order_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      quantity_received: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      rate: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("goods_receipts", ["supplier_id"]);
    await queryInterface.addIndex("goods_receipts", ["purchase_order_id"]);
    await queryInterface.addIndex("goods_receipt_items", ["goods_receipt_id"]);
    await queryInterface.addIndex("goods_receipt_items", ["item_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("goods_receipt_items");
    await queryInterface.dropTable("goods_receipts");
  },
};
