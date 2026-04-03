import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Feedback from '../models/Feedback';
import {
  analyzeFeedbackWithAI,
  coachFeedbackDraftWithAI,
  generateWeeklyFeedbackSummaryWithAI,
} from '../services/gemini.service';
import { sendApiResponse } from '../utils/apiResponse';

const ALLOWED_CATEGORIES = ['Bug', 'Feature Request', 'Improvement', 'Other'];
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const normalizeRouteParam = (value: string | string[] | undefined): string => {
  return typeof value === 'string' ? value : '';
};

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'have', 'has', 'are', 'was', 'were',
  'not', 'but', 'can', 'could', 'would', 'should', 'about', 'into', 'onto', 'very', 'much', 'more',
  'when', 'where', 'what', 'which', 'while', 'after', 'before', 'user', 'users', 'app', 'dashboard',
]);

interface ThemeAggregate {
  theme: string;
  count: number;
  totalPriority: number;
  sentiment: {
    Positive: number;
    Neutral: number;
    Negative: number;
  };
  lastSeenAt: Date;
  sampleFeedbackTitles: string[];
}

const toTitleCase = (text: string): string => {
  return text
    .split(' ')
    .filter(Boolean)
    .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const extractKeywordThemes = (text: string): string[] => {
  if (!text) return [];
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 4 && !STOPWORDS.has(token));

  return Array.from(new Set(tokens)).slice(0, 2).map(toTitleCase);
};

// @desc    Submit new feedback
// @route   POST /api/feedback
// @access  Public
export const createFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, category, submitterName, submitterEmail } = req.body;
    const sanitizedTitle = typeof title === 'string' ? title.trim() : '';
    const sanitizedDescription = typeof description === 'string' ? description.trim() : '';
    const sanitizedCategory = typeof category === 'string' ? category.trim() : '';
    const sanitizedSubmitterName = typeof submitterName === 'string' ? submitterName.trim() : undefined;
    const sanitizedSubmitterEmail = typeof submitterEmail === 'string' ? submitterEmail.trim() : undefined;

    // 1. Basic Input Validation (Requirement 4.5)
    if (!sanitizedTitle || !sanitizedDescription || !sanitizedCategory) {
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

    if (!ALLOWED_CATEGORIES.includes(sanitizedCategory)) {
      sendApiResponse(res, 400, {
        success: false,
        error: 'Category must be one of: Bug, Feature Request, Improvement, Other',
        message: 'Validation failed',
      });
      return;
    }

    if (sanitizedSubmitterEmail && !EMAIL_REGEX.test(sanitizedSubmitterEmail)) {
      sendApiResponse(res, 400, {
        success: false,
        error: 'Please provide a valid submitter email address',
        message: 'Validation failed',
      });
      return;
    }

    // 2. Create the Feedback in the Database FIRST (so it's safe if AI fails)
    let feedback = await Feedback.create({
      title: sanitizedTitle,
      description: sanitizedDescription,
      category: sanitizedCategory,
      submitterName: sanitizedSubmitterName,
      submitterEmail: sanitizedSubmitterEmail,
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

    if (error instanceof mongoose.Error.ValidationError) {
      const firstError = Object.values(error.errors)[0];
      sendApiResponse(res, 400, {
        success: false,
        error: firstError?.message ?? 'Invalid feedback payload',
        message: 'Validation failed',
      });
      return;
    }

    if (error instanceof mongoose.Error.CastError) {
      sendApiResponse(res, 400, {
        success: false,
        error: 'Invalid value provided in request payload',
        message: 'Validation failed',
      });
      return;
    }

    if (!res.headersSent) {
      sendApiResponse(res, 500, {
        success: false,
        error: 'Server Error. Could not save feedback.',
        message: 'Feedback creation failed',
      });
    }
  }

  
};

// @desc    AI draft coaching for public feedback form (multi-turn)
// @route   POST /api/feedback/coach
// @access  Public
export const coachFeedbackDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, category, chatHistory, message } = req.body ?? {};

    const sanitizedTitle = typeof title === 'string' ? title.trim() : '';
    const sanitizedDescription = typeof description === 'string' ? description.trim() : '';
    const sanitizedCategory = typeof category === 'string' ? category.trim() : 'Other';
    const sanitizedMessage = typeof message === 'string' ? message.trim() : '';

    if (!sanitizedMessage) {
      sendApiResponse(res, 400, {
        success: false,
        error: 'Please provide a message for the AI coach',
        message: 'Validation failed',
      });
      return;
    }

    const parsedHistory = Array.isArray(chatHistory)
      ? chatHistory
          .filter(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
          .map(item => ({ role: item.role, content: item.content.trim() }))
          .filter(item => item.content)
      : [];

    const aiResult = await coachFeedbackDraftWithAI({
      title: sanitizedTitle,
      description: sanitizedDescription,
      category: ALLOWED_CATEGORIES.includes(sanitizedCategory) ? sanitizedCategory : 'Other',
      chatHistory: parsedHistory,
      latestUserMessage: sanitizedMessage,
    });

    if (!aiResult) {
      sendApiResponse(res, 502, {
        success: false,
        error: 'AI coach is currently unavailable. Please try again.',
        message: 'Draft coaching failed',
      });
      return;
    }

    sendApiResponse(res, 200, {
      success: true,
      data: aiResult,
      message: 'Draft coaching response generated',
    });
  } catch (error) {
    sendApiResponse(res, 500, {
      success: false,
      error: 'Failed to generate AI draft coaching response',
      message: 'Draft coaching failed',
    });
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
    if (typeof category === 'string' && ALLOWED_CATEGORIES.includes(category)) {
      query.category = category;
    }
    if (typeof status === 'string' && ['New', 'In Review', 'Resolved'].includes(status)) {
      query.status = status;
    }

    // Search (Requirement 3.7 - searches title and AI summary)
    if (typeof search === 'string' && search.trim()) {
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
    const parsedPage = parseInt(page as string, 10);
    const parsedLimit = parseInt(limit as string, 10);
    const pageNumber = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const limitNumber = Number.isNaN(parsedLimit) || parsedLimit < 1 ? 10 : Math.min(parsedLimit, 100);
    const skip = (pageNumber - 1) * limitNumber;

    // 5. Execute Database Query
    const feedbacks = await Feedback.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNumber);

    const total = await Feedback.countDocuments(query);
    const statsAggregate = await Feedback.aggregate([
      { $match: query },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                avgPriority: { $avg: '$ai_priority' },
                openItems: {
                  $sum: {
                    $cond: [{ $ne: ['$status', 'Resolved'] }, 1, 0],
                  },
                },
                positive: {
                  $sum: {
                    $cond: [{ $eq: ['$ai_sentiment', 'Positive'] }, 1, 0],
                  },
                },
                neutral: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $eq: ['$ai_sentiment', 'Neutral'] },
                          { $not: ['$ai_sentiment'] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                negative: {
                  $sum: {
                    $cond: [{ $eq: ['$ai_sentiment', 'Negative'] }, 1, 0],
                  },
                },
              },
            },
          ],
          topTag: [
            { $unwind: { path: '$ai_tags', preserveNullAndEmptyArrays: false } },
            { $group: { _id: '$ai_tags', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 },
          ],
        },
      },
    ]);

    const summary = statsAggregate[0]?.summary?.[0];
    const topTag = statsAggregate[0]?.topTag?.[0]?._id;

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
        stats: {
          totalFeedback: total,
          openItems: summary?.openItems ?? 0,
          averagePriority: typeof summary?.avgPriority === 'number' ? Number(summary.avgPriority.toFixed(1)) : null,
          mostCommonTag: topTag ?? '-',
          sentiment: {
            Positive: summary?.positive ?? 0,
            Neutral: summary?.neutral ?? 0,
            Negative: summary?.negative ?? 0,
          },
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
    const feedbackId = normalizeRouteParam(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
      sendApiResponse(res, 400, {
        success: false,
        error: 'Invalid feedback ID format',
        message: 'Validation failed',
      });
      return;
    }

    const feedback = await Feedback.findById(feedbackId);

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
    const id = normalizeRouteParam(req.params.id);
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendApiResponse(res, 400, {
        success: false,
        error: 'Invalid feedback ID format',
        message: 'Validation failed',
      });
      return;
    }

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
    const feedbackId = normalizeRouteParam(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
      sendApiResponse(res, 400, {
        success: false,
        error: 'Invalid feedback ID format',
        message: 'Validation failed',
      });
      return;
    }

    const deletedFeedback = await Feedback.findByIdAndDelete(feedbackId);

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

    const summary = await generateWeeklyFeedbackSummaryWithAI(recentFeedbacks.map(f => f.title));

    if (!summary) {
      sendApiResponse(res, 502, {
        success: false,
        error: 'AI summary provider is currently unavailable',
        message: 'Summary generation failed',
      });
      return;
    }

    sendApiResponse(res, 200, {
      success: true,
      data: summary,
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

export const reanalyzeFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const feedbackId = normalizeRouteParam(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
      sendApiResponse(res, 400, {
        success: false,
        error: 'Invalid feedback ID format',
        message: 'Validation failed',
      });
      return;
    }

    const feedback = await Feedback.findById(feedbackId);

    if (!feedback) {
      sendApiResponse(res, 404, {
        success: false,
        error: 'Feedback not found',
        message: 'Reanalysis failed',
      });
      return;
    }

    sendApiResponse(res, 200, {
      success: true,
      data: { ...feedback.toObject(), ai_processed: false },
      message: 'Feedback reanalysis queued',
    });

    // Background: Re-analyze with Gemini
    const aiResult = await analyzeFeedbackWithAI(feedback.title, feedback.description);

    if (aiResult) {
      await Feedback.findByIdAndUpdate(feedbackId, {
        ai_category: aiResult.category,
        ai_sentiment: aiResult.sentiment,
        ai_priority: aiResult.priority_score,
        ai_summary: aiResult.summary,
        ai_tags: aiResult.tags,
        ai_processed: true,
      });
      console.log(`[AI Reanalysis Success] Updated feedback ID: ${feedbackId}`);
    }
  } catch (error) {
    sendApiResponse(res, 500, {
      success: false,
      error: 'Failed to reanalyze feedback',
      message: 'Reanalysis failed',
    });
  }
};

export const getFeedbackThemes = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawDays = parseInt((req.query.days as string) ?? '30', 10);
    const rawLimit = parseInt((req.query.limit as string) ?? '6', 10);
    const days = Number.isNaN(rawDays) || rawDays < 1 ? 30 : Math.min(rawDays, 90);
    const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? 6 : Math.min(rawLimit, 12);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const feedbacks = await Feedback.find({ createdAt: { $gte: startDate } })
      .select('title ai_tags ai_summary ai_priority ai_sentiment createdAt')
      .lean();

    if (!feedbacks.length) {
      sendApiResponse(res, 200, {
        success: true,
        data: {
          themes: [],
          windowDays: days,
          totalAnalyzed: 0,
          generatedAt: new Date().toISOString(),
        },
        message: 'No feedback available for theme clustering',
      });
      return;
    }

    const themeMap = new Map<string, ThemeAggregate>();

    for (const feedback of feedbacks) {
      const tagThemes = (feedback.ai_tags ?? [])
        .filter(tag => typeof tag === 'string' && tag.trim())
        .map(tag => toTitleCase(tag.trim()));
      const keywordThemes = extractKeywordThemes(`${feedback.ai_summary ?? ''} ${feedback.title ?? ''}`);
      const feedbackThemes = Array.from(new Set([...tagThemes, ...keywordThemes])).slice(0, 3);

      for (const theme of feedbackThemes) {
        const key = theme.toLowerCase();
        const current = themeMap.get(key) ?? {
          theme,
          count: 0,
          totalPriority: 0,
          sentiment: { Positive: 0, Neutral: 0, Negative: 0 },
          lastSeenAt: new Date(0),
          sampleFeedbackTitles: [],
        };

        current.count += 1;
        current.totalPriority += typeof feedback.ai_priority === 'number' ? feedback.ai_priority : 5;

        if (feedback.ai_sentiment === 'Positive' || feedback.ai_sentiment === 'Neutral' || feedback.ai_sentiment === 'Negative') {
          current.sentiment[feedback.ai_sentiment] += 1;
        } else {
          current.sentiment.Neutral += 1;
        }

        if (feedback.createdAt && new Date(feedback.createdAt) > current.lastSeenAt) {
          current.lastSeenAt = new Date(feedback.createdAt);
        }

        if (feedback.title && current.sampleFeedbackTitles.length < 2) {
          current.sampleFeedbackTitles.push(feedback.title);
        }

        themeMap.set(key, current);
      }
    }

    const themes = Array.from(themeMap.values())
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        const bAvg = b.totalPriority / b.count;
        const aAvg = a.totalPriority / a.count;
        return bAvg - aAvg;
      })
      .slice(0, limit)
      .map(item => ({
        theme: item.theme,
        count: item.count,
        avgPriority: Number((item.totalPriority / item.count).toFixed(1)),
        sentimentBreakdown: item.sentiment,
        lastSeenAt: item.lastSeenAt,
        sampleFeedbackTitles: item.sampleFeedbackTitles,
      }));

    sendApiResponse(res, 200, {
      success: true,
      data: {
        themes,
        windowDays: days,
        totalAnalyzed: feedbacks.length,
        generatedAt: new Date().toISOString(),
      },
      message: 'Feedback themes generated successfully',
    });
  } catch (error) {
    sendApiResponse(res, 500, {
      success: false,
      error: 'Failed to generate feedback themes',
      message: 'Theme clustering failed',
    });
  }
};