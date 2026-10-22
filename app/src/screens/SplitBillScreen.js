import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Alert,
    Share,
    Platform
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../utils/haptics';

export default function SplitBillScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [billTitle, setBillTitle] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [tipPercent, setTipPercent] = useState('0');
    const [splitType, setSplitType] = useState('equal'); // 'equal' | 'custom'
    const [people, setPeople] = useState([
        { id: '1', name: 'You', amount: '' },
        { id: '2', name: 'Friend 1', amount: '' }
    ]);

    const addPerson = () => {
        const nextNum = people.length + 1;
        setPeople([...people, { id: String(Date.now()), name: `Friend ${nextNum - 1}`, amount: '' }]);
    };

    const removePerson = (id) => {
        if (people.length <= 2) {
            Alert.alert('Notice', 'A bill split requires at least 2 people.');
            return;
        }
        setPeople(people.filter(p => p.id !== id));
    };

    const updatePersonName = (id, newName) => {
        setPeople(people.map(p => p.id === id ? { ...p, name: newName } : p));
    };

    const updatePersonAmount = (id, newAmount) => {
        setPeople(people.map(p => p.id === id ? { ...p, amount: newAmount } : p));
    };

    const numericTotal = parseFloat(totalAmount) || 0;
    const numericTip = parseFloat(tipPercent) || 0;
    const grandTotal = numericTotal + (numericTotal * (numericTip / 100));

    // Calculate splits
    const perPersonEqual = people.length > 0 ? (grandTotal / people.length) : 0;

    const shareSplitSummary = async () => {
        // Prevent sharing if total amount / each person owes amount is 0
        const oweAmount = splitType === 'equal' ? perPersonEqual : (people.length > 0 ? grandTotal / people.length : 0);
        if (oweAmount <= 0 || grandTotal <= 0) {
            Alert.alert('Cannot Share', 'Please enter a valid bill amount before sharing the split.');
            return;
        }

        const title = billTitle.trim() || 'Split Bill';
        let message = `💰 *${title}*\nTotal Bill: ₹${grandTotal.toFixed(2)} (incl. ${numericTip}% tip)\n\n`;

        if (splitType === 'equal') {
            message += `Equal split between ${people.length} people:\n`;
            people.forEach(p => {
                message += `• ${p.name}: ₹${perPersonEqual.toFixed(2)}\n`;
            });
        } else {
            message += `Custom breakdown:\n`;
            people.forEach(p => {
                const amt = parseFloat(p.amount) || 0;
                message += `• ${p.name}: ₹${amt.toFixed(2)}\n`;
            });
        }

        message += `\nShared via Balancy 📱`;

        try {
            await Share.share({ message });
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Fixed Header */}
            <View style={[styles.headerRow, { paddingTop: Math.max(insets.top + 10, 20) }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Split Bill</Text>
                <TouchableOpacity 
                    onPress={shareSplitSummary} 
                    style={[
                        styles.shareIconBtn, 
                        { backgroundColor: colors.primaryLight, opacity: (splitType === 'equal' ? perPersonEqual : grandTotal) <= 0 ? 0.45 : 1 }
                    ]}
                    activeOpacity={0.7}
                >
                    <Ionicons name="share-social-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <KeyboardAwareScrollView
                contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                enableOnAndroid={true}
                extraScrollHeight={Platform.OS === 'ios' ? 80 : 120}
                extraHeight={120}
                enableAutomaticScroll={true}
            >
                {/* Banner Summary */}
                <LinearGradient colors={['#4F46E5', '#3730A3']} style={styles.bannerCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={styles.bannerSubtitle}>Each person owes</Text>
                    <Text style={styles.bannerAmount}>
                        ₹{splitType === 'equal' ? perPersonEqual.toFixed(2) : (people.length > 0 ? (grandTotal / people.length).toFixed(2) : '0.00')}
                    </Text>
                    <View style={styles.bannerMetaRow}>
                        <View style={styles.bannerBadge}>
                            <Ionicons name="people" size={13} color="#FFFFFF" />
                            <Text style={styles.bannerBadgeText}>{people.length} Members</Text>
                        </View>
                        <View style={styles.bannerBadge}>
                            <Ionicons name="receipt-outline" size={13} color="#FFFFFF" />
                            <Text style={styles.bannerBadgeText}>Total ₹{grandTotal.toFixed(2)}</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Bill Inputs */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: isDark ? 1 : 0 }]}>
                    <Text style={[styles.cardSectionTitle, { color: colors.text }]}>Bill Details</Text>
                    
                    <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                        <Ionicons name="restaurant-outline" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
                        <TextInput
                            style={[styles.textInput, { color: colors.text }]}
                            placeholder="Occasion / Note (e.g. Dinner, Trip)"
                            placeholderTextColor={colors.textMuted}
                            value={billTitle}
                            onChangeText={setBillTitle}
                        />
                    </View>

                    <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                        <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>₹</Text>
                        <TextInput
                            style={[styles.textInput, { fontWeight: '700', color: colors.text }]}
                            placeholder="Total Bill Amount"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            value={totalAmount}
                            onChangeText={setTotalAmount}
                        />
                    </View>

                    {/* Tip Options */}
                    <Text style={[styles.fieldLabel, { marginTop: 8, color: colors.textSecondary }]}>Tip / Surcharge</Text>
                    <View style={styles.tipRow}>
                        {['0', '5', '10', '15', '20'].map(t => (
                            <TouchableOpacity
                                key={t}
                                style={[
                                    styles.tipChip,
                                    { backgroundColor: isDark ? '#0B0F19' : '#F8FAFC', borderColor: isDark ? colors.border : '#E2E8F0' },
                                    tipPercent === t && styles.tipChipActive
                                ]}
                                onPress={() => setTipPercent(t)}
                            >
                                <Text style={[
                                    styles.tipChipText,
                                    { color: colors.textSecondary },
                                    tipPercent === t && styles.tipChipTextActive
                                ]}>{t}%</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Split Mode Selector */}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: isDark ? 1 : 0 }]}>
                    <View style={[styles.splitToggleRow, { backgroundColor: isDark ? '#0B0F19' : '#F1F5F9' }]}>
                        <TouchableOpacity
                            style={[styles.splitModeBtn, splitType === 'equal' && [styles.splitModeBtnActive, { backgroundColor: colors.card }]]}
                            onPress={() => { triggerHaptic('selection'); setSplitType('equal'); }}
                        >
                            <Ionicons name="pie-chart-outline" size={16} color={splitType === 'equal' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.splitModeText, splitType === 'equal' && { color: colors.primary, fontWeight: '700' }]}>Equal Split</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.splitModeBtn, splitType === 'custom' && [styles.splitModeBtnActive, { backgroundColor: colors.card }]]}
                            onPress={() => { triggerHaptic('selection'); setSplitType('custom'); }}
                        >
                            <Ionicons name="options-outline" size={16} color={splitType === 'custom' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.splitModeText, splitType === 'custom' && { color: colors.primary, fontWeight: '700' }]}>Custom Split</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ marginTop: 14 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Text style={[styles.cardSectionTitle, { color: colors.text }]}>People Sharing Bill</Text>
                            <TouchableOpacity onPress={addPerson} style={[styles.addPersonBtn, { backgroundColor: colors.primaryLight }]}>
                                <Ionicons name="person-add-outline" size={15} color={colors.primary} />
                                <Text style={[styles.addPersonBtnText, { color: colors.primary }]}>Add Person</Text>
                            </TouchableOpacity>
                        </View>

                        {people.map((person, idx) => (
                            <View key={person.id} style={[styles.personRow, { borderBottomColor: isDark ? colors.border : '#F8FAFC' }]}>
                                <View style={[styles.personAvatar, { backgroundColor: colors.primaryLight }]}>
                                    <Text style={[styles.avatarInitial, { color: colors.primary }]}>{person.name.charAt(0).toUpperCase()}</Text>
                                </View>
                                <TextInput
                                    style={[styles.personNameInput, { color: colors.text }]}
                                    value={person.name}
                                    onChangeText={(val) => updatePersonName(person.id, val)}
                                    placeholder="Name"
                                    placeholderTextColor={colors.textMuted}
                                />

                                {splitType === 'equal' ? (
                                    <View style={[styles.equalAmountPill, { backgroundColor: colors.primaryLight }]}>
                                        <Text style={[styles.equalAmountText, { color: colors.primary }]}>₹{perPersonEqual.toFixed(2)}</Text>
                                    </View>
                                ) : (
                                    <View style={[styles.customAmountBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                                        <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '700' }}>₹</Text>
                                        <TextInput
                                            style={[styles.customAmountInput, { color: colors.text }]}
                                            placeholder="0"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            value={person.amount}
                                            onChangeText={(val) => updatePersonAmount(person.id, val)}
                                        />
                                    </View>
                                )}

                                <TouchableOpacity 
                                    onPress={() => {
                                        triggerHaptic('light');
                                        removePerson(person.id);
                                    }} 
                                    style={{ 
                                        width: 34, 
                                        height: 34, 
                                        borderRadius: 10, 
                                        backgroundColor: isDark ? 'rgba(255, 71, 87, 0.16)' : '#FFF0F0',
                                        borderColor: isDark ? 'rgba(255, 71, 87, 0.3)' : '#FECDD3',
                                        borderWidth: 1,
                                        justifyContent: 'center', 
                                        alignItems: 'center',
                                        marginLeft: 6 
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="trash" size={15} color="#FF4757" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Share Button */}
                <TouchableOpacity style={styles.shareMainBtn} onPress={shareSplitSummary}>
                    <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.shareMainBtnText}>Share Split with Friends</Text>
                </TouchableOpacity>
            </KeyboardAwareScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 16,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1E293B',
    },
    shareIconBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#EEEDFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerCard: {
        borderRadius: 22,
        padding: 22,
        marginBottom: 18,
        alignItems: 'center',
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
    },
    bannerSubtitle: {
        fontSize: 12,
        color: '#E0E7FF',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    bannerAmount: {
        fontSize: 34,
        fontWeight: '900',
        color: '#FFFFFF',
        marginVertical: 4,
    },
    bannerMetaRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 6,
    },
    bannerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    bannerBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardSectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 10,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 48,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    currencySymbol: {
        fontSize: 16,
        fontWeight: '800',
        color: '#4F46E5',
        marginRight: 10,
    },
    textInput: {
        flex: 1,
        fontSize: 14,
        color: '#0F172A',
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    tipRow: {
        flexDirection: 'row',
        gap: 8,
    },
    tipChip: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingVertical: 7,
        borderRadius: 10,
        alignItems: 'center',
    },
    tipChipActive: {
        backgroundColor: '#4F46E5',
        borderColor: '#4F46E5',
    },
    tipChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    tipChipTextActive: {
        color: '#FFFFFF',
    },
    splitToggleRow: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 3,
    },
    splitModeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: 10,
    },
    splitModeBtnActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    splitModeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    splitModeTextActive: {
        color: '#4F46E5',
        fontWeight: '700',
    },
    addPersonBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#EEEDFF',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    addPersonBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#4F46E5',
    },
    personRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    personAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#EEEDFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    avatarInitial: {
        fontSize: 13,
        fontWeight: '800',
        color: '#4F46E5',
    },
    personNameInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
    },
    equalAmountPill: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    equalAmountText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    customAmountBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        paddingHorizontal: 8,
        width: 85,
        height: 34,
    },
    customAmountInput: {
        flex: 1,
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A',
        marginLeft: 4,
        padding: 0,
    },
    shareMainBtn: {
        backgroundColor: '#4F46E5',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 15,
        borderRadius: 16,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    shareMainBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
});
