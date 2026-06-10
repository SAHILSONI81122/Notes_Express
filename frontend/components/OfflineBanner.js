import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * OfflineBanner — slides up from the bottom when the device loses internet.
 * Slides back down automatically when connectivity is restored.
 */
const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = useRef(new Animated.Value(100)).current;
  const insets = useSafeAreaInsets();

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
      toValue: 100,
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
    interval = setInterval(checkNetwork, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.banner, 
        { 
          transform: [{ translateY: slideAnim }],
          paddingBottom: Math.max(insets.bottom, 16)
        }
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={18} color="#fff" style={styles.icon} />
      <Text style={styles.text}>No Internet Connection</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  icon: { marginRight: 8 },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
});

export default OfflineBanner;
