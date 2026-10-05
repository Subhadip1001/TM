import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useShareIntent } from 'expo-share-intent';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from './src/config';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();

export default function App() {
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntent();
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          setInitialRoute('Home');
        } else {
          setInitialRoute('Login');
        }
      } catch (err) {
        setInitialRoute('Login');
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const handleSharedText = async () => {
      if (hasShareIntent && shareIntent.value) {
        const sharedText = shareIntent.value;
        resetShareIntent(); // Reset immediately so it doesn't fire twice
        
        try {
          const token = await AsyncStorage.getItem('token');
          if (!token) {
            // User not logged in, can't save expense automatically
            return;
          }

          // Simple regex to find an amount (e.g., Rs 500, ₹ 100.50, INR 50)
          const amountMatch = sharedText.match(/(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)/i);
          let amount = 0;
          if (amountMatch && amountMatch[1]) {
            amount = parseFloat(amountMatch[1].replace(/,/g, ''));
          }

          // Try to extract a name (e.g., "Paid to John Doe")
          let title = 'Shared Expense';
          const toMatch = sharedText.match(/to\s+([A-Za-z\s]+)(?:\s|$)/i);
          if (toMatch && toMatch[1]) {
              title = toMatch[1].trim();
          }

          if (amount > 0) {
            // Automatically save to backend
            await axios.post(`${API_BASE_URL}/expenses`, {
              title,
              amount,
              date: new Date().toISOString()
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });

            // Navigate to Home to refresh data
            if (navigationRef.isReady()) {
              navigationRef.navigate('Home');
            }
          } else {
             // If we couldn't parse the amount, take them to the Add screen with text
             if (navigationRef.isReady()) {
               navigationRef.navigate('AddExpense', { prefilledTitle: sharedText.substring(0, 50) });
             }
          }
        } catch (error) {
          console.error('Failed to process shared intent', error);
        }
      }
    };

    handleSharedText();
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  if (initialRoute === null) {
    return null; // Don't render navigator until we know the initial route
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName={initialRoute}>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add Expense' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
