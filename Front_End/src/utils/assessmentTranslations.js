/**
 * EGSA Space Academy — Assessment Translations Dictionary
 * Complete bilingual support (English & Arabic) with RTL localization.
 */
export const assessmentTranslations = {
  en: {
    // Section headers & tabs
    assessmentsTitle: 'Course Assessments & Milestones',
    assessmentsSubtitle: 'Technical assessments, laboratory practicals, and capstone milestones for your enrolled cohorts.',
    upcomingTab: 'Upcoming',
    submittedTab: 'Submitted',
    evaluatedTab: 'Evaluated',
    allTab: 'All Assessments',
    upcomingSubtitle: 'Published assessments awaiting your submission',
    submittedSubtitle: 'Submissions currently under faculty review',
    evaluatedSubtitle: 'Official certified grades and instructor feedback',
    noAssessments: 'No assessments available in this section.',
    noAssessmentsForCohort: 'No assessments published for this enrolled cohort yet.',

    // Card & Details fields
    assessmentTitle: 'Assessment Title',
    course: 'Course',
    cohort: 'Cohort',
    instructor: 'Instructor',
    deadline: 'Deadline',
    availableDate: 'Available From',
    maxScore: 'Maximum Score',
    passingScore: 'Passing Score',
    weight: 'Weight',
    description: 'Description',
    instructions: 'Instructions & Guidelines',
    referenceAttachments: 'Reference & Attachment Files',
    noAttachments: 'No instructor attachment files provided.',
    viewFile: 'View',
    downloadFile: 'Download',
    viewAssessment: 'View Assessment',
    close: 'Close',

    // Submission area
    mySubmission: 'My Submission',
    uploadCompleted: 'Upload your completed assessment:',
    chooseFile: 'Choose File',
    clickToUpload: 'Click to choose a file or drag & drop here',
    selectedFile: 'Selected file:',
    removeFile: 'Remove file',
    allowedFormatsText: 'Supported: PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT, Images (Max 25MB)',
    executableForbidden: 'Executable files (.exe, .bat, etc.) are strictly forbidden.',
    yourAnswer: 'Your Answer:',
    optional: '(Optional)',
    required: '(Required)',
    answerPlaceholder: 'Enter your technical response or notes here...',
    submitAssessment: 'Submit Assessment',
    submitting: 'Submitting assessment...',
    resubmit: 'Submit New Version',
    cancelResubmit: 'Cancel',
    resubmitInfo: 'Resubmission is enabled. Submitting a new version will archive your previous version in the institutional audit log.',
    readonlySubmission: 'Submission is locked. Resubmission is not permitted for this assessment.',

    // Submission Confirmation & Status
    assessmentSubmittedTitle: 'Assessment Submitted',
    assessmentSubmittedMsg: 'Your assessment has been successfully submitted.',
    submittedDate: 'Submitted',
    submissionStatus: 'Submission Status',
    evaluationStatus: 'Evaluation Status',
    statusSubmitted: 'Submitted',
    statusNotSubmitted: 'Not Submitted',
    statusPending: 'Pending Evaluation',
    statusEvaluated: 'Evaluated',
    statusUpcoming: 'Upcoming',
    submittedFileLabel: 'Submitted File:',
    versionLabel: 'Version',
    historyTitle: 'Submission Version History',

    // Deadline & Late policy
    deadlinePassed: 'Submission deadline has passed.',
    lateSubmission: 'LATE SUBMISSION',
    lateNotice: 'The deadline has passed, but late submissions are currently allowed. Your work will be marked as a Late Submission.',
    closedDeadlineNotice: 'The deadline for this assessment has passed. New submissions are no longer accepted.',

    // Evaluation & Results
    assessmentResult: 'Assessment Result',
    score: 'Score',
    percentage: 'Percentage',
    instructorFeedback: 'Instructor Feedback',
    strengths: 'Strengths',
    areasForImprovement: 'Areas for Improvement',
    evaluatedOn: 'Evaluated On',
    passed: 'Passed',
    failed: 'Failed',
    evaluationPendingMsg: 'Your work is currently undergoing faculty review. Grades, rubric breakdowns, and qualitative feedback will appear here once officially published by the instructor.',
    confidentialScoresMsg: 'Provisional/draft scores are withheld until institutional publication.',
    
    // Validation messages
    fileRequiredError: 'Please select a valid file to upload.',
    textRequiredError: 'Please provide your written answer before submitting.',
    bothRequiredError: 'Please upload a file and provide your written answer.',
    fileTooLargeError: 'File size exceeds the 25MB limit. Please compress your file.',
    invalidFileTypeError: 'Executable and script files are not allowed. Please upload approved academic formats.',
  },

  ar: {
    // Section headers & tabs
    assessmentsTitle: 'التقييمات والمهام التدريبية',
    assessmentsSubtitle: 'التقييمات الفنية، التجارب العملية في المختبر، ومهام مشاريع التخرج للبرامج التدريبية المسجل بها.',
    upcomingTab: 'التقييمات القادمة',
    submittedTab: 'التقييمات المُسلّمة',
    evaluatedTab: 'التقييمات المكتملة',
    allTab: 'جميع التقييمات',
    upcomingSubtitle: 'تقييمات معلنة بانتظار تسليمك للحل',
    submittedSubtitle: 'تسليمات قيد المراجعة والتقييم من هيئة التدريس',
    evaluatedSubtitle: 'النتائج الرسمية المعتمدة وملاحظات المُحاضر',
    noAssessments: 'لا توجد تقييمات في هذا القسم حالياً.',
    noAssessmentsForCohort: 'لم يتم الإعلان عن تقييمات لهذه الدفعة التدريبية بعد.',

    // Card & Details fields
    assessmentTitle: 'عنوان التقييم',
    course: 'البرنامج التدريبي',
    cohort: 'الدفعة',
    instructor: 'المُحاضر / المُقيّم',
    deadline: 'الموعد النهائي للتسليم',
    availableDate: 'متاح اعتباراً من',
    maxScore: 'الدرجة العظمى',
    passingScore: 'درجة الاجتياز',
    weight: 'الوزن النسبي',
    description: 'الوصف العام',
    instructions: 'تعليمات ومتطلبات التقييم',
    referenceAttachments: 'الملفات المرجعية والمرفقات',
    noAttachments: 'لا توجد ملفات مرفقة مع هذا التقييم.',
    viewFile: 'عرض',
    downloadFile: 'تحميل',
    viewAssessment: 'عرض التقييم',
    close: 'إغلاق',

    // Submission area
    mySubmission: 'تسليمي للتقييم',
    uploadCompleted: 'ارفع ملف التقييم المكتمل:',
    chooseFile: 'اختر ملفاً',
    clickToUpload: 'انقر لاختيار ملف أو اسحب الملف وأفلته هنا',
    selectedFile: 'الملف المختار:',
    removeFile: 'حذف الملف',
    allowedFormatsText: 'الملفات المدعومة: PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT, الصور (بحد أقصى ٢٥ ميجابايت)',
    executableForbidden: 'الملفات التنفيذية والبرمجية (.exe, .bat وغيرها) محظورة تماماً لأسباب أمنية.',
    yourAnswer: 'إجابتك النصية:',
    optional: '(اختياري)',
    required: '(مطلوب)',
    answerPlaceholder: 'اكتب إجابتك أو تفاصيل الحل والملاحظات التقنية هنا...',
    submitAssessment: 'إرسال التقييم',
    submitting: 'جاري إرسال التقييم...',
    resubmit: 'تسليم نسخة جديدة',
    cancelResubmit: 'إلغاء',
    resubmitInfo: 'إعادة التسليم مسموحة لهذا التقييم. سيؤدي تسليم نسخة جديدة إلى حفظ نسختك السابقة في الأرشيف الأكاديمي.',
    readonlySubmission: 'تم إغلاق التعديل. إعادة التسليم غير مسموحة لهذا التقييم.',

    // Submission Confirmation & Status
    assessmentSubmittedTitle: 'تم إرسال التقييم بنجاح',
    assessmentSubmittedMsg: 'تم استلام وتوثيق تسليمك الأكاديمي بنجاح.',
    submittedDate: 'تاريخ التسليم',
    submissionStatus: 'حالة التسليم',
    evaluationStatus: 'حالة التقييم',
    statusSubmitted: 'تم التسليم',
    statusNotSubmitted: 'لم يتم التسليم',
    statusPending: 'قيد التقييم',
    statusEvaluated: 'تم التقييم',
    statusUpcoming: 'قادم',
    submittedFileLabel: 'الملف المُسلّم:',
    versionLabel: 'النسخة',
    historyTitle: 'سجل النسخ المُسلّمة',

    // Deadline & Late policy
    deadlinePassed: 'انتهى الموعد النهائي للتسليم.',
    lateSubmission: 'تسليم متأخر',
    lateNotice: 'لقد انقضى الموعد النهائي، ولكن التسليم المتأخر مسموح به حالياً. سيتم تسجيل تسليمك كـ "تسليم متأخر".',
    closedDeadlineNotice: 'انتهى الموعد النهائي للتسليم ولا يُسمح بالتسليم المتأخر لهذا التقييم.',

    // Evaluation & Results
    assessmentResult: 'نتيجة التقييم الرسمية',
    score: 'الدرجة',
    percentage: 'النسبة المئوية',
    instructorFeedback: 'ملاحظات المُقيّم',
    strengths: 'نقاط القوة التقنية',
    areasForImprovement: 'مجالات التطوير الموصى بها',
    evaluatedOn: 'تاريخ اعتماد النتيجة',
    passed: 'ناجح',
    failed: 'غير مستوفٍ',
    evaluationPendingMsg: 'تسليمك يخضع حالياً لمراجعة وتقييم هيئة التدريس المختصة. ستظهر الدرجة والملاحظات هنا فور نشرها واعتمادها رسمياً.',
    confidentialScoresMsg: 'تظل الدرجات التقديرية أو المسودات غير مرئية حتى يتم اعتمادها ونشرها رسمياً.',

    // Validation messages
    fileRequiredError: 'يرجى اختيار ملف صالح لرفعه.',
    textRequiredError: 'يرجى كتابة إجابتك النصية قبل الإرسال.',
    bothRequiredError: 'يرجى رفع ملف وكتابة إجابتك النصية.',
    fileTooLargeError: 'حجم الملف يتجاوز الحد المسموح به (٢٥ ميجابايت). يرجى ضغط الملف.',
    invalidFileTypeError: 'الملفات التنفيذية والبرمجية غير مسموحة. يرجى رفع ملفات أكاديمية معتمدة.',
  },
};

export function getAssessmentText(lang = 'en') {
  return assessmentTranslations[lang === 'ar' ? 'ar' : 'en'];
}
