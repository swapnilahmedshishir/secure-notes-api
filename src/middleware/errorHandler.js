const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

function toApiError(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.validation(details);
  }

  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${err.path}`);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'value';
    return ApiError.conflict(`A user with this ${field} already exists`);
  }

  // body-parser errors (malformed JSON, payload too large)
  if (err.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body');
  if (err.type === 'entity.too.large') return new ApiError(413, 'Request body too large');

  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const apiError = toApiError(err);

  if (!apiError) {
    console.error(err);
    return res.status(500).json({
      message: 'Internal server error',
      ...(env.isProduction ? {} : { stack: err.stack }),
    });
  }

  res.status(apiError.statusCode).json({
    message: apiError.message,
    ...(apiError.details ? { errors: apiError.details } : {}),
  });
}

module.exports = { notFound, errorHandler };
