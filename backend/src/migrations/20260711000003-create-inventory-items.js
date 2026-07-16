"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("inventory_items", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.TEXT, allowNull: false },
      item_code: { type: Sequelize.TEXT, allowNull: true, unique: true },
      category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "inventory_categories", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      unit: { type: Sequelize.ENUM("KG", "PCS", "METRE", "ROLL", "LITRE"), allowNull: false },
      reorder_level: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      reorder_target: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("inventory_items", ["category_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("inventory_items");
    // Dropping the table leaves the enum type behind in Postgres.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_inventory_items_unit";');
  },
};
