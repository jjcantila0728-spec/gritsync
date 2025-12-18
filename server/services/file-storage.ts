import { google } from 'googleapis';
import { Readable } from 'stream';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Drive not connected');
  }
  return accessToken;
}

async function getUncachableGoogleDriveClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

const GRITSYNC_FOLDER_NAME = 'GritSync_Documents';

async function getOrCreateAppFolder(): Promise<string> {
  const drive = await getUncachableGoogleDriveClient();
  
  const response = await drive.files.list({
    q: `name='${GRITSYNC_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    spaces: 'drive',
    fields: 'files(id, name)',
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id!;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: GRITSYNC_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  return folder.data.id!;
}

async function getUserFolder(userId: string): Promise<string> {
  const drive = await getUncachableGoogleDriveClient();
  const appFolderId = await getOrCreateAppFolder();
  
  const folderName = `user_${userId}`;
  
  const response = await drive.files.list({
    q: `name='${folderName}' and '${appFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    spaces: 'drive',
    fields: 'files(id, name)',
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id!;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [appFolderId],
    },
    fields: 'id',
  });

  return folder.data.id!;
}

export interface UploadResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  webViewLink?: string;
  error?: string;
}

export async function uploadFile(
  userId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<UploadResult> {
  try {
    const drive = await getUncachableGoogleDriveClient();
    const userFolderId = await getUserFolder(userId);
    
    const stream = new Readable();
    stream.push(fileBuffer);
    stream.push(null);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [userFolderId],
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: 'id, name, mimeType, webViewLink',
    });

    return {
      success: true,
      fileId: response.data.id!,
      fileName: response.data.name!,
      mimeType: response.data.mimeType!,
      webViewLink: response.data.webViewLink ?? undefined,
    };
  } catch (error: any) {
    console.error('File upload error:', error.message);
    return { success: false, error: error.message };
  }
}

export async function getFileDownloadUrl(fileId: string): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const drive = await getUncachableGoogleDriveClient();
    
    const file = await drive.files.get({
      fileId,
      fields: 'webContentLink, webViewLink',
    });

    return {
      success: true,
      url: file.data.webContentLink || file.data.webViewLink || undefined,
    };
  } catch (error: any) {
    console.error('Get file URL error:', error.message);
    return { success: false, error: error.message };
  }
}

export async function downloadFile(fileId: string): Promise<{ success: boolean; data?: Buffer; mimeType?: string; error?: string }> {
  try {
    const drive = await getUncachableGoogleDriveClient();
    
    const response = await drive.files.get({
      fileId,
      alt: 'media',
    }, { responseType: 'arraybuffer' });

    return {
      success: true,
      data: Buffer.from(response.data as ArrayBuffer),
      mimeType: response.headers['content-type'],
    };
  } catch (error: any) {
    console.error('File download error:', error.message);
    return { success: false, error: error.message };
  }
}

export async function deleteFile(fileId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const drive = await getUncachableGoogleDriveClient();
    
    await drive.files.delete({ fileId });
    
    return { success: true };
  } catch (error: any) {
    console.error('File delete error:', error.message);
    return { success: false, error: error.message };
  }
}

export async function listUserFiles(userId: string): Promise<{ success: boolean; files?: any[]; error?: string }> {
  try {
    const drive = await getUncachableGoogleDriveClient();
    const userFolderId = await getUserFolder(userId);
    
    const response = await drive.files.list({
      q: `'${userFolderId}' in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)',
    });

    return {
      success: true,
      files: response.data.files || [],
    };
  } catch (error: any) {
    console.error('List files error:', error.message);
    return { success: false, error: error.message };
  }
}
