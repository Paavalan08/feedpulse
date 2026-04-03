import { Request, Response } from 'express';
import Feedback from '../models/Feedback';
import { analyzeFeedbackWithAI } from '../services/gemini.service';
import { sendApiResponse } from '../utils/apiResponse';

// @desc    Submit new feedback
// @route   POST /api/feedback
// @access  Public
export const createFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, category, submitterName, submitterEmail } = req.body;
    const sanitizedTitle = typeof title === 'string' ? title.trim() : '';
    const sanitizedDescription = typeof description === 'string' ? description.trim() : '';

    // 1. Basic Input Validation (Requirement 4.5)
    if (!sanitizedTitle || !sanitizedDescription || !category) {
      sendApiResponse(res, 400, {
        success: false,
        error: 'Please provide title, description, and category',
        message: 'Validation failed',
      });
      return;
    }

    if (sanitizedDescription.length < 20) {
      sendApiResponse(res, 400, {
        success: false,
        error: 'Description must be at least 20 characters long',
        message: 'Validation failed',
      });
      return;
    }

    // 2. Create the Feedback in the Database FIRST (so it's safe if AI fails)
    let feedback = await Feedback.create({
      title: sanitizedTitle,
      description: sanitizedDescription,
      category,
      submitterName,
      submitterEmail,
    });

    // 3. Send Success Response IMMEDIATELY (Don't make the user wait for the AI)
    sendApiResponse(res, 201, {
      success: true,
      data: feedback,
      message: 'Feedback submitted and queued for AI processing',
    });

    // 4. Background Process: Call Gemini AI
    const aiResult = await analyzeFeedbackWithAI(sanitizedTitle, sanitizedDescription);

    // 5. If AI succeeds, update the database record silently in the background
    if (aiResult) {
      await Feedback.findByIdAndUpdate(feedback._id, {
        ai_category: aiResult.category,
        ai_sentiment: aiResult.sentiment,
        ai_priority: aiResult.priority_score,
        ai_summary: aiResult.summary,
        ai_tags: aiResult.tags,
        ai_processed: true,
      });
      console.log(`[AI Success] Processed feedback ID: ${feedback._id}`);
    }

  } catch (error) {
    console.error('Error creating feedback:', error);
    if (!res.headersSent) {
      sendApiResponse(res, 500, {
        success: false,
        error: 'Server Error. Could not save feedback.',
        message: 'Feedback creation failed',
      });
    }
  }

  
};

// @desc    Get all feedback (with filtering, sorting, pagination)
// @route   GET /api/feedback
// @access  Private (Admin Only)
export const getAllFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Extract query parameters from the URL
    const { 
      category, 
      status, 
      sort, 
      search, 
      page = '1', 
      limit = '10' 
    } = req.query;

    // 2. Build the MongoDB Query Object
    const query: any = {};

    // Filters (Requirements 3.3 & 3.4)
    if (category) query.category = category;
    if (status) query.status = status;

    // Search (Requirement 3.7 - searches title and AI summary)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { ai_summary: { $regex: search, $options: 'i' } }
      ];
    }

    // 3. Sorting Logic (Requirement 3.6)
    let sortOption: any = { createdAt: -1 }; // Default: Newest first
    if (sort === 'priority') sortOption = { ai_priority: -1 }; // Highest priority first
    if (sort === 'oldest') sortOption = { createdAt: 1 };
    if (sort === 'sentiment') sortOption = { ai_sentiment: 1, createdAt: -1 };

    // 4. Pagination Logic (Requirement 3.9)
    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // 5. Execute Database Query
    const feedbacks = await Feedback.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNumber);

    const total = await Feedback.countDocuments(query);

    // 6. Send Response
    sendApiResponse(res, 200, {
      success: true,
      data: {
        items: feedbacks,
        meta: {
          total,
          page: pageNumber,
          pages: Math.ceil(total / limitNumber),
        },
      },
      message: 'Feedback fetched successfully',
    });
  } catch (error) {
    sendApiResponse(res, 500, {
      success: false,
      error: 'Failed to fetch feedback',
      message: 'Feedback fetch failed',
    });
  }
};

// @desc    Get single feedback
// @route   GET /api/feedback/:id
// @access  Private (Admin Only)
export const getFeedbackById = async (req: Request, res: Response): Promise<void> => {
  try {
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      sendApiResponse(res, 404, {
        success: false,
        error: 'Feedback not found',
        message: 'Feedback lookup failed',
      });
      return;
    }

    sendApiResponse(res, 200, {
      success: true,
      data: feedback,
      message: 'Feedback fetched successfully',
    });
  } catch (error) {
    sendApiResponse(res, 500, {
      success: false,
      error: 'Failed to fetch feedback',
      message: 'Feedback lookup failed',
    });
  }
};



// @desc    Update feedback status
// @route   PATCH /api/feedback/:id
// @access  Private (Admin Only)
export const updateFeedbackStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate the status input
    if (!['New', 'In Review', 'Resolved'].includes(status)) {
      sendApiResponse(res, 400, {
        success: false,
        error: 'Invalid status value',
        message: 'Validation failed',
      });
      return;
    }

    // Update in database
    const updatedFeedback = await Feedback.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedFeedback) {
      sendApiResponse(res, 404, {
        success: false,
        error: 'Feedback not found',
        message: 'Status update failed',
      });
      return;
    }

    sendApiResponse(res, 200, {
      success: true,
      data: updatedFeedback,
      message: 'Status updated successfully',
    });
  } catch (error) {
    sendApiResponse(res, 500, {
      success: false,
      error: 'Failed to update status',
      message: 'Status update failed',
    });
  }
};

// @desc    Delete feedback
// @route   DELETE /api/feedback/:id
// @access  Private (Admin Only)
export const deleteFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const deletedFeedback = await Feedback.findByIdAndDelete(req.params.id);

    if (!deletedFeedback) {
      sendApiResponse(res, 404, {
        success: false,
        error: 'Feedback not found',
        message: 'Delete failed',
      });
      return;
    }

    sendApiResponse(res, 200, {
      success: true,
      data: deletedFeedback,
      message: 'Feedback deleted successfully',
    });
  } catch (error) {
    sendApiResponse(res, 500, {
      success: false,
      error: 'Failed to delete feedback',
      message: 'Delete failed',
    });
  }
};

export const getWeeklySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch feedbacks from last 7 days
    const recentFeedbacks = await Feedback.find({ createdAt: { $gte: sevenDaysAgo } });
    
    if (recentFeedbacks.length === 0) {
      sendApiResponse(res, 200, {
        success: true,
        data: 'No feedback in the last 7 days to summarize.',
        message: 'Summary generated successfully',
      });
      return;
    }

    // Combine titles for the AI to read
    const feedbackText = recentFeedbacks.map(f => f.title).join(". ");
    
    // We import the Google Gen AI client here directly for a quick custom prompt
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `Analyze these product feedback titles from the last 7 days: ${feedbackText}. What are the top 3 themes? Return a short summary paragraph.`
    });

    sendApiResponse(res, 200, {
      success: true,
      data: response.text,
      message: 'Summary generated successfully',
    });
  } catch (error) {
    sendApiResponse(res, 500, {
      success: false,
      error: 'Failed to generate summary',
      message: 'Summary generation failed',
    });
  }
};