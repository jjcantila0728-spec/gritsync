import { Router, Request, Response } from 'express';
import { db } from '../db';
import { promoCodes } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

const router = Router();

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
