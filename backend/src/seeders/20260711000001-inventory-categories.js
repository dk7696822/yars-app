"use strict";
const { v4: uuidv4 } = require("uuid");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const categories = ["Fabric", "Handle", "Thread", "Ink", "Packing"];

    await queryInterface.bulkInsert(
      "inventory_categories",
      categories.map((name) => ({
        id: uuidv4(),
        name,
        is_archived: false,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("inventory_categories", {
      name: { [Sequelize.Op.in]: ["Fabric", "Handle", "Thread", "Ink", "Packing"] },
    });
  },
};
