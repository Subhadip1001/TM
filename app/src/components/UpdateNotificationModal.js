import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    DeviceEventEmitter,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { downloadAndApplyUpdate } from '../utils/updateService';
import { triggerHaptic } from '../utils/haptics';

export default function UpdateNotificationModal() {
    const { colors, isDark } = useTheme();
    const [visible, setVisible] = useState(false);
    const [releaseNotes, setReleaseNotes] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('showAppUpdateModal', (data) => {
            setReleaseNotes(data?.updateMessage || 'New features, improvements, and bug fixes.');
            setVisible(true);
        });

        return () => sub.remove();
    }, []);

    const handleUpdate = async () => {
        triggerHaptic('impactMedium');
        setIsDownloading(true);
        try {
            await downloadAndApplyUpdate();
        } catch (error) {
            setIsDownloading(false);
            Alert.alert(
                'Update Error',
                'Failed to install update. Please ensure you have a stable network connection and try again.'
            );
        }
    };

    const handleDismiss = () => {
        triggerHaptic('impactLight');
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <Modal
            transparent
            animationType="fade"
            visible={visible}
            onRequestClose={handleDismiss}
        >
            <View style={styles.overlay}>
                <View style={[styles.dialogCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    {/* Top Decorative Icon */}
                    <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                        <Ionicons name="sparkles" size={28} color={colors.primary} />
                    </View>

                    {/* Badge */}
                    <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.badgeText, { color: colors.primary }]}>NEW UPDATE AVAILABLE</Text>
                    </View>

                    <Text style={[styles.title, { color: colors.text }]}>What's New in Balancy</Text>

                    {/* Features / Release Notes Box */}
                    <View style={[styles.notesContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                        <View style={styles.featureRow}>
                            <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginTop: 2 }} />
                            <Text style={[styles.notesText, { color: colors.text }]}>
                                {releaseNotes}
                            </Text>
                        </View>
                    </View>

                    <Text style={[styles.subText, { color: colors.textSecondary }]}>
                        Update now to enjoy the latest features and performance enhancements instantly.
                    </Text>

                    {/* Action Buttons */}
                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.closeButton, { borderColor: colors.border }]}
                            onPress={handleDismiss}
                            disabled={isDownloading}
                        >
                            <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>Later</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.updateButton, { backgroundColor: colors.primary }]}
                            onPress={handleUpdate}
                            disabled={isDownloading}
                        >
                            {isDownloading ? (
                                <View style={styles.loadingRow}>
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                    <Text style={styles.updateButtonText}>Updating...</Text>
                                </View>
                            ) : (
                                <View style={styles.loadingRow}>
                                    <Ionicons name="cloud-download-outline" size={17} color="#FFFFFF" />
                                    <Text style={styles.updateButtonText}>Update Now</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    dialogCard: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 18,
        elevation: 10,
    },
    iconCircle: {
        width: 62,
        height: 62,
        borderRadius: 31,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 8,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    title: {
        fontSize: 19,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 14,
    },
    notesContainer: {
        width: '100%',
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    notesText: {
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 18,
        flex: 1,
    },
    subText: {
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 17,
        marginBottom: 20,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    closeButton: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    closeButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    updateButton: {
        flex: 1.5,
        paddingVertical: 13,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    updateButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
});
