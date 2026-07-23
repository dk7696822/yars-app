"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("assistant_messages", {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "assistant_conversations", key: "id" },
        onDelete: "CASCADE",
      },
      role: { type: Sequelize.TEXT, allowNull: false }, // 'user' | 'assistant'
      content: { type: Sequelize.TEXT, allowNull: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });
    await queryInterface.addIndex("assistant_messages", ["conversation_id", "created_at"]);
  },
  async down(queryInterface) {
    await queryInterface.dropTable("assistant_messages");
  },
};
