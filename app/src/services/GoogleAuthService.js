import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

// Ensure WebBrowser completes redirect on web & Android
WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_CLIENT_ID = '83320831113-hbptsamnjjnu1gcq070k6tjvdc6umij0.apps.googleusercontent.com';

const discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke'
};

/**
 * Initiates Google OAuth Sign-In via system browser / Chrome custom tabs
 * Returns { success: true, token, user, isNewUser } or throws an error.
 */
export async function signInWithGoogle() {
    try {
        const redirectUri = AuthSession.makeRedirectUri({
            scheme: 'app',
            path: 'auth'
        });

        const request = new AuthSession.AuthRequest({
            clientId: GOOGLE_CLIENT_ID,
            scopes: ['openid', 'profile', 'email'],
            responseType: AuthSession.ResponseType.Token, // Retrieves access_token directly
            redirectUri,
            extraParams: {
                prompt: 'select_account'
            }
        });

        const result = await request.promptAsync(discovery);

        if (result.type !== 'success') {
            if (result.type === 'cancel' || result.type === 'dismiss') {
                return { cancelled: true };
            }
            throw new Error(result.error?.message || 'Google sign-in was cancelled or failed.');
        }

        const accessToken = result.params?.access_token || result.authentication?.accessToken;
        const idToken = result.params?.id_token;

        if (!accessToken && !idToken) {
            throw new Error('No authentication token received from Google.');
        }

        // Fetch user profile from Google
        let userInfo = null;
        if (accessToken) {
            try {
                const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (userRes.ok) {
                    userInfo = await userRes.json();
                }
            } catch (err) {
                console.warn('Failed to fetch userinfo from Google directly:', err);
            }
        }

        // Send to backend /api/auth/google
        const backendRes = await axios.post(`${API_BASE_URL}/auth/google`, {
            idToken,
            accessToken,
            userInfo
        });

        if (backendRes.data?.token) {
            await AsyncStorage.setItem('token', backendRes.data.token);
            return {
                success: true,
                token: backendRes.data.token,
                user: backendRes.data.user,
                isNewUser: backendRes.data.isNewUser
            };
        } else {
            throw new Error('Server did not return a valid session token.');
        }
    } catch (error) {
        console.error('Google Sign-In Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.error || error.message || 'Google authentication failed');
    }
}
