import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  createFeedback,
  getAllFeedback,
  getFeedbackById,
  updateFeedbackStatus,
  deleteFeedback,
  getWeeklySummary,
  getFeedbackThemes,
  reanalyzeFeedback,
  coachFeedbackDraft,
} from '../controllers/feedbackController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Rate Limiter: Max 5 submissions per hour (Req 1.7)
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      data: null,
      error: 'Too many submissions from this IP. Please try again in an hour.',
      message: 'Rate limit exceeded',
    });
  },
});

const coachLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      data: null,
      error: 'Too many AI coach messages from this IP. Please try again in a few minutes.',
      message: 'Rate limit exceeded',
    });
  },
});

router.post('/', submitLimiter, createFeedback);
router.post('/coach', coachLimiter, coachFeedbackDraft);
router.get('/', protect, getAllFeedback);
router.get('/summary', protect, getWeeklySummary);
router.get('/themes', protect, getFeedbackThemes);
router.patch('/:id/reanalyze', protect, reanalyzeFeedback);
router.get('/:id', protect, getFeedbackById);
router.patch('/:id', protect, updateFeedbackStatus);
router.delete('/:id', protect, deleteFeedback);

export default router;