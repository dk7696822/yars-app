"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrderItem extends Model {
    static associate(models) {
      PurchaseOrderItem.belongsTo(models.PurchaseOrder, { foreignKey: "purchase_order_id", as: "purchaseOrder" });
      PurchaseOrderItem.belongsTo(models.InventoryItem, { foreignKey: "item_id", as: "item" });
    }
  }

  PurchaseOrderItem.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      purchase_order_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "purchase_orders", key: "id" },
      },
      item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
      },
      quantity_ordered: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        validate: { isDecimal: true, min: 0.001 },
      },
      rate: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        validate: { isDecimal: true, min: 0 },
      },
      quantity_received: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0,
        validate: { isDecimal: true, min: 0 },
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "PurchaseOrderItem",
      tableName: "purchase_order_items",
      timestamps: true,
      underscored: true,
    }
  );

  return PurchaseOrderItem;
};
