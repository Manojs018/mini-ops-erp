import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../app';
import { prisma } from '../../config/prisma';

// Mock Prisma client so tests run deterministically without requiring a live PostgreSQL instance
jest.mock('../../config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Auth Module Integration Tests', () => {
  const testPassword = 'Password123!';
  const hashedPassword = bcrypt.hashSync(testPassword, 10);

  const mockAdminUser = {
    id: 'user-admin-id-123',
    name: 'System Admin',
    email: 'admin@minerp.local',
    passwordHash: hashedPassword,
    role: 'ADMIN',
    locationId: 'loc-a-123',
    createdAt: new Date(),
  };

  const mockOpsUser = {
    id: 'user-ops-id-456',
    name: 'Operations Manager',
    email: 'ops@minerp.local',
    passwordHash: hashedPassword,
    role: 'OPERATIONS',
    locationId: 'loc-a-123',
    createdAt: new Date(),
  };

  const mockSalesUser = {
    id: 'user-sales-id-789',
    name: 'Sales Representative',
    email: 'sales@minerp.local',
    passwordHash: hashedPassword,
    role: 'SALES',
    locationId: 'loc-b-456',
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    it('should successfully log in ADMIN user and return 200 + token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@minerp.local', password: testPassword });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        id: mockAdminUser.id,
        email: 'admin@minerp.local',
        role: 'ADMIN',
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should successfully log in OPERATIONS user and return 200 + token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser);

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'ops@minerp.local', password: testPassword });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        email: 'ops@minerp.local',
        role: 'OPERATIONS',
      });
    });

    it('should successfully log in SALES user and return 200 + token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser);

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'sales@minerp.local', password: testPassword });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        email: 'sales@minerp.local',
        role: 'SALES',
      });
    });

    it('should return 401 for wrong password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@minerp.local', password: 'WrongPassword!' });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe('Invalid credentials');
    });

    it('should return 401 for non-existent email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'nonexistent@minerp.local', password: testPassword });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe('Invalid credentials');
    });

    it('should return 400 for empty or invalid input', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: '', password: '' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /auth/me', () => {
    let adminToken: string;

    beforeEach(async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@minerp.local', password: testPassword });
      adminToken = res.body.token;
    });

    it('should return 200 + profile for valid token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        email: 'admin@minerp.local',
        role: 'ADMIN',
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should return 401 when no token is provided', async () => {
      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe('No authentication token provided');
    });

    it('should return 401 for garbage token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer garbage_token_12345');

      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe('Invalid or expired token');
    });
  });

  describe('GET /auth/admin-only (Role Authorization)', () => {
    let adminToken: string;
    let opsToken: string;
    let salesToken: string;

    beforeEach(async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);
      const adminRes = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@minerp.local', password: testPassword });
      adminToken = adminRes.body.token;

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser);
      const opsRes = await request(app)
        .post('/auth/login')
        .send({ email: 'ops@minerp.local', password: testPassword });
      opsToken = opsRes.body.token;

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser);
      const salesRes = await request(app)
        .post('/auth/login')
        .send({ email: 'sales@minerp.local', password: testPassword });
      salesToken = salesRes.body.token;
    });

    it('should allow access (200) for ADMIN role', async () => {
      const response = await request(app)
        .get('/auth/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Admin access granted');
    });

    it('should deny access (403) for OPERATIONS role', async () => {
      const response = await request(app)
        .get('/auth/admin-only')
        .set('Authorization', `Bearer ${opsToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Insufficient permissions');
    });

    it('should deny access (403) for SALES role', async () => {
      const response = await request(app)
        .get('/auth/admin-only')
        .set('Authorization', `Bearer ${salesToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Insufficient permissions');
    });
  });
});
