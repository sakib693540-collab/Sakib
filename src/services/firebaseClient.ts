import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  FieldValue,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { LanguageCode, TranslationStrings, TRANSLATIONS } from '../i18n/translations';

// Initialize Firebase App, Firestore, and Auth
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Google Workspace Drive OAuth Scopes configured in Step 1
export const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.scripts',
];

const googleProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => googleProvider.addScope(scope));

// In-memory OAuth access token cache (never stored in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// Mandatory Firestore Connection Validation on Boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Mandatory Structured Firestore Error Handler
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helpful Multilingual Auth Error Translator
export function formatAuthErrorBn(error: unknown, t?: TranslationStrings): string {
  const dict = t || TRANSLATIONS.bn;
  const code = (error as { code?: string })?.code || '';
  const msg = error instanceof Error ? error.message : String(error);

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return dict.authErrInvalidCred;
  }
  if (code === 'auth/email-already-in-use') {
    return dict.authErrEmailInUse;
  }
  if (code === 'auth/weak-password') {
    return dict.authErrWeakPass;
  }
  if (code === 'auth/invalid-email') {
    return dict.authErrInvalidEmail;
  }
  if (code === 'auth/network-request-failed') {
    return dict.authErrNetwork;
  }
  if (code === 'auth/operation-not-allowed') {
    return dict.authErrOpNotAllowed;
  }
  if (code === 'auth/popup-closed-by-user') {
    return dict.authErrPopupClosed;
  }
  return `${dict.authErrGeneric}: ${msg}`;
}

export interface CloudPublicProfile {
  uid: string;
  username: string;
  avatar: string;
  preferredLanguage: LanguageCode;
  status: 'online' | 'offline' | 'searching' | 'in_game';
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt?: Timestamp | FieldValue | string;
  updatedAt?: Timestamp | FieldValue | string;
}

export interface CloudUserPrivate {
  uid: string;
  email: string;
  preferredLanguage: LanguageCode;
  soundEnabled: boolean;
  showCoordinates: boolean;
  driveBackupFileId: string;
  createdAt?: Timestamp | FieldValue | string;
  updatedAt?: Timestamp | FieldValue | string;
}

export interface CloudFriendRequest {
  requestId: string;
  fromUid: string;
  fromUsername: string;
  fromAvatar: string;
  toUid: string;
  toUsername: string;
  toAvatar: string;
  status: 'pending' | 'accepted' | 'declined';
  roomInviteCode: string;
  createdAt?: Timestamp | FieldValue | string;
  updatedAt?: Timestamp | FieldValue | string;
}

export interface CloudMatchHistoryRecord {
  matchId: string;
  ownerUid: string;
  opponentUid: string;
  opponentName: string;
  mode: 'online' | 'ai' | 'local';
  roomCode: string;
  playerNumber: 1 | 2;
  result: 'win' | 'loss' | 'draw';
  reason: string;
  totalMoves: number;
  remainingOwnPieces: number;
  remainingOpponentPieces: number;
  createdAt?: Timestamp | FieldValue | string;
}

function sanitizeUsername(raw: string): string {
  const cleaned = raw.trim().slice(0, 32);
  return cleaned.length >= 2 ? cleaned : `খেলোয়াড়_${Math.floor(100 + Math.random() * 899)}`;
}

// Initialize auth state listener
export const initAuthListener = (
  onUserChanged: (user: User | null, token: string | null) => void
) => {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedAccessToken = null;
      onUserChanged(null, null);
    } else {
      onUserChanged(user, cachedAccessToken);
    }
  });
};

// Google Sign-In with Workspace Drive OAuth Scopes
export const signInWithGoogle = async (): Promise<{
  user: User;
  accessToken: string | null;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

// Email/Password Registration + Verification Email
export const registerWithEmail = async (email: string, password: string): Promise<User> => {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  try {
    await sendEmailVerification(cred.user);
  } catch {
    // Non-fatal if verification email rate-limited
  }
  return cred.user;
};

// Email/Password Sign-In
export const loginWithEmail = async (email: string, password: string): Promise<User> => {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
};

// Password Reset Email
export const triggerPasswordReset = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email.trim());
};

// Change Password for Logged-In User
export const updateAccountPassword = async (newPassword: string): Promise<void> => {
  if (!auth.currentUser) throw new Error('Not signed in');
  await updatePassword(auth.currentUser, newPassword);
};

// Sign Out
export const signOutUser = async (): Promise<void> => {
  if (auth.currentUser) {
    try {
      await updateDoc(doc(db, 'publicProfiles', auth.currentUser.uid), {
        status: 'offline',
        updatedAt: serverTimestamp(),
      });
    } catch {
      // ignore offline error on signout
    }
  }
  await auth.signOut();
  cachedAccessToken = null;
};

// Load or Create User Profile & Private Data in Cloud Firestore (Merges Guest Stats if provided)
export async function ensureCloudUserProfile(
  user: User,
  preferredLanguage: LanguageCode,
  guestStats?: { gamesPlayed: number; wins: number; losses: number; draws: number },
  desiredUsername?: string
): Promise<{ profile: CloudPublicProfile; privateData: CloudUserPrivate }> {
  const uid = user.uid;
  const pubRef = doc(db, 'publicProfiles', uid);
  const privRef = doc(db, 'userPrivate', uid);

  let pubSnap;
  try {
    pubSnap = await getDoc(pubRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `publicProfiles/${uid}`);
  }

  let profile: CloudPublicProfile;
  if (!pubSnap.exists()) {
    const fallbackName = TRANSLATIONS[preferredLanguage]?.player1Short || 'Player';
    const defaultName = sanitizeUsername(
      desiredUsername || user.displayName || user.email?.split('@')[0] || fallbackName
    );
    const newProfile = {
      uid,
      username: defaultName,
      avatar: 'emerald_lotus',
      preferredLanguage,
      status: 'online' as const,
      gamesPlayed: Math.max(0, guestStats?.gamesPlayed || 0),
      wins: Math.max(0, guestStats?.wins || 0),
      losses: Math.max(0, guestStats?.losses || 0),
      draws: Math.max(0, guestStats?.draws || 0),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(pubRef, newProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `publicProfiles/${uid}`);
    }
    profile = { ...newProfile, createdAt: new Date().toISOString() };
  } else {
    const data = pubSnap.data() as CloudPublicProfile;
    try {
      await updateDoc(pubRef, {
        status: 'online',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `publicProfiles/${uid}`);
    }
    profile = { ...data, status: 'online' };
  }

  let privSnap;
  try {
    privSnap = await getDoc(privRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `userPrivate/${uid}`);
  }

  let privateData: CloudUserPrivate;
  if (!privSnap.exists()) {
    const newPriv = {
      uid,
      email: (user.email || '').slice(0, 254),
      preferredLanguage: profile.preferredLanguage,
      soundEnabled: true,
      showCoordinates: false,
      driveBackupFileId: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(privRef, newPriv);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `userPrivate/${uid}`);
    }
    privateData = newPriv;
  } else {
    privateData = privSnap.data() as CloudUserPrivate;
  }

  return { profile, privateData };
}

// Update User Profile (Username, Avatar, Language)
export async function updateCloudProfileDetails(
  uid: string,
  updates: {
    username: string;
    avatar: string;
    preferredLanguage: LanguageCode;
    status: 'online' | 'offline' | 'searching' | 'in_game';
  },
  privateUpdates?: {
    email: string;
    preferredLanguage: LanguageCode;
    soundEnabled: boolean;
    showCoordinates: boolean;
    driveBackupFileId: string;
  }
): Promise<void> {
  const pubRef = doc(db, 'publicProfiles', uid);
  try {
    await updateDoc(pubRef, {
      username: sanitizeUsername(updates.username),
      avatar: updates.avatar.slice(0, 64),
      preferredLanguage: updates.preferredLanguage,
      status: updates.status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `publicProfiles/${uid}`);
  }

  if (privateUpdates) {
    const privRef = doc(db, 'userPrivate', uid);
    try {
      await updateDoc(privRef, {
        email: privateUpdates.email.slice(0, 254),
        preferredLanguage: privateUpdates.preferredLanguage,
        soundEnabled: privateUpdates.soundEnabled,
        showCoordinates: privateUpdates.showCoordinates,
        driveBackupFileId: privateUpdates.driveBackupFileId.slice(0, 128),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `userPrivate/${uid}`);
    }
  }
}

// Save a Completed Match Record Idempotently (Avoids Duplicates via Deterministic ID)
export async function saveMatchResultToCloud(
  uid: string,
  matchRecord: Omit<CloudMatchHistoryRecord, 'createdAt'>,
  currentProfile: CloudPublicProfile
): Promise<CloudPublicProfile> {
  const safeDocId = `${uid}_${matchRecord.matchId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const matchRef = doc(db, 'matchHistory', safeDocId);

  let existingSnap;
  try {
    existingSnap = await getDoc(matchRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `matchHistory/${safeDocId}`);
  }

  // Guard against duplicate match writes on reconnect
  if (existingSnap.exists()) {
    return currentProfile;
  }

  try {
    await setDoc(matchRef, {
      ...matchRecord,
      matchId: safeDocId,
      ownerUid: uid,
      opponentUid: matchRecord.opponentUid.slice(0, 128),
      opponentName: matchRecord.opponentName.slice(0, 64),
      roomCode: matchRecord.roomCode.slice(0, 32),
      reason: matchRecord.reason.slice(0, 200),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `matchHistory/${safeDocId}`);
  }

  const nextStats = {
    gamesPlayed: currentProfile.gamesPlayed + 1,
    wins: currentProfile.wins + (matchRecord.result === 'win' ? 1 : 0),
    losses: currentProfile.losses + (matchRecord.result === 'loss' ? 1 : 0),
    draws: currentProfile.draws + (matchRecord.result === 'draw' ? 1 : 0),
    status: 'online' as const,
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'publicProfiles', uid), nextStats);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `publicProfiles/${uid}`);
  }

  return {
    ...currentProfile,
    gamesPlayed: nextStats.gamesPlayed,
    wins: nextStats.wins,
    losses: nextStats.losses,
    draws: nextStats.draws,
  };
}

// Subscribe to User's Match History
export function subscribeToMatchHistory(
  uid: string,
  onUpdate: (records: CloudMatchHistoryRecord[]) => void
) {
  const q = query(collection(db, 'matchHistory'), where('ownerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list: CloudMatchHistoryRecord[] = [];
      snap.forEach((d) => list.push(d.data() as CloudMatchHistoryRecord));
      list.sort((a, b) => {
        const ta = (a.createdAt as Timestamp)?.toMillis?.() || 0;
        const tb = (b.createdAt as Timestamp)?.toMillis?.() || 0;
        return tb - ta;
      });
      onUpdate(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'matchHistory')
  );
}

// Search Public Players by Username
export async function searchPublicPlayers(searchTerm: string): Promise<CloudPublicProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'publicProfiles'));
    const term = searchTerm.trim().toLowerCase();
    const results: CloudPublicProfile[] = [];
    snap.forEach((d) => {
      const p = d.data() as CloudPublicProfile;
      if (!term || p.username.toLowerCase().includes(term)) {
        results.push(p);
      }
    });
    return results.slice(0, 25);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'publicProfiles');
  }
}

// Send Friend Request
export async function sendCloudFriendRequest(
  fromProfile: CloudPublicProfile,
  toProfile: CloudPublicProfile
): Promise<void> {
  if (fromProfile.uid === toProfile.uid) return;
  const requestId = `${fromProfile.uid}_${toProfile.uid}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const ref = doc(db, 'friendRequests', requestId);
  try {
    await setDoc(ref, {
      requestId,
      fromUid: fromProfile.uid,
      fromUsername: fromProfile.username,
      fromAvatar: fromProfile.avatar,
      toUid: toProfile.uid,
      toUsername: toProfile.username,
      toAvatar: toProfile.avatar,
      status: 'pending',
      roomInviteCode: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `friendRequests/${requestId}`);
  }
}

// Respond to Friend Request (Accept / Decline)
export async function respondToCloudFriendRequest(
  requestId: string,
  status: 'accepted' | 'declined'
): Promise<void> {
  const ref = doc(db, 'friendRequests', requestId);
  try {
    await updateDoc(ref, {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `friendRequests/${requestId}`);
  }
}

// Invite Accepted Friend to a Private Room
export async function sendCloudRoomInviteToFriend(
  requestId: string,
  roomInviteCode: string
): Promise<void> {
  const ref = doc(db, 'friendRequests', requestId);
  try {
    await updateDoc(ref, {
      roomInviteCode: roomInviteCode.slice(0, 32),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `friendRequests/${requestId}`);
  }
}

// Subscribe to Incoming & Outgoing Friend Requests
export function subscribeToFriendRequests(
  uid: string,
  onUpdate: (requests: CloudFriendRequest[]) => void
) {
  const qIncoming = query(collection(db, 'friendRequests'), where('toUid', '==', uid));
  const qOutgoing = query(collection(db, 'friendRequests'), where('fromUid', '==', uid));

  let incomingList: CloudFriendRequest[] = [];
  let outgoingList: CloudFriendRequest[] = [];

  const emitCombined = () => {
    const map = new Map<string, CloudFriendRequest>();
    incomingList.forEach((r) => map.set(r.requestId, r));
    outgoingList.forEach((r) => map.set(r.requestId, r));
    onUpdate(Array.from(map.values()));
  };

  const unsubIn = onSnapshot(
    qIncoming,
    (snap) => {
      incomingList = [];
      snap.forEach((d) => incomingList.push(d.data() as CloudFriendRequest));
      emitCombined();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'friendRequests')
  );

  const unsubOut = onSnapshot(
    qOutgoing,
    (snap) => {
      outgoingList = [];
      snap.forEach((d) => outgoingList.push(d.data() as CloudFriendRequest));
      emitCombined();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'friendRequests')
  );

  return () => {
    unsubIn();
    unsubOut();
  };
}

// Report or Block Abusive Player
export async function submitPlayerReportOrBlock(
  reporterUid: string,
  reportedUid: string,
  reportedUsername: string,
  reason: string,
  actionType: 'report' | 'block'
): Promise<void> {
  const reportId = `${reporterUid}_${reportedUid}_${Date.now()}`
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
  try {
    await setDoc(doc(db, 'playerReports', reportId), {
      reportId,
      reporterUid,
      reportedUid,
      reportedUsername: reportedUsername.slice(0, 64),
      reason: reason.slice(0, 300),
      actionType,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `playerReports/${reportId}`);
  }
}

// Delete All User Cloud Data & Account
export async function deleteAllUserCloudData(uid: string): Promise<void> {
  // 1. Delete user's matchHistory docs
  const matchesSnap = await getDocs(
    query(collection(db, 'matchHistory'), where('ownerUid', '==', uid))
  );
  for (const d of matchesSnap.docs) {
    await deleteDoc(doc(db, 'matchHistory', d.id));
  }

  // 2. Delete friendRequests involving user
  const fIn = await getDocs(query(collection(db, 'friendRequests'), where('toUid', '==', uid)));
  for (const d of fIn.docs) {
    await deleteDoc(doc(db, 'friendRequests', d.id));
  }
  const fOut = await getDocs(query(collection(db, 'friendRequests'), where('fromUid', '==', uid)));
  for (const d of fOut.docs) {
    await deleteDoc(doc(db, 'friendRequests', d.id));
  }

  // 3. Delete private and public profile documents
  await deleteDoc(doc(db, 'userPrivate', uid));
  await deleteDoc(doc(db, 'publicProfiles', uid));

  // 4. Delete Firebase Auth user if signed in
  if (auth.currentUser && auth.currentUser.uid === uid) {
    await auth.currentUser.delete();
  }
}

// Google Drive API Integration: Save & Restore Player Backup JSON
const DRIVE_BACKUP_FILENAME = 'sholo_guti_cloud_backup.json';

export async function saveBackupToGoogleDrive(backupData: Record<string, unknown>): Promise<{
  fileId: string;
  fileName: string;
  modifiedTime: string;
}> {
  let token = await getAccessToken();
  if (!token) {
    const res = await signInWithGoogle();
    token = res.accessToken;
  }
  if (!token) {
    throw new Error('Google Drive অ্যাক্সেস টোকেন পাওয়া যায়নি। অনুগ্রহ করে Google দিয়ে সাইন ইন করুন।');
  }

  // Search if sholo_guti_cloud_backup.json already exists in user's Drive
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    `name = '${DRIVE_BACKUP_FILENAME}' and trashed = false`
  )}&fields=files(id,name,modifiedTime)`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const searchJson = await searchRes.json();
  const existingFile = searchJson.files?.[0];

  const fileContent = JSON.stringify(backupData, null, 2);

  if (existingFile?.id) {
    // Update existing Drive file content
    const uploadRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media&fields=id,name,modifiedTime`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: fileContent,
      }
    );
    if (!uploadRes.ok) {
      throw new Error('Google Drive ব্যাকআপ আপডেট করতে সমস্যা হয়েছে।');
    }
    const updated = await uploadRes.json();
    return {
      fileId: updated.id,
      fileName: updated.name || DRIVE_BACKUP_FILENAME,
      modifiedTime: updated.modifiedTime || new Date().toISOString(),
    };
  } else {
    // Create new multipart file on Google Drive
    const metadata = {
      name: DRIVE_BACKUP_FILENAME,
      mimeType: 'application/json',
      description: 'Sholo Guti (ষোলো গুটি) Player Profile, Statistics & Match History Backup',
    };
    const boundary = 'sholo_guti_drive_boundary';
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--`;

    const createRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );
    if (!createRes.ok) {
      throw new Error('Google Drive-এ নতুন ব্যাকআপ ফাইল তৈরি করতে সমস্যা হয়েছে।');
    }
    const created = await createRes.json();
    return {
      fileId: created.id,
      fileName: created.name || DRIVE_BACKUP_FILENAME,
      modifiedTime: created.modifiedTime || new Date().toISOString(),
    };
  }
}

export async function loadBackupFromGoogleDrive(): Promise<Record<string, unknown> | null> {
  let token = await getAccessToken();
  if (!token) {
    const res = await signInWithGoogle();
    token = res.accessToken;
  }
  if (!token) {
    throw new Error('Google Drive অ্যাক্সেস টোকেন পাওয়া যায়নি।');
  }

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    `name = '${DRIVE_BACKUP_FILENAME}' and trashed = false`
  )}&fields=files(id,name,modifiedTime)`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const searchJson = await searchRes.json();
  const file = searchJson.files?.[0];
  if (!file?.id) {
    return null;
  }

  const downloadRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!downloadRes.ok) {
    throw new Error('Google Drive থেকে ব্যাকআপ ফাইল পড়তে সমস্যা হয়েছে।');
  }
  return await downloadRes.json();
}
