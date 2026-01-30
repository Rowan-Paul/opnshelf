import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';

// Mock PrismaService before importing AuthController/AuthService
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

// Mock @atproto modules to prevent import errors
jest.mock('@atproto/oauth-client-node', () => ({}));
jest.mock('@atproto/api', () => ({}));

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService: {
    getClientMetadata: jest.Mock;
    authorize: jest.Mock;
    callback: jest.Mock;
    fetchProfile: jest.Mock;
    upsertUser: jest.Mock;
    getSessionByUserDid: jest.Mock;
    getUser: jest.Mock;
    revokeBySessionId: jest.Mock;
  } = {
    getClientMetadata: jest.fn(),
    authorize: jest.fn(),
    callback: jest.fn(),
    fetchProfile: jest.fn(),
    upsertUser: jest.fn(),
    getSessionByUserDid: jest.fn(),
    getUser: jest.fn(),
    revokeBySessionId: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        FRONTEND_URL: 'http://127.0.0.1:3000',
        NODE_ENV: 'test',
      };
      return config[key];
    }),
  };

  const createMockResponse = () => {
    const res = {
      redirect: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<Response>;
    return res;
  };

  const createMockRequest = (overrides: Partial<Request> = {}) => {
    return {
      url: '/auth/callback',
      cookies: {},
      ...overrides,
    } as unknown as Request;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('getClientMetadata', () => {
    it('should return client metadata from auth service', () => {
      const mockMetadata = {
        client_id:
          'http://127.0.0.1:3001/.well-known/oauth-client-metadata.json',
        client_name: 'OpnShelf',
      };
      mockAuthService.getClientMetadata.mockReturnValue(mockMetadata);

      const result = controller.getClientMetadata();

      expect(result).toEqual(mockMetadata);
      expect(mockAuthService.getClientMetadata).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should redirect to auth URL on success', async () => {
      const authUrl = 'https://bsky.social/oauth/authorize?state=abc';
      mockAuthService.authorize.mockResolvedValue(authUrl);
      const res = createMockResponse();

      await controller.login('user.bsky.social', undefined, res);

      expect(mockAuthService.authorize).toHaveBeenCalledWith(
        'user.bsky.social',
      );
      expect(res.redirect).toHaveBeenCalledWith(authUrl);
    });

    it('should use bsky.social as default handle', async () => {
      const authUrl = 'https://bsky.social/oauth/authorize?state=abc';
      mockAuthService.authorize.mockResolvedValue(authUrl);
      const res = createMockResponse();

      await controller.login(undefined, undefined, res);

      expect(mockAuthService.authorize).toHaveBeenCalledWith('bsky.social');
    });

    it('should set platform cookie when platform=mobile', async () => {
      const authUrl = 'https://bsky.social/oauth/authorize?state=abc';
      mockAuthService.authorize.mockResolvedValue(authUrl);
      const res = createMockResponse();

      await controller.login('user.bsky.social', 'mobile', res);

      expect(res.cookie).toHaveBeenCalledWith('auth_platform', 'mobile', {
        httpOnly: true,
        maxAge: 5 * 60 * 1000,
        sameSite: 'lax',
      });
      expect(res.redirect).toHaveBeenCalledWith(authUrl);
    });

    it('should redirect to frontend with error on failure', async () => {
      mockAuthService.authorize.mockRejectedValue(new Error('OAuth error'));
      const res = createMockResponse();

      await controller.login('user.bsky.social', undefined, res);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://127.0.0.1:3000?error=auth_failed',
      );
    });
  });

  describe('callback', () => {
    it('should set cookie and redirect to /auth/complete on success', async () => {
      const mockSession = { did: 'did:plc:abc123' };
      const mockProfile = {
        did: 'did:plc:abc123',
        handle: 'user.bsky.social',
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
      };
      const mockSessionRecord = {
        id: 'session-123',
        userDid: 'did:plc:abc123',
      };

      mockAuthService.callback.mockResolvedValue({ session: mockSession });
      mockAuthService.fetchProfile.mockResolvedValue(mockProfile);
      mockAuthService.upsertUser.mockResolvedValue(mockProfile);
      mockAuthService.getSessionByUserDid.mockResolvedValue(mockSessionRecord);

      const req = createMockRequest({
        url: '/auth/callback?code=abc&state=xyz',
      });
      const res = createMockResponse();

      await controller.callback(req, res);

      expect(mockAuthService.callback).toHaveBeenCalled();
      expect(mockAuthService.fetchProfile).toHaveBeenCalledWith(mockSession);
      expect(mockAuthService.upsertUser).toHaveBeenCalledWith(mockProfile);
      expect(res.cookie).toHaveBeenCalledWith(
        'session',
        'session-123',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        'http://127.0.0.1:3000/auth/complete',
      );
    });

    it('should redirect to mobile deep link when platform cookie is set', async () => {
      const mockSession = { did: 'did:plc:abc123' };
      const mockProfile = {
        did: 'did:plc:abc123',
        handle: 'user.bsky.social',
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
      };
      const mockSessionRecord = {
        id: 'session-123',
        userDid: 'did:plc:abc123',
      };

      mockAuthService.callback.mockResolvedValue({ session: mockSession });
      mockAuthService.fetchProfile.mockResolvedValue(mockProfile);
      mockAuthService.upsertUser.mockResolvedValue(mockProfile);
      mockAuthService.getSessionByUserDid.mockResolvedValue(mockSessionRecord);

      const req = createMockRequest({
        url: '/auth/callback?code=abc&state=xyz',
        cookies: { auth_platform: 'mobile' },
      });
      const res = createMockResponse();

      await controller.callback(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith('auth_platform');
      expect(res.redirect).toHaveBeenCalledWith(
        'opnshelf://auth/complete?session=session-123',
      );
    });

    it('should redirect with error when session record not found', async () => {
      const mockSession = { did: 'did:plc:abc123' };
      const mockProfile = {
        did: 'did:plc:abc123',
        handle: 'user.bsky.social',
        displayName: null,
        avatar: null,
      };

      mockAuthService.callback.mockResolvedValue({ session: mockSession });
      mockAuthService.fetchProfile.mockResolvedValue(mockProfile);
      mockAuthService.upsertUser.mockResolvedValue(mockProfile);
      mockAuthService.getSessionByUserDid.mockResolvedValue(null);

      const req = createMockRequest({
        url: '/auth/callback?code=abc&state=xyz',
      });
      const res = createMockResponse();

      await controller.callback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://127.0.0.1:3000?error=callback_failed',
      );
    });

    it('should redirect with error on callback failure', async () => {
      mockAuthService.callback.mockRejectedValue(new Error('OAuth error'));

      const req = createMockRequest({
        url: '/auth/callback?code=abc&state=xyz',
      });
      const res = createMockResponse();

      await controller.callback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://127.0.0.1:3000?error=callback_failed',
      );
    });
  });

  describe('me', () => {
    it('should return user data when authenticated', async () => {
      const mockUser = {
        did: 'did:plc:abc123',
        handle: 'user.bsky.social',
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
      };
      mockAuthService.getUser.mockResolvedValue(mockUser);

      const req = createMockRequest();
      (req as any).user = { did: 'did:plc:abc123' };

      const result = await controller.me(req);

      expect(result).toEqual(mockUser);
      expect(mockAuthService.getUser).toHaveBeenCalledWith('did:plc:abc123');
    });

    it('should throw BadRequestException when no user in request', async () => {
      const req = createMockRequest();

      await expect(controller.me(req)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user not found in DB', async () => {
      mockAuthService.getUser.mockResolvedValue(null);

      const req = createMockRequest();
      (req as any).user = { did: 'did:plc:abc123' };

      await expect(controller.me(req)).rejects.toThrow(BadRequestException);
    });
  });

  describe('logout', () => {
    it('should revoke session and clear cookie', async () => {
      const req = createMockRequest({
        cookies: { session: 'session-123' },
      });
      const res = createMockResponse();

      await controller.logout(req, res);

      expect(mockAuthService.revokeBySessionId).toHaveBeenCalledWith(
        'session-123',
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        'session',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Logged out successfully',
      });
    });

    it('should still clear cookie when no session exists', async () => {
      const req = createMockRequest({ cookies: {} });
      const res = createMockResponse();

      await controller.logout(req, res);

      expect(mockAuthService.revokeBySessionId).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getCookieDomain (via callback)', () => {
    it('should not set domain in development', async () => {
      const mockSession = { did: 'did:plc:abc123' };
      const mockProfile = {
        did: 'did:plc:abc123',
        handle: 'user.bsky.social',
        displayName: null,
        avatar: null,
      };
      const mockSessionRecord = {
        id: 'session-123',
        userDid: 'did:plc:abc123',
      };

      mockAuthService.callback.mockResolvedValue({ session: mockSession });
      mockAuthService.fetchProfile.mockResolvedValue(mockProfile);
      mockAuthService.upsertUser.mockResolvedValue(mockProfile);
      mockAuthService.getSessionByUserDid.mockResolvedValue(mockSessionRecord);

      const req = createMockRequest({ url: '/auth/callback?code=abc' });
      const res = createMockResponse();

      await controller.callback(req, res);

      // In test/dev mode, domain should not be set
      expect(res.cookie).toHaveBeenCalledWith(
        'session',
        'session-123',
        expect.not.objectContaining({ domain: expect.any(String) }),
      );
    });

    it('should set domain in production', async () => {
      // Override to production config
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, string> = {
          FRONTEND_URL: 'https://opnshelf.xyz',
          NODE_ENV: 'production',
        };
        return config[key];
      });

      const mockSession = { did: 'did:plc:abc123' };
      const mockProfile = {
        did: 'did:plc:abc123',
        handle: 'user.bsky.social',
        displayName: null,
        avatar: null,
      };
      const mockSessionRecord = {
        id: 'session-123',
        userDid: 'did:plc:abc123',
      };

      mockAuthService.callback.mockResolvedValue({ session: mockSession });
      mockAuthService.fetchProfile.mockResolvedValue(mockProfile);
      mockAuthService.upsertUser.mockResolvedValue(mockProfile);
      mockAuthService.getSessionByUserDid.mockResolvedValue(mockSessionRecord);

      const req = createMockRequest({ url: '/auth/callback?code=abc' });
      const res = createMockResponse();

      await controller.callback(req, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'session',
        'session-123',
        expect.objectContaining({
          secure: true,
          domain: 'opnshelf.xyz',
        }),
      );
    });
  });
});
