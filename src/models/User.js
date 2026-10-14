const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const env = require('../config/env');

const ROLES = Object.freeze({ USER: 'user', ADMIN: 'admin' });

const normalizeInterests = (list) => [
  ...new Set(list.map((item) => String(item).trim().toLowerCase()).filter(Boolean)),
];

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 30 },
    email: { type: String, required: true, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER },
    interests: { type: [String], default: [], set: normalizeInterests },
  },
  { timestamps: true, versionKey: false }
);

// login lookup + email uniqueness
userSchema.index({ email: 1 }, { unique: true });

// multikey index: one entry per interest, backs the grouped-by-interests pipeline
userSchema.index({ interests: 1 });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, env.BCRYPT_SALT_ROUNDS);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
