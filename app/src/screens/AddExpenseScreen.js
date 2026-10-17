import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal, DeviceEventEmitter } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import uuid from 'react-native-uuid';
import { SyncService } from '../services/SyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/expenses`;
const AUTH_URL = `${API_BASE_URL}/auth`;

const CATEGORIES = ['Food', 'Shopping', 'Bills', 'Entertainment', 'Transport', 'Other'];

const getCategoryIcon = (category) => {
    switch(category?.toLowerCase()) {
        case 'food': return 'restaurant-outline';
        case 'shopping': return 'cart-outline';
        case 'bills': return 'receipt-outline';
        case 'entertainment': return 'play-outline';
        case 'transport': return 'car-outline';
        default: return 'grid-outline';
    }
};

const getCategoryColor = (category) => {
    switch(category?.toLowerCase()) {
        case 'food': return '#FF6B6B';
        case 'shopping': return '#6C5CE7';
        case 'bills': return '#20BF6B';
        case 'entertainment': return '#F59E0B';
        case 'transport': return '#0EA5E9';
        default: return '#94A3B8';
    }
};

const AddExpenseScreen = ({ navigation, route }) => {
    const { colors, isDark } = useTheme();
    const expenseToEdit = route.params?.expense;
    const prefilledTitle = route.params?.prefilledTitle;
    
    const [title, setTitle] = useState(expenseToEdit ? expenseToEdit.title : (prefilledTitle || ''));
    const [amount, setAmount] = useState(expenseToEdit ? expenseToEdit.amount.toString() : '');
    const [date, setDate] = useState(expenseToEdit ? new Date(expenseToEdit.date) : new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    
    const [category, setCategory] = useState(expenseToEdit?.category || 'Other');
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    
    const [banks, setBanks] = useState([]);
    const [selectedBankId, setSelectedBankId] = useState(expenseToEdit ? expenseToEdit.bankId : null);
    const [showDropdown, setShowDropdown] = useState(false);

    const insets = useSafeAreaInsets();

    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    useFocusEffect(
        useCallback(() => {
            const fetchProfile = async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    if (!token) return;

                    // Immediately populate from cache so bank dropdown appears instantly
                    const cachedUser = await AsyncStorage.getItem('cached_user');
                    if (cachedUser) {
                        const parsedUser = JSON.parse(cachedUser);
                        if (parsedUser && Array.isArray(parsedUser.banks) && parsedUser.banks.length > 0) {
                            setBanks(parsedUser.banks);
                            if (parsedUser.banks.length === 1 && !expenseToEdit) {
                                setSelectedBankId(parsedUser.banks[0]._id);
                            }
                        }
                    }

                    // Fresh fetch when online
                    const netState = await NetInfo.fetch();
                    if (netState.isConnected) {
                        const res = await axios.get(`${AUTH_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
                        const userData = res.data;
                        if (userData && Array.isArray(userData.banks)) {
                            setBanks(userData.banks);
                            if (userData.banks.length === 1 && !expenseToEdit) {
                                setSelectedBankId(userData.banks[0]._id);
                            }
                            await AsyncStorage.setItem('cached_user', JSON.stringify(userData));
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch profile/banks in AddExpense:', error);
                    // If token expired/invalid, clear it and redirect to login
                    if (error?.response?.status === 401 || error?.response?.status === 403) {
                        await AsyncStorage.removeItem('token');
                        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                    }
                }
            };
            fetchProfile();
        }, [expenseToEdit, navigation])
    );

    const handleSave = async () => {
        if (!title || !amount) {
            Alert.alert('Error', 'Please enter title and amount');
            return;
        }

        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return Alert.alert('Error', 'No authentication token found');

            const expenseData = {
                title,
                amount: parseFloat(amount),
                date: date.toISOString(),
                bankId: selectedBankId,
                category
            };

            const expDate = new Date(expenseData.date);
            const year = expDate.getFullYear();
            const month = expDate.getMonth() + 1;

            const cachedExpsStr = await AsyncStorage.getItem(`cached_home_expenses_${year}_${month}`);
            let cachedExps = cachedExpsStr ? JSON.parse(cachedExpsStr) : [];
            const cachedTotalStr = await AsyncStorage.getItem(`cached_home_total_${year}_${month}`);
            let cachedTotal = cachedTotalStr ? parseFloat(cachedTotalStr) : 0;
            
            const cacheExpenseData = { ...expenseData };
            if (expenseToEdit) {
                cacheExpenseData._id = expenseToEdit._id;
                const index = cachedExps.findIndex(e => e._id === expenseToEdit._id);
                if (index !== -1) {
                    cachedTotal -= cachedExps[index].amount;
                    cachedExps[index] = { ...cachedExps[index], ...cacheExpenseData };
                    cachedTotal += expenseData.amount;
                }
            } else {
                cacheExpenseData._id = uuid.v4(); 
                cachedExps.unshift(cacheExpenseData);
                cachedTotal += expenseData.amount;
            }

            await AsyncStorage.setItem(`cached_home_expenses_${year}_${month}`, JSON.stringify(cachedExps));
            await AsyncStorage.setItem(`cached_home_total_${year}_${month}`, JSON.stringify(cachedTotal));

            const netState = await NetInfo.fetch();
            if (netState.isConnected) {
                // Fire network request, but if connection dropped in between, enqueue it
                if (expenseToEdit) {
                    axios.put(`${API_URL}/${expenseToEdit._id}`, expenseData, {
                        headers: { Authorization: `Bearer ${token}` }
                    }).then(() => SyncService.processQueue()).catch(async (err) => {
                        console.error('Failed to update online, adding to offline queue:', err);
                        await SyncService.addToQueue({
                            type: 'EDIT_EXPENSE',
                            expenseId: expenseToEdit._id,
                            data: expenseData
                        });
                    });
                } else {
                    axios.post(API_URL, expenseData, {
                        headers: { Authorization: `Bearer ${token}` }
                    }).then(() => SyncService.processQueue()).catch(async (err) => {
                        console.error('Failed to post online, adding to offline queue:', err);
                        await SyncService.addToQueue({
                            type: 'ADD_EXPENSE',
                            localId: cacheExpenseData._id,
                            data: expenseData
                        });
                    });
                }
            } else {
                // Queue for sync when OFFLINE
                await SyncService.addToQueue({
                    type: expenseToEdit ? 'EDIT_EXPENSE' : 'ADD_EXPENSE',
                    expenseId: expenseToEdit ? expenseToEdit._id : undefined,
                    localId: expenseToEdit ? undefined : cacheExpenseData._id,
                    data: expenseData
                });
            }
            
            DeviceEventEmitter.emit('expenseUpdated', cacheExpenseData);
            DeviceEventEmitter.emit('bankUpdated');
            
            if (navigation.canGoBack()) {
                navigation.goBack();
            } else {
                navigation.navigate('Home');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to save expense');
        }
    };

    return (
        <KeyboardAwareScrollView 
            style={[styles.container, { backgroundColor: colors.background }]} 
            contentContainerStyle={{ paddingBottom: 120, paddingTop: Math.max(insets.top + 10, 20) }} 
            keyboardShouldPersistTaps="handled"
            enableOnAndroid={true}
            extraScrollHeight={Platform.OS === 'ios' ? 80 : 120}
            extraHeight={120}
            enableAutomaticScroll={true}
            showsVerticalScrollIndicator={false}
        >
            {/* Custom Header */}
            <View style={styles.headerTitleRow}>
                <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')} style={{ padding: 5, marginRight: 10 }}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitleText, { color: colors.text }]}>{expenseToEdit ? 'Edit Expense' : 'Add Expense'}</Text>
            </View>

            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: isDark ? 1 : 0 }]}>
                <View style={styles.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={[styles.sectionIconBox, { backgroundColor: colors.primaryLight }]}>
                            <Ionicons name="receipt" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.sectionTitles}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Expense Details</Text>
                            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Enter transaction info</Text>
                        </View>
                    </View>
                    
                    <TouchableOpacity 
                        style={[styles.headerDatePicker, { backgroundColor: colors.primaryLight }]} 
                        onPress={() => setShowDatePicker(true)}
                    >
                        <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                        <Text style={[styles.headerDateText, { color: colors.primary }]}>
                            {date.toLocaleDateString('default', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Title */}
                <Text style={[styles.label, { color: colors.text }]}>Title</Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <Ionicons name="pricetag-outline" size={18} color={colors.textSecondary} style={styles.inputLeftIcon} />
                    <TextInput 
                        style={[styles.input, { color: colors.text }]} 
                        placeholder="e.g. Starbucks, Rent" 
                        placeholderTextColor={colors.textMuted}
                        value={title}
                        onChangeText={setTitle}
                    />
                </View>
                
                {/* Amount */}
                <Text style={[styles.label, { color: colors.text }]}>Amount (₹)</Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <Ionicons name="wallet-outline" size={18} color={colors.textSecondary} style={styles.inputLeftIcon} />
                    <TextInput 
                        style={[styles.input, { color: colors.text }]} 
                        placeholder="0.00" 
                        placeholderTextColor={colors.textMuted}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                    />
                </View>

                {showDatePicker && (
                    <Modal
                        visible={showDatePicker}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={() => setShowDatePicker(false)}
                    >
                        <View style={styles.modalOverlay}>
                            <View style={[styles.calendarContainer, { backgroundColor: colors.card }]}>
                                <Calendar
                                    current={date.toISOString()}
                                    onDayPress={(day) => {
                                        setDate(new Date(day.timestamp));
                                        setShowDatePicker(false);
                                    }}
                                    markedDates={{
                                        [date.toISOString().split('T')[0]]: {
                                            selected: true,
                                            selectedColor: colors.primary,
                                            selectedTextColor: '#ffffff'
                                        }
                                    }}
                                    theme={{
                                        backgroundColor: colors.card,
                                        calendarBackground: colors.card,
                                        textSectionTitleColor: colors.textSecondary,
                                        selectedDayBackgroundColor: colors.primary,
                                        selectedDayTextColor: '#ffffff',
                                        todayTextColor: colors.primary,
                                        dayTextColor: colors.text,
                                        textDisabledColor: colors.textMuted,
                                        arrowColor: colors.primary,
                                        monthTextColor: colors.text,
                                        textMonthFontWeight: '800',
                                    }}
                                />
                                <TouchableOpacity style={[styles.closeCalendarBtn, { backgroundColor: colors.inputBg }]} onPress={() => setShowDatePicker(false)}>
                                    <Text style={[styles.closeCalendarText, { color: colors.textSecondary }]}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                )}

                {/* Category */}
                <View style={{ zIndex: 20, marginBottom: showCategoryDropdown ? 10 : 0 }}>
                    <Text style={[styles.label, { color: colors.text }]}>Category</Text>
                    <TouchableOpacity style={[styles.datePickerButton, { backgroundColor: colors.inputBg, borderColor: colors.border, marginBottom: showCategoryDropdown ? 10 : 20 }]} onPress={() => { setShowCategoryDropdown(!showCategoryDropdown); setShowDropdown(false); }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name={getCategoryIcon(category)} size={18} color={getCategoryColor(category)} style={styles.inputLeftIcon} />
                                <Text style={[styles.datePickerText, { color: colors.text }]}>{category}</Text>
                            </View>
                            <Ionicons name={showCategoryDropdown ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} style={{ marginRight: 15 }} />
                        </TouchableOpacity>
                        {showCategoryDropdown && (
                            <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <ScrollView nestedScrollEnabled={true}>
                                    {CATEGORIES.map(cat => (
                                        <TouchableOpacity 
                                            key={cat} 
                                            style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                                            onPress={() => {
                                                setCategory(cat);
                                                setShowCategoryDropdown(false);
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Ionicons name={getCategoryIcon(cat)} size={18} color={getCategoryColor(cat)} style={{ marginRight: 10 }} />
                                                <Text style={[styles.dropdownItemText, { color: colors.text }, category === cat && { fontWeight: '700', color: colors.primary }]}>{cat}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                </View>

                {/* Bank */}
                {banks.length > 0 && (
                    <View style={{ zIndex: 10 }}>
                        <Text style={[styles.label, { color: colors.text }]}>Paid From Bank</Text>
                        {banks.length === 1 ? (
                            <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                <Ionicons name="business-outline" size={18} color={colors.textSecondary} style={styles.inputLeftIcon} />
                                <Text style={[styles.staticInputText, { color: colors.text }]}>{banks[0].name}</Text>
                            </View>
                        ) : (
                            <View>
                                <TouchableOpacity style={[styles.datePickerButton, { backgroundColor: colors.inputBg, borderColor: colors.border, marginBottom: showDropdown ? 10 : 20 }]} onPress={() => { setShowDropdown(!showDropdown); setShowCategoryDropdown(false); }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="business-outline" size={18} color={colors.textSecondary} style={styles.inputLeftIcon} />
                                        <Text style={[styles.datePickerText, { color: selectedBankId ? colors.text : colors.textMuted }]}>
                                            {selectedBankId ? banks.find(b => b._id === selectedBankId)?.name : 'Select a bank...'}
                                        </Text>
                                    </View>
                                    <Ionicons name={showDropdown ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} style={{ marginRight: 15 }} />
                                </TouchableOpacity>
                                {showDropdown && (
                                    <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                        <ScrollView nestedScrollEnabled={true}>
                                            {banks.map(bank => (
                                                <TouchableOpacity 
                                                    key={bank._id} 
                                                    style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                                                    onPress={() => {
                                                        setSelectedBankId(bank._id);
                                                        setShowDropdown(false);
                                                    }}
                                                >
                                                    <Text style={[styles.dropdownItemText, { color: colors.text }, selectedBankId === bank._id && { fontWeight: '700', color: colors.primary }]}>{bank.name}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}

                <TouchableOpacity style={styles.primaryBtn} onPress={handleSave}>
                    <View style={styles.btnContentRow}>
                        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>{expenseToEdit ? 'Update Expense' : 'Save Expense'}</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </KeyboardAwareScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9F9FB', paddingHorizontal: 20 },
    
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 20 },
    headerTitleText: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
    
    sectionCard: { 
        backgroundColor: '#FFFFFF', padding: 22, borderRadius: 24, marginBottom: 20,
        shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25 },
    sectionIconBox: { backgroundColor: '#EEEDFF', width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    sectionTitles: { marginLeft: 15 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    sectionSubtitle: { fontSize: 12, color: '#94A3B8', fontWeight: '500', marginTop: 2 },
    
    headerDatePicker: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEEDFF',
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12
    },
    headerDateText: { fontSize: 12, fontWeight: '700', color: '#4F46E5', marginLeft: 6 },

    label: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 8, marginLeft: 4 },
    inputContainer: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, 
        borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 20 
    },
    inputLeftIcon: { marginLeft: 15, marginRight: 10 },
    input: { flex: 1, height: 55, paddingRight: 15, fontSize: 15, color: '#1E293B', fontWeight: '600' },
    staticInputText: { flex: 1, lineHeight: 55, fontSize: 15, color: '#1E293B', fontWeight: '600' },
    
    datePickerButton: {
        height: 55, backgroundColor: '#F8FAFC', borderRadius: 16, 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 20
    },
    datePickerText: { fontSize: 15, color: '#1E293B', fontWeight: '600' },
    
    dropdownMenu: {
        backgroundColor: '#FFFFFF', 
        borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0',
        shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
        maxHeight: 180, overflow: 'hidden', marginBottom: 20
    },
    dropdownItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    dropdownItemText: { fontSize: 15, color: '#334155', fontWeight: '500' },
    
    primaryBtn: { backgroundColor: '#4F46E5', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
    btnContentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    primaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center' },
    calendarContainer: { width: '90%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 15 },
    closeCalendarBtn: { marginTop: 15, paddingVertical: 12, backgroundColor: '#F1F5F9', borderRadius: 12, alignItems: 'center' },
    closeCalendarText: { color: '#64748B', fontWeight: '700', fontSize: 15 }
});

export default AddExpenseScreen;
