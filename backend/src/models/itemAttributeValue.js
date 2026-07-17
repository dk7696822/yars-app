"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class ItemAttributeValue extends Model {
    static associate(models) {
      ItemAttributeValue.belongsTo(models.ItemAttribute, {
        foreignKey: "attribute_id",
        as: "attribute",
      });
      ItemAttributeValue.hasMany(models.InventoryItemAttributeValue, {
        foreignKey: "attribute_value_id",
        as: "itemLinks",
      });
    }
  }

  ItemAttributeValue.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      attribute_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "item_attributes", key: "id" },
      },
      value: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "ItemAttributeValue",
      tableName: "item_attribute_values",
      timestamps: true,
      underscored: true,
    }
  );

  return ItemAttributeValue;
};
