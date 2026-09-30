"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class OrderProductSize extends Model {
    static associate(models) {
      // define association here
      OrderProductSize.belongsTo(models.Order, {
        foreignKey: "order_id",
        as: "order",
      });

      OrderProductSize.belongsTo(models.ProductSize, {
        foreignKey: "product_size_id",
        as: "productSize",
      });
    }
  }

  OrderProductSize.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv4(),
      },
      order_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "orders",
          key: "id",
        },
      },
      product_size_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "product_sizes",
          key: "id",
        },
      },
      quantity_kg: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
          isDecimal: true,
          min: 0,
        },
      },
      rate_per_kg: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
          isDecimal: true,
          min: 0,
        },
      },
      // KG lines use quantity_kg/rate_per_kg; PIECES lines use the fields
      // below. A DB CHECK guarantees a line is exactly one of the two.
      unit: { type: DataTypes.ENUM("KG", "PIECES"), allowNull: false, defaultValue: "KG" },
      quantity_pieces: { type: DataTypes.INTEGER, allowNull: true },
      price_amount: { type: DataTypes.DECIMAL(12, 4), allowNull: true },
      price_pieces_count: { type: DataTypes.INTEGER, allowNull: true },
      weight_kg: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
      weight_pieces_count: { type: DataTypes.INTEGER, allowNull: true },
      weight_source: { type: DataTypes.ENUM("SIZE", "MANUAL"), allowNull: true },
    },
    {
      sequelize,
      modelName: "OrderProductSize",
      tableName: "order_product_sizes",
      timestamps: false,
      underscored: true,
    }
  );

  return OrderProductSize;
};
