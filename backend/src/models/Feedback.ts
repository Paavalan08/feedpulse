import mongoose, { Schema, Document } from 'mongoose';

// 1. Define the TypeScript interface for our data
export interface IFeedback extends Document {
  title: string;
  description: string;
  category: 'Bug' | 'Feature Request' | 'Improvement' | 'Other';
  status: 'New' | 'In Review' | 'Resolved';
  submitterName?: string;
  submitterEmail?: string;
  ai_category?: string;
  ai_sentiment?: 'Positive' | 'Neutral' | 'Negative';
  ai_priority?: number;
  ai_summary?: string;
  ai_tags?: string[];
  ai_processed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 2. Create the Mongoose Schema
const FeedbackSchema: Schema = new Schema(
  {
    title: { type: String, required: true, maxlength: 120 },
    description: { type: String, required: true, minlength: 20 },
    category: {
      type: String,
      enum: ['Bug', 'Feature Request', 'Improvement', 'Other'],
      required: true,
    },
    status: {
      type: String,
      enum: ['New', 'In Review', 'Resolved'],
      default: 'New',
    },
    submitterName: { type: String, required: false },
    submitterEmail: { 
      type: String, 
      required: false,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address.'] 
    },
    
    // AI Fields
    ai_category: { type: String },
    ai_sentiment: { type: String, enum: ['Positive', 'Neutral', 'Negative'] },
    ai_priority: { type: Number, min: 1, max: 10 },
    ai_summary: { type: String },
    ai_tags: [{ type: String }],
    ai_processed: { type: Boolean, default: false },
  },
  { 
    timestamps: true // Automatically manages createdAt and updatedAt
  }
);

// 3. Add Indexes (Requirement 5.2)
FeedbackSchema.index({ status: 1 });
FeedbackSchema.index({ category: 1 });
FeedbackSchema.index({ ai_priority: -1 }); // -1 for descending order (highest priority first)
FeedbackSchema.index({ createdAt: -1 });

export default mongoose.model<IFeedback>('Feedback', FeedbackSchema);