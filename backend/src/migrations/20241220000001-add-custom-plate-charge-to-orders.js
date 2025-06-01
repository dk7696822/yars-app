'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add custom_plate_charge column to orders table
    await queryInterface.addColumn('orders', 'custom_plate_charge', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true, // NULL means use default plate type charge
      comment: 'Custom plate charge for this order. If NULL, uses plate_types.charge'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove custom_plate_charge column
    await queryInterface.removeColumn('orders', 'custom_plate_charge');
  }
};
