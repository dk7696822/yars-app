"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class InventoryCategory extends Model {
    static associate(models) {
      InventoryCategory.hasMany(models.InventoryItem, {
        foreignKey: "category_id",
        as: "items",
      });
    }
  }

  InventoryCategory.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      name: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
        validate: { notEmpty: true },
      },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "InventoryCategory",
      tableName: "inventory_categories",
      timestamps: true,
      underscored: true,
    }
  );

  return InventoryCategory;
};
