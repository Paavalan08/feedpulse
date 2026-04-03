import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendApiResponse } from '../utils/apiResponse';

// Extend the Express Request type to include our user payload
export interface AuthRequest extends Request {
  user?: any;
}

export const protect = (req: AuthRequest, res: Response, next: NextFunction): void => {
  let token: string | undefined;

  // 1. Check if the token is in the headers (Format: "Bearer <token>")
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 2. Extract the token string
      token = req.headers.authorization.split(' ')[1];

      // 3. Verify the token using our secret key
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string);

      // 4. Attach the decoded user info to the request and move to the next function
      req.user = decoded;
      next();
      return;
    } catch (error) {
      sendApiResponse(res, 401, {
        success: false,
        error: 'Not authorized, token failed',
        message: 'Authentication failed',
      });
      return;
    }
  }

  // 5. If no token was found at all
  if (!token) {
    sendApiResponse(res, 401, {
      success: false,
      error: 'Not authorized, no token provided',
      message: 'Authentication required',
    });
  }
};