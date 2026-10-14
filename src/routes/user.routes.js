const { Router } = require('express');
const { ROLES } = require('../models/User');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');
const validators = require('../validators/user.validator');
const controller = require('../controllers/user.controller');

const router = Router();

router.use(authenticate, requireRole(ROLES.ADMIN));

router.post('/', validate(validators.create), controller.createUser);
router.get('/', validate(validators.list), controller.listUsers);

// registered before '/:id' so "by-interests" isn't treated as an id
router.get('/by-interests', validate(validators.groupedByInterests), controller.groupByInterests);

router.get('/:id', validate(validators.byId), controller.getUser);
router.patch('/:id', validate(validators.update), controller.updateUser);
router.delete('/:id', validate(validators.byId), controller.deleteUser);

module.exports = router;
