"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      // define association here
      Order.belongsTo(models.Customer, {
        foreignKey: "customer_id",
        as: "customer",
      });

      Order.belongsTo(models.PlateType, {
        foreignKey: "plate_type_id",
        as: "plateType",
      });

      Order.belongsToMany(models.ProductSize, {
        through: models.OrderProductSize,
        foreignKey: "order_id",
        as: "productSizes",
      });

      Order.hasMany(models.OrderProductSize, {
        foreignKey: "order_id",
        as: "orderProductSizes",
      });
    }
  }

  Order.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv4(),
      },
      customer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "customers",
          key: "id",
        },
      },
      order_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      advance_received: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          isDecimal: true,
          min: 0,
        },
      },
      plate_type_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "plate_types",
          key: "id",
        },
      },
      status: {
        type: DataTypes.ENUM("PENDING", "IN_PROGRESS", "COMPLETED", "DELIVERED", "CANCELLED"),
        allowNull: false,
        defaultValue: "PENDING",
      },
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
      modelName: "Order",
      tableName: "orders",
      timestamps: true,
      underscored: true,
    }
  );

  return Order;
};
