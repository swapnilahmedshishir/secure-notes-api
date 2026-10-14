const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const validators = require('../validators/auth.validator');
const controller = require('../controllers/auth.controller');

const router = Router();

const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { message: 'Too many attempts, please try again later' },
});

router.post('/register', credentialsLimiter, validate(validators.register), controller.register);
router.post('/login', credentialsLimiter, validate(validators.login), controller.login);
router.get('/me', authenticate, controller.getProfile);

module.exports = router;
