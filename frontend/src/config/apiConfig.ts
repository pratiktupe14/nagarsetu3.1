/**
 * Centralized API URL Resolver for NAGARSETU 3.1
 * Resolves API URL dynamically in both Development (localhost) and Vercel Production.
 */
export const getApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/$/, '');
  }
  return 'https://backend-zeta-two-60.vercel.app';
};

export const getAiServiceUrl = (): string => {
  const envAiUrl = import.meta.env.VITE_AI_SERVICE_URL;
  if (envAiUrl && envAiUrl.trim() !== '') {
    return envAiUrl.trim().replace(/\/$/, '');
  }
  const mainApi = getApiUrl();
  return mainApi ? `${mainApi}/api/ai` : 'https://backend-zeta-two-60.vercel.app/api/ai';
};
