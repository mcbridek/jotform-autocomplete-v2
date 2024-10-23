# Google Sheets Autocomplete Widget

A lightweight, efficient autocomplete widget that fetches and searches data from Google Sheets.

## Features

- Fast, client-side searching
- Keyboard navigation support
- Error handling with user feedback
- Efficient data caching
- Responsive design
- Accessibility support

## Usage

1. Configure your Google Sheet:
   - Make sure your sheet is publicly accessible for reading
   - Get your sheet ID from the URL

2. Update the settings in `main.js`:
   ```js
   this.settings = {
       sheetId: 'YOUR_SHEET_ID',
       columnIndex: 1, // Zero-based index of the column to search
       maxResults: 5,  // Maximum number of suggestions to show
       minCharRequired: 2 // Minimum characters before showing suggestions
   };
   ```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```