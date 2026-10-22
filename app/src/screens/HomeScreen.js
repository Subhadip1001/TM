import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
    LayoutAnimation,
    UIManager,
    Platform,
    DeviceEventEmitter,
    Modal,
    TextInput,
    ActivityIndicator,
    Pressable
} from 'react-native';

import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { SyncService } from '../services/SyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../config';
import { triggerHaptic } from '../utils/haptics';

const API_URL = `${API_BASE_URL}/expenses`;

const CATEGORY_COLORS = {
    food: '#FF6B6B',
    shopping: '#6C5CE7',
    bills: '#20BF6B',
    entertainment: '#F59E0B',
    transport: '#0EA5E9',
    other: '#64748B'
};

const getCategoryIcon = (category) => {
    switch(category?.toLowerCase()) {
        case 'food': return { bg: '#FFF0F0', color: CATEGORY_COLORS.food, name: 'restaurant-outline' };
        case 'shopping': return { bg: '#F0F0FF', color: CATEGORY_COLORS.shopping, name: 'cart-outline' };
        case 'bills': return { bg: '#E6F9F0', color: CATEGORY_COLORS.bills, name: 'receipt-outline' };
        case 'entertainment': return { bg: '#FFF6E5', color: CATEGORY_COLORS.entertainment, name: 'play-outline' };
        case 'transport': return { bg: '#E0F2FE', color: CATEGORY_COLORS.transport, name: 'car-outline' };
        default: return { bg: '#F1F5F9', color: CATEGORY_COLORS.other, name: 'wallet-outline' };
    }
};

const MONTHS = [
    { label: 'Jan', value: 1 }, { label: 'Feb', value: 2 }, { label: 'Mar', value: 3 },
    { label: 'Apr', value: 4 }, { label: 'May', value: 5 }, { label: 'Jun', value: 6 },
    { label: 'Jul', value: 7 }, { label: 'Aug', value: 8 }, { label: 'Sep', value: 9 },
    { label: 'Oct', value: 10 }, { label: 'Nov', value: 11 }, { label: 'Dec', value: 12 }
];

const HomeScreen = ({ navigation }) => {
    const { colors, isDark } = useTheme();
    const [monthlyTotal, setMonthlyTotal] = useState(0);
    const [expenses, setExpenses] = useState([]);
    const [expandedId, setExpandedId] = useState(null);

    // Bank state
    const [banks, setBanks] = useState([]);
    const [selectedBankId, setSelectedBankId] = useState(null);
    const [showBankSwitcher, setShowBankSwitcher] = useState(false);
    const [showAddBank, setShowAddBank] = useState(false);
    const [newBankName, setNewBankName] = useState('');
    const [newBankAmount, setNewBankAmount] = useState('');
    const [isSubmittingBank, setIsSubmittingBank] = useState(false);
    
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const insets = useSafeAreaInsets();

    const fetchBanks = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            // Instantly load from cache
            const cachedUserStr = await AsyncStorage.getItem('cached_user');
            let userBanks = [];
            if (cachedUserStr) {
                const cachedUser = JSON.parse(cachedUserStr);
                if (Array.isArray(cachedUser.banks)) {
                    userBanks = cachedUser.banks;
                    setBanks(userBanks);
                }
            }

            const preferredId = await AsyncStorage.getItem('preferred_bank_id');
            if (preferredId && userBanks.some(b => b._id === preferredId)) {
                setSelectedBankId(preferredId);
            } else if (userBanks.length > 0) {
                setSelectedBankId(userBanks[0]._id);
            }

            const netState = await NetInfo.fetch();
            if (netState.isConnected) {
                const res = await axios.get(`${API_BASE_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data) {
                    await AsyncStorage.setItem('cached_user', JSON.stringify(res.data));
                    if (Array.isArray(res.data.banks)) {
                        setBanks(res.data.banks);
                        if (!preferredId || !res.data.banks.some(b => b._id === preferredId)) {
                            if (res.data.banks.length > 0) {
                                setSelectedBankId(res.data.banks[0]._id);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching banks in HomeScreen:', e);
        }
    };

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('expenseUpdated', (updatedExpense) => {
            setExpenses(prev => {
                const newExps = [...prev];
                const idx = newExps.findIndex(e => e._id === updatedExpense._id);
                if (idx !== -1) {
                    newExps[idx] = { ...newExps[idx], ...updatedExpense };
                } else {
                    newExps.unshift(updatedExpense);
                }
                return newExps;
            });
            fetchBanks();
        });

        const syncSub = DeviceEventEmitter.addListener('syncCompleted', () => {
            fetchData();
            fetchBanks();
        });

        const bankSub = DeviceEventEmitter.addListener('bankUpdated', () => {
            fetchBanks();
        });

        return () => {
            sub.remove();
            syncSub.remove();
            bankSub.remove();
        };
    }, []);

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
            if (error?.response?.status === 401 || error?.response?.status === 403) {
                await AsyncStorage.removeItem('token');
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            }
        }
    };

    useFocusEffect(useCallback(() => { 
        setExpandedId(null);
        fetchData(); 
        fetchBanks();
    }, []));

    const handleDelete = async (id) => {
        Alert.alert('Delete Expense', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
                        const targetExp = expenses.find(e => e._id === id);
                        const deletedAmount = targetExp ? Number(targetExp.amount) : 0;
                        const newExps = expenses.filter(e => e._id !== id);
                        const newTotal = Math.max(0, monthlyTotal - deletedAmount);

                        setExpenses(newExps);
                        setMonthlyTotal(newTotal);

                        await AsyncStorage.setItem(`cached_home_expenses_${currentYear}_${currentMonth}`, JSON.stringify(newExps));
                        await AsyncStorage.setItem(`cached_home_total_${currentYear}_${currentMonth}`, JSON.stringify(newTotal));

                        const netState = await NetInfo.fetch();
                        if (netState.isConnected) {
                            const token = await AsyncStorage.getItem('token');
                            await axios.delete(`${API_URL}/${id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                        } else {
                            await SyncService.addToQueue('DELETE', { _id: id });
                        }
                        fetchBanks();
                    } catch (error) {
                        Alert.alert('Error', 'Failed to delete expense');
                        fetchData();
                    }
                }
            }
        ]);
    };

    const handleCreateBank = async () => {
        if (!newBankName.trim() || !newBankAmount.trim()) {
            Alert.alert('Required Fields', 'Please enter both bank name and amount.');
            return;
        }
        const numericAmount = parseFloat(newBankAmount);
        if (isNaN(numericAmount) || numericAmount < 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount.');
            return;
        }

        setIsSubmittingBank(true);
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const res = await axios.post(`${API_BASE_URL}/auth/bank`, {
                name: newBankName.trim(),
                amount: numericAmount,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const updatedBanks = res.data;
            setBanks(updatedBanks);
            
            const newlyAdded = updatedBanks[updatedBanks.length - 1];
            if (newlyAdded) {
                setSelectedBankId(newlyAdded._id);
                await AsyncStorage.setItem('preferred_bank_id', newlyAdded._id);
            }

            const cachedUserStr = await AsyncStorage.getItem('cached_user');
            if (cachedUserStr) {
                const cachedUser = JSON.parse(cachedUserStr);
                cachedUser.banks = updatedBanks;
                await AsyncStorage.setItem('cached_user', JSON.stringify(cachedUser));
            } else {
                try {
                    const meRes = await axios.get(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
                    if (meRes.data) {
                        await AsyncStorage.setItem('cached_user', JSON.stringify(meRes.data));
                    }
                } catch (e) {
                    await AsyncStorage.setItem('cached_user', JSON.stringify({ banks: updatedBanks }));
                }
            }

            DeviceEventEmitter.emit('bankUpdated');

            setNewBankName('');
            setNewBankAmount('');
            setShowAddBank(false);
            Alert.alert('Success', 'Bank account added successfully!');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to add bank account.');
        } finally {
            setIsSubmittingBank(false);
        }
    };

    const activeBank = banks.find(b => b._id === selectedBankId) || banks[0] || null;

    const renderItem = ({ item }) => {
        const cat = getCategoryIcon(item.category);
        const isExpanded = expandedId === item._id;

        return (
            <View style={{ overflow: 'hidden', borderRadius: 24, marginBottom: 12 }}>
                <TouchableOpacity
                    style={[styles.expenseItem, { backgroundColor: colors.card, marginBottom: 0 }]}
                    onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setExpandedId(isExpanded ? null : item._id);
                    }}
                    activeOpacity={0.85}
                >
                    <View style={styles.expenseMain}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <View style={[styles.iconCircle, { backgroundColor: cat.bg }]}>
                                <Ionicons name={cat.name} size={24} color={cat.color} />
                            </View>
                            <View style={{ marginLeft: 14, flex: 1 }}>
                                <Text style={[styles.expenseTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                    <Text style={[styles.expenseDate, { color: colors.textSecondary }]}>
                                        {new Date(item.date).toLocaleDateString('default', { day: 'numeric', month: 'short' })}
                                    </Text>
                                    {item.category ? (
                                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginLeft: 6 }}>
                                            • {item.category}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[styles.amountPill, { backgroundColor: isDark ? 'rgba(255, 71, 87, 0.2)' : '#FFF0F0' }]}>
                                <Text style={styles.expenseAmount}>-₹{Number(item.amount).toFixed(2)}</Text>
                            </View>
                            
                            {!isExpanded ? (
                                <Ionicons name="ellipsis-vertical" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />
                            ) : (
                                <View style={{ flexDirection: 'row', marginLeft: 10, gap: 8 }}>
                                    <TouchableOpacity 
                                        style={[
                                            styles.actionBtnSmall, 
                                            { 
                                                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.18)' : '#EEEDFF',
                                                borderColor: isDark ? 'rgba(99, 102, 241, 0.35)' : '#C7D2FE',
                                                borderWidth: 1
                                            }
                                        ]} 
                                        onPress={() => { 
                                            triggerHaptic('light');
                                            setExpandedId(null); 
                                            navigation.navigate('AddExpense', { expense: item }); 
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="pencil" size={14} color={colors.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[
                                            styles.actionBtnSmall, 
                                            { 
                                                backgroundColor: isDark ? 'rgba(255, 71, 87, 0.18)' : '#FFF0F0',
                                                borderColor: isDark ? 'rgba(255, 71, 87, 0.35)' : '#FECDD3',
                                                borderWidth: 1
                                            }
                                        ]} 
                                        onPress={() => {
                                            triggerHaptic('light');
                                            handleDelete(item._id);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="trash" size={14} color="#FF4757" />
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
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Fixed Header Gradient Card (Does NOT scroll) */}
            <LinearGradient
                colors={['#4F46E5', '#3B2E9E']}
                style={[styles.headerCard, { marginTop: Math.max(insets.top + 6, 24), overflow: 'hidden' }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <Ionicons 
                    name="wallet" 
                    size={160} 
                    color="rgba(255, 255, 255, 0.6)" 
                    style={{ position: 'absolute', right: -30, bottom: -30, transform: [{ rotate: '-15deg' }] }} 
                />
                
                {/* Header Top Row: Wallet on left, Bank balance / Add Bank on right */}
                <View style={[styles.headerTopRow, { zIndex: 1 }]}>
                    <View style={styles.walletIconBox}>
                        <Ionicons name="wallet" size={22} color="#4F46E5" />
                    </View>

                    {banks.length === 0 ? (
                        <TouchableOpacity
                            onPress={() => setShowAddBank(true)}
                            style={styles.addBankHeaderBtn}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.addBankHeaderBtnText}>Add Bank</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={() => setShowBankSwitcher(true)}
                            style={styles.bankBalanceHeaderPill}
                            activeOpacity={0.8}
                        >
                            <View style={styles.bankHeaderIconWrap}>
                                <Ionicons name="business" size={12} color="#FFFFFF" />
                            </View>
                            <View style={{ maxWidth: 110 }}>
                                <Text style={styles.bankHeaderName} numberOfLines={1}>
                                    {activeBank?.name || 'Bank'}
                                </Text>
                                <Text style={styles.bankHeaderBalance} numberOfLines={1}>
                                    ₹{Number(activeBank?.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </Text>
                            </View>
                            {banks.length > 1 ? (
                                <Ionicons name="chevron-down" size={13} color="#C7D2FE" style={{ marginLeft: 4 }} />
                            ) : (
                                <Ionicons name="add" size={14} color="#C7D2FE" style={{ marginLeft: 4 }} />
                            )}
                        </TouchableOpacity>
                    )}
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

            {/* Fixed Recent Expenses Header (Does NOT scroll) */}
            <View style={styles.listHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.listIconBox, { backgroundColor: colors.primaryLight }]}>
                        <Ionicons name="receipt" size={20} color={colors.primary} />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                        <Text style={[styles.listHeaderTitle, { color: colors.text }]}>Recent Expenses</Text>
                        <Text style={[styles.listHeaderSubtitle, { color: colors.textSecondary }]}>Your latest transactions</Text>
                    </View>
                </View>
            </View>

            {/* Scrollable Expenses List (ONLY expenses scroll) */}
            <FlatList
                data={expenses}
                keyExtractor={item => item._id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 84 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="receipt-outline" size={48} color={colors.textSecondary} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>No expenses found</Text>
                        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Tap the '+' button below to add your first expense</Text>
                    </View>
                }
            />

            {/* WhatsApp-style FAB for Adding Expenses */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('AddExpense')}
                activeOpacity={0.85}
            >
                <Ionicons name="add" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Bank Switcher Modal */}
            <Modal
                visible={showBankSwitcher}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowBankSwitcher(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowBankSwitcher(false)}
                >
                    <Pressable
                        style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={e => e.stopPropagation()}
                    >
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Bank Accounts</Text>
                                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                                    Choose bank balance to display on Home
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowBankSwitcher(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ maxHeight: 260, marginVertical: 8 }}>
                            <FlatList
                                data={banks}
                                keyExtractor={item => item._id}
                                renderItem={({ item }) => {
                                    const isSelected = item._id === activeBank?._id;
                                    return (
                                        <TouchableOpacity
                                            style={[
                                                styles.bankOptionRow,
                                                { borderColor: isSelected ? colors.primary : colors.border },
                                                isSelected && { backgroundColor: isDark ? 'rgba(79, 70, 229, 0.18)' : '#EEEDFF' }
                                            ]}
                                            onPress={async () => {
                                                setSelectedBankId(item._id);
                                                await AsyncStorage.setItem('preferred_bank_id', item._id);
                                                setShowBankSwitcher(false);
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[styles.bankOptionIcon, { backgroundColor: isSelected ? colors.primary : (isDark ? '#334155' : '#F1F5F9') }]}>
                                                <Ionicons name="business" size={16} color={isSelected ? '#FFFFFF' : colors.textSecondary} />
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <Text style={[styles.bankOptionName, { color: colors.text, fontWeight: isSelected ? '700' : '600' }]} numberOfLines={1}>
                                                    {item.name}
                                                </Text>
                                                <Text style={[styles.bankOptionAmount, { color: isSelected ? colors.primary : colors.textSecondary }]}>
                                                    ₹{Number(item.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                                </Text>
                                            </View>
                                            <Ionicons
                                                name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                                                size={20}
                                                color={isSelected ? colors.primary : colors.textSecondary}
                                            />
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.addAnotherBankBtn, { borderColor: colors.primary }]}
                            onPress={() => {
                                setShowBankSwitcher(false);
                                setTimeout(() => setShowAddBank(true), 200);
                            }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add-circle-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
                            <Text style={[styles.addAnotherBankBtnText, { color: colors.primary }]}>Add Another Bank</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Add Bank Modal */}
            <Modal
                visible={showAddBank}
                transparent={true}
                animationType="fade"
                onRequestClose={() => { if (!isSubmittingBank) setShowAddBank(false); }}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => { if (!isSubmittingBank) setShowAddBank(false); }}
                >
                    <Pressable
                        style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={e => e.stopPropagation()}
                    >
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Add Bank Account</Text>
                                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                                    Keep track of your bank balance
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowAddBank(false)}
                                style={styles.closeBtn}
                                disabled={isSubmittingBank}
                            >
                                <Ionicons name="close" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ marginVertical: 14 }}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Bank Name</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: colors.border }]}>
                                <Ionicons name="business-outline" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                                <TextInput
                                    placeholder="e.g. HDFC Bank, SBI, Cash"
                                    placeholderTextColor={colors.textSecondary}
                                    style={[styles.textInput, { color: colors.text }]}
                                    value={newBankName}
                                    onChangeText={setNewBankName}
                                    editable={!isSubmittingBank}
                                />
                            </View>

                            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 12 }]}>Initial Balance (₹)</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: colors.border }]}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary, marginRight: 6 }}>₹</Text>
                                <TextInput
                                    placeholder="0.00"
                                    placeholderTextColor={colors.textSecondary}
                                    style={[styles.textInput, { color: colors.text }]}
                                    value={newBankAmount}
                                    onChangeText={setNewBankAmount}
                                    keyboardType="numeric"
                                    editable={!isSubmittingBank}
                                />
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                            <TouchableOpacity
                                style={[styles.modalActionBtn, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}
                                onPress={() => setShowAddBank(false)}
                                disabled={isSubmittingBank}
                            >
                                <Text style={[styles.modalActionBtnText, { color: colors.text }]}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalActionBtn, { backgroundColor: colors.primary, flex: 2 }]}
                                onPress={handleCreateBank}
                                disabled={isSubmittingBank}
                                activeOpacity={0.85}
                            >
                                {isSubmittingBank ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={[styles.modalActionBtnText, { color: '#FFFFFF', fontWeight: '700' }]}>
                                        Save Bank
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    // Header Card
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
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    walletIconBox: {
        backgroundColor: '#FFFFFF',
        padding: 8,
        borderRadius: 12
    },

    // Bank in Header Card
    addBankHeaderBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.22)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.35)',
    },
    addBankHeaderBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    bankBalanceHeaderPill: {
        backgroundColor: 'rgba(255, 255, 255, 0.20)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.30)',
    },
    bankHeaderIconWrap: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 6,
    },
    bankHeaderName: {
        color: '#E0E7FF',
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    bankHeaderBalance: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },

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
        marginHorizontal: 12, marginTop: 14, marginBottom: 8
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

    // Empty state
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
        paddingHorizontal: 20
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#64748B',
        marginTop: 12
    },
    emptySubtitle: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 4
    },

    // FAB
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#4F46E5',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 6,
    },

    // Modals
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 19,
        fontWeight: '800',
    },
    modalSubtitle: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    closeBtn: {
        padding: 4,
    },
    bankOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1.5,
        marginVertical: 4,
    },
    bankOptionIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bankOptionName: {
        fontSize: 14,
    },
    bankOptionAmount: {
        fontSize: 13,
        fontWeight: '700',
        marginTop: 2,
    },
    addAnotherBankBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        marginTop: 10,
    },
    addAnotherBankBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 48,
    },
    textInput: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
    },
    modalActionBtn: {
        flex: 1,
        height: 46,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalActionBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
});

export default HomeScreen;
