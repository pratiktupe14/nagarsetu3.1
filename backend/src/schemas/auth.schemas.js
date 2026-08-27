const Joi = require('joi');

const mobileRegex = /^[0-9]{10}$/;

const registerSchema = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).trim().required(),
    mobile: Joi.string().pattern(mobileRegex).required().messages({
      'string.pattern.base': 'Mobile number must be a valid 10-digit number'
    }),
    email: Joi.string().email().max(150).allow('', null).optional(),
    password: Joi.string().min(6).max(128).required(),
    role: Joi.string().valid('citizen', 'officer', 'staff', 'admin', 'department_head').default('citizen'),
    language_pref: Joi.string().valid('en', 'hi', 'mr').default('en')
  })
};

const loginSchema = {
  body: Joi.object({
    mobileOrEmail: Joi.string().min(3).max(150).required(),
    password: Joi.string().required()
  })
};

const otpRequestSchema = {
  body: Joi.object({
    mobile: Joi.string().pattern(mobileRegex).required().messages({
      'string.pattern.base': 'Mobile number must be a valid 10-digit number'
    })
  })
};

const otpVerifySchema = {
  body: Joi.object({
    mobile: Joi.string().pattern(mobileRegex).required(),
    otp: Joi.string().length(6).required()
  })
};

module.exports = {
  registerSchema,
  loginSchema,
  otpRequestSchema,
  otpVerifySchema
};
