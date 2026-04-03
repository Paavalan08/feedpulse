import { updateFeedbackStatus } from '../controllers/feedbackController';
import Feedback from '../models/Feedback';
import { Request, Response } from 'express';

jest.mock('../models/Feedback');

describe('Feedback Controller - Status Update', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      params: {
        id: '507f1f77bcf86cd799439011', // Valid MongoDB ObjectId
      },
      body: {
        status: 'In Review',
      },
    };

    mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn(),
    };
  });

  it('should update feedback status correctly', async () => {
    const mockFeedback = {
      _id: '507f1f77bcf86cd799439011',
      title: 'Test',
      status: 'In Review',
    };

    (Feedback.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockFeedback);

    await updateFeedbackStatus(mockReq, mockRes as unknown as Response);

    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it('should reject invalid status value', async () => {
    mockReq.body.status = 'InvalidStatus';

    await updateFeedbackStatus(mockReq, mockRes as unknown as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it('should handle feedback not found', async () => {
    (Feedback.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

    await updateFeedbackStatus(mockReq, mockRes as unknown as Response);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });
});
