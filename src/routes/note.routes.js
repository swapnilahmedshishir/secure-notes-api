const { Router } = require('express');
const { ROLES } = require('../models/User');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');
const validators = require('../validators/note.validator');
const controller = require('../controllers/note.controller');

const router = Router();

router.use(authenticate, requireRole(ROLES.USER));

router.post('/', validate(validators.create), controller.createNote);
router.get('/', validate(validators.listOwn), controller.listMyNotes);

// registered before '/:id' so "all" isn't treated as an id
router.get('/all', requireRole(ROLES.ADMIN), validate(validators.listAll), controller.listAllNotes);

router.get('/:id', validate(validators.byId), controller.getNote);
router.patch('/:id', validate(validators.update), controller.updateNote);
router.delete('/:id', validate(validators.byId), controller.deleteNote);

module.exports = router;
