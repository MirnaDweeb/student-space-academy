const Notification = require('../models/Notification');

async function notify({ recipient, title, message, type = 'info', relatedCourse, relatedApplication }) {
  return Notification.create({ recipient, title, message, type, relatedCourse, relatedApplication });
}

module.exports = { notify };
