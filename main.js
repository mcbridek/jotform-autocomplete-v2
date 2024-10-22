// Add this utility function at the top of the file
function getWidgetSetting(settingName, defaultValue, parseFunc = (val) => val) {
  const setting = JFCustomWidget.getWidgetSetting(settingName);
  return setting !== undefined && setting !== '' ? parseFunc(setting) : defaultValue;
}

// Function to fetch data from a public Google Sheet (CSV format)
async function fetchGoogleSheetData(sheetId) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

  try {
    const response = await fetch(url);
    const csvText = await response.text();

    const rows = csvText
      .split('\n')
      .map(row => row.split(',').map(cell => cell.replace(/^"|"$/g, '')));
    return rows;
  } catch (error) {
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

// Declare the input variable in the outer scope to make it accessible in the 'submit' event
let input;

// Initialize the widget when ready
JFCustomWidget.subscribe('ready', async function () {
  input = document.getElementById('autocomplete-input');
  const suggestionsList = document.getElementById('suggestions-list');

  // Get widget settings
  const sheetId = JFCustomWidget.getWidgetSetting('googleSheetId');
  const columnIndex = getWidgetSetting('columnIndex', 0, parseInt);
  const placeholderText = getWidgetSetting('placeholderText', 'Start typing...');
  const inputWidthSetting = getWidgetSetting('inputWidth', '100%');
  const autocompleteWidthSetting = getWidgetSetting('autocompleteWidth', '100%');
  const dynamicResize = getWidgetSetting('dynamicResize', true);
  const threshold = getWidgetSetting('threshold', 0.2, parseFloat);
  const distance = getWidgetSetting('distance', 100, parseInt);
  const maxResults = getWidgetSetting('maxResults', 5, parseInt);
  const minCharRequired = getWidgetSetting('minCharRequired', 3, parseInt);
  const debounceTime = getWidgetSetting('debounceTime', 300, parseInt);

  // Apply width settings
  input.style.width = inputWidthSetting;
  suggestionsList.style.width = autocompleteWidthSetting;

  // Set the placeholder text
  input.placeholder = placeholderText;

  // Add ARIA attributes
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-haspopup', 'listbox');
  suggestionsList.setAttribute('role', 'listbox');

  // Fetch data from Google Sheets
  const data = await fetchGoogleSheetData(sheetId);

  if (data.length > 0) {
    // Transform data into objects with 'name' property
    const columnData = data.slice(1).map(row => ({ name: row[columnIndex] }));

    // Set up Fuse.js for fuzzy searching
    const options = {
      shouldSort: true,
      threshold: threshold,
      distance: distance,
      minMatchCharLength: minCharRequired,
      keys: ['name'],
      includeScore: true,
      includeMatches: true
    };
    const fuse = new Fuse(columnData, options);

    let selectedIndex = -1;
    const searchCache = {};

    // Adjust iframe height on window resize (optional)
    window.addEventListener('resize', adjustIframeHeight);

    // Add event listener to the input with debounce
    input.addEventListener('input', debounce(onInputChange, debounceTime));

    function onInputChange(e) {
      const searchTerm = e.target.value;
      if (searchTerm.length >= minCharRequired) {
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

    function clearSuggestions() {
      suggestionsList.style.display = 'none';
      suggestionsList.innerHTML = '';
      adjustIframeHeight();
    }

    function displaySuggestions(results) {
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
  } else {
    console.error('No data retrieved from Google Sheet.');
  }
});

// Subscribe to the 'submit' event
JFCustomWidget.subscribe('submit', function () {
  // Send the current input value when the form is submitted
  JFCustomWidget.sendSubmit({ value: input.value, valid: true });
});