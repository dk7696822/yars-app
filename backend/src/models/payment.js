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
      hooks: {
        beforeCreate: async (payment, options) => {
          // Calculate BEFORE metrics (before this payment is added)
          if (payment.order_id) {
            const { calculateOrderMetrics } = require("../services/auditService");
            payment._beforeMetrics = await calculateOrderMetrics(sequelize.models, payment.order_id);
          }
        },

        afterCreate: async (payment, options) => {
          const { createAuditLog, extractPaymentAuditData, calculateOrderMetrics } = require("../services/auditService");
          const { AuditLog, Customer } = sequelize.models;

          // Get customer name
          let customerName = null;
          if (payment.customer_id) {
            const customer = await Customer.findByPk(payment.customer_id);
            customerName = customer?.name;
          }

          // Calculate AFTER metrics
          let afterMetrics = { total_amount: 0, total_received: 0, outstanding: 0 };
          if (payment.order_id) {
            afterMetrics = await calculateOrderMetrics(sequelize.models, payment.order_id);
          }

          await createAuditLog(AuditLog, {
            entityType: "PAYMENT",
            entityId: payment.id,
            action: "CREATE",
            newValues: extractPaymentAuditData(payment),
            metadata: {
              customer_name: customerName,
              order_id: payment.order_id,
              invoice_id: payment.invoice_id,
              amount: parseFloat(payment.amount),
              payment_type: payment.payment_type,
              before_metrics: payment._beforeMetrics || null,
              after_metrics: afterMetrics,
            },
            transaction: options.transaction,
          });
        },

        beforeUpdate: async (payment, options) => {
          // Store previous values for comparison
          payment._previousValues = { ...payment._previousDataValues };

          // Calculate BEFORE metrics
          if (payment.order_id) {
            const { calculateOrderMetrics } = require("../services/auditService");
            payment._beforeMetrics = await calculateOrderMetrics(sequelize.models, payment.order_id);
          }
        },

        afterUpdate: async (payment, options) => {
          const { createAuditLog, extractPaymentAuditData, calculateOrderMetrics } = require("../services/auditService");
          const { AuditLog, Customer } = sequelize.models;

          // Get customer name
          let customerName = null;
          if (payment.customer_id) {
            const customer = await Customer.findByPk(payment.customer_id);
            customerName = customer?.name;
          }

          // Calculate AFTER metrics
          let afterMetrics = { total_amount: 0, total_received: 0, outstanding: 0 };
          if (payment.order_id) {
            afterMetrics = await calculateOrderMetrics(sequelize.models, payment.order_id);
          }

          await createAuditLog(AuditLog, {
            entityType: "PAYMENT",
            entityId: payment.id,
            action: "UPDATE",
            oldValues: extractPaymentAuditData(payment._previousValues),
            newValues: extractPaymentAuditData(payment),
            metadata: {
              customer_name: customerName,
              order_id: payment.order_id,
              invoice_id: payment.invoice_id,
              before_metrics: payment._beforeMetrics || null,
              after_metrics: afterMetrics,
            },
            transaction: options.transaction,
          });
        },

        beforeDestroy: async (payment, options) => {
          const { createAuditLog, extractPaymentAuditData, calculateOrderMetrics } = require("../services/auditService");
          const { AuditLog, Customer } = sequelize.models;

          // Get customer name
          let customerName = null;
          if (payment.customer_id) {
            const customer = await Customer.findByPk(payment.customer_id);
            customerName = customer?.name;
          }

          // Calculate BEFORE metrics (this is what it looks like before deletion)
          let beforeMetrics = { total_amount: 0, total_received: 0, outstanding: 0 };
          if (payment.order_id) {
            beforeMetrics = await calculateOrderMetrics(sequelize.models, payment.order_id);
          }

          // Calculate what AFTER metrics will be (outstanding will increase by payment amount)
          const afterMetrics = {
            total_amount: beforeMetrics.total_amount,
            total_received: parseFloat((beforeMetrics.total_received - parseFloat(payment.amount)).toFixed(2)),
            outstanding: parseFloat((beforeMetrics.outstanding + parseFloat(payment.amount)).toFixed(2)),
          };

          await createAuditLog(AuditLog, {
            entityType: "PAYMENT",
            entityId: payment.id,
            action: "DELETE",
            oldValues: extractPaymentAuditData(payment),
            metadata: {
              customer_name: customerName,
              order_id: payment.order_id,
              invoice_id: payment.invoice_id,
              amount: parseFloat(payment.amount),
              payment_type: payment.payment_type,
              before_metrics: beforeMetrics,
              after_metrics: afterMetrics,
            },
            transaction: options.transaction,
          });
        },
      },
    }
  );

  return Payment;
};
