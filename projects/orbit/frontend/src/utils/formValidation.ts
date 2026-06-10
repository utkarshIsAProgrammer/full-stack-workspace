/**
 * Real-time Form Validation with Inline Feedback
 * 
 * This utility provides real-time form validation with
 * inline error messages based on backend validation rules.
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  email?: boolean;
  match?: string; // Field name to match (for password confirmation)
  custom?: (value: string) => string | null; // Custom validation function
}

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Validate a single field against rules
 */
export const validateField = (
  value: string,
  rules: ValidationRule,
  allValues?: Record<string, string>
): ValidationResult => {
  // Required validation
  if (rules.required && !value.trim()) {
    return { isValid: false, error: 'This field is required' };
  }

  // Skip other validations if field is empty and not required
  if (!value.trim() && !rules.required) {
    return { isValid: true, error: null };
  }

  // Min length validation
  if (rules.minLength && value.length < rules.minLength) {
    return { isValid: false, error: `Minimum ${rules.minLength} characters required` };
  }

  // Max length validation
  if (rules.maxLength && value.length > rules.maxLength) {
    return { isValid: false, error: `Maximum ${rules.maxLength} characters allowed` };
  }

  // Pattern validation
  if (rules.pattern && !rules.pattern.test(value)) {
    return { isValid: false, error: 'Invalid format' };
  }

  // Email validation
  if (rules.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { isValid: false, error: 'Invalid email address' };
    }
  }

  // Match validation (for password confirmation)
  if (rules.match && allValues) {
    const matchValue = allValues[rules.match];
    if (value !== matchValue) {
      return { isValid: false, error: 'Passwords do not match' };
    }
  }

  // Custom validation
  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      return { isValid: false, error: customError };
    }
  }

  return { isValid: true, error: null };
};

/**
 * Validate entire form
 */
export const validateForm = (
  values: Record<string, string>,
  rules: Record<string, ValidationRule>
): Record<string, ValidationResult> => {
  const results: Record<string, ValidationResult> = {};

  for (const [field, fieldRules] of Object.entries(rules)) {
    results[field] = validateField(values[field] || '', fieldRules, values);
  }

  return results;
};

/**
 * Check if form is valid
 */
export const isFormValid = (results: Record<string, ValidationResult>): boolean => {
  return Object.values(results).every((result) => result.isValid);
};

// Common validation rules
export const commonRules = {
  username: {
    required: true,
    minLength: 3,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_]+$/,
    custom: (value: string) => {
      if (!/^[a-zA-Z]/.test(value)) {
        return 'Username must start with a letter';
      }
      return null;
    },
  } as ValidationRule,

  email: {
    required: true,
    email: true,
  } as ValidationRule,

  password: {
    required: true,
    minLength: 8,
    custom: (value: string) => {
      if (!/[A-Z]/.test(value)) {
        return 'Password must contain at least one uppercase letter';
      }
      if (!/[a-z]/.test(value)) {
        return 'Password must contain at least one lowercase letter';
      }
      if (!/[0-9]/.test(value)) {
        return 'Password must contain at least one number';
      }
      return null;
    },
  } as ValidationRule,

  confirmPassword: {
    required: true,
    match: 'password',
  } as ValidationRule,

  fullName: {
    required: true,
    minLength: 2,
    maxLength: 50,
  } as ValidationRule,

  postContent: {
    required: true,
    minLength: 1,
    maxLength: 500,
  } as ValidationRule,

  commentContent: {
    required: true,
    minLength: 1,
    maxLength: 280,
  } as ValidationRule,
};
