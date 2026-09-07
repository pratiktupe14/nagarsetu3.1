/**
 * @deprecated Legacy in-memory profile service.
 * All authoritative profile mutations and retrievals now route directly through:
 * - Backend API: PUT /api/auth/profile and GET /api/auth/me
 * - Frontend: useAuth().updateUserProfile() in AuthContext.tsx
 * PostgreSQL users & profiles tables are the single source of truth.
 */
import { UserProfile } from '../types/database.types';

// Purge legacy local storage if present
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('nagarsetu_user_profiles_v3');
  } catch (e) {}
}

let memoryProfiles: UserProfile[] = [];

export function getStoredProfiles(): UserProfile[] {
  return memoryProfiles;
}

export function saveStoredProfiles(profiles: UserProfile[]) {
  memoryProfiles = profiles;
}

export function saveProfileRecord(profile: UserProfile): UserProfile {
  const existingIdx = memoryProfiles.findIndex((p) => p.id === profile.id || p.email === profile.email);
  if (existingIdx >= 0) {
    memoryProfiles[existingIdx] = { ...memoryProfiles[existingIdx], ...profile };
  } else {
    memoryProfiles.unshift(profile);
  }
  return profile;
}
