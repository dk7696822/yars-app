"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class ItemAttribute extends Model {
    static associate(models) {
      ItemAttribute.hasMany(models.ItemAttributeValue, {
        foreignKey: "attribute_id",
        as: "values",
      });
    }
  }

  ItemAttribute.init(
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
      modelName: "ItemAttribute",
      tableName: "item_attributes",
      timestamps: true,
      underscored: true,
    }
  );

  return ItemAttribute;
};
