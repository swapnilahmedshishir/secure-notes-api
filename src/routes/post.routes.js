const { Router } = require('express');
const { ROLES } = require('../models/User');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');
const validators = require('../validators/post.validator');
const controller = require('../controllers/post.controller');

const router = Router();

// posts are public to read, authenticated to write
router.get('/', validate(validators.list), controller.listPosts);
router.get('/user/:id', validate(validators.listByUser), controller.listPostsByUser);
router.post('/', authenticate, requireRole(ROLES.USER), validate(validators.create), controller.createPost);

module.exports = router;
