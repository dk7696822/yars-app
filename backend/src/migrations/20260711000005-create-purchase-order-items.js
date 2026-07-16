"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("purchase_order_items", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      purchase_order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "purchase_orders", key: "id" },
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
      quantity_ordered: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      rate: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      quantity_received: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("purchase_order_items", ["purchase_order_id"]);
    await queryInterface.addIndex("purchase_order_items", ["item_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("purchase_order_items");
  },
};
