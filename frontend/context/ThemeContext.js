import React, { createContext, useState, useContext, useEffect } from 'react';
import { Text, TextInput, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

// Note: React Native's defaultProps override can be flaky for fonts across different versions.
// For best results, we specify fonts explicitly in our components.
// But we'll keep this as a secondary fallback.
try {
    const defaultTextStyle = Text.defaultProps || (Text.defaultProps = {});
    defaultTextStyle.style = { fontFamily: 'Inter-Regular' };

    const defaultInputStyle = TextInput.defaultProps || (TextInput.defaultProps = {});
    defaultInputStyle.style = { fontFamily: 'Inter-Regular' };
} catch (e) {
    console.log("Global style override failed", e);
}

export const ThemeProvider = ({ children }) => {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem('theme');
            if (savedTheme !== null) {
                setIsDarkMode(savedTheme === 'dark');
            }
        } catch (error) {
            console.log("Error loading theme", error);
        }
    };

    const toggleTheme = async () => {
        try {
            const newMode = !isDarkMode;
            setIsDarkMode(newMode);
            await AsyncStorage.setItem('theme', newMode ? 'dark' : 'light');
        } catch (error) {
            console.log("Error saving theme", error);
        }
    };

    const theme = {
        isDarkMode,
        colors: isDarkMode ? {
            background: '#0F172A', // Deeper navy for a more premium dark mode
            card: '#1E293B',
            text: '#F8FAFC',
            subtext: '#94A3B8',
            border: '#334155',
            primary: '#6366F1',
            success: '#10B981',
            error: '#EF4444'
        } : {
            background: '#F8FAFC', // Slate background for a modern light mode
            card: '#FFFFFF',
            text: '#0F172A',
            subtext: '#64748B',
            border: '#E2E8F0',
            primary: '#4F46E5',
            success: '#059669',
            error: '#DC2626'
        },
        toggleTheme
    };

    return (
        <ThemeContext.Provider value={theme}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
