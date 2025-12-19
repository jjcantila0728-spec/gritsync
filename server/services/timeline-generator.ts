import { db } from '../db';
import { applicationTimelineSteps } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export interface TimelineStep {
  step_key: string;
  step_name: string;
  description?: string;
  order: number;
}

const NCLEX_TIMELINE_STEPS: TimelineStep[] = [
  { step_key: 'app_created', step_name: 'Application Created', order: 1 },
  { step_key: 'documents_collection', step_name: 'Documents Collection', description: 'Gather all required documents', order: 2 },
  { step_key: 'documents_review', step_name: 'Documents Review', description: 'Review and verify submitted documents', order: 3 },
  { step_key: 'cgfns_application', step_name: 'CGFNS Application', description: 'Apply to CGFNS for credential evaluation', order: 4 },
  { step_key: 'cgfns_processing', step_name: 'CGFNS Processing', description: 'CGFNS evaluating credentials', order: 5 },
  { step_key: 'cgfns_approval', step_name: 'CGFNS Approval', description: 'Credential evaluation approved', order: 6 },
  { step_key: 'bon_application', step_name: 'BON Application', description: 'Apply to Board of Nursing', order: 7 },
  { step_key: 'bon_processing', step_name: 'BON Processing', description: 'Board of Nursing reviewing application', order: 8 },
  { step_key: 'att_issued', step_name: 'ATT Issued', description: 'Authorization to Test received', order: 9 },
  { step_key: 'pearson_vue_registration', step_name: 'Pearson VUE Registration', description: 'Register for NCLEX exam at Pearson VUE', order: 10 },
  { step_key: 'exam_scheduled', step_name: 'Exam Scheduled', description: 'NCLEX exam date confirmed', order: 11 },
  { step_key: 'exam_taken', step_name: 'Exam Taken', description: 'NCLEX exam completed', order: 12 },
  { step_key: 'results_pending', step_name: 'Results Pending', description: 'Waiting for exam results', order: 13 },
  { step_key: 'results_received', step_name: 'Results Received', description: 'Exam results available', order: 14 },
  { step_key: 'license_issued', step_name: 'License Issued', description: 'RN License granted', order: 15 },
];

const EAD_TIMELINE_STEPS: TimelineStep[] = [
  { step_key: 'app_created', step_name: 'Application Created', order: 1 },
  { step_key: 'documents_collection', step_name: 'Documents Collection', description: 'Gather all required documents', order: 2 },
  { step_key: 'documents_review', step_name: 'Documents Review', description: 'Review and verify submitted documents', order: 3 },
  { step_key: 'i765_preparation', step_name: 'I-765 Preparation', description: 'Prepare Form I-765 application', order: 4 },
  { step_key: 'i765_filing', step_name: 'I-765 Filing', description: 'Submit Form I-765 to USCIS', order: 5 },
  { step_key: 'receipt_notice', step_name: 'Receipt Notice', description: 'I-797C Notice of Action received', order: 6 },
  { step_key: 'biometrics_scheduled', step_name: 'Biometrics Scheduled', description: 'Biometrics appointment scheduled', order: 7 },
  { step_key: 'biometrics_completed', step_name: 'Biometrics Completed', description: 'Fingerprints and photos taken', order: 8 },
  { step_key: 'case_review', step_name: 'Case Under Review', description: 'USCIS reviewing application', order: 9 },
  { step_key: 'card_production', step_name: 'Card Production', description: 'EAD card being produced', order: 10 },
  { step_key: 'card_mailed', step_name: 'Card Mailed', description: 'EAD card shipped via USPS', order: 11 },
  { step_key: 'card_received', step_name: 'Card Received', description: 'EAD card delivered', order: 12 },
];

const VISA_SCREEN_TIMELINE_STEPS: TimelineStep[] = [
  { step_key: 'app_created', step_name: 'Application Created', order: 1 },
  { step_key: 'documents_collection', step_name: 'Documents Collection', description: 'Gather all required documents', order: 2 },
  { step_key: 'documents_review', step_name: 'Documents Review', description: 'Review and verify submitted documents', order: 3 },
  { step_key: 'visascreen_application', step_name: 'VisaScreen Application', description: 'Apply for VisaScreen certificate', order: 4 },
  { step_key: 'cgfns_review', step_name: 'CGFNS Review', description: 'CGFNS reviewing credentials', order: 5 },
  { step_key: 'english_proficiency', step_name: 'English Proficiency', description: 'English exam scores verified', order: 6 },
  { step_key: 'license_verification', step_name: 'License Verification', description: 'Nursing license verified', order: 7 },
  { step_key: 'education_review', step_name: 'Education Review', description: 'Nursing education evaluated', order: 8 },
  { step_key: 'certificate_issued', step_name: 'Certificate Issued', description: 'VisaScreen certificate granted', order: 9 },
];

export function getTimelineStepsForServiceType(serviceType: string): TimelineStep[] {
  const normalizedType = serviceType.toLowerCase();
  
  if (normalizedType.includes('nclex') || normalizedType.includes('nursing')) {
    return NCLEX_TIMELINE_STEPS;
  }
  
  if (normalizedType.includes('ead') || normalizedType.includes('employment authorization')) {
    return EAD_TIMELINE_STEPS;
  }
  
  if (normalizedType.includes('visa') || normalizedType.includes('visascreen')) {
    return VISA_SCREEN_TIMELINE_STEPS;
  }
  
  return [
    { step_key: 'app_created', step_name: 'Application Created', order: 1 },
    { step_key: 'documents_collection', step_name: 'Documents Collection', order: 2 },
    { step_key: 'documents_review', step_name: 'Documents Review', order: 3 },
    { step_key: 'processing', step_name: 'Processing', order: 4 },
    { step_key: 'completed', step_name: 'Completed', order: 5 },
  ];
}

export async function generateTimelineForApplication(
  applicationId: string,
  serviceType: string
): Promise<void> {
  const steps = getTimelineStepsForServiceType(serviceType);
  
  const existingSteps = await db
    .select()
    .from(applicationTimelineSteps)
    .where(eq(applicationTimelineSteps.application_id, applicationId));
  
  const existingKeys = new Set(existingSteps.map(s => s.step_key));
  
  const stepsToInsert = steps
    .filter(step => !existingKeys.has(step.step_key))
    .map(step => ({
      application_id: applicationId,
      step_key: step.step_key,
      step_name: step.step_name,
      status: step.step_key === 'app_created' ? 'completed' : 'pending',
      data: step.description ? { description: step.description, order: step.order } : { order: step.order },
      completed_at: step.step_key === 'app_created' ? new Date() : null,
    }));
  
  if (stepsToInsert.length > 0) {
    await db.insert(applicationTimelineSteps).values(stepsToInsert);
  }
}

export { NCLEX_TIMELINE_STEPS, EAD_TIMELINE_STEPS, VISA_SCREEN_TIMELINE_STEPS };
