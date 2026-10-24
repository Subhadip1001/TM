import * as Updates from 'expo-updates';
import { DeviceEventEmitter, Alert } from 'react-native';

/**
 * Checks for updates. If available, notifies the UI with update details (message/notes)
 * @param {boolean} isManual - Whether the check was triggered manually by the user
 */
export const checkForAppUpdate = async (isManual = false) => {
    if (__DEV__) {
        if (isManual) {
            Alert.alert(
                'Development Mode',
                'In-app OTA updates are disabled in local development mode.\n\n(Tip: In production builds, this checks EAS updates and shows the custom New Features modal).'
            );
        }
        return;
    }

    try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
            // Extract commit / update message from EAS manifest
            const manifest = update.manifest;
            const updateMessage = manifest?.extra?.expoClient?.extra?.message 
                || manifest?.metadata?.message 
                || manifest?.commitTime 
                || 'New improvements and performance enhancements are available.';

            // Emit event so the Update Modal appears on screen
            DeviceEventEmitter.emit('showAppUpdateModal', {
                updateMessage: typeof updateMessage === 'string' ? updateMessage : 'New features and bug fixes.',
                manifest: update.manifest,
            });
        } else if (isManual) {
            Alert.alert('Up to Date', 'You are already using the latest version of Balancy.');
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
        if (isManual) {
            Alert.alert('Error', 'Unable to check for updates at this moment. Please check your internet connection.');
        }
    }
};

/**
 * Downloads and applies the update, reloading the app bundle
 */
export const downloadAndApplyUpdate = async () => {
    try {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
    } catch (error) {
        console.error('Failed to download update:', error);
        throw error;
    }
};
