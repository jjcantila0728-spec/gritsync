import { Router, Request, Response } from 'express';
import { db } from '../db';
import { newsletterSubscriptions } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const subscriptions = await db.select().from(newsletterSubscriptions).orderBy(desc(newsletterSubscriptions.created_at));
    res.json(subscriptions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { email, subscription_type = 'visa_bulletin' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const existingSubscription = await db.select().from(newsletterSubscriptions)
      .where(eq(newsletterSubscriptions.email, email.toLowerCase()));

    if (existingSubscription.length > 0) {
      if (existingSubscription[0].is_active) {
        return res.status(409).json({ error: 'This email is already subscribed' });
      }
      
      const [reactivated] = await db.update(newsletterSubscriptions)
        .set({
          is_active: true,
          unsubscribed_at: null,
          updated_at: new Date(),
        })
        .where(eq(newsletterSubscriptions.email, email.toLowerCase()))
        .returning();

      return res.json({ message: 'Subscription reactivated successfully', subscription: reactivated });
    }

    const [subscription] = await db.insert(newsletterSubscriptions).values({
      email: email.toLowerCase(),
      subscription_type,
      is_active: true,
    }).returning();

    res.status(201).json({ message: 'Successfully subscribed to newsletter', subscription });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const [updated] = await db.update(newsletterSubscriptions)
      .set({
        is_active: false,
        unsubscribed_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(newsletterSubscriptions.email, email.toLowerCase()))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({ message: 'Successfully unsubscribed from newsletter' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;

    if (!email) {
      return res.status(400).json({ error: 'Email query parameter is required' });
    }

    const [subscription] = await db.select().from(newsletterSubscriptions)
      .where(eq(newsletterSubscriptions.email, email.toLowerCase()));

    if (!subscription) {
      return res.json({ is_active: false, subscribed: false });
    }

    res.json(subscription);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/subscribers', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const type = req.query.type as string;
    
    let subscriptions;
    if (type) {
      subscriptions = await db.select().from(newsletterSubscriptions)
        .where(eq(newsletterSubscriptions.subscription_type, type))
        .orderBy(desc(newsletterSubscriptions.created_at));
    } else {
      subscriptions = await db.select().from(newsletterSubscriptions)
        .orderBy(desc(newsletterSubscriptions.created_at));
    }
    
    res.json(subscriptions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
