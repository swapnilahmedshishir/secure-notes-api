const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    body: { type: String, required: true, maxlength: 20000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false }
);

// $lookup join key from users + per-author post listing (newest first)
postSchema.index({ author: 1, _id: -1 });

module.exports = mongoose.model('Post', postSchema);
