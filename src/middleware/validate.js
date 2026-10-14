const ApiError = require('../utils/ApiError');

const SOURCES = ['params', 'query', 'body'];

// Express 5 exposes req.query as a read-only getter, so parsed values live on req.validated
function validate(schemas) {
  return (req, _res, next) => {
    const validated = {};
    const problems = [];

    for (const source of SOURCES) {
      if (!schemas[source]) continue;

      const result = schemas[source].safeParse(req[source] ?? {});
      if (result.success) {
        validated[source] = result.data;
      } else {
        problems.push(
          ...result.error.issues.map((issue) => ({
            field: [source, ...issue.path].join('.'),
            message: issue.message,
          }))
        );
      }
    }

    if (problems.length > 0) throw ApiError.validation(problems);

    req.validated = validated;
    next();
  };
}

module.exports = validate;
