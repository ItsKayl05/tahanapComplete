// Centralized landlord property-related API calls
import axios from 'axios';
import { buildApi } from '../apiConfig';

// Helper to attach auth header
function authHeaders() {
  const token = localStorage.getItem('user_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchMyProperties(signal) {
  try {
  const res = await axios.get(buildApi('/properties/my-properties'), {
      headers: { ...authHeaders() },
      signal
    });
    return res.data;
  } catch (err) {
    if (axios.isCancel(err)) throw err;
    throw new Error(err.response?.data?.message || 'Failed to load properties');
  }
}

export async function deleteProperty(id) {
  try {
  const res = await axios.delete(buildApi(`/properties/${id}`), {
      headers: { ...authHeaders() }
    });
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.message || 'Failed to delete property');
  }
}
