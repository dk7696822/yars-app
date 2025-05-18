'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('product_sizes', [
      {
        id: uuidv4(),
        size_label: '8x10',
        rate_per_kg: 120.00
      },
      {
        id: uuidv4(),
        size_label: '10x12',
        rate_per_kg: 130.00
      },
      {
        id: uuidv4(),
        size_label: '12x16',
        rate_per_kg: 150.00
      },
      {
        id: uuidv4(),
        size_label: '14x18',
        rate_per_kg: 170.00
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('product_sizes', null, {});
  }
};
