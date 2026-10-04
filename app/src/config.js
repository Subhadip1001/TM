import { Platform } from 'react-native';

// Your backend is running on port 7894
const PORT = 7894;

// 10.0.2.2 is used for Android Emulators to access localhost
// localhost is used for iOS Simulator and Web
// Note: For physical devices, you must replace this with your computer's local IP address (e.g. 'http://192.168.1.5:7894/api')
export const API_BASE_URL = Platform.OS === 'android' 
    ? `http://10.0.2.2:${PORT}/api` 
    : `http://localhost:${PORT}/api`;
