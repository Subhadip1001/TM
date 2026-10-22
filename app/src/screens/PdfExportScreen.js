import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE_URL } from '../config';
import { useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../utils/haptics';

const EXPENSES_URL = `${API_BASE_URL}/expenses`;

export default function PdfExportScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [selectedMode, setSelectedMode] = useState('month'); // 'month' | 'range'
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [rangeType, setRangeType] = useState('30days'); // '7days' | '30days' | '90days' | 'all'
    const [isSharing, setIsSharing] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [userProfile, setUserProfile] = useState(null);

    const months = [
        { label: 'Jan', value: 1 }, { label: 'Feb', value: 2 }, { label: 'Mar', value: 3 },
        { label: 'Apr', value: 4 }, { label: 'May', value: 5 }, { label: 'Jun', value: 6 },
        { label: 'Jul', value: 7 }, { label: 'Aug', value: 8 }, { label: 'Sep', value: 9 },
        { label: 'Oct', value: 10 }, { label: 'Nov', value: 11 }, { label: 'Dec', value: 12 },
    ];

    const years = [2024, 2025, 2026, 2027];

    useEffect(() => {
        const loadUser = async () => {
            const cached = await AsyncStorage.getItem('cached_user');
            if (cached) setUserProfile(JSON.parse(cached));
        };
        loadUser();
    }, []);

    const fetchExpensesToExport = async () => {
        const token = await AsyncStorage.getItem('token');
        const config = token ? { headers: { Authorization: `Bearer ${token}` }, timeout: 2500 } : null;

        if (selectedMode === 'month') {
            const cachedKey = `cached_home_expenses_${selectedYear}_${selectedMonth}`;
            const cached = await AsyncStorage.getItem(cachedKey);
            let expenses = cached ? JSON.parse(cached) : [];
            let total = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

            // Quick network sync if online, max 2.5s timeout so it never hangs
            if (config) {
                try {
                    const res = await axios.get(`${EXPENSES_URL}/filter/${selectedYear}/${selectedMonth}`, config);
                    if (res.data?.expenses) {
                        expenses = res.data.expenses;
                        total = res.data.total ?? expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
                        await AsyncStorage.setItem(cachedKey, JSON.stringify(expenses));
                    }
                } catch (err) {
                    // Fallback to cache immediately if network is slow/sleeping
                    console.log('Network sync skipped or timed out, using cached data:', err.message);
                }
            }

            return {
                title: `${months[selectedMonth - 1].label} ${selectedYear} Expense Report`,
                period: `${months[selectedMonth - 1].label} 1, ${selectedYear} - ${months[selectedMonth - 1].label} End, ${selectedYear}`,
                expenses,
                total,
            };
        } else {
            // Range mode: first gather all cached expenses
            const keys = await AsyncStorage.getAllKeys();
            const expKeys = keys.filter(k => k.startsWith('cached_home_expenses_'));
            let all = [];
            for (const k of expKeys) {
                const str = await AsyncStorage.getItem(k);
                if (str) {
                    try {
                        const parsed = JSON.parse(str);
                        all = all.concat(parsed);
                    } catch (e) {}
                }
            }

            // Deduplicate cached expenses by _id
            const uniqueMap = new Map();
            all.forEach(item => {
                if (item._id && !uniqueMap.has(item._id)) {
                    uniqueMap.set(item._id, item);
                }
            });
            all = Array.from(uniqueMap.values());

            // Quick network sync if online, max 2.5s timeout
            if (config) {
                try {
                    const res = await axios.get(EXPENSES_URL, config);
                    if (Array.isArray(res.data) && res.data.length > 0) {
                        all = res.data;
                    }
                } catch (err) {
                    console.log('Range network sync skipped or timed out, using cached data:', err.message);
                }
            }

            const now = new Date();
            let filterDate = new Date();

            let rangeLabel = 'Last 30 Days';
            if (rangeType === '7days') {
                filterDate.setDate(now.getDate() - 7);
                rangeLabel = 'Last 7 Days';
            } else if (rangeType === '30days') {
                filterDate.setDate(now.getDate() - 30);
                rangeLabel = 'Last 30 Days';
            } else if (rangeType === '90days') {
                filterDate.setDate(now.getDate() - 90);
                rangeLabel = 'Last 90 Days';
            } else {
                filterDate = new Date(2000, 0, 1);
                rangeLabel = 'All Time';
            }

            const filtered = all.filter(e => new Date(e.date) >= filterDate);
            const total = filtered.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

            return {
                title: `${rangeLabel} Expense Report`,
                period: rangeType === 'all' ? 'All Recorded Expenses' : `Since ${filterDate.toLocaleDateString()}`,
                expenses: filtered,
                total,
            };
        }
    };

    const generatePdf = async (shouldShare = false) => {
        if (shouldShare) {
            setIsSharing(true);
        } else {
            setIsPrinting(true);
        }

        try {
            const data = await fetchExpensesToExport();

            if (!data.expenses || data.expenses.length === 0) {
                Alert.alert('No Records', 'No expenses found for the selected period.');
                setIsSharing(false);
                setIsPrinting(false);
                return;
            }

            // Calculate category breakdown for PDF summary
            const categorySummary = {};
            data.expenses.forEach(exp => {
                const cat = (exp.category || 'Other').trim();
                categorySummary[cat] = (categorySummary[cat] || 0) + exp.amount;
            });

            const rowsHtml = data.expenses.map((exp, idx) => `
                <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
                    <td style="padding: 10px 14px; font-size: 13px; color: #334155;">${new Date(exp.date).toLocaleDateString()}</td>
                    <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #0F172A;">${exp.title}</td>
                    <td style="padding: 10px 14px; font-size: 12px; color: #4F46E5; font-weight: 600;">
                        <span style="background-color: #EEEDFF; padding: 4px 8px; border-radius: 6px;">${exp.category || 'General'}</span>
                    </td>
                    <td style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #0F172A; text-align: right;">₹${Number(exp.amount).toFixed(2)}</td>
                </tr>
            `).join('');

            const catSummaryHtml = Object.entries(categorySummary).map(([cat, amt]) => {
                const pct = data.total > 0 ? ((amt / data.total) * 100).toFixed(1) : 0;
                return `
                    <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #E2E8F0; font-size: 12px;">
                        <span style="color: #475569; font-weight: 600;">${cat}</span>
                        <span style="color: #0F172A; font-weight: 700;">₹${amt.toFixed(2)} (${pct}%)</span>
                    </div>
                `;
            }).join('');

            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>${data.title}</title>
                    <style>
                        body {
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                            color: #1E293B;
                            padding: 30px;
                            margin: 0;
                            background-color: #FFFFFF;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            border-bottom: 2px solid #4F46E5;
                            padding-bottom: 15px;
                            margin-bottom: 25px;
                        }
                        .brand {
                            font-size: 24px;
                            font-weight: 800;
                            color: #4F46E5;
                            letter-spacing: -0.5px;
                        }
                        .report-title {
                            font-size: 18px;
                            font-weight: 700;
                            color: #0F172A;
                            margin-top: 4px;
                        }
                        .meta-info {
                            text-align: right;
                            font-size: 11px;
                            color: #64748B;
                        }
                        .summary-cards {
                            display: flex;
                            gap: 15px;
                            margin-bottom: 25px;
                        }
                        .card {
                            flex: 1;
                            background-color: #F8FAFC;
                            border: 1px solid #E2E8F0;
                            border-radius: 12px;
                            padding: 14px;
                        }
                        .card-label {
                            font-size: 11px;
                            text-transform: uppercase;
                            color: #64748B;
                            font-weight: 700;
                            margin-bottom: 4px;
                        }
                        .card-value {
                            font-size: 20px;
                            font-weight: 800;
                            color: #0F172A;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 10px;
                            border-radius: 8px;
                            overflow: hidden;
                        }
                        th {
                            background-color: #4F46E5;
                            color: #FFFFFF;
                            text-align: left;
                            padding: 10px 14px;
                            font-size: 12px;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        .footer {
                            margin-top: 40px;
                            padding-top: 15px;
                            border-top: 1px solid #E2E8F0;
                            text-align: center;
                            font-size: 10px;
                            color: #94A3B8;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <div class="brand">Balancy</div>
                            <div class="report-title">${data.title}</div>
                            <div style="font-size: 12px; color: #64748B; margin-top: 2px;">${data.period}</div>
                        </div>
                        <div class="meta-info">
                            <div><strong>User:</strong> ${userProfile?.username || 'Account Holder'}</div>
                            <div><strong>Email:</strong> ${userProfile?.email || '-'}</div>
                            <div><strong>Generated:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
                        </div>
                    </div>

                    <div class="summary-cards">
                        <div class="card" style="background: linear-gradient(135deg, #EEEDFF 0%, #FFFFFF 100%); border-color: #C7D2FE;">
                            <div class="card-label" style="color: #4F46E5;">Total Spending</div>
                            <div class="card-value" style="color: #4F46E5;">₹${data.total.toFixed(2)}</div>
                        </div>
                        <div class="card">
                            <div class="card-label">Transactions</div>
                            <div class="card-value">${data.expenses.length}</div>
                        </div>
                        <div class="card">
                            <div class="card-label">Avg / Transaction</div>
                            <div class="card-value">₹${(data.expenses.length > 0 ? data.total / data.expenses.length : 0).toFixed(2)}</div>
                        </div>
                    </div>

                    <div style="margin-bottom: 25px;">
                        <h4 style="margin: 0 0 10px 0; color: #1E293B; font-size: 14px;">Category Distribution</h4>
                        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px 16px;">
                            ${catSummaryHtml}
                        </div>
                    </div>

                    <h4 style="margin: 0 0 8px 0; color: #1E293B; font-size: 14px;">Transaction Details</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Category</th>
                                <th style="text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>

                    <div class="footer">
                        Generated securely by Balancy Expense Manager • Keep for your personal records
                    </div>
                </body>
                </html>
            `;

            if (shouldShare) {
                const { uri, base64 } = await Print.printToFileAsync({ html: htmlContent, base64: true });
                let shareUri = uri;

                try {
                    const docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
                    if (docDir) {
                        const cleanTitle = (data.title || 'Expense_Report').replace(/[^a-zA-Z0-9_-]/g, '_');
                        const targetUri = `${docDir}${cleanTitle}.pdf`;

                        if (base64) {
                            await FileSystem.writeAsStringAsync(targetUri, base64, {
                                encoding: FileSystem.EncodingType.Base64,
                            });
                            shareUri = targetUri;
                        } else if (uri) {
                            await FileSystem.copyAsync({
                                from: uri,
                                to: targetUri,
                            });
                            shareUri = targetUri;
                        }
                    }
                } catch (fsErr) {
                    console.warn('Could not relocate PDF into documentDirectory, using original uri:', fsErr?.message);
                }

                setIsSharing(false);
                setIsPrinting(false);

                const canShare = await Sharing.isAvailableAsync();
                if (canShare) {
                    await Sharing.shareAsync(shareUri, {
                        mimeType: 'application/pdf',
                        dialogTitle: 'Share Expense Report',
                        UTI: 'com.adobe.pdf',
                    });
                } else {
                    await Print.printAsync({ html: htmlContent });
                }
            } else {
                setIsSharing(false);
                setIsPrinting(false);
                await Print.printAsync({ html: htmlContent });
            }
        } catch (error) {
            console.error('PDF error:', error);
            Alert.alert('Error', error.message || 'Failed to generate PDF report');
        } finally {
            setIsSharing(false);
            setIsPrinting(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Fixed Header */}
            <View style={[styles.headerRow, { paddingTop: Math.max(insets.top + 10, 20) }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Expense Reports</Text>
            </View>

            {/* Scrollable Content */}
            <ScrollView contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }} showsVerticalScrollIndicator={false}>
                {/* Banner Card */}
                <LinearGradient colors={['#4F46E5', '#3730A3']} style={styles.bannerCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={styles.bannerIconBox}>
                        <Ionicons name="document-text" size={28} color="#FFFFFF" />
                    </View>
                    <Text style={styles.bannerTitle}>PDF Statement Export</Text>
                    <Text style={styles.bannerSubtitle}>Generate formal itemized receipts and category breakdowns for accounting and tax records.</Text>
                </LinearGradient>

                {/* Filter Selector */}
                <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: isDark ? 1 : 0 }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Report Format</Text>
                    <View style={[styles.modeToggleRow, { backgroundColor: isDark ? '#0B0F19' : '#F1F5F9', borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}>
                        <TouchableOpacity
                            style={[
                                styles.modeToggleBtn, 
                                selectedMode === 'month' && [
                                    styles.modeToggleActive, 
                                    { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? colors.cardBorder : 'transparent', borderWidth: isDark ? 1 : 0 }
                                ]
                            ]}
                            onPress={() => { triggerHaptic('selection'); setSelectedMode('month'); }}
                        >
                            <Ionicons name="calendar-outline" size={16} color={selectedMode === 'month' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.modeToggleText, selectedMode === 'month' && { color: colors.primary, fontWeight: '700' }]}>Monthly Statement</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.modeToggleBtn, 
                                selectedMode === 'range' && [
                                    styles.modeToggleActive, 
                                    { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? colors.cardBorder : 'transparent', borderWidth: isDark ? 1 : 0 }
                                ]
                            ]}
                            onPress={() => { triggerHaptic('selection'); setSelectedMode('range'); }}
                        >
                            <Ionicons name="time-outline" size={16} color={selectedMode === 'range' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.modeToggleText, selectedMode === 'range' && { color: colors.primary, fontWeight: '700' }]}>Custom Range</Text>
                        </TouchableOpacity>
                    </View>

                    {selectedMode === 'month' ? (
                        <View style={{ marginTop: 15 }}>
                            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Select Year</Text>
                            <View style={styles.chipRow}>
                                {years.map(y => (
                                    <TouchableOpacity
                                        key={y}
                                        style={[
                                            styles.chip,
                                            { backgroundColor: isDark ? '#0B0F19' : '#F8FAFC', borderColor: isDark ? colors.border : '#E2E8F0' },
                                            selectedYear === y && styles.chipActive
                                        ]}
                                        onPress={() => setSelectedYear(y)}
                                    >
                                        <Text style={[styles.chipText, { color: colors.textSecondary }, selectedYear === y && styles.chipTextActive]}>{y}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.fieldLabel, { marginTop: 15, color: colors.textSecondary }]}>Select Month</Text>
                            <View style={styles.monthGrid}>
                                {months.map(m => (
                                    <TouchableOpacity
                                        key={m.value}
                                        style={[
                                            styles.monthCell,
                                            { backgroundColor: isDark ? '#0B0F19' : '#F8FAFC', borderColor: isDark ? colors.border : '#F1F5F9' },
                                            selectedMonth === m.value && styles.monthCellActive
                                        ]}
                                        onPress={() => setSelectedMonth(m.value)}
                                    >
                                        <Text style={[
                                            styles.monthCellText,
                                            { color: colors.text },
                                            selectedMonth === m.value && styles.monthCellTextActive
                                        ]}>
                                            {m.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <View style={{ marginTop: 15 }}>
                            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Select Time Range</Text>
                            <View style={styles.rangeOptions}>
                                {[
                                    { key: '7days', label: 'Last 7 Days', desc: 'Recent week summary' },
                                    { key: '30days', label: 'Last 30 Days', desc: 'Past month activity' },
                                    { key: '90days', label: 'Last 90 Days', desc: 'Quarterly statement' },
                                    { key: 'all', label: 'All Time History', desc: 'Complete historical export' },
                                ].map(item => {
                                    const isSelected = rangeType === item.key;
                                    return (
                                        <TouchableOpacity
                                            key={item.key}
                                            style={[
                                                styles.rangeCard,
                                                { 
                                                    backgroundColor: isSelected 
                                                        ? (isDark ? 'rgba(99, 102, 241, 0.18)' : '#EEEDFF') 
                                                        : (isDark ? '#0B0F19' : '#F8FAFC'), 
                                                    borderColor: isSelected ? colors.primary : (isDark ? colors.border : '#F1F5F9') 
                                                }
                                            ]}
                                            onPress={() => { triggerHaptic('selection'); setRangeType(item.key); }}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.rangeCardTitle, { color: isSelected ? colors.primary : colors.text }]}>{item.label}</Text>
                                                <Text style={[styles.rangeCardDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
                                            </View>
                                            <Ionicons
                                                name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                                                size={20}
                                                color={isSelected ? colors.primary : colors.textMuted}
                                            />
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}
                </View>

                {/* Actions */}
                <View style={styles.actionContainer}>
                    <TouchableOpacity
                        style={[styles.primaryActionBtn, (isSharing || isPrinting) && { opacity: 0.7 }]}
                        onPress={() => generatePdf(true)}
                        disabled={isSharing || isPrinting}
                    >
                        {isSharing ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <View style={styles.btnRow}>
                                <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
                                <Text style={styles.primaryActionBtnText}>Share & Save PDF</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.secondaryActionBtn,
                            { backgroundColor: colors.card, borderColor: colors.border },
                            (isSharing || isPrinting) && { opacity: 0.7 }
                        ]}
                        onPress={() => generatePdf(false)}
                        disabled={isSharing || isPrinting}
                    >
                        {isPrinting ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <View style={styles.btnRow}>
                                <Ionicons name="print-outline" size={20} color={colors.primary} />
                                <Text style={[styles.secondaryActionBtnText, { color: colors.primary }]}>Print Statement</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
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
        justifyContent: 'flex-start',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1E293B',
    },
    bannerCard: {
        borderRadius: 22,
        padding: 20,
        marginBottom: 18,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 6,
    },
    bannerIconBox: {
        width: 46,
        height: 46,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    bannerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    bannerSubtitle: {
        fontSize: 12,
        color: '#E0E7FF',
        lineHeight: 18,
    },
    sectionCard: {
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
    sectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 12,
    },
    modeToggleRow: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        padding: 4,
    },
    modeToggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
    },
    modeToggleActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    modeToggleText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    modeToggleTextActive: {
        color: '#4F46E5',
        fontWeight: '700',
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    chipRow: {
        flexDirection: 'row',
        gap: 8,
    },
    chip: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: 'center',
    },
    chipActive: {
        backgroundColor: '#4F46E5',
        borderColor: '#4F46E5',
    },
    chipText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
    },
    chipTextActive: {
        color: '#FFFFFF',
    },
    monthGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    monthCell: {
        width: '23%',
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
    },
    monthCellActive: {
        backgroundColor: '#4F46E5',
        borderColor: '#4F46E5',
    },
    monthCellText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
    },
    monthCellTextActive: {
        color: '#FFFFFF',
    },
    rangeOptions: {
        gap: 10,
    },
    rangeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
    },
    rangeCardActive: {
        backgroundColor: '#EEEDFF',
        borderColor: '#4F46E5',
    },
    rangeCardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
    },
    rangeCardTitleActive: {
        color: '#4F46E5',
    },
    rangeCardDesc: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
    },
    actionContainer: {
        gap: 10,
        marginTop: 6,
    },
    primaryActionBtn: {
        backgroundColor: '#4F46E5',
        paddingVertical: 15,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    btnRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    primaryActionBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    secondaryActionBtn: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#4F46E5',
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryActionBtnText: {
        color: '#4F46E5',
        fontSize: 14,
        fontWeight: '700',
    },
});
