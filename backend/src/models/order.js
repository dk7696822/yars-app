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

      Order.belongsTo(models.Invoice, {
        foreignKey: "invoice_id",
        as: "invoice",
      });

      Order.hasMany(models.InvoiceItem, {
        foreignKey: "order_id",
        as: "invoiceItems",
      });

      Order.hasMany(models.Payment, {
        foreignKey: "order_id",
        as: "payments",
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
      invoice_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "invoices",
          key: "id",
        },
      },
      custom_plate_charge: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
          isDecimal: true,
          min: 0,
        },
        comment: "Custom plate charge for this order. If NULL, uses plate_types.charge",
      },
      round_off_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        validate: {
          isDecimal: true,
        },
        comment: "Amount to be rounded off from the total order amount. Can be positive or negative.",
      },
    },
    {
      sequelize,
      modelName: "Order",
      tableName: "orders",
      timestamps: true,
      underscored: true,
      hooks: {
        afterCreate: async (order, options) => {
          const { createAuditLog, extractOrderAuditData } = require("../services/auditService");
          const { AuditLog, Customer } = sequelize.models;

          // Get customer name
          let customerName = null;
          if (order.customer_id) {
            const customer = await Customer.findByPk(order.customer_id);
            customerName = customer?.name;
          }

          await createAuditLog(AuditLog, {
            entityType: "ORDER",
            entityId: order.id,
            action: "CREATE",
            newValues: extractOrderAuditData(order),
            metadata: {
              customer_name: customerName,
              status: order.status,
              order_date: order.order_date,
            },
            transaction: options.transaction,
          });
        },

        beforeUpdate: async (order, options) => {
          // Store previous values for comparison
          order._previousValues = { ...order._previousDataValues };
        },

        afterUpdate: async (order, options) => {
          const { createAuditLog, extractOrderAuditData } = require("../services/auditService");
          const { AuditLog, Customer } = sequelize.models;

          const previousStatus = order._previousValues?.status;
          const currentStatus = order.status;
          const previousArchived = order._previousValues?.is_archived;
          const currentArchived = order.is_archived;

          // Only log if status changed or order was archived (soft delete)
          if (previousStatus !== currentStatus || previousArchived !== currentArchived) {
            // Get customer name
            let customerName = null;
            if (order.customer_id) {
              const customer = await Customer.findByPk(order.customer_id);
              customerName = customer?.name;
            }

            // Determine if this is a soft delete
            const action = !previousArchived && currentArchived ? "DELETE" : "UPDATE";

            await createAuditLog(AuditLog, {
              entityType: "ORDER",
              entityId: order.id,
              action,
              oldValues: extractOrderAuditData(order._previousValues),
              newValues: extractOrderAuditData(order),
              metadata: {
                customer_name: customerName,
                previous_status: previousStatus,
                new_status: currentStatus,
                is_soft_delete: action === "DELETE",
              },
              transaction: options.transaction,
            });
          }
        },
      },
    }
  );

  return Order;
};
