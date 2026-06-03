import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';

const { width: SW, height: SH } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════
// GAME REGISTRY
// ═══════════════════════════════════════════════════════════════
const GAMES = [
    {
        id: 'memory_matrix',
        name: 'Memory Matrix',
        emoji: '🧠',
        desc: 'Memorize the lit cells on a grid, then tap them from memory.',
        time: '2 min',
        color: '#818CF8',
        gradient: ['#1e1060', '#0f0a2e'],
    },
    {
        id: 'color_clash',
        name: 'Color Clash',
        emoji: '🎨',
        desc: "Classic Stroop test — tap the INK color, not what the word says!",
        time: '90 sec',
        color: '#F97316',
        gradient: ['#431407', '#1c0a00'],
    },

    {
        id: 'number_recall',
        name: 'Number Recall',
        emoji: '🔢',
        desc: 'A number sequence flashes briefly — enter it from memory.',
        time: '2 min',
        color: '#60A5FA',
        gradient: ['#1e3a5f', '#071526'],
    },
    {
        id: 'speed_sort',
        name: 'Speed Sort',
        emoji: '⚡',
        desc: 'Five numbers appear at once — instantly find the largest or smallest!',
        time: '90 sec',
        color: '#EC4899',
        gradient: ['#4a0020', '#1a000a'],
    },
];

const COLOR_NAMES = [
    { name: 'RED',    hex: '#EF4444' },
    { name: 'BLUE',   hex: '#3B82F6' },
    { name: 'GREEN',  hex: '#10B981' },
    { name: 'YELLOW', hex: '#EAB308' },
    { name: 'PURPLE', hex: '#8B5CF6' },
    { name: 'ORANGE', hex: '#F97316' },
];

const BUBBLE_PALETTE = ['#818CF8', '#F472B6', '#34D399', '#FBBF24', '#60A5FA', '#F87171', '#A78BFA'];

// ═══════════════════════════════════════════════════════════════
// RESULT SCREEN
// ═══════════════════════════════════════════════════════════════
const ResultScreen = ({ score, maxScore, gameName, gameColor, onPlayAgain, onExit }) => {
    const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const stars = pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0;
    const labels = ['Keep Trying! 💪', 'Good Effort! 👍', 'Great Job! 🎉', 'Outstanding! 🌟'];
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <LinearGradient colors={['#080820', '#0f0a2e']} style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>
                <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter-ExtraBold', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 24 }}>
                        {gameName} Complete
                    </Text>

                    <LinearGradient
                        colors={[gameColor + '40', gameColor + '10']}
                        style={{ width: 130, height: 130, borderRadius: 65, justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 2, borderColor: gameColor + '60' }}
                    >
                        <Text style={{ fontSize: 42, fontFamily: 'Inter-Black', color: '#FFF' }}>{score}</Text>
                        <Text style={{ fontSize: 11, fontFamily: 'Inter-ExtraBold', color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>POINTS</Text>
                    </LinearGradient>

                    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 16 }}>
                        {[1, 2, 3].map(s => (
                            <Text key={s} style={{ fontSize: 34, opacity: s <= stars ? 1 : 0.15 }}>⭐</Text>
                        ))}
                    </View>

                    <Text style={{ fontSize: 26, fontFamily: 'Inter-Black', color: '#FFF', marginBottom: 6, textAlign: 'center' }}>
                        {labels[stars]}
                    </Text>
                    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter-Medium', marginBottom: 52, textAlign: 'center' }}>
                        {pct}% accuracy · {score}/{maxScore} pts
                    </Text>

                    <TouchableOpacity onPress={onPlayAgain} style={{ width: '100%', marginBottom: 14, borderRadius: 22, overflow: 'hidden' }}>
                        <LinearGradient colors={[gameColor, gameColor + 'AA']} style={{ paddingVertical: 17, alignItems: 'center' }}>
                            <Text style={{ color: '#FFF', fontFamily: 'Inter-ExtraBold', fontSize: 16, letterSpacing: 1.5 }}>↻  PLAY AGAIN</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onExit}
                        style={{ width: '100%', paddingVertical: 16, alignItems: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                    >
                        <Text style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Inter-ExtraBold', fontSize: 15, letterSpacing: 1 }}>BACK TO GAMES</Text>
                    </TouchableOpacity>
                </Animated.View>
            </SafeAreaView>
        </LinearGradient>
    );
};

// ═══════════════════════════════════════════════════════════════
// SHARED GAME HEADER
// ═══════════════════════════════════════════════════════════════
const GameHeader = ({ title, subtitle, timeLeft, onBack, accentColor }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
        <TouchableOpacity
            onPress={onBack}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}
        >
            <Ionicons name="close" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFF', fontFamily: 'Inter-ExtraBold', fontSize: 15, letterSpacing: 1 }}>{title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter-Medium', fontSize: 11 }}>{subtitle}</Text>
        </View>
        <View style={{
            alignItems: 'center', minWidth: 54,
            backgroundColor: timeLeft <= 10 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14,
            borderWidth: 1, borderColor: timeLeft <= 10 ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)',
        }}>
            <Text style={{ color: timeLeft <= 10 ? '#EF4444' : accentColor, fontFamily: 'Inter-ExtraBold', fontSize: 20, lineHeight: 24 }}>
                {timeLeft}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter-Bold', fontSize: 8, letterSpacing: 1 }}>SECS</Text>
        </View>
    </View>
);

// ═══════════════════════════════════════════════════════════════
// GAME 1 — MEMORY MATRIX
// ═══════════════════════════════════════════════════════════════
const MemoryMatrixGame = ({ onEnd, onBack }) => {
    const insets = useSafeAreaInsets();
    const GRID       = 25; // 5×5
    const TOTAL_ROUNDS = 8;

    const [round,    setRound]    = useState(1);
    const [score,    setScore]    = useState(0);
    const [phase,    setPhase]    = useState('memorize'); // memorize | recall | feedback
    const [pattern,  setPattern]  = useState([]);
    const [selected, setSelected] = useState([]);
    const [timeLeft, setTimeLeft] = useState(120);
    const [memCd,    setMemCd]    = useState(3);
    const [feedback, setFeedback] = useState(null); // 'perfect' | 'good' | 'miss'

    const mountedRef  = useRef(true);
    const scoreRef    = useRef(0);
    const maxRef      = useRef(0);
    const endedRef    = useRef(false);
    const cdTimerRef  = useRef(null);

    useEffect(() => { return () => { mountedRef.current = false; }; }, []);

    // Global 2-min timer
    useEffect(() => {
        const t = setInterval(() => {
            if (!mountedRef.current) return;
            setTimeLeft(p => {
                if (p <= 1) { clearInterval(t); return 0; }
                return p - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, []);

    // Trigger onEnd when timer hits 0
    useEffect(() => {
        if (timeLeft === 0 && !endedRef.current) {
            endedRef.current = true;
            onEnd(scoreRef.current, Math.max(maxRef.current, 1));
        }
    }, [timeLeft]);

    const numLit = (r) => Math.min(3 + r, 12);

    const startRound = useCallback((r) => {
        if (!mountedRef.current) return;
        if (cdTimerRef.current) clearInterval(cdTimerRef.current);

        const count = numLit(r);
        const cells = [];
        while (cells.length < count) {
            const c = Math.floor(Math.random() * GRID);
            if (!cells.includes(c)) cells.push(c);
        }
        setPattern(cells);
        setSelected([]);
        setFeedback(null);
        setPhase('memorize');
        setMemCd(3);

        let cd = 3;
        cdTimerRef.current = setInterval(() => {
            if (!mountedRef.current) { clearInterval(cdTimerRef.current); return; }
            cd--;
            if (cd <= 0) {
                clearInterval(cdTimerRef.current);
                if (mountedRef.current) setPhase('recall');
            } else {
                setMemCd(cd);
            }
        }, 1000);
    }, []);

    useEffect(() => {
        startRound(1);
        return () => { if (cdTimerRef.current) clearInterval(cdTimerRef.current); };
    }, []);

    const handleCellPress = (idx) => {
        if (phase !== 'recall') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelected(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
    };

    const handleSubmit = () => {
        if (phase !== 'recall' || endedRef.current) return;
        const correct = pattern.filter(c => selected.includes(c)).length;
        const wrong   = selected.filter(c => !pattern.includes(c)).length;
        const pts     = pattern.length * 10;
        const earned  = Math.max(0, correct * 10 - wrong * 5);
        const fb      = correct === pattern.length && wrong === 0 ? 'perfect' : correct > 0 ? 'good' : 'miss';

        Haptics.notificationAsync(fb === 'perfect'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Error);

        scoreRef.current += earned;
        maxRef.current   += pts;
        setScore(s => s + earned);
        setFeedback(fb);
        setPhase('feedback');

        setTimeout(() => {
            if (!mountedRef.current || endedRef.current) return;
            if (round >= TOTAL_ROUNDS) {
                endedRef.current = true;
                onEnd(scoreRef.current, maxRef.current);
            } else {
                const next = round + 1;
                setRound(next);
                startRound(next);
            }
        }, 1300);
    };

    const cellSize = (SW - 64 - 4 * 10) / 5;

    const getCellStyle = (idx) => {
        const isP   = pattern.includes(idx);
        const isSel = selected.includes(idx);
        if (phase === 'memorize' && isP) return { bg: '#818CF8', border: '#818CF8' };
        if (phase === 'feedback') {
            if (isP && isSel)  return { bg: '#10B981', border: '#10B981' };
            if (isP)           return { bg: '#FBBF24', border: '#FBBF24' };
            if (isSel)         return { bg: '#EF4444', border: '#EF4444' };
        }
        if (phase === 'recall' && isSel) return { bg: 'rgba(129,140,248,0.4)', border: '#818CF8' };
        return { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)' };
    };

    return (
        <LinearGradient colors={['#0f0a30', '#090520']} style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1, paddingTop: Math.max(insets.top, 12) }}>
                <GameHeader
                    title="MEMORY MATRIX"
                    subtitle={`Round ${round} / ${TOTAL_ROUNDS}  ·  ${numLit(round)} cells`}
                    timeLeft={timeLeft}
                    onBack={onBack}
                    accentColor="#818CF8"
                />

                {/* Score */}
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                    <Text style={{ color: '#FBBF24', fontFamily: 'Inter-Black', fontSize: 38, letterSpacing: -1 }}>{score}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter-ExtraBold', fontSize: 10, letterSpacing: 2 }}>POINTS</Text>
                </View>

                {/* Phase banner */}
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    {phase === 'memorize' && (
                        <View style={{ backgroundColor: 'rgba(251,191,36,0.15)', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)' }}>
                            <Text style={{ color: '#FBBF24', fontFamily: 'Inter-ExtraBold', fontSize: 14 }}>⚡ MEMORIZE! — {memCd}s</Text>
                        </View>
                    )}
                    {phase === 'recall' && (
                        <View style={{ backgroundColor: 'rgba(129,140,248,0.15)', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(129,140,248,0.4)' }}>
                            <Text style={{ color: '#818CF8', fontFamily: 'Inter-ExtraBold', fontSize: 14 }}>🎯 TAP WHAT YOU REMEMBER</Text>
                        </View>
                    )}
                    {phase === 'feedback' && (
                        <View style={{
                            backgroundColor: feedback === 'perfect' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10,
                            borderWidth: 1, borderColor: feedback === 'perfect' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
                        }}>
                            <Text style={{ color: feedback === 'perfect' ? '#10B981' : feedback === 'good' ? '#FBBF24' : '#EF4444', fontFamily: 'Inter-ExtraBold', fontSize: 14 }}>
                                {feedback === 'perfect' ? '🎯 PERFECT!' : feedback === 'good' ? '😅 CLOSE!' : '❌ MISSED!'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* 5×5 Grid */}
                <View style={{ paddingHorizontal: 32 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {Array.from({ length: GRID }).map((_, idx) => {
                            const { bg, border } = getCellStyle(idx);
                            return (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => handleCellPress(idx)}
                                    activeOpacity={phase === 'recall' ? 0.6 : 1}
                                    style={{ width: cellSize, height: cellSize, borderRadius: 14, backgroundColor: bg, borderWidth: 1.5, borderColor: border }}
                                />
                            );
                        })}
                    </View>
                </View>

                {/* Submit */}
                {phase === 'recall' && (
                    <View style={{ paddingHorizontal: 32, marginTop: 24 }}>
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={selected.length === 0}
                            style={{ borderRadius: 22, overflow: 'hidden', opacity: selected.length > 0 ? 1 : 0.38 }}
                        >
                            <LinearGradient colors={['#818CF8', '#4F46E5']} style={{ paddingVertical: 16, alignItems: 'center' }}>
                                <Text style={{ color: '#FFF', fontFamily: 'Inter-ExtraBold', fontSize: 15, letterSpacing: 1.5 }}>SUBMIT ANSWER</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}
            </SafeAreaView>
        </LinearGradient>
    );
};

// ═══════════════════════════════════════════════════════════════
// GAME 2 — COLOR CLASH (Stroop Test)
// ═══════════════════════════════════════════════════════════════
const ColorClashGame = ({ onEnd, onBack }) => {
    const insets = useSafeAreaInsets();
    const [timeLeft, setTimeLeft] = useState(90);
    const [score,    setScore]    = useState(0);
    const [streak,   setStreak]   = useState(0);
    const [question, setQuestion] = useState(null);
    const [fbState,  setFbState]  = useState(null); // null | 'correct' | 'wrong'

    const mountedRef = useRef(true);
    const scoreRef   = useRef(0);
    const totalRef   = useRef(0);
    const endedRef   = useRef(false);

    useEffect(() => { return () => { mountedRef.current = false; }; }, []);

    const generateQ = useCallback(() => {
        const word = COLOR_NAMES[Math.floor(Math.random() * COLOR_NAMES.length)];
        let ink;
        do { ink = COLOR_NAMES[Math.floor(Math.random() * COLOR_NAMES.length)]; } while (ink.name === word.name);
        const wrong = COLOR_NAMES.filter(c => c.name !== ink.name).sort(() => Math.random() - 0.5).slice(0, 3);
        const options = [ink, ...wrong].sort(() => Math.random() - 0.5);
        return { wordText: word.name, inkHex: ink.hex, inkName: ink.name, options };
    }, []);

    useEffect(() => { setQuestion(generateQ()); }, []);

    useEffect(() => {
        const t = setInterval(() => {
            if (!mountedRef.current) return;
            setTimeLeft(p => {
                if (p <= 1) { clearInterval(t); return 0; }
                return p - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, []);

    // Trigger onEnd when timer hits 0
    useEffect(() => {
        if (timeLeft === 0 && !endedRef.current) {
            endedRef.current = true;
            onEnd(scoreRef.current, Math.max(totalRef.current * 15, 1));
        }
    }, [timeLeft]);
    const handleAnswer = (colorName) => {
        if (fbState !== null || !question || endedRef.current) return;
        const correct = colorName === question.inkName;
        totalRef.current++;

        if (correct) {
            const bonus = streak >= 4 ? 20 : streak >= 2 ? 15 : 10;
            scoreRef.current += bonus;
            setScore(s => s + bonus);
            setStreak(s => s + 1);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            setStreak(0);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        setFbState(correct ? 'correct' : 'wrong');
        setTimeout(() => {
            if (!mountedRef.current) return;
            setFbState(null);
            setQuestion(generateQ());
        }, 380);
    };

    return (
        <LinearGradient colors={['#1a0a00', '#0a0500']} style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1, paddingTop: Math.max(insets.top, 12) }}>
                <GameHeader
                    title="COLOR CLASH"
                    subtitle="Tap the INK color — not the word!"
                    timeLeft={timeLeft}
                    onBack={onBack}
                    accentColor="#F97316"
                />

                {/* Score & streak */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 32, marginBottom: 24 }}>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ color: '#F97316', fontFamily: 'Inter-Black', fontSize: 38 }}>{score}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter-ExtraBold', fontSize: 10, letterSpacing: 2 }}>POINTS</Text>
                    </View>
                    {streak >= 2 && (
                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: '#FBBF24', fontFamily: 'Inter-Black', fontSize: 38 }}>🔥{streak}</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter-ExtraBold', fontSize: 10, letterSpacing: 2 }}>STREAK</Text>
                        </View>
                    )}
                </View>

                {question && (
                    <>
                        <View style={{ alignItems: 'center', marginBottom: 8 }}>
                            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter-ExtraBold', letterSpacing: 2, marginBottom: 18 }}>
                                WHAT COLOR IS THIS TEXT?
                            </Text>
                            <Text style={{ fontSize: 66, fontFamily: 'Inter-Black', color: question.inkHex, letterSpacing: -2 }}>
                                {question.wordText}
                            </Text>
                        </View>

                        {fbState && (
                            <View style={{ alignItems: 'center', marginBottom: 6 }}>
                                <Text style={{ fontSize: 22, fontFamily: 'Inter-ExtraBold', color: fbState === 'correct' ? '#10B981' : '#EF4444' }}>
                                    {fbState === 'correct' ? '✓ CORRECT!' : '✗ WRONG!'}
                                </Text>
                            </View>
                        )}

                        {/* 2×2 color buttons */}
                        <View style={{ paddingHorizontal: 20, gap: 12 }}>
                            {[question.options.slice(0, 2), question.options.slice(2, 4)].map((row, ri) => (
                                <View key={ri} style={{ flexDirection: 'row', gap: 12 }}>
                                    {row.map(opt => (
                                        <TouchableOpacity
                                            key={opt.name}
                                            onPress={() => handleAnswer(opt.name)}
                                            style={{
                                                flex: 1, height: 70, borderRadius: 20, backgroundColor: opt.hex,
                                                justifyContent: 'center', alignItems: 'center',
                                                shadowColor: opt.hex, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8,
                                            }}
                                        >
                                            <Text style={{ color: '#FFF', fontFamily: 'Inter-ExtraBold', fontSize: 16, letterSpacing: 1 }}>{opt.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ))}
                        </View>
                    </>
                )}
            </SafeAreaView>
        </LinearGradient>
    );
};

// ═══════════════════════════════════════════════════════════════
// GAME 3 — FOCUS TAP
// ═══════════════════════════════════════════════════════════════
const FocusTapGame = ({ onEnd, onBack }) => {
    const insets = useSafeAreaInsets();
    const [timeLeft, setTimeLeft] = useState(120);
    const [score,    setScore]    = useState(0);
    const [bubbles,  setBubbles]  = useState([]);

    const mountedRef    = useRef(true);
    const scoreRef      = useRef(0);
    const endedRef      = useRef(false);
    const bubbleIdRef   = useRef(0);
    const timeLeftRef   = useRef(120);
    const spawnTimerRef = useRef(null);

    useEffect(() => { return () => { mountedRef.current = false; }; }, []);

    // Global 2-min timer
    useEffect(() => {
        const t = setInterval(() => {
            if (!mountedRef.current) return;
            setTimeLeft(p => {
                const next = p - 1;
                timeLeftRef.current = next;
                if (next <= 0) { clearInterval(t); return 0; }
                return next;
            });
        }, 1000);
        return () => clearInterval(t);
    }, []);

    // Trigger onEnd when timer hits 0
    useEffect(() => {
        if (timeLeft === 0 && !endedRef.current) {
            endedRef.current = true;
            onEnd(scoreRef.current, Math.max(scoreRef.current, 100));
        }
    }, [timeLeft]);

    // Bubble spawner (recursive setTimeout — speeds up over time)
    useEffect(() => {
        const spawn = () => {
            if (!mountedRef.current || endedRef.current) return;
            const id     = ++bubbleIdRef.current;
            const color  = BUBBLE_PALETTE[Math.floor(Math.random() * BUBBLE_PALETTE.length)];
            const size   = 52 + Math.floor(Math.random() * 28);
            const hdrH   = insets.top + 130;
            const x      = 16 + Math.random() * (SW - size - 32);
            const y      = hdrH + Math.random() * (SH * 0.46);
            const anim   = new Animated.Value(1);

            setBubbles(prev => [...prev, { id, x, y, size, color, anim }]);

            const elapsed  = 120 - timeLeftRef.current;
            const lifetime = Math.max(900, 1800 - elapsed * 7);
            Animated.timing(anim, { toValue: 0, duration: lifetime, useNativeDriver: true }).start(() => {
                if (mountedRef.current) setBubbles(prev => prev.filter(b => b.id !== id));
            });

            const nextDelay = Math.max(480, 1100 - elapsed * 4);
            spawnTimerRef.current = setTimeout(spawn, nextDelay);
        };

        spawnTimerRef.current = setTimeout(spawn, 600);
        return () => { if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current); };
    }, []);

    const handleTap = (id) => {
        if (endedRef.current) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        scoreRef.current += 10;
        setScore(s => s + 10);
        setBubbles(prev => prev.filter(b => b.id !== id));
    };

    return (
        <LinearGradient colors={['#00150f', '#001a15']} style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1, paddingTop: Math.max(insets.top, 12) }}>
                <GameHeader
                    title="FOCUS TAP"
                    subtitle="Pop bubbles before they vanish!"
                    timeLeft={timeLeft}
                    onBack={onBack}
                    accentColor="#34D399"
                />

                <View style={{ alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ color: '#34D399', fontFamily: 'Inter-Black', fontSize: 38 }}>{score}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter-ExtraBold', fontSize: 10, letterSpacing: 2 }}>POINTS</Text>
                </View>

                {/* Play field */}
                <View style={{ flex: 1 }}>
                    {bubbles.map(b => (
                        <Animated.View
                            key={b.id}
                            style={{ position: 'absolute', left: b.x, top: b.y, width: b.size, height: b.size, opacity: b.anim, transform: [{ scale: b.anim }] }}
                        >
                            <TouchableOpacity
                                onPress={() => handleTap(b.id)}
                                style={{
                                    width: b.size, height: b.size, borderRadius: b.size / 2,
                                    backgroundColor: b.color + '35',
                                    borderWidth: 2.5, borderColor: b.color,
                                    justifyContent: 'center', alignItems: 'center',
                                    shadowColor: b.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 10, elevation: 8,
                                }}
                            >
                                <Text style={{ color: b.color, fontFamily: 'Inter-ExtraBold', fontSize: 13 }}>+10</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    ))}
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
};

// ═══════════════════════════════════════════════════════════════
// GAME 4 — NUMBER RECALL
// ═══════════════════════════════════════════════════════════════
const getSeqLen = (r) => Math.min(3 + Math.floor((r - 1) / 2), 8);

const NumberRecallGame = ({ onEnd, onBack }) => {
    const insets       = useSafeAreaInsets();
    const TOTAL_ROUNDS = 8;

    const [timeLeft,   setTimeLeft]   = useState(120);
    const [round,      setRound]      = useState(1);
    const [score,      setScore]      = useState(0);
    const [phase,      setPhase]      = useState('show'); // show | input | feedback
    const [sequence,   setSequence]   = useState([]);
    const [userInput,  setUserInput]  = useState([]);
    const [showCd,     setShowCd]     = useState(3);
    const [feedback,   setFeedback]   = useState(null); // { type, correct, total }

    const mountedRef = useRef(true);
    const scoreRef   = useRef(0);
    const maxRef     = useRef(0);
    const endedRef   = useRef(false);
    const cdTimerRef = useRef(null);

    useEffect(() => { return () => { mountedRef.current = false; }; }, []);

    useEffect(() => {
        const t = setInterval(() => {
            if (!mountedRef.current) return;
            setTimeLeft(p => {
                if (p <= 1) { clearInterval(t); return 0; }
                return p - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, []);

    // Trigger onEnd when timer hits 0
    useEffect(() => {
        if (timeLeft === 0 && !endedRef.current) {
            endedRef.current = true;
            onEnd(scoreRef.current, Math.max(maxRef.current, 1));
        }
    }, [timeLeft]);

    const startRound = useCallback((r) => {
        if (!mountedRef.current) return;
        if (cdTimerRef.current) clearInterval(cdTimerRef.current);
        const len = getSeqLen(r);
        const seq = Array.from({ length: len }, () => Math.floor(Math.random() * 10));
        setSequence(seq);
        setUserInput([]);
        setFeedback(null);
        setPhase('show');
        setShowCd(3);

        let cd = 3;
        cdTimerRef.current = setInterval(() => {
            if (!mountedRef.current) { clearInterval(cdTimerRef.current); return; }
            cd--;
            if (cd <= 0) {
                clearInterval(cdTimerRef.current);
                if (mountedRef.current) setPhase('input');
            } else {
                setShowCd(cd);
            }
        }, 1000);
    }, []);

    useEffect(() => {
        startRound(1);
        return () => { if (cdTimerRef.current) clearInterval(cdTimerRef.current); };
    }, []);

    const handleDigit = (d) => {
        if (phase !== 'input' || endedRef.current) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setUserInput(prev => [...prev, d]);
    };

    const handleDelete  = () => { if (phase === 'input') setUserInput(prev => prev.slice(0, -1)); };

    const handleSubmit = () => {
        if (phase !== 'input' || userInput.length === 0 || endedRef.current) return;
        const pts     = sequence.length * 15;
        const correct = sequence.reduce((sum, n, i) => sum + (userInput[i] === n ? 1 : 0), 0);
        const earned  = Math.round((correct / sequence.length) * pts);
        const fb      = correct === sequence.length ? 'perfect' : correct > 0 ? 'good' : 'miss';

        Haptics.notificationAsync(fb === 'perfect'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Error);

        scoreRef.current += earned;
        maxRef.current   += pts;
        setScore(s => s + earned);
        setFeedback({ type: fb, correct, total: sequence.length });
        setPhase('feedback');

        setTimeout(() => {
            if (!mountedRef.current || endedRef.current) return;
            if (round >= TOTAL_ROUNDS) {
                endedRef.current = true;
                onEnd(scoreRef.current, maxRef.current);
            } else {
                const next = round + 1;
                setRound(next);
                startRound(next);
            }
        }, 1500);
    };

    const PAD = [[1, 2, 3], [4, 5, 6], [7, 8, 9], ['⌫', 0, '✓']];

    return (
        <LinearGradient colors={['#001030', '#000820']} style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1, paddingTop: Math.max(insets.top, 12) }}>
                <GameHeader
                    title="NUMBER RECALL"
                    subtitle={`Round ${round} / ${TOTAL_ROUNDS}  ·  ${getSeqLen(round)} digits`}
                    timeLeft={timeLeft}
                    onBack={onBack}
                    accentColor="#60A5FA"
                />

                <View style={{ alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ color: '#60A5FA', fontFamily: 'Inter-Black', fontSize: 38 }}>{score}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter-ExtraBold', fontSize: 10, letterSpacing: 2 }}>POINTS</Text>
                </View>

                {/* Sequence display area */}
                <View style={{ alignItems: 'center', minHeight: 110, justifyContent: 'center', marginBottom: 14 }}>
                    {phase === 'show' && (
                        <>
                            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter-ExtraBold', letterSpacing: 2, marginBottom: 18 }}>
                                MEMORIZE THIS SEQUENCE
                            </Text>
                            <Text style={{ fontSize: 50, fontFamily: 'Inter-Black', color: '#60A5FA', letterSpacing: 10 }}>
                                {sequence.join(' ')}
                            </Text>
                            <Text style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter-Medium', fontSize: 13, marginTop: 14 }}>
                                Disappears in {showCd}s...
                            </Text>
                        </>
                    )}
                    {(phase === 'input' || phase === 'feedback') && (
                        <>
                            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter-ExtraBold', letterSpacing: 2, marginBottom: 18 }}>
                                {phase === 'input'
                                    ? 'ENTER THE SEQUENCE'
                                    : feedback?.type === 'perfect' ? '🎯 PERFECT!'
                                    : feedback?.type === 'good'   ? '😅 ALMOST!'
                                    : '❌ MISSED!'}
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingHorizontal: 16 }}>
                                {sequence.map((n, i) => {
                                    const entered = userInput[i];
                                    const isCor  = phase === 'feedback' && entered === n;
                                    const isWrng = phase === 'feedback' && entered !== undefined && entered !== n;
                                    return (
                                        <View key={i} style={{
                                            width: 40, height: 50, borderRadius: 12,
                                            justifyContent: 'center', alignItems: 'center',
                                            backgroundColor: phase === 'feedback'
                                                ? (isCor ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)')
                                                : entered !== undefined ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)',
                                            borderWidth: 1.5,
                                            borderColor: phase === 'feedback'
                                                ? (isCor ? '#10B981' : '#EF4444')
                                                : entered !== undefined ? '#60A5FA' : 'rgba(255,255,255,0.1)',
                                        }}>
                                            <Text style={{ color: '#FFF', fontFamily: 'Inter-ExtraBold', fontSize: 20 }}>
                                                {phase === 'feedback' ? n : (entered !== undefined ? entered : '')}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </>
                    )}
                </View>

                {/* Custom digit pad */}
                {phase === 'input' && (
                    <View style={{ paddingHorizontal: 36 }}>
                        {PAD.map((row, ri) => (
                            <View key={ri} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                                {row.map((d) => (
                                    <TouchableOpacity
                                        key={String(d)}
                                        onPress={() => {
                                            if (d === '⌫') handleDelete();
                                            else if (d === '✓') handleSubmit();
                                            else handleDigit(d);
                                        }}
                                        style={{
                                            flex: 1, height: 56, borderRadius: 16,
                                            backgroundColor: d === '✓' ? '#60A5FA' : d === '⌫' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)',
                                            borderWidth: 1,
                                            borderColor: d === '✓' ? '#60A5FA' : d === '⌫' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)',
                                            justifyContent: 'center', alignItems: 'center',
                                        }}
                                    >
                                        <Text style={{ color: d === '⌫' ? '#EF4444' : '#FFF', fontFamily: 'Inter-ExtraBold', fontSize: typeof d === 'number' ? 22 : 18 }}>
                                            {d}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ))}
                    </View>
                )}
            </SafeAreaView>
        </LinearGradient>
    );
};

// ═══════════════════════════════════════════════════════════════
// GAME 5 — SPEED SORT
// ═══════════════════════════════════════════════════════════════
const SpeedSortGame = ({ onEnd, onBack }) => {
    const insets = useSafeAreaInsets();
    const [timeLeft, setTimeLeft] = useState(90);
    const [score,    setScore]    = useState(0);
    const [numbers,  setNumbers]  = useState([]);
    const [task,     setTask]     = useState('largest'); // 'largest' | 'smallest'
    const [feedback, setFeedback] = useState(null); // { correct, tapped, answer }

    const mountedRef = useRef(true);
    const scoreRef   = useRef(0);
    const totalRef   = useRef(0);
    const endedRef   = useRef(false);

    useEffect(() => { return () => { mountedRef.current = false; }; }, []);

    const nextQuestion = (nextTask) => {
        const nums = new Set();
        while (nums.size < 5) nums.add(Math.floor(Math.random() * 98) + 2);
        setNumbers(Array.from(nums));
        setTask(nextTask);
        setFeedback(null);
    };

    useEffect(() => { nextQuestion('largest'); }, []);

    useEffect(() => {
        const t = setInterval(() => {
            if (!mountedRef.current) return;
            setTimeLeft(p => {
                if (p <= 1) { clearInterval(t); return 0; }
                return p - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, []);

    // Trigger onEnd when timer hits 0
    useEffect(() => {
        if (timeLeft === 0 && !endedRef.current) {
            endedRef.current = true;
            onEnd(scoreRef.current, Math.max(totalRef.current * 15, 1));
        }
    }, [timeLeft]);

    const handleTap = (num) => {
        if (feedback !== null || endedRef.current) return;
        const answer  = task === 'largest' ? Math.max(...numbers) : Math.min(...numbers);
        const correct = num === answer;
        totalRef.current++;
        Haptics.notificationAsync(correct
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Error);
        if (correct) { scoreRef.current += 15; setScore(s => s + 15); }
        setFeedback({ correct, tapped: num, answer });

        setTimeout(() => {
            if (!mountedRef.current || endedRef.current) return;
            nextQuestion(task === 'largest' ? 'smallest' : 'largest');
        }, 550);
    };

    const numBoxW = (SW - 48 - 20) / 3;

    return (
        <LinearGradient colors={['#1a0020', '#0d0015']} style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1, paddingTop: Math.max(insets.top, 12) }}>
                <GameHeader
                    title="SPEED SORT"
                    subtitle="Find the right number fast!"
                    timeLeft={timeLeft}
                    onBack={onBack}
                    accentColor="#EC4899"
                />

                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <Text style={{ color: '#EC4899', fontFamily: 'Inter-Black', fontSize: 38 }}>{score}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter-ExtraBold', fontSize: 10, letterSpacing: 2 }}>POINTS</Text>
                </View>

                {/* Task label */}
                <View style={{ alignItems: 'center', marginBottom: 36 }}>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter-ExtraBold', letterSpacing: 2, marginBottom: 12 }}>TAP THE</Text>
                    <LinearGradient
                        colors={task === 'largest' ? ['#EC4899', '#8B5CF6'] : ['#60A5FA', '#06B6D4']}
                        style={{ borderRadius: 28, paddingHorizontal: 28, paddingVertical: 14 }}
                    >
                        <Text style={{ color: '#FFF', fontFamily: 'Inter-Black', fontSize: 26, letterSpacing: 2 }}>
                            {task === 'largest' ? '⬆  LARGEST' : '⬇  SMALLEST'}
                        </Text>
                    </LinearGradient>
                </View>

                {/* Number grid */}
                <View style={{ paddingHorizontal: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                    {numbers.map((num, i) => {
                        const isAnswer = feedback?.answer === num;
                        const isTapped = feedback?.tapped === num;
                        const good     = isTapped && feedback?.correct;
                        const bad      = isTapped && !feedback?.correct;
                        const reveal   = !isTapped && feedback && isAnswer;

                        return (
                            <TouchableOpacity
                                key={`${num}-${i}`}
                                onPress={() => handleTap(num)}
                                style={{
                                    width: numBoxW, height: 78, borderRadius: 22,
                                    justifyContent: 'center', alignItems: 'center',
                                    backgroundColor: good   ? 'rgba(16,185,129,0.25)'
                                                  : bad    ? 'rgba(239,68,68,0.25)'
                                                  : reveal ? 'rgba(16,185,129,0.15)'
                                                  : 'rgba(255,255,255,0.06)',
                                    borderWidth: 2,
                                    borderColor: good   ? '#10B981'
                                               : bad    ? '#EF4444'
                                               : reveal ? '#10B981'
                                               : 'rgba(255,255,255,0.12)',
                                }}
                            >
                                <Text style={{ fontFamily: 'Inter-Black', fontSize: 30, color: good ? '#10B981' : bad ? '#EF4444' : '#FFF' }}>
                                    {num}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {feedback && (
                    <View style={{ alignItems: 'center', marginTop: 22 }}>
                        <Text style={{ fontSize: 20, fontFamily: 'Inter-ExtraBold', color: feedback.correct ? '#10B981' : '#EF4444' }}>
                            {feedback.correct ? '✓ CORRECT! +15 pts' : `✗ It was ${feedback.answer}`}
                        </Text>
                    </View>
                )}
            </SafeAreaView>
        </LinearGradient>
    );
};

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN — Lobby + Game Router
// ═══════════════════════════════════════════════════════════════
const BrainGamesScreen = ({ navigation }) => {
    const { isDarkMode, colors } = useTheme();
    const [activeGame, setActiveGame] = useState(null);
    const [gameKey,    setGameKey]    = useState(0);
    const [result,     setResult]     = useState(null);

    const handleGameEnd = useCallback((score, maxScore) => {
        const g = GAMES.find(x => x.id === activeGame);
        setResult({ score, maxScore, gameName: g?.name ?? '', gameColor: g?.color ?? '#818CF8' });
    }, [activeGame]);

    const handlePlayAgain = () => { setResult(null); setGameKey(k => k + 1); };
    const handleExit      = () => { setResult(null); setActiveGame(null); };

    // ── Show result screen ──
    if (result) {
        return <ResultScreen {...result} onPlayAgain={handlePlayAgain} onExit={handleExit} />;
    }

    // ── Route to active game ──
    const GameComponents = {
        memory_matrix:  MemoryMatrixGame,
        color_clash:    ColorClashGame,

        number_recall:  NumberRecallGame,
        speed_sort:     SpeedSortGame,
    };

    if (activeGame) {
        const GameComponent = GameComponents[activeGame];
        return <GameComponent key={gameKey} onEnd={handleGameEnd} onBack={() => setActiveGame(null)} />;
    }

    // ── Lobby ──
    return (
        <LinearGradient colors={isDarkMode ? ['#080c18', '#0d1220'] : ['#f0f4ff', '#e8efff']} style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 }}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', justifyContent: 'center', alignItems: 'center' }}
                    >
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={{ fontFamily: 'Inter-ExtraBold', fontSize: 22, color: colors.text, letterSpacing: -0.5 }}>Brain Boost Zone</Text>
                        <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.subtext }}>Quick 2-min cognitive warm-ups</Text>
                    </View>
                    <Text style={{ fontSize: 28 }}>🧠</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
                    {/* Info banner */}
                    <LinearGradient
                        colors={isDarkMode
                            ? ['rgba(99,102,241,0.15)', 'rgba(99,102,241,0.04)']
                            : ['rgba(99,102,241,0.08)', 'rgba(99,102,241,0.02)']}
                        style={{ borderRadius: 20, padding: 16, marginBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: isDarkMode ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)' }}
                    >
                        <Text style={{ fontSize: 28 }}>💡</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'Inter-Bold', fontSize: 14, color: isDarkMode ? '#818CF8' : '#4F46E5' }}>Why Brain Games?</Text>
                            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: colors.subtext, marginTop: 3, lineHeight: 17 }}>
                                Short cognitive exercises reactivate focus after long study sessions. Each game auto-ends in 2–3 minutes.
                            </Text>
                        </View>
                    </LinearGradient>

                    {/* Game cards */}
                    {GAMES.map((game) => (
                        <TouchableOpacity
                            key={game.id}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                setActiveGame(game.id);
                            }}
                            activeOpacity={0.83}
                            style={{ marginBottom: 14 }}
                        >
                            <LinearGradient
                                colors={isDarkMode ? game.gradient : [game.color + '14', game.color + '04']}
                                style={{ borderRadius: 24, padding: 20, borderWidth: 1, borderColor: isDarkMode ? game.color + '28' : game.color + '30' }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                    <View style={{ width: 56, height: 56, borderRadius: 17, backgroundColor: game.color + '22', borderWidth: 1, borderColor: game.color + '40', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                                        <Text style={{ fontSize: 26 }}>{game.emoji}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                                            <Text style={{ fontFamily: 'Inter-ExtraBold', fontSize: 16, color: isDarkMode ? '#FFF' : colors.text }}>{game.name}</Text>
                                            <View style={{ backgroundColor: game.color + '20', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Ionicons name="time-outline" size={11} color={game.color} />
                                                <Text style={{ fontFamily: 'Inter-Bold', fontSize: 11, color: game.color }}>{game.time}</Text>
                                            </View>
                                        </View>
                                        <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: isDarkMode ? 'rgba(255,255,255,0.45)' : colors.subtext, lineHeight: 18 }}>
                                            {game.desc}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
                                    <LinearGradient
                                        colors={[game.color, game.color + 'BB']}
                                        style={{ borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                    >
                                        <Text style={{ fontFamily: 'Inter-ExtraBold', fontSize: 13, color: '#FFF', letterSpacing: 1 }}>PLAY</Text>
                                        <Ionicons name="play" size={13} color="#FFF" />
                                    </LinearGradient>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
};

export default BrainGamesScreen;
