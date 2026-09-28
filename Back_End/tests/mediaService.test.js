const mediaService = require('../src/services/mediaService');
const Media = require('../src/models/Media');
const Enrollment = require('../src/models/Enrollment');
const TrainingSession = require('../src/models/TrainingSession');
const Notification = require('../src/models/Notification');

jest.mock('../src/models/Media');
jest.mock('../src/models/Enrollment');
jest.mock('../src/models/TrainingSession');
jest.mock('../src/models/Notification');

describe('Media Service & Editorial Workflow Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockStudentId = 'student-123';
  const mockAdminId = 'admin-999';
  const mockCourseId = 'course-456';
  const mockCohortId = 'cohort-789';
  const mockSessionId = 'session-101';

  beforeEach(() => {
    Notification.create = jest.fn().mockResolvedValue({});
  });

  describe('Upload & Session Validation', () => {
    test('Rejects media upload if student is not enrolled in course & cohort', async () => {
      Enrollment.findOne.mockResolvedValue(null);

      const mockFile = {
        filename: 'test.jpg',
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 500000,
      };

      await expect(
        mediaService.createMediaSubmission(mockStudentId, mockFile, {
          courseId: mockCourseId,
          cohortId: mockCohortId,
          sessionId: mockSessionId,
          title: 'Test Photo',
        })
      ).rejects.toThrow(/not actively enrolled/i);
    });

    test('Rejects media upload if session does not belong to the cohort', async () => {
      Enrollment.findOne.mockResolvedValue({ _id: 'enr-1', status: 'Active' });
      TrainingSession.findOne.mockResolvedValue(null); // Session not in cohort

      const mockFile = {
        filename: 'test.jpg',
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 500000,
      };

      await expect(
        mediaService.createMediaSubmission(mockStudentId, mockFile, {
          courseId: mockCourseId,
          cohortId: mockCohortId,
          sessionId: mockSessionId,
          title: 'Test Photo',
        })
      ).rejects.toThrow(/does not belong to your enrolled cohort/i);
    });

    test('Creates media in Draft when submitImmediately is false', async () => {
      Enrollment.findOne.mockResolvedValue({ _id: 'enr-1', status: 'Active' });
      TrainingSession.findOne.mockResolvedValue({ _id: mockSessionId });

      const mockCreated = {
        _id: 'media-1',
        title: 'Antenna Alignment',
        status: 'Draft',
        fileUrl: '/uploads/media/antenna.jpg',
      };
      Media.create.mockResolvedValue(mockCreated);

      const mockFile = {
        filename: 'antenna.jpg',
        originalname: 'antenna.jpg',
        mimetype: 'image/jpeg',
        size: 102400,
      };

      const result = await mediaService.createMediaSubmission(mockStudentId, mockFile, {
        courseId: mockCourseId,
        cohortId: mockCohortId,
        sessionId: mockSessionId,
        title: 'Antenna Alignment',
        submitImmediately: false,
      });

      expect(result.status).toBe('Draft');
      expect(Media.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Draft',
          title: 'Antenna Alignment',
          student: mockStudentId,
        })
      );
    });

    test('Creates media in Pending_Review and sends notification when submitImmediately is true', async () => {
      Enrollment.findOne.mockResolvedValue({ _id: 'enr-1', status: 'Active' });
      TrainingSession.findOne.mockResolvedValue({ _id: mockSessionId });

      const mockCreated = {
        _id: 'media-2',
        title: 'Oscilloscope Probe',
        status: 'Pending_Review',
      };
      Media.create.mockResolvedValue(mockCreated);

      const mockFile = {
        filename: 'probe.png',
        originalname: 'probe.png',
        mimetype: 'image/png',
        size: 204800,
      };

      const result = await mediaService.createMediaSubmission(mockStudentId, mockFile, {
        courseId: mockCourseId,
        cohortId: mockCohortId,
        sessionId: mockSessionId,
        title: 'Oscilloscope Probe',
        submitImmediately: true,
      });

      expect(result.status).toBe('Pending_Review');
      expect(Notification.create).toHaveBeenCalled();
    });
  });

  describe('Student Submission & Resubmission Lifecycle', () => {
    test('submitDraft transitions Draft to Pending_Review', async () => {
      const mockMedia = {
        _id: 'media-draft',
        student: mockStudentId,
        status: 'Draft',
        title: 'Soldering station',
        reviewHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      Media.findById.mockResolvedValue(mockMedia);

      const updated = await mediaService.submitDraft('media-draft', mockStudentId);

      expect(updated.status).toBe('Pending_Review');
      expect(mockMedia.reviewHistory.length).toBe(1);
      expect(mockMedia.reviewHistory[0].action).toBe('Submitted');
      expect(mockMedia.save).toHaveBeenCalled();
    });

    test('submitDraft forbids non-owner student from submitting', async () => {
      const mockMedia = {
        _id: 'media-draft',
        student: 'other-student',
        status: 'Draft',
      };
      Media.findById.mockResolvedValue(mockMedia);

      await expect(
        mediaService.submitDraft('media-draft', mockStudentId)
      ).rejects.toThrow(/do not have permission/i);
    });

    test('resubmitMedia transitions Changes_Requested back to Pending_Review with updated image', async () => {
      const mockMedia = {
        _id: 'media-cr',
        student: mockStudentId,
        status: 'Changes_Requested',
        title: 'Old title',
        fileUrl: '/uploads/media/old.jpg',
        reviewHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      Media.findById.mockResolvedValue(mockMedia);

      const newFile = {
        filename: 'new_sharp.jpg',
        originalname: 'sharp.jpg',
        mimetype: 'image/jpeg',
        size: 800000,
      };

      const updated = await mediaService.resubmitMedia(
        'media-cr',
        mockStudentId,
        { title: 'New Sharp Image', resubmitNotes: 'Replaced with 4K cleanroom scan.' },
        newFile
      );

      expect(updated.status).toBe('Pending_Review');
      expect(updated.title).toBe('New Sharp Image');
      expect(updated.fileUrl).toBe('/uploads/media/new_sharp.jpg');
      expect(mockMedia.reviewHistory.length).toBe(1);
      expect(mockMedia.reviewHistory[0].action).toBe('Resubmitted');
      expect(mockMedia.save).toHaveBeenCalled();
    });
  });

  describe('Admin Moderation & Editorial Selection Workflow', () => {
    test('Admin approveMedia sets status to Approved and logs review history', async () => {
      const mockMedia = {
        _id: 'med-app',
        student: mockStudentId,
        title: 'Thermal capture',
        status: 'Pending_Review',
        reviewHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      Media.findById.mockResolvedValue(mockMedia);

      const approved = await mediaService.approveMedia('med-app', mockAdminId, 'High-quality technical drill.');

      expect(approved.status).toBe('Approved');
      expect(approved.reviewedBy).toBe(mockAdminId);
      expect(approved.reviewHistory.length).toBe(1);
      expect(approved.reviewHistory[0].action).toBe('Approved');
      expect(approved.reviewHistory[0].comment).toContain('High-quality technical drill');
      expect(mockMedia.save).toHaveBeenCalled();
    });

    test('Admin rejectMedia requires reason and records feedback for student', async () => {
      const mockMedia = {
        _id: 'med-rej',
        student: mockStudentId,
        title: 'Blurry photo',
        status: 'Pending_Review',
        reviewHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      Media.findById.mockResolvedValue(mockMedia);

      const rejected = await mediaService.rejectMedia('med-rej', mockAdminId, 'Poor image quality', 'Out of focus.');

      expect(rejected.status).toBe('Rejected');
      expect(rejected.reviewReason).toBe('Poor image quality');
      expect(rejected.reviewComment).toBe('Out of focus.');
      expect(rejected.reviewHistory[0].action).toBe('Rejected');
      expect(mockMedia.save).toHaveBeenCalled();
    });

    test('Admin selectForPublication requires media to already be Approved', async () => {
      const unapprovedMedia = {
        _id: 'med-unapp',
        status: 'Pending_Review', // NOT approved yet!
      };
      Media.findById.mockResolvedValue(unapprovedMedia);

      await expect(
        mediaService.selectForPublication('med-unapp', mockAdminId, 'homepage')
      ).rejects.toThrow(/only approved media/i);
    });

    test('Admin selectForPublication curates approved media', async () => {
      const approvedMedia = {
        _id: 'med-app',
        status: 'Approved',
        reviewHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      Media.findById.mockResolvedValue(approvedMedia);

      const selected = await mediaService.selectForPublication('med-app', mockAdminId, 'homepage');

      expect(selected.status).toBe('Selected_For_Publication');
      expect(selected.publicationPlacement).toBe('homepage');
      expect(selected.selectedBy).toBe(mockAdminId);
      expect(approvedMedia.save).toHaveBeenCalled();
    });

    test('Admin publishMedia exposes approved/selected media to public', async () => {
      const selectedMedia = {
        _id: 'med-sel',
        student: mockStudentId,
        title: 'Space Antenna',
        status: 'Selected_For_Publication',
        publicVisibility: false,
        reviewHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      Media.findById.mockResolvedValue(selectedMedia);

      const published = await mediaService.publishMedia('med-sel', mockAdminId);

      expect(published.status).toBe('Published');
      expect(published.publicVisibility).toBe(true);
      expect(published.publishedBy).toBe(mockAdminId);
      expect(selectedMedia.save).toHaveBeenCalled();
    });

    test('Admin unpublishMedia removes media from public visibility', async () => {
      const publishedMedia = {
        _id: 'med-pub',
        status: 'Published',
        publicVisibility: true,
        reviewHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      Media.findById.mockResolvedValue(publishedMedia);

      const unpublished = await mediaService.unpublishMedia('med-pub', mockAdminId, 'Course archived.');

      expect(unpublished.status).toBe('Unpublished');
      expect(unpublished.publicVisibility).toBe(false);
      expect(publishedMedia.save).toHaveBeenCalled();
    });
  });

  describe('Public Gallery Sanitization & Deletion Constraints', () => {
    test('getPublicGallery strictly queries published items only', async () => {
      const queryMock = {
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([
          { _id: 'pub-1', title: 'Telemetry Board', fileUrl: '/uploads/media/1.jpg' },
        ]),
      };
      Media.find.mockReturnValue(queryMock);

      const gallery = await mediaService.getPublicGallery();

      expect(Media.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Published',
          publicVisibility: true,
        })
      );
      expect(gallery.length).toBe(1);
    });

    test('deleteMedia forbids deleting published media', async () => {
      const publishedMedia = {
        _id: 'med-pub-del',
        student: mockStudentId,
        status: 'Published',
      };
      Media.findById.mockResolvedValue(publishedMedia);

      await expect(
        mediaService.deleteMedia('med-pub-del', mockStudentId)
      ).rejects.toThrow(/cannot delete media that is currently published/i);
    });

    test('deleteMedia allows deleting draft media', async () => {
      const draftMedia = {
        _id: 'med-draft-del',
        student: mockStudentId,
        status: 'Draft',
        deleteOne: jest.fn().mockResolvedValue(true),
      };
      Media.findById.mockResolvedValue(draftMedia);

      const res = await mediaService.deleteMedia('med-draft-del', mockStudentId);

      expect(res.success).toBe(true);
      expect(draftMedia.deleteOne).toHaveBeenCalled();
    });
  });
});
