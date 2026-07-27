import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let currentProfile = null;

export const onSessionChanged = (callback) => onAuthStateChanged(auth, callback);
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signOutUser = () => signOut(auth);
export const getUser = () => auth.currentUser;
export const getToken = () => auth.currentUser?.getIdToken();

export async function loadProfile() {
  const token = await getToken();
  if (!token) return null;
  const response = await fetch(`${firebaseConfig.databaseURL}/users/${auth.currentUser.uid}.json?auth=${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error("Không thể tải quyền người dùng.");
  currentProfile = await response.json();
  return currentProfile;
}

export function role() { return currentProfile?.role || "viewer"; }
export function canEdit() { return ["admin", "manager"].includes(role()); }
export function displayName() { return currentProfile?.displayName || auth.currentUser?.email || "Người dùng"; }
