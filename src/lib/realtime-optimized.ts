export function subscribeToMultipleEvents(
  _channelName: string,
  _subscriptions: Array<{
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
    schema: string
    table: string
    filter?: string
    callback: (payload: any) => void
  }>
): null {
  return null
}

export function subscribeToAdminDashboard(
  _callbacks: {
    onApplicationUpdate: (payload: any) => void
    onQuotationUpdate: (payload: any) => void
    onPaymentUpdate: (payload: any) => void
  }
): null {
  return null
}

export function subscribeToClientDashboard(
  _userId: string,
  _callbacks: {
    onApplicationUpdate: (payload: any) => void
    onQuotationUpdate: (payload: any) => void
  }
): null {
  return null
}

export function subscribeToApplicationDetail(
  _applicationId: string,
  _callbacks: {
    onApplicationUpdate: (payload: any) => void
    onTimelineUpdate: (payload: any) => void
    onPaymentUpdate: (payload: any) => void
  }
): null {
  return null
}

export function unsubscribe(_channel: any): void {
}

export function unsubscribeAll(_channels: any[]): void {
}
