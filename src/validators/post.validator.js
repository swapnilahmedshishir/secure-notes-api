const { z } = require('zod');
const { paginationQuery, idParams } = require('./common');

const create = {
  body: z.strictObject({
    title: z.string().trim().min(1).max(150),
    body: z.string().min(1).max(20000),
  }),
};

const list = { query: z.strictObject(paginationQuery) };

const listByUser = {
  params: idParams,
  query: z.strictObject(paginationQuery),
};

module.exports = { create, list, listByUser };
