const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { toSkip, buildPagination, countMatching } = require('../utils/pagination');

async function createPost(req, res) {
  const post = await Post.create({ ...req.validated.body, author: req.user._id });
  res.status(201).json({ post });
}

async function listPosts(req, res) {
  const { page, limit } = req.validated.query;

  const [posts, total] = await Promise.all([
    Post.find()
      .sort({ _id: -1 })
      .skip(toSkip({ page, limit }))
      .limit(limit)
      .populate('author', 'username')
      .lean(),
    countMatching(Post, {}),
  ]);

  res.json({ data: posts, pagination: buildPagination({ page, limit, total }) });
}

/**
 * Scenario 2 — all posts of one user in a single pipeline.
 * One $lookup fetches this user's posts already sorted newest first via
 * { author: 1, _id: -1 }; total comes from $size and the page from $slice,
 * so pagination needs no second query or lookup.
 */
async function listPostsByUser(req, res) {
  const { page, limit } = req.validated.query;
  const userId = new mongoose.Types.ObjectId(req.validated.params.id);

  const [result] = await User.aggregate([
    { $match: { _id: userId } },
    {
      $lookup: {
        from: Post.collection.name,
        let: { authorId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$author', '$$authorId'] } } },
          { $sort: { _id: -1 } },
          { $project: { author: 0 } },
        ],
        as: 'posts',
      },
    },
    {
      $project: {
        username: 1,
        total: { $size: '$posts' },
        posts: { $slice: ['$posts', toSkip({ page, limit }), limit] },
      },
    },
  ]);

  if (!result) throw ApiError.notFound('User not found');

  res.json({
    user: { _id: result._id, username: result.username },
    data: result.posts,
    pagination: buildPagination({ page, limit, total: result.total }),
  });
}

module.exports = { createPost, listPosts, listPostsByUser };
