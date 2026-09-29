/**
 * Centralized API URL Resolver for NAGARSETU 3.1
 * Resolves API URL dynamically in both Development (localhost via Vite proxy) and Vercel Production (same-origin).
 */
export const getApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/$/, '');
  }
  // When unified in NagarSetuSegue, use same-origin relative URLs:
  return '';
};

export const getAiServiceUrl = (): string => {
  const envAiUrl = import.meta.env.VITE_AI_SERVICE_URL;
  if (envAiUrl && envAiUrl.trim() !== '') {
    return envAiUrl.trim().replace(/\/$/, '');
  }
  const mainApi = getApiUrl();
  return mainApi ? `${mainApi}/api/ai` : '/api/ai';
};

export const getNoCacheHeaders = (additionalHeaders: Record<string, string> = {}): Record<string, string> => {
  const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token') || '';
  return {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...additionalHeaders
  };
};
