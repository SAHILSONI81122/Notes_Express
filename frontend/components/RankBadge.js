import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export const RANKS_LADDER = [
    { name: 'ROOKIE', xpRequired: 0, colors: ['#9ca3af', '#4b5563'], icon: 'star-outline', type: 'ionicon' },
    { name: 'BRONZE', xpRequired: 500, colors: ['#b45309', '#78350f'], icon: 'star', type: 'ionicon' },
    { name: 'SILVER', xpRequired: 1000, colors: ['#cbd5e1', '#64748b'], icon: 'shield', type: 'ionicon' },
    { name: 'GOLD', xpRequired: 2000, colors: ['#fbbf24', '#b45309'], icon: 'shield-star', type: 'material' },
    { name: 'PLATINUM', xpRequired: 4000, colors: ['#2dd4bf', '#0f766e'], icon: 'diamond', type: 'material' },
    { name: 'DIAMOND', xpRequired: 7000, colors: ['#38bdf8', '#0369a1'], icon: 'crown', type: 'material' },
    { name: 'ELITE', xpRequired: 12000, colors: ['#ec4899', '#be123c'], icon: 'lightning-bolt', type: 'material' },
];

export const getRankInfo = (xp) => {
    // Find the highest rank where the user's XP is >= the required XP
    for (let i = RANKS_LADDER.length - 1; i >= 0; i--) {
        if (xp >= RANKS_LADDER[i].xpRequired) {
            return RANKS_LADDER[i];
        }
    }
    return RANKS_LADDER[0];
};

export const RankBadge = ({ xp, size = 'normal' }) => {
    const rank = getRankInfo(xp || 0);
    const isSmall = size === 'small';
    
    return (
        <LinearGradient 
            colors={rank.colors} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }} 
            style={[styles.badge, isSmall ? styles.badgeSmall : styles.badgeNormal]}
        >
            {rank.type === 'ionicon' ? (
                <Ionicons name={rank.icon} size={isSmall ? 10 : 14} color="#FFF" />
            ) : (
                <MaterialCommunityIcons name={rank.icon} size={isSmall ? 10 : 14} color="#FFF" />
            )}
            <Text style={[styles.text, isSmall ? styles.textSmall : styles.textNormal]}>
                {rank.name}
            </Text>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 3,
    },
    badgeNormal: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 6,
    },
    badgeSmall: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        gap: 4,
    },
    text: {
        color: '#FFF',
        fontFamily: 'Inter-Black',
    },
    textNormal: {
        fontSize: 12,
        letterSpacing: 0.5,
    },
    textSmall: {
        fontSize: 9,
        letterSpacing: 0.5,
    }
});
