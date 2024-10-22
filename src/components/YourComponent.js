import { getCachedSheetData } from '../services/googleSheets';

// In your component or function
async function fetchData() {
  try {
    const data = await getCachedSheetData('your-spreadsheet-id', 'Sheet1');
    // Process the data...
  } catch (error) {
    console.error('Error fetching sheet data:', error);
  }
}
