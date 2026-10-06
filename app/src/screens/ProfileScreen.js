import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { SyncService } from '../services/SyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { API_BASE_URL } from '../config';

const AUTH_URL = `${API_BASE_URL}/auth`;
const EXPENSES_URL = `${API_BASE_URL}/expenses`;



const ProfileScreen = ({ navigation }) => {
    const [user, setUser] = useState(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    
    const [newBankName, setNewBankName] = useState('');
    const [newBankAmount, setNewBankAmount] = useState('');
    const [isAddingBank, setIsAddingBank] = useState(false);
    const [showAddBank, setShowAddBank] = useState(false);
    
    const [editingBankId, setEditingBankId] = useState(null);
    const [editBankName, setEditBankName] = useState('');
    const [editBankAmount, setEditBankAmount] = useState('');
    

    const insets = useSafeAreaInsets();

    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const fetchProfile = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            
            // Instantly load from cache to prevent "Loading..." flicker
            const cachedUser = await AsyncStorage.getItem('cached_user');
            if (cachedUser) {
                setUser(JSON.parse(cachedUser));
            }

            const netState = await NetInfo.fetch();
            if (netState.isConnected) {
                const res = await axios.get(`${AUTH_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
                setUser(res.data);
                await AsyncStorage.setItem('cached_user', JSON.stringify(res.data));
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => { fetchProfile(); }, []);

    const handlePasswordChange = async () => {
        if (!currentPassword || !newPassword) return Alert.alert('Error', 'Please fill both password fields');
        if (isUpdatingPassword) return;
        setIsUpdatingPassword(true);
        try {
            const token = await AsyncStorage.getItem('token');
            await axios.put(`${AUTH_URL}/password`, 
                { currentPassword, newPassword }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Alert.alert('Success', 'Password updated successfully');
            setCurrentPassword(''); setNewPassword('');
        } catch (error) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to update password');
        } finally { setIsUpdatingPassword(false); }
    };

    const handleAddBank = async () => {
        if (!newBankName || !newBankAmount) return Alert.alert('Error', 'Please fill both bank name and amount');
        if (isAddingBank) return;
        setIsAddingBank(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${AUTH_URL}/bank`, 
                { name: newBankName, amount: newBankAmount }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Alert.alert('Success', 'Bank added successfully');
            setNewBankName(''); setNewBankAmount('');
            setShowAddBank(false);
            setUser({ ...user, banks: res.data });
        } catch (error) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to add bank');
        } finally { setIsAddingBank(false); }
    };

    const handleEditBank = async (bankId) => {
        if (!editBankName || !editBankAmount) return Alert.alert('Error', 'Please fill both fields');
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.put(`${AUTH_URL}/bank/${bankId}`, 
                { name: editBankName, amount: editBankAmount }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setUser({ ...user, banks: res.data });
            setEditingBankId(null);
        } catch (error) { Alert.alert('Error', 'Failed to update bank'); }
    };

    const handleDeleteBank = async (bankId) => {
        Alert.alert('Delete Bank', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    const res = await axios.delete(`${AUTH_URL}/bank/${bankId}`, { headers: { Authorization: `Bearer ${token}` } });
                    setUser({ ...user, banks: res.data });
                } catch (error) { Alert.alert('Error', 'Failed to delete bank'); }
            }}
        ]);
    };

    const handleLogout = async () => {
        await AsyncStorage.clear();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    return (
        <KeyboardAwareScrollView 
            style={styles.container} 
            contentContainerStyle={{ paddingBottom: 50, paddingTop: Math.max(insets.top + 10, 20) }} 
            showsVerticalScrollIndicator={false}
        >
            {/* Custom Header */}
            <View style={styles.headerTitleRow}>
                <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')} style={{ padding: 5, marginRight: 10 }}>
                    <Ionicons name="chevron-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitleText}>Profile</Text>
            </View>

            {/* Profile Card */}
            <LinearGradient colors={['#4F46E5', '#3730A3']} style={styles.profileCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.profileHeaderLeft}>
                    <View style={styles.profileAvatarBox}>
                        <Ionicons name="person" size={40} color="#6C5CE7" />
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.username} numberOfLines={1}>{user?.username || 'Loading...'}</Text>
                        <Text style={styles.email} numberOfLines={1}>{user?.email || 'Please wait...'}</Text>
                    </View>
                </View>
                
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>
            </LinearGradient>

            {/* Change Password */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionIconBox}>
                        <Ionicons name="shield-checkmark" size={20} color="#4F46E5" />
                    </View>
                    <View style={styles.sectionTitles}>
                        <Text style={styles.sectionTitle}>Change Password</Text>
                        <Text style={styles.sectionSubtitle}>Keep your account secure</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </View>

                <View style={styles.passwordContainer}>
                    <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={styles.inputLeftIcon} />
                    <TextInput 
                        style={styles.passwordInput} 
                        placeholder="Current Password" 
                        placeholderTextColor="#94A3B8"
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#94A3B8" />
                    </TouchableOpacity>
                </View>
                
                <View style={styles.passwordContainer}>
                    <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={styles.inputLeftIcon} />
                    <TextInput 
                        style={styles.passwordInput} 
                        placeholder="New Password" 
                        placeholderTextColor="#94A3B8"
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry={!showPassword}
                    />
                </View>
                
                <TouchableOpacity 
                    style={[styles.primaryBtn, isUpdatingPassword && { opacity: 0.7 }]} 
                    onPress={handlePasswordChange}
                    disabled={isUpdatingPassword}
                >
                    {isUpdatingPassword ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                        <View style={styles.btnContentRow}>
                            <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                            <Text style={styles.primaryBtnText}>Update Password</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* My Banks */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={styles.sectionIconBox}>
                            <Ionicons name="business" size={20} color="#4F46E5" />
                        </View>
                        <View style={styles.sectionTitles}>
                            <Text style={styles.sectionTitle}>My Banks</Text>
                            <Text style={styles.sectionSubtitle}>Manage your linked banks</Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        onPress={() => setShowAddBank(!showAddBank)}
                        style={{ backgroundColor: '#EEEDFF', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }}
                    >
                        <Ionicons name={showAddBank ? "close" : "add"} size={22} color="#4F46E5" />
                    </TouchableOpacity>
                </View>

                {user?.banks && user.banks.length > 0 ? (
                    user.banks.map((bank, index) => (
                        <View key={index} style={styles.bankItem}>
                            {editingBankId === bank._id ? (
                                <View style={{ flex: 1 }}>
                                    <View style={[styles.passwordContainer, { marginBottom: 10, height: 45 }]}>
                                        <TextInput style={styles.passwordInput} value={editBankName} onChangeText={setEditBankName} placeholder="Bank Name" />
                                    </View>
                                    <View style={[styles.passwordContainer, { marginBottom: 15, height: 45 }]}>
                                        <TextInput style={styles.passwordInput} value={editBankAmount} onChangeText={setEditBankAmount} placeholder="Amount" keyboardType="numeric" />
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
                                        <TouchableOpacity onPress={() => setEditingBankId(null)} style={styles.cancelBtn}>
                                            <Text style={styles.cancelBtnText}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleEditBank(bank._id)} style={styles.saveBtn}>
                                            <Text style={styles.saveBtnText}>Save</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={[styles.iconCircle, { backgroundColor: index % 2 === 0 ? '#E0F2FE' : '#F0F0FF' }]}>
                                            <Ionicons name="business" size={24} color={index % 2 === 0 ? '#0EA5E9' : '#6C5CE7'} />
                                        </View>
                                        <View style={{ marginLeft: 12 }}>
                                            <Text style={styles.expenseTitle}>{bank.name}</Text>
                                            <Text style={styles.expenseDate}>₹{bank.amount.toFixed(2)}</Text>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <TouchableOpacity 
                                            onPress={() => { setEditingBankId(bank._id); setEditBankName(bank.name); setEditBankAmount(bank.amount.toString()); }}
                                            style={{ backgroundColor: '#EEEDFF', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }}
                                        >
                                            <Ionicons name="create-outline" size={18} color="#4F46E5" />
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={() => handleDeleteBank(bank._id)}
                                            style={{ backgroundColor: '#FFF0F0', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#FF4757" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    ))
                ) : null}
                
                {showAddBank && (
                    <View style={{ marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                        <View style={styles.passwordContainer}>
                            <TextInput style={styles.passwordInput} placeholder="Bank Name" placeholderTextColor="#94A3B8" value={newBankName} onChangeText={setNewBankName} />
                        </View>
                        <View style={styles.passwordContainer}>
                            <TextInput style={styles.passwordInput} placeholder="Initial Amount" placeholderTextColor="#94A3B8" value={newBankAmount} onChangeText={setNewBankAmount} keyboardType="numeric" />
                        </View>
                        <TouchableOpacity style={[styles.primaryBtn, isAddingBank && { opacity: 0.7 }]} onPress={handleAddBank} disabled={isAddingBank}>
                            {isAddingBank ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                                <View style={styles.btnContentRow}>
                                    <Ionicons name="add" size={18} color="#FFFFFF" />
                                    <Text style={styles.primaryBtnText}>Add Bank</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>


        </KeyboardAwareScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9F9FB', paddingHorizontal: 20 },
    
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 20 },
    headerTitleText: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
    
    // Profile Card
    profileCard: { 
        padding: 20, borderRadius: 24, marginBottom: 20,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8
    },
    profileHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    profileAvatarBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
    profileInfo: { marginLeft: 15, flex: 1 },
    username: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 },
    email: { fontSize: 13, color: '#C7D2FE', fontWeight: '500' },
    logoutBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    logoutText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', marginTop: 4 },
    
    // Cards
    sectionCard: { 
        backgroundColor: '#FFFFFF', padding: 22, borderRadius: 24, marginBottom: 20,
        shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    sectionIconBox: { backgroundColor: '#EEEDFF', width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    sectionTitles: { marginLeft: 15, flex: 1 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    sectionSubtitle: { fontSize: 12, color: '#94A3B8', fontWeight: '500', marginTop: 2 },
    
    // Inputs & Buttons
    passwordContainer: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, 
        borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 15 
    },
    inputLeftIcon: { marginLeft: 15 },
    passwordInput: { flex: 1, height: 50, paddingHorizontal: 12, fontSize: 14, color: '#1E293B', fontWeight: '500' },
    eyeIcon: { padding: 15 },
    
    primaryBtn: { backgroundColor: '#4F46E5', padding: 14, borderRadius: 16, alignItems: 'center' },
    btnContentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    primaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

    cancelBtn: { padding: 10, backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 16 },
    cancelBtnText: { fontWeight: '700', color: '#64748B' },
    saveBtn: { padding: 10, backgroundColor: '#4F46E5', borderRadius: 12, paddingHorizontal: 16 },
    saveBtnText: { fontWeight: '700', color: '#FFF' },
    
    // Banks & List items
    bankItem: { marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    
});

export default ProfileScreen;
