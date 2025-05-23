'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    
    await queryInterface.bulkInsert('expense_categories', [
      {
        id: uuidv4(),
        name: 'Raw Materials',
        is_archived: false,
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        name: 'Utilities',
        is_archived: false,
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        name: 'Rent',
        is_archived: false,
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        name: 'Salaries',
        is_archived: false,
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        name: 'Equipment',
        is_archived: false,
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        name: 'Transportation',
        is_archived: false,
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        name: 'Maintenance',
        is_archived: false,
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        name: 'Miscellaneous',
        is_archived: false,
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('expense_categories', null, {});
  }
};
