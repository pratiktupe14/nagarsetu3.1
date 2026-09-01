const Joi = require('joi');

const mobileRegex = /^[0-9]{10}$/;

const idSchema = Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().trim().min(1).max(100));

const createUserSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).trim().required(),
    mobile: Joi.string().pattern(mobileRegex).required().messages({
      'string.pattern.base': 'Mobile number must be a valid 10-digit number'
    }),
    email: Joi.string().email().max(150).allow('', null).optional(),
    password: Joi.string().min(6).max(128).required(),
    role: Joi.string().valid('citizen', 'officer', 'staff', 'service_staff', 'admin', 'city_admin', 'department_head').default('citizen'),
    language_pref: Joi.string().valid('en', 'hi', 'mr').default('en')
  })
};

const updateUserSchema = {
  params: Joi.object({
    id: idSchema.required()
  }),
  body: Joi.object({
    name: Joi.string().min(2).max(100).trim().optional(),
    mobile: Joi.string().pattern(mobileRegex).optional(),
    email: Joi.string().email().max(150).allow('', null).optional(),
    role: Joi.string().valid('citizen', 'officer', 'staff', 'service_staff', 'admin', 'city_admin', 'department_head').optional(),
    language_pref: Joi.string().valid('en', 'hi', 'mr').optional()
  })
};

const createDeptHeadSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).trim().required(),
    email: Joi.string().email().max(150).required(),
    department_id: idSchema.required(),
    phone: Joi.string().pattern(mobileRegex).allow('', null).optional(),
    password: Joi.string().min(6).max(128).allow('', null).optional(),
    employee_id: Joi.string().max(50).allow('', null).optional(),
    designation: Joi.string().max(100).default('Department Head')
  })
};

const assignStaffSchema = {
  body: Joi.object({
    complaint_id: idSchema.required(),
    staff_id: idSchema.required(),
    remark: Joi.string().max(500).allow('', null).optional()
  })
};

const reassignComplaintSchema = {
  params: Joi.object({
    id: idSchema.required()
  }),
  body: Joi.object({
    department_id: idSchema.required(),
    reason: Joi.string().max(500).allow('', null).optional()
  })
};

const createDepartmentSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(150).trim().required(),
    description: Joi.string().max(500).allow('', null).optional()
  })
};

module.exports = {
  createUserSchema,
  updateUserSchema,
  createDeptHeadSchema,
  createDepartmentSchema,
  assignStaffSchema,
  reassignComplaintSchema
};
