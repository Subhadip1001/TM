import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let lastHapticTime = 0;

/**
 * Universal Haptic feedback trigger for taps and section switches
 * Tuned to be very subtle, soft, and gentle.
 */
export const triggerHaptic = (style = 'selection') => {
    const now = Date.now();
    // Debounce to prevent rapid overlapping buzzes
    if (now - lastHapticTime < 80) return;
    lastHapticTime = now;

    try {
        if (style === 'selection' || style === 'light') {
            // 'Soft' impact is the lowest-intensity, most cushioned haptic profile available
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {
                Haptics.selectionAsync().catch(() => {});
            });
        } else if (style === 'medium') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
        } else if (style === 'success') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
    } catch (e) {
        // Safe fallback if device doesn't support haptics
    }
};
