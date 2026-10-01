"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

const STATUSES = ["pending", "confirmed", "cancelled", "expired", "failed", "completed_in_form"];

module.exports = (sequelize, DataTypes) => {
  class AssistantAction extends Model {
    static associate(models) {
      AssistantAction.belongsTo(models.AssistantConversation, { foreignKey: "conversation_id", as: "conversation" });
      AssistantAction.belongsTo(models.AssistantMessage, { foreignKey: "message_id", as: "message" });
    }
  }

  AssistantAction.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      conversation_id: { type: DataTypes.UUID, allowNull: false },
      message_id: { type: DataTypes.UUID, allowNull: true },
      user_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.TEXT, allowNull: false },
      request_text: { type: DataTypes.TEXT, allowNull: true },
      payload: { type: DataTypes.JSONB, allowNull: false },
      context: { type: DataTypes.JSONB, allowNull: true },
      card: { type: DataTypes.JSONB, allowNull: false },
      fingerprint: { type: DataTypes.JSONB, allowNull: true },
      status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "pending", validate: { isIn: [STATUSES] } },
      result_id: { type: DataTypes.UUID, allowNull: true },
      result_link: { type: DataTypes.TEXT, allowNull: true },
      form_link: { type: DataTypes.TEXT, allowNull: true },
      error: { type: DataTypes.TEXT, allowNull: true },
      outcome: { type: DataTypes.JSONB, allowNull: true },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      confirmed_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: "AssistantAction", tableName: "assistant_actions", timestamps: true, underscored: true }
  );

  return AssistantAction;
};
