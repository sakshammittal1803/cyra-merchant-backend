"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateOrderStatus = exports.validateMenuItem = exports.validateGoogleSignup = exports.validateSignup = exports.validateLogin = exports.validate = void 0;
const errorHandler_1 = require("./errorHandler");
// Validation helper
const validateField = (value, fieldName, rules) => {
    if (rules.required && (value === undefined || value === null || value === '')) {
        throw new errorHandler_1.AppError(`${fieldName} is required`, 400);
    }
    if (value !== undefined && value !== null && value !== '') {
        if (rules.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw new errorHandler_1.AppError(`${fieldName} must be a valid email`, 400);
        }
        if (rules.type === 'number' && isNaN(Number(value))) {
            throw new errorHandler_1.AppError(`${fieldName} must be a number`, 400);
        }
        if (rules.minLength && value.length < rules.minLength) {
            throw new errorHandler_1.AppError(`${fieldName} must be at least ${rules.minLength} characters`, 400);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
            throw new errorHandler_1.AppError(`${fieldName} must not exceed ${rules.maxLength} characters`, 400);
        }
        if (rules.min !== undefined && Number(value) < rules.min) {
            throw new errorHandler_1.AppError(`${fieldName} must be at least ${rules.min}`, 400);
        }
        if (rules.max !== undefined && Number(value) > rules.max) {
            throw new errorHandler_1.AppError(`${fieldName} must not exceed ${rules.max}`, 400);
        }
        if (rules.enum && !rules.enum.includes(value)) {
            throw new errorHandler_1.AppError(`${fieldName} must be one of: ${rules.enum.join(', ')}`, 400);
        }
    }
};
// Generic validator middleware
const validate = (schema) => {
    return (req, res, next) => {
        try {
            for (const [field, rules] of Object.entries(schema)) {
                const value = req.body[field];
                validateField(value, field, rules);
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.validate = validate;
// Specific validators
exports.validateLogin = (0, exports.validate)({
    email: { required: true, type: 'email' },
    password: { required: true, minLength: 6 },
});
exports.validateSignup = (0, exports.validate)({
    name: { required: true, minLength: 2, maxLength: 100 },
    email: { required: true, type: 'email' },
    password: { required: true, minLength: 6, maxLength: 100 },
    role: { required: true, enum: ['admin', 'staff'] },
    restaurantName: { required: true, minLength: 2, maxLength: 200 },
});
exports.validateGoogleSignup = (0, exports.validate)({
    name: { required: true, minLength: 2, maxLength: 100 },
    email: { required: true, type: 'email' },
    role: { required: true, enum: ['admin', 'staff'] },
    restaurantName: { required: true, minLength: 2, maxLength: 200 },
    googleId: { required: true },
});
exports.validateMenuItem = (0, exports.validate)({
    name: { required: true, minLength: 2, maxLength: 200 },
    description: { required: false, maxLength: 500 },
    price: { required: true, type: 'number', min: 0 },
    category: { required: true, minLength: 2, maxLength: 100 },
    phase: { required: false, enum: ['menstrual', 'follicular', 'ovulation', 'luteal', 'all'] },
});
exports.validateOrderStatus = (0, exports.validate)({
    status: { required: true, enum: ['pending', 'preparing', 'completed', 'cancelled'] },
});
