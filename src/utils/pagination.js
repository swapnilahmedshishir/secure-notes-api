function toSkip({ page, limit }) {
  return (page - 1) * limit;
}

function buildPagination({ page, limit, total }) {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

// an empty filter can use collection metadata instead of scanning
function countMatching(Model, filter) {
  return Object.keys(filter).length === 0
    ? Model.estimatedDocumentCount()
    : Model.countDocuments(filter);
}

module.exports = { toSkip, buildPagination, countMatching };
