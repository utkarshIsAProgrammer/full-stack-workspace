/**
 * Feature Flags System
 * 
 * This system allows for gradual rollout of features, A/B testing, and
 * quick disabling of features in production without code deployments.
 * 
 * Feature flags can be controlled via:
 * 1. Environment variables (for server-side control)
 * 2. Local storage (for user-specific overrides)
 * 3. Remote configuration (for dynamic control)
 */

export type FeatureFlag = 
  | 'new_ui_design'
  | 'advanced_search'
  | 'video_posts'
  | 'voice_messages'
  | 'story_mode'
  | 'analytics_dashboard'
  | 'dark_mode_v2'
  | 'enhanced_notifications';

interface FeatureFlagConfig {
  enabled: boolean;
  rolloutPercentage?: number; // 0-100, for gradual rollout
  description: string;
  targetUsers?: string[]; // Specific user IDs for testing
}

// Default feature flag configuration
const DEFAULT_FLAGS: Record<FeatureFlag, FeatureFlagConfig> = {
  new_ui_design: {
    enabled: false,
    rolloutPercentage: 0,
    description: 'New modern UI design with improved UX',
  },
  advanced_search: {
    enabled: true,
    rolloutPercentage: 100,
    description: 'Advanced search with filters and sorting',
  },
  video_posts: {
    enabled: false,
    rolloutPercentage: 0,
    description: 'Support for video posts in the feed',
  },
  voice_messages: {
    enabled: true,
    rolloutPercentage: 100,
    description: 'Voice messages in chat',
  },
  story_mode: {
    enabled: false,
    rolloutPercentage: 0,
    description: 'Instagram-style stories feature',
  },
  analytics_dashboard: {
    enabled: false,
    rolloutPercentage: 0,
    description: 'User analytics dashboard',
  },
  dark_mode_v2: {
    enabled: false,
    rolloutPercentage: 0,
    description: 'Enhanced dark mode with better contrast',
  },
  enhanced_notifications: {
    enabled: true,
    rolloutPercentage: 100,
    description: 'Rich notifications with images and actions',
  },
};

/**
 * Check if a feature flag is enabled for the current user
 */
export const isFeatureEnabled = (
  flag: FeatureFlag,
  userId?: string
): boolean => {
  const config = DEFAULT_FLAGS[flag];
  
  // Check local storage override (for testing)
  const localOverride = localStorage.getItem(`feature_flag_${flag}`);
  if (localOverride !== null) {
    return localOverride === 'true';
  }
  
  // Check environment variable override
  const envOverride = import.meta.env[`VITE_FEATURE_FLAG_${flag.toUpperCase()}`];
  if (envOverride !== undefined) {
    return envOverride === 'true';
  }
  
  // If explicitly disabled, return false
  if (!config.enabled) {
    return false;
  }
  
  // Check if user is in target list
  if (userId && config.targetUsers?.includes(userId)) {
    return true;
  }
  
  // Check rollout percentage
  if (config.rolloutPercentage !== undefined && config.rolloutPercentage < 100) {
    if (!userId) {
      return false; // Require user ID for percentage-based rollout
    }
    
    // Consistent hash based on user ID
    const hash = hashString(userId);
    const percentage = (hash % 100) + 1;
    return percentage <= config.rolloutPercentage;
  }
  
  return config.enabled;
};

/**
 * Get all feature flags (for admin/debugging)
 */
export const getAllFeatureFlags = (): Record<FeatureFlag, FeatureFlagConfig> => {
  return { ...DEFAULT_FLAGS };
};

/**
 * Override a feature flag locally (for testing)
 */
export const setFeatureFlagOverride = (flag: FeatureFlag, enabled: boolean): void => {
  localStorage.setItem(`feature_flag_${flag}`, String(enabled));
  // Dispatch event for reactivity
  window.dispatchEvent(new CustomEvent('featureFlagChanged', { detail: { flag, enabled } }));
};

/**
 * Clear local feature flag override
 */
export const clearFeatureFlagOverride = (flag: FeatureFlag): void => {
  localStorage.removeItem(`feature_flag_${flag}`);
  window.dispatchEvent(new CustomEvent('featureFlagChanged', { detail: { flag, enabled: null } }));
};

/**
 * Simple string hash for consistent rollout
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
