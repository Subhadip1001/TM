import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { DeviceEventEmitter } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const EXPENSES_URL = `${API_BASE_URL}/expenses`;
const AUTH_URL = `${API_BASE_URL}/auth`;
const QUEUE_KEY = '@offline_action_queue';

let isProcessing = false;

export const SyncService = {
    // Add an action to the queue
    addToQueue: async (action) => {
        try {
            const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
            const queue = queueStr ? JSON.parse(queueStr) : [];
            queue.push(action);
            await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        } catch (error) {
            console.error('Error adding to queue', error);
        }
    },

    // Process the queue when online
    processQueue: async () => {
        if (isProcessing) return;
        isProcessing = true;

        const state = await NetInfo.fetch();
        if (!state.isConnected) {
            isProcessing = false;
            return;
        }

        const token = await AsyncStorage.getItem('token');
        if (!token) {
            isProcessing = false;
            return;
        }

        try {
            const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
            if (!queueStr) return;
            
            const queue = JSON.parse(queueStr);
            if (queue.length === 0) return;

            const config = { headers: { Authorization: `Bearer ${token}` } };
            
            // We need to keep track of local IDs mapped to real IDs
            const idMapping = {};
            const syncedLocalIds = [];

            const newQueue = [];
            
            for (let i = 0; i < queue.length; i++) {
                const action = queue[i];
                try {
                    if (action.type === 'ADD_EXPENSE') {
                        const data = { ...action.data };
                        delete data._id; // Prevent Cast to ObjectId error
                        if (!data.bankId || data.bankId === 'null') {
                            delete data.bankId;
                        }
                        const res = await axios.post(EXPENSES_URL, data, config);
                        if (action.localId && res.data?._id) {
                            idMapping[action.localId] = res.data._id;
                            syncedLocalIds.push({ localId: action.localId, realExpense: res.data });
                        }
                    } 
                    else if (action.type === 'EDIT_EXPENSE') {
                        const realId = idMapping[action.expenseId] || action.expenseId;
                        // Avoid trying to put with a UUID if it wasn't mapped
                        if (realId && !realId.includes('-')) {
                            const data = { ...action.data };
                            delete data._id;
                            if (!data.bankId || data.bankId === 'null') {
                                data.bankId = null;
                            }
                            await axios.put(`${EXPENSES_URL}/${realId}`, data, config);
                        }
                    }
                    else if (action.type === 'DELETE_EXPENSE') {
                        const realId = idMapping[action.expenseId] || action.expenseId;
                        if (realId && !realId.includes('-')) {
                            await axios.delete(`${EXPENSES_URL}/${realId}`, config);
                        }
                    }
                    else if (action.type === 'ADD_BANK') {
                        await axios.post(`${AUTH_URL}/bank`, action.data, config);
                    }
                } catch (err) {
                    console.error('Failed to sync action', action, err.response?.data || err.message);
                    // Keep in queue if it's a network error or 5xx server error
                    const status = err.response?.status;
                    if (!status || status >= 500 || err.message === 'Network Error' || String(err).includes('Network')) {
                        newQueue.push(action);
                    }
                }
            }
            
            await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));

            // If any local items got real MongoDB _id, update cache and notify UI
            if (syncedLocalIds.length > 0) {
                try {
                    const keys = await AsyncStorage.getAllKeys();
                    const expenseKeys = keys.filter(k => k.startsWith('cached_home_expenses_'));
                    for (const key of expenseKeys) {
                        const str = await AsyncStorage.getItem(key);
                        if (str) {
                            let list = JSON.parse(str);
                            let changed = false;
                            list = list.map(item => {
                                const match = syncedLocalIds.find(s => s.localId === item._id);
                                if (match) {
                                    changed = true;
                                    return { ...item, ...match.realExpense, _id: match.realExpense._id };
                                }
                                return item;
                            });
                            if (changed) {
                                await AsyncStorage.setItem(key, JSON.stringify(list));
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error updating cached local IDs after sync:', e);
                }
            }

            // Notify listeners that sync completed so HomeScreen / ProfileScreen can refresh
            DeviceEventEmitter.emit('syncCompleted', { syncedCount: syncedLocalIds.length });
        } catch (error) {
            console.error('Error processing queue', error);
        } finally {
            isProcessing = false;
        }
    }
};

// Global network listener to trigger sync
NetInfo.addEventListener(state => {
    if (state.isConnected) {
        SyncService.processQueue();
    }
});
