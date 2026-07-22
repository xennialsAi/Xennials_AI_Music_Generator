export interface MeetSpace {
  name: string; // resource name, e.g., "spaces/abc-defg-hij"
  meetingUri: string; // The join link, e.g., "https://meet.google.com/abc-defg-hij"
  meetingCode: string; // e.g., "abc-defg-hij"
  config?: {
    accessType?: 'ACCESS_TYPE_UNSPECIFIED' | 'OPEN' | 'TRUSTED' | 'RESTRICTED';
    entryRestriction?: 'ENTRY_RESTRICTION_UNSPECIFIED' | 'ALL' | 'HOST_ALLOWED_ONLY';
  };
}

/**
 * Creates a new Google Meet space
 */
export async function createMeetSpace(
  accessToken: string,
  accessType: 'OPEN' | 'TRUSTED' | 'RESTRICTED' = 'OPEN'
): Promise<MeetSpace> {
  const url = 'https://meet.googleapis.com/v2/spaces';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      config: {
        accessType: accessType
      }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Failed to create Meet Space: ${response.status}`);
  }

  return await response.json();
}

/**
 * Retrieves an existing Google Meet space
 */
export async function getMeetSpace(accessToken: string, spaceIdOrName: string): Promise<MeetSpace> {
  // spaceIdOrName can be "abc-defg-hij" or "spaces/abc-defg-hij"
  const formattedName = spaceIdOrName.startsWith('spaces/') ? spaceIdOrName : `spaces/${spaceIdOrName}`;
  const url = `https://meet.googleapis.com/v2/${formattedName}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Failed to get Meet Space: ${response.status}`);
  }

  return await response.json();
}

/**
 * Updates meeting space configuration
 */
export async function updateMeetSpaceConfig(
  accessToken: string,
  spaceName: string,
  accessType: 'OPEN' | 'TRUSTED' | 'RESTRICTED',
  entryRestriction: 'ALL' | 'HOST_ALLOWED_ONLY' = 'ALL'
): Promise<MeetSpace> {
  const url = `https://meet.googleapis.com/v2/${spaceName}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      config: {
        accessType,
        entryRestriction
      }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Failed to update Meet Space: ${response.status}`);
  }

  return await response.json();
}
