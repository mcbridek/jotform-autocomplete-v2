// Add this utility function at the top of the file
const isLoggingEnabled = true; // Set to false to disable logging

function logAction(message, ...optionalParams) {
  if (isLoggingEnabled) {
    console.log(message, ...optionalParams);
  }
}

// Update existing console.log calls to use logAction
logAction('Widget script loaded');

// Add this utility function at the top of the file
function getWidgetSetting(settingName, parseFunc = (val) => val) {
  const setting = JFCustomWidget.getWidgetSetting(settingName);
  logAction(`Getting widget setting: ${settingName}`, setting);
  if (setting !== undefined && setting !== '') {
    return parseFunc(setting);
  } else {
    // If the setting is not provided, use the default from widget.json
    const defaultValue = JFCustomWidget.getWidgetSetting(`options.${settingName}.default`);
    logAction(`Using default value for ${settingName}:`, defaultValue);
    return defaultValue !== undefined ? parseFunc(defaultValue) : undefined;
  }
}

// Function to fetch data from a public Google Sheet (CSV format)
async function fetchGoogleSheetData(sheetId, columnIndex, maxRows = 1000) {
  logAction('Fetching Google Sheet data with ID:', sheetId);
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

  try {
    const response = await fetch(url);
    logAction('Response received:', response);
    const csvText = await response.text();
    logAction('CSV text:', csvText);

    const rows = csvText
      .split('\n')
      .slice(0, maxRows + 1)
      .map(row => row.split(',').map(cell => cell.replace(/^"|"$/g, '')));

    // Extract data from the specified column
    const data = rows.slice(1).map(row => row[columnIndex] || '').filter(Boolean);
    logAction('Processed data from column:', columnIndex, data);
    return data;
  } catch (error) {
    console.error('Error fetching Google Sheet data:', error);
    return [];
  }
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Declare variables in the outer scope
let input;
let suggestionsList;
let fuse;
let isDataLoaded = false;

// Initialize the widget when ready
JFCustomWidget.subscribe('ready', async function () {
  logAction('Widget ready event fired');

  input = document.getElementById('autocomplete-input');
  suggestionsList = document.getElementById('suggestions-list');

  if (!input || !suggestionsList) {
    console.error('Could not find input or suggestions list elements');
    return;
  }

  // Get widget settings
  const sheetId = getWidgetSetting('googleSheetId');
  const columnIndex = getWidgetSetting('columnIndex', parseInt);
  const placeholderText = getWidgetSetting('placeholderText');
  const inputWidthSetting = getWidgetSetting('inputWidth');
  const autocompleteWidthSetting = getWidgetSetting('autocompleteWidth');
  const dynamicResize = getWidgetSetting('dynamicResize', val => val === 'true');
  const threshold = getWidgetSetting('threshold', parseFloat);
  const distance = getWidgetSetting('distance', parseInt);
  const maxResults = getWidgetSetting('maxResults', parseInt);
  const minCharRequired = getWidgetSetting('minCharRequired', parseInt);
  const debounceTime = getWidgetSetting('debounceTime', parseInt);
  const maxRows = getWidgetSetting('maxRows', parseInt);

  logAction('Widget settings:', {
    sheetId,
    columnIndex,
    placeholderText,
    inputWidthSetting,
    autocompleteWidthSetting,
    dynamicResize,
    threshold,
    distance,
    maxResults,
    minCharRequired,
    debounceTime,
    maxRows
  });

  // Apply width settings
  input.style.width = inputWidthSetting;
  suggestionsList.style.width = autocompleteWidthSetting;

  // Set the placeholder text
  input.placeholder = placeholderText;
  logAction('Placeholder text set:', input.placeholder);

  // Add ARIA attributes
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-haspopup', 'listbox');
  suggestionsList.setAttribute('role', 'listbox');

  // Add event listener to the input with debounce
  input.addEventListener('input', debounce(onInputChange, debounceTime));

  async function onInputChange(e) {
    const searchTerm = e.target.value;
    logAction('Input changed:', searchTerm);
    
    if (searchTerm.length >= 2 && !isDataLoaded) {
      logAction('Attempting to load Google Sheet data...');
      await loadGoogleSheetData();
    }

    if (searchTerm.length >= minCharRequired && isDataLoaded) {
      if (searchCache[searchTerm]) {
        displaySuggestions(searchCache[searchTerm]);
      } else {
        const results = fuse.search(searchTerm);
        searchCache[searchTerm] = results;
        displaySuggestions(results);
      }
    } else {
      clearSuggestions();
    }
    JFCustomWidget.sendSubmit({ value: input.value, valid: true });
  }

  async function loadGoogleSheetData() {
    logAction('Loading Google Sheet data...');
    logAction('Sheet ID:', sheetId);
    logAction('Max Rows:', maxRows);

    // Show loading indicator
    input.placeholder = "Loading data...";
    input.disabled = true;

    try {
      const data = await fetchGoogleSheetData(sheetId, columnIndex, maxRows);
      logAction('Fetched data:', data);

      if (data.length > 0) {
        // Set up Fuse.js for fuzzy searching
        const options = {
          shouldSort: true,
          threshold: threshold,
          distance: distance,
          minMatchCharLength: minCharRequired,
          keys: ['name']
        };
        fuse = new Fuse(data.map(item => ({ name: item })), options);
        isDataLoaded = true;
        logAction('Fuse.js initialized with', data.length, 'items');
      } else {
        console.error('No data retrieved from Google Sheet.');
      }
    } catch (error) {
      console.error('Error loading Google Sheet data:', error);
    }

    // Remove loading indicator
    input.placeholder = placeholderText;
    input.disabled = false;
  }

  let selectedIndex = -1;
  const searchCache = {};

  // Adjust iframe height on window resize (optional)
  window.addEventListener('resize', adjustIframeHeight);

  function clearSuggestions() {
    logAction('Clearing suggestions');
    suggestionsList.style.display = 'none';
    suggestionsList.innerHTML = '';
    adjustIframeHeight();
  }

  function displaySuggestions(results) {
    logAction('Displaying suggestions:', results);
    const suggestions = results
      .sort((a, b) => a.score - b.score)
      .slice(0, maxResults);

    // Clear previous suggestions
    suggestionsList.innerHTML = '';
    selectedIndex = -1;

    // Populate suggestions
    suggestions.forEach((suggestion, index) => {
      const li = document.createElement('li');
      li.innerHTML = highlightMatch(suggestion);
      li.setAttribute('role', 'option');
      li.setAttribute('id', `suggestion-${index}`);
      li.addEventListener('click', () => {
        input.value = suggestion.item.name;
        suggestionsList.innerHTML = ''; // Clear suggestions
        suggestionsList.style.display = 'none';
        JFCustomWidget.sendSubmit({ value: suggestion.item.name, valid: true });
        adjustIframeHeight(); // Adjust iframe height
      });
      suggestionsList.appendChild(li);
    });

    suggestionsList.style.display = 'block';
    adjustIframeHeight();
  }

  function highlightMatch(result) {
    const { item, matches } = result;
    let highlighted = item.name;
    if (matches && matches.length > 0) {
      matches.forEach(match => {
        const indices = match.indices;
        let offset = 0;
        indices.forEach(([start, end]) => {
          const before = highlighted.slice(0, start + offset);
          const matchText = highlighted.slice(start + offset, end + offset + 1);
          const after = highlighted.slice(end + offset + 1);
          highlighted = `${before}<mark>${matchText}</mark>${after}`;
          offset += '<mark></mark>'.length;
        });
      });
    }
    return highlighted;
  }

  input.addEventListener('keydown', (e) => {
    const items = suggestionsList.getElementsByTagName('li');
    if (e.key === 'Enter') {
      e.preventDefault();
      if (items.length > 0 && selectedIndex >= 0 && selectedIndex < items.length) {
        // Suggestion selected
        input.value = items[selectedIndex].textContent;
      }
      // Clear suggestions
      suggestionsList.innerHTML = '';
      suggestionsList.style.display = 'none';
      JFCustomWidget.sendSubmit({ value: input.value, valid: true });
      adjustIframeHeight(); // Adjust iframe height
    } else if (items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectedIndex < items.length - 1) {
          selectedIndex++;
          updateSelection(items);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedIndex > 0) {
          selectedIndex--;
          updateSelection(items);
        }
      }
    }
  });

  function updateSelection(items) {
    logAction('Updating selection');
    Array.from(items).forEach((item, index) => {
      item.classList.toggle('selected', index === selectedIndex);
      if (index === selectedIndex) {
        item.setAttribute('aria-selected', 'true');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.removeAttribute('aria-selected');
      }
    });
  }

  // Adjust height when the suggestions list is shown or hidden
  input.addEventListener('focus', adjustIframeHeight);
  input.addEventListener('blur', () => {
    // Delay to allow click events on suggestions to process
    setTimeout(() => {
      suggestionsList.style.display = 'none';
      suggestionsList.innerHTML = '';
      JFCustomWidget.sendSubmit({ value: input.value, valid: true });
      adjustIframeHeight();
    }, 100);
  });

  function adjustIframeHeight() {
    logAction('Adjusting iframe height');
    if (dynamicResize) {
      const inputHeight = input.offsetHeight;
      let totalHeight = inputHeight;

      if (suggestionsList.style.display === 'block' && suggestionsList.childElementCount > 0) {
        const suggestionsHeight = suggestionsList.scrollHeight;
        totalHeight += suggestionsHeight;
      }

      totalHeight += 20; // Additional padding if needed

      // Request iframe resize with correct parameter
      JFCustomWidget.requestFrameResize({ height: totalHeight });
    } else {
      // Use fixed height
      JFCustomWidget.requestFrameResize({ height: 250 }); // Set to desired fixed height
    }
  }

  // Initial iframe height adjustment
  adjustIframeHeight();
});

// Subscribe to the 'submit' event
JFCustomWidget.subscribe('submit', function () {
  logAction('Form submitted');
  // Send the current input value when the form is submitted
  JFCustomWidget.sendSubmit({ value: input.value, valid: true });
});

alert('JavaScript is running');
logAction('Widget script loaded');
