const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    content: { type: String, required: true, maxlength: 20000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false }
);

// "my notes" (newest first), admin filter by author, and cascade delete by author
noteSchema.index({ author: 1, _id: -1 });

module.exports = mongoose.model('Note', noteSchema);
