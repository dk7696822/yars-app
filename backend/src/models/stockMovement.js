"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class StockMovement extends Model {
    static associate(models) {
      StockMovement.belongsTo(models.InventoryItem, { foreignKey: "item_id", as: "item" });
      StockMovement.belongsTo(models.StockBatch, { foreignKey: "stock_batch_id", as: "batch" });
      StockMovement.belongsTo(models.Order, { foreignKey: "order_id", as: "order" });
    }
  }

  StockMovement.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
      },
      movement_type: {
        type: DataTypes.ENUM("RECEIPT", "ISSUE", "WASTAGE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"),
        allowNull: false,
      },
      // Signed: positive into stock, negative out of stock.
      quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
      stock_batch_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "stock_batches", key: "id" },
      },
      unit_cost: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      total_cost: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      reference_type: {
        type: DataTypes.ENUM("GOODS_RECEIPT", "STOCK_ISSUE", "STOCK_ADJUSTMENT"),
        allowNull: false,
      },
      reference_id: { type: DataTypes.UUID, allowNull: false },
      order_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "orders", key: "id" },
      },
      movement_date: { type: DataTypes.DATEONLY, allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "StockMovement",
      tableName: "stock_movements",
      timestamps: true,
      updatedAt: false, // append-only ledger: rows are never modified
      underscored: true,
    }
  );

  return StockMovement;
};
