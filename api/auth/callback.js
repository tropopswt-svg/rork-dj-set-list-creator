// Spotify OAuth relay — Spotify redirects here, we bounce into the app.
// Using a stable HTTPS URL means we never have to update Spotify Dashboard
// regardless of Expo Go tunnel URLs or device IPs.

export default function handler(req, res) {
  const { code, state, error } = req.query;

  // Build the deep link back into the app
  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (state) params.set('state', state);
  if (error) params.set('error', error);

  const deepLink = `trackd://spotify-auth-callback?${params.toString()}`;

  // Redirect into the app
  res.setHeader('Location', deepLink);
  return res.status(302).end();
}
