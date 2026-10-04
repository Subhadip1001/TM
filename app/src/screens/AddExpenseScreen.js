import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useShareIntent } from 'expo-share-intent';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/expenses`;


const AddExpenseScreen = ({ navigation, route }) => {
    const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
    const expenseToEdit = route.params?.expense;
    const [title, setTitle] = useState(expenseToEdit ? expenseToEdit.title : '');
    const [amount, setAmount] = useState(expenseToEdit ? expenseToEdit.amount.toString() : '');
    const [date, setDate] = useState(expenseToEdit ? new Date(expenseToEdit.date) : new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    useEffect(() => {
        // Automatically populate if opened via share extension (e.g., sharing "Paid ₹50 for Starbucks")
        if (hasShareIntent && shareIntent.value) {
            const sharedText = shareIntent.value;
            // A simple logic to parse name and amount from text
            const amountMatch = sharedText.match(/\$?\d+(\.\d{2})?/);
            if (amountMatch) {
                setAmount(amountMatch[0].replace('₹', ''));
            }
            setTitle(sharedText);
            resetShareIntent();
        }
    }, [hasShareIntent, shareIntent]);

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
                date: date.toISOString()
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
                value={title}
                onChangeText={setTitle}
            />
            
            <Text style={styles.label}>Amount (₹)</Text>
            <TextInput 
                style={styles.input} 
                placeholder="0.00" 
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
    button: { 
        backgroundColor: '#4F46E5', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 35,
        shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5
    },
    buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 }
});

export default AddExpenseScreen;
