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
    
    if (id && !id.startsWith('svc_')) {
      const existingResult = await db.execute(sql`SELECT id FROM services WHERE id = ${id}`);
      if (existingResult.rows.length > 0) {
        const result = await db.execute(sql`
          UPDATE services SET
            service_name = ${service_name},
            name = ${service_name + ' - ' + state},
            state = ${state},
            payment_type = ${payment_type},
            line_items = ${JSON.stringify(line_items || [])}::jsonb,
            total_full = ${total_full || 0},
            total_step1 = ${total_step1 || 0},
            total_step2 = ${total_step2 || 0},
            tax_amount = ${tax_amount || 0},
            tax_step1 = ${tax_step1 || 0},
            tax_step2 = ${tax_step2 || 0},
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `);
        return res.json(result.rows[0]);
      }
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
    
    const updates: string[] = ['updated_at = NOW()'];
    
    if (name !== undefined) updates.push(`name = '${name}'`);
    if (service_name !== undefined) updates.push(`service_name = '${service_name}'`);
    if (state !== undefined) updates.push(`state = '${state}'`);
    if (payment_type !== undefined) updates.push(`payment_type = '${payment_type}'`);
    if (line_items !== undefined) updates.push(`line_items = '${JSON.stringify(line_items)}'::jsonb`);
    if (total_full !== undefined) updates.push(`total_full = ${total_full}`);
    if (total_step1 !== undefined) updates.push(`total_step1 = ${total_step1}`);
    if (total_step2 !== undefined) updates.push(`total_step2 = ${total_step2}`);
    if (tax_amount !== undefined) updates.push(`tax_amount = ${tax_amount}`);
    if (tax_step1 !== undefined) updates.push(`tax_step1 = ${tax_step1}`);
    if (tax_step2 !== undefined) updates.push(`tax_step2 = ${tax_step2}`);
    if (is_active !== undefined) updates.push(`is_active = ${is_active}`);
    
    const result = await db.execute(sql.raw(`
      UPDATE services SET ${updates.join(', ')} WHERE id = '${id}' RETURNING *
    `));
    
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
