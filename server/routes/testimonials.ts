import { Router, Request, Response } from 'express';
import { db } from '../db';
import { testimonials } from '../../shared/schema';
import { eq, desc, or } from 'drizzle-orm';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    
    let query;
    if (status && typeof status === 'string') {
      query = db.select().from(testimonials)
        .where(eq(testimonials.status, status))
        .orderBy(desc(testimonials.created_at));
    } else {
      query = db.select().from(testimonials)
        .where(or(
          eq(testimonials.status, 'approved'),
          eq(testimonials.status, 'featured')
        ))
        .orderBy(desc(testimonials.created_at));
    }
    
    const result = await query;
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/all', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const allTestimonials = await db.select().from(testimonials).orderBy(desc(testimonials.created_at));
    res.json(allTestimonials);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [testimonial] = await db.select().from(testimonials).where(eq(testimonials.id, id));

    if (!testimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    res.json(testimonial);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const [testimonial] = await db.insert(testimonials).values({
      ...req.body,
      status: 'pending',
    }).returning();

    res.status(201).json(testimonial);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const updateData: any = {
      ...req.body,
      updated_at: new Date(),
    };
    
    if (req.body.status === 'approved' || req.body.status === 'featured') {
      updateData.approved_by = req.user?.id;
      updateData.approved_at = new Date();
    }

    const [updated] = await db.update(testimonials)
      .set(updateData)
      .where(eq(testimonials.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(testimonials).where(eq(testimonials.id, id));
    res.json({ message: 'Testimonial deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
