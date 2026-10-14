const { z } = require('zod');
const { objectId, paginationQuery, idParams } = require('./common');

const title = z.string().trim().min(1).max(150);
const content = z.string().min(1).max(20000);

const create = {
  body: z.strictObject({ title, content }),
};

const update = {
  params: idParams,
  body: z
    .strictObject({ title: title.optional(), content: content.optional() })
    .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update'),
};

const byId = { params: idParams };

const listOwn = { query: z.strictObject(paginationQuery) };

const listAll = {
  query: z.strictObject({ ...paginationQuery, author: objectId.optional() }),
};

module.exports = { create, update, byId, listOwn, listAll };
