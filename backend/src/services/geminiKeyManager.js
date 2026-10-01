/**
 * NAGARSETU Centralized Gemini API Key Manager & Automatic Failover Service
 * Manages deterministic rotation, health tracking, cooldown, and recovery across Gemini API keys.
 */

const COOLDOWN_QUOTA_MS = 5 * 60 * 1000; // 5 minutes for 429 / RESOURCE_EXHAUSTED
const COOLDOWN_TEMP_MS = 60 * 1000;      // 60 seconds for 5xx / timeout / network failure

// Process-level in-memory state
let currentIndex = 0;
const keyHealth = new Map(); // slotIndex -> { unavailableUntil: number, reason: string }
let overrideKeys = null; // Used for isolated unit testing

function getAvailableKeys() {
  if (overrideKeys && Array.isArray(overrideKeys)) {
    return overrideKeys;
  }

  const keys = [];
  for (let i = 1; i <= 5; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k && k.trim()) {
      keys.push(k.trim());
    }
  }

  // Fallback to legacy single or comma-separated GEMINI_API_KEY if slot keys not set
  if (keys.length === 0 && process.env.GEMINI_API_KEY) {
    const raw = process.env.GEMINI_API_KEY.trim();
    if (raw.includes(',')) {
      raw.split(',').map(s => s.trim()).filter(Boolean).forEach(k => keys.push(k));
    } else if (raw) {
      keys.push(raw);
    }
  }

  return keys;
}

function isQuotaError(err) {
  if (!err) return false;
  const status = err.statusCode || err.status || (err.response && err.response.status);
  const msg = String(err.message || err.error || '').toLowerCase();
  const code = String(err.errorCode || err.code || '').toLowerCase();

  return (
    status === 429 ||
    code === 'ai_quota_exceeded' ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests')
  );
}

function isRetryableError(err) {
  if (!err) return false;
  const status = err.statusCode || err.status || (err.response && err.response.status);
  const msg = String(err.message || err.error || '').toLowerCase();
  const code = String(err.errorCode || err.code || '').toLowerCase();

  // Quota / Rate limit
  if (isQuotaError(err)) return true;

  // Temporary 5xx or server errors
  if (status >= 500 && status <= 504) return true;

  // Network transport / timeouts
  if (
    code === 'ai_network_error' ||
    code === 'ai_timeout' ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('network transport error') ||
    msg.includes('temporarily unavailable')
  ) {
    return true;
  }

  return false;
}

/**
 * Execute an arbitrary Gemini operation with automatic failover across all configured keys.
 *
 * @param {Function} apiCallFn - async (apiKey, slotIndex) => Promise<any>
 * @returns {Promise<any>}
 */
async function executeWithFailover(apiCallFn) {
  const keys = getAvailableKeys();

  if (keys.length === 0) {
    const unconfiguredErr = new Error('Gemini analysis failed: GEMINI_API_KEY is not configured in server environment.');
    unconfiguredErr.statusCode = 503;
    unconfiguredErr.errorCode = 'AI_SERVICE_UNCONFIGURED';
    throw unconfiguredErr;
  }

  const maxAttempts = Math.min(keys.length, 5);
  const now = Date.now();
  let attemptsMade = 0;
  let lastRetryableError = null;

  for (let i = 0; i < maxAttempts; i++) {
    // Find next eligible slot starting from currentIndex
    let selectedSlot = -1;
    for (let offset = 0; offset < keys.length; offset++) {
      const candidateSlot = (currentIndex + offset) % keys.length;
      const health = keyHealth.get(candidateSlot);

      if (!health || health.unavailableUntil <= Date.now()) {
        selectedSlot = candidateSlot;
        currentIndex = candidateSlot;
        break;
      }
    }

    if (selectedSlot === -1) {
      // All keys are currently in cooldown
      console.warn('[GEMINI FAILOVER] All Gemini keys are currently in cooldown.');
      const allExhaustedErr = new Error('Gemini service is temporarily unavailable. Please try again later.');
      allExhaustedErr.error = 'ALL_GEMINI_KEYS_UNAVAILABLE';
      allExhaustedErr.message = 'Gemini service is temporarily unavailable. Please try again later.';
      allExhaustedErr.statusCode = 503;
      throw allExhaustedErr;
    }

    const currentKey = keys[selectedSlot];
    const slotHumanNumber = selectedSlot + 1;
    attemptsMade++;

    try {
      const result = await apiCallFn(currentKey, selectedSlot);
      console.log(`[GEMINI FAILOVER] Gemini request succeeded using key slot ${slotHumanNumber}`);
      // Key succeeded, clear any past transient health status
      keyHealth.delete(selectedSlot);
      return result;
    } catch (err) {
      // Non-retryable errors (e.g. 400 Bad Request, malformed prompt, invalid image payload) must NOT rotate keys
      if (!isRetryableError(err)) {
        throw err;
      }

      lastRetryableError = err;
      const nextSlotHumanNumber = ((selectedSlot + 1) % keys.length) + 1;

      if (isQuotaError(err)) {
        keyHealth.set(selectedSlot, {
          unavailableUntil: Date.now() + COOLDOWN_QUOTA_MS,
          reason: 'QUOTA_EXHAUSTED'
        });
        console.warn(`[GEMINI FAILOVER] Gemini key ${slotHumanNumber} exhausted; switching to key ${nextSlotHumanNumber}`);
      } else {
        keyHealth.set(selectedSlot, {
          unavailableUntil: Date.now() + COOLDOWN_TEMP_MS,
          reason: 'TEMPORARY_ERROR'
        });
        console.warn(`[GEMINI FAILOVER] Gemini key ${slotHumanNumber} temporarily unavailable; switching to key ${nextSlotHumanNumber}`);
      }

      // Advance currentIndex to the next slot
      currentIndex = (selectedSlot + 1) % keys.length;
    }
  }

  // If loop completes without success, all available keys failed
  console.error(`[GEMINI FAILOVER] All ${attemptsMade} Gemini keys attempted and failed.`);
  const fatalErr = new Error('Gemini service is temporarily unavailable. Please try again later.');
  fatalErr.error = 'ALL_GEMINI_KEYS_UNAVAILABLE';
  fatalErr.message = 'Gemini service is temporarily unavailable. Please try again later.';
  fatalErr.statusCode = 503;
  throw fatalErr;
}

// Internal testing utilities
function _resetState() {
  currentIndex = 0;
  keyHealth.clear();
  overrideKeys = null;
}

function _setKeysForTesting(keys) {
  overrideKeys = keys;
  currentIndex = 0;
  keyHealth.clear();
}

function _getKeyHealth(slotIndex) {
  return keyHealth.get(slotIndex);
}

module.exports = {
  executeWithFailover,
  isRetryableError,
  isQuotaError,
  COOLDOWN_QUOTA_MS,
  COOLDOWN_TEMP_MS,
  _resetState,
  _setKeysForTesting,
  _getKeyHealth
};
