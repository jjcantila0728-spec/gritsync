import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { sendEmail, sendWelcomeEmail, sendApplicationStatusEmail, sendPaymentConfirmationEmail, sendQuotationEmail, sendTestEmail, sendNewsletterEmail, sendDonationReceiptEmail } from '../services/email';
import { db } from '../db';
import { newsletterSubscriptions } from '../../shared/schema';
import { eq } from 'drizzle-orm';

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

router.post('/test', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, subject } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Missing required field: email' });
    }
    
    const result = await sendTestEmail(email, subject);
    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/donation-receipt', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, amount, donationId } = req.body;
    
    if (!email || !name || !amount || !donationId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await sendDonationReceiptEmail(email, name, amount, donationId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/newsletter/send', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { subject, htmlContent, sendToAll, recipientEmails } = req.body;
    
    if (!subject || !htmlContent) {
      return res.status(400).json({ error: 'Missing required fields: subject, htmlContent' });
    }
    
    let emails: string[] = recipientEmails || [];
    
    if (sendToAll) {
      const subscribers = await db.select().from(newsletterSubscriptions).where(eq(newsletterSubscriptions.is_active, true));
      emails = subscribers.map(s => s.email);
    }
    
    if (emails.length === 0) {
      return res.status(400).json({ error: 'No recipients found' });
    }
    
    const results = await sendNewsletterEmail(emails, subject, htmlContent);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      message: `Newsletter sent to ${successCount} recipients. ${failCount > 0 ? `${failCount} failed.` : ''}`,
      results
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
