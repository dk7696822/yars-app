"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class AssistantConversation extends Model {
    static associate(models) {
      AssistantConversation.hasMany(models.AssistantMessage, {
        foreignKey: "conversation_id",
        as: "messages",
      });
      AssistantConversation.hasMany(models.AssistantAction, { foreignKey: "conversation_id", as: "actions" });
    }
  }

  AssistantConversation.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      title: { type: DataTypes.TEXT, allowNull: false, defaultValue: "New conversation" },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: "AssistantConversation", tableName: "assistant_conversations", timestamps: true, underscored: true }
  );

  return AssistantConversation;
};
