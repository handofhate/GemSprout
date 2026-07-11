export function familyPath(familyId: string): string {
  return `families/${familyId}`;
}

export function memberPath(familyId: string, memberId: string): string {
  return `${familyPath(familyId)}/members/${memberId}`;
}

export function completionPath(familyId: string, completionId: string): string {
  return `${familyPath(familyId)}/completions/${completionId}`;
}

export function chorePath(familyId: string, choreId: string): string {
  return `${familyPath(familyId)}/chores/${choreId}`;
}

export function prizePath(familyId: string, prizeId: string): string {
  return `${familyPath(familyId)}/prizes/${prizeId}`;
}

export function requestPath(familyId: string, requestId: string): string {
  return `${familyPath(familyId)}/requests/${requestId}`;
}

export function historyPath(familyId: string, historyId: string): string {
  return `${familyPath(familyId)}/history/${historyId}`;
}

export function operationPath(familyId: string, operationId: string): string {
  return `${familyPath(familyId)}/operations/${operationId}`;
}
