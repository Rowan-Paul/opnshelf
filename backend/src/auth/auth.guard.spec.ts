import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

// Mock PrismaService before importing AuthService/AuthGuard
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

// Mock @atproto modules to prevent import errors
jest.mock('@atproto/oauth-client-node', () => ({}));
jest.mock('@atproto/api', () => ({}));

import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authService: jest.Mocked<AuthService>;

  const mockAuthService = {
    getSessionById: jest.fn(),
    restore: jest.fn(),
  };

  const createMockExecutionContext = (
    cookies: Record<string, string> = {},
    headers: Record<string, string> = {},
  ) => {
    const mockRequest = {
      cookies,
      headers,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    authService = module.get(AuthService);
  });

  describe('canActivate', () => {
    it('should throw UnauthorizedException when no session cookie', async () => {
      const context = createMockExecutionContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Not authenticated'),
      );
    });

    it('should throw UnauthorizedException when session not found in DB', async () => {
      mockAuthService.getSessionById.mockResolvedValue(null);
      const context = createMockExecutionContext({
        session: 'invalid-session',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Session not found or expired'),
      );
      expect(mockAuthService.getSessionById).toHaveBeenCalledWith(
        'invalid-session',
      );
    });

    it('should throw UnauthorizedException when restore returns null', async () => {
      const mockSessionRecord = {
        id: 'session-123',
        userDid: 'did:plc:abc123',
        sessionData: '{}',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockAuthService.getSessionById.mockResolvedValue(mockSessionRecord);
      mockAuthService.restore.mockResolvedValue(undefined);

      const context = createMockExecutionContext({ session: 'session-123' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Session not found or expired'),
      );
      expect(mockAuthService.restore).toHaveBeenCalledWith('did:plc:abc123');
    });

    it('should attach user to request and return true when valid session', async () => {
      const mockSessionRecord = {
        id: 'session-123',
        userDid: 'did:plc:abc123',
        sessionData: '{}',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockSession = { did: 'did:plc:abc123' };

      mockAuthService.getSessionById.mockResolvedValue(mockSessionRecord);
      mockAuthService.restore.mockResolvedValue(mockSession);

      const mockRequest = { cookies: { session: 'session-123' }, headers: {} };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect((mockRequest as any).user).toEqual({
        did: 'did:plc:abc123',
        session: mockSession,
      });
    });

    it('should rethrow UnauthorizedException from inner try block', async () => {
      const mockSessionRecord = {
        id: 'session-123',
        userDid: 'did:plc:abc123',
        sessionData: '{}',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockAuthService.getSessionById.mockResolvedValue(mockSessionRecord);
      mockAuthService.restore.mockResolvedValue(null);

      const context = createMockExecutionContext({ session: 'session-123' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw generic UnauthorizedException on non-Unauthorized errors', async () => {
      const mockSessionRecord = {
        id: 'session-123',
        userDid: 'did:plc:abc123',
        sessionData: '{}',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockAuthService.getSessionById.mockResolvedValue(mockSessionRecord);
      mockAuthService.restore.mockRejectedValue(new Error('Database error'));

      const context = createMockExecutionContext({ session: 'session-123' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired session'),
      );
    });

    it('should handle undefined cookies object', async () => {
      const mockRequest = { headers: {} };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Not authenticated'),
      );
    });

    it('should authenticate with Bearer token', async () => {
      const mockSessionRecord = {
        id: 'session-123',
        userDid: 'did:plc:abc123',
        sessionData: '{}',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockSession = { did: 'did:plc:abc123' };

      mockAuthService.getSessionById.mockResolvedValue(mockSessionRecord);
      mockAuthService.restore.mockResolvedValue(mockSession);

      const mockRequest = {
        cookies: {},
        headers: { authorization: 'Bearer session-123' },
      };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthService.getSessionById).toHaveBeenCalledWith(
        'session-123',
      );
    });
  });
});
