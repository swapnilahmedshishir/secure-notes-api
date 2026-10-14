const Note = require('../models/Note');
const { ROLES } = require('../models/User');
const ApiError = require('../utils/ApiError');
const { toSkip, buildPagination, countMatching } = require('../utils/pagination');

const AUTHOR_FIELDS = 'username email';

async function createNote(req, res) {
  const note = await Note.create({ ...req.validated.body, author: req.user._id });
  res.status(201).json({ note });
}

async function listMyNotes(req, res) {
  const { page, limit } = req.validated.query;
  const filter = { author: req.user._id };

  const [notes, total] = await Promise.all([
    Note.find(filter).sort({ _id: -1 }).skip(toSkip({ page, limit })).limit(limit).lean(),
    countMatching(Note, filter),
  ]);

  res.json({ data: notes, pagination: buildPagination({ page, limit, total }) });
}

async function listAllNotes(req, res) {
  const { page, limit, author } = req.validated.query;
  const filter = author ? { author } : {};

  const [notes, total] = await Promise.all([
    Note.find(filter)
      .sort({ _id: -1 })
      .skip(toSkip({ page, limit }))
      .limit(limit)
      .populate('author', AUTHOR_FIELDS)
      .lean(),
    countMatching(Note, filter),
  ]);

  res.json({ data: notes, pagination: buildPagination({ page, limit, total }) });
}

async function getNote(req, res) {
  const isAdmin = req.user.role === ROLES.ADMIN;
  const filter = isAdmin ? { _id: req.validated.params.id } : { _id: req.validated.params.id, author: req.user._id };

  const query = Note.findOne(filter);
  if (isAdmin) query.populate('author', AUTHOR_FIELDS);

  const note = await query;
  if (!note) throw ApiError.notFound('Note not found');

  res.json({ note });
}

// only the author can modify or delete a note, admins included
async function updateNote(req, res) {
  const note = await Note.findOneAndUpdate(
    { _id: req.validated.params.id, author: req.user._id },
    { $set: req.validated.body },
    { returnDocument: 'after', runValidators: true }
  );
  if (!note) throw ApiError.notFound('Note not found');

  res.json({ note });
}

async function deleteNote(req, res) {
  const note = await Note.findOneAndDelete({ _id: req.validated.params.id, author: req.user._id });
  if (!note) throw ApiError.notFound('Note not found');

  res.status(204).end();
}

module.exports = { createNote, listMyNotes, listAllNotes, getNote, updateNote, deleteNote };
