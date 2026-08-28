const Joi = require('joi');

const updateTaskStatusSchema = {
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }),
  body: Joi.object({
    status: Joi.string().valid('In Progress', 'Assigned', 'Resolved').required()
  })
};

const resolveTaskParamsSchema = {
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  })
};

module.exports = {
  updateTaskStatusSchema,
  resolveTaskParamsSchema
};
