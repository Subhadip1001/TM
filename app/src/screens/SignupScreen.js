import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
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

    const handleSignup = async () => {
        try {
            const res = await axios.post(`${API_URL}/register`, { username, email, password });
            if (res.status === 201) {
                Alert.alert('Success', 'Account created successfully! Please login.');
                navigation.navigate('Login');
            }
        } catch (error) {
            console.error('Signup Error:', error.response?.data || error.message);
            Alert.alert('Error', 'Signup failed: ' + (error.response?.data?.error || error.message));
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Create Account</Text>
            <TextInput 
                style={styles.input} 
                placeholder="Username" 
                value={username}
                onChangeText={setUsername}
            />
            <TextInput 
                style={styles.input} 
                placeholder="Email" 
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />
            <View style={styles.passwordContainer}>
                <TextInput 
                    style={styles.passwordInput} 
                    placeholder="Password" 
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
            <TouchableOpacity style={styles.button} onPress={handleSignup}>
                <Text style={styles.buttonText}>Sign Up</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.linkText}>Already have an account? Login</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 25, backgroundColor: '#F4F7FC' },
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
    passwordInput: { flex: 1, height: 55, paddingHorizontal: 20, fontSize: 16, color: '#334155' },
    eyeIcon: { padding: 15 },
    button: { 
        backgroundColor: '#4F46E5', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', 
        marginTop: 10, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5
    },
    buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
    linkText: { color: '#4F46E5', marginTop: 25, textAlign: 'center', fontSize: 16, fontWeight: '600' }
});

export default SignupScreen;
