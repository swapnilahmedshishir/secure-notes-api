const { ROLES } = require('../models/User');
const ApiError = require('../utils/ApiError');

// higher roles inherit everything a lower role can do
const ROLE_RANK = { [ROLES.USER]: 1, [ROLES.ADMIN]: 2 };

const requireRole = (minimumRole) => (req, _res, next) => {
  if ((ROLE_RANK[req.user.role] ?? 0) < ROLE_RANK[minimumRole]) {
    throw ApiError.forbidden();
  }
  next();
};

module.exports = { requireRole };
