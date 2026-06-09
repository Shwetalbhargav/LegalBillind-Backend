import mongoose from 'mongoose';

const ChecklistItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 300 },
    done: { type: Boolean, default: false },
    completedAt: { type: Date },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const TaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 240 },
    description: { type: String, trim: true, maxlength: 2000 },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dueDate: { type: Date, index: true },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal', index: true },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'blocked', 'done', 'cancelled'],
      default: 'todo',
      index: true,
    },
    checklist: { type: [ChecklistItemSchema], default: [] },
    completedAt: { type: Date },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

TaskSchema.pre('validate', function setCompletion(next) {
  if (this.status === 'done' && !this.completedAt) this.completedAt = new Date();
  if (this.status !== 'done') {
    this.completedAt = undefined;
    this.completedBy = undefined;
  }
  next();
});

TaskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
TaskSchema.index({ caseId: 1, status: 1, dueDate: 1 });
TaskSchema.index({ title: 'text', description: 'text' });

export const Task = mongoose.model('Task', TaskSchema);
export default Task;
