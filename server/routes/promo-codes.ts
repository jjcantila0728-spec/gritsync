import { Router, Request, Response } from 'express';
import { db } from '../db';
import { promoCodes } from '../../shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const allPromoCodes = await db.select().from(promoCodes).orderBy(desc(promoCodes.created_at));
    res.json(allPromoCodes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [promoCode] = await db.insert(promoCodes).values({
      ...req.body,
      code: req.body.code.toUpperCase(),
    }).returning();
    res.status(201).json(promoCode);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const [updated] = await db.update(promoCodes)
      .set({ ...req.body, updated_at: new Date() })
      .where(eq(promoCodes.id, id))
      .returning();
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(promoCodes).where(eq(promoCodes.id, id));
    res.json({ message: 'Promo code deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { code, amount, serviceFeeAmount } = req.body;
    
    if (!code) {
      return res.json({ valid: false, error: 'Promo code is required' });
    }
    
    const now = new Date();
    const [promo] = await db
      .select()
      .from(promoCodes)
      .where(
        and(
          eq(promoCodes.code, code.toUpperCase()),
          eq(promoCodes.is_active, true)
        )
      )
      .limit(1);
    
    if (!promo) {
      return res.json({ valid: false, error: 'Invalid promo code' });
    }
    
    if (promo.valid_until && new Date(promo.valid_until) < now) {
      return res.json({ valid: false, error: 'Promo code has expired' });
    }
    
    if (promo.max_uses && promo.current_uses && promo.current_uses >= promo.max_uses) {
      return res.json({ valid: false, error: 'Promo code usage limit reached' });
    }
    
    const baseAmount = serviceFeeAmount || amount || 0;
    let discountAmount = 0;
    const discountValue = parseFloat(promo.discount_value);
    
    if (promo.discount_type === 'percentage') {
      discountAmount = (baseAmount * (discountValue / 100));
    } else {
      discountAmount = Math.min(discountValue, baseAmount);
    }
    
    discountAmount = Math.round(discountAmount * 100) / 100;
    
    res.json({
      valid: true,
      discount_amount: discountAmount,
      discount_type: promo.discount_type,
      discount_value: discountValue,
      code: promo.code,
      promo_id: promo.id
    });
  } catch (error) {
    console.error('Error validating promo code:', error);
    res.status(500).json({ valid: false, error: 'Failed to validate promo code' });
  }
});

router.post('/use', async (req: Request, res: Response) => {
  try {
    const { promoId } = req.body;
    
    if (!promoId) {
      return res.status(400).json({ error: 'Promo ID is required' });
    }
    
    await db
      .update(promoCodes)
      .set({ current_uses: sql`COALESCE(${promoCodes.current_uses}, 0) + 1` })
      .where(eq(promoCodes.id, promoId));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error using promo code:', error);
    res.status(500).json({ error: 'Failed to use promo code' });
  }
});

export default router;
