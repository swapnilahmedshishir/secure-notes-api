const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid ObjectId');

const MAX_PAGE_SIZE = 100;

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(10),
};

const idParams = z.strictObject({ id: objectId });

module.exports = { objectId, paginationQuery, idParams };
