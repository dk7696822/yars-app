"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class GoodsReceiptItem extends Model {
    static associate(models) {
      GoodsReceiptItem.belongsTo(models.GoodsReceipt, { foreignKey: "goods_receipt_id", as: "goodsReceipt" });
      GoodsReceiptItem.belongsTo(models.PurchaseOrderItem, { foreignKey: "purchase_order_item_id", as: "purchaseOrderItem" });
      GoodsReceiptItem.belongsTo(models.InventoryItem, { foreignKey: "item_id", as: "item" });
      GoodsReceiptItem.hasOne(models.StockBatch, { foreignKey: "goods_receipt_item_id", as: "batch" });
    }
  }

  GoodsReceiptItem.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      goods_receipt_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "goods_receipts", key: "id" },
      },
      purchase_order_item_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "purchase_order_items", key: "id" },
      },
      item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
      },
      quantity_received: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        validate: { isDecimal: true, min: 0.001 },
      },
      rate: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        validate: { isDecimal: true, min: 0 },
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "GoodsReceiptItem",
      tableName: "goods_receipt_items",
      timestamps: true,
      underscored: true,
    }
  );

  return GoodsReceiptItem;
};
