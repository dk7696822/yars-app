'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('plate_types', [
      {
        id: uuidv4(),
        type_name: 'Normal',
        charge: 0.00
      },
      {
        id: uuidv4(),
        type_name: 'Design A',
        charge: 500.00
      },
      {
        id: uuidv4(),
        type_name: 'Design B',
        charge: 750.00
      },
      {
        id: uuidv4(),
        type_name: 'Premium',
        charge: 1000.00
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('plate_types', null, {});
  }
};
