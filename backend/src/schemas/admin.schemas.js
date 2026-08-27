const Joi = require('joi');

const mobileRegex = /^[0-9]{10}$/;

const createDeptHeadSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).trim().required(),
    email: Joi.string().email().max(150).required(),
    department_id: Joi.number().integer().positive().required(),
    phone: Joi.string().pattern(mobileRegex).allow('', null).optional(),
    password: Joi.string().min(6).max(128).allow('', null).optional(),
    employee_id: Joi.string().max(50).allow('', null).optional(),
    designation: Joi.string().max(100).default('Department Head')
  })
};

const assignStaffSchema = {
  body: Joi.object({
    complaint_id: Joi.number().integer().positive().required(),
    staff_id: Joi.number().integer().positive().required()
  })
};

module.exports = {
  createDeptHeadSchema,
  assignStaffSchema
};
