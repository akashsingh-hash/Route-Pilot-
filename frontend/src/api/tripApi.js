import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Sends trip request payload to backend HOS planning endpoint.
 * Includes 15-second request timeout and detailed error parsing for 4xx/5xx/network errors.
 * 
 * @param {Object} payload - { current_location, pickup_location, dropoff_location, current_cycle_used }
 * @returns {Promise<Object>} Parsed trip response data
 */
export async function planTrip(payload) {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/plan-trip/`, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000, // 15 seconds timeout
    });
    return response.data;
  } catch (error) {
    if (axios.isCancel(error) || error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new Error('Request Timeout: Geocoding or route calculation took longer than 15 seconds. Please verify location names and try again.');
    } else if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      // Extract error message from server response
      const serverMsg = (data && typeof data === 'object' && (data.error || data.detail))
        ? (data.error || data.detail)
        : (typeof data === 'string' ? data : null);

      if (status === 422) {
        throw new Error(serverMsg || 'Geocoding Error (422): One or more location names could not be found. Please enter valid city names or addresses.');
      } else if (status === 400) {
        throw new Error(serverMsg || 'Validation Error (400): Invalid trip parameters submitted.');
      } else if (status === 503) {
        throw new Error(serverMsg || 'Service Unavailable (503): Routing or geocoding service is temporarily unreachable.');
      } else {
        throw new Error(serverMsg ? `Server Error (${status}): ${serverMsg}` : `Server Error (${status}): Trip planning request failed.`);
      }
    } else if (error.request) {
      throw new Error(`Network Error: Unable to connect to backend server at ${API_BASE_URL}. Please ensure the Django backend is running.`);
    } else {
      throw new Error(error.message || 'An unexpected error occurred while planning trip.');
    }
  }
}

export default {
  planTrip,
};
