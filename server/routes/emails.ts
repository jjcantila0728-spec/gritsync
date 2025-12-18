import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { sendEmail, sendWelcomeEmail, sendApplicationStatusEmail, sendPaymentConfirmationEmail, sendQuotationEmail } from '../services/email';

const router = Router();

router.post('/send', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { to, subject, html, text } = req.body;
    
    if (!to || !subject) {
      return res.status(400).json({ error: 'Missing required fields: to, subject' });
    }
    
    const result = await sendEmail({ to, subject, html, text });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/welcome', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Missing required fields: email, name' });
    }
    
    const result = await sendWelcomeEmail(email, name);
    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/application-status', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, status, applicationId } = req.body;
    
    if (!email || !name || !status || !applicationId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await sendApplicationStatusEmail(email, name, status, applicationId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/payment-confirmation', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, amount, description } = req.body;
    
    if (!email || !name || !amount || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await sendPaymentConfirmationEmail(email, name, amount, description);
    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/quotation', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, quotationDetails } = req.body;
    
    if (!email || !name || !quotationDetails) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await sendQuotationEmail(email, name, quotationDetails);
    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
