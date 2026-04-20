// FIX: Removed duplicate Zustand auth store. Auth state is managed by AuthContext (useAuth hook).
// This file is kept to avoid breaking any existing imports.
// Use `useAuth()` from context/AuthContext instead.
export { useAuth as useAuthStore } from '../context/AuthContext';
