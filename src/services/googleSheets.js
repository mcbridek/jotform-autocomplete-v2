import { google } from 'googleapis';

const sheets = google.sheets({ version: 'v4' });

export async function getSheetData(spreadsheetId, range) {
  // Existing authentication code...

  const batchSize = 1000; // Adjust based on your needs
  let allRows = [];
  let startRow = 1;

  while (true) {
    const currentRange = `${range}!A${startRow}:Z${startRow + batchSize - 1}`;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: currentRange,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const rows = response.data.values || [];
    allRows = allRows.concat(rows);

    if (rows.length < batchSize) {
      break;
    }

    startRow += batchSize;
  }

  return allRows;
}

// Add a caching mechanism
const cache = new Map();
const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 minutes

export async function getCachedSheetData(spreadsheetId, range) {
  const cacheKey = `${spreadsheetId}:${range}`;
  const cachedData = cache.get(cacheKey);

  if (cachedData && Date.now() - cachedData.timestamp < CACHE_EXPIRATION) {
    return cachedData.data;
  }

  const data = await getSheetData(spreadsheetId, range);
  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
