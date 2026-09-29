"use client";

export interface LocationPrivacySettings {
  enabled: boolean;
  purpose: {
    discovery: boolean;
    recommendations: boolean;
    navigation: boolean;
    airportTransfers: boolean;
  };
  lastUpdated: string;
}

const STORAGE_KEY = "aurelia_location_privacy_v1";

const DEFAULT_SETTINGS: LocationPrivacySettings = {
  enabled: true,
  purpose: {
    discovery: true,
    recommendations: true,
    navigation: true,
    airportTransfers: true,
  },
  lastUpdated: new Date().toISOString(),
};

export function getLocationPrivacySettings(): LocationPrivacySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveLocationPrivacySettings(settings: Partial<LocationPrivacySettings>): LocationPrivacySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const current = getLocationPrivacySettings();
    const updated: LocationPrivacySettings = {
      ...current,
      ...settings,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
