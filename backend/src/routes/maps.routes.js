const express = require('express');
const router = express.Router();
const http = require('http');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

function postToPythonService(endpoint, body) {
  return new Promise((resolve, reject) => {
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
              resolve({ status: 'ERROR', message: 'Invalid response from Google Maps service' });
            }
          });
        }
      );

      req.on('error', (err) => {
        resolve({ status: 'SERVICE_UNAVAILABLE', message: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 'TIMEOUT', message: 'Google Maps service request timed out' });
      });

      req.write(data);
      req.end();
    } catch (err) {
      resolve({ status: 'ERROR', message: err.message });
    }
  });
}

// POST /api/maps/geocode
router.post('/geocode', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ status: 'INVALID_INPUT', error: 'Address is required' });
  }

  const result = await postToPythonService('/google-maps/geocode', { address });
  return res.json(result);
});

// POST /api/maps/reverse-geocode
router.post('/reverse-geocode', async (req, res) => {
  const { latitude, longitude } = req.body;
  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ status: 'INVALID_INPUT', error: 'Latitude and longitude are required' });
  }

  const result = await postToPythonService('/google-maps/reverse-geocode', {
    latitude: Number(latitude),
    longitude: Number(longitude)
  });
  return res.json(result);
});

// POST /api/maps/directions
router.post('/directions', async (req, res) => {
  const { origin_latitude, origin_longitude, destination_latitude, destination_longitude, mode } = req.body;
  if (origin_latitude === undefined || origin_longitude === undefined || destination_latitude === undefined || destination_longitude === undefined) {
    return res.status(400).json({ status: 'INVALID_INPUT', error: 'Origin and destination coordinates are required' });
  }

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
router.post('/validate', async (req, res) => {
  const { latitude, longitude } = req.body;
  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ status: 'INVALID_INPUT', error: 'Latitude and longitude are required' });
  }

  const result = await postToPythonService('/google-maps/validate', {
    latitude: Number(latitude),
    longitude: Number(longitude)
  });
  return res.json(result);
});

module.exports = router;
