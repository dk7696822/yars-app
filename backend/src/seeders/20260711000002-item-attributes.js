"use strict";
const { v4: uuidv4 } = require("uuid");

// Color ships with no values on purpose: colours are business-specific,
// and a wrong default is worse than an empty dropdown the user fills once.
const DEFAULTS = {
  Cut: ["D Cut", "W Cut", "U Cut", "Loop Handle"],
  GSM: ["60", "70", "80", "90", "100"],
  Color: [],
};
const DEFAULT_NAMES = Object.keys(DEFAULTS);

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Guard against re-running at rollout: if any of the seeded attribute
    // names already exist, assume this seeder already ran and skip entirely.
    const existing = await queryInterface.sequelize.query(
      `SELECT name FROM item_attributes WHERE name IN (:names)`,
      { replacements: { names: DEFAULT_NAMES }, type: Sequelize.QueryTypes.SELECT }
    );
    if (existing.length > 0) {
      return;
    }

    const now = new Date();
    const attributes = [];
    const values = [];

    for (const [name, attributeValues] of Object.entries(DEFAULTS)) {
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

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert("item_attributes", attributes, { transaction });
      await queryInterface.bulkInsert("item_attribute_values", values, { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    // Only remove the seeded attributes (and their values, via the attribute_id
    // FK) — never a blanket wipe, which would destroy user-created attributes
    // after go-live. If a seeded attribute is still referenced by an item
    // (inventory_item_attribute_values), the RESTRICT FK correctly blocks this.
    const seeded = await queryInterface.sequelize.query(
      `SELECT id FROM item_attributes WHERE name IN (:names)`,
      { replacements: { names: DEFAULT_NAMES }, type: Sequelize.QueryTypes.SELECT }
    );
    const seededIds = seeded.map((row) => row.id);
    if (seededIds.length === 0) {
      return;
    }

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete(
        "item_attribute_values",
        { attribute_id: { [Sequelize.Op.in]: seededIds } },
        { transaction }
      );
      await queryInterface.bulkDelete(
        "item_attributes",
        { id: { [Sequelize.Op.in]: seededIds } },
        { transaction }
      );
    });
  },
};
