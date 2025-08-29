// Token management utility for handling authentication tokens
const TOKEN_KEY = 'asset_tracker_auth_token';
const TOKEN_EXPIRY_KEY = 'asset_tracker_token_expiry';

// Generate a random token
const generateToken = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Set token with 7-day expiration
export const setAuthToken = (userId, email) => {
  const token = generateToken();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 7); // 7 days from now
  
  const tokenData = {
    token,
    userId,
    email,
    createdAt: new Date().toISOString(),
    expiresAt: expiryDate.toISOString()
  };
  
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryDate.toISOString());
  
  return tokenData;
};

// Get current token
export const getAuthToken = () => {
  try {
    const tokenData = localStorage.getItem(TOKEN_KEY);
    if (!tokenData) return null;
    
    const parsed = JSON.parse(tokenData);
    const expiryDate = new Date(parsed.expiresAt);
    const now = new Date();
    
    // Check if token is expired
    if (now > expiryDate) {
      clearAuthToken();
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error('Error reading auth token:', error);
    return null;
  }
};

// Clear token
export const clearAuthToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
};

// Check if token is valid (not expired)
export const isTokenValid = () => {
  const tokenData = getAuthToken();
  return tokenData !== null;
};

// Get days until token expires
export const getDaysUntilExpiry = () => {
  const tokenData = getAuthToken();
  if (!tokenData) return 0;
  
  const expiryDate = new Date(tokenData.expiresAt);
  const now = new Date();
  const diffTime = expiryDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

// Refresh token expiry (extend by 7 days from now)
export const refreshTokenExpiry = () => {
  const tokenData = getAuthToken();
  if (!tokenData) return null;
  
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 7);
  
  tokenData.expiresAt = expiryDate.toISOString();
  
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryDate.toISOString());
  
  return tokenData;
};