import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { getMe, switchBatch, getClassGroups, createClassGroup, getUnreadCount, initializeAuthToken, API_URL } from '../api/api';
import { useTheme } from '../context/ThemeContext';
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import StudentDashboard from '../screens/StudentDashboard';
import NotesScreen from '../screens/NotesScreen';
import DPPScreen from '../screens/DPPScreen';
import CoachingSelectionScreen from '../screens/CoachingSelectionScreen';
import CreateCoachingScreen from '../screens/CreateCoachingScreen';
import JoinCoachingScreen from '../screens/JoinCoachingScreen';
import AddMembersScreen from '../screens/AddMembersScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import MembersListScreen from '../screens/MembersListScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FolderNotesScreen from '../screens/FolderNotesScreen';
import CoachingInfoScreen from '../screens/CoachingInfoScreen';
import DoubtsScreen from '../screens/DoubtsScreen';
import ChatScreen from '../screens/ChatScreen';
import ClassProgressScreen from '../screens/ClassProgressScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import BoosterScreen from '../screens/BoosterScreen';
import ChestScreen from '../screens/ChestScreen';
import BrainGamesScreen from '../screens/BrainGamesScreen';
import PdfViewerScreen from '../screens/PdfViewerScreen';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

const CustomDrawerContent = (props) => {
    const [user, setUser] = React.useState(null);
    const [showGroup, setShowGroup] = React.useState(false);
    const [error, setError] = React.useState(null);
    const { isDarkMode, colors } = useTheme();

    const [classGroups, setClassGroups] = React.useState([]);
    const [showClasses, setShowClasses] = React.useState(false);
    const [showCreateClass, setShowCreateClass] = React.useState(false);
    const [selectedClassId, setSelectedClassId] = React.useState(null);
    const [newClassName, setNewClassName] = React.useState('');
    const [unreadDoubts, setUnreadDoubts] = React.useState(0);

    const fetchUser = async () => {
        setError(null);
        try {
            const res = await getMe();
            setUser(res.data);
            await AsyncStorage.setItem('cached_user_profile', JSON.stringify(res.data));

            // Cache institute branding for white-label splash screen on next launch
            if (res.data.institute?.name) {
                await AsyncStorage.setItem('institute_name', res.data.institute.name);
            }
            if (res.data.institute?.logo_url) {
                await AsyncStorage.setItem('institute_logo_url', res.data.institute.logo_url);
            }
            
            // Load last selected class
            const savedId = await AsyncStorage.getItem('selectedClassGroupId');
            if (savedId) setSelectedClassId(Number(savedId));

            // Fetch unread doubts count
            try {
                const unreadRes = await getUnreadCount();
                setUnreadDoubts(unreadRes.data.unread_count || 0);
            } catch (e) { console.log('Unread fetch failed'); }

            if (res.data.batch_id && (res.data.role === 'admin' || res.data.role === 'teacher')) {
                const cgRes = await getClassGroups(res.data.batch_id);
                setClassGroups(cgRes.data);
                
                // Auto-select first class if none is selected but classes exist
                if (!savedId && cgRes.data.length > 0) {
                    await handleSelectClass(cgRes.data[0].id, cgRes.data[0].name);
                }
            }
        } catch (err) {
            console.log("Drawer network error, trying cache", err);
            const cachedProfileStr = await AsyncStorage.getItem('cached_user_profile');
            if (cachedProfileStr) {
                const cachedUser = JSON.parse(cachedProfileStr);
                setUser(cachedUser);
            } else {
                setError("Connection Failed");
            }
        }
    };

    const handleCreateClass = async () => {
        if (!newClassName.trim() || !user?.batch_id) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await createClassGroup(user.batch_id, { name: newClassName });
            setNewClassName('');
            setShowCreateClass(false);
            fetchUser();
        } catch (error) {
            Alert.alert("Error", "Could not create class group.");
        }
    };

    React.useEffect(() => {
        fetchUser();
    }, []);

    const handleSelectClass = async (classId, className) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedClassId(classId);
        await AsyncStorage.setItem('selectedClassGroupId', classId.toString());
        await AsyncStorage.setItem('selectedClassName', className);
        props.navigation.closeDrawer();
        props.navigation.navigate('Dashboard', { refresh: Date.now() });
    };

    const handleSwitch = async (batchId) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await AsyncStorage.removeItem('selectedClassGroupId');
            await AsyncStorage.removeItem('selectedClassName');
            await switchBatch(batchId);
            fetchUser();
            props.navigation.closeDrawer();
            props.navigation.navigate('Dashboard');
        } catch (err) {
            console.log("Switch failed", err);
        }
    };

    return (
        <DrawerContentScrollView {...props} style={{ backgroundColor: colors.card }}>
            <View style={{ padding: 24, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {/* Institute logo — shows coaching logo if available, else NotesExpress logo */}
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#111827', overflow: 'hidden', marginRight: 12, justifyContent: 'center', alignItems: 'center' }}>
                        {user?.institute?.logo_url ? (
                            <Image
                                source={{ uri: `${user.institute.logo_url?.startsWith('http') ? user.institute.logo_url : `\${API_URL}\${user.institute.logo_url}`}` }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                            />
                        ) : (
                            <Image
                                source={require('../assets/notes_express_logo.png')}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                            />
                        )}
                    </View>
                    {/* Institute name — shows coaching name if available, else NotesExpress */}
                    <Text style={{ fontSize: 20, color: colors.text, fontFamily: 'Inter-ExtraBold', letterSpacing: -0.5, flex: 1, flexWrap: 'wrap' }}>
                        {user?.institute?.name
                            ? user.institute.name
                            : <Text>Notes<Text style={{ color: colors.primary }}>Express</Text></Text>
                        }
                    </Text>
                </View>
                {user && (
                    <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: 8 }} />
                        <Text style={{ fontSize: 13, color: colors.subtext, fontFamily: 'Inter-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {user.role} Portal
                        </Text>
                    </View>
                )}
            </View>

            {/* NAVIGATION SECTION */}
            <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter-ExtraBold', color: colors.subtext, textTransform: 'uppercase', letterSpacing: 1 }}>Navigation</Text>
            </View>
            
            <DrawerItem 
                label="My Profile" 
                labelStyle={{ color: colors.text, fontFamily: 'Inter-SemiBold', fontSize: 15 }}
                icon={({ color }) => <Ionicons name="person-outline" size={22} color={colors.subtext} />}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    props.navigation.navigate('Profile');
                }}
            />
            
            <DrawerItem 
                label="Coaching Info" 
                labelStyle={{ color: colors.text, fontFamily: 'Inter-SemiBold', fontSize: 15 }}
                icon={({ color }) => <Ionicons name="business-outline" size={22} color={colors.subtext} />}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    props.navigation.navigate('CoachingInfo');
                }}
            />

            <DrawerItem 
                label={user?.role === 'student' ? "Ask Doubts" : "Doubts"} 
                labelStyle={{ color: colors.text, fontFamily: 'Inter-SemiBold', fontSize: 15 }}
                icon={({ color }) => (
                    <View style={{ position: 'relative' }}>
                        <Ionicons name="chatbubbles-outline" size={22} color={colors.subtext} />
                        {unreadDoubts > 0 && (
                            <View style={{ position: 'absolute', top: -6, right: -8, backgroundColor: colors.error, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>{unreadDoubts > 9 ? '9+' : unreadDoubts}</Text>
                            </View>
                        )}
                    </View>
                )}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    props.navigation.navigate('DoubtsScreen');
                }}
            />
            
            <DrawerItemList {...props} />

            {/* MY GROUPS SECTION */}
            {user?.role !== 'admin' && (
                <>
                    <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, fontFamily: 'Inter-ExtraBold', color: colors.subtext, textTransform: 'uppercase', letterSpacing: 1 }}>Institutes</Text>
                    </View>
                    <DrawerItem 
                        label="Switch Group" 
                        labelStyle={{ color: colors.text, fontFamily: 'Inter-SemiBold', fontSize: 15 }}
                        icon={({ color }) => <Ionicons name="swap-horizontal-outline" size={22} color={colors.subtext} />}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowGroup(!showGroup);
                        }}
                    />
                    {showGroup && (
                        <View style={{ paddingHorizontal: 12 }}>
                            {user?.all_batches?.length > 0 ? (
                                user.all_batches.map((b) => (
                                    <TouchableOpacity 
                                        key={b.id}
                                        onPress={() => handleSwitch(b.id)}
                                        style={{ 
                                            padding: 16, 
                                            backgroundColor: b.id === user.batch_id ? colors.primary + '1A' : 'transparent', 
                                            borderRadius: 16, 
                                            marginBottom: 6,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            borderWidth: 1,
                                            borderColor: b.id === user.batch_id ? colors.primary : 'transparent'
                                        }}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 15, fontFamily: 'Inter-Bold', color: b.id === user.batch_id ? colors.primary : colors.text }}>
                                                {b.name}
                                            </Text>
                                        </View>
                                        {b.id === user.batch_id && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={{ fontSize: 13, color: colors.subtext, textAlign: 'center', marginVertical: 10, fontFamily: 'Inter-Medium' }}>No other groups</Text>
                            )}
                        </View>
                    )}
                </>
            )}
            
            {/* MANAGE SECTION */}
            {(user?.role === 'admin' || user?.role === 'teacher') && (
                <>
                    <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, fontFamily: 'Inter-ExtraBold', color: colors.subtext, textTransform: 'uppercase', letterSpacing: 1 }}>Administration</Text>
                    </View>
                     <DrawerItem 
                        label="Invite Student" 
                        labelStyle={{ color: colors.text, fontFamily: 'Inter-SemiBold', fontSize: 15 }}
                        icon={({ color }) => <Ionicons name="person-add-outline" size={22} color={colors.subtext} />}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            props.navigation.closeDrawer();
                            setTimeout(() => {
                                props.navigation.navigate('AddMembers', { role: 'student', initialUser: user });
                            }, 100);
                        }}
                    />
                    <DrawerItem 
                        label="Invite Teacher" 
                        labelStyle={{ color: colors.text, fontFamily: 'Inter-SemiBold', fontSize: 15 }}
                        icon={({ color }) => <Ionicons name="ribbon-outline" size={22} color={colors.subtext} />}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            props.navigation.closeDrawer();
                            setTimeout(() => {
                                props.navigation.navigate('AddMembers', { role: 'teacher', initialUser: user });
                            }, 100);
                        }}
                    />
                    <DrawerItem 
                        label="Manage Members" 
                        labelStyle={{ color: colors.text, fontFamily: 'Inter-SemiBold', fontSize: 15 }}
                        icon={({ color }) => <Ionicons name="people-outline" size={22} color={colors.subtext} />}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            props.navigation.closeDrawer();
                            setTimeout(() => {
                                props.navigation.navigate('MembersList', { initialUser: user });
                            }, 100);
                        }}
                    />
                    
                    <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, fontFamily: 'Inter-ExtraBold', color: colors.subtext, textTransform: 'uppercase', letterSpacing: 1 }}>Active Classes</Text>
                    </View>
                    <DrawerItem 
                        label="Classes" 
                        labelStyle={{ color: colors.text, fontFamily: 'Inter-SemiBold', fontSize: 15 }}
                        icon={({ color }) => <Ionicons name="layers-outline" size={22} color={colors.subtext} />}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowClasses(!showClasses);
                        }}
                    />
                    {showClasses && (
                        <View style={{ paddingHorizontal: 12 }}>
                            {classGroups.map(cg => (
                                <TouchableOpacity 
                                    key={cg.id} 
                                    style={{ 
                                        padding: 14, 
                                        borderRadius: 12, 
                                        backgroundColor: cg.id === selectedClassId ? colors.primary + '15' : (isDarkMode ? '#1F2937' : '#F9FAFB'), 
                                        marginBottom: 6, 
                                        flexDirection: 'row', 
                                        alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: cg.id === selectedClassId ? colors.primary + '40' : 'transparent'
                                    }}
                                    onPress={() => handleSelectClass(cg.id, cg.name)}
                                >
                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cg.id === selectedClassId ? colors.primary : colors.subtext, marginRight: 12 }} />
                                    <Text style={{ color: cg.id === selectedClassId ? colors.primary : colors.text, fontSize: 14, fontFamily: cg.id === selectedClassId ? 'Inter-Bold' : 'Inter-Medium', flex: 1 }}>{cg.name}</Text>
                                    {cg.id === selectedClassId ? (
                                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                                    ) : (
                                        <Ionicons name="chevron-forward" size={14} color={colors.subtext} />
                                    )}
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity 
                                style={{ padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setShowCreateClass(true);
                                }}
                            >
                                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                                <Text style={{ color: colors.primary, fontSize: 14, marginLeft: 8, fontFamily: 'Inter-Bold' }}>Create New Class</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </>
            )}

            <View style={{ marginTop: 40, padding: 20, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ fontSize: 10, color: colors.subtext, fontFamily: 'Inter-Bold', textAlign: 'center', marginBottom: 12, opacity: 0.5 }}>{(Constants.expoConfig?.name || 'NOTESEXPRESS').toUpperCase()} PREMIUM v2.1</Text>
            </View>
            
            <Modal visible={showCreateClass} transparent animationType="fade">
                <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }} activeOpacity={1} onPress={() => setShowCreateClass(false)}>
                    <View style={{ width: '100%', borderRadius: 32, padding: 32, backgroundColor: colors.card, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 }}>
                        <Text style={{ fontSize: 22, fontFamily: 'Inter-Bold', marginBottom: 24, color: colors.text }}>New Class Group</Text>
                        <TextInput
                            style={{ borderWidth: 1, borderRadius: 16, padding: 18, fontSize: 16, marginBottom: 24, color: colors.text, borderColor: colors.border, backgroundColor: colors.background, fontFamily: 'Inter-Medium' }}
                            placeholder="e.g. Physics 101"
                            placeholderTextColor={colors.subtext}
                            value={newClassName}
                            onChangeText={setNewClassName}
                            autoFocus
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                            <TouchableOpacity style={{ paddingVertical: 14, paddingHorizontal: 20 }} onPress={() => setShowCreateClass(false)}>
                                <Text style={{ color: colors.subtext, fontFamily: 'Inter-Bold' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, backgroundColor: colors.primary }} onPress={handleCreateClass}>
                                <Text style={{ color: '#FFF', fontFamily: 'Inter-Bold' }}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </DrawerContentScrollView>
    );
};

const DrawerNavigator = () => {
    const { colors } = useTheme();
    return (
        <Drawer.Navigator 
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{ 
                headerShown: false,
                drawerType: 'front',
                drawerStyle: {
                    backgroundColor: colors.card,
                    width: 300,
                },
                drawerActiveTintColor: colors.primary,
                drawerInactiveTintColor: colors.subtext,
                drawerActiveBackgroundColor: colors.primary + '10',
                drawerLabelStyle: {
                    fontFamily: 'Inter-SemiBold',
                    fontSize: 15,
                    marginLeft: -10
                }
            }}
        >
            <Drawer.Screen 
                name="Dashboard" 
                component={StudentDashboard} 
                options={{
                    drawerIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />
                }}
            />
            <Drawer.Screen 
                name="Notes" 
                component={NotesScreen} 
                options={{
                    drawerIcon: ({ color }) => <Ionicons name="document-text-outline" size={22} color={color} />
                }}
            />
            <Drawer.Screen 
                name="DPP" 
                component={DPPScreen} 
                options={{
                    drawerIcon: ({ color }) => <Ionicons name="create-outline" size={22} color={color} />
                }}
            />
            <Drawer.Screen 
                name="CoachingInfo" 
                component={CoachingInfoScreen} 
                options={{
                    drawerItemStyle: { display: 'none' } // Hidden because we handle it manually in CustomDrawer
                }}
            />
            <Drawer.Screen 
                name="Leaderboard" 
                component={LeaderboardScreen} 
                options={{
                    drawerIcon: ({ color }) => <Ionicons name="trophy-outline" size={22} color={color} />
                }}
            />
        </Drawer.Navigator>
    );
};

const AppNavigator = () => {
    const [isLoading, setIsLoading] = React.useState(true);
    const [userToken, setUserToken] = React.useState(null);
    const [hasBatch, setHasBatch] = React.useState(false);

    React.useEffect(() => {
        const checkAuth = async () => {
            const token = await initializeAuthToken();
            if (token) {
                setUserToken(token);
                try {
                    const res = await getMe();
                    await AsyncStorage.setItem('cached_user_profile', JSON.stringify(res.data));
                    setHasBatch(!!res.data.batch_id);
                } catch (e) {
                    console.log("AppNavigator checkAuth failed, using cache");
                    const cachedProfileStr = await AsyncStorage.getItem('cached_user_profile');
                    if (cachedProfileStr) {
                        const cachedUser = JSON.parse(cachedProfileStr);
                        setHasBatch(!!cachedUser.batch_id);
                    }
                } finally {
                    setIsLoading(false);
                }
            } else {
                setIsLoading(false);
            }
        };
        checkAuth();
    }, []);

    if (isLoading) {
        const { colors } = useTheme();
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const { colors } = useTheme();

    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="SplashScreen" screenOptions={{ headerShown: false, cardStyle: { backgroundColor: colors.background } }}>
                <Stack.Screen name="SplashScreen" component={SplashScreen} />
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Signup" component={SignupScreen} />
                <Stack.Screen name="CoachingSelectionScreen" component={CoachingSelectionScreen} />
                <Stack.Screen name="CreateCoaching" component={CreateCoachingScreen} />
                <Stack.Screen name="JoinCoaching" component={JoinCoachingScreen} />
                <Stack.Screen name="AddMembers" component={AddMembersScreen} />
                <Stack.Screen name="QRScanner" component={QRScannerScreen} />
                <Stack.Screen name="MembersList" component={MembersListScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="FolderNotes" component={FolderNotesScreen} />
                <Stack.Screen name="DPPScreen" component={DPPScreen} />
                <Stack.Screen name="NotesScreen" component={NotesScreen} />
                <Stack.Screen name="CoachingInfo" component={CoachingInfoScreen} />
                <Stack.Screen name="DoubtsScreen" component={DoubtsScreen} />
                <Stack.Screen name="ChatScreen" component={ChatScreen} />
                <Stack.Screen name="ClassProgressScreen" component={ClassProgressScreen} />
                <Stack.Screen name="LeaderboardScreen" component={LeaderboardScreen} />
                <Stack.Screen name="Booster" component={BoosterScreen} />
                <Stack.Screen name="Chest" component={ChestScreen} />
                <Stack.Screen name="BrainGames" component={BrainGamesScreen} />
                <Stack.Screen name="PdfViewer" component={PdfViewerScreen} />
                <Stack.Screen name="MainApp" component={DrawerNavigator} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
