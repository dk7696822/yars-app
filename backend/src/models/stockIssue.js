"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class StockIssue extends Model {
    static associate(models) {
      StockIssue.hasMany(models.StockIssueItem, { foreignKey: "stock_issue_id", as: "items" });
      StockIssue.belongsTo(models.Order, { foreignKey: "order_id", as: "order" });
    }
  }

  StockIssue.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      issue_number: { type: DataTypes.TEXT, allowNull: false, unique: true },
      issue_date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
      issue_type: {
        type: DataTypes.ENUM("ISSUE", "WASTAGE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"),
        allowNull: false,
        defaultValue: "ISSUE",
      },
      order_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "orders", key: "id" },
      },
      reason: { type: DataTypes.TEXT, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "StockIssue",
      tableName: "stock_issues",
      timestamps: true,
      underscored: true,
    }
  );

  return StockIssue;
};
