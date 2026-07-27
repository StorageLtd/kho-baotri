import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendEmailVerification,
  signInWithEmailAndPassword, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let currentProfile = null;

export const onSessionChanged = (callback) => onAuthStateChanged(auth, callback);
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signOutUser = () => signOut(auth);
export const sendVerification = (user) => sendEmailVerification(user);
export const getUser = () => auth.currentUser;
export const getToken = () => auth.currentUser?.getIdToken();

async function createDefaultProfile() {
  const token = await getToken();
  const user = auth.currentUser;
  const response = await fetch(`${firebaseConfig.databaseURL}/users/${user.uid}.json?auth=${encodeURIComponent(token)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName: user.displayName || user.email.split("@")[0],
      email: user.email,
      role: "technician",
      createdAt: new Date().toISOString()
    })
  });
  if (!response.ok) throw new Error("Không thể tạo hồ sơ quyền cho tài khoản.");
  return response.json();
}

export async function registerAccount({ displayName, email, password }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  const token = await credential.user.getIdToken();
  const response = await fetch(`${firebaseConfig.databaseURL}/users/${credential.user.uid}.json?auth=${encodeURIComponent(token)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName,
      email: credential.user.email,
      role: "technician",
      createdAt: new Date().toISOString()
    })
  });
  if (!response.ok) throw new Error("Không thể tạo hồ sơ quyền cho tài khoản.");
  await sendEmailVerification(credential.user);
  return credential;
}

export async function loadProfile() {
  const token = await getToken();
  if (!token) return null;
  const response = await fetch(`${firebaseConfig.databaseURL}/users/${auth.currentUser.uid}.json?auth=${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error("Không thể tải quyền người dùng.");
  currentProfile = await response.json();
  if (!currentProfile) currentProfile = await createDefaultProfile();
  return currentProfile;
}

export function role() { return currentProfile?.role || "viewer"; }
export function canEdit() { return ["admin", "manager"].includes(role()); }
export function displayName() { return currentProfile?.displayName || auth.currentUser?.email || "Người dùng"; }
