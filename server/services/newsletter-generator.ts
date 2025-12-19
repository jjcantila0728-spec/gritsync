import OpenAI from 'openai';
import { generateImageBuffer } from '../replit_integrations/image';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface NewsletterSection {
  heading: string;
  content: string;
  imagePrompt?: string;
  imageBase64?: string;
}

interface GeneratedNewsletter {
  subject: string;
  preheader: string;
  sections: NewsletterSection[];
  html: string;
}

export async function generateNewsletterContent(topic: string, additionalContext?: string): Promise<GeneratedNewsletter> {
  const prompt = `Create a professional newsletter for GritSync, a company helping Filipino nurses achieve their USRN dreams through NCLEX processing and sponsorships.

Topic: ${topic}
${additionalContext ? `Additional context: ${additionalContext}` : ''}

Generate a newsletter with:
1. An engaging subject line
2. A short preheader (50-100 characters)
3. 3-4 sections, each with:
   - A heading
   - Content (2-3 paragraphs)
   - An image prompt for AI image generation (describe a professional, uplifting image related to nursing/healthcare/career success)

Respond in JSON format:
{
  "subject": "string",
  "preheader": "string",
  "sections": [
    {
      "heading": "string",
      "content": "string (HTML formatted with <p> tags)",
      "imagePrompt": "string (detailed description for image generation)"
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content || '{}';
  const newsletter = JSON.parse(content);

  return {
    subject: newsletter.subject || 'GritSync Newsletter',
    preheader: newsletter.preheader || '',
    sections: newsletter.sections || [],
    html: '',
  };
}

export async function generateNewsletterImages(sections: NewsletterSection[]): Promise<NewsletterSection[]> {
  const sectionsWithImages: NewsletterSection[] = [];

  for (const section of sections) {
    if (section.imagePrompt) {
      try {
        const imageBuffer = await generateImageBuffer(
          `${section.imagePrompt}. Professional, high-quality, suitable for a business newsletter about nursing and healthcare careers.`,
          '512x512'
        );
        sectionsWithImages.push({
          ...section,
          imageBase64: imageBuffer.toString('base64'),
        });
      } catch (error) {
        console.error('Failed to generate image for section:', section.heading, error);
        sectionsWithImages.push(section);
      }
    } else {
      sectionsWithImages.push(section);
    }
  }

  return sectionsWithImages;
}

export function buildNewsletterHtml(newsletter: { subject: string; preheader: string; sections: NewsletterSection[] }): string {
  const sectionHtml = newsletter.sections.map(section => `
    <tr>
      <td style="padding: 0 40px 30px;">
        ${section.imageBase64 ? `
        <img src="data:image/png;base64,${section.imageBase64}" 
             alt="${section.heading}" 
             style="width: 100%; max-width: 520px; height: auto; border-radius: 8px; margin-bottom: 20px; display: block;" />
        ` : ''}
        <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px; font-weight: 600;">${section.heading}</h2>
        <div style="color: #374151; font-size: 16px; line-height: 1.6;">
          ${section.content}
        </div>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${newsletter.subject}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .content-table { width: 100% !important; }
      .content-td { padding: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5;">
  <span class="preheader">${newsletter.preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="content-table" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); padding: 40px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">GritSync</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Achieve Your American Dream</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color: #ffffff; padding-top: 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${sectionHtml}
              </table>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="background-color: #ffffff; padding: 20px 40px 40px; text-align: center;">
              <a href="${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}" 
                 style="display: inline-block; background-color: #DC2626; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Visit GritSync
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">GritSync - Your NCLEX Processing Partner</p>
              <p style="margin: 0 0 16px; color: #9ca3af; font-size: 12px;">Helping Filipino nurses achieve their US nursing dreams</p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                <a href="${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/newsletter/unsubscribe" 
                   style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function generateFullNewsletter(topic: string, additionalContext?: string, generateImages = true): Promise<GeneratedNewsletter> {
  const newsletter = await generateNewsletterContent(topic, additionalContext);
  
  if (generateImages) {
    newsletter.sections = await generateNewsletterImages(newsletter.sections);
  }
  
  newsletter.html = buildNewsletterHtml(newsletter);
  
  return newsletter;
}
