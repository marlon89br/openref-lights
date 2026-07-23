export const environment = {
  debug: true,
  backendUrl: 'http://localhost:3000',
  authToken: '', // Optional: Add token if backend requires authentication
  // Public URL used for jury-generated join links/QR codes (e.g. https://meet.example.com).
  // Leave empty to fall back to the browser's own window.location.origin.
  frontendUrl: '',
};
