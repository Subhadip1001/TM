import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let lastHapticTime = 0;

/**
 * Universal Haptic feedback trigger for taps and section switches
 * Tuned to be very subtle, soft, and gentle.
 */
export const triggerHaptic = (style = 'selection') => {
    const now = Date.now();
    // Prevent overlapping rapid vibrations
    if (now - lastHapticTime < 80) return;
    lastHapticTime = now;

    try {
        if (style === 'selection' || style === 'light') {
            if (Platform.OS === 'android') {
                // On Android, impactAsync(Light) provides a short, gentle tick
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            } else {
                Haptics.selectionAsync().catch(() => {});
            }
        } else if (style === 'medium') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        } else if (style === 'success') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
    } catch (e) {
        // Safe fallback if device doesn't support haptics
    }
};
