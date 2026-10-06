import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/auth`; 


const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleLogin = async () => {
        if (isLoading) return;
        setErrorMessage('');
        setIsLoading(true);
        try {
            const res = await axios.post(`${API_URL}/login`, { email, password });
            if (res.data.token) {
                await AsyncStorage.setItem('token', res.data.token);
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
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
            style={{ flex: 1, backgroundColor: '#F4F7FC' }} 
            contentContainerStyle={styles.container} 
            keyboardShouldPersistTaps="handled"
            enableOnAndroid={true}
            extraScrollHeight={20}
        >
            <View>
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <View style={{ backgroundColor: '#EEEDFF', padding: 20, borderRadius: 24 }}>
                        <Ionicons name="wallet" size={40} color="#4F46E5" />
                    </View>
                </View>
                <Text style={styles.title}>Welcome Back!</Text>
            
            {errorMessage ? (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color="#EF4444" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            ) : null}

            <TextInput 
                style={styles.input} 
                placeholder="Email" 
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />
            <View style={styles.passwordContainer}>
                <TextInput 
                    style={styles.passwordInput} 
                    placeholder="Password" 
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                />
                <TouchableOpacity 
                    style={styles.eyeIcon} 
                    onPress={() => setShowPassword(!showPassword)}
                >
                    <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color="gray" />
                </TouchableOpacity>
            </View>
            <TouchableOpacity 
                style={[styles.button, isLoading && styles.buttonDisabled]} 
                onPress={handleLogin}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                    <Text style={styles.buttonText}>Login</Text>
                )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.linkText}>Don't have an account? Sign up</Text>
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
    buttonDisabled: { backgroundColor: '#818CF8' },
    buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
    linkText: { color: '#4F46E5', marginTop: 30, textAlign: 'center', fontSize: 16, fontWeight: '700' }
});

export default LoginScreen;
