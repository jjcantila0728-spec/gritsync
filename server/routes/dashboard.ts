import { Router, Response } from 'express';
import { db } from '../db';
import { users, applications, applicationPayments, donations, careers, careerApplications, testimonials } from '../../shared/schema';
import { eq, desc, count, sql } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [userCount] = await db.select({ count: count() }).from(users);
    const [applicationCount] = await db.select({ count: count() }).from(applications);
    const [donationCount] = await db.select({ count: count() }).from(donations);
    const [careerCount] = await db.select({ count: count() }).from(careers);

    const pendingApps = await db.select({ count: count() }).from(applications)
      .where(eq(applications.status, 'pending'));

    const completedApps = await db.select({ count: count() }).from(applications)
      .where(eq(applications.status, 'completed'));

    const totalPayments = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(${applicationPayments.amount} AS DECIMAL)), 0)`
    }).from(applicationPayments)
      .where(eq(applicationPayments.status, 'paid'));

    const totalDonations = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(${donations.amount} AS DECIMAL)), 0)`
    }).from(donations)
      .where(eq(donations.status, 'completed'));

    res.json({
      totalUsers: userCount?.count || 0,
      totalApplications: applicationCount?.count || 0,
      pendingApplications: pendingApps[0]?.count || 0,
      completedApplications: completedApps[0]?.count || 0,
      totalDonations: donationCount?.count || 0,
      totalCareers: careerCount?.count || 0,
      totalRevenue: totalPayments[0]?.total || 0,
      totalDonationAmount: totalDonations[0]?.total || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recent-applications', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const recentApps = await db.select().from(applications)
      .orderBy(desc(applications.created_at))
      .limit(10);

    res.json(recentApps);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recent-users', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const recentUsers = await db.select({
      id: users.id,
      email: users.email,
      first_name: users.first_name,
      last_name: users.last_name,
      role: users.role,
      created_at: users.created_at,
    }).from(users)
      .orderBy(desc(users.created_at))
      .limit(10);

    res.json(recentUsers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/user-stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userApps = await db.select({ count: count() }).from(applications)
      .where(eq(applications.user_id, req.user!.id));

    const pendingApps = await db.select({ count: count() }).from(applications)
      .where(eq(applications.user_id, req.user!.id));

    res.json({
      totalApplications: userApps[0]?.count || 0,
      pendingApplications: pendingApps[0]?.count || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
