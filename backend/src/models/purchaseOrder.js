"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrder extends Model {
    static associate(models) {
      PurchaseOrder.belongsTo(models.Supplier, { foreignKey: "supplier_id", as: "supplier" });
      PurchaseOrder.hasMany(models.PurchaseOrderItem, { foreignKey: "purchase_order_id", as: "items" });
      PurchaseOrder.hasMany(models.GoodsReceipt, { foreignKey: "purchase_order_id", as: "receipts" });
    }
  }

  PurchaseOrder.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      po_number: { type: DataTypes.TEXT, allowNull: false, unique: true },
      supplier_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "suppliers", key: "id" },
      },
      order_date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
      expected_date: { type: DataTypes.DATEONLY, allowNull: true },
      status: {
        type: DataTypes.ENUM("PENDING", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"),
        allowNull: false,
        defaultValue: "PENDING",
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "PurchaseOrder",
      tableName: "purchase_orders",
      timestamps: true,
      underscored: true,
    }
  );

  return PurchaseOrder;
};
