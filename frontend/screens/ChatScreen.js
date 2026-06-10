import React, { useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
    Animated, Image, Modal, Dimensions, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { getDoubtMessages, sendDoubtMessage, uploadChatImage, uploadChatAudio, getMe, API_URL, deleteConversation } from '../api/api';
import { useTheme } from '../context/ThemeContext';
import { Audio } from 'expo-av';

const { width: SW } = Dimensions.get('window');
const IMG_W = SW * 0.58;

const ChatScreen = ({ route, navigation }) => {
    const { otherUserId, otherUserName, isOnline } = route.params;
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [showAttach, setShowAttach] = useState(false);
    const { isDarkMode, colors } = useTheme();

    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState(null);
    const [recordDuration, setRecordDuration] = useState(0);
    const recordTimerRef = useRef(null);
    const [playingAudioId, setPlayingAudioId] = useState(null);
    const [soundObject, setSoundObject] = useState(null);

    const flatListRef = useRef(null);
    const pollRef = useRef(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const attachAnim = useRef(new Animated.Value(0)).current;

    const initials = otherUserName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const fetchMessages = async (initial = false) => {
        try {
            const [msgRes, meRes] = await Promise.all([
                getDoubtMessages(otherUserId),
                initial ? getMe() : Promise.resolve({ data: currentUser })
            ]);
            setMessages(msgRes.data);
            if (initial) setCurrentUser(meRes.data);
        } catch (err) { console.log('Chat fetch error:', err); }
        finally { if (initial) setLoading(false); }
    };

    useFocusEffect(useCallback(() => {
        fetchMessages(true);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        pollRef.current = setInterval(() => fetchMessages(false), 5000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []));

    const toggleAttach = () => {
        const toVal = showAttach ? 0 : 1;
        setShowAttach(!showAttach);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.spring(attachAnim, { toValue: toVal, friction: 7, useNativeDriver: true }).start();
    };

    const handleDeleteChat = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert(
            "Delete Conversation",
            `Are you sure you want to delete your conversation with ${otherUserName}?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await deleteConversation(otherUserId);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            navigation.goBack();
                        } catch (e) {
                            Alert.alert("Error", "Could not delete conversation");
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleSend = async () => {
        const content = newMessage.trim();
        if (!content || sending) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSending(true);
        const tempMsg = { id: Date.now(), sender_id: currentUser?.id, receiver_id: otherUserId,
            content, image_url: null, created_at: new Date().toISOString(), is_read: false, _pending: true };
        setMessages(prev => [...prev, tempMsg]);
        setNewMessage('');
        try {
            await sendDoubtMessage({ receiver_id: otherUserId, content });
            await fetchMessages(false);
        } catch (err) {
            setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
            setNewMessage(content);
        } finally { setSending(false); }
    };

    const pickImage = async (useCamera) => {
        setShowAttach(false);
        Animated.timing(attachAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const perm = useCamera
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (perm.status !== 'granted') { Alert.alert('Permission Required', 'Please allow access.'); return; }
            const result = useCamera
                ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 })
                : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaType.Images, allowsEditing: true, quality: 0.7 });
            if (!result.canceled && result.assets?.[0]) await uploadAndSend(result.assets[0].uri);
        } catch (err) { Alert.alert('Error', 'Failed to pick image.'); }
    };

    const uploadAndSend = async (uri) => {
        setUploadingImage(true);
        try {
            const fd = new FormData();
            fd.append('file', { uri, name: `img_${Date.now()}.jpg`, type: 'image/jpeg' });
            const res = await uploadChatImage(fd);
            const content = newMessage.trim();
            setNewMessage('');
            await sendDoubtMessage({ receiver_id: otherUserId, content: content || 'Photo', image_url: res.data.image_url });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await fetchMessages(false);
        } catch { Alert.alert('Upload Failed', 'Could not send image.'); }
        finally { setUploadingImage(false); }
    };

    const startRecording = async () => {
        try {
            const perm = await Audio.requestPermissionsAsync();
            if (perm.status !== 'granted') return Alert.alert('Permission required', 'Please grant microphone access');
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            
            const { recording: newRec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            setRecording(newRec);
            setIsRecording(true);
            setRecordDuration(0);
            
            recordTimerRef.current = setInterval(() => {
                setRecordDuration(prev => prev + 1);
            }, 1000);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (err) { console.log('Failed to start recording', err); }
    };

    const stopRecording = async (cancel = false) => {
        if (!recording) return;
        setIsRecording(false);
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);
            
            if (cancel) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                return;
            }
            if (recordDuration < 1) return;
            
            setUploadingImage(true);
            const fd = new FormData();
            fd.append('file', { uri, name: `audio_${Date.now()}.m4a`, type: 'audio/m4a' });
            const res = await uploadChatAudio(fd);
            await sendDoubtMessage({ receiver_id: otherUserId, content: '🎙️ Voice Message', audio_url: res.data.audio_url });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await fetchMessages(false);
        } catch (err) { Alert.alert('Upload Failed', 'Could not send voice message.'); }
        finally { setUploadingImage(false); }
    };

    const playAudio = async (url, msgId) => {
        try {
            if (soundObject) {
                await soundObject.stopAsync();
                await soundObject.unloadAsync();
                setSoundObject(null);
                if (playingAudioId === msgId) {
                    setPlayingAudioId(null);
                    return;
                }
            }
            setPlayingAudioId(msgId);
            await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
            const audioUri = url?.startsWith('http') ? url : `${API_URL}${url}`;
            const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
            setSoundObject(sound);
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.didJustFinish) {
                    setPlayingAudioId(null);
                    sound.unloadAsync();
                    setSoundObject(null);
                }
            });
            await sound.playAsync();
        } catch (err) { console.log('Playback error', err); setPlayingAudioId(null); }
    };

    React.useEffect(() => { return () => { if (soundObject) soundObject.unloadAsync(); }; }, [soundObject]);

    const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const fmtDate = (d) => {
        const dt = new Date(d), now = new Date(), y = new Date(now); y.setDate(y.getDate() - 1);
        if (dt.toDateString() === now.toDateString()) return 'Today';
        if (dt.toDateString() === y.toDateString()) return 'Yesterday';
        return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    const showDateHdr = (i) => i === 0 || new Date(messages[i].created_at).toDateString() !== new Date(messages[i-1].created_at).toDateString();

    const renderMessage = ({ item, index }) => {
        const mine = item.sender_id === currentUser?.id;
        const hasImg = !!item.image_url;
        const hasAudio = !!item.audio_url;
        const hasText = item.content && item.content.trim() !== '' && item.content.trim() !== 'Photo' && item.content.trim() !== '📷' && item.content.trim() !== '🎙️ Voice Message';
        const showDt = showDateHdr(index);
        // Check if next message is from same sender (for grouping)
        const nextSame = index < messages.length - 1 && messages[index + 1].sender_id === item.sender_id;

        return (
            <View>
                {showDt && (
                    <View style={s.dateRow}>
                        <View style={[s.dateLine, { backgroundColor: colors.border }]} />
                        <View style={[s.datePill, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
                            <Text style={[s.dateText, { color: colors.subtext, fontFamily: 'Inter-SemiBold' }]}>{fmtDate(item.created_at)}</Text>
                        </View>
                        <View style={[s.dateLine, { backgroundColor: colors.border }]} />
                    </View>
                )}
                <View style={[s.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: nextSame ? 2 : 8 }]}>
                    {/* Receiver avatar (small, only on last of group) */}
                    {!mine && !nextSame ? (
                        <View style={[s.miniAvatar, { backgroundColor: '#34D399' + '25' }]}>
                            <Text style={{ color: '#34D399', fontSize: 10, fontFamily: 'Inter-Bold' }}>{initials}</Text>
                        </View>
                    ) : !mine ? <View style={{ width: 28 }} /> : null}

                    <View style={[
                        s.bubble,
                        mine ? {
                            backgroundColor: colors.primary,
                            borderBottomRightRadius: nextSame ? 20 : 6,
                            borderTopRightRadius: 20, borderTopLeftRadius: 20, borderBottomLeftRadius: 20,
                            marginLeft: 48,
                        } : {
                            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                            borderBottomLeftRadius: nextSame ? 20 : 6,
                            borderTopRightRadius: 20, borderTopLeftRadius: 20, borderBottomRightRadius: 20,
                            marginRight: 48,
                            borderWidth: isDarkMode ? 0 : 1, borderColor: colors.border + '80',
                        },
                        hasImg && { padding: 3, overflow: 'hidden' },
                        item._pending && { opacity: 0.55 },
                    ]}>
                        {hasImg && (
                            <TouchableOpacity activeOpacity={0.85} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPreviewImage(item.image_url?.startsWith('http') ? item.image_url : `${API_URL}${item.image_url}`); }}>
                                <View style={{ position: 'relative' }}>
                                    <Image source={{ uri: item.image_url?.startsWith('http') ? item.image_url : `${API_URL}${item.image_url}` }}
                                        style={[s.chatImg, { borderRadius: hasText ? 17 : 17, borderBottomLeftRadius: hasText ? 4 : (mine ? 17 : 4), borderBottomRightRadius: hasText ? 4 : (mine ? 4 : 17) }]}
                                        resizeMode="cover" />
                                    {!item._pending && (
                                        <View style={s.imgZoom}>
                                            <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                                        </View>
                                    )}
                                    {item._pending && <View style={s.imgOverlay}><ActivityIndicator color="#FFF" /></View>}
                                </View>
                            </TouchableOpacity>
                        )}
                        {hasAudio && (
                            <TouchableOpacity 
                                style={{ flexDirection: 'row', alignItems: 'center', padding: 8, paddingHorizontal: 12, backgroundColor: mine ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 16, marginTop: hasImg ? 6 : 0 }}
                                onPress={() => playAudio(item.audio_url, item.id)}
                            >
                                <Ionicons name={playingAudioId === item.id ? "stop-circle" : "play-circle"} size={32} color={mine ? '#FFF' : colors.primary} />
                                <View style={{ marginLeft: 10, height: 4, width: 80, backgroundColor: mine ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)', borderRadius: 2 }}>
                                    {playingAudioId === item.id && (
                                       <Animated.View style={{ height: 4, width: '50%', backgroundColor: mine ? '#FFF' : colors.primary, borderRadius: 2 }} />
                                    )}
                                </View>
                                <Text style={{ marginLeft: 10, fontSize: 12, color: mine ? '#FFF' : colors.subtext, fontFamily: 'Inter-Medium' }}>
                                     {playingAudioId === item.id ? "Playing" : "Audio"}
                                </Text>
                            </TouchableOpacity>
                        )}
                        {hasText && (
                            <Text style={[s.msgText, { color: mine ? '#FFFFFF' : colors.text, fontFamily: 'Inter-Regular',
                                marginTop: (hasImg || hasAudio) ? 6 : 0, paddingHorizontal: hasImg ? 9 : 0 }]}>
                                {item.content}
                            </Text>
                        )}
                        <View style={[s.msgFooter, (hasImg || hasAudio) && !hasText && { paddingHorizontal: 8, paddingBottom: 2 }]}>
                            <Text style={[s.msgTime, { color: mine ? 'rgba(255,255,255,0.6)' : colors.subtext, fontFamily: 'Inter-Medium' }]}>{fmtTime(item.created_at)}</Text>
                            {mine && <Ionicons name={item.is_read ? "checkmark-done" : "checkmark"} size={14}
                                color={item.is_read ? '#93C5FD' : 'rgba(255,255,255,0.45)'} style={{ marginLeft: 4 }} />}
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    if (loading) return (
        <SafeAreaView style={[s.container, { backgroundColor: colors.background }]}>
            <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
        </SafeAreaView>
    );

    return (
        <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[s.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[s.headerBackBtn, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
                    <Ionicons name="chevron-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <View style={[s.headerAv, { backgroundColor: colors.primary + '18' }]}>
                    <Text style={[s.headerAvText, { color: colors.primary, fontFamily: 'Inter-ExtraBold' }]}>{initials}</Text>
                    {isOnline && <View style={[s.onlineDot, { borderColor: colors.card }]} />}
                </View>
                <View style={s.headerInfo}>
                    <Text style={[s.headerName, { color: colors.text, fontFamily: 'Inter-Bold' }]} numberOfLines={1}>{otherUserName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isOnline ? '#34D399' : colors.subtext, marginRight: 5 }} />
                        <Text style={[s.headerSub, { color: isOnline ? '#34D399' : colors.subtext, fontFamily: 'Inter-Medium' }]}>{isOnline ? 'Available' : 'Offline'}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={handleDeleteChat} style={[s.headerBackBtn, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9', marginLeft: 'auto' }]}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                </TouchableOpacity>
            </View>

            {/* Upload banner */}
            {uploadingImage && (
                <View style={[s.uploadBar, { backgroundColor: colors.primary + '12' }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[s.uploadText, { color: colors.primary, fontFamily: 'Inter-SemiBold' }]}>Uploading attachment...</Text>
                    <View style={[s.uploadProgress, { backgroundColor: colors.primary + '30' }]}>
                        <Animated.View style={[s.uploadProgressFill, { backgroundColor: colors.primary }]} />
                    </View>
                </View>
            )}

            {/* Messages */}
            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                {messages.length === 0 ? (
                    <View style={s.emptyChat}>
                        <View style={[s.emptyOuter, { backgroundColor: colors.primary + '08' }]}>
                            <View style={[s.emptyInner, { backgroundColor: colors.primary + '15' }]}>
                                <Ionicons name="chatbubbles" size={42} color={colors.primary} />
                            </View>
                        </View>
                        <Text style={[s.emptyTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Say hello! 👋</Text>
                        <Text style={[s.emptySub, { color: colors.subtext, fontFamily: 'Inter-Regular' }]}>
                            Ask your doubt below.{'\n'}{otherUserName} will reply soon!
                        </Text>
                    </View>
                ) : (
                    <FlatList ref={flatListRef} data={messages} keyExtractor={i => i.id.toString()} renderItem={renderMessage}
                        contentContainerStyle={{ padding: 14, paddingBottom: 8 }} showsVerticalScrollIndicator={false}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })} />
                )}
            </Animated.View>

            {/* Attachment Popover */}
            {showAttach && (
                <Animated.View style={[s.attachMenu, {
                    backgroundColor: colors.card, borderColor: colors.border,
                    transform: [{ scale: attachAnim }, { translateY: attachAnim.interpolate({ inputRange: [0,1], outputRange: [20, 0] }) }],
                    opacity: attachAnim,
                }]}>
                    <TouchableOpacity style={s.attachItem} onPress={() => pickImage(false)} activeOpacity={0.7}>
                        <View style={[s.attachIcon, { backgroundColor: '#818CF8' + '20' }]}>
                            <Ionicons name="images" size={22} color="#818CF8" />
                        </View>
                        <Text style={[s.attachLabel, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.attachItem} onPress={() => pickImage(true)} activeOpacity={0.7}>
                        <View style={[s.attachIcon, { backgroundColor: '#34D399' + '20' }]}>
                            <Ionicons name="camera" size={22} color="#34D399" />
                        </View>
                        <Text style={[s.attachLabel, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>Camera</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* Input Bar */}
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
            >
                <View style={[s.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                    <TouchableOpacity style={[s.plusBtn, { backgroundColor: showAttach ? colors.primary : (isDarkMode ? '#1E293B' : '#F1F5F9') }]}
                        onPress={toggleAttach} disabled={uploadingImage || isRecording} activeOpacity={0.7}>
                        <Ionicons name={showAttach ? "close" : "add"} size={22} color={showAttach ? '#FFF' : colors.primary} />
                    </TouchableOpacity>
                    
                    {isRecording ? (
                        <View style={[s.inputWrap, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#EF4444', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 8 }} />
                                <Text style={{ color: '#EF4444', fontFamily: 'Inter-Bold', fontSize: 14 }}>
                                    Recording {Math.floor(recordDuration/60)}:{(recordDuration%60).toString().padStart(2, '0')}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => stopRecording(true)}>
                                 <Text style={{ color: colors.subtext, fontFamily: 'Inter-Medium', fontSize: 13, padding: 4 }}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={[s.inputWrap, { backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9', borderColor: colors.border }]}>
                            <TextInput style={[s.textInput, { color: colors.text, fontFamily: 'Inter-Regular' }]}
                                placeholder="Type your doubt..." placeholderTextColor={colors.subtext}
                                value={newMessage} onChangeText={setNewMessage} multiline maxLength={1000}
                                onFocus={() => { if (showAttach) toggleAttach(); }} />
                        </View>
                    )}

                    <TouchableOpacity style={[s.sendBtn, { backgroundColor: isRecording ? '#10B981' : (newMessage.trim() ? colors.primary : (isDarkMode ? '#334155' : '#E2E8F0')) }]}
                        onPress={isRecording ? () => stopRecording(false) : (newMessage.trim() ? handleSend : startRecording)} 
                        disabled={!newMessage.trim() && !isRecording && sending} activeOpacity={0.8}>
                        {sending ? <ActivityIndicator color="#FFF" size="small" /> :
                            <Ionicons name={isRecording ? "send" : (newMessage.trim() ? "send" : "mic")} size={18} color={(newMessage.trim() || isRecording) ? '#FFF' : colors.subtext} style={{ marginLeft: 2 }} />}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Image Preview */}
            <Modal visible={!!previewImage} transparent animationType="fade">
                <View style={s.prevOverlay}>
                    <SafeAreaView style={{ width: '100%', alignItems: 'flex-end', paddingRight: 16 }}>
                        <TouchableOpacity style={s.prevClose} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPreviewImage(null); }}>
                            <Ionicons name="close" size={22} color="#FFF" />
                        </TouchableOpacity>
                    </SafeAreaView>
                    {previewImage && <Image source={{ uri: previewImage }} style={s.prevImg} resizeMode="contain" />}
                    <Text style={s.prevHint}>Pinch to zoom</Text>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const s = StyleSheet.create({
    container: { flex: 1 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
    headerBackBtn: { width: 38, height: 38, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
    headerAv: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginLeft: 10, position: 'relative' },
    headerAvText: { fontSize: 14 },
    onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#34D399', borderWidth: 2.5 },
    headerInfo: { flex: 1, marginLeft: 12 },
    headerName: { fontSize: 17, letterSpacing: -0.3 },
    headerSub: { fontSize: 12 },
    uploadBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 8 },
    uploadText: { fontSize: 13 },
    uploadProgress: { width: 60, height: 3, borderRadius: 2, overflow: 'hidden' },
    uploadProgressFill: { width: '60%', height: '100%', borderRadius: 2 },
    // Date header
    dateRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18, paddingHorizontal: 12 },
    dateLine: { flex: 1, height: 1 },
    datePill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, marginHorizontal: 10 },
    dateText: { fontSize: 11, letterSpacing: 0.2 },
    // Bubbles
    bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 6 },
    miniAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 4, marginBottom: 1 },
    bubble: { maxWidth: '76%', padding: 11, paddingBottom: 5, borderRadius: 20,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
    msgText: { fontSize: 15, lineHeight: 22 },
    msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 },
    msgTime: { fontSize: 10 },
    chatImg: { width: IMG_W, height: IMG_W * 0.75, borderRadius: 17 },
    imgZoom: { position: 'absolute', bottom: 6, right: 6, width: 28, height: 28, borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
    imgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
    // Empty
    emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyOuter: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    emptyInner: { width: 84, height: 84, borderRadius: 42, justifyContent: 'center', alignItems: 'center' },
    emptyTitle: { fontSize: 22, marginBottom: 6, marginTop: 8 },
    emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
    // Attach popover
    attachMenu: { position: 'absolute', bottom: 75, left: 12, flexDirection: 'row', padding: 10, borderRadius: 20, borderWidth: 1,
        shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
    attachItem: { alignItems: 'center', marginHorizontal: 12 },
    attachIcon: { width: 52, height: 52, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    attachLabel: { fontSize: 12 },
    // Input
    inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1,
        paddingBottom: Platform.OS === 'ios' ? 26 : 8 },
    plusBtn: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
    inputWrap: { flex: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, marginHorizontal: 6, borderWidth: 1, maxHeight: 110, justifyContent: 'center' },
    textInput: { fontSize: 15, lineHeight: 20, maxHeight: 90, paddingVertical: 0, textAlignVertical: 'center' },
    sendBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginBottom: 2,
        shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
    // Preview
    prevOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    prevClose: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
    prevImg: { width: SW - 20, height: '65%' },
    prevHint: { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: 'Inter-Medium', marginTop: 16 },
});

export default ChatScreen;
