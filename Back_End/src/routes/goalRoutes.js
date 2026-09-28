const router = require('express').Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/goalController');

router.get('/', protect, ctrl.listGoals);

module.exports = router;
