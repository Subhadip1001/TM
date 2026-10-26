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
            const errorMsg = (error?.message || '').toLowerCase();
            // In EAS/expo-updates, 404, 400, "no update", "not supported", or empty manifest
            // typically means there is no newer OTA update published for this build/runtime.
            // Rather than showing a false internet error when the user is online, show "Up to Date".
            if (
                errorMsg.includes('404') ||
                errorMsg.includes('400') ||
                errorMsg.includes('not available') ||
                errorMsg.includes('no update') ||
                errorMsg.includes('not supported') ||
                errorMsg.includes('expected 200')
            ) {
                Alert.alert('Up to Date', 'You are already using the latest version of Balancy.');
            } else {
                // If the error message specifically mentions network / internet
                if (errorMsg.includes('network') || errorMsg.includes('internet') || errorMsg.includes('connection')) {
                    Alert.alert('Network Issue', 'Unable to reach the update server. Please check your internet connection.');
                } else {
                    Alert.alert('Up to Date', 'You are already using the latest version of Balancy.');
                }
            }
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
