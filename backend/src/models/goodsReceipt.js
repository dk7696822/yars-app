"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class GoodsReceipt extends Model {
    static associate(models) {
      GoodsReceipt.belongsTo(models.Supplier, { foreignKey: "supplier_id", as: "supplier" });
      GoodsReceipt.belongsTo(models.PurchaseOrder, { foreignKey: "purchase_order_id", as: "purchaseOrder" });
      GoodsReceipt.hasMany(models.GoodsReceiptItem, { foreignKey: "goods_receipt_id", as: "items" });
    }
  }

  GoodsReceipt.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      receipt_number: { type: DataTypes.TEXT, allowNull: false, unique: true },
      purchase_order_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "purchase_orders", key: "id" },
      },
      supplier_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "suppliers", key: "id" },
      },
      receipt_date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
      supplier_bill_ref: { type: DataTypes.TEXT, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "GoodsReceipt",
      tableName: "goods_receipts",
      timestamps: true,
      underscored: true,
    }
  );

  return GoodsReceipt;
};
