export function subscribeToNotifications(
  _userId: string,
  _callback: (payload: any) => void
): null {
  return null
}

export function subscribeToApplicationUpdates(
  _applicationId: string,
  _callback: (payload: any) => void
): null {
  return null
}

export function subscribeToUserApplications(
  _userId: string,
  _callback: (payload: any) => void
): null {
  return null
}

export function subscribeToQuotations(
  _userId: string,
  _callback: (payload: any) => void
): null {
  return null
}

export function subscribeToAllApplications(
  _callback: (payload: any) => void
): null {
  return null
}

export function subscribeToAllQuotations(
  _callback: (payload: any) => void
): null {
  return null
}

export function subscribeToPendingApprovalPayments(
  _callback: (payload: any) => void
): null {
  return null
}

export function subscribeToAllClients(
  _callback: (payload: any) => void
): null {
  return null
}

export function subscribeToCompilationJob(
  _jobId: string,
  _callback: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    new?: any
    old?: any
  }) => void
): null {
  return null
}

export function subscribeToApplicationTimelineSteps(
  _applicationId: string,
  _callback: (payload: any) => void
): null {
  return null
}

export function subscribeToApplicationPayments(
  _applicationId: string,
  _callback: (payload: any) => void
): null {
  return null
}

export function unsubscribe(_channel: any): void {
}
