import { Router, Response } from 'express';
import { db } from '../db';
import { settings, exchangeRates, services, promoCodes } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (_req, res: Response) => {
  try {
    const allSettings = await db.select().from(settings);
    const settingsMap: Record<string, string | null> = {};
    allSettings.forEach(s => {
      settingsMap[s.key] = s.value;
    });
    res.json(settingsMap);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:key', async (req, res: Response) => {
  try {
    const { key } = req.params;
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    res.json(setting || { key, value: null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key, value, description } = req.body;

    const [existing] = await db.select().from(settings).where(eq(settings.key, key));

    if (existing) {
      const [updated] = await db.update(settings)
        .set({ value, description, updated_at: new Date() })
        .where(eq(settings.key, key))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(settings).values({ key, value, description }).returning();
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/exchange-rates', async (_req, res: Response) => {
  try {
    const rates = await db.select().from(exchangeRates)
      .where(eq(exchangeRates.is_active, true))
      .orderBy(desc(exchangeRates.created_at));
    res.json(rates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/exchange-rates', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rate] = await db.insert(exchangeRates).values(req.body).returning();
    res.status(201).json(rate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/services', async (_req, res: Response) => {
  try {
    const allServices = await db.select().from(services)
      .where(eq(services.is_active, true))
      .orderBy(desc(services.created_at));
    res.json(allServices);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/services', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [service] = await db.insert(services).values(req.body).returning();
    res.status(201).json(service);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/promo-codes', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const codes = await db.select().from(promoCodes).orderBy(desc(promoCodes.created_at));
    res.json(codes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/promo-codes', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [code] = await db.insert(promoCodes).values(req.body).returning();
    res.status(201).json(code);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/promo-codes/validate', async (req, res: Response) => {
  try {
    const { code } = req.body;
    const [promoCode] = await db.select().from(promoCodes).where(eq(promoCodes.code, code));

    if (!promoCode) {
      return res.status(404).json({ error: 'Invalid promo code' });
    }

    if (!promoCode.is_active) {
      return res.status(400).json({ error: 'Promo code is no longer active' });
    }

    if (promoCode.max_uses && promoCode.current_uses && promoCode.current_uses >= promoCode.max_uses) {
      return res.status(400).json({ error: 'Promo code has reached its usage limit' });
    }

    res.json(promoCode);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
