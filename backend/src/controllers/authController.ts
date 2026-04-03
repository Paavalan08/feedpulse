import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { sendApiResponse } from '../utils/apiResponse';

// @desc    Admin Login
// @route   POST /api/auth/login
// @access  Public
export const loginAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!rawEmail || !rawPassword) {
      sendApiResponse(res, 400, {
        success: false,
        error: 'Please provide email and password',
        message: 'Validation failed',
      });
      return;
    }

    const user = await User.findOne({ email: rawEmail, role: 'admin' });

    if (!user) {
      sendApiResponse(res, 401, {
        success: false,
        error: 'Invalid email or password',
        message: 'Login failed',
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(rawPassword, user.passwordHash);

    if (!passwordMatches) {
      sendApiResponse(res, 401, {
        success: false,
        error: 'Invalid email or password',
        message: 'Login failed',
      });
      return;
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' }
    );

    sendApiResponse(res, 200, {
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      message: 'Login successful',
    });
  } catch (error) {
    sendApiResponse(res, 500, {
      success: false,
      error: 'Failed to log in',
      message: 'Login failed',
    });
  }
};