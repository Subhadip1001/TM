import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function CustomTabBar({ state, descriptors, navigation, insets, scrollX, tabBarWidth: propWidth }) {
    const { colors, isDark } = useTheme();
    const windowDimensions = useWindowDimensions();
    const width = propWidth || windowDimensions.width;
    const bottomInset = insets?.bottom || 0;

    const tabConfig = {
        Home: { label: 'Home', icon: 'home', iconOutline: 'home-outline' },
        PdfExport: { label: 'Reports', icon: 'document-text', iconOutline: 'document-text-outline' },
        SplitBill: { label: 'Split Bill', icon: 'people', iconOutline: 'people-outline' },
        Profile: { label: 'Profile', icon: 'person', iconOutline: 'person-outline' },
    };

    if (!state || !state.routes || !Array.isArray(state.routes)) {
        return null;
    }

    const tabCount = state.routes.length || 4;
    const tabWidth = width / tabCount;
    const pillWidth = 64;
    const pillOffset = (tabWidth - pillWidth) / 2;

    const inputRange = state.routes.map((_, i) => i * width);
    const outputRange = state.routes.map((_, i) => i * tabWidth + pillOffset);

    const translateX = scrollX
        ? scrollX.interpolate({
            inputRange,
            outputRange,
            extrapolate: 'clamp',
        })
        : (state.index * tabWidth + pillOffset);

    const getTabFocusProgress = (index) => {
        if (!scrollX || width <= 0) return null;

        let inRange, outRange;
        if (index === 0) {
            inRange = [0, width];
            outRange = [1, 0];
        } else if (index === tabCount - 1) {
            inRange = [(index - 1) * width, index * width];
            outRange = [0, 1];
        } else {
            inRange = [(index - 1) * width, index * width, (index + 1) * width];
            outRange = [0, 1, 0];
        }

        return scrollX.interpolate({
            inputRange: inRange,
            outputRange: outRange,
            extrapolate: 'clamp',
        });
    };

    const renderTabButton = (route, index) => {
        if (!route) return null;
        const isFocused = state.index === index;
        const config = tabConfig[route.name] || { label: route.name, icon: 'ellipse', iconOutline: 'ellipse-outline' };

        const onPress = () => {
            const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
            }
        };

        const focusProgress = getTabFocusProgress(index);
        const fillOpacity = focusProgress || (isFocused ? 1 : 0);
        const outlineOpacity = focusProgress
            ? focusProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })
            : (isFocused ? 0 : 1);
        const fillScale = focusProgress
            ? focusProgress.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] })
            : (isFocused ? 1 : 0.88);

        return (
            <TouchableOpacity
                key={route.key || route.name || index}
                style={styles.tabItem}
                onPress={onPress}
                activeOpacity={0.7}
            >
                <View style={styles.pill}>
                    {/* Outline icon (fades out as tab becomes active) */}
                    <Animated.View style={[styles.iconAbsolute, { opacity: outlineOpacity }]}>
                        <Ionicons
                            name={config.iconOutline}
                            size={22}
                            color={colors.textSecondary}
                        />
                    </Animated.View>

                    {/* Filled icon (fades in and scales in real-time as finger swipes) */}
                    <Animated.View style={[styles.iconAbsolute, { opacity: fillOpacity, transform: [{ scale: fillScale }] }]}>
                        <Ionicons
                            name={config.icon}
                            size={22}
                            color={colors.primary}
                        />
                    </Animated.View>
                </View>

                {/* Real-time smooth crossfading label */}
                <View style={styles.labelWrapper}>
                    <Animated.Text style={[styles.tabLabel, { color: colors.textSecondary, fontWeight: '600', opacity: outlineOpacity, position: 'absolute' }]}>
                        {config.label}
                    </Animated.Text>
                    <Animated.Text style={[styles.tabLabel, { color: colors.text, fontWeight: '700', opacity: fillOpacity }]}>
                        {config.label}
                    </Animated.Text>
                </View>
            </TouchableOpacity>
        );
    };

    // Find routes by name to ensure exact order
    const homeRoute = state.routes.find(r => r.name === 'Home');
    const homeIndex = state.routes.findIndex(r => r.name === 'Home');

    const pdfRoute = state.routes.find(r => r.name === 'PdfExport');
    const pdfIndex = state.routes.findIndex(r => r.name === 'PdfExport');

    const splitRoute = state.routes.find(r => r.name === 'SplitBill');
    const splitIndex = state.routes.findIndex(r => r.name === 'SplitBill');

    const profileRoute = state.routes.find(r => r.name === 'Profile');
    const profileIndex = state.routes.findIndex(r => r.name === 'Profile');

    return (
        <View style={[
            styles.navBar,
            {
                backgroundColor: colors.tabBarBg,
                borderTopColor: colors.tabBarBorder,
                paddingBottom: Math.max(bottomInset, 10)
            }
        ]}>
            {/* Real-time native animated sliding indicator pill */}
            <Animated.View
                pointerEvents="none"
                style={[
                    styles.slidingPill,
                    {
                        width: pillWidth,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.22)' : '#EEEDFF',
                        transform: [{ translateX }],
                    }
                ]}
            />

            {/* 1. Home Tab */}
            {renderTabButton(homeRoute, homeIndex)}

            {/* 2. Reports Tab */}
            {renderTabButton(pdfRoute, pdfIndex)}

            {/* 3. Split Bill Tab */}
            {renderTabButton(splitRoute, splitIndex)}

            {/* 4. Profile Tab */}
            {renderTabButton(profileRoute, profileIndex)}
        </View>
    );
}

const styles = StyleSheet.create({
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        paddingTop: 9,
        position: 'relative',
    },
    slidingPill: {
        position: 'absolute',
        top: 11,
        left: 0,
        zIndex: 0,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
        zIndex: 1,
    },
    pill: {
        width: 64,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        position: 'relative',
    },
    iconAbsolute: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    labelWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 3,
        height: 16,
    },
    tabLabel: {
        fontSize: 12,
    },
});
