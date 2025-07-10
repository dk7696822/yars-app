'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'round_off_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      validate: {
        isDecimal: true,
      },
      comment: 'Amount to be rounded off from the total order amount. Can be positive or negative.'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'round_off_amount');
  }
};
