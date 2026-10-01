"use strict";

/**
 * Cards Sage proposes. Purely additive: one new table, created in one
 * transaction so a failure leaves nothing behind.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "assistant_actions",
        {
          id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
          conversation_id: { type: Sequelize.UUID, allowNull: false, references: { model: "assistant_conversations", key: "id" }, onDelete: "CASCADE" },
          message_id: { type: Sequelize.UUID, allowNull: true, references: { model: "assistant_messages", key: "id" }, onDelete: "SET NULL" },
          user_id: { type: Sequelize.UUID, allowNull: true }, // who asked; no FK, so an old login can never block a card
          name: { type: Sequelize.TEXT, allowNull: false },
          request_text: { type: Sequelize.TEXT, allowNull: true },
          payload: { type: Sequelize.JSONB, allowNull: false },
          context: { type: Sequelize.JSONB, allowNull: true },
          card: { type: Sequelize.JSONB, allowNull: false },
          fingerprint: { type: Sequelize.JSONB, allowNull: true },
          status: { type: Sequelize.TEXT, allowNull: false, defaultValue: "pending" },
          result_id: { type: Sequelize.UUID, allowNull: true },
          result_link: { type: Sequelize.TEXT, allowNull: true },
          form_link: { type: Sequelize.TEXT, allowNull: true },
          error: { type: Sequelize.TEXT, allowNull: true },
          outcome: { type: Sequelize.JSONB, allowNull: true },
          expires_at: { type: Sequelize.DATE, allowNull: false },
          confirmed_at: { type: Sequelize.DATE, allowNull: true },
          created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
          updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        },
        { transaction }
      );
      await queryInterface.addIndex("assistant_actions", ["conversation_id", "created_at"], { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("assistant_actions");
  },
};
