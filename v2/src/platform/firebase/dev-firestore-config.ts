export const DEV_FIRESTORE_FAMILY_ID = 'migration-preview';

export const DEV_FIRESTORE_CONFIG = {
  projectId: 'gemsprout-v2-dev',
  appId: '1:578603238289:web:cf9d90b51580e437379030',
  storageBucket: 'gemsprout-v2-dev.firebasestorage.app',
  apiKey: 'AIzaSyBMVJlIRL1avzDjaZ3RB1ANCy5u2pAJlQE',
  authDomain: 'gemsprout-v2-dev.firebaseapp.com',
  messagingSenderId: '578603238289',
};

export const PRODUCTION_FIRESTORE_CONFIG = {
  projectId: 'gemsprout1',
  appId: '1:493782739457:web:64d2afa5766ee1b481ee00',
  storageBucket: 'gemsprout1.firebasestorage.app',
  apiKey: 'AIzaSyCypfI4iSfTdTZWBAm1p4OO2MfzHH4zjNU',
  authDomain: 'gemsprout1.firebaseapp.com',
  messagingSenderId: '493782739457',
  measurementId: 'G-1WDH5Q2STT',
};

declare const GEMSPROUT_V2_FIREBASE_TARGET: string;

export const IS_V2_DEV_BUILD = GEMSPROUT_V2_FIREBASE_TARGET !== 'production';
export const FIRESTORE_CONFIG = IS_V2_DEV_BUILD ? DEV_FIRESTORE_CONFIG : PRODUCTION_FIRESTORE_CONFIG;
export const DEFAULT_FIRESTORE_FAMILY_ID = IS_V2_DEV_BUILD ? DEV_FIRESTORE_FAMILY_ID : '';
