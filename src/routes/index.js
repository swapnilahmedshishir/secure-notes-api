const { Router } = require('express');

const router = Router();

router.use('/auth', require('./auth.routes'));
router.use('/notes', require('./note.routes'));
router.use('/users', require('./user.routes'));
router.use('/posts', require('./post.routes'));

module.exports = router;
