"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create payment_method enum type
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_payments_payment_method" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CHECK', 'OTHER');
    `);

    // Create payment_type enum type
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_payments_payment_type" AS ENUM ('ADVANCE', 'PARTIAL', 'FINAL', 'REFUND');
    `);

    await queryInterface.createTable("payments", {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: true, // Changed to allow null for order-only payments
        references: {
          model: "invoices",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: true, // Can be null for invoice-only payments
        references: {
          model: "orders",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      customer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "customers",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      payment_type: {
        type: Sequelize.ENUM("ADVANCE", "PARTIAL", "FINAL", "REFUND"),
        allowNull: false,
        defaultValue: "PARTIAL",
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      payment_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_DATE"),
      },
      payment_method: {
        type: Sequelize.ENUM("CASH", "BANK_TRANSFER", "UPI", "CHECK", "OTHER"),
        allowNull: false,
        defaultValue: "CASH",
      },
      reference_number: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("payments");

    // Drop enum types
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_payments_payment_method";
    `);

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_payments_payment_type";
    `);
  },
};
