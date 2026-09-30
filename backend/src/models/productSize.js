"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class ProductSize extends Model {
    static associate(models) {
      ProductSize.belongsToMany(models.Order, {
        through: models.OrderProductSize,
        foreignKey: "product_size_id",
        as: "orders",
      });
    }
  }

  ProductSize.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv4(),
      },
      size_label: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      rate_per_kg: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true, // NULL = sold only by pieces (at least one price is DB-enforced)
        validate: {
          isDecimal: true,
          min: 0,
        },
      },
      // "N pieces cost ₹X" — stored exactly as typed (see services/orderMath.js).
      piece_price_amount: { type: DataTypes.DECIMAL(12, 4), allowNull: true },
      piece_price_count: { type: DataTypes.INTEGER, allowNull: true },
      // "N pieces weigh W kg" — used only to estimate kg of pieces lines.
      weight_kg: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
      weight_pieces_count: { type: DataTypes.INTEGER, allowNull: true },
      is_archived: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: "ProductSize",
      tableName: "product_sizes",
      timestamps: true,
      underscored: true,
    }
  );

  return ProductSize;
};
