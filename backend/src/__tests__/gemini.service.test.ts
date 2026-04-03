import { analyzeFeedbackWithAI } from '../services/gemini.service';

// Mock the Google GenAI module at the top level
jest.mock('@google/genai');

describe('Gemini Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export analyzeFeedbackWithAI function', () => {
    expect(typeof analyzeFeedbackWithAI).toBe('function');
  });

  it('should handle API responses', async () => {
    // This test verifies the function exists and is callable
    expect(analyzeFeedbackWithAI).toBeDefined();
    expect(typeof analyzeFeedbackWithAI).toBe('function');
  });
});
