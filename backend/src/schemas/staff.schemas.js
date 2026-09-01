const Joi = require('joi');

const idSchema = Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().trim().min(1).max(100));

const updateTaskStatusSchema = {
  params: Joi.object({
    id: idSchema.required()
  }),
  body: Joi.object({
    status: Joi.string().valid(
      'Submitted', 'Verified', 'Approved', 'Department Assigned',
      'Staff Assigned', 'Accepted', 'On the Way', 'In Progress',
      'Resolution Submitted', 'Resolved', 'Reopened', 'Rejected', 'Overdue'
    ).required()
  })
};

const resolveTaskParamsSchema = {
  params: Joi.object({
    id: idSchema.required()
  })
};

module.exports = {
  updateTaskStatusSchema,
  resolveTaskParamsSchema
};
