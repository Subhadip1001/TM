import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useShareIntent } from 'expo-share-intent';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as SplashScreen from 'expo-splash-screen';
import { API_BASE_URL } from './src/config';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PdfExportScreen from './src/screens/PdfExportScreen';
import SplitBillScreen from './src/screens/SplitBillScreen';
import CustomTabBar from './src/components/CustomTabBar';

import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, ScrollView, useWindowDimensions, StatusBar as RNStatusBar, Animated, Easing } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';

const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();

const TAB_ROUTES = [
  { key: 'Home', name: 'Home' },
  { key: 'PdfExport', name: 'PdfExport' },
  { key: 'SplitBill', name: 'SplitBill' },
  { key: 'Profile', name: 'Profile' },
];

function MainTabs({ navigation, route }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const currentScrollX = useRef(0);
  const scrollAnimValue = useRef(new Animated.Value(0)).current;
  const activeAnimListener = useRef(null);
  const isProgrammaticScroll = useRef(false);
  const listenersRef = useRef({
    Home: new Set(),
    PdfExport: new Set(),
    SplitBill: new Set(),
    Profile: new Set(),
  });

  const notifyTabFocus = (tabName) => {
    const cbs = listenersRef.current[tabName];
    if (cbs) {
      cbs.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.error(e);
        }
      });
    }
  };

  const goToTab = (index, animated = true) => {
    if (index < 0 || index >= TAB_ROUTES.length) return;
    setActiveIndex(index);
    notifyTabFocus(TAB_ROUTES[index].name);
    const targetX = index * width;

    if (!animated) {
      const node = scrollRef.current?.getNode ? scrollRef.current.getNode() : scrollRef.current;
      node?.scrollTo({ x: targetX, animated: false });
      return;
    }

    isProgrammaticScroll.current = true;
    if (activeAnimListener.current) {
      scrollAnimValue.removeListener(activeAnimListener.current);
      activeAnimListener.current = null;
    }
    scrollAnimValue.stopAnimation();
    scrollAnimValue.setValue(currentScrollX.current);

    const listenerId = scrollAnimValue.addListener(({ value }) => {
      const node = scrollRef.current?.getNode ? scrollRef.current.getNode() : scrollRef.current;
      node?.scrollTo({ x: value, animated: false });
    });
    activeAnimListener.current = listenerId;

    const distance = Math.abs(targetX - currentScrollX.current);
    const screenDiff = width > 0 ? (distance / width) : 1;
    // Consistent constant linear speed (650ms per screen)
    const duration = Math.max(350, Math.round(screenDiff * 650));

    // Linear uniform speed: same constant speed from start to finish
    Animated.timing(scrollAnimValue, {
      toValue: targetX,
      duration,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(() => {
      if (activeAnimListener.current) {
        scrollAnimValue.removeListener(activeAnimListener.current);
        activeAnimListener.current = null;
      }
      isProgrammaticScroll.current = false;
      const node = scrollRef.current?.getNode ? scrollRef.current.getNode() : scrollRef.current;
      node?.scrollTo({ x: targetX, animated: false });
    });
  };

  // Sync if navigated via route.params?.screen (e.g. from notification or deep link)
  useEffect(() => {
    if (route?.params?.screen) {
      const idx = TAB_ROUTES.findIndex((r) => r.name === route.params.screen);
      if (idx !== -1 && idx !== activeIndex) {
        goToTab(idx);
      }
    }
  }, [route?.params?.screen]);

  const updateActiveTabFromOffset = (offsetX) => {
    if (width <= 0) return;
    const newIdx = Math.round(offsetX / width);
    if (newIdx >= 0 && newIdx < TAB_ROUTES.length) {
      if (newIdx !== activeIndex) {
        setActiveIndex(newIdx);
        notifyTabFocus(TAB_ROUTES[newIdx].name);
      }
    }
  };

  const handleMomentumScrollEnd = (event) => {
    isProgrammaticScroll.current = false;
    updateActiveTabFromOffset(event.nativeEvent.contentOffset.x);
  };

  const createScreenNavigation = (tabName) => ({
    ...navigation,
    navigate: (target, params) => {
      const tabIdx = TAB_ROUTES.findIndex((r) => r.name === target);
      if (tabIdx !== -1) {
        goToTab(tabIdx);
      } else {
        navigation.navigate(target, params);
      }
    },
    addListener: (type, callback) => {
      if (type === 'focus') {
        listenersRef.current[tabName]?.add(callback);
        if (TAB_ROUTES[activeIndex]?.name === tabName) {
          callback();
        }
        return () => listenersRef.current[tabName]?.delete(callback);
      }
      return navigation.addListener(type, callback);
    },
    isFocused: () => TAB_ROUTES[activeIndex]?.name === tabName,
    setOptions: (...args) => navigation.setOptions?.(...args),
    reset: (...args) => navigation.reset(...args),
    goBack: (...args) => navigation.goBack(...args),
    dispatch: (...args) => navigation.dispatch(...args),
    canGoBack: (...args) => navigation.canGoBack(...args),
  });

  const tabNavigationProxy = {
    emit: () => ({ defaultPrevented: false }),
    navigate: (targetName) => {
      const idx = TAB_ROUTES.findIndex((r) => r.name === targetName);
      if (idx !== -1) {
        goToTab(idx);
      }
    },
  };

  const state = {
    index: activeIndex,
    routes: TAB_ROUTES,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        directionalLockEnabled={true}
        decelerationRate="normal"
        snapToInterval={width}
        snapToAlignment="start"
        disableIntervalMomentum={true}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          {
            useNativeDriver: true,
            listener: (e) => {
              currentScrollX.current = e.nativeEvent.contentOffset.x;
            }
          }
        )}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={{ flex: 1 }}
        contentContainerStyle={{ width: width * TAB_ROUTES.length, height: '100%' }}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width, height: '100%' }}>
          <HomeScreen navigation={createScreenNavigation('Home')} />
        </View>
        <View style={{ width, height: '100%' }}>
          <PdfExportScreen navigation={createScreenNavigation('PdfExport')} />
        </View>
        <View style={{ width, height: '100%' }}>
          <SplitBillScreen navigation={createScreenNavigation('SplitBill')} />
        </View>
        <View style={{ width, height: '100%' }}>
          <ProfileScreen navigation={createScreenNavigation('Profile')} />
        </View>
      </Animated.ScrollView>

      <CustomTabBar
        state={state}
        navigation={tabNavigationProxy}
        insets={insets}
        scrollX={scrollX}
        tabBarWidth={width}
      />
    </View>
  );
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntent();
  const [initialRoute, setInitialRoute] = useState(null);
  const { isDark, colors } = useTheme();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          setInitialRoute('Main');
        } else {
          setInitialRoute('Login');
        }
      } catch (err) {
        setInitialRoute('Login');
      } finally {
        // Hide the splash screen after auth check is complete
        await SplashScreen.hideAsync();
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

            // Navigate to Main to refresh data
            if (navigationRef.isReady()) {
              navigationRef.navigate('Main', { screen: 'Home' });
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

  useEffect(() => {
    if (Platform.OS === 'android') {
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor('transparent', true);
      RNStatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
    }
  }, [isDark]);

  if (initialRoute === null) {
    return null; // Don't render navigator until we know the initial route
  }

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar
          style={isDark ? "light" : "dark"}
          backgroundColor="transparent"
          translucent={true}
        />
        <RNStatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor="transparent"
          translucent={true}
        />
        <NavigationContainer ref={navigationRef} theme={navTheme}>
          <Stack.Navigator initialRouteName={initialRoute}>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="AddExpense"
              component={AddExpenseScreen}
              options={{
                title: 'Add Expense',
                headerStyle: { backgroundColor: colors.card },
                headerTintColor: colors.text,
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
