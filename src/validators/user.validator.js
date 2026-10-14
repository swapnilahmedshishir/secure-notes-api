const { z } = require('zod');
const { ROLES } = require('../models/User');
const { paginationQuery, idParams } = require('./common');
const { fields } = require('./auth.validator');

const role = z.enum(Object.values(ROLES));

const create = {
  body: z.strictObject({
    username: fields.username,
    email: fields.email,
    password: fields.password,
    role: role.default(ROLES.USER),
    interests: fields.interests.default([]),
  }),
};

const update = {
  params: idParams,
  body: z
    .strictObject({
      username: fields.username.optional(),
      email: fields.email.optional(),
      password: fields.password.optional(),
      role: role.optional(),
      interests: fields.interests.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update'),
};

const byId = { params: idParams };

const list = { query: z.strictObject(paginationQuery) };

const groupedByInterests = {
  query: z.strictObject({
    ...paginationQuery,
    interest: z.string().trim().toLowerCase().min(1).max(30).optional(),
  }),
};

module.exports = { create, update, byId, list, groupedByInterests };
