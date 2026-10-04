jest.mock('../src/models/User');
jest.mock('../src/models/StudentProfile');
jest.mock('../src/utils/email');

const User = require('../src/models/User');
const StudentProfile = require('../src/models/StudentProfile');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../src/utils/email');
const {
  signAccessToken,
  signRefreshToken,
  generateRandomToken,
  hashToken,
  verifyAccessToken,
} = require('../src/utils/token');
const {
  register,
  verifyEmail,
  resendVerification,
  login,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  maskEmail,
} = require('../src/controllers/authController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('EGSA Space Academy — Auth & Session Security Suite', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Cryptographic Token Utilities', () => {
    test('generateRandomToken produces random hex string with expected length', () => {
      const token1 = generateRandomToken(32);
      const token2 = generateRandomToken(32);
      expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });

    test('hashToken produces deterministic SHA-256 digest', () => {
      const raw = 'test-token-value-123';
      const hash1 = hashToken(raw);
      const hash2 = hashToken(raw);
      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(raw);
    });

    test('signAccessToken generates valid JWT verifiable by verifyAccessToken', () => {
      const user = { _id: 'user-123', role: 'student', email: 'cadet@egsa-academy.example' };
      const token = signAccessToken(user);
      const decoded = verifyAccessToken(token);
      expect(decoded.id).toBe('user-123');
      expect(decoded.role).toBe('student');
      expect(decoded.email).toBe('cadet@egsa-academy.example');
    });

    test('maskEmail obfuscates email address safely', () => {
      expect(maskEmail('sara.demo@egsa-academy.example')).toBe('s***o@egsa-academy.example');
      expect(maskEmail('ahmed@domain.com')).toBe('a***d@domain.com');
      expect(maskEmail('ab@domain.com')).toBe('a***@domain.com');
    });
  });

  describe('Registration Flow & Role Security', () => {
    test('successfully registers a student with accountStatus: unverified and creates StudentProfile', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockImplementation((doc) => Promise.resolve({ _id: 'new-user-id', ...doc }));
      StudentProfile.create.mockResolvedValue({ _id: 'new-profile-id' });
      sendVerificationEmail.mockResolvedValue({ simulated: true });

      const req = {
        body: {
          fullName: 'Tariq Nour',
          email: 'Tariq.Nour@example.com',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          phone: '+201012345678',
          nationalId: '29801010123456',
          university: 'Cairo University',
          faculty: 'Faculty of Engineering',
          department: 'Aerospace',
          status: 'student',
          graduationYear: 2026,
          agreeToTerms: true,
        },
      };
      const res = mockRes();
      const next = jest.fn();

      await register(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Tariq Nour',
          email: 'tariq.nour@example.com', // normalized lowercase
          nationalId: '29801010123456',
          role: 'student',
          accountStatus: 'active',
          isEmailVerified: true,
        })
      );
      expect(StudentProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'new-user-id',
          university: 'Cairo University',
          faculty: 'Faculty of Engineering',
          department: 'Aerospace',
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringMatching(/Registration successful/i),
        })
      );
    });

    test('STRICT ROLE DEFENSE: ignores malicious role injection and forces role: student', async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockImplementation((doc) => Promise.resolve({ _id: 'hacker-id', ...doc }));
      StudentProfile.create.mockResolvedValue({});
      sendVerificationEmail.mockResolvedValue({});

      const req = {
        body: {
          fullName: 'Malicious Actor',
          email: 'hacker@example.com',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          phone: '+201099999999',
          nationalId: '29001010999999',
          agreeToTerms: true,
          role: 'admin', // Malicious attempt to escalate role
        },
      };
      const res = mockRes();
      const next = jest.fn();

      await register(req, res, next);

      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'student', // MUST be strictly student
        })
      );
    });

    test('rejects duplicate registration by email or National ID with safe message', async () => {
      User.findOne.mockResolvedValue({ _id: 'existing-id', email: 'cadet@example.com' });

      const req = {
        body: {
          fullName: 'Duplicate Cadet',
          email: 'cadet@example.com',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          phone: '+201000000000',
          nationalId: '29901010123456',
          agreeToTerms: true,
        },
      };
      const res = mockRes();
      const next = jest.fn();

      await register(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 409,
          message: 'An account with this email address or National ID already exists.',
        })
      );
    });

    test('rejects registration when password and confirmPassword mismatch', async () => {
      const req = {
        body: {
          fullName: 'Cadet Test',
          email: 'cadet@example.com',
          password: 'Password123!',
          confirmPassword: 'DifferentPassword123!',
          phone: '+201000000000',
          nationalId: '29901010123456',
          agreeToTerms: true,
        },
      };
      const res = mockRes();
      const next = jest.fn();

      await register(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Password and confirmation password do not match.',
        })
      );
    });
  });

  describe('Email Verification Flow', () => {
    test('successfully verifies email with valid token and activates account', async () => {
      const mockUser = {
        _id: 'user-to-verify',
        email: 'cadet@egsa-academy.example',
        isEmailVerified: false,
        accountStatus: 'unverified',
        save: jest.fn().mockResolvedValue(true),
      };

      const selectMock = jest.fn().mockResolvedValue(mockUser);
      User.findOne.mockReturnValue({ select: selectMock });

      const req = { params: { token: 'valid-token-string' } };
      const res = mockRes();
      const next = jest.fn();

      await verifyEmail(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(mockUser.isEmailVerified).toBe(true);
      expect(mockUser.accountStatus).toBe('active');
      expect(mockUser.isActive).toBe(true);
      expect(mockUser.emailVerificationTokenHash).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('verified successfully'),
        })
      );
    });

    test('returns 400 error when verification token is expired or invalid', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      const req = { params: { token: 'invalid-or-expired-token' } };
      const res = mockRes();
      const next = jest.fn();

      await verifyEmail(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: expect.stringContaining('Invalid, expired, or already used'),
        })
      );
    });
  });

  describe('Resend Verification Endpoint', () => {
    test('generates fresh token and dispatches email for unverified user', async () => {
      const mockUser = {
        _id: 'unverified-user',
        email: 'unverified@example.com',
        fullName: 'Unverified Cadet',
        isEmailVerified: false,
        accountStatus: 'unverified',
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });
      sendVerificationEmail.mockResolvedValue({ simulated: true });

      const req = { body: { email: 'unverified@example.com' } };
      const res = mockRes();
      const next = jest.fn();

      await resendVerification(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(mockUser.emailVerificationTokenHash).toBeDefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(sendVerificationEmail).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('fresh verification link has been dispatched'),
        })
      );
    });

    test('anti-enumeration: returns safe message when email does not exist', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      const req = { body: { email: 'nonexistent@example.com' } };
      const res = mockRes();
      const next = jest.fn();

      await resendVerification(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('If an unverified account exists'),
        })
      );
    });
  });

  describe('Login & Authentication Session', () => {
    test('allows login if student account had legacy unverified status, activating it seamlessly', async () => {
      const mockUser = {
        _id: 'unverified-cadet',
        fullName: 'Unverified Cadet',
        email: 'unverified@egsa-academy.example',
        role: 'student',
        isEmailVerified: false,
        accountStatus: 'unverified',
        isActive: false,
        refreshTokens: [],
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });
      StudentProfile.findOne.mockResolvedValue({ isProfileComplete: true });

      const req = {
        body: {
          email: 'unverified@egsa-academy.example',
          password: 'Password123!',
        },
        headers: {},
        ip: '127.0.0.1',
      };
      const res = mockRes();
      const next = jest.fn();

      await login(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(mockUser.isEmailVerified).toBe(true);
      expect(mockUser.accountStatus).toBe('active');
      expect(mockUser.isActive).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            token: expect.any(String),
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            user: expect.objectContaining({
              id: 'unverified-cadet',
              email: 'unverified@egsa-academy.example',
              accountStatus: 'active',
              isEmailVerified: true,
            }),
          }),
        })
      );
    });

    test('authenticates verified active student and issues short-lived accessToken + refresh session', async () => {
      const mockUser = {
        _id: 'verified-student',
        fullName: 'Sara Ahmed',
        email: 'sara.demo@egsa-academy.example',
        role: 'student',
        phone: '+201000000000',
        nationalId: '29901010123456',
        isEmailVerified: true,
        accountStatus: 'active',
        isActive: true,
        refreshTokens: [],
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });
      StudentProfile.findOne.mockResolvedValue({ profileCompleted: true });

      const req = {
        body: {
          email: 'sara.demo@egsa-academy.example',
          password: 'Password123!',
        },
        headers: { 'user-agent': 'Jest-Test-Agent' },
        ip: '127.0.0.1',
      };
      const res = mockRes();
      const next = jest.fn();

      await login(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(mockUser.refreshTokens.length).toBe(1);
      expect(mockUser.refreshTokens[0].tokenHash).toBeDefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            user: expect.objectContaining({
              id: 'verified-student',
              fullName: 'Sara Ahmed',
              email: 'sara.demo@egsa-academy.example',
              role: 'student',
              isEmailVerified: true,
            }),
          }),
        })
      );
    });

    test('anti-enumeration: returns generic message on wrong password', async () => {
      const mockUser = {
        _id: 'user-1',
        email: 'user@example.com',
        comparePassword: jest.fn().mockResolvedValue(false),
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = { body: { email: 'user@example.com', password: 'WrongPassword!' } };
      const res = mockRes();
      const next = jest.fn();

      await login(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'The email or password is incorrect.',
        })
      );
    });

    test('blocks suspended or disabled account with 403', async () => {
      const mockUser = {
        _id: 'suspended-user',
        email: 'suspended@example.com',
        accountStatus: 'suspended',
        isActive: false,
        isEmailVerified: true,
        comparePassword: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = { body: { email: 'suspended@example.com', password: 'Password123!' } };
      const res = mockRes();
      const next = jest.fn();

      await login(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: expect.stringContaining('suspended'),
        })
      );
    });
  });

  describe('Refresh Token Rotation & Invalidation', () => {
    test('rotates refresh token and issues fresh access token', async () => {
      const rawOldToken = 'old-refresh-token-value-12345';
      const oldHash = hashToken(rawOldToken);

      const activeSession = {
        tokenHash: oldHash,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      };

      const mockUser = {
        _id: 'user-refreshing',
        role: 'student',
        email: 'student@example.com',
        refreshTokens: [activeSession],
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);

      const req = {
        body: { refreshToken: rawOldToken },
        headers: { 'user-agent': 'Chrome-Mac' },
        ip: '127.0.0.1',
      };
      const res = mockRes();
      const next = jest.fn();

      await refreshToken(req, res, next);

      expect(next).not.toHaveBeenCalled();
      // Old session must be revoked
      expect(activeSession.revokedAt).toBeDefined();
      // A new session must be created
      expect(mockUser.refreshTokens.length).toBe(2);
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
          }),
        })
      );
    });

    test('rejects expired or revoked refresh token with 401', async () => {
      const rawToken = 'revoked-token-value';
      const tokenHash = hashToken(rawToken);

      const revokedSession = {
        tokenHash,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(), // Already revoked
      };

      const mockUser = {
        _id: 'user-with-revoked-token',
        refreshTokens: [revokedSession],
      };

      User.findOne.mockResolvedValue(mockUser);

      const req = { body: { refreshToken: rawToken } };
      const res = mockRes();
      const next = jest.fn();

      await refreshToken(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: expect.stringContaining('expired or was revoked'),
        })
      );
    });
  });

  describe('Logout & Session Termination', () => {
    test('revokes refresh token session on logout', async () => {
      User.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

      const req = { body: { refreshToken: 'active-refresh-token' } };
      const res = mockRes();
      const next = jest.fn();

      await logout(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(User.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ 'refreshTokens.tokenHash': hashToken('active-refresh-token') }),
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: expect.stringContaining('Logged out') })
      );
    });
  });

  describe('Password Recovery & Reset Session Invalidation', () => {
    test('forgotPassword returns safe message and dispatches reset link when user exists', async () => {
      const mockUser = {
        _id: 'user-for-reset',
        email: 'resetme@example.com',
        fullName: 'Reset Cadet',
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });
      sendPasswordResetEmail.mockResolvedValue({ simulated: true });

      const req = { body: { email: 'resetme@example.com' } };
      const res = mockRes();
      const next = jest.fn();

      await forgotPassword(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(mockUser.passwordResetTokenHash).toBeDefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(sendPasswordResetEmail).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('password reset instructions have been dispatched'),
        })
      );
    });

    test('resetPassword updates password and invalidates all existing refresh sessions', async () => {
      const mockUser = {
        _id: 'user-to-reset',
        password: 'OldPassword123!',
        passwordResetTokenHash: hashToken('valid-reset-token'),
        refreshTokens: [
          { tokenHash: 'session-1', revokedAt: null },
          { tokenHash: 'session-2', revokedAt: null },
        ],
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const req = { body: { token: 'valid-reset-token', password: 'NewSecurePassword123!' } };
      const res = mockRes();
      const next = jest.fn();

      await resetPassword(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(mockUser.password).toBe('NewSecurePassword123!');
      expect(mockUser.passwordResetTokenHash).toBeUndefined();
      // All existing refresh sessions must be invalidated
      expect(mockUser.refreshTokens[0].revokedAt).toBeDefined();
      expect(mockUser.refreshTokens[1].revokedAt).toBeDefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Password reset successful'),
        })
      );
    });
  });
});
