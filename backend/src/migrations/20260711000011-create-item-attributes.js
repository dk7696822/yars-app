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
    // Composite-FK target: lets inventory_item_attribute_values enforce that a
    // chosen value actually belongs to the claimed attribute (see below).
    await queryInterface.addConstraint("item_attribute_values", {
      fields: ["id", "attribute_id"],
      type: "unique",
      name: "item_attribute_values_id_attribute_id_unique",
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
      // No plain FK here: the value must be tied to attribute_id via the
      // composite FK below, otherwise "Cut" could be paired with a GSM value.
      attribute_value_id: {
        type: Sequelize.UUID,
        allowNull: false,
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
    // Composite FK: attribute_value_id must belong to attribute_id.
    await queryInterface.addConstraint("inventory_item_attribute_values", {
      fields: ["attribute_value_id", "attribute_id"],
      type: "foreign key",
      name: "inventory_item_attribute_values_value_attribute_fk",
      references: {
        table: "item_attribute_values",
        fields: ["id", "attribute_id"],
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("inventory_item_attribute_values");
    await queryInterface.dropTable("item_attribute_values");
    await queryInterface.dropTable("item_attributes");
  },
};
