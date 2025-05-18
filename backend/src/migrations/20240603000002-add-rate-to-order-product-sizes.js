'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add rate_per_kg column
    await queryInterface.addColumn('order_product_sizes', 'rate_per_kg', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true, // Initially allow null for existing records
    });

    // Update existing records with the current rate from product_sizes
    await queryInterface.sequelize.query(`
      UPDATE order_product_sizes ops
      SET rate_per_kg = (
        SELECT rate_per_kg 
        FROM product_sizes ps 
        WHERE ps.id = ops.product_size_id
      )
    `);

    // Now make the column not nullable
    await queryInterface.changeColumn('order_product_sizes', 'rate_per_kg', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove rate_per_kg column
    await queryInterface.removeColumn('order_product_sizes', 'rate_per_kg');
  }
};
