const Joi = require('joi');

const createComplaintSchema = {
  body: Joi.object({
    complaint_number: Joi.string().max(100).allow('', null).optional(),
    photo_url: Joi.string().required(),
    category: Joi.string().min(2).max(100).required(),
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().max(2000).allow('', null).optional(),
    priority: Joi.string().valid('Low', 'Medium', 'High', 'Critical').default('Medium'),
    department_id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string()).allow(null).optional(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    location_source: Joi.string().allow('', null).optional(),
    location_address: Joi.string().max(500).allow('', null).optional(),
    duplicate_of_id: Joi.number().integer().positive().allow(null).optional(),
    ai_category: Joi.string().max(150).allow('', null).optional(),
    ai_specific_issue: Joi.string().max(150).allow('', null).optional(),
    ai_confidence: Joi.number().min(0).max(1).allow(null).optional(),
    ai_severity: Joi.string().max(50).allow('', null).optional(),
    ai_urgency: Joi.string().max(50).allow('', null).optional(),
    ai_evidence: Joi.string().max(2000).allow('', null).optional(),
    ai_model: Joi.string().max(100).allow('', null).optional(),
    ai_analyzed_at: Joi.string().allow('', null).optional(),
    needs_manual_verification: Joi.boolean().allow(null).optional()
  })
};

const updateStatusSchema = {
  body: Joi.object({
    status: Joi.string().valid(
      'Submitted',
      'NEEDS_VERIFICATION',
      'Verified',
      'Approved',
      'Department Assigned',
      'Staff Assigned',
      'Accepted',
      'On the Way',
      'In Progress',
      'Resolution Submitted',
      'Resolved',
      'Reopened',
      'Rejected',
      'Overdue'
    ).required(),
    remark: Joi.string().max(1000).allow('', null).optional(),
    department: Joi.string().max(150).allow('', null).optional()
  }),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  })
};

const addFeedbackSchema = {
  body: Joi.object({
    complaint_id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string()).allow(null).optional(),
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().max(1000).allow('', null).optional()
  })
};

module.exports = {
  createComplaintSchema,
  updateStatusSchema,
  addFeedbackSchema
};
