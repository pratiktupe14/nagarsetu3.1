const express = require('express');
const router = express.Router();
const http = require('http');
const validateInput = require('../middleware/validateInput');
const {
  geocodeSchema,
  reverseGeocodeSchema,
  directionsSchema,
  validateLocationSchema
} = require('../schemas/maps.schemas');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

function postToPythonService(endpoint, body) {
  return new Promise((resolve) => {
    try {
      const url = new URL(`${AI_SERVICE_URL}${endpoint}`);
      const data = JSON.stringify(body);

      const req = http.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          timeout: 5000
        },
        (res) => {
          let responseData = '';
          res.on('data', (chunk) => (responseData += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(responseData));
            } catch (e) {
              console.error('[MAPS SERVICE ERROR] Invalid JSON from python maps service:', e.message);
              resolve({ status: 'ERROR', message: 'Unable to process map request at this time.' });
            }
          });
        }
      );

      req.on('error', (err) => {
        console.error('[MAPS SERVICE ERROR] Network connection error:', err.message);
        resolve({ status: 'SERVICE_UNAVAILABLE', message: 'Maps service is currently unavailable.' });
      });

      req.on('timeout', () => {
        req.destroy();
        console.error('[MAPS SERVICE TIMEOUT] Request timed out after 5s');
        resolve({ status: 'TIMEOUT', message: 'Google Maps service request timed out.' });
      });

      req.write(data);
      req.end();
    } catch (err) {
      console.error('[MAPS SERVICE EXCEPTION]:', err.message);
      resolve({ status: 'ERROR', message: 'Unable to process map request.' });
    }
  });
}

// POST /api/maps/geocode
router.post('/geocode', validateInput(geocodeSchema), async (req, res) => {
  const { address } = req.body;
  const result = await postToPythonService('/google-maps/geocode', { address });
  return res.json(result);
});

// POST /api/maps/reverse-geocode
router.post('/reverse-geocode', validateInput(reverseGeocodeSchema), async (req, res) => {
  const { latitude, longitude } = req.body;
  const result = await postToPythonService('/google-maps/reverse-geocode', {
    latitude: Number(latitude),
    longitude: Number(longitude)
  });
  return res.json(result);
});

// POST /api/maps/directions
router.post('/directions', validateInput(directionsSchema), async (req, res) => {
  const { origin_latitude, origin_longitude, destination_latitude, destination_longitude, mode } = req.body;
  const result = await postToPythonService('/google-maps/directions', {
    origin_latitude: Number(origin_latitude),
    origin_longitude: Number(origin_longitude),
    destination_latitude: Number(destination_latitude),
    destination_longitude: Number(destination_longitude),
    mode: mode || 'driving'
  });
  return res.json(result);
});

// POST /api/maps/validate
router.post('/validate', validateInput(validateLocationSchema), async (req, res) => {
  const { latitude, longitude } = req.body;
  const result = await postToPythonService('/google-maps/validate', {
    latitude: Number(latitude),
    longitude: Number(longitude)
  });
  return res.json(result);
});

module.exports = router;
