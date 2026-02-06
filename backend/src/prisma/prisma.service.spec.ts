import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client';
import { PrismaService } from './prisma.service';

// Mock the PrismaPg adapter
jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(function (config: {
    connectionString: string;
  }) {
    this.connectionString = config.connectionString;
  }),
}));

// Mock PrismaClient to avoid actual database connection
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

jest.mock('../generated/client', () => ({
  PrismaClient: jest.fn().mockImplementation(function (config: {
    adapter: unknown;
  }) {
    this.adapter = config.adapter;
    this.$connect = mockConnect;
    this.$disconnect = mockDisconnect;
    this.user = {};
    this.movie = {};
    this.trackedMovie = {};
    this.authSession = {};
    this.authState = {};
  }),
}));

describe('PrismaService', () => {
  // Save original env
  const originalEnv = process.env.DATABASE_URL;

  beforeAll(() => {
    // Set test database URL
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
  });

  afterAll(() => {
    // Restore original env
    process.env.DATABASE_URL = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create PrismaPg adapter with DATABASE_URL', () => {
      new PrismaService();

      expect(PrismaPg).toHaveBeenCalledWith({
        connectionString: 'postgres://test:test@localhost:5432/test',
      });
    });

    it('should create PrismaClient with adapter', () => {
      new PrismaService();

      expect(PrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          adapter: expect.any(Object),
        }),
      );
    });
  });

  describe('onModuleInit', () => {
    it('should call $connect on module init', async () => {
      const service = new PrismaService();
      // Override the mock $connect on this instance
      service.$connect = jest.fn().mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(service.$connect).toHaveBeenCalled();
    });
  });

  describe('inheritance', () => {
    it('should inherit $connect method', () => {
      const service = new PrismaService();
      expect(typeof service.$connect).toBe('function');
    });

    it('should inherit $disconnect method', () => {
      const service = new PrismaService();
      expect(typeof service.$disconnect).toBe('function');
    });

    it('should inherit user model', () => {
      const service = new PrismaService();
      expect(service).toHaveProperty('user');
    });

    it('should inherit movie model', () => {
      const service = new PrismaService();
      expect(service).toHaveProperty('movie');
    });

    it('should inherit trackedMovie model', () => {
      const service = new PrismaService();
      expect(service).toHaveProperty('trackedMovie');
    });

    it('should inherit authSession model', () => {
      const service = new PrismaService();
      expect(service).toHaveProperty('authSession');
    });

    it('should inherit authState model', () => {
      const service = new PrismaService();
      expect(service).toHaveProperty('authState');
    });
  });
});
