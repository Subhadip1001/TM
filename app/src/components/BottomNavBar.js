import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BottomNavBar({ activeTab, onTabSelect, onAddPress }) {
    const insets = useSafeAreaInsets();

    const tabs = [
        { key: 'Home', label: 'Home', icon: 'home', iconOutline: 'home-outline' },
        { key: 'PdfExport', label: 'Reports', icon: 'document-text', iconOutline: 'document-text-outline' },
        { key: 'Add', isSpecial: true },
        { key: 'SplitBill', label: 'Split Bill', icon: 'people', iconOutline: 'people-outline' },
        { key: 'Profile', label: 'Profile', icon: 'person', iconOutline: 'person-outline' },
    ];

    return (
        <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.navBar}>
                {tabs.map((tab, idx) => {
                    if (tab.isSpecial) {
                        return (
                            <View key="add-btn" style={styles.centerButtonContainer}>
                                <TouchableOpacity
                                    style={styles.addButton}
                                    onPress={onAddPress}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="add" size={28} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                        );
                    }

                    const isActive = activeTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={styles.tabItem}
                            onPress={() => onTabSelect(tab.key)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconWrapper, isActive && styles.activeIconWrapper]}>
                                <Ionicons
                                    name={isActive ? tab.icon : tab.iconOutline}
                                    size={22}
                                    color={isActive ? '#4F46E5' : '#94A3B8'}
                                />
                            </View>
                            <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'transparent',
    },
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginBottom: 6,
        paddingTop: 8,
        paddingBottom: 8,
        borderRadius: 28,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
    },
    iconWrapper: {
        padding: 4,
        borderRadius: 14,
    },
    activeIconWrapper: {
        backgroundColor: '#EEEDFF',
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94A3B8',
        marginTop: 2,
    },
    activeTabLabel: {
        color: '#4F46E5',
        fontWeight: '700',
    },
    centerButtonContainer: {
        width: 58,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#4F46E5',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
        marginBottom: 10,
    },
});
