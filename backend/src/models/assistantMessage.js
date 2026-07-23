"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class AssistantMessage extends Model {
    static associate(models) {
      AssistantMessage.belongsTo(models.AssistantConversation, {
        foreignKey: "conversation_id",
        as: "conversation",
      });
    }
  }

  AssistantMessage.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: () => uuidv4() },
      conversation_id: { type: DataTypes.UUID, allowNull: false },
      role: { type: DataTypes.TEXT, allowNull: false, validate: { isIn: [["user", "assistant"]] } },
      content: { type: DataTypes.TEXT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: "AssistantMessage", tableName: "assistant_messages", timestamps: true, underscored: true }
  );

  return AssistantMessage;
};
