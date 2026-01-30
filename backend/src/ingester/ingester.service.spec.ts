import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

// Mock PrismaService before importing
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

// Mock @atproto modules
jest.mock('@atproto/sync', () => ({
  Firehose: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@atproto/identity', () => ({
  IdResolver: jest.fn().mockImplementation(() => ({
    resolve: jest.fn(),
  })),
}));

import { IngesterService } from './ingester.service';
import { PrismaService } from '../prisma/prisma.service';
import { Firehose } from '@atproto/sync';

type FirehoseEvent = {
  event: string;
  collection: string;
  record?: {
    $type: string;
    movieId?: string;
    source?: string;
    watchedAt?: string;
    createdAt?: string;
  };
  uri: {
    toString: () => string;
  };
  rkey: string;
  cid?: { toString: () => string };
  author?: string;
};

type HandleEventCallback = (event: FirehoseEvent) => Promise<void>;
type OnErrorCallback = (err: { message: string }) => void;

describe('IngesterService', () => {
  let service: IngesterService;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockFirehoseInstance: { start: jest.Mock; destroy: jest.Mock };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'ATPROTO_RELAY_URL') return 'wss://test.relay';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFirehoseInstance = {
      start: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    (Firehose as jest.Mock).mockImplementation(() => mockFirehoseInstance);

    mockPrismaService = {
      user: {
        findUnique: jest.fn(),
      },
      trackedMovie: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngesterService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<IngesterService>(IngesterService);
  });

  describe('onModuleInit', () => {
    it('should start the firehose ingester', async () => {
      service.onModuleInit();
      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(Firehose).toHaveBeenCalledWith(
        expect.objectContaining({
          filterCollections: ['app.opnshelf.movie'],
        }),
      );
      expect(mockFirehoseInstance.start).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should stop the firehose ingester', async () => {
      service.onModuleInit();
      await new Promise((resolve) => setTimeout(resolve, 10));

      service.onModuleDestroy();

      expect(mockFirehoseInstance.destroy).toHaveBeenCalled();
    });

    it('should handle destroy when firehose is not initialized', () => {
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });

  describe('handleEvent - create', () => {
    it('should upsert tracked movie for existing user', async () => {
      const mockUser = { did: 'did:plc:abc123', handle: 'test.bsky.social' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrismaService.trackedMovie.upsert.mockResolvedValue({} as any);

      const createEvent = {
        event: 'create',
        collection: 'app.opnshelf.movie',
        record: {
          $type: 'app.opnshelf.movie',
          movieId: '123',
          source: 'tmdb',
          watchedAt: '2024-01-15T10:00:00Z',
          createdAt: '2024-01-15T10:00:00Z',
        },
        uri: {
          toString: () => 'at://did:plc:abc123/app.opnshelf.movie/movie-123',
        },
        rkey: 'movie-123',
        cid: { toString: () => 'cid123' },
        author: 'did:plc:abc123',
      };

      // Trigger the handleEvent through the Firehose constructor callback
      let handleEventCallback: HandleEventCallback | undefined;
      (Firehose as jest.Mock).mockImplementation((config: any) => {
        handleEventCallback = config.handleEvent;
        return mockFirehoseInstance;
      });

      service.onModuleInit();
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (handleEventCallback) {
        await handleEventCallback(createEvent);
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

      const createEvent = {
        event: 'create',
        collection: 'app.opnshelf.movie',
        record: {
          $type: 'app.opnshelf.movie',
          movieId: '123',
          source: 'tmdb',
          watchedAt: '2024-01-15T10:00:00Z',
          createdAt: '2024-01-15T10:00:00Z',
        },
        uri: {
          toString: () => 'at://did:plc:unknown/app.opnshelf.movie/movie-123',
        },
        rkey: 'movie-123',
        cid: { toString: () => 'cid123' },
        author: 'did:plc:unknown',
      };

      let handleEventCallback: HandleEventCallback | undefined;
      (Firehose as jest.Mock).mockImplementation((config: any) => {
        handleEventCallback = config.handleEvent;
        return mockFirehoseInstance;
      });

      service.onModuleInit();
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (handleEventCallback) {
        await handleEventCallback(createEvent);
      }

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { did: 'did:plc:unknown' },
      });
      expect(mockPrismaService.trackedMovie.upsert).not.toHaveBeenCalled();
    });

    it('should skip invalid movie records', async () => {
      const createEvent = {
        event: 'create',
        collection: 'app.opnshelf.movie',
        record: {
          $type: 'app.opnshelf.movie',
          // Missing required fields
        },
        uri: {
          toString: () => 'at://did:plc:abc123/app.opnshelf.movie/movie-123',
        },
        rkey: 'movie-123',
        cid: { toString: () => 'cid123' },
        author: 'did:plc:abc123',
      };

      let handleEventCallback: HandleEventCallback | undefined;
      (Firehose as jest.Mock).mockImplementation((config: any) => {
        handleEventCallback = config.handleEvent;
        return mockFirehoseInstance;
      });

      service.onModuleInit();
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (handleEventCallback) {
        await handleEventCallback(createEvent);
      }

      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.trackedMovie.upsert).not.toHaveBeenCalled();
    });

    it('should skip events for other collections', async () => {
      const createEvent = {
        event: 'create',
        collection: 'app.bsky.feed.post',
        record: { $type: 'app.bsky.feed.post' },
        uri: { toString: () => 'at://did:plc:abc123/app.bsky.feed.post/abc' },
        rkey: 'abc',
        cid: { toString: () => 'cid123' },
        author: 'did:plc:abc123',
      };

      let handleEventCallback: HandleEventCallback | undefined;
      (Firehose as jest.Mock).mockImplementation((config: any) => {
        handleEventCallback = config.handleEvent;
        return mockFirehoseInstance;
      });

      service.onModuleInit();
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (handleEventCallback) {
        await handleEventCallback(createEvent);
      }

      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should extract DID from URI when author is not provided', async () => {
      const mockUser = { did: 'did:plc:abc123', handle: 'test.bsky.social' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrismaService.trackedMovie.upsert.mockResolvedValue({} as any);

      const createEvent = {
        event: 'create',
        collection: 'app.opnshelf.movie',
        record: {
          $type: 'app.opnshelf.movie',
          movieId: '456',
          source: 'tmdb',
          watchedAt: '2024-01-15T10:00:00Z',
          createdAt: '2024-01-15T10:00:00Z',
        },
        uri: {
          toString: () => 'at://did:plc:abc123/app.opnshelf.movie/movie-456',
        },
        rkey: 'movie-456',
        cid: { toString: () => 'cid456' },
        // No author field
      };

      let handleEventCallback: HandleEventCallback | undefined;
      (Firehose as jest.Mock).mockImplementation((config: any) => {
        handleEventCallback = config.handleEvent;
        return mockFirehoseInstance;
      });

      service.onModuleInit();
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (handleEventCallback) {
        await handleEventCallback(createEvent);
      }

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { did: 'did:plc:abc123' },
      });
    });

    it('should skip when author cannot be determined', async () => {
      const createEvent = {
        event: 'create',
        collection: 'app.opnshelf.movie',
        record: {
          $type: 'app.opnshelf.movie',
          movieId: '123',
          source: 'tmdb',
          watchedAt: '2024-01-15T10:00:00Z',
          createdAt: '2024-01-15T10:00:00Z',
        },
        uri: { toString: () => 'invalid-uri' },
        rkey: 'movie-123',
        cid: { toString: () => 'cid123' },
        // No author field and invalid URI
      };

      let handleEventCallback: HandleEventCallback | undefined;
      (Firehose as jest.Mock).mockImplementation((config: any) => {
        handleEventCallback = config.handleEvent;
        return mockFirehoseInstance;
      });

      service.onModuleInit();
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (handleEventCallback) {
        await handleEventCallback(createEvent);
      }

      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('handleEvent - update', () => {
    it('should handle update events same as create', async () => {
      const mockUser = { did: 'did:plc:abc123', handle: 'test.bsky.social' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrismaService.trackedMovie.upsert.mockResolvedValue({} as any);

      const updateEvent = {
        event: 'update',
        collection: 'app.opnshelf.movie',
        record: {
          $type: 'app.opnshelf.movie',
          movieId: '789',
          source: 'tmdb',
          watchedAt: '2024-02-20T15:30:00Z',
          createdAt: '2024-01-15T10:00:00Z',
        },
        uri: {
          toString: () => 'at://did:plc:abc123/app.opnshelf.movie/movie-789',
        },
        rkey: 'movie-789',
        cid: { toString: () => 'cid789-updated' },
        author: 'did:plc:abc123',
      };

      let handleEventCallback: HandleEventCallback | undefined;
      (Firehose as jest.Mock).mockImplementation((config: any) => {
        handleEventCallback = config.handleEvent;
        return mockFirehoseInstance;
      });

      service.onModuleInit();
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (handleEventCallback) {
        await handleEventCallback(updateEvent);
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

  describe('handleEvent - delete', () => {
    it('should delete tracked movie record', async () => {
      mockPrismaService.trackedMovie.deleteMany.mockResolvedValue({
        count: 1,
      } as any);

      const deleteEvent = {
        event: 'delete',
        collection: 'app.opnshelf.movie',
        uri: {
          toString: () => 'at://did:plc:abc123/app.opnshelf.movie/movie-123',
        },
        rkey: 'movie-123',
        author: 'did:plc:abc123',
      };

      let handleEventCallback: HandleEventCallback | undefined;
      (Firehose as jest.Mock).mockImplementation((config: any) => {
        handleEventCallback = config.handleEvent;
        return mockFirehoseInstance;
      });

      service.onModuleInit();
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (handleEventCallback) {
        await handleEventCallback(deleteEvent);
      }

      expect(mockPrismaService.trackedMovie.deleteMany).toHaveBeenCalledWith({
        where: { uri: 'at://did:plc:abc123/app.opnshelf.movie/movie-123' },
      });
    });

    it('should skip delete events for other collections', async () => {
      const deleteEvent = {
        event: 'delete',
        collection: 'app.bsky.feed.post',
        uri: { toString: () => 'at://did:plc:abc123/app.bsky.feed.post/abc' },
        rkey: 'abc',
        author: 'did:plc:abc123',
      };

      let handleEventCallback: HandleEventCallback | undefined;
      (Firehose as jest.Mock).mockImplementation((config: any) => {
        handleEventCallback = config.handleEvent;
        return mockFirehoseInstance;
      });

      service.onModuleInit();
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (handleEventCallback) {
        await handleEventCallback(deleteEvent);
      }

      expect(mockPrismaService.trackedMovie.deleteMany).not.toHaveBeenCalled();
    });

    it('should skip delete when URI is missing', async () => {
      const deleteEvent = {
        event: 'delete',
        collection: 'app.opnshelf.movie',
        // No uri field
        rkey: 'movie-123',
        author: 'did:plc:abc123',
      };

      let handleEventCallback: HandleEventCallback | undefined;
      (Firehose as jest.Mock).mockImplementation((config: any) => {
        handleEventCallback = config.handleEvent;
        return mockFirehoseInstance;
      });

      service.onModuleInit();
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (handleEventCallback) {
        await handleEventCallback(deleteEvent);
      }

      expect(mockPrismaService.trackedMovie.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle errors in event handler gracefully', async () => {
      mockPrismaService.user.findUnique.mockRejectedValue(
        new Error('DB error'),
      );

      const createEvent = {
        event: 'create',
        collection: 'app.opnshelf.movie',
        record: {
          $type: 'app.opnshelf.movie',
          movieId: '123',
          source: 'tmdb',
          watchedAt: '2024-01-15T10:00:00Z',
          createdAt: '2024-01-15T10:00:00Z',
        },
        uri: {
          toString: () => 'at://did:plc:abc123/app.opnshelf.movie/movie-123',
        },
        rkey: 'movie-123',
        cid: { toString: () => 'cid123' },
        author: 'did:plc:abc123',
      };

      let handleEventCallback: HandleEventCallback | undefined;
      (Firehose as jest.Mock).mockImplementation((config: any) => {
        handleEventCallback = config.handleEvent;
        return mockFirehoseInstance;
      });

      service.onModuleInit();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not throw
      if (handleEventCallback) {
        await expect(handleEventCallback(createEvent)).resolves.not.toThrow();
      }
    });

    it('should call onError callback for firehose errors', async () => {
      let onErrorCallback: OnErrorCallback | undefined;
      (Firehose as jest.Mock).mockImplementation((config: any) => {
        onErrorCallback = config.onError;
        return mockFirehoseInstance;
      });

      service.onModuleInit();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not throw when onError is called
      if (onErrorCallback) {
        expect(() => onErrorCallback({ message: 'Test error' })).not.toThrow();
      }
    });
  });
});
