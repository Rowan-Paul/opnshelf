import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

// Mock PrismaService before importing
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

// Mock MoviesService before importing
jest.mock('../movies/movies.service', () => ({
  MoviesService: jest.fn().mockImplementation(() => ({
    getMovieByTMDBId: jest.fn(),
    getMovieDetails: jest.fn(),
    upsertMovie: jest.fn(),
  })),
}));

// Mock @atproto/tap
const mockTapChannel = {
  start: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
};

const mockTapInstance = {
  channel: jest.fn().mockReturnValue(mockTapChannel),
  addRepos: jest.fn().mockResolvedValue(undefined),
  removeRepos: jest.fn().mockResolvedValue(undefined),
  getRepoInfo: jest.fn().mockResolvedValue({
    did: 'did:plc:test',
    handle: 'test.bsky.social',
    state: 'active',
    rev: '3mebdinas5v2j',
    records: 13073,
  }),
};

jest.mock('@atproto/tap', () => ({
  Tap: jest.fn().mockImplementation(() => mockTapInstance),
  SimpleIndexer: jest.fn().mockImplementation(() => ({
    record: jest.fn(),
    identity: jest.fn(),
    error: jest.fn(),
  })),
}));

import { IngesterService } from './ingester.service';
import { PrismaService } from '../prisma/prisma.service';
import { MoviesService } from '../movies/movies.service';
import { Tap, SimpleIndexer } from '@atproto/tap';
import type { RecordEvent, IdentityEvent } from '@atproto/tap';

type MockPrismaService = {
  user: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
  };
  trackedMovie: {
    upsert: jest.Mock;
    deleteMany: jest.Mock;
  };
};

type MockMoviesService = {
  getMovieByTMDBId: jest.Mock;
  getMovieDetails: jest.Mock;
  upsertMovie: jest.Mock;
};

describe('IngesterService', () => {
  let service: IngesterService;
  let mockPrismaService: MockPrismaService;
  let mockMoviesService: MockMoviesService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'TAP_URL') return 'wss://tap.opnshelf.xyz';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      trackedMovie: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    mockMoviesService = {
      getMovieByTMDBId: jest.fn(),
      getMovieDetails: jest.fn(),
      upsertMovie: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngesterService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MoviesService, useValue: mockMoviesService },
      ],
    }).compile();

    service = module.get<IngesterService>(IngesterService);
  });

  describe('onModuleInit', () => {
    it('should start the TAP ingester', () => {
      service.onModuleInit();

      expect(Tap).toHaveBeenCalledWith('wss://tap.opnshelf.xyz', {
        adminPassword: undefined,
      });
      expect(SimpleIndexer).toHaveBeenCalled();
      expect(mockTapInstance.channel).toHaveBeenCalled();
      expect(mockTapChannel.start).toHaveBeenCalled();
    });

    it('should register existing users with TAP', async () => {
      jest.useFakeTimers();
      const mockUsers = [{ did: 'did:plc:user1' }, { did: 'did:plc:user2' }];
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      service.onModuleInit();

      // Fast-forward past the setTimeout
      jest.advanceTimersByTime(1000);
      await Promise.resolve(); // Let any pending promises resolve

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        select: { did: true },
      });
      expect(mockTapInstance.addRepos).toHaveBeenCalledWith(['did:plc:user1']);
      jest.useRealTimers();
    });
  });

  describe('onModuleDestroy', () => {
    it('should stop the TAP ingester', async () => {
      service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockTapChannel.destroy).toHaveBeenCalled();
    });
  });

  describe('addRepo', () => {
    it('should add a repo to TAP', async () => {
      service.onModuleInit();
      await service.addRepo('did:plc:abc123');

      expect(mockTapInstance.addRepos).toHaveBeenCalledWith(['did:plc:abc123']);
    });

    it('should throw if TAP is not initialized', async () => {
      await expect(service.addRepo('did:plc:abc123')).rejects.toThrow(
        'TAP client not initialized',
      );
    });
  });

  describe('removeRepo', () => {
    it('should remove a repo from TAP', async () => {
      service.onModuleInit();
      await service.removeRepo('did:plc:abc123');

      expect(mockTapInstance.removeRepos).toHaveBeenCalledWith([
        'did:plc:abc123',
      ]);
    });

    it('should throw if TAP is not initialized', async () => {
      await expect(service.removeRepo('did:plc:abc123')).rejects.toThrow(
        'TAP client not initialized',
      );
    });
  });

  describe('handleRecordEvent - create', () => {
    it('should upsert tracked movie for existing user', async () => {
      const mockUser = { did: 'did:plc:abc123', handle: 'test.bsky.social' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrismaService.trackedMovie.upsert.mockResolvedValue({} as any);

      // Capture the record handler
      let recordHandler: ((evt: RecordEvent) => Promise<void>) | undefined;
      (SimpleIndexer as jest.Mock).mockImplementation(() => ({
        record: jest.fn((handler) => {
          recordHandler = handler;
        }),
        identity: jest.fn(),
        error: jest.fn(),
      }));

      service.onModuleInit();

      const createEvent: RecordEvent = {
        id: 1,
        type: 'record',
        action: 'create',
        did: 'did:plc:abc123',
        rev: 'rev123',
        collection: 'app.opnshelf.movie',
        rkey: 'movie-123',
        record: {
          $type: 'app.opnshelf.movie',
          movieId: '123',
          source: 'tmdb',
          watchedAt: '2024-01-15T10:00:00Z',
          createdAt: '2024-01-15T10:00:00Z',
        },
        cid: 'cid123',
        live: true,
      };

      if (recordHandler) {
        await recordHandler(createEvent);
      }

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { did: 'did:plc:abc123' },
      });
      expect(mockPrismaService.trackedMovie.upsert).toHaveBeenCalledWith({
        where: { uri: 'at://did:plc:abc123/app.opnshelf.movie/movie-123' },
        create: expect.objectContaining({
          uri: 'at://did:plc:abc123/app.opnshelf.movie/movie-123',
          rkey: 'movie-123',
          cid: 'cid123',
          userDid: 'did:plc:abc123',
          movieId: '123',
          status: 'watched',
        }),
        update: expect.objectContaining({
          cid: 'cid123',
          status: 'watched',
        }),
      });
    });

    it('should skip records for non-existent users', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      let recordHandler: ((evt: RecordEvent) => Promise<void>) | undefined;
      (SimpleIndexer as jest.Mock).mockImplementation(() => ({
        record: jest.fn((handler) => {
          recordHandler = handler;
        }),
        identity: jest.fn(),
        error: jest.fn(),
      }));

      service.onModuleInit();

      const createEvent: RecordEvent = {
        id: 1,
        type: 'record',
        action: 'create',
        did: 'did:plc:unknown',
        rev: 'rev123',
        collection: 'app.opnshelf.movie',
        rkey: 'movie-123',
        record: {
          $type: 'app.opnshelf.movie',
          movieId: '123',
          source: 'tmdb',
          watchedAt: '2024-01-15T10:00:00Z',
          createdAt: '2024-01-15T10:00:00Z',
        },
        cid: 'cid123',
        live: true,
      };

      if (recordHandler) {
        await recordHandler(createEvent);
      }

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { did: 'did:plc:unknown' },
      });
      expect(mockPrismaService.trackedMovie.upsert).not.toHaveBeenCalled();
    });

    it('should skip invalid movie records', async () => {
      let recordHandler: ((evt: RecordEvent) => Promise<void>) | undefined;
      (SimpleIndexer as jest.Mock).mockImplementation(() => ({
        record: jest.fn((handler) => {
          recordHandler = handler;
        }),
        identity: jest.fn(),
        error: jest.fn(),
      }));

      service.onModuleInit();

      const invalidEvent: RecordEvent = {
        id: 1,
        type: 'record',
        action: 'create',
        did: 'did:plc:abc123',
        rev: 'rev123',
        collection: 'app.opnshelf.movie',
        rkey: 'movie-123',
        record: {
          $type: 'app.opnshelf.movie',
          // Missing required fields
        },
        cid: 'cid123',
        live: true,
      };

      if (recordHandler) {
        await recordHandler(invalidEvent);
      }

      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.trackedMovie.upsert).not.toHaveBeenCalled();
    });

    it('should skip events for other collections', async () => {
      let recordHandler: ((evt: RecordEvent) => Promise<void>) | undefined;
      (SimpleIndexer as jest.Mock).mockImplementation(() => ({
        record: jest.fn((handler) => {
          recordHandler = handler;
        }),
        identity: jest.fn(),
        error: jest.fn(),
      }));

      service.onModuleInit();

      const otherEvent: RecordEvent = {
        id: 1,
        type: 'record',
        action: 'create',
        did: 'did:plc:abc123',
        rev: 'rev123',
        collection: 'app.bsky.feed.post',
        rkey: 'abc',
        record: { $type: 'app.bsky.feed.post' },
        cid: 'cid123',
        live: true,
      };

      if (recordHandler) {
        await recordHandler(otherEvent);
      }

      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('handleRecordEvent - update', () => {
    it('should handle update events same as create', async () => {
      const mockUser = { did: 'did:plc:abc123', handle: 'test.bsky.social' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrismaService.trackedMovie.upsert.mockResolvedValue({} as any);

      let recordHandler: ((evt: RecordEvent) => Promise<void>) | undefined;
      (SimpleIndexer as jest.Mock).mockImplementation(() => ({
        record: jest.fn((handler) => {
          recordHandler = handler;
        }),
        identity: jest.fn(),
        error: jest.fn(),
      }));

      service.onModuleInit();

      const updateEvent: RecordEvent = {
        id: 1,
        type: 'record',
        action: 'update',
        did: 'did:plc:abc123',
        rev: 'rev456',
        collection: 'app.opnshelf.movie',
        rkey: 'movie-789',
        record: {
          $type: 'app.opnshelf.movie',
          movieId: '789',
          source: 'tmdb',
          watchedAt: '2024-02-20T15:30:00Z',
          createdAt: '2024-01-15T10:00:00Z',
        },
        cid: 'cid789-updated',
        live: true,
      };

      if (recordHandler) {
        await recordHandler(updateEvent);
      }

      expect(mockPrismaService.trackedMovie.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uri: 'at://did:plc:abc123/app.opnshelf.movie/movie-789' },
          update: expect.objectContaining({
            cid: 'cid789-updated',
          }),
        }),
      );
    });
  });

  describe('handleRecordEvent - delete', () => {
    it('should delete tracked movie record', async () => {
      mockPrismaService.trackedMovie.deleteMany.mockResolvedValue({
        count: 1,
      } as any);

      let recordHandler: ((evt: RecordEvent) => Promise<void>) | undefined;
      (SimpleIndexer as jest.Mock).mockImplementation(() => ({
        record: jest.fn((handler) => {
          recordHandler = handler;
        }),
        identity: jest.fn(),
        error: jest.fn(),
      }));

      service.onModuleInit();

      const deleteEvent: RecordEvent = {
        id: 1,
        type: 'record',
        action: 'delete',
        did: 'did:plc:abc123',
        rev: 'rev789',
        collection: 'app.opnshelf.movie',
        rkey: 'movie-123',
        live: true,
      };

      if (recordHandler) {
        await recordHandler(deleteEvent);
      }

      expect(mockPrismaService.trackedMovie.deleteMany).toHaveBeenCalledWith({
        where: { uri: 'at://did:plc:abc123/app.opnshelf.movie/movie-123' },
      });
    });

    it('should skip delete events for other collections', async () => {
      let recordHandler: ((evt: RecordEvent) => Promise<void>) | undefined;
      (SimpleIndexer as jest.Mock).mockImplementation(() => ({
        record: jest.fn((handler) => {
          recordHandler = handler;
        }),
        identity: jest.fn(),
        error: jest.fn(),
      }));

      service.onModuleInit();

      const otherEvent: RecordEvent = {
        id: 1,
        type: 'record',
        action: 'delete',
        did: 'did:plc:abc123',
        rev: 'rev123',
        collection: 'app.bsky.feed.post',
        rkey: 'abc',
        live: true,
      };

      if (recordHandler) {
        await recordHandler(otherEvent);
      }

      expect(mockPrismaService.trackedMovie.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('handleIdentityEvent', () => {
    it('should handle identity events', async () => {
      let identityHandler: ((evt: IdentityEvent) => Promise<void>) | undefined;
      (SimpleIndexer as jest.Mock).mockImplementation(() => ({
        record: jest.fn(),
        identity: jest.fn((handler) => {
          identityHandler = handler;
        }),
        error: jest.fn(),
      }));

      service.onModuleInit();

      const identityEvent: IdentityEvent = {
        id: 1,
        type: 'identity',
        did: 'did:plc:abc123',
        handle: 'test.bsky.social',
        isActive: true,
        status: 'active',
      };

      // Should not throw
      if (identityHandler !== undefined) {
        await expect(identityHandler(identityEvent)).resolves.not.toThrow();
      }
    });
  });

  describe('error handling', () => {
    it('should handle errors in record handler gracefully', async () => {
      mockPrismaService.user.findUnique.mockRejectedValue(
        new Error('DB error'),
      );

      let recordHandler: ((evt: RecordEvent) => Promise<void>) | undefined;
      (SimpleIndexer as jest.Mock).mockImplementation(() => ({
        record: jest.fn((handler) => {
          recordHandler = handler;
        }),
        identity: jest.fn(),
        error: jest.fn(),
      }));

      service.onModuleInit();

      const createEvent: RecordEvent = {
        id: 1,
        type: 'record',
        action: 'create',
        did: 'did:plc:abc123',
        rev: 'rev123',
        collection: 'app.opnshelf.movie',
        rkey: 'movie-123',
        record: {
          $type: 'app.opnshelf.movie',
          movieId: '123',
          source: 'tmdb',
          watchedAt: '2024-01-15T10:00:00Z',
          createdAt: '2024-01-15T10:00:00Z',
        },
        cid: 'cid123',
        live: true,
      };

      // Should not throw (errors are caught and logged)
      if (recordHandler !== undefined) {
        await expect(recordHandler(createEvent)).resolves.not.toThrow();
      }
    });

    it('should call error handler for TAP errors', () => {
      let errorHandler: ((err: Error) => void) | undefined;
      (SimpleIndexer as jest.Mock).mockImplementation(() => ({
        record: jest.fn(),
        identity: jest.fn(),
        error: jest.fn((handler) => {
          errorHandler = handler;
        }),
      }));

      service.onModuleInit();

      // Should not throw when error handler is called
      expect(() => {
        if (errorHandler) {
          errorHandler(new Error('Test error'));
        }
      }).not.toThrow();
    });
  });
});
