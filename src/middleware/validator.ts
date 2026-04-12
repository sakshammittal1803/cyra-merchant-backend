import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

// Validation helper
const validateField = (value: any, fieldName: string, rules: any) => {
  if (rules.required && (value === undefined || value === null || value === '')) {
    throw new AppError(`${fieldName} is required`, 400);
  }

  if (value !== undefined && value !== null && value !== '') {
    if (rules.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new AppError(`${fieldName} must be a valid email`, 400);
    }

    if (rules.type === 'number' && isNaN(Number(value))) {
      throw new AppError(`${fieldName} must be a number`, 400);
    }

    if (rules.minLength && value.length < rules.minLength) {
      throw new AppError(`${fieldName} must be at least ${rules.minLength} characters`, 400);
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      throw new AppError(`${fieldName} must not exceed ${rules.maxLength} characters`, 400);
    }

    if (rules.min !== undefined && Number(value) < rules.min) {
      throw new AppError(`${fieldName} must be at least ${rules.min}`, 400);
    }

    if (rules.max !== undefined && Number(value) > rules.max) {
      throw new AppError(`${fieldName} must not exceed ${rules.max}`, 400);
    }

    if (rules.enum && !rules.enum.includes(value)) {
      throw new AppError(`${fieldName} must be one of: ${rules.enum.join(', ')}`, 400);
    }
  }
};

// Generic validator middleware
export const validate = (schema: Record<string, any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      for (const [field, rules] of Object.entries(schema)) {
        const value = req.body[field];
        validateField(value, field, rules);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Specific validators
export const validateLogin = validate({
  email: { required: true, type: 'email' },
  password: { required: true, minLength: 6 },
});

export const validateSignup = validate({
  name: { required: true, minLength: 2, maxLength: 100 },
  email: { required: true, type: 'email' },
  password: { required: true, minLength: 6, maxLength: 100 },
  role: { required: true, enum: ['admin', 'staff'] },
  restaurantName: { required: true, minLength: 2, maxLength: 200 },
});

export const validateGoogleSignup = validate({
  name: { required: true, minLength: 2, maxLength: 100 },
  email: { required: true, type: 'email' },
  role: { required: true, enum: ['admin', 'staff'] },
  restaurantName: { required: true, minLength: 2, maxLength: 200 },
  googleId: { required: true },
});

export const validateMenuItem = validate({
  name: { required: true, minLength: 2, maxLength: 200 },
  description: { required: false, maxLength: 500 },
  price: { required: true, type: 'number', min: 0 },
  category: { required: true, minLength: 2, maxLength: 100 },
  phase: { required: false, enum: ['menstrual', 'follicular', 'ovulation', 'luteal', 'all'] },
});

export const validateOrderStatus = validate({
  status: { required: true, enum: ['pending', 'preparing', 'completed', 'cancelled'] },
});
