export type RequestHistoryAction = 'approve' | 'deny';
export type RequestOperationAction = RequestHistoryAction | 'cancel';

export function requestHistoryId(requestId: string, action: RequestHistoryAction): string {
  if (!requestId) throw new Error('requestId is required');
  return `history:request:${requestId}:${action}`;
}

export function requestOperationId(requestId: string, action: RequestOperationAction): string {
  if (!requestId) throw new Error('requestId is required');
  return `op:request:${action}:${requestId}`;
}
