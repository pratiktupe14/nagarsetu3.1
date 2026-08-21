import { UserProfile } from '../types/database.types';

const LOCAL_STORAGE_PROFILES_KEY = 'nagarsetu_user_profiles_v3';

export function getStoredProfiles(): UserProfile[] {
  const data = localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {}
  }
  return [];
}

export function saveStoredProfiles(profiles: UserProfile[]) {
  localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(profiles));
}

export function saveProfileRecord(profile: UserProfile): UserProfile {
  const profiles = getStoredProfiles();
  const existingIdx = profiles.findIndex((p) => p.id === profile.id || p.email === profile.email);
  if (existingIdx >= 0) {
    profiles[existingIdx] = { ...profiles[existingIdx], ...profile };
  } else {
    profiles.unshift(profile);
  }
  saveStoredProfiles(profiles);
  return profile;
}
