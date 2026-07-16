"use strict";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse page/limit query params into Sequelize's limit/offset.
 * Bad input silently falls back to the defaults — a broken query string
 * should not 500 the API.
 */
const getPagination = ({ page, limit } = {}) => {
  let parsedPage = parseInt(page, 10);
  let parsedLimit = parseInt(limit, 10);

  if (!Number.isInteger(parsedPage) || parsedPage < 1) parsedPage = 1;
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) parsedLimit = DEFAULT_LIMIT;
  if (parsedLimit > MAX_LIMIT) parsedLimit = MAX_LIMIT;

  return { page: parsedPage, limit: parsedLimit, offset: (parsedPage - 1) * parsedLimit };
};

/** Standard envelope for every paginated list endpoint. */
const buildPaginatedResponse = (rows, total, { page, limit }) => ({
  data: rows,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  },
});

module.exports = { getPagination, buildPaginatedResponse };
