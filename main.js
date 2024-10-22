// Utility function to get widget settings with default values
function getWidgetSetting(settingName, defaultValue, parseFunc = (val) => val) {
  const setting = JFCustomWidget.getWidgetSetting(settingName);
  return setting !== undefined && setting !== '' ? parseFunc(setting) : defaultValue;
}

// Fetch data from Google Sheet and store it in local storage to reduce fetches
async function fetchGoogleSheetData(sheetId) {
  const cacheKey = `googleSheetData_${sheetId}`;
  const cachedData = localStorage.getItem(cacheKey);

  if (cachedData) {
    return JSON.parse(cachedData);
  }

  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

  try {
    const response = await fetch(url);
    const csvText = await response.text();

    const rows = csvText
      .split('\n')
      .map(row => row.split(',').map(cell => cell.replace(/^"|"$/g, '')));

    // Cache the data for future use
    localStorage.setItem(cacheKey, JSON.stringify(rows));

    return rows;
  } catch (error) {
    console.error('Error fetching Google Sheet data:', error);
    return [];
  }
}

// Debounce function to limit the frequency of search operations
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Initialize the widget
JFCustomWidget.subscribe('ready', async function () {
  const input = document.getElementById('autocomplete-input');
  const suggestionsList = document.getElementById('suggestions-list');

  // Widget settings
  const sheetId = JFCustomWidget.getWidgetSetting('googleSheetId');
  const columnIndex = getWidgetSetting('columnIndex', 0, parseInt);
  const debounceTime = getWidgetSetting('debounceTime', 400, parseInt); // Slightly increased debounce time
  const maxResults = getWidgetSetting('maxResults', 5, parseInt);
  const minCharRequired = getWidgetSetting('minCharRequired', 3, parseInt);

  // Fetch data from Google Sheet
  const data = await fetchGoogleSheetData(sheetId);

  if (data.length > 0) {
    // Transform data into objects for Fuse.js
    const columnData = data.slice(1).map(row => ({ name: row[columnIndex] }));

    // Initialize Fuse.js for fuzzy searching
    const fuse = new Fuse(columnData, {
      shouldSort: true,
      threshold: 0.3, // Optimized for faster performance
      distance: 100,
      minMatchCharLength: minCharRequired,
      keys: ['name']
    });

    let selectedIndex = -1;

    // Add event listener to input with debouncing
    input.addEventListener('input', debounce(onInputChange, debounceTime));

    function onInputChange(e) {
      const searchTerm = e.target.value;

      if (searchTerm.length >= minCharRequired) {
        const results = fuse.search(searchTerm).slice(0, maxResults);
        displaySuggestions(results);
      } else {
        clearSuggestions();
      }

      // Send data on each input change
      JFCustomWidget.sendSubmit({ value: input.value, valid: true });
    }

    function clearSuggestions() {
      suggestionsList.style.display = 'none';
      suggestionsList.innerHTML = '';
    }

    function displaySuggestions(results) {
      suggestionsList.innerHTML = '';
      selectedIndex = -1;

      results.forEach((result, index) => {
        const li = document.createElement('li');
        li.innerHTML = result.item.name;
        li.setAttribute('role', 'option');
        li.setAttribute('id', `suggestion-${index}`);
        li.addEventListener('click', () => {
          input.value = result.item.name;
          clearSuggestions();
          JFCustomWidget.sendSubmit({ value: result.item.name, valid: true });
        });
        suggestionsList.appendChild(li);
      });

      suggestionsList.style.display = 'block';
    }

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
      const items = suggestionsList.getElementsByTagName('li');
      if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < items.length) {
        e.preventDefault();
        input.value = items[selectedIndex].textContent;
        clearSuggestions();
        JFCustomWidget.sendSubmit({ value: input.value, valid: true });
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (e.key === 'ArrowDown' && selectedIndex < items.length - 1) {
          selectedIndex++;
        } else if (e.key === 'ArrowUp' && selectedIndex > 0) {
          selectedIndex--;
        }
        updateSelection(items);
      }
    });

    function updateSelection(items) {
      Array.from(items).forEach((item, index) => {
        item.classList.toggle('selected', index === selectedIndex);
      });
    }
  }
});
