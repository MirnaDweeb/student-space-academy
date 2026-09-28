const router = require('express').Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/courseController');

router.get('/', protect, ctrl.listCourses);
router.get('/:id', protect, ctrl.getCourse);
router.get('/:id/fit', protect, ctrl.getCourseFit);

module.exports = router;
