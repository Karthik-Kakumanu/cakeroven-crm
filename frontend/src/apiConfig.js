// frontend/src/apiConfig.js

// Detect if we are on Render (production)
const isRenderProduction =
  typeof window !== "undefined" &&
  window.location.hostname.endsWith("onrender.com");

// If running on Render -> use backend URL
// If running on local dev -> use localhost:4000
export const API_BASE = isRenderProduction
  ? "https://cakeroven-crm-backend.onrender.com"
  : "http://localhost:4000";
