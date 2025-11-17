	// src/models/RateCard.js
	
	import mongoose from 'mongoose';

	const RateCardSchema = new mongoose.Schema(
	  {
		userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
		activityCode: { type: String },

		ratePerHour: { type: Number, required: true, min: 0 },
		effectiveFrom: { type: Date, required: true },
		effectiveTo: { type: Date },
	  },
	  { timestamps: true }
	);

	RateCardSchema.index({ userId: 1, caseId: 1, activityCode: 1, effectiveFrom: -1 });

	export const RateCard = mongoose.model('RateCard', RateCardSchema);
