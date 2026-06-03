import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';

/**
 * OfflineBanner — slides down from the top when the device loses internet.
 * Slides back up automatically when connectivity is restored.
 *
 * Usage: place it just inside your root SafeAreaProvider / ThemeProvider.
 */
const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = useRef(new Animated.Value(-60)).current;

  const show = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  };

  const hide = () => {
    Animated.timing(slideAnim, {
      toValue: -60,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    let interval;

    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        const offline = !state.isConnected || !state.isInternetReachable;
        setIsOffline(offline);
        offline ? show() : hide();
      } catch (_) {
        // silently ignore network check errors
      }
    };

    checkNetwork();
    // Poll every 5 seconds — lightweight enough for mobile
    interval = setInterval(checkNetwork, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}
    >
      <Ionicons name="cloud-offline-outline" size={18} color="#fff" style={styles.icon} />
      <Text style={styles.text}>No Internet Connection</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    // Push below the status bar on most devices
    paddingTop: 44,
  },
  icon: { marginRight: 8 },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default OfflineBanner;
