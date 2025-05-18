'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('product_sizes', 'is_archived', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    
    await queryInterface.addColumn('product_sizes', 'created_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
    
    await queryInterface.addColumn('product_sizes', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('product_sizes', 'is_archived');
    await queryInterface.removeColumn('product_sizes', 'created_at');
    await queryInterface.removeColumn('product_sizes', 'updated_at');
  }
};
