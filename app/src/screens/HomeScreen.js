import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, LayoutAnimation, UIManager, Platform } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { SyncService } from '../services/SyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/expenses`;

const getCategoryIcon = (category) => {
    switch(category?.toLowerCase()) {
        case 'food': return { bg: '#FFF0F0', color: '#FF6B6B', name: 'restaurant-outline' };
        case 'shopping': return { bg: '#F0F0FF', color: '#6C5CE7', name: 'cart-outline' };
        case 'bills': return { bg: '#E6F9F0', color: '#20BF6B', name: 'receipt-outline' };
        case 'entertainment': return { bg: '#FFF6E5', color: '#F59E0B', name: 'play-outline' };
        case 'transport': return { bg: '#E0F2FE', color: '#0EA5E9', name: 'car-outline' };
        default: return { bg: '#F1F5F9', color: '#64748B', name: 'wallet-outline' }; // Other
    }
};

const MONTHS = [
    { label: 'Jan', value: 1 }, { label: 'Feb', value: 2 }, { label: 'Mar', value: 3 },
    { label: 'Apr', value: 4 }, { label: 'May', value: 5 }, { label: 'Jun', value: 6 },
    { label: 'Jul', value: 7 }, { label: 'Aug', value: 8 }, { label: 'Sep', value: 9 },
    { label: 'Oct', value: 10 }, { label: 'Nov', value: 11 }, { label: 'Dec', value: 12 }
];

const HomeScreen = ({ navigation }) => {
    const [monthlyTotal, setMonthlyTotal] = useState(0);
    const [expenses, setExpenses] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const insets = useSafeAreaInsets();

    const fetchData = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const cachedExps = await AsyncStorage.getItem(`cached_home_expenses_${currentYear}_${currentMonth}`);
            if (cachedExps) {
                setExpenses(JSON.parse(cachedExps));
            } else {
                setExpenses([]);
            }
            
            const cachedTotal = await AsyncStorage.getItem(`cached_home_total_${currentYear}_${currentMonth}`);
            if (cachedTotal) {
                setMonthlyTotal(JSON.parse(cachedTotal));
            } else {
                setMonthlyTotal(0);
            }

            const netState = await NetInfo.fetch();
            if (netState.isConnected) {
                await SyncService.processQueue();
                const config = { headers: { Authorization: `Bearer ${token}` } };
                
                const res = await axios.get(`${API_URL}/filter/${currentYear}/${currentMonth}`, config);
                
                setExpenses(res.data.expenses);
                setMonthlyTotal(res.data.total || 0);
                await AsyncStorage.setItem(`cached_home_expenses_${currentYear}_${currentMonth}`, JSON.stringify(res.data.expenses));
                await AsyncStorage.setItem(`cached_home_total_${currentYear}_${currentMonth}`, JSON.stringify(res.data.total || 0));
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    useFocusEffect(useCallback(() => { 
        setExpandedId(null);
        fetchData(); 
    }, []));

    const handleDelete = async (id) => {
        Alert.alert('Delete Expense', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
                        // Optimistically remove from UI instantly
                        const updatedExps = expenses.filter(e => e._id !== id);
                        setExpenses(updatedExps);
                        await AsyncStorage.setItem(`cached_home_expenses_${currentYear}_${currentMonth}`, JSON.stringify(updatedExps));

                        const deletedExpense = expenses.find(e => e._id === id);
                        if (deletedExpense) {
                            const newTotal = monthlyTotal - deletedExpense.amount;
                            setMonthlyTotal(newTotal);
                            await AsyncStorage.setItem(`cached_home_total_${currentYear}_${currentMonth}`, JSON.stringify(newTotal));
                        }
                        
                        const token = await AsyncStorage.getItem('token');
                        const netState = await NetInfo.fetch();
                        if (netState.isConnected) {
                            // Fire and forget
                            axios.delete(`${API_URL}/${id}`, { headers: { Authorization: `Bearer ${token}` } })
                                .then(() => fetchData()) // refresh silently in background
                                .catch(e => console.error(e));
                        } else {
                            await SyncService.addToQueue({ type: 'DELETE_EXPENSE', expenseId: id });
                        }
                    } catch (error) { console.error(error); }
                }
            }
        ]);
    };

    const renderItem = ({ item }) => {
        const isExpanded = expandedId === item._id;
        const iconConfig = getCategoryIcon(item.category);

        return (
            <View>
                <TouchableOpacity
                    style={styles.expenseItem}
                    onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setExpandedId(isExpanded ? null : item._id);
                    }}
                    activeOpacity={0.8}
                >
                    <View style={styles.expenseMain}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <View style={[styles.iconCircle, { backgroundColor: iconConfig.bg }]}>
                                <Ionicons name={iconConfig.name} size={24} color={iconConfig.color} />
                            </View>
                            <View style={{ marginLeft: 15, flex: 1 }}>
                                <Text style={styles.expenseTitle} numberOfLines={1}>{item.title}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                    <Ionicons name="calendar-outline" size={12} color="#A0AEC0" />
                                    <Text style={styles.expenseDate}> {new Date(item.date).toLocaleDateString()}</Text>
                                </View>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={styles.amountPill}>
                                <Text style={styles.expenseAmount}>₹{item.amount.toFixed(2)}</Text>
                            </View>
                            
                            {!isExpanded ? (
                                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" style={{ marginLeft: 5 }} />
                            ) : (
                                <View style={{ flexDirection: 'row', marginLeft: 10, gap: 8 }}>
                                    <TouchableOpacity style={[styles.actionBtnSmall, { backgroundColor: '#EEEDFF' }]} onPress={() => { setExpandedId(null); navigation.navigate('AddExpense', { expense: item }); }}>
                                        <Ionicons name="create-outline" size={16} color="#4F46E5" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.actionBtnSmall, { backgroundColor: '#FFF0F0' }]} onPress={() => handleDelete(item._id)}>
                                        <Ionicons name="trash-outline" size={16} color="#FF4757" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header Card */}
            <LinearGradient
                colors={['#4F46E5', '#3B2E9E']}
                style={[styles.headerCard, { marginTop: Math.max(insets.top + 10, 40), overflow: 'hidden' }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <Ionicons 
                    name="wallet" 
                    size={160} 
                    color="rgba(255, 255, 255, 0.6)" 
                    style={{ position: 'absolute', right: -30, bottom: -30, transform: [{ rotate: '-15deg' }] }} 
                />
                <View style={[styles.headerTopRow, { zIndex: 1 }]}>
                    <View style={styles.walletIconBox}>
                        <Ionicons name="wallet" size={22} color="#4F46E5" />
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.profileBox}>
                        <Ionicons name="person" size={20} color="#4F46E5" />
                    </TouchableOpacity>
                </View>

                <Text style={[styles.headerSubtitle, { zIndex: 1 }]}>Total Expenses</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, zIndex: 1 }}>
                    <Ionicons name="calendar-outline" size={12} color="#C7D2FE" />
                    <Text style={styles.headerDate}> {MONTHS[currentMonth-1].label} {currentYear}</Text>
                </View>

                <Text style={[styles.headerTitle, { zIndex: 1 }]}>₹{monthlyTotal.toFixed(2)}</Text>

                <View style={[styles.headerBottomRow, { zIndex: 1 }]}>
                    <View style={styles.tagPill}>
                        <Ionicons name="trending-up" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.tagText}>Track your spending • Stay in control</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* List Header */}
            <View style={styles.listHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.listIconBox}>
                        <Ionicons name="receipt" size={20} color="#4F46E5" />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                        <Text style={styles.listHeaderTitle}>Recent Expenses</Text>
                        <Text style={styles.listHeaderSubtitle}>Your latest transactions</Text>
                    </View>
                </View>
            </View>

            {/* Expenses List */}
            <FlatList
                data={expenses}
                keyExtractor={item => item._id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            />

            {/* FAB */}
            <TouchableOpacity
                style={[styles.fab, { bottom: Math.max(insets.bottom + 25, 35) }]}
                onPress={() => navigation.navigate('AddExpense')}
                activeOpacity={0.9}
            >
                <Ionicons name="add" size={36} color="#FFFFFF" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    // Header
    headerCard: {
        marginHorizontal: 12,
        borderRadius: 30,
        padding: 16,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    walletIconBox: { backgroundColor: '#FFFFFF', padding: 8, borderRadius: 12 },
    profileBox: { backgroundColor: '#C7D2FE', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    headerSubtitle: { color: '#E0E7FF', fontSize: 16, fontWeight: '700', marginBottom: 0 },
    headerDate: { color: '#C7D2FE', fontSize: 12, fontWeight: '600' },
    headerTitle: { color: '#FFFFFF', fontSize: 40, fontWeight: '900', letterSpacing: -1, marginVertical: 0 },
    headerBottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    tagPill: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 20, flexDirection: 'row', alignItems: 'center'
    },
    tagText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

    // List Header
    listHeaderRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 12, marginTop: 30, marginBottom: 20
    },
    listIconBox: { backgroundColor: '#EEEDFF', padding: 12, borderRadius: 12 },
    listHeaderTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
    listHeaderSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '500', marginTop: 2 },

    // Expense Item
    expenseItem: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        marginBottom: 16,
        paddingVertical: 18,
        paddingHorizontal: 16,
        shadowColor: '#94A3B8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    expenseMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    expenseTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    expenseDate: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
    amountPill: { backgroundColor: '#FFF0F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    expenseAmount: { fontSize: 15, fontWeight: '900', color: '#FF4757' },

    // Action Row
    actionBtnSmall: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },

    // FAB
    fab: {
        position: 'absolute', right: 30, width: 70, height: 70, borderRadius: 35,
        backgroundColor: '#4834D4', justifyContent: 'center', alignItems: 'center',
        shadowColor: '#4834D4', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 10
    }
});

export default HomeScreen;
