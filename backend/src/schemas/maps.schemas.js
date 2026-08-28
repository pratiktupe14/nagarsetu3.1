const Joi = require('joi');

const geocodeSchema = {
  body: Joi.object({
    address: Joi.string().min(2).max(300).trim().required()
  })
};

const reverseGeocodeSchema = {
  body: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
  })
};

const directionsSchema = {
  body: Joi.object({
    origin_latitude: Joi.number().min(-90).max(90).required(),
    origin_longitude: Joi.number().min(-180).max(180).required(),
    destination_latitude: Joi.number().min(-90).max(90).required(),
    destination_longitude: Joi.number().min(-180).max(180).required(),
    mode: Joi.string().valid('driving', 'walking', 'bicycling', 'transit').default('driving')
  })
};

const validateLocationSchema = {
  body: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
  })
};

module.exports = {
  geocodeSchema,
  reverseGeocodeSchema,
  directionsSchema,
  validateLocationSchema
};
