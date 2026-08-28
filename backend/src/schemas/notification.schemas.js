const Joi = require('joi');

const markReadSchema = {
  body: Joi.object({
    notification_id: Joi.number().integer().positive().allow(null).optional()
  })
};

module.exports = {
  markReadSchema
};
