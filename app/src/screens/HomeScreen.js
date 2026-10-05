import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/expenses`;


const HomeScreen = ({ navigation }) => {
    const [monthlyTotal, setMonthlyTotal] = useState(0);
    const [expenses, setExpenses] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const insets = useSafeAreaInsets();

    const fetchData = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            const expensesRes = await axios.get(API_URL, config);
            setExpenses(expensesRes.data);

            const monthlyRes = await axios.get(`${API_URL}/monthly`, config);
            setMonthlyTotal(monthlyRes.data.total || 0);

        } catch (error) {
            console.error('Error fetching data:', error.response?.data || error.message);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const handleDelete = async (id) => {
        Alert.alert('Delete Expense', 'Are you sure you want to delete this expense?', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', 
                style: 'destructive',
                onPress: async () => {
                    try {
                        const token = await AsyncStorage.getItem('token');
                        await axios.delete(`${API_URL}/${id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        fetchData();
                    } catch (error) {
                        console.error('Delete error:', error);
                        Alert.alert('Error', 'Failed to delete expense');
                    }
                }
            }
        ]);
    };

    const renderItem = ({ item }) => {
        const isExpanded = expandedId === item._id;

        return (
            <TouchableOpacity 
                style={styles.expenseItem} 
                onPress={() => setExpandedId(isExpanded ? null : item._id)}
                activeOpacity={0.8}
            >
                <View style={styles.expenseMain}>
                    <View>
                        <Text style={styles.expenseTitle}>{item.title}</Text>
                        <Text style={styles.expenseDate}>{new Date(item.date).toLocaleDateString()}</Text>
                    </View>
                    <Text style={styles.expenseAmount}>₹{item.amount.toFixed(2)}</Text>
                </View>
                
                {isExpanded && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity 
                            style={[styles.actionBtn, { backgroundColor: '#4F46E5' }]}
                            onPress={() => navigation.navigate('AddExpense', { expense: item })}
                        >
                            <Ionicons name="pencil" size={18} color="#FFF" />
                            <Text style={styles.actionText}>Edit</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[styles.actionBtn, { backgroundColor: '#EF4444' }]}
                            onPress={() => handleDelete(item._id)}
                        >
                            <Ionicons name="trash" size={18} color="#FFF" />
                            <Text style={styles.actionText}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.profileBtn}
                    onPress={() => navigation.navigate('Profile')}
                >
                    <Ionicons name="person-circle" size={36} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerSubtitle}>This Month's Total</Text>
                <Text style={styles.headerTitle}>₹{monthlyTotal.toFixed(2)}</Text>
            </View>
            
            <View style={styles.listContainer}>
                <Text style={styles.listHeader}>Recent Expenses</Text>
                <FlatList
                    data={expenses}
                    keyExtractor={item => item._id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            </View>

            <TouchableOpacity 
                style={[styles.fab, { bottom: Math.max(insets.bottom + 25, 35) }]} 
                onPress={() => navigation.navigate('AddExpense')}
            >
                <Ionicons name="add" size={32} color="#FFFFFF" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F7FC' },
    header: { backgroundColor: '#4F46E5', padding: 35, paddingTop: 80, alignItems: 'center', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
    profileBtn: { position: 'absolute', top: 50, right: 25 },
    headerSubtitle: { color: '#E0E7FF', fontSize: 16, marginBottom: 8, fontWeight: '500', letterSpacing: 0.5 },
    headerTitle: { color: '#FFFFFF', fontSize: 44, fontWeight: '800' },
    listContainer: { flex: 1, padding: 25 },
    listHeader: { fontSize: 22, fontWeight: '700', marginBottom: 20, color: '#1E293B' },
    expenseItem: { 
        backgroundColor: '#FFFFFF', 
        borderRadius: 16, marginBottom: 15, overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
        borderWidth: 1, borderColor: '#E2E8F0'
    },
    expenseMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
    actionRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#E2E8F0', padding: 10, justifyContent: 'space-around', backgroundColor: '#F8FAFC' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8 },
    actionText: { color: '#FFF', fontWeight: '600', marginLeft: 5 },
    expenseTitle: { fontSize: 17, fontWeight: '700', color: '#334155' },
    expenseDate: { fontSize: 13, color: '#64748B', marginTop: 5, fontWeight: '500' },
    expenseAmount: { fontSize: 18, fontWeight: '800', color: '#EF4444' },
    fab: { 
        position: 'absolute', bottom: 35, right: 35, width: 65, height: 65, borderRadius: 32.5, 
        backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center', 
        shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 5, elevation: 6 
    },
    fabIcon: { fontSize: 32, color: '#FFFFFF', fontWeight: 'bold' }
});

export default HomeScreen;
