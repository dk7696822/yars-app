"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
    // Do NOT wrap these in queryInterface.sequelize.transaction().
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_audit_logs_entity_type" ADD VALUE IF NOT EXISTS 'PURCHASE_ORDER';`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_audit_logs_entity_type" ADD VALUE IF NOT EXISTS 'GOODS_RECEIPT';`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_audit_logs_entity_type" ADD VALUE IF NOT EXISTS 'STOCK_ISSUE';`
    );
  },

  async down() {
    // Postgres cannot remove a value from an enum type. Rolling this back would
    // require recreating the type and rewriting audit_logs. Intentionally a no-op:
    // leaving the extra values in place is harmless.
  },
};
