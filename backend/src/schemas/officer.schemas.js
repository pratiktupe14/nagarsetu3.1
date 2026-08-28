const Joi = require('joi');

const officerDashboardSchema = {
  query: Joi.object({
    department_id: Joi.number().integer().positive().optional(),
    priority: Joi.string().valid('Low', 'Medium', 'High', 'Critical').optional(),
    status: Joi.string().valid('Submitted', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Reopened', 'Overdue', 'Rejected').optional(),
    search: Joi.string().max(100).trim().allow('').optional()
  })
};

const verifyComplaintSchema = {
  body: Joi.object({
    complaint_id: Joi.number().integer().positive().required(),
    action: Joi.string().valid('approve', 'reject').required(),
    rejection_reason: Joi.string().max(500).allow('', null).optional()
  })
};

const assignStaffSchema = {
  body: Joi.object({
    complaint_id: Joi.number().integer().positive().required(),
    staff_id: Joi.number().integer().positive().required(),
    remark: Joi.string().max(500).allow('', null).optional()
  })
};

module.exports = {
  officerDashboardSchema,
  verifyComplaintSchema,
  assignStaffSchema
};
