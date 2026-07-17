"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class StockBatch extends Model {
    static associate(models) {
      StockBatch.belongsTo(models.InventoryItem, { foreignKey: "item_id", as: "item" });
      StockBatch.belongsTo(models.GoodsReceiptItem, { foreignKey: "goods_receipt_item_id", as: "goodsReceiptItem" });
      StockBatch.hasMany(models.StockMovement, { foreignKey: "stock_batch_id", as: "movements" });
    }
  }

  StockBatch.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
      },
      goods_receipt_item_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "goods_receipt_items", key: "id" },
      },
      received_date: { type: DataTypes.DATEONLY, allowNull: false },
      quantity_received: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        validate: { isDecimal: true, min: 0 },
      },
      quantity_remaining: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        validate: { isDecimal: true, min: 0 },
      },
      rate: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        validate: { isDecimal: true, min: 0 },
      },
      // FIFO tiebreaker for same-day batches. The DB identity column generates
      // it; autoIncrement makes Sequelize omit it on INSERT. Read-only from the
      // app's perspective — never set or update it in application code.
      sequence_number: {
        type: DataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "StockBatch",
      tableName: "stock_batches",
      timestamps: true,
      underscored: true,
    }
  );

  return StockBatch;
};
