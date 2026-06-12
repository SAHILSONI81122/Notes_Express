import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBatch, uploadFile } from '../api/api';
import { useTheme } from '../context/ThemeContext';

const CreateCoachingScreen = ({ navigation }) => {
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [logoUri, setLogoUri] = useState(null);
    const [logoUrl, setLogoUrl] = useState('');
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const { isDarkMode, colors } = useTheme();

    const pickImage = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Permission to access camera roll is required!');
                return;
            }

            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });

            if (!result.canceled) {
                const selectedUri = result.assets[0].uri;
                setLogoUri(selectedUri);
                await uploadImage(selectedUri);
            }
        } catch (error) {
            console.log(error);
        }
    };

    const uploadImage = async (uri) => {
        setIsUploadingLogo(true);
        try {
            const formData = new FormData();
            formData.append('file', {
                uri,
                name: 'coaching_logo.jpg',
                type: 'image/jpeg',
            });

            const res = await uploadFile(formData);
            setLogoUrl(res.data.file_url);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.log(error);
            Alert.alert("Error", "Failed to upload logo image");
        } finally {
            setIsUploadingLogo(false);
        }
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Required", "Please enter your coaching institute's name.");
            return;
        }

        if (isUploadingLogo) {
            Alert.alert("Please Wait", "The logo is still uploading.");
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsLoading(true);
        try {
            await createBatch({ name, address, logo_url: logoUrl });
            await AsyncStorage.removeItem('selectedClassGroupId');
            await AsyncStorage.removeItem('selectedClassName');
            await AsyncStorage.removeItem('cached_user_profile');
            await AsyncStorage.removeItem('cached_user_batch_id');
            await AsyncStorage.removeItem('cached_user_role');
            await AsyncStorage.removeItem('recent_notes_v1');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", "Coaching group created! You can now invite students and teachers.");
            navigation.dispatch(
                CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'MainApp' }],
                })
            );
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            let errorMsg = "Could not create group. Please check your network.";
            if (error.response && error.response.data && error.response.data.detail) {
                errorMsg = error.response.data.detail;
            }
            Alert.alert("Error", errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.goBack();
                        }}
                        style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter-ExtraBold' }]}>New Group</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.logoUpload}>
                        <TouchableOpacity
                            style={[styles.logoCircle, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6', borderColor: colors.border }]}
                            onPress={pickImage}
                            disabled={isUploadingLogo}
                        >
                            {isUploadingLogo ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : logoUri ? (
                                <>
                                    <View style={styles.imageWrapper}>
                                        <Image source={{ uri: logoUri }} style={styles.logoImage} />
                                    </View>
                                    <View style={[styles.plusBadge, { backgroundColor: colors.primary }]}>
                                        <Ionicons name="pencil" size={12} color="#FFF" />
                                    </View>
                                </>
                            ) : (
                                <>
                                    <Ionicons name="camera-outline" size={32} color={colors.primary} />
                                    <View style={[styles.plusBadge, { backgroundColor: colors.primary }]}>
                                        <Ionicons name="add" size={14} color="#FFF" />
                                    </View>
                                </>
                            )}
                        </TouchableOpacity>
                        <Text style={[styles.uploadText, { color: colors.primary, fontFamily: 'Inter-Bold' }]}>
                            {logoUri ? 'Change Logo' : 'Add Institute Logo'}
                        </Text>
                    </View>

                    <Text style={[styles.label, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Institute Name</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border, fontFamily: 'Inter-Medium' }]}
                        placeholder="e.g. Science Coaching Centre"
                        placeholderTextColor={colors.subtext}
                        value={name}
                        onChangeText={setName}
                    />

                    <Text style={[styles.label, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Location / Address</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border, fontFamily: 'Inter-Medium', height: 120, textAlignVertical: 'top', paddingTop: 16 }]}
                        placeholder="Where is your institute located?"
                        placeholderTextColor={colors.subtext}
                        value={address}
                        onChangeText={setAddress}
                        multiline
                    />

                    <TouchableOpacity
                        disabled={isLoading}
                        style={[styles.createButton, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]}
                        onPress={handleCreate}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={[styles.createButtonText, { fontFamily: 'Inter-Bold' }]}>Launch Institute</Text>
                        )}
                    </TouchableOpacity>
                    <Text style={[styles.hintText, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                        You can create class-specific subgroups later from the dashboard.
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    inner: { flex: 1, paddingHorizontal: 24 },
    header: { flexDirection: 'row', alignItems: 'center', marginTop: 15, marginBottom: 32 },
    backButton: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center',
        marginRight: 16, borderWidth: 1,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
    },
    title: { fontSize: 28 },
    form: { flex: 1 },
    logoUpload: { alignItems: 'center', marginBottom: 40 },
    logoCircle: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center', marginBottom: 14, borderWidth: 2, borderStyle: 'dashed', position: 'relative' },
    imageWrapper: { width: '100%', height: '100%', borderRadius: 55, overflow: 'hidden' },
    logoImage: { width: '100%', height: '100%' },
    plusBadge: { position: 'absolute', bottom: 4, right: 4, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF', zIndex: 10 },
    uploadText: { fontSize: 14 },
    label: { fontSize: 16, marginBottom: 10, marginLeft: 4 },
    input: {
        borderWidth: 1, borderRadius: 16,
        paddingHorizontal: 20, height: 58, fontSize: 16, marginBottom: 24,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1
    },
    createButton: {
        borderRadius: 20, height: 62, justifyContent: 'center', alignItems: 'center', marginTop: 12,
        shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4
    },
    createButtonText: { color: '#FFFFFF', fontSize: 18 },
    hintText: { fontSize: 13, textAlign: 'center', marginTop: 24, lineHeight: 18, paddingHorizontal: 20 }
});

export default CreateCoachingScreen;
