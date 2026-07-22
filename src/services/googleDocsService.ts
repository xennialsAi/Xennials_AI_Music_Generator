export interface GoogleDocFile {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink?: string;
}

/**
 * Extracts plain text content from a Google Doc structure
 */
export function extractTextFromDoc(doc: any): string {
  if (!doc || !doc.body || !doc.body.content) return '';
  let text = '';
  for (const element of doc.body.content) {
    if (element.paragraph && element.paragraph.elements) {
      for (const run of element.paragraph.elements) {
        if (run.textRun && run.textRun.content) {
          text += run.textRun.content;
        }
      }
    }
  }
  return text;
}

/**
 * Lists the user's Google Docs from Drive
 */
export async function listGoogleDocs(accessToken: string, search?: string): Promise<GoogleDocFile[]> {
  let query = "mimeType='application/vnd.google-apps.document' and trashed = false";
  if (search && search.trim() !== '') {
    // Escape single quotes for drive query parameter safety
    const safeSearch = search.replace(/'/g, "\\'");
    query += ` and name contains '${safeSearch}'`;
  }

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,webViewLink)&pageSize=25`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Failed to list files: ${response.status}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Imports a specific Google Doc's content and returns its plain text
 */
export async function importGoogleDoc(accessToken: string, documentId: string): Promise<string> {
  const url = `https://docs.googleapis.com/v1/documents/${documentId}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Failed to retrieve Google Doc: ${response.status}`);
  }

  const doc = await response.json();
  return extractTextFromDoc(doc);
}

/**
 * Creates a Google Doc and inserts lyrics content
 */
export async function exportToGoogleDoc(
  accessToken: string,
  title: string,
  content: string
): Promise<{ documentId: string; url: string }> {
  // 1. Create document
  const createUrl = 'https://docs.googleapis.com/v1/documents';
  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title })
  });

  if (!createResponse.ok) {
    const errData = await createResponse.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Failed to create Google Doc: ${createResponse.status}`);
  }

  const doc = await createResponse.json();
  const documentId = doc.documentId;
  const webUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  // 2. Insert content
  if (content && content.trim() !== '') {
    const updateUrl = `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`;
    const updateResponse = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              text: content,
              location: {
                index: 1
              }
            }
          }
        ]
      })
    });

    if (!updateResponse.ok) {
      const errData = await updateResponse.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Failed to insert text: ${updateResponse.status}`);
    }
  }

  return { documentId, url: webUrl };
}
