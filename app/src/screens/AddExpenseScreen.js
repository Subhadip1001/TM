import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/expenses`;
const AUTH_URL = `${API_BASE_URL}/auth`;


const AddExpenseScreen = ({ navigation, route }) => {
    const expenseToEdit = route.params?.expense;
    const prefilledTitle = route.params?.prefilledTitle;
    
    const [title, setTitle] = useState(expenseToEdit ? expenseToEdit.title : (prefilledTitle || ''));
    const [amount, setAmount] = useState(expenseToEdit ? expenseToEdit.amount.toString() : '');
    const [date, setDate] = useState(expenseToEdit ? new Date(expenseToEdit.date) : new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    
    const [banks, setBanks] = useState([]);
    const [selectedBankId, setSelectedBankId] = useState(expenseToEdit ? expenseToEdit.bankId : null);
    const [showDropdown, setShowDropdown] = useState(false);

    useFocusEffect(
        useCallback(() => {
            const fetchProfile = async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    if (token) {
                        const res = await axios.get(`${AUTH_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
                        if (res.data && res.data.banks) {
                            setBanks(res.data.banks);
                            if (res.data.banks.length === 1 && !expenseToEdit) {
                                setSelectedBankId(res.data.banks[0]._id);
                            }
                        }
                    }
                } catch (error) {
                    console.error(error);
                }
            };
            fetchProfile();
        }, [expenseToEdit])
    );

    const handleSave = async () => {
        if (!title || !amount) {
            Alert.alert('Error', 'Please enter title and amount');
            return;
        }

        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                Alert.alert('Error', 'No authentication token found');
                return;
            }

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            const expenseData = {
                title,
                amount: parseFloat(amount),
                date: date.toISOString(),
                bankId: selectedBankId
            };
            
            if (expenseToEdit) {
                await axios.put(`${API_URL}/${expenseToEdit._id}`, expenseData, config);
            } else {
                await axios.post(API_URL, expenseData, config);
            }
            
            navigation.goBack();
        } catch (error) {
            console.error('Error saving expense:', error.response?.data || error.message);
            Alert.alert('Error', 'Failed to save expense');
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Expense Title</Text>
            <TextInput 
                style={styles.input} 
                placeholder="e.g. Starbucks, Rent" 
                placeholderTextColor="#94A3B8"
                value={title}
                onChangeText={setTitle}
            />
            
            <Text style={styles.label}>Amount (₹)</Text>
            <TextInput 
                style={styles.input} 
                placeholder="0.00" 
                placeholderTextColor="#94A3B8"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
            />

            <Text style={styles.label}>Date</Text>
            <TouchableOpacity 
                style={styles.datePickerButton} 
                onPress={() => setShowDatePicker(true)}
            >
                <Text style={styles.datePickerText}>{date.toLocaleDateString()}</Text>
                <Ionicons name="calendar-outline" size={24} color="#64748B" />
            </TouchableOpacity>

            {showDatePicker && (
                <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) {
                            setDate(selectedDate);
                        }
                    }}
                />
            )}

            {banks.length > 0 && (
                <View style={{ zIndex: 10 }}>
                    <Text style={styles.label}>Paid From Bank</Text>
                    {banks.length === 1 ? (
                        <View style={styles.input}>
                            <Text style={{ lineHeight: 55, color: '#334155', fontSize: 16 }}>{banks[0].name}</Text>
                        </View>
                    ) : (
                        <View style={{ position: 'relative' }}>
                            <TouchableOpacity 
                                style={[styles.input, { justifyContent: 'center' }]} 
                                onPress={() => setShowDropdown(!showDropdown)}
                            >
                                <Text style={{ color: '#334155', fontSize: 16 }}>
                                    {selectedBankId ? banks.find(b => b._id === selectedBankId)?.name : 'Select a bank...'}
                                </Text>
                            </TouchableOpacity>
                            {showDropdown && (
                                <View style={styles.dropdownMenu}>
                                    <ScrollView nestedScrollEnabled={true}>
                                        {banks.map(bank => (
                                            <TouchableOpacity 
                                                key={bank._id} 
                                                style={styles.dropdownItem}
                                                onPress={() => {
                                                    setSelectedBankId(bank._id);
                                                    setShowDropdown(false);
                                                }}
                                            >
                                                <Text style={[styles.dropdownItemText, selectedBankId === bank._id && { fontWeight: '700', color: '#4F46E5' }]}>{bank.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            )}

            <TouchableOpacity style={styles.button} onPress={handleSave}>
                <Text style={styles.buttonText}>{expenseToEdit ? 'Update Expense' : 'Save Expense'}</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 25, backgroundColor: '#F4F7FC' },
    label: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 10, marginTop: 15, letterSpacing: 0.5 },
    input: { 
        height: 55, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 20, 
        borderWidth: 1, borderColor: '#E2E8F0', fontSize: 16, color: '#334155',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
    },
    datePickerButton: {
        height: 55, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 20, 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderWidth: 1, borderColor: '#E2E8F0',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
    },
    datePickerText: { fontSize: 16, color: '#334155' },
    dropdownMenu: {
        position: 'absolute', top: 60, left: 0, right: 0, backgroundColor: '#FFF', 
        borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', zIndex: 100,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 5,
        maxHeight: 150
    },
    dropdownItem: {
        padding: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9'
    },
    dropdownItemText: { fontSize: 16, color: '#334155' },
    button: { 
        backgroundColor: '#4F46E5', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 35,
        shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5
    },
    buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 }
});

export default AddExpenseScreen;
