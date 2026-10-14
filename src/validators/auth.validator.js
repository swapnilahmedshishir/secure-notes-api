const { z } = require('zod');

const username = z.string().trim().min(3).max(30);

const email = z.string().trim().toLowerCase().pipe(z.email());

// bcrypt only hashes the first 72 bytes
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((value) => Buffer.byteLength(value) <= 72, 'Password must be at most 72 bytes')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const interests = z.array(z.string().trim().toLowerCase().min(1).max(30)).max(20);

const register = {
  body: z.strictObject({ username, email, password, interests: interests.default([]) }),
};

const login = {
  body: z.strictObject({ email, password: z.string().min(1) }),
};

module.exports = { register, login, fields: { username, email, password, interests } };
