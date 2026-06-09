import mongoose from 'mongoose';

const WorkSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },

    activityType: {
      type: String,
      enum: ['email', 'drafting', 'review', 'meeting', 'hearing', 'research', 'call', 'other'],
      required: true,
    },
    activityCode: { type: String, trim: true, maxlength: 80 },
    workTool: {
      type: String,
      enum: ['gmail', 'google_chrome', 'billbot_ai', 'microsoft_word', 'google_docs', 'pdf_reader', 'phone', 'video_meeting', 'court', 'manual', 'other'],
    },
    narrative: { type: String, trim: true, maxlength: 2000 },
    billable: { type: Boolean, default: true },
    timezone: { type: String, trim: true, maxlength: 80 },

    status: {
      type: String,
      enum: ['running', 'paused', 'stopped', 'discarded'],
      default: 'running',
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    pausedAt: { type: Date },
    resumedAt: { type: Date },
    endedAt: { type: Date },
    lastHeartbeatAt: { type: Date },
    pausedMs: { type: Number, default: 0, min: 0 },
    durationMinutes: { type: Number, min: 0 },

    heartbeatCount: { type: Number, default: 0, min: 0 },
    lastUrl: { type: String, trim: true, maxlength: 2048 },
    lastTitle: { type: String, trim: true, maxlength: 300 },
    webMeter: {
      mode: { type: String, enum: ['manual_web_activity'], default: 'manual_web_activity' },
      captureLevel: { type: String, enum: ['none', 'active_window'], default: 'active_window' },
      idleAfterSeconds: { type: Number, default: 300, min: 60, max: 3600 },
      maxSessionMinutes: { type: Number, default: 180, min: 1, max: 480 },
      privacyNote: {
        type: String,
        trim: true,
        maxlength: 500,
        default: 'Tracks timer, pause/resume, heartbeat count, and optional active page title/URL only.',
      },
      lastActiveAt: { type: Date },
      inactiveSeconds: { type: Number, default: 0, min: 0 },
      activitySignals: [{ type: String, trim: true, maxlength: 80 }],
    },
    calendarEvent: {
      title: { type: String, trim: true, maxlength: 240 },
      scheduledStart: { type: Date },
      scheduledEnd: { type: Date },
      courtName: { type: String, trim: true, maxlength: 240 },
      courtroom: { type: String, trim: true, maxlength: 120 },
      judgeOrBench: { type: String, trim: true, maxlength: 240 },
      location: { type: String, trim: true, maxlength: 500 },
      videoLink: { type: String, trim: true, maxlength: 1000 },
      externalCalendarId: { type: String, trim: true, maxlength: 240 },
      notes: { type: String, trim: true, maxlength: 1000 },
      attachedAt: { type: Date },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    stoppedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    discardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    discardReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

WorkSessionSchema.index(
  { userId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['running', 'paused'] } },
  }
);
WorkSessionSchema.index({ activityType: 1, 'calendarEvent.scheduledStart': 1 });
WorkSessionSchema.index({ 'webMeter.lastActiveAt': -1 });

export const WorkSession = mongoose.model('WorkSession', WorkSessionSchema);
export default WorkSession;
