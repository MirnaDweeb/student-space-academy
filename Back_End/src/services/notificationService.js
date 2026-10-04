const Notification = require('../models/Notification');

async function notify(arg1, title, message, type = 'info', relatedCourse, relatedApplication) {
  let recipient = arg1;
  let finalTitle = title;
  let finalMessage = message;
  let finalType = type;
  let finalCourse = relatedCourse;
  let finalApp = relatedApplication;

  if (typeof arg1 === 'object' && arg1 !== null && !arg1._bsontype && !arg1._id && arg1.recipient) {
    recipient = arg1.recipient;
    finalTitle = arg1.title;
    finalMessage = arg1.message;
    finalType = arg1.type || 'info';
    finalCourse = arg1.relatedCourse;
    finalApp = arg1.relatedApplication;
  }

  return Notification.create({
    recipient,
    title: finalTitle,
    message: finalMessage,
    type: finalType,
    relatedCourse: finalCourse,
    relatedApplication: finalApp,
  });
}

module.exports = { notify };
