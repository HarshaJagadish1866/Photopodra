/**
 * Photopodra Server Connection Manager
 * Manages the backend API base URL, persisting user-configured endpoints in localStorage.
 * Defaults to VITE_API_URL environment variable, falling back to window.location.origin.
 */

const STORAGE_KEY = 'photopodra_server_url';

/**
 * Cleans and normalizes a server URL by removing trailing slashes and extra whitespace.
 * @param {string} url
 * @returns {string}
 */
export function cleanUrl(url) {
  if (!url) return '';
  return url.trim().replace(/\/+$/, '');
}

/**
 * Returns the default server URL based on VITE_API_URL or window.location.origin.
 * @returns {string}
 */
export function getDefaultServerUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    return cleanUrl(import.meta.env.VITE_API_URL);
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') {
    return cleanUrl(window.location.origin);
  }
  return 'http://localhost:3001';
}

/**
 * Returns the active server URL from localStorage or default.
 * @returns {string}
 */
export function getServerUrl() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && stored.trim()) {
        return cleanUrl(stored.trim());
      }
    } catch (e) {
      console.warn('[ServerConfig] Unable to read from localStorage:', e);
    }
  }
  return cleanUrl(getDefaultServerUrl());
}

/**
 * Updates and persists the server URL in localStorage, notifying listeners.
 * @param {string} newUrl
 */
export function setServerUrl(newUrl) {
  const cleaned = cleanUrl(newUrl);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      if (!cleaned || cleaned === cleanUrl(getDefaultServerUrl())) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, cleaned);
      }

      window.dispatchEvent(
        new CustomEvent('photopodra:server-url-changed', {
          detail: { url: getServerUrl() }
        })
      );
    } catch (e) {
      console.warn('[ServerConfig] Unable to write to localStorage:', e);
    }
  }
}

/**
 * Resets the server URL back to default.
 */
export function resetServerUrl() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(
        new CustomEvent('photopodra:server-url-changed', {
          detail: { url: getServerUrl() }
        })
      );
    } catch (e) {
      console.warn('[ServerConfig] Unable to clear localStorage:', e);
    }
  }
}

/**
 * Checks if a custom server URL is currently configured in localStorage.
 * @returns {boolean}
 */
export function isCustomServerUrl() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return Boolean(stored && stored.trim() && cleanUrl(stored.trim()) !== cleanUrl(getDefaultServerUrl()));
  }
  return false;
}

/**
 * Builds a complete API URL using the current server configuration.
 * @param {string} path - e.g. '/api/photos' or 'api/photos'
 * @returns {string}
 */
export function buildApiUrl(path) {
  const base = getServerUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/**
 * Builds a complete streaming media URL.
 * @param {number|string} photoId
 * @param {'thumb_sm'|'thumb_lg'|'original'} [type='original']
 * @returns {string}
 */
export function buildMediaUrl(photoId, type = 'original') {
  return buildApiUrl(`/api/media/${photoId}?type=${type}`);
}

/**
 * Tests connection to a given server URL by querying its /api/health endpoint.
 * @param {string} [candidateUrl] - Optional URL to test. Defaults to active server URL.
 * @returns {Promise<{ success: boolean, latencyMs: number, status?: number, service?: string, error?: string }>}
 */
export async function testServerConnection(candidateUrl) {
  const targetUrl = cleanUrl(candidateUrl || getServerUrl());
  const healthEndpoint = `${targetUrl}/api/health`;
  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(healthEndpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    });

    clearTimeout(timeoutId);
    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    if (!response.ok) {
      return {
        success: false,
        latencyMs,
        status: response.status,
        error: `Server responded with HTTP ${response.status} (${response.statusText})`
      };
    }

    const data = await response.json();
    return {
      success: true,
      latencyMs,
      status: response.status,
      service: data.service || 'photopodra-backend',
      timestamp: data.timestamp
    };
  } catch (err) {
    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);
    let errorMessage = err.message;
    if (err.name === 'AbortError') {
      errorMessage = 'Connection timed out after 6 seconds';
    } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      errorMessage = 'Network error: could not connect to server. Check URL, port, or CORS policy.';
    }
    return {
      success: false,
      latencyMs,
      error: errorMessage
    };
  }
}
