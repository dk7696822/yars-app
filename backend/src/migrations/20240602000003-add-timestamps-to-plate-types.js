'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('plate_types', 'is_archived', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    
    await queryInterface.addColumn('plate_types', 'created_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
    
    await queryInterface.addColumn('plate_types', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('plate_types', 'is_archived');
    await queryInterface.removeColumn('plate_types', 'created_at');
    await queryInterface.removeColumn('plate_types', 'updated_at');
  }
};
