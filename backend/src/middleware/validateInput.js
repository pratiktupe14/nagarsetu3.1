/**
 * NAGARSETU Input Validation Middleware
 * Enforces strict schema validation (Joi schemas or custom rule objects)
 * Rejects invalid payloads with HTTP 400 Bad Request.
 */

function validateInput(schemas = {}) {
  return (req, res, next) => {
    const errors = [];
    const targets = ['body', 'query', 'params'];

    for (const target of targets) {
      const locationSchema = schemas[target];
      if (!locationSchema) continue;

      // Case A: Joi Schema validation
      if (typeof locationSchema.validate === 'function') {
        const { error, value } = locationSchema.validate(req[target] || {}, {
          abortEarly: false,
          allowUnknown: false
        });

        if (error) {
          const details = error.details.map((d) => d.message.replace(/"/g, "'"));
          return res.status(400).json({
            error: 'Validation Error: Invalid input parameters',
            details
          });
        }
        req[target] = value;
        continue;
      }

      // Case B: Custom Object Schema validation
      const data = req[target] || {};
      for (const [field, rules] of Object.entries(locationSchema)) {
        const value = data[field];

        if (rules.required && (value === undefined || value === null || value === '')) {
          errors.push(`[${target}] Field '${field}' is required.`);
          continue;
        }

        if (value === undefined || value === null || value === '') {
          continue;
        }

        if (rules.type) {
          if (rules.type === 'string' && typeof value !== 'string') {
            errors.push(`[${target}] Field '${field}' must be a string.`);
            continue;
          }
          if (rules.type === 'number' && typeof value !== 'number' && isNaN(Number(value))) {
            errors.push(`[${target}] Field '${field}' must be a valid number.`);
            continue;
          }
          if (rules.type === 'integer' && !Number.isInteger(Number(value))) {
            errors.push(`[${target}] Field '${field}' must be an integer.`);
            continue;
          }
        }

        if (typeof value === 'string') {
          if (rules.minLength !== undefined && value.trim().length < rules.minLength) {
            errors.push(`[${target}] Field '${field}' must be at least ${rules.minLength} characters.`);
          }
          if (rules.maxLength !== undefined && value.trim().length > rules.maxLength) {
            errors.push(`[${target}] Field '${field}' cannot exceed ${rules.maxLength} characters.`);
          }
          if (rules.pattern && !rules.pattern.test(value.trim())) {
            errors.push(`[${target}] Field '${field}' ${rules.message || 'format is invalid.'}`);
          }
        }

        if (rules.allowedValues && Array.isArray(rules.allowedValues)) {
          if (!rules.allowedValues.includes(value)) {
            errors.push(`[${target}] Field '${field}' must be one of: [${rules.allowedValues.join(', ')}].`);
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation Failed',
        message: 'One or more request parameters failed strict schema validation.',
        details: errors
      });
    }

    next();
  };
}

const CommonValidators = {
  mobilePattern: /^[6-9]\d{9}$/,
  emailPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  latitude: { type: 'number', min: -90, max: 90 },
  longitude: { type: 'number', min: -180, max: 180 }
};

module.exports = validateInput;
module.exports.validateInput = validateInput;
module.exports.CommonValidators = CommonValidators;
