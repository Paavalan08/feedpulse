import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { sendApiResponse } from '../utils/apiResponse';

// Hardcoded admin credentials (Requirement 3.1)
const ADMIN_EMAIL = 'admin@feedpulse.com';
const ADMIN_PASSWORD = 'password123';

// @desc    Admin Login
// @route   POST /api/auth/login
// @access  Public
export const loginAdmin = (req: Request, res: Response): void => {
  const { email, password } = req.body;

  // 1. Check if credentials match
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    // 2. Generate a secure token valid for 1 day
    const token = jwt.sign(
      { role: 'admin' }, 
      process.env.JWT_SECRET as string, 
      { expiresIn: '1d' }
    );

    // 3. Return the token
    sendApiResponse(res, 200, {
      success: true,
      data: { token },
      message: 'Login successful',
    });
  } else {
    // 4. Reject invalid attempts
    sendApiResponse(res, 401, {
      success: false,
      error: 'Invalid email or password',
      message: 'Login failed',
    });
  }
};