/**
 * NAGARSETU Input Validation Middleware
 * Enforces strict schema validation (type, length, format, value bounds, enums)
 * Rejects invalid payloads with HTTP 400 Bad Request instead of silent sanitization/escaping.
 */

/**
 * Validates request data (body, query, params) against a specified schema.
 * @param {Object} schema - Object containing schema rules for body, query, or params
 * Example schema:
 * {
 *   body: {
 *     mobile: { type: 'string', required: true, pattern: /^[6-9]\d{9}$/, message: 'Must be a valid 10-digit mobile number' },
 *     password: { type: 'string', required: true, minLength: 6, maxLength: 100 }
 *   }
 * }
 */
function validateInput(schema) {
  return (req, res, next) => {
    const errors = [];

    const validateLocation = (locationName, reqLocationData, locationSchema) => {
      if (!locationSchema) return;
      const data = reqLocationData || {};

      for (const [field, rules] of Object.entries(locationSchema)) {
        const value = data[field];

        // 1. Required Check
        if (rules.required && (value === undefined || value === null || value === '')) {
          errors.push(`[${locationName}] Field '${field}' is required.`);
          continue;
        }

        // Skip non-required empty fields
        if (value === undefined || value === null || value === '') {
          continue;
        }

        // 2. Type Check
        if (rules.type) {
          if (rules.type === 'string' && typeof value !== 'string') {
            errors.push(`[${locationName}] Field '${field}' must be a string.`);
            continue;
          }
          if (rules.type === 'number' && typeof value !== 'number' && isNaN(Number(value))) {
            errors.push(`[${locationName}] Field '${field}' must be a valid number.`);
            continue;
          }
          if (rules.type === 'integer') {
            const num = Number(value);
            if (!Number.isInteger(num)) {
              errors.push(`[${locationName}] Field '${field}' must be an integer.`);
              continue;
            }
          }
          if (rules.type === 'boolean' && typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
            errors.push(`[${locationName}] Field '${field}' must be a boolean.`);
            continue;
          }
          if (rules.type === 'array' && !Array.isArray(value)) {
            errors.push(`[${locationName}] Field '${field}' must be an array.`);
            continue;
          }
        }

        // 3. String Length Bounds
        if (typeof value === 'string') {
          if (rules.minLength !== undefined && value.trim().length < rules.minLength) {
            errors.push(`[${locationName}] Field '${field}' must be at least ${rules.minLength} characters.`);
          }
          if (rules.maxLength !== undefined && value.trim().length > rules.maxLength) {
            errors.push(`[${locationName}] Field '${field}' cannot exceed ${rules.maxLength} characters.`);
          }
          if (rules.pattern && !rules.pattern.test(value.trim())) {
            errors.push(`[${locationName}] Field '${field}' ${rules.message || 'format is invalid.'}`);
          }
        }

        // 4. Numeric Bounds
        if (typeof value === 'number' || (rules.type === 'number' && !isNaN(Number(value)))) {
          const numVal = Number(value);
          if (rules.min !== undefined && numVal < rules.min) {
            errors.push(`[${locationName}] Field '${field}' must be greater than or equal to ${rules.min}.`);
          }
          if (rules.max !== undefined && numVal > rules.max) {
            errors.push(`[${locationName}] Field '${field}' must be less than or equal to ${rules.max}.`);
          }
        }

        // 5. Enum Allowed Values
        if (rules.allowedValues && Array.isArray(rules.allowedValues)) {
          if (!rules.allowedValues.includes(value)) {
            errors.push(`[${locationName}] Field '${field}' must be one of: [${rules.allowedValues.join(', ')}].`);
          }
        }

        // 6. Custom Validator Function
        if (rules.custom && typeof rules.custom === 'function') {
          const customResult = rules.custom(value);
          if (customResult !== true) {
            errors.push(`[${locationName}] Field '${field}' ${typeof customResult === 'string' ? customResult : 'failed custom validation.'}`);
          }
        }
      }
    };

    validateLocation('body', req.body, schema.body);
    validateLocation('query', req.query, schema.query);
    validateLocation('params', req.params, schema.params);

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

// Common Standard Schemas
const CommonValidators = {
  mobilePattern: /^[6-9]\d{9}$/,
  emailPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  latitude: { type: 'number', min: -90, max: 90 },
  longitude: { type: 'number', min: -180, max: 180 }
};

module.exports = {
  validateInput,
  CommonValidators
};
