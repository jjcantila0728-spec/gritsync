import { Router, Request, Response } from 'express';
import { db } from '../db';
import { donations, nclexSponsorships } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

const router = Router();

router.get('/public-stats', async (_req: Request, res: Response) => {
  try {
    const allDonations = await db.select().from(donations);
    const totalDonated = allDonations.reduce((sum, d) => sum + parseFloat(d.amount?.toString() || '0'), 0);
    const totalDonors = allDonations.length;
    
    res.json({
      totalDonated,
      totalDonors,
      goal: 50000,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const allDonations = await db.select().from(donations).orderBy(desc(donations.created_at));
    res.json(allDonations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const [donation] = await db.select().from(donations).where(eq(donations.id, id));

    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    res.json(donation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { first_name, last_name, email, phone, amount, currency, payment_method, is_anonymous, message, sponsorship_id } = req.body;
    
    const donor_name = first_name && last_name 
      ? `${first_name} ${last_name}` 
      : req.body.donor_name || req.body.name;
    
    const [donation] = await db.insert(donations).values({
      donor_name: is_anonymous ? null : donor_name,
      donor_email: is_anonymous ? null : (email || req.body.donor_email),
      donor_phone: is_anonymous ? null : (phone || req.body.donor_phone),
      is_anonymous: is_anonymous || false,
      amount,
      currency: currency || 'USD',
      payment_method,
      message,
      sponsorship_id,
      status: 'pending',
    }).returning();
    
    res.status(201).json(donation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [updated] = await db.update(donations)
      .set({ ...req.body, updated_at: new Date() })
      .where(eq(donations.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sponsorships', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const sponsorships = await db.select().from(nclexSponsorships).orderBy(desc(nclexSponsorships.created_at));
    res.json(sponsorships);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sponsorships', async (req: Request, res: Response) => {
  try {
    const [sponsorship] = await db.insert(nclexSponsorships).values(req.body).returning();
    res.status(201).json(sponsorship);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/sponsorships/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [updated] = await db.update(nclexSponsorships)
      .set({ ...req.body, updated_at: new Date() })
      .where(eq(nclexSponsorships.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/payment-intent', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      metadata: {
        donation_id: id,
        type: 'donation',
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
