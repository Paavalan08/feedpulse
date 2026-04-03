import { createFeedback } from '../controllers/feedbackController';
import Feedback from '../models/Feedback';
import { analyzeFeedbackWithAI } from '../services/gemini.service';
import { Request, Response } from 'express';

jest.mock('../models/Feedback');
jest.mock('../services/gemini.service');

describe('Feedback Controller - Submission', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      body: {
        title: 'Test Title',
        description: 'This is a test description that is longer than 20 characters',
        category: 'Bug',
        submitterName: 'John Doe',
        submitterEmail: 'john@example.com',
      },
    };

    mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn(),
      headersSent: false,
    };
  });

  it('should validate title is not empty', async () => {
    mockReq.body.title = '';

    await createFeedback(mockReq, mockRes as unknown as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
      })
    );
  });

  it('should validate description length requirement', async () => {
    mockReq.body.description = 'Short';

    await createFeedback(mockReq, mockRes as unknown as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it('should reject invalid category', async () => {
    mockReq.body.category = 'InvalidCategory';

    await createFeedback(mockReq, mockRes as unknown as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it('should accept valid feedback submission', async () => {
    const mockFeedback = {
      _id: '123',
      ...mockReq.body,
    };

    (Feedback.create as jest.Mock).mockResolvedValue(mockFeedback);

    await createFeedback(mockReq, mockRes as unknown as Response);

    expect(mockRes.status).toHaveBeenCalledWith(201);
  });
});
