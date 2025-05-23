"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    static associate(models) {
      // define association here
      Payment.belongsTo(models.Invoice, {
        foreignKey: "invoice_id",
        as: "invoice",
      });

      Payment.belongsTo(models.Order, {
        foreignKey: "order_id",
        as: "order",
      });

      Payment.belongsTo(models.Customer, {
        foreignKey: "customer_id",
        as: "customer",
      });
    }
  }

  Payment.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv4(),
      },
      invoice_id: {
        type: DataTypes.UUID,
        allowNull: true, // Changed to allow null since payments can be for orders without invoices
        references: {
          model: "invoices",
          key: "id",
        },
      },
      order_id: {
        type: DataTypes.UUID,
        allowNull: true, // Can be null for invoice-only payments
        references: {
          model: "orders",
          key: "id",
        },
      },
      customer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "customers",
          key: "id",
        },
      },
      payment_type: {
        type: DataTypes.ENUM("ADVANCE", "PARTIAL", "FINAL", "REFUND"),
        allowNull: false,
        defaultValue: "PARTIAL",
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          isDecimal: true,
          min: 0,
        },
      },
      payment_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      payment_method: {
        type: DataTypes.ENUM("CASH", "BANK_TRANSFER", "UPI", "CHECK", "OTHER"),
        allowNull: false,
        defaultValue: "CASH",
      },
      reference_number: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      modelName: "Payment",
      tableName: "payments",
      timestamps: true,
      underscored: true,
    }
  );

  return Payment;
};
