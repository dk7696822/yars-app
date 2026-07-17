"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("audit_logs", {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      entity_type: {
        type: Sequelize.ENUM("PAYMENT", "ORDER"),
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      action: {
        type: Sequelize.ENUM("CREATE", "UPDATE", "DELETE"),
        allowNull: false,
      },
      old_values: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      new_values: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      changed_fields: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Add indexes for performance
    await queryInterface.addIndex("audit_logs", ["entity_type"]);
    await queryInterface.addIndex("audit_logs", ["entity_id"]);
    await queryInterface.addIndex("audit_logs", ["action"]);
    await queryInterface.addIndex("audit_logs", ["created_at"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("audit_logs");
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_audit_logs_entity_type";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_audit_logs_action";`);
  },
};
