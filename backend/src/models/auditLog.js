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
        // Must stay in sync with the DB enum — migration 20260711000010 added
        // the three inventory document types. Sequelize validates ENUM values
        // client-side, so a value missing here would be rejected before it
        // ever reached Postgres.
        type: DataTypes.ENUM("PAYMENT", "ORDER", "PURCHASE_ORDER", "GOODS_RECEIPT", "STOCK_ISSUE"),
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
