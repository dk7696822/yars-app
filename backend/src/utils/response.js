'use strict';

/**
 * Standard success response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Success message
 * @param {Object|Array} data - Response data
 * @returns {Object} Response object
 */
const success = (res, statusCode = 200, message = 'Success', data = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Standard error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Object|Array} errors - Error details
 * @returns {Object} Response object
 */
const error = (res, statusCode = 500, message = 'Error', errors = {}) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors
  });
};

module.exports = {
  success,
  error
};
