import { Router, Response } from 'express';
import { db } from '../db';
import { services } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (_req, res: Response) => {
  try {
    const allServices = await db
      .select()
      .from(services)
      .where(eq(services.is_active, true));
    res.json(allServices);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/all', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const allServices = await db.select().from(services);
    res.json(allServices);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/by-type', async (req, res: Response) => {
  try {
    const { serviceType, serviceState, paymentType } = req.query;
    
    const allServices = await db.select().from(services).where(eq(services.is_active, true));
    
    const matchingService = allServices.find((s: any) => {
      const metadata = s.metadata || {};
      const matchesType = !serviceType || s.name?.toLowerCase().includes((serviceType as string).toLowerCase()) || s.category?.toLowerCase().includes((serviceType as string).toLowerCase());
      const matchesState = !serviceState || metadata.state === serviceState || metadata.states?.includes(serviceState);
      const matchesPaymentType = !paymentType || metadata.payment_type === paymentType || metadata.paymentType === paymentType;
      return matchesType && matchesState && matchesPaymentType;
    });
    
    if (!matchingService) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json(matchingService);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res: Response) => {
  try {
    const { id } = req.params;
    const [service] = await db.select().from(services).where(eq(services.id, id));
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(service);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, category, base_price_usd, base_price_php, is_active, metadata } = req.body;
    const [newService] = await db.insert(services).values({
      name,
      description,
      category,
      base_price_usd,
      base_price_php,
      is_active: is_active ?? true,
      metadata: metadata ?? {},
    }).returning();
    res.status(201).json(newService);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, category, base_price_usd, base_price_php, is_active, metadata } = req.body;
    
    const updateData: any = { updated_at: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (base_price_usd !== undefined) updateData.base_price_usd = base_price_usd;
    if (base_price_php !== undefined) updateData.base_price_php = base_price_php;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (metadata !== undefined) updateData.metadata = metadata;
    
    const [updated] = await db.update(services)
      .set(updateData)
      .where(eq(services.id, id))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(services).where(eq(services.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
