import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import firebase from 'firebase/compat/app';
import 'firebase/compat/remote-config';
import { FIRESTORE_CONFIG } from '../firebase/dev-firestore-config';
import { requiresAppUpdate } from './build-policy';

export type AppAccessGate = {
  mode: 'maintenance' | 'update-required';
  title: string;
  message: string;
};

const REMOTE_CONFIG_DEFAULTS = {
  maintenanceMode: false,
  maintenanceTitle: 'Down for Maintenance',
  maintenanceMessage: 'GemSprout is currently undergoing maintenance. Please check back soon.',
  minimumSupportedBuild: 0,
  minimumSupportedBuildTitle: 'Please Update GemSprout',
  minimumSupportedBuildMessage: 'An update is available! Please update the app to continue using GemSprout.',
};

let cachedRemoteConfig: firebase.remoteConfig.RemoteConfig | null = null;

export async function checkAppAccess(forceRefresh = false): Promise<AppAccessGate | null> {
  let remoteConfig: firebase.remoteConfig.RemoteConfig | null = null;
  try {
    remoteConfig = getRemoteConfig();
    remoteConfig.settings.fetchTimeoutMillis = 8_000;
    remoteConfig.settings.minimumFetchIntervalMillis = forceRefresh ? 0 : 60_000;
    await remoteConfig.fetchAndActivate();
  } catch (error) {
    console.warn('Remote Config unavailable; using cached settings:', error);
    try {
      remoteConfig = remoteConfig || getRemoteConfig();
    } catch {
      return null;
    }
  }
  if (!remoteConfig) return null;

  if (remoteConfig.getBoolean('maintenanceMode')) {
    return {
      mode: 'maintenance',
      title: remoteConfig.getString('maintenanceTitle').trim() || REMOTE_CONFIG_DEFAULTS.maintenanceTitle,
      message: remoteConfig.getString('maintenanceMessage').trim() || REMOTE_CONFIG_DEFAULTS.maintenanceMessage,
    };
  }

  if (!Capacitor.isNativePlatform()) return null;

  const minimumBuild = remoteConfig.getNumber('minimumSupportedBuild');
  if (minimumBuild <= 0) return null;

  try {
    const appInfo = await App.getInfo();
    if (requiresAppUpdate(appInfo.build, minimumBuild)) {
      return {
        mode: 'update-required',
        title: remoteConfig.getString('minimumSupportedBuildTitle').trim() || REMOTE_CONFIG_DEFAULTS.minimumSupportedBuildTitle,
        message: remoteConfig.getString('minimumSupportedBuildMessage').trim() || REMOTE_CONFIG_DEFAULTS.minimumSupportedBuildMessage,
      };
    }
  } catch (error) {
    console.warn('Could not read installed app build; allowing app to continue:', error);
  }

  return null;
}

function getRemoteConfig(): firebase.remoteConfig.RemoteConfig {
  if (cachedRemoteConfig) return cachedRemoteConfig;
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIRESTORE_CONFIG);
  const remoteConfig = app.remoteConfig();
  remoteConfig.defaultConfig = REMOTE_CONFIG_DEFAULTS;
  cachedRemoteConfig = remoteConfig;
  return remoteConfig;
}
