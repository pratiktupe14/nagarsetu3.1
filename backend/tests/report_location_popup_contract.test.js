const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('Citizen Portal Report Complaint - Location Prompt Contract', () => {
  const reportPagePath = path.join(__dirname, '../../frontend/src/pages/citizen/ReportIssuePage.tsx');
  const locationServicePath = path.join(__dirname, '../../frontend/src/services/locationService.ts');

  test('1. ReportIssuePage exists and imports existing location service functions', () => {
    assert.ok(fs.existsSync(reportPagePath), 'ReportIssuePage.tsx must exist');
    const content = fs.readFileSync(reportPagePath, 'utf8');

    assert.ok(content.includes('requestFreshGpsLocation'), 'Must use existing requestFreshGpsLocation');
    assert.ok(content.includes('reverseGeocodeCoordinates'), 'Must use existing reverseGeocodeCoordinates');
    assert.ok(content.includes('resolveIssueLocation'), 'Must use existing resolveIssueLocation');
  });

  test('2. Checks whether browser/device location is enabled upon starting report flow', () => {
    const content = fs.readFileSync(reportPagePath, 'utf8');

    // On mount effect calls location request
    assert.ok(
      content.includes('requestFreshLocation(false)') || content.includes('requestFreshLocation()'),
      'Must check location on component mount'
    );

    // Checks permission or access status
    assert.ok(
      content.includes("permissions.query({ name: 'geolocation'"),
      'Must check permissions API if supported'
    );
    assert.ok(
      content.includes('showLocationPromptModal'),
      'Must maintain state for location prompt modal'
    );
  });

  test('3. Popup contains exact required title, message, and buttons', () => {
    const content = fs.readFileSync(reportPagePath, 'utf8');

    // Required Title
    assert.ok(
      content.includes('Turn On Your Location'),
      'Modal must contain exact title "Turn On Your Location"'
    );

    // Required Message
    assert.ok(
      content.includes('Please turn on your device location to report a complaint. Location is required to accurately identify the complaint location.'),
      'Modal must contain exact description text'
    );

    // Required Buttons
    assert.ok(
      content.includes('Turn On Location'),
      'Modal must have "Turn On Location" button'
    );
    assert.ok(
      content.includes('Cancel'),
      'Modal must have "Cancel" button'
    );
  });

  test('4. "Turn On Location" triggers existing browser geolocation flow and continues workflow', () => {
    const content = fs.readFileSync(reportPagePath, 'utf8');

    // Button triggers requestFreshLocation with user action flag
    assert.ok(
      content.includes('onClick={() => requestFreshLocation(true)}'),
      'Clicking Turn On Location must trigger requestFreshLocation(true)'
    );

    // If location succeeds, state is updated with real GPS and modal is closed
    assert.ok(
      content.includes("setLocationSource('live_gps')"),
      'Must set location source to live_gps upon successful location access'
    );
    assert.ok(
      content.includes('setShowLocationPromptModal(false)'),
      'Must close popup modal once location is successfully acquired'
    );
  });

  test('5. "Cancel" button closes the popup', () => {
    const content = fs.readFileSync(reportPagePath, 'utf8');

    assert.ok(
      content.includes('onClick={() => setShowLocationPromptModal(false)}'),
      'Clicking Cancel must close location prompt modal'
    );
  });

  test('6. Location service preserves standard GPS request without mock/hardcoded coordinates', () => {
    const locContent = fs.readFileSync(locationServicePath, 'utf8');

    assert.ok(
      locContent.includes('navigator.geolocation.getCurrentPosition'),
      'Must use browser geolocation API'
    );
    assert.ok(
      locContent.includes("maximumAge: 0"),
      'Must ensure fresh location request'
    );
  });
});
