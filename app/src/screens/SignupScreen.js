import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/auth`;


const SignupScreen = ({ navigation }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleSignup = async () => {
        if (isLoading) return;
        setErrorMessage('');
        setIsLoading(true);
        try {
            const res = await axios.post(`${API_URL}/register`, { username, email, password });
            if (res.status === 201) {
                // Automatically log the user in after registration
                const loginRes = await axios.post(`${API_URL}/login`, { email, password });
                if (loginRes.data.token) {
                    await AsyncStorage.setItem('token', loginRes.data.token);
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'Home' }],
                    });
                }
            }
        } catch (error) {
            console.error('Signup Error:', error.response?.data || error.message);
            setErrorMessage(error.response?.data?.error || 'Signup failed. Please try again.');
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
                <Text style={styles.title}>Create Account</Text>

            {errorMessage ? (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color="#EF4444" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            ) : null}

            <TextInput 
                style={styles.input} 
                placeholder="Username" 
                placeholderTextColor="#94A3B8"
                value={username}
                onChangeText={setUsername}
            />
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
                onPress={handleSignup}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                    <Text style={styles.buttonText}>Sign Up</Text>
                )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.linkText}>Already have an account? Login</Text>
            </TouchableOpacity>
            </View>
        </KeyboardAwareScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flexGrow: 1, justifyContent: 'center', padding: 25 },
    title: { fontSize: 36, fontWeight: '800', marginBottom: 40, textAlign: 'center', color: '#1E293B', letterSpacing: 0.5 },
    input: { 
        height: 55, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 20, marginBottom: 20, 
        borderWidth: 1, borderColor: '#E2E8F0', fontSize: 16, color: '#334155',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
    },
    passwordContainer: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, 
        borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 25,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
    },
    errorContainer: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 15, borderRadius: 12, marginBottom: 20,
        borderWidth: 1, borderColor: '#FECACA'
    },
    errorText: { color: '#EF4444', fontSize: 14, fontWeight: '600', marginLeft: 8, flex: 1 },
    passwordInput: { flex: 1, height: 55, paddingHorizontal: 20, fontSize: 16, color: '#334155' },
    eyeIcon: { padding: 15 },
    button: { 
        backgroundColor: '#029EEC', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', 
        marginTop: 10, shadowColor: '#029EEC', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5
    },
    buttonDisabled: { backgroundColor: '#6CBCE9' },
    buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
    linkText: { color: '#029EEC', marginTop: 25, textAlign: 'center', fontSize: 16, fontWeight: '600' }
});

export default SignupScreen;
