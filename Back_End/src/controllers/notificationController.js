const Notification = require('../models/Notification');
const { AppError } = require('../middleware/error');

async function listNotifications(req, res, next) {
  try {
    const notifications = await Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!notification) throw new AppError('Notification not found.', 404);
    res.json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
}

module.exports = { listNotifications, markRead };
