"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class InvoiceItem extends Model {
    static associate(models) {
      // define association here
      InvoiceItem.belongsTo(models.Invoice, {
        foreignKey: "invoice_id",
        as: "invoice",
      });

      InvoiceItem.belongsTo(models.Order, {
        foreignKey: "order_id",
        as: "order",
      });
    }
  }

  InvoiceItem.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv4(),
      },
      invoice_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "invoices",
          key: "id",
        },
      },
      order_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "orders",
          key: "id",
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          isDecimal: true,
          min: 0,
        },
      },
      unit_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          isDecimal: true,
          // Removed min: 0 validation to allow negative values for advance payments
        },
      },
      total_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          isDecimal: true,
          // Removed min: 0 validation to allow negative values for advance payments
        },
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
      modelName: "InvoiceItem",
      tableName: "invoice_items",
      timestamps: true,
      underscored: true,
    }
  );

  return InvoiceItem;
};
