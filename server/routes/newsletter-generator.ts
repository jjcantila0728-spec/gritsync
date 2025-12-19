import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { generateFullNewsletter, generateNewsletterContent, buildNewsletterHtml } from '../services/newsletter-generator';
import { sendNewsletterEmail } from '../services/email';
import { db } from '../db';
import { newsletterSubscriptions } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

router.post('/generate', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { topic, additionalContext, generateImages = true } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const newsletter = await generateFullNewsletter(topic, additionalContext, generateImages);
    res.json(newsletter);
  } catch (error: any) {
    console.error('Newsletter generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate newsletter' });
  }
});

router.post('/preview', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { topic, additionalContext } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const newsletter = await generateNewsletterContent(topic, additionalContext);
    const html = buildNewsletterHtml(newsletter);
    
    res.json({
      ...newsletter,
      html
    });
  } catch (error: any) {
    console.error('Newsletter preview error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate preview' });
  }
});

router.post('/send', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { subject, htmlContent, sendToAll = false, recipientEmails } = req.body;

    if (!subject || !htmlContent) {
      return res.status(400).json({ error: 'Subject and htmlContent are required' });
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
      message: `Newsletter sent to ${successCount} recipients.${failCount > 0 ? ` ${failCount} failed.` : ''}`,
      sent: successCount,
      failed: failCount,
      results
    });
  } catch (error: any) {
    console.error('Newsletter send error:', error);
    res.status(500).json({ error: error.message || 'Failed to send newsletter' });
  }
});

router.post('/generate-and-send', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { topic, additionalContext, generateImages = true, sendToAll = false, recipientEmails } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const newsletter = await generateFullNewsletter(topic, additionalContext, generateImages);

    let emails: string[] = recipientEmails || [];

    if (sendToAll) {
      const subscribers = await db.select().from(newsletterSubscriptions).where(eq(newsletterSubscriptions.is_active, true));
      emails = subscribers.map(s => s.email);
    }

    if (emails.length === 0) {
      return res.json({
        success: true,
        message: 'Newsletter generated but no recipients to send to',
        newsletter
      });
    }

    const results = await sendNewsletterEmail(emails, newsletter.subject, newsletter.html);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Newsletter generated and sent to ${successCount} recipients.${failCount > 0 ? ` ${failCount} failed.` : ''}`,
      newsletter,
      sent: successCount,
      failed: failCount
    });
  } catch (error: any) {
    console.error('Newsletter generate-and-send error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate and send newsletter' });
  }
});

export default router;
