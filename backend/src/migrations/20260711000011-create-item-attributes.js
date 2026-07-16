"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("item_attributes", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.TEXT, allowNull: false, unique: true },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("item_attribute_values", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      attribute_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "item_attributes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      value: { type: Sequelize.TEXT, allowNull: false },
      is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("item_attribute_values", ["attribute_id"]);
    // No duplicate values under one attribute ("W Cut" twice under "Cut").
    await queryInterface.addConstraint("item_attribute_values", {
      fields: ["attribute_id", "value"],
      type: "unique",
      name: "item_attribute_values_attribute_id_value_unique",
    });

    await queryInterface.createTable("inventory_item_attribute_values", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE", // link rows are owned by the item
      },
      attribute_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "item_attributes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      attribute_value_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "item_attribute_values", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("inventory_item_attribute_values", ["item_id"]);
    await queryInterface.addIndex("inventory_item_attribute_values", ["attribute_value_id"]);
    // An item gets at most ONE value per attribute. This is the constraint the
    // denormalised attribute_id exists for — enforce it in the database.
    await queryInterface.addConstraint("inventory_item_attribute_values", {
      fields: ["item_id", "attribute_id"],
      type: "unique",
      name: "inventory_item_attribute_values_item_id_attribute_id_unique",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("inventory_item_attribute_values");
    await queryInterface.dropTable("item_attribute_values");
    await queryInterface.dropTable("item_attributes");
  },
};
