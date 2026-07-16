"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class StockIssueItem extends Model {
    static associate(models) {
      StockIssueItem.belongsTo(models.StockIssue, { foreignKey: "stock_issue_id", as: "stockIssue" });
      StockIssueItem.belongsTo(models.InventoryItem, { foreignKey: "item_id", as: "item" });
    }
  }

  StockIssueItem.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      stock_issue_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "stock_issues", key: "id" },
      },
      item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "inventory_items", key: "id" },
      },
      quantity: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        validate: { isDecimal: true, min: 0.001 },
      },
      total_cost: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      wastage_quantity: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0,
        validate: { isDecimal: true, min: 0 },
      },
      wastage_cost: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "StockIssueItem",
      tableName: "stock_issue_items",
      timestamps: true,
      underscored: true,
    }
  );

  return StockIssueItem;
};
