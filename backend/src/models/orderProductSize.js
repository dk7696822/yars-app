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
        allowNull: false,
        validate: {
          isDecimal: true,
          min: 0,
        },
      },
      rate_per_kg: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          isDecimal: true,
          min: 0,
        },
      },
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
