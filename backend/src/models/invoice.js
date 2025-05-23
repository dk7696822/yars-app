"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class Invoice extends Model {
    static associate(models) {
      // define association here
      Invoice.belongsTo(models.Customer, {
        foreignKey: "customer_id",
        as: "customer",
      });

      Invoice.hasMany(models.Order, {
        foreignKey: "invoice_id",
        as: "orders",
      });

      Invoice.hasMany(models.InvoiceItem, {
        foreignKey: "invoice_id",
        as: "invoiceItems",
      });

      Invoice.hasMany(models.Payment, {
        foreignKey: "invoice_id",
        as: "payments",
      });
    }
  }

  Invoice.init(
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
      invoice_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      invoice_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      billing_period_start: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      billing_period_end: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      payment_due_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          isDecimal: true,
          min: 0,
        },
      },
      tax_percent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          isDecimal: true,
          min: 0,
        },
      },
      tax_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          isDecimal: true,
          min: 0,
        },
      },
      final_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          isDecimal: true,
          min: 0,
        },
      },
      status: {
        type: DataTypes.ENUM("PENDING", "PAID", "CANCELLED"),
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
      modelName: "Invoice",
      tableName: "invoices",
      timestamps: true,
      underscored: true,
    }
  );

  return Invoice;
};
