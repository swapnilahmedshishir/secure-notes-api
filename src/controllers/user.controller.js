const User = require('../models/User');
const Note = require('../models/Note');
const Post = require('../models/Post');
const ApiError = require('../utils/ApiError');
const { toSkip, buildPagination, countMatching } = require('../utils/pagination');

async function createUser(req, res) {
  const user = await User.create(req.validated.body);
  res.status(201).json({ user });
}

async function listUsers(req, res) {
  const { page, limit } = req.validated.query;

  const [users, total] = await Promise.all([
    User.find().sort({ _id: -1 }).skip(toSkip({ page, limit })).limit(limit).lean(),
    countMatching(User, {}),
  ]);

  res.json({ data: users, pagination: buildPagination({ page, limit, total }) });
}

async function getUser(req, res) {
  const user = await User.findById(req.validated.params.id);
  if (!user) throw ApiError.notFound('User not found');

  res.json({ user });
}

async function updateUser(req, res) {
  const { id } = req.validated.params;
  const changes = req.validated.body;

  // stops an admin from locking themselves out of the system
  if (id === req.user.id && changes.role && changes.role !== req.user.role) {
    throw ApiError.badRequest('You cannot change your own role');
  }

  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');

  user.set(changes);
  await user.save();

  res.json({ user });
}

async function deleteUser(req, res) {
  const { id } = req.validated.params;

  if (id === req.user.id) throw ApiError.badRequest('You cannot delete your own account');

  const user = await User.findById(id).select('_id');
  if (!user) throw ApiError.notFound('User not found');

  await Promise.all([Note.deleteMany({ author: user._id }), Post.deleteMany({ author: user._id })]);
  await user.deleteOne();

  res.status(204).end();
}

/**
 * Scenario 1 — users grouped by interest, one aggregate() call.
 * $match narrows via the multikey { interests: 1 } index (and drops users with no
 * interests), $unwind emits one doc per interest, $group collects the users, and
 * $facet returns the requested page of groups plus the total group count.
 */
async function groupByInterests(req, res) {
  const { page, limit, interest } = req.validated.query;

  const [result] = await User.aggregate([
    { $match: interest ? { interests: interest } : { interests: { $type: 'string' } } },
    { $unwind: '$interests' },
    ...(interest ? [{ $match: { interests: interest } }] : []),
    {
      $group: {
        _id: '$interests',
        count: { $sum: 1 },
        users: { $push: { _id: '$_id', username: '$username', email: '$email' } },
      },
    },
    { $sort: { count: -1, _id: 1 } },
    {
      $facet: {
        data: [
          { $skip: toSkip({ page, limit }) },
          { $limit: limit },
          { $project: { _id: 0, interest: '$_id', count: 1, users: 1 } },
        ],
        total: [{ $count: 'value' }],
      },
    },
  ]).allowDiskUse(true);

  const total = result.total[0]?.value ?? 0;
  res.json({ data: result.data, pagination: buildPagination({ page, limit, total }) });
}

module.exports = { createUser, listUsers, getUser, updateUser, deleteUser, groupByInterests };
