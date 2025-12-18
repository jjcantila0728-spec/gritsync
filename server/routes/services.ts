import { Router, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (_req, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM services WHERE is_active = true ORDER BY service_name, state
    `);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/all', authenticateToken, requireAdmin, async (_req, res: Response) => {
  try {
    const result = await db.execute(sql`SELECT * FROM services ORDER BY service_name, state`);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/by-service-state', async (req, res: Response) => {
  try {
    const { service_name, state } = req.query;
    
    if (!service_name || !state) {
      return res.status(400).json({ error: 'service_name and state are required' });
    }
    
    const result = await db.execute(sql`
      SELECT * FROM services 
      WHERE service_name = ${service_name as string} 
      AND state = ${state as string}
      AND is_active = true
    `);
    
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/by-type', async (req, res: Response) => {
  try {
    const { serviceType, serviceState, paymentType } = req.query;
    
    const result = await db.execute(sql`SELECT * FROM services WHERE is_active = true`);
    const allServices = result.rows as any[];
    
    const matchingService = allServices.find((s: any) => {
      const matchesType = !serviceType || 
        s.service_name?.toLowerCase().includes((serviceType as string).toLowerCase()) || 
        s.name?.toLowerCase().includes((serviceType as string).toLowerCase());
      const matchesState = !serviceState || s.state === serviceState;
      const matchesPaymentType = !paymentType || s.payment_type === paymentType;
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
    const result = await db.execute(sql`SELECT * FROM services WHERE id = ${id}`);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, service_name, state, payment_type, line_items, total_full, total_step1, total_step2, tax_amount, tax_step1, tax_step2, is_active } = req.body;
    
    const result = await db.execute(sql`
      INSERT INTO services (id, name, service_name, state, payment_type, line_items, total_full, total_step1, total_step2, tax_amount, tax_step1, tax_step2, is_active, created_at, updated_at)
      VALUES (gen_random_uuid(), ${name || service_name}, ${service_name}, ${state}, ${payment_type}, ${JSON.stringify(line_items || [])}::jsonb, ${total_full || 0}, ${total_step1 || 0}, ${total_step2 || 0}, ${tax_amount || 0}, ${tax_step1 || 0}, ${tax_step2 || 0}, ${is_active ?? true}, NOW(), NOW())
      RETURNING *
    `);
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/create-or-update', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, service_name, state, payment_type, line_items, total_full, total_step1, total_step2, tax_amount, tax_step1, tax_step2 } = req.body;
    
    const existingResult = await db.execute(sql`
      SELECT id FROM services 
      WHERE service_name = ${service_name} 
      AND state = ${state} 
      AND payment_type = ${payment_type}
    `);
    
    if (existingResult.rows.length > 0) {
      const existingId = (existingResult.rows[0] as any).id;
      const result = await db.execute(sql`
        UPDATE services SET
          name = ${service_name + ' - ' + state},
          line_items = ${JSON.stringify(line_items || [])}::jsonb,
          total_full = ${total_full || 0},
          total_step1 = ${total_step1 || 0},
          total_step2 = ${total_step2 || 0},
          tax_amount = ${tax_amount || 0},
          tax_step1 = ${tax_step1 || 0},
          tax_step2 = ${tax_step2 || 0},
          updated_at = NOW()
        WHERE id = ${existingId}
        RETURNING *
      `);
      return res.json(result.rows[0]);
    }
    
    const result = await db.execute(sql`
      INSERT INTO services (id, name, service_name, state, payment_type, line_items, total_full, total_step1, total_step2, tax_amount, tax_step1, tax_step2, is_active, created_at, updated_at)
      VALUES (gen_random_uuid(), ${service_name + ' - ' + state}, ${service_name}, ${state}, ${payment_type}, ${JSON.stringify(line_items || [])}::jsonb, ${total_full || 0}, ${total_step1 || 0}, ${total_step2 || 0}, ${tax_amount || 0}, ${tax_step1 || 0}, ${tax_step2 || 0}, true, NOW(), NOW())
      RETURNING *
    `);
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, service_name, state, payment_type, line_items, total_full, total_step1, total_step2, tax_amount, tax_step1, tax_step2, is_active } = req.body;
    
    const result = await db.execute(sql`
      UPDATE services SET
        name = COALESCE(${name ?? null}, name),
        service_name = COALESCE(${service_name ?? null}, service_name),
        state = COALESCE(${state ?? null}, state),
        payment_type = COALESCE(${payment_type ?? null}, payment_type),
        line_items = COALESCE(${line_items ? JSON.stringify(line_items) : null}::jsonb, line_items),
        total_full = COALESCE(${total_full ?? null}, total_full),
        total_step1 = COALESCE(${total_step1 ?? null}, total_step1),
        total_step2 = COALESCE(${total_step2 ?? null}, total_step2),
        tax_amount = COALESCE(${tax_amount ?? null}, tax_amount),
        tax_step1 = COALESCE(${tax_step1 ?? null}, tax_step1),
        tax_step2 = COALESCE(${tax_step2 ?? null}, tax_step2),
        is_active = COALESCE(${is_active ?? null}, is_active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM services WHERE id = ${id}`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
