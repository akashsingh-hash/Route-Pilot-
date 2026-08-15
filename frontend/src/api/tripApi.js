import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Sends trip request payload to backend HOS planning endpoint.
 * @param {Object} payload - { current_location, pickup_location, dropoff_location, current_cycle_used }
 * @returns {Promise<Object>} Parsed trip response data
 */
export async function planTrip(payload) {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/plan-trip/`, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      const serverMsg = error.response.data?.error || 
                        error.response.data?.detail || 
                        (typeof error.response.data === 'string' ? error.response.data : null);
      const statusText = `Server Error (${error.response.status})`;
      throw new Error(serverMsg ? `${statusText}: ${serverMsg}` : statusText);
    } else if (error.request) {
      throw new Error('Network Error: Unable to connect to backend server. Please verify backend is running at ' + API_BASE_URL);
    } else {
      throw new Error(error.message || 'An unexpected error occurred while planning trip.');
    }
  }
}

export default {
  planTrip,
};
