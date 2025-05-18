'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'is_archived', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    
    await queryInterface.addColumn('orders', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'is_archived');
    await queryInterface.removeColumn('orders', 'updated_at');
  }
};
