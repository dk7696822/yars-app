"use strict";
const { Model } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  class AuditLog extends Model {
    static associate(models) {
      // No foreign key associations - entity_id is polymorphic
    }
  }

  AuditLog.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv4(),
      },
      entity_type: {
        type: DataTypes.ENUM("PAYMENT", "ORDER"),
        allowNull: false,
      },
      entity_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      action: {
        type: DataTypes.ENUM("CREATE", "UPDATE", "DELETE"),
        allowNull: false,
      },
      old_values: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      new_values: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      changed_fields: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: "AuditLog",
      tableName: "audit_logs",
      timestamps: false,
      underscored: true,
    }
  );

  return AuditLog;
};
