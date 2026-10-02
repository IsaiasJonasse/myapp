import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, SafeAreaView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BottomNav, TabName } from './src/components/BottomNav';
import {
  completeRun,
  createRun,
  getActiveRun,
  getAssignments,
  getRecentAssignments,
  getRunSummaries,
  initializeDatabase,
  loadSettings,
  saveAssignment,
  saveSettings,
  saveTelemetry,
} from './src/services/database';
import { RosBridge } from './src/services/rosBridge';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { MapScreen } from './src/screens/MapScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { colors } from './src/theme';
import {
  AppSettings,
  CloneAssignment,
  CloneVariety,
  ConnectionStatus,
  FieldRun,
  RunSummary,
  Telemetry,
} from './src/types';

const initialTelemetry: Telemetry = {
  battery: 87,
  temperature: 28.4,
  airQuality: 34,
  oxygen: 20.8,
  position: { x: 1, y: 1 },
  updatedAt: new Date().toISOString(),
};

const fallbackSettings: AppSettings = {
  bridgeUrl: 'ws://192.168.1.10:9090',
  mockMode: true,
  topics: {
    position: '/soilbot/position',
    battery: '/soilbot/battery',
    environment: '/soilbot/environment',
    combined: '/soilbot/telemetry',
  },
};

export default function App() {
  const { width } = useWindowDimensions();
  const desktopLayout = width >= 960;
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState('');
  const [starting, setStarting] = useState(false);
  const [tab, setTab] = useState<TabName>('map');
  const [run, setRun] = useState<FieldRun | null>(null);
  const [assignments, setAssignments] = useState<CloneAssignment[]>([]);
  const [historyAssignments, setHistoryAssignments] = useState<CloneAssignment[]>([]);
  const [runSummaries, setRunSummaries] = useState<RunSummary[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(fallbackSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [telemetry, setTelemetry] = useState(initialTelemetry);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionDetail, setConnectionDetail] = useState('');
  const lastTelemetrySave = useRef(0);
  const mockStep = useRef(0);
  const rosBridge = useRef<RosBridge | null>(null);

  if (!rosBridge.current) {
    rosBridge.current = new RosBridge({
      onStatus: (status, detail) => {
        setConnectionStatus(status);
        setConnectionDetail(detail ?? '');
      },
      onTelemetry: (partial) => {
        setTelemetry((current) => ({
          battery: typeof partial.battery === 'number' ? partial.battery : current.battery,
          temperature: typeof partial.temperature === 'number' ? partial.temperature : current.temperature,
          airQuality: typeof partial.airQuality === 'number' ? partial.airQuality : current.airQuality,
          oxygen: typeof partial.oxygen === 'number' ? partial.oxygen : current.oxygen,
          position: partial.position ?? current.position,
          updatedAt: new Date().toISOString(),
        }));
      },
    });
  }

  const refreshHistory = async () => {
    const [summaries, recent] = await Promise.all([getRunSummaries(), getRecentAssignments()]);
    setRunSummaries(summaries);
    setHistoryAssignments(recent);
  };

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        await initializeDatabase();
        const [activeRun, storedSettings, summaries, recent] = await Promise.all([
          getActiveRun(), loadSettings(), getRunSummaries(), getRecentAssignments(),
        ]);
        if (!active) return;
        setRun(activeRun);
        setSettingsState(storedSettings);
        setRunSummaries(summaries);
        setHistoryAssignments(recent);
        if (activeRun) setAssignments(await getAssignments(activeRun.id));
        setSettingsLoaded(true);
      } catch (error) {
        if (active) setBootError(error instanceof Error ? error.message : 'Database setup failed.');
      } finally {
        if (active) setReady(true);
      }
    };
    bootstrap();
    return () => { active = false; };
  }, []);

  useEffect(() => () => rosBridge.current?.disconnect(false), []);

  useEffect(() => {
    if (!settingsLoaded) return;
    if (settings.mockMode) {
      rosBridge.current?.disconnect();
      setConnectionDetail('');
    } else {
      rosBridge.current?.connect(settings);
    }
  }, [settings, settingsLoaded]);

  useEffect(() => {
    if (!settings.mockMode || !run) return;
    const timer = setInterval(() => {
      const total = run.columns * run.rows;
      const index = mockStep.current++ % total;
      const row = Math.floor(index / run.columns);
      const columnInRow = index % run.columns;
      const x = row % 2 === 0 ? columnInRow + 1 : run.columns - columnInRow;
      const phase = mockStep.current / 5;
      setTelemetry((current) => ({
        battery: Math.max(15, current.battery - 0.08),
        temperature: 28.2 + Math.sin(phase) * 1.4,
        airQuality: 32 + Math.abs(Math.sin(phase / 2)) * 18,
        oxygen: 20.7 + Math.sin(phase / 3) * 0.25,
        position: { x, y: row + 1, heading: row % 2 === 0 ? 0 : 180 },
        updatedAt: new Date().toISOString(),
      }));
    }, 2200);
    return () => clearInterval(timer);
  }, [run, settings.mockMode]);

  useEffect(() => {
    if (!run || Date.now() - lastTelemetrySave.current < 15000) return;
    lastTelemetrySave.current = Date.now();
    saveTelemetry(run.id, telemetry).catch(() => undefined);
  }, [run, telemetry]);

  const startRun = async (fieldName: string, rows: number, columns: number) => {
    setStarting(true);
    try {
      const nextRun = await createRun(fieldName, rows, columns);
      setRun(nextRun);
      setAssignments([]);
      setTelemetry((current) => ({ ...current, position: { x: 1, y: 1 }, updatedAt: new Date().toISOString() }));
      mockStep.current = 0;
      await refreshHistory();
    } catch (error) {
      Alert.alert('Could not start run', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const assignClone = async (
    coordinate: { x: number; y: number },
    clone: CloneVariety,
    source: 'robot' | 'manual',
  ) => {
    if (!run) return;
    try {
      const saved = await saveAssignment(run.id, coordinate.x, coordinate.y, clone, source);
      setAssignments((current) => [
        saved,
        ...current.filter((item) => !(item.gridX === coordinate.x && item.gridY === coordinate.y)),
      ]);
      setHistoryAssignments((current) => [
        saved,
        ...current.filter((item) => item.id !== saved.id),
      ].slice(0, 50));
    } catch (error) {
      Alert.alert('Assignment not saved', error instanceof Error ? error.message : 'Please try again.');
      throw error;
    }
  };

  const updateSettings = async (nextSettings: AppSettings, _connectNow: boolean) => {
    const normalized: AppSettings = {
      ...nextSettings,
      bridgeUrl: nextSettings.bridgeUrl.trim(),
      topics: Object.fromEntries(
        Object.entries(nextSettings.topics).map(([key, value]) => [key, String(value).trim()]),
      ) as AppSettings['topics'],
    };

    if (!normalized.mockMode && !/^wss?:\/\//i.test(normalized.bridgeUrl)) {
      throw new Error('Use a valid ws:// or wss:// ROS bridge URL.');
    }

    const browserLocation = (globalThis as typeof globalThis & {
      location?: { protocol?: string };
    }).location;
    if (
      Platform.OS === 'web'
      && browserLocation?.protocol === 'https:'
      && normalized.bridgeUrl.toLowerCase().startsWith('ws://')
    ) {
      throw new Error('Use a secure wss:// ROS bridge when the desktop app is hosted over HTTPS.');
    }

    await saveSettings(normalized);
    setSettingsState(normalized);
  };

  const finishRun = async () => {
    if (!run) return;
    try {
      await completeRun(run.id);
      await refreshHistory();
      setRun(null);
      setAssignments([]);
      setTab('map');
    } catch (error) {
      Alert.alert('Could not complete run', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const requestCompleteRun = () => {
    if (!run) return;

    if (Platform.OS === 'web') {
      const confirmRun = (globalThis as typeof globalThis & {
        confirm?: (message: string) => boolean;
      }).confirm;
      if (!confirmRun || confirmRun('Complete this mapping run? All records will remain in history.')) {
        void finishRun();
      }
      return;
    }

    Alert.alert(
      'Complete mapping run?',
      'The run and all records will remain in history. A new run can be started afterward.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete run',
          style: 'destructive',
          onPress: () => { void finishRun(); },
        },
      ],
    );
  };

  const changeTab = (nextTab: TabName) => {
    setTab(nextTab);
    if (nextTab === 'history') refreshHistory().catch(() => undefined);
  };

  if (!ready) {
    return (
      <View style={styles.loading}>
        <View style={styles.loadingLogo}><Text style={styles.loadingLogoText}>S</Text></View>
        <ActivityIndicator color={colors.mintDark} size="large" />
        <Text style={styles.loadingText}>Preparing field database…</Text>
        <StatusBar style="dark" />
      </View>
    );
  }

  if (bootError) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorTitle}>SoilBot could not start</Text>
        <Text style={styles.errorText}>{bootError}</Text>
        <StatusBar style="dark" />
      </View>
    );
  }

  if (!run) return <SetupScreen loading={starting} onStart={startRun} />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.app}>
        {desktopLayout ? <BottomNav active={tab} onChange={changeTab} variant="side" /> : null}
        <View style={styles.main}>
          {tab === 'map' ? (
            <MapScreen
              assignments={assignments}
              connectionDetail={connectionDetail}
              connectionStatus={connectionStatus}
              mockMode={settings.mockMode}
              onAssign={assignClone}
              run={run}
              telemetry={telemetry}
            />
          ) : tab === 'history' ? (
            <HistoryScreen recentAssignments={historyAssignments} runs={runSummaries} />
          ) : (
            <SettingsScreen
              connectionStatus={connectionStatus}
              onCompleteRun={requestCompleteRun}
              onSave={updateSettings}
              run={run}
              settings={settings}
            />
          )}
          {!desktopLayout ? <BottomNav active={tab} onChange={changeTab} /> : null}
        </View>
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.cream, flex: 1, paddingTop: Platform.OS === 'android' ? 28 : 0 },
  app: { backgroundColor: colors.cream, flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
  loading: { alignItems: 'center', backgroundColor: colors.cream, flex: 1, justifyContent: 'center', padding: 30 },
  loadingLogo: { alignItems: 'center', backgroundColor: colors.forest, borderRadius: 20, height: 68, justifyContent: 'center', marginBottom: 26, width: 68 },
  loadingLogoText: { color: colors.mint, fontSize: 34, fontWeight: '900' },
  loadingText: { color: colors.inkMuted, fontSize: 12, marginTop: 14 },
  errorTitle: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  errorText: { color: colors.red, fontSize: 12, lineHeight: 18, marginTop: 9, textAlign: 'center' },
});
