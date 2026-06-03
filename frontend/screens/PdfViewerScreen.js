import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, Platform, TouchableOpacity,
    ActivityIndicator, Alert
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { logNoteTime, sendHeartbeat } from '../api/api';

const PdfViewerScreen = ({ route, navigation }) => {
    const { pdfUrl, title, noteId } = route.params;
    const { isDarkMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [webViewSource, setWebViewSource] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const startTimeRef = useRef(Date.now());
    // Auto-hide loader if onLoadEnd never fires (e.g. some Android WebView edge cases)
    const loadTimerRef = useRef(null);

    // Track time spent on note
    useEffect(() => {
        // Send initial heartbeat when opened
        if (noteId) {
            sendHeartbeat(`reading_note_${noteId}`).catch(() => {});
        }

        // Send a heartbeat every 10 seconds for real-time tracking
        const heartbeatInterval = setInterval(() => {
            if (noteId) {
                sendHeartbeat(`reading_note_${noteId}`).catch(() => {});
            }
        }, 10000);

        return () => {
            clearInterval(heartbeatInterval);
            if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
            if (noteId) {
                const elapsedSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
                if (elapsedSeconds > 0) {
                    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
                        AsyncStorage.getItem('note_time_spent_' + noteId).then(currentStr => {
                            const currentSecs = currentStr ? parseInt(currentStr, 10) : 0;
                            const newTotal = currentSecs + elapsedSeconds;
                            AsyncStorage.setItem('note_time_spent_' + noteId, newTotal.toString());
                        });
                    });
                    // Also sync to backend so teachers can view analytics
                    logNoteTime(noteId, elapsedSeconds).catch(err => console.log('Failed to log note time:', err));
                    
                    // Clear the current action when leaving the note
                    sendHeartbeat('browsing').catch(() => {});
                }
            }
        };
    }, [noteId]);

    useEffect(() => {
        preparePdfSource();
    }, [pdfUrl]);

    const preparePdfSource = async () => {
        setLoading(true);
        setErrorMsg(null);

        const isLocalFile =
            pdfUrl.startsWith('file://') ||
            (pdfUrl.startsWith('/') && !pdfUrl.startsWith('//'));

        if (Platform.OS === 'android') {
            // ─── Android: In-app PDF rendering via PDF.js inside WebView ───────────────
            try {
                let localPath;
                if (isLocalFile) {
                    localPath = pdfUrl.startsWith('file://') ? pdfUrl : `file://${pdfUrl}`;
                } else {
                    const tempPath = `${FileSystem.cacheDirectory}preview_${Date.now()}.pdf`;
                    const downloadRes = await FileSystem.downloadAsync(pdfUrl, tempPath);
                    if (downloadRes.status !== 200) throw new Error('Failed to download PDF');
                    localPath = downloadRes.uri;
                }

                // Read PDF as base64 to inject into PDF.js
                const base64Pdf = await FileSystem.readAsStringAsync(localPath, { encoding: FileSystem.EncodingType.Base64 });
                
                // HTML wrapper using PDF.js CDN
                const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5.0, user-scalable=yes"/>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
                    <style>
                        body { margin: 0; background: ${isDarkMode ? '#1E293B' : '#F1F5F9'}; display: flex; flex-direction: column; align-items: center; padding: 10px; }
                        canvas { max-width: 100%; height: auto; margin-bottom: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 8px; }
                        #loader { color: ${isDarkMode ? '#94A3B8' : '#64748B'}; font-family: sans-serif; margin-top: 50px; }
                    </style>
                </head>
                <body>
                    <div id="loader">Rendering Document...</div>
                    <div id="pdf-container"></div>
                    <script>
                        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
                        var pdfData = atob('${base64Pdf}');
                        var loadingTask = pdfjsLib.getDocument({data: pdfData});
                        
                        loadingTask.promise.then(function(pdf) {
                            document.getElementById('loader').style.display = 'none';
                            var container = document.getElementById('pdf-container');
                            
                            for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                                pdf.getPage(pageNum).then(function(page) {
                                    var scale = 1.5; // Good balance of quality and performance
                                    var viewport = page.getViewport({scale: scale});
                                    
                                    var canvas = document.createElement('canvas');
                                    var context = canvas.getContext('2d');
                                    canvas.height = viewport.height;
                                    canvas.width = viewport.width;
                                    
                                    // Order pages correctly
                                    canvas.style.order = page.pageNumber;
                                    container.appendChild(canvas);
                                    
                                    var renderContext = {
                                        canvasContext: context,
                                        viewport: viewport
                                    };
                                    page.render(renderContext);
                                });
                            }
                        }).catch(function(reason) {
                            document.getElementById('loader').innerText = "Error loading PDF: " + reason;
                        });
                    </script>
                </body>
                </html>
                `;

                setWebViewSource({ html: htmlContent });
                setLoading(false);
            } catch (err) {
                console.log('Android PDF load error:', err);
                setLoading(false);
                setErrorMsg('Could not render PDF. Please check your connection.');
            }
            return;
        }

        // ─── iOS: WebView renders PDFs perfectly natively ────────────────────────────
        setWebViewSource({ uri: pdfUrl });
        loadTimerRef.current = setTimeout(() => setLoading(false), 15000);
    };

    const handleWebViewLoadEnd = () => {
        if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
        setLoading(false);
    };

    const handleWebViewError = (e) => {
        if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
        setLoading(false);
        setErrorMsg('Failed to load document. Please check your connection.');
    };

    return (
        <SafeAreaView
            style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF' }]}
            edges={['top', 'bottom']}
        >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#FFF' : '#0F172A'} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: isDarkMode ? '#FFF' : '#0F172A' }]} numberOfLines={1}>
                    {title || 'Document'}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Content */}
            <View style={styles.content}>
                {/* WebView renders PDFs (Native on iOS, via PDF.js on Android) */}
                {webViewSource && (
                    <WebView
                        source={webViewSource}
                        style={{ flex: 1, backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }}
                        onLoadEnd={handleWebViewLoadEnd}
                        onError={handleWebViewError}
                        onHttpError={handleWebViewError}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                        originWhitelist={['*']}
                    />
                )}

                {/* Loading overlay */}
                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#818CF8" />
                        <Text style={[styles.statusText, { color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>
                            Loading Document...
                        </Text>
                    </View>
                )}

                {/* Error state */}
                {errorMsg && (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
                        <Text style={[styles.errorText, { color: isDarkMode ? '#FCA5A5' : '#EF4444' }]}>
                            {errorMsg}
                        </Text>
                        <TouchableOpacity
                            style={styles.retryBtn}
                            onPress={() => { setErrorMsg(null); preparePdfSource(); }}
                        >
                            <Text style={styles.retryBtnText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    title: {
        flex: 1,
        textAlign: 'center',
        fontSize: 16,
        fontFamily: 'Inter-Bold',
    },
    content: {
        flex: 1,
        position: 'relative',
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    statusText: {
        fontSize: 14,
        fontFamily: 'Inter-Medium',
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        gap: 16,
    },
    errorText: {
        fontSize: 14,
        fontFamily: 'Inter-Medium',
        textAlign: 'center',
        lineHeight: 22,
    },
    retryBtn: {
        backgroundColor: '#818CF8',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 8,
    },
    retryBtnText: {
        color: '#FFF',
        fontFamily: 'Inter-Bold',
        fontSize: 14,
    },
});

export default PdfViewerScreen;
