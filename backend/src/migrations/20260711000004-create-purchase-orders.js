"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("purchase_orders", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      po_number: { type: Sequelize.TEXT, allowNull: false, unique: true },
      supplier_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "suppliers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      order_date: { type: Sequelize.DATEONLY, allowNull: false },
      expected_date: { type: Sequelize.DATEONLY, allowNull: true },
      status: {
        type: Sequelize.ENUM("PENDING", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"),
        allowNull: false,
        defaultValue: "PENDING",
      },
      notes: { type: Sequelize.TEXT, allowNull: true },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("purchase_orders", ["supplier_id"]);
    await queryInterface.addIndex("purchase_orders", ["status"]);
    await queryInterface.addIndex("purchase_orders", ["order_date"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("purchase_orders");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_purchase_orders_status";');
  },
};
