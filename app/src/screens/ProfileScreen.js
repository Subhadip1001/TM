import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { API_BASE_URL } from '../config';

const AUTH_URL = `${API_BASE_URL}/auth`;
const EXPENSES_URL = `${API_BASE_URL}/expenses`;

const MONTHS = [
    { label: 'January', value: 1 }, { label: 'February', value: 2 }, { label: 'March', value: 3 },
    { label: 'April', value: 4 }, { label: 'May', value: 5 }, { label: 'June', value: 6 },
    { label: 'July', value: 7 }, { label: 'August', value: 8 }, { label: 'September', value: 9 },
    { label: 'October', value: 10 }, { label: 'November', value: 11 }, { label: 'December', value: 12 }
];

const ProfileScreen = ({ navigation }) => {
    const [user, setUser] = useState(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    
    const [newBankName, setNewBankName] = useState('');
    const [newBankAmount, setNewBankAmount] = useState('');
    const [isAddingBank, setIsAddingBank] = useState(false);
    
    const [editingBankId, setEditingBankId] = useState(null);
    const [editBankName, setEditBankName] = useState('');
    const [editBankAmount, setEditBankAmount] = useState('');
    
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [filteredExpenses, setFilteredExpenses] = useState([]);
    const [filteredTotal, setFilteredTotal] = useState(0);

    const fetchProfile = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${AUTH_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
            setUser(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchFilteredExpenses = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${EXPENSES_URL}/filter/${selectedYear}/${selectedMonth}`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            setFilteredExpenses(res.data.expenses);
            setFilteredTotal(res.data.total);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchFilteredExpenses();
        }, [selectedMonth, selectedYear])
    );

    const handlePasswordChange = async () => {
        if (!currentPassword || !newPassword) {
            Alert.alert('Error', 'Please fill both password fields');
            return;
        }
        if (isUpdatingPassword) return;
        setIsUpdatingPassword(true);
        try {
            const token = await AsyncStorage.getItem('token');
            await axios.put(`${AUTH_URL}/password`, 
                { currentPassword, newPassword }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Alert.alert('Success', 'Password updated successfully');
            setCurrentPassword('');
            setNewPassword('');
        } catch (error) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to update password');
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handleAddBank = async () => {
        if (!newBankName || !newBankAmount) {
            Alert.alert('Error', 'Please fill both bank name and amount');
            return;
        }
        if (isAddingBank) return;
        setIsAddingBank(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${AUTH_URL}/bank`, 
                { name: newBankName, amount: newBankAmount }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Alert.alert('Success', 'Bank added successfully');
            setNewBankName('');
            setNewBankAmount('');
            setUser({ ...user, banks: res.data });
        } catch (error) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to add bank');
        } finally {
            setIsAddingBank(false);
        }
    };

    const handleEditBank = async (bankId) => {
        if (!editBankName || !editBankAmount) {
            Alert.alert('Error', 'Please fill both bank name and amount');
            return;
        }
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.put(`${AUTH_URL}/bank/${bankId}`, 
                { name: editBankName, amount: editBankAmount }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setUser({ ...user, banks: res.data });
            setEditingBankId(null);
        } catch (error) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to update bank');
        }
    };

    const handleDeleteBank = async (bankId) => {
        Alert.alert('Delete Bank', 'Are you sure you want to delete this bank?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    const res = await axios.delete(`${AUTH_URL}/bank/${bankId}`, { 
                        headers: { Authorization: `Bearer ${token}` } 
                    });
                    setUser({ ...user, banks: res.data });
                } catch (error) {
                    Alert.alert('Error', error.response?.data?.error || 'Failed to delete bank');
                }
            }}
        ]);
    };

    const handleLogout = async () => {
        await AsyncStorage.removeItem('token');
        navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
        });
    };

    const renderExpenseItem = ({ item }) => (
        <View style={styles.expenseItem}>
            <View>
                <Text style={styles.expenseTitle}>{item.title}</Text>
                <Text style={styles.expenseDate}>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.expenseAmount}>₹{item.amount.toFixed(2)}</Text>
        </View>
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
            {/* Profile Info */}
            <View style={styles.card}>
                <View style={styles.profileHeader}>
                    <View style={styles.profileHeaderLeft}>
                        <Ionicons name="person-circle" size={64} color="#4F46E5" />
                        <View style={styles.profileInfo}>
                            <Text style={styles.username} numberOfLines={1} ellipsizeMode="tail">{user?.username || 'Loading...'}</Text>
                            <Text style={styles.email} numberOfLines={1} ellipsizeMode="tail">{user?.email || 'Please wait...'}</Text>
                        </View>
                    </View>
                    
                    <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={24} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Change Password */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Change Password</Text>
                <View style={styles.passwordContainer}>
                    <TextInput 
                        style={styles.passwordInput} 
                        placeholder="Current Password" 
                        placeholderTextColor="#94A3B8"
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                        <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="gray" />
                    </TouchableOpacity>
                </View>
                <View style={styles.passwordContainer}>
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
                    style={[styles.updateBtn, isUpdatingPassword && styles.updateBtnDisabled]} 
                    onPress={handlePasswordChange}
                    disabled={isUpdatingPassword}
                >
                    {isUpdatingPassword ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text style={styles.updateBtnText}>Update Password</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* My Banks */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>My Banks</Text>
                {user?.banks && user.banks.length > 0 ? (
                    user.banks.map((bank, index) => (
                        <View key={index} style={[styles.expenseItem, { flexDirection: 'column', alignItems: 'stretch' }]}>
                            {editingBankId === bank._id ? (
                                <View>
                                    <TextInput 
                                        style={[styles.passwordInput, { marginBottom: 10, height: 40 }]} 
                                        value={editBankName}
                                        onChangeText={setEditBankName}
                                        placeholder="Bank Name"
                                    />
                                    <TextInput 
                                        style={[styles.passwordInput, { marginBottom: 10, height: 40 }]} 
                                        value={editBankAmount}
                                        onChangeText={setEditBankAmount}
                                        placeholder="Amount"
                                        keyboardType="numeric"
                                    />
                                    <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
                                        <TouchableOpacity onPress={() => setEditingBankId(null)} style={{ padding: 8, backgroundColor: '#E2E8F0', borderRadius: 8 }}>
                                            <Text style={{ fontWeight: '600', color: '#334155' }}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleEditBank(bank._id)} style={{ padding: 8, backgroundColor: '#4F46E5', borderRadius: 8 }}>
                                            <Text style={{ fontWeight: '600', color: '#FFF' }}>Save</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View>
                                        <Text style={styles.expenseTitle}>{bank.name}</Text>
                                        <Text style={styles.expenseAmount}>₹{bank.amount.toFixed(2)}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 15 }}>
                                        <TouchableOpacity onPress={() => {
                                            setEditingBankId(bank._id);
                                            setEditBankName(bank.name);
                                            setEditBankAmount(bank.amount.toString());
                                        }}>
                                            <Ionicons name="pencil" size={20} color="#4F46E5" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDeleteBank(bank._id)}>
                                            <Ionicons name="trash" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyText}>No banks added yet</Text>
                )}
                
                <View style={{ marginTop: 15 }}>
                    <Text style={{ fontWeight: '600', marginBottom: 10, color: '#334155' }}>Add New Bank</Text>
                    <View style={styles.passwordContainer}>
                        <TextInput 
                            style={styles.passwordInput} 
                            placeholder="Bank Name" 
                            placeholderTextColor="#94A3B8"
                            value={newBankName}
                            onChangeText={setNewBankName}
                        />
                    </View>
                    <View style={styles.passwordContainer}>
                        <TextInput 
                            style={styles.passwordInput} 
                            placeholder="Initial Amount" 
                            placeholderTextColor="#94A3B8"
                            value={newBankAmount}
                            onChangeText={setNewBankAmount}
                            keyboardType="numeric"
                        />
                    </View>
                    <TouchableOpacity 
                        style={[styles.updateBtn, isAddingBank && styles.updateBtnDisabled]} 
                        onPress={handleAddBank}
                        disabled={isAddingBank}
                    >
                        {isAddingBank ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text style={styles.updateBtnText}>Add Bank</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Monthly Report */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Monthly Report</Text>
                
                <View style={styles.pickerRow}>
                    <TouchableOpacity 
                        style={styles.pickerBtn}
                        onPress={() => {
                            let m = selectedMonth - 1;
                            let y = selectedYear;
                            if(m < 1) { m = 12; y--; }
                            setSelectedMonth(m);
                            setSelectedYear(y);
                        }}
                    >
                        <Ionicons name="chevron-back" size={24} color="#4F46E5" />
                    </TouchableOpacity>
                    <Text style={styles.pickerText}>{MONTHS[selectedMonth-1].label} {selectedYear}</Text>
                    <TouchableOpacity 
                        style={styles.pickerBtn}
                        onPress={() => {
                            let m = selectedMonth + 1;
                            let y = selectedYear;
                            if(m > 12) { m = 1; y++; }
                            setSelectedMonth(m);
                            setSelectedYear(y);
                        }}
                    >
                        <Ionicons name="chevron-forward" size={24} color="#4F46E5" />
                    </TouchableOpacity>
                </View>

                <View style={styles.reportTotalBox}>
                    <Text style={styles.reportTotalLabel}>Total Expenses</Text>
                    <Text style={styles.reportTotalAmount}>₹{filteredTotal.toFixed(2)}</Text>
                </View>

                {filteredExpenses.length > 0 ? (
                    filteredExpenses.map((item) => (
                        <View key={item._id} style={styles.expenseItem}>
                            <View>
                                <Text style={styles.expenseTitle}>{item.title}</Text>
                                <Text style={styles.expenseDate}>{new Date(item.date).toLocaleDateString()}</Text>
                            </View>
                            <Text style={styles.expenseAmount}>₹{item.amount.toFixed(2)}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyText}>No expenses this month</Text>
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F7FC', padding: 20 },
    card: { 
        backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, marginBottom: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
        borderWidth: 1, borderColor: '#E2E8F0'
    },
    profileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    profileHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    profileInfo: { marginLeft: 15, flex: 1 },
    username: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
    email: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    logoutBtn: { backgroundColor: '#FEE2E2', padding: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 15 },
    passwordContainer: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, 
        borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 15 
    },
    passwordInput: { flex: 1, height: 50, paddingHorizontal: 15, fontSize: 15 },
    eyeIcon: { padding: 15 },
    updateBtn: { backgroundColor: '#4F46E5', padding: 15, borderRadius: 12, alignItems: 'center' },
    updateBtnDisabled: { backgroundColor: '#818CF8' },
    updateBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },

    pickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 5 },
    pickerBtn: { padding: 10 },
    pickerText: { fontSize: 16, fontWeight: '700', color: '#334155' },
    reportTotalBox: { alignItems: 'center', backgroundColor: '#4F46E5', padding: 20, borderRadius: 12, marginBottom: 20 },
    reportTotalLabel: { color: '#E0E7FF', fontSize: 14, fontWeight: '500', marginBottom: 5 },
    reportTotalAmount: { color: '#FFFFFF', fontSize: 32, fontWeight: '800' },
    
    expenseItem: { 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
        backgroundColor: '#FFFFFF', paddingVertical: 15, paddingHorizontal: 10,
        borderBottomWidth: 1, borderBottomColor: '#E2E8F0'
    },
    expenseTitle: { fontSize: 16, fontWeight: '600', color: '#334155' },
    expenseDate: { fontSize: 12, color: '#64748B', marginTop: 3 },
    expenseAmount: { fontSize: 16, fontWeight: '700', color: '#EF4444' },
    emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 10, fontStyle: 'italic' }
});

export default ProfileScreen;
