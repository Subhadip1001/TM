import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_PREFERENCE_KEY = 'user_theme_preference';

export const LightColors = {
    background: '#F8FAFC',
    card: '#FFFFFF',
    cardBorder: '#F1F5F9',
    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    primary: '#4F46E5',
    primaryLight: '#EEEDFF',
    border: '#E2E8F0',
    inputBg: '#F8FAFC',
    tabBarBg: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
    danger: '#FF4757',
    success: '#20BF6B',
    warning: '#F59E0B',
};

export const DarkColors = {
    background: '#0B0F19',
    card: '#161F30',
    cardBorder: '#233047',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    primary: '#6366F1',
    primaryLight: 'rgba(99, 102, 241, 0.22)',
    border: '#233047',
    inputBg: '#0B0F19',
    tabBarBg: '#131A29',
    tabBarBorder: '#233047',
    danger: '#FF5C6C',
    success: '#2ED573',
    warning: '#F59E0B',
};

const ThemeContext = createContext({
    isDark: false,
    colors: LightColors,
    colorScheme: 'light',
});

export const ThemeProvider = ({ children }) => {
    const hookColorScheme = useColorScheme();
    const [colorScheme, setColorScheme] = useState(
        Appearance.getColorScheme() || hookColorScheme || 'light'
    );

    useEffect(() => {
        // Clear any old manual override so the device system theme is always respected
        AsyncStorage.removeItem(THEME_PREFERENCE_KEY).catch(() => {});

        // Initial sync with system
        const initial = Appearance.getColorScheme();
        if (initial) {
            setColorScheme(initial);
        }

        // Listen for real-time system changes (e.g., user toggles Dark Mode in phone settings/notification bar)
        const subscription = Appearance.addChangeListener(({ colorScheme: newScheme }) => {
            if (newScheme) {
                setColorScheme(newScheme);
            }
        });

        return () => subscription.remove();
    }, []);

    // Sync when hookColorScheme changes
    useEffect(() => {
        if (hookColorScheme) {
            setColorScheme(hookColorScheme);
        }
    }, [hookColorScheme]);

    const isDark = colorScheme === 'dark';
    const colors = isDark ? DarkColors : LightColors;

    return (
        <ThemeContext.Provider value={{ isDark, colors, colorScheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
