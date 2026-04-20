// FIX: Removed duplicate axios instance. All API calls now go through services/api.ts
// This file re-exports for any existing imports from this path.
export { default, default as api } from '../services/api';
