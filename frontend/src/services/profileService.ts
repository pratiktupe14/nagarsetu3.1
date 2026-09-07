import { UserProfile } from '../types/database.types';

const LOCAL_STORAGE_PROFILES_KEY = 'nagarsetu_user_profiles_v3';

// Purge legacy storage
try {
  localStorage.removeItem(LOCAL_STORAGE_PROFILES_KEY);
} catch (e) {}

// In-memory runtime cache (PostgreSQL users & profiles are authoritative)
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
