export const DataFetcher = {
    async fetchFromSheet(sheetId) {
        if (!sheetId) {
            throw new Error('Sheet ID is required');
        }

        try {
            // Use the public CSV endpoint instead of JSON API
            const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'text/csv',
                },
                mode: 'cors',
                credentials: 'omit'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const csvText = await response.text();
            if (!csvText || csvText.trim() === '') {
                throw new Error('Empty response received');
            }
            
            // Parse CSV data
            const rows = csvText
                .split('\n')
                .map(row => row
                    .split(',')
                    .map(cell => cell
                        .replace(/^"|"$/g, '') // Remove quotes
                        .replace(/%20/g, ' ')  // Replace %20 with spaces
                        .trim()
                    )
                )
                .filter(row => row.length > 0 && row.some(cell => cell !== '')); // Remove empty rows
            
            if (!rows.length) {
                throw new Error('No valid rows found after processing');
            }
            
            return rows;
        } catch (error) {
            console.error('[DataFetcher] Error:', {
                message: error.message,
                sheetId,
                type: error.name,
                stack: error.stack
            });
            throw error;
        }
    }
};