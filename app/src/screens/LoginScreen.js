import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { API_BASE_URL } from '../config';
import { useTheme } from '../context/ThemeContext';

const API_URL = `${API_BASE_URL}/auth`; 


const LoginScreen = ({ navigation }) => {
    const { colors, isDark } = useTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleLogin = async () => {
        if (isLoading) return;
        setErrorMessage('');

        const trimmedEmail = (email || '').trim().toLowerCase();

        if (!trimmedEmail) {
            setErrorMessage('Please enter your Gmail address');
            return;
        }

        // Strict Gmail address validation (must end with @gmail.com)
        const gmailRegex = /^[a-z0-9][a-z0-9._%+-]*@gmail\.com$/;
        if (!gmailRegex.test(trimmedEmail)) {
            setErrorMessage('Please enter a valid Gmail address (e.g. yourname@gmail.com)');
            return;
        }

        if (!password) {
            setErrorMessage('Please enter your password');
            return;
        }

        setIsLoading(true);
        try {
            const res = await axios.post(`${API_URL}/login`, { email: trimmedEmail, password });
            if (res.data.token) {
                await AsyncStorage.setItem('token', res.data.token);
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Main' }],
                });
            }
        } catch (error) {
            console.error('Login Error:', error.response?.data || error.message);
            setErrorMessage(error.response?.data?.error || 'Login failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAwareScrollView 
            style={{ flex: 1, backgroundColor: colors.background }} 
            contentContainerStyle={[styles.container, { backgroundColor: colors.background }]} 
            keyboardShouldPersistTaps="handled"
            enableOnAndroid={true}
            enableResetScrollToCoords={false}
            extraScrollHeight={Platform.OS === 'ios' ? 40 : 0}
            extraHeight={Platform.OS === 'ios' ? 60 : 0}
            enableAutomaticScroll={Platform.OS === 'ios'}
            bounces={false}
        >
            <View style={{ width: '100%' }}>
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <View style={{ backgroundColor: colors.primaryLight, padding: 20, borderRadius: 24 }}>
                        <Ionicons name="wallet" size={40} color={colors.primary} />
                    </View>
                </View>
                <Text style={[styles.title, { color: colors.text }]}>Welcome Back!</Text>
            
            {errorMessage ? (
                <View style={[styles.errorContainer, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FFF1F2', borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FECDD3' }]}>
                    <Ionicons name="alert-circle" size={20} color="#EF4444" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            ) : null}

            <TextInput 
                style={[
                    styles.input, 
                    { 
                        backgroundColor: colors.card, 
                        color: colors.text, 
                        borderColor: isDark ? colors.border : '#F1F5F9',
                        borderWidth: 1
                    }
                ]} 
                placeholder="name@gmail.com" 
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />
            <View style={[
                styles.passwordContainer, 
                { 
                    backgroundColor: colors.card, 
                    borderColor: isDark ? colors.border : '#F1F5F9',
                    borderWidth: 1
                }
            ]}>
                <TextInput 
                    style={[styles.passwordInput, { color: colors.text }]} 
                    placeholder="Password" 
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                />
                <TouchableOpacity 
                    style={styles.eyeIcon} 
                    onPress={() => setShowPassword(!showPassword)}
                >
                    <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>
            <TouchableOpacity 
                style={[styles.button, { backgroundColor: colors.primary }, isLoading && styles.buttonDisabled]} 
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.85}
            >
                {isLoading ? (
                    <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.loadingText}>Signing you in...</Text>
                    </View>
                ) : (
                    <View style={styles.btnContentRow}>
                        <Text style={styles.buttonText}>Login</Text>
                        <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 6 }} />
                    </View>
                )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')} disabled={isLoading}>
                <Text style={[styles.linkText, { color: colors.primary }]}>Don't have an account? Sign up</Text>
            </TouchableOpacity>
            </View>
        </KeyboardAwareScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flexGrow: 1, justifyContent: 'center', padding: 25, backgroundColor: '#F8FAFC' },
    title: { fontSize: 36, fontWeight: '900', marginBottom: 40, textAlign: 'center', color: '#0F172A', letterSpacing: -0.5 },
    input: { 
        height: 60, backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 20, marginBottom: 20, 
        borderWidth: 1, borderColor: '#F1F5F9', fontSize: 16, color: '#1E293B', fontWeight: '500',
        shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
    },
    passwordContainer: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, 
        borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 25,
        shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
    },
    errorContainer: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF1F2', padding: 15, borderRadius: 16, marginBottom: 20,
        borderWidth: 1, borderColor: '#FECDD3'
    },
    errorText: { color: '#E11D48', fontSize: 14, fontWeight: '600', marginLeft: 8, flex: 1 },
    passwordInput: { flex: 1, height: 60, paddingHorizontal: 20, fontSize: 16, color: '#1E293B', fontWeight: '500' },
    eyeIcon: { padding: 15 },
    button: { 
        backgroundColor: '#4F46E5', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', 
        marginTop: 10, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 15, elevation: 8
    },
    buttonDisabled: { backgroundColor: '#6366F1', opacity: 0.9 },
    btnContentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    loadingText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
    buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
    linkText: { color: '#4F46E5', marginTop: 30, textAlign: 'center', fontSize: 16, fontWeight: '700' }
});

export default LoginScreen;
