"use strict";
const { v4: uuidv4 } = require("uuid");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Color ships with no values on purpose: colours are business-specific,
    // and a wrong default is worse than an empty dropdown the user fills once.
    const defaults = {
      Cut: ["D Cut", "W Cut", "U Cut", "Loop Handle"],
      GSM: ["60", "70", "80", "90", "100"],
      Color: [],
    };

    const attributes = [];
    const values = [];

    for (const [name, attributeValues] of Object.entries(defaults)) {
      const attributeId = uuidv4();
      attributes.push({ id: attributeId, name, is_archived: false, created_at: now, updated_at: now });

      for (const value of attributeValues) {
        values.push({
          id: uuidv4(),
          attribute_id: attributeId,
          value,
          is_archived: false,
          created_at: now,
          updated_at: now,
        });
      }
    }

    await queryInterface.bulkInsert("item_attributes", attributes);
    await queryInterface.bulkInsert("item_attribute_values", values);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("inventory_item_attribute_values", null, {});
    await queryInterface.bulkDelete("item_attribute_values", null, {});
    await queryInterface.bulkDelete("item_attributes", null, {});
  },
};
