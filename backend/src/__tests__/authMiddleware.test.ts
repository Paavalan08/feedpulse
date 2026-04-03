import { protect } from '../middleware/authMiddleware';
import { Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };

    mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn(),
      headersSent: false,
    };

    mockNext = jest.fn();

    process.env.JWT_SECRET = 'test-secret';
  });

  it('should reject requests without token', () => {
    protect(mockReq, mockRes as unknown as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      data: null,
      error: 'Not authorized, no token provided',
      message: 'Authentication required',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject requests with invalid token', () => {
    mockReq.headers.authorization = 'Bearer invalid.token.here';

    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid token');
    });

    protect(mockReq, mockRes as unknown as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should allow requests with valid token', () => {
    const mockDecoded = { role: 'admin' };
    mockReq.headers.authorization = 'Bearer valid.token.here';

    (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);

    protect(mockReq, mockRes as unknown as Response, mockNext);

    expect(mockReq.user).toEqual(mockDecoded);
    expect(mockNext).toHaveBeenCalled();
  });
});
