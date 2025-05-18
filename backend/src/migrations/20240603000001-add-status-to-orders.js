'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add status enum type
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_orders_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED', 'CANCELLED');
    `);
    
    // Add status column
    await queryInterface.addColumn('orders', 'status', {
      type: Sequelize.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'PENDING'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove status column
    await queryInterface.removeColumn('orders', 'status');
    
    // Drop enum type
    await queryInterface.sequelize.query(`
      DROP TYPE "enum_orders_status";
    `);
  }
};
