const bcrypt = require('bcrypt');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { signToken } = require('../utils/token');

// compared against when the email is unknown so response time doesn't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('timing-safe-placeholder', env.BCRYPT_SALT_ROUNDS);

async function register(req, res) {
  const user = await User.create(req.validated.body);
  res.status(201).json({ user, token: signToken(user) });
}

async function login(req, res) {
  const { email, password } = req.validated.body;

  const user = await User.findOne({ email }).select('+password');
  const passwordMatches = user
    ? await user.comparePassword(password)
    : await bcrypt.compare(password, DUMMY_HASH);

  if (!user || !passwordMatches) throw ApiError.unauthorized('Invalid email or password');

  res.json({ user, token: signToken(user) });
}

function getProfile(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, getProfile };
