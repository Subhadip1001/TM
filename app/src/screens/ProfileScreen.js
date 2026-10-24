import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform, DeviceEventEmitter } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { SyncService } from '../services/SyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { G, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../config';
import { triggerHaptic } from '../utils/haptics';
import { checkForAppUpdate } from '../utils/updateService';

const AUTH_URL = `${API_BASE_URL}/auth`;
const EXPENSES_URL = `${API_BASE_URL}/expenses`;

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

const RADIUS = 43;
const STROKE_WIDTH = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const CategoryPieChart = ({ data = [], total = 0, colors, isDark }) => {
    const validTotal = total > 0 ? total : data.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
    let accumulatedOffset = 0;

    const validData = (data || []).filter(item => Number(item.amount) > 0);

    const slices = validData.map((item, idx) => {
        const percentage = validTotal > 0 ? (Number(item.amount) / validTotal) : 0;
        const strokeLength = percentage * CIRCUMFERENCE;
        // Small 1.5px gap between multiple slices for crisp modern look
        const sliceLength = validData.length > 1 ? Math.max(strokeLength - 1.5, 0.5) : strokeLength;
        const gap = CIRCUMFERENCE - sliceLength;
        const offset = -accumulatedOffset;
        accumulatedOffset += strokeLength;

        return (
            <Circle
                key={idx}
                cx={55}
                cy={55}
                r={RADIUS}
                stroke={item.color || '#4F46E5'}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={`${sliceLength} ${gap}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
            />
        );
    });

    return (
        <View style={styles.chartWrapper}>
            <View style={{ width: 110, height: 110, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={110} height={110} viewBox="0 0 110 110">
                    <Circle
                        cx={55}
                        cy={55}
                        r={RADIUS}
                        stroke={isDark ? '#233047' : '#F1F5F9'}
                        strokeWidth={STROKE_WIDTH}
                        fill="none"
                    />
                    <G transform="rotate(-90 55 55)">
                        {slices}
                    </G>
                </Svg>
                <View style={[styles.ringInner, { backgroundColor: colors ? colors.card : '#FFFFFF' }]}>
                    <Text style={[styles.chartCenterSubtitle, { color: colors ? colors.textSecondary : '#94A3B8' }]}>Total</Text>
                    <Text style={[styles.chartCenterValue, { color: colors ? colors.text : '#1E293B' }] } numberOfLines={1}>
                        ₹{validTotal >= 100000 ? `${(validTotal / 1000).toFixed(1)}k` : validTotal.toFixed(0)}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const ProfileScreen = ({ navigation }) => {
    const { colors, isDark } = useTheme();
    const [user, setUser] = useState(null);
    const [expenses, setExpenses] = useState([]);
    const [monthlyTotal, setMonthlyTotal] = useState(0);
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
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

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

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const fetchExpenses = async () => {
        try {
            const cachedExps = await AsyncStorage.getItem(`cached_home_expenses_${currentYear}_${currentMonth}`);
            if (cachedExps) {
                setExpenses(JSON.parse(cachedExps));
            }
            const cachedTotal = await AsyncStorage.getItem(`cached_home_total_${currentYear}_${currentMonth}`);
            if (cachedTotal) {
                setMonthlyTotal(JSON.parse(cachedTotal));
            }
        } catch (e) {
            console.error('Error fetching cached expenses in profile:', e);
        }
    };

    useEffect(() => { 
        fetchProfile(); 
        fetchExpenses();

        const bankSub = DeviceEventEmitter.addListener('bankUpdated', () => {
            fetchProfile();
        });

        const expSub = DeviceEventEmitter.addListener('expenseUpdated', () => {
            fetchProfile();
            fetchExpenses();
        });

        const syncSub = DeviceEventEmitter.addListener('syncCompleted', () => {
            fetchProfile();
            fetchExpenses();
        });

        return () => {
            bankSub.remove();
            expSub.remove();
            syncSub.remove();
        };
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchProfile();
            fetchExpenses();
        }, [])
    );

    const categoryStats = React.useMemo(() => {
        const stats = {};
        expenses.forEach(exp => {
            const rawCat = (exp.category || 'Other').trim();
            const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();
            const color = CATEGORY_COLORS[cat.toLowerCase()] || CATEGORY_COLORS.other;
            if (!stats[cat]) {
                stats[cat] = { category: cat, amount: 0, count: 0, color };
            }
            stats[cat].amount += Number(exp.amount) || 0;
            stats[cat].count += 1;
        });

        return Object.values(stats).sort((a, b) => b.amount - a.amount);
    }, [expenses]);

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
            AsyncStorage.getItem('cached_user').then(str => {
                if (str) {
                    const u = JSON.parse(str);
                    u.banks = res.data;
                    AsyncStorage.setItem('cached_user', JSON.stringify(u));
                }
            });
            DeviceEventEmitter.emit('bankUpdated');
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
            AsyncStorage.getItem('cached_user').then(str => {
                if (str) {
                    const u = JSON.parse(str);
                    u.banks = res.data;
                    AsyncStorage.setItem('cached_user', JSON.stringify(u));
                }
            });
            DeviceEventEmitter.emit('bankUpdated');
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
                    AsyncStorage.getItem('cached_user').then(str => {
                        if (str) {
                            const u = JSON.parse(str);
                            u.banks = res.data;
                            AsyncStorage.setItem('cached_user', JSON.stringify(u));
                        }
                    });
                    DeviceEventEmitter.emit('bankUpdated');
                } catch (error) { Alert.alert('Error', 'Failed to delete bank'); }
            }}
        ]);
    };

    const handleLogout = async () => {
        await AsyncStorage.clear();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Fixed Header */}
            <View style={[styles.headerTitleRow, { paddingTop: Math.max(insets.top + 10, 20), paddingHorizontal: 20 }]}>
                <Text style={[styles.headerTitleText, { color: colors.text }]}>Profile</Text>
                <TouchableOpacity 
                    style={styles.headerUpdateBtn} 
                    onPress={async () => {
                        if (isCheckingUpdate) return;
                        triggerHaptic('impactLight');
                        setIsCheckingUpdate(true);
                        try {
                            await checkForAppUpdate(true);
                        } finally {
                            setIsCheckingUpdate(false);
                        }
                    }}
                    disabled={isCheckingUpdate}
                    activeOpacity={0.7}
                >
                    {isCheckingUpdate ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="cloud-download-outline" size={13} color={colors.primary} />
                            <Text style={[styles.headerUpdateText, { color: colors.primary }]}>Check for update</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <KeyboardAwareScrollView 
                style={[styles.container, { backgroundColor: colors.background }]} 
                contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }} 
                showsVerticalScrollIndicator={false}
            >
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
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: isDark ? 1 : 0 }]}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIconBox, { backgroundColor: colors.primaryLight }]}>
                        <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.sectionTitles}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Change Password</Text>
                        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Keep your account secure</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </View>

                <View style={[styles.passwordContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={styles.inputLeftIcon} />
                    <TextInput 
                        style={[styles.passwordInput, { color: colors.text }]} 
                        placeholder="Current Password" 
                        placeholderTextColor={colors.textMuted}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
                
                <View style={[styles.passwordContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={styles.inputLeftIcon} />
                    <TextInput 
                        style={[styles.passwordInput, { color: colors.text }]} 
                        placeholder="New Password" 
                        placeholderTextColor={colors.textMuted}
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
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: isDark ? 1 : 0 }]}>
                <View style={styles.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={[styles.sectionIconBox, { backgroundColor: colors.primaryLight }]}>
                            <Ionicons name="business" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.sectionTitles}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>My Banks</Text>
                            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Manage your linked banks</Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        onPress={() => setShowAddBank(!showAddBank)}
                        style={{ backgroundColor: colors.primaryLight, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }}
                    >
                        <Ionicons name={showAddBank ? "close" : "add"} size={22} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {user?.banks && user.banks.length > 0 ? (
                    user.banks.map((bank, index) => (
                        <View key={index} style={[styles.bankItem, { borderBottomColor: colors.border }]}>
                            {editingBankId === bank._id ? (
                                <View style={{ flex: 1 }}>
                                    <View style={[styles.passwordContainer, { marginBottom: 10, height: 45, backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                        <TextInput 
                                            style={[styles.passwordInput, { color: colors.text }]} 
                                            value={editBankName} 
                                            onChangeText={setEditBankName} 
                                            placeholder="Bank Name" 
                                            placeholderTextColor={colors.textMuted} 
                                        />
                                    </View>
                                    <View style={[styles.passwordContainer, { marginBottom: 15, height: 45, backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                        <TextInput 
                                            style={[styles.passwordInput, { color: colors.text }]} 
                                            value={editBankAmount} 
                                            onChangeText={setEditBankAmount} 
                                            placeholder="Amount" 
                                            placeholderTextColor={colors.textMuted} 
                                            keyboardType="numeric" 
                                        />
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
                                        <TouchableOpacity 
                                            onPress={() => setEditingBankId(null)} 
                                            style={[styles.cancelBtn, { backgroundColor: isDark ? colors.cardBorder : '#F1F5F9' }]}
                                        >
                                            <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={() => handleEditBank(bank._id)} 
                                            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                                        >
                                            <Text style={styles.saveBtnText}>Save</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={[styles.iconCircle, { backgroundColor: index % 2 === 0 ? (isDark ? 'rgba(14, 165, 233, 0.15)' : '#E0F2FE') : (isDark ? 'rgba(108, 92, 231, 0.15)' : '#F0F0FF') }]}>
                                            <Ionicons name="business" size={24} color={index % 2 === 0 ? '#0EA5E9' : '#6C5CE7'} />
                                        </View>
                                        <View style={{ marginLeft: 12 }}>
                                            <Text style={[styles.expenseTitle, { color: colors.text }]}>{bank.name}</Text>
                                            <Text style={[styles.expenseDate, { color: colors.textSecondary }]}>₹{bank.amount.toFixed(2)}</Text>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity 
                                            onPress={() => { 
                                                triggerHaptic('light');
                                                setEditingBankId(bank._id); 
                                                setEditBankName(bank.name); 
                                                setEditBankAmount(bank.amount.toString()); 
                                            }}
                                            style={{ 
                                                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.18)' : '#EEEDFF', 
                                                borderColor: isDark ? 'rgba(99, 102, 241, 0.35)' : '#C7D2FE',
                                                borderWidth: 1,
                                                width: 36, 
                                                height: 36, 
                                                borderRadius: 12, 
                                                justifyContent: 'center', 
                                                alignItems: 'center' 
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="pencil" size={16} color={colors.primary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={() => {
                                                triggerHaptic('light');
                                                handleDeleteBank(bank._id);
                                            }}
                                            style={{ 
                                                backgroundColor: isDark ? 'rgba(255, 71, 87, 0.18)' : '#FFF0F0', 
                                                borderColor: isDark ? 'rgba(255, 71, 87, 0.35)' : '#FECDD3',
                                                borderWidth: 1,
                                                width: 36, 
                                                height: 36, 
                                                borderRadius: 12, 
                                                justifyContent: 'center', 
                                                alignItems: 'center' 
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="trash" size={16} color="#FF4757" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    ))
                ) : (
                    <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                        <Ionicons name="business-outline" size={28} color={colors.textSecondary} style={{ marginBottom: 4 }} />
                        <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>No banks linked yet</Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Tap '+' above to add your first bank account</Text>
                    </View>
                )}
                
                {showAddBank && (
                    <View style={{ marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <View style={[styles.passwordContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                            <TextInput style={[styles.passwordInput, { color: colors.text }]} placeholder="Bank Name" placeholderTextColor={colors.textMuted} value={newBankName} onChangeText={setNewBankName} />
                        </View>
                        <View style={[styles.passwordContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                            <TextInput style={[styles.passwordInput, { color: colors.text }]} placeholder="Initial Amount" placeholderTextColor={colors.textMuted} value={newBankAmount} onChangeText={setNewBankAmount} keyboardType="numeric" />
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

            {/* Category Pie Chart & Breakdown Section under Bank */}
            {categoryStats.length > 0 && (
                <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: isDark ? 1 : 0 }]}>
                    <View style={styles.sectionHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <View style={[styles.sectionIconBox, { backgroundColor: colors.primaryLight }]}>
                                <Ionicons name="pie-chart" size={20} color={colors.primary} />
                            </View>
                            <View style={styles.sectionTitles}>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>Category Spending</Text>
                                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Monthly breakdown & distribution</Text>
                            </View>
                        </View>
                        <View style={[styles.catCountBadge, { backgroundColor: colors.primaryLight }]}>
                            <Text style={[styles.catCountText, { color: colors.primary }]}>{categoryStats.length} {categoryStats.length === 1 ? 'Category' : 'Categories'}</Text>
                        </View>
                    </View>

                    {/* Donut Chart and Top Legend */}
                    <View style={[styles.pieRow, { borderBottomColor: isDark ? colors.border : '#F8FAFC' }]}>
                        <CategoryPieChart data={categoryStats} total={monthlyTotal} colors={colors} isDark={isDark} />
                        
                        <View style={styles.legendContainer}>
                            {categoryStats.slice(0, 3).map((item, idx) => {
                                const percent = monthlyTotal > 0 ? ((item.amount / monthlyTotal) * 100).toFixed(0) : 0;
                                return (
                                    <View key={idx} style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.legendName, { color: colors.text }]} numberOfLines={1}>{item.category}</Text>
                                            <Text style={[styles.legendAmount, { color: colors.textSecondary }]}>₹{item.amount.toFixed(0)} ({percent}%)</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {/* All Categories Breakdown Progress */}
                    <View style={styles.breakdownList}>
                        {categoryStats.map((item, index) => {
                            const percent = monthlyTotal > 0 ? Math.round((item.amount / monthlyTotal) * 100) : 0;
                            const iconMeta = getCategoryIcon(item.category);
                            return (
                                <View key={index} style={styles.catBreakdownItem}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <View style={[styles.miniIconBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : iconMeta.bg }]}>
                                                <Ionicons name={iconMeta.name} size={13} color={iconMeta.color} />
                                            </View>
                                            <Text style={[styles.catName, { color: colors.text }]}>{item.category}</Text>
                                            <Text style={[styles.catCountSmall, { color: colors.textSecondary }]}> • {item.count} {item.count === 1 ? 'tx' : 'txs'}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={[styles.catAmountText, { color: colors.text }]}>₹{item.amount.toFixed(2)}</Text>
                                            <Text style={[styles.catPercentBadge, { color: colors.textSecondary }]}> {percent}%</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.progressBarBackground, { backgroundColor: isDark ? '#233047' : '#F1F5F9' }]}>
                                        <View style={[styles.progressBarFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: item.color }]} />
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}
        </KeyboardAwareScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9F9FB', paddingHorizontal: 20 },
    
    headerTitleRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: 20 
    },
    headerTitleText: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
    headerUpdateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 9,
        borderRadius: 14,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
    },
    headerUpdateText: {
        fontSize: 12,
        fontWeight: '600',
    },
    
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
    
    // Theme Switcher Pills
    themePillsRow: {
        flexDirection: 'row',
        padding: 4,
        borderRadius: 14,
        gap: 6,
    },
    themePillBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
    },
    themePillBtnActive: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    themePillText: {
        fontSize: 13,
    },
    themeHintText: {
        fontSize: 11,
        fontWeight: '500',
    },
    
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

    // Category Pie & Breakdown
    catCountBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    catCountText: { fontSize: 11, fontWeight: '700', color: '#475569' },
    pieRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
        marginBottom: 14
    },
    chartWrapper: {
        position: 'relative',
        width: 120,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center'
    },
    ringOuter: {
        width: 110,
        height: 110,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringInner: {
        position: 'absolute',
        width: 66,
        height: 66,
        borderRadius: 33,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    chartCenterSubtitle: {
        fontSize: 9,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase'
    },
    chartCenterValue: {
        fontSize: 12,
        fontWeight: '900',
        color: '#1E293B'
    },
    legendContainer: {
        flex: 1,
        paddingLeft: 16,
        justifyContent: 'center',
        gap: 10
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8
    },
    legendName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1E293B'
    },
    legendAmount: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
        marginTop: 1
    },
    breakdownList: {
        marginTop: 6,
        gap: 12
    },
    catBreakdownItem: {
        width: '100%'
    },
    miniIconBox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8
    },
    catName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1E293B'
    },
    catCountSmall: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '500'
    },
    catAmountText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#1E293B'
    },
    catPercentBadge: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B'
    },
    progressBarBackground: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#F1F5F9',
        overflow: 'hidden',
        width: '100%'
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3
    }
});

export default ProfileScreen;
