"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("inventory_categories", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.TEXT, allowNull: false },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    // Partial unique index: only LIVE categories must have distinct names —
    // an archived "Fabric" must not block creating a fresh "Fabric".
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX "inventory_categories_name_active_unique"
         ON "inventory_categories" ("name") WHERE is_archived = false;`
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("inventory_categories");
  },
};
