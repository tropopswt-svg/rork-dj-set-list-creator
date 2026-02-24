/**
 * Spotify OAuth (PKCE) + Token Management
 *
 * Authenticates the user with Spotify's Authorization Code + PKCE flow
 * so we can create playlists on their behalf. No client secret is stored
 * on the device — only the public client ID is needed.
 *
 * expo-auth-session is lazy-imported to avoid crashing at module load time
 * in Expo Go when the native module isn't fully ready.
 */
import * as SecureStore from 'expo-secure-store';

// ============================================
// Config
// ============================================

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '';
const SCOPES = ['playlist-modify-public', 'playlist-modify-private', 'user-read-private', 'user-library-modify'];

const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

// SecureStore keys
const KEY_ACCESS_TOKEN = 'spotify_access_token';
const KEY_REFRESH_TOKEN = 'spotify_refresh_token';
const KEY_TOKEN_EXPIRY = 'spotify_token_expiry';
const KEY_USER_ID = 'spotify_user_id';
const KEY_USER_NAME = 'spotify_user_name';

// ============================================
// Lazy loaders — avoid top-level native module access
// ============================================

let _AuthSession: typeof import('expo-auth-session') | null = null;
async function getAuthSession() {
  if (!_AuthSession) {
    _AuthSession = require('expo-auth-session') as typeof import('expo-auth-session');
  }
  return _AuthSession;
}

let _WebBrowser: typeof import('expo-web-browser') | null = null;
async function getWebBrowser() {
  if (!_WebBrowser) {
    _WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');
  }
  return _WebBrowser;
}

// ============================================
// Public API
// ============================================

/**
 * Whether the Spotify client ID is configured (feature is available).
 */
export function isSpotifyExportConfigured(): boolean {
  return CLIENT_ID.length > 0 && CLIENT_ID !== 'your-spotify-client-id';
}

/**
 * Whether the user has previously connected their Spotify account
 * and we have a (possibly expired) refresh token stored.
 */
export async function isSpotifyConnected(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync(KEY_REFRESH_TOKEN);
  return refreshToken !== null;
}

/**
 * Get the stored Spotify display name (null if not connected).
 */
export async function getSpotifyDisplayName(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_USER_NAME);
}

/**
 * Get the stored Spotify user ID (null if not connected).
 */
export async function getSpotifyUserId(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_USER_ID);
}

/**
 * Full OAuth dance — opens the Spotify login page, gets an auth code,
 * exchanges it for tokens, fetches the user profile, and persists everything.
 *
 * Returns `true` on success.
 */
export async function authenticateWithSpotify(): Promise<boolean> {
  if (!isSpotifyExportConfigured()) return false;

  try {
    const AuthSession = await getAuthSession();
    const WebBrowser = await getWebBrowser();

    WebBrowser.maybeCompleteAuthSession();

    const redirectUri = 'https://trakthat.app/api/auth/callback';

    const request = new AuthSession.AuthRequest({
      clientId: CLIENT_ID,
      scopes: SCOPES,
      redirectUri,
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
    });

    const result = await request.promptAsync(DISCOVERY);

    if (result.type !== 'success' || !result.params.code) {
      return false;
    }

    // Exchange code for tokens
    const tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId: CLIENT_ID,
        code: result.params.code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier! },
      },
      DISCOVERY,
    );

    await persistTokens(tokenResponse.accessToken, tokenResponse.refreshToken ?? null, tokenResponse.expiresIn ?? 3600);

    // Fetch and store user profile
    await fetchAndStoreUserProfile(tokenResponse.accessToken);

    return true;
  } catch (error) {
    if (__DEV__) console.error('[spotifyAuth] authenticate error:', error);
    return false;
  }
}

/**
 * Returns a valid (non-expired) access token.
 * Automatically refreshes if the current token is expired.
 * Returns `null` if the user is not connected.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const accessToken = await SecureStore.getItemAsync(KEY_ACCESS_TOKEN);
  const expiryStr = await SecureStore.getItemAsync(KEY_TOKEN_EXPIRY);
  const refreshToken = await SecureStore.getItemAsync(KEY_REFRESH_TOKEN);

  if (!refreshToken) return null;

  // Token still valid (with 60s buffer)?
  if (accessToken && expiryStr) {
    const expiry = parseInt(expiryStr, 10);
    if (Date.now() < expiry - 60_000) {
      return accessToken;
    }
  }

  // Need to refresh
  return refreshAccessToken(refreshToken);
}

/**
 * Disconnects the Spotify account — clears all stored tokens.
 */
export async function disconnectSpotify(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(KEY_REFRESH_TOKEN);
  await SecureStore.deleteItemAsync(KEY_TOKEN_EXPIRY);
  await SecureStore.deleteItemAsync(KEY_USER_ID);
  await SecureStore.deleteItemAsync(KEY_USER_NAME);
}

// ============================================
// Internals
// ============================================

async function persistTokens(accessToken: string, refreshToken: string | null, expiresIn: number): Promise<void> {
  await SecureStore.setItemAsync(KEY_ACCESS_TOKEN, accessToken);
  if (refreshToken) {
    await SecureStore.setItemAsync(KEY_REFRESH_TOKEN, refreshToken);
  }
  const expiry = Date.now() + expiresIn * 1000;
  await SecureStore.setItemAsync(KEY_TOKEN_EXPIRY, expiry.toString());
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const AuthSession = await getAuthSession();

    const response = await AuthSession.refreshAsync(
      {
        clientId: CLIENT_ID,
        refreshToken,
      },
      DISCOVERY,
    );

    await persistTokens(response.accessToken, response.refreshToken ?? null, response.expiresIn ?? 3600);
    return response.accessToken;
  } catch (error) {
    if (__DEV__) console.error('[spotifyAuth] refresh error:', error);
    // Refresh failed — user needs to re-authenticate
    await disconnectSpotify();
    return null;
  }
}

async function fetchAndStoreUserProfile(accessToken: string): Promise<void> {
  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return;

    const data = await response.json();
    if (data.id) await SecureStore.setItemAsync(KEY_USER_ID, data.id);
    if (data.display_name) await SecureStore.setItemAsync(KEY_USER_NAME, data.display_name);
  } catch {
    // Non-critical — we can fetch later
  }
}
