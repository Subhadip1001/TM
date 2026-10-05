import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const EXPENSES_URL = `${API_BASE_URL}/expenses`;
const AUTH_URL = `${API_BASE_URL}/auth`;
const QUEUE_KEY = '@offline_action_queue';

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
        const state = await NetInfo.fetch();
        if (!state.isConnected) return;

        const token = await AsyncStorage.getItem('token');
        if (!token) return;

        try {
            const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
            if (!queueStr) return;
            
            const queue = JSON.parse(queueStr);
            if (queue.length === 0) return;

            const config = { headers: { Authorization: `Bearer ${token}` } };
            
            // We need to keep track of local IDs mapped to real IDs
            const idMapping = {};

            const newQueue = [];
            
            for (let i = 0; i < queue.length; i++) {
                const action = queue[i];
                try {
                    if (action.type === 'ADD_EXPENSE') {
                        const data = action.data;
                        const res = await axios.post(EXPENSES_URL, data, config);
                        idMapping[action.localId] = res.data._id;
                    } 
                    else if (action.type === 'EDIT_EXPENSE') {
                        const realId = idMapping[action.expenseId] || action.expenseId;
                        // Avoid trying to put with a UUID if it wasn't mapped
                        if (!realId.includes('-')) {
                            await axios.put(`${EXPENSES_URL}/${realId}`, action.data, config);
                        }
                    }
                    else if (action.type === 'DELETE_EXPENSE') {
                        const realId = idMapping[action.expenseId] || action.expenseId;
                        if (!realId.includes('-')) {
                            await axios.delete(`${EXPENSES_URL}/${realId}`, config);
                        }
                    }
                    else if (action.type === 'ADD_BANK') {
                        await axios.post(`${AUTH_URL}/bank`, action.data, config);
                    }
                } catch (err) {
                    console.error('Failed to sync action', action, err.response?.data || err.message);
                    // Keep in queue if it's a network error (like 500 or timeout)
                    if (err.message === 'Network Error' || String(err).includes('Network')) {
                        newQueue.push(action);
                    }
                }
            }
            
            await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
        } catch (error) {
            console.error('Error processing queue', error);
        }
    }
};

// Global network listener to trigger sync
NetInfo.addEventListener(state => {
    if (state.isConnected) {
        SyncService.processQueue();
    }
});
