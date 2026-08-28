const express = require('express');
const router = express.Router();
const http = require('http');
const { validateInput } = require('../middleware/validateInput');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const geocodeSchema = {
  body: {
    address: { type: 'string', required: true, minLength: 2, maxLength: 500 }
  }
};

const reverseGeocodeSchema = {
  body: {
    latitude: { type: 'number', required: true, min: -90, max: 90 },
    longitude: { type: 'number', required: true, min: -180, max: 180 }
  }
};

const directionsSchema = {
  body: {
    origin_latitude: { type: 'number', required: true, min: -90, max: 90 },
    origin_longitude: { type: 'number', required: true, min: -180, max: 180 },
    destination_latitude: { type: 'number', required: true, min: -90, max: 90 },
    destination_longitude: { type: 'number', required: true, min: -180, max: 180 },
    mode: { type: 'string', required: false, allowedValues: ['driving', 'walking', 'bicycling', 'transit'] }
  }
};

const validateLocationSchema = {
  body: {
    latitude: { type: 'number', required: true, min: -90, max: 90 },
    longitude: { type: 'number', required: true, min: -180, max: 180 }
  }
};

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
              resolve({ status: 'ERROR', message: 'Invalid response from location service.' });
            }
          });
        }
      );

      req.on('error', (err) => {
        console.error('Maps service error:', err.message);
        resolve({ status: 'SERVICE_UNAVAILABLE', message: 'Location service is currently unavailable.' });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 'TIMEOUT', message: 'Location service request timed out.' });
      });

      req.write(data);
      req.end();
    } catch (err) {
      console.error('Maps service exception:', err.message);
      resolve({ status: 'ERROR', message: 'Location processing failed.' });
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
