const Joi = require('joi');

/**
 * Higher-order middleware function to validate incoming request data against a Joi schema.
 * @param {Object} schemas - Object containing optional body, query, and/or params Joi schemas
 */
const validateInput = (schemas = {}) => {
  return (req, res, next) => {
    const targets = ['body', 'query', 'params'];

    for (const target of targets) {
      if (schemas[target]) {
        const { error, value } = schemas[target].validate(req[target] || {}, {
          abortEarly: false,
          stripUnknown: false, // Reject extra unallowed properties
          allowUnknown: false
        });

        if (error) {
          const details = error.details.map((d) => d.message.replace(/"/g, "'"));
          return res.status(400).json({
            error: 'Validation Error: Invalid input parameters',
            details
          });
        }
        // Replace request target with sanitized & validated value
        req[target] = value;
      }
    }

    next();
  };
};

module.exports = validateInput;
