"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class InventoryItemAttributeValue extends Model {
    static associate(models) {
      InventoryItemAttributeValue.belongsTo(models.InventoryItem, {
        foreignKey: "item_id",
        as: "item",
      });
      InventoryItemAttributeValue.belongsTo(models.ItemAttribute, {
        foreignKey: "attribute_id",
        as: "attribute",
      });
      InventoryItemAttributeValue.belongsTo(models.ItemAttributeValue, {
        foreignKey: "attribute_value_id",
        as: "value",
      });
    }
  }

  InventoryItemAttributeValue.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
      },
      // Denormalised from the value on purpose: it lets the DB enforce
      // UNIQUE(item_id, attribute_id) — one value per attribute per item.
      attribute_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "item_attributes", key: "id" },
      },
      attribute_value_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "InventoryItemAttributeValue",
      tableName: "inventory_item_attribute_values",
      timestamps: true,
      underscored: true,
    }
  );

  return InventoryItemAttributeValue;
};
