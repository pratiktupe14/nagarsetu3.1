const Joi = require('joi');

const idSchema = Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().trim().min(1).max(100));

const officerDashboardSchema = {
  query: Joi.object({
    department_id: idSchema.optional(),
    priority: Joi.string().valid('Low', 'Medium', 'High', 'Critical').optional(),
    status: Joi.string().valid('Submitted', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Reopened', 'Overdue', 'Rejected').optional(),
    search: Joi.string().max(100).trim().allow('').optional()
  })
};

const verifyComplaintSchema = {
  body: Joi.object({
    complaint_id: idSchema.required(),
    action: Joi.string().valid('approve', 'reject').required(),
    rejection_reason: Joi.string().max(500).allow('', null).optional()
  })
};

const assignStaffSchema = {
  body: Joi.object({
    complaint_id: idSchema.required(),
    staff_id: idSchema.required(),
    remark: Joi.string().max(500).allow('', null).optional()
  })
};

module.exports = {
  officerDashboardSchema,
  verifyComplaintSchema,
  assignStaffSchema
};
