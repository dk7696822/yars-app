"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class InventoryItem extends Model {
    static associate(models) {
      InventoryItem.belongsTo(models.InventoryCategory, { foreignKey: "category_id", as: "category" });
      InventoryItem.hasMany(models.StockBatch, { foreignKey: "item_id", as: "batches" });
      InventoryItem.hasMany(models.StockMovement, { foreignKey: "item_id", as: "movements" });
      InventoryItem.hasMany(models.PurchaseOrderItem, { foreignKey: "item_id", as: "purchaseOrderItems" });
      InventoryItem.hasMany(models.InventoryItemAttributeValue, {
        foreignKey: "item_id",
        as: "attributeValues",
      });
    }
  }

  InventoryItem.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      name: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } },
      // Uniqueness is a PARTIAL index (live rows only) — see the migration.
      item_code: { type: DataTypes.TEXT, allowNull: true },
      category_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "inventory_categories", key: "id" },
      },
      unit: {
        type: DataTypes.ENUM("KG", "PCS", "METRE", "ROLL", "LITRE"),
        allowNull: false,
      },
      reorder_level: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0,
        validate: { isDecimal: true, min: 0 },
      },
      reorder_target: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: true,
        validate: { isDecimal: true, min: 0 },
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "InventoryItem",
      tableName: "inventory_items",
      timestamps: true,
      underscored: true,
    }
  );

  return InventoryItem;
};
