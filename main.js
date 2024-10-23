import { SearchModule } from './modules/search.js';
import { DataFetcher } from './modules/dataFetcher.js';

class AutocompleteWidget {
    constructor() {
        this.input = document.getElementById('autocomplete-input');
        this.suggestionsList = document.getElementById('suggestions-list');
        this.loadingIndicator = document.getElementById('loading-indicator');
        this.selectedIndex = -1;
        this.settings = {};
        this.widgetContainer = document.getElementById('widget-container');
        
        this.init();
    }

    async init() {
        try {
            // Initialize JotForm widget
            JFCustomWidget.subscribe("ready", () => {
                this.loadSettings();
                this.setupEventListeners();
                this.initialFetch();
                this.resizeWidget();
            });

            // Handle form submission
            JFCustomWidget.subscribe("submit", () => {
                JFCustomWidget.sendSubmit({
                    valid: true,
                    value: this.input.value
                });
            });
        } catch (error) {
            console.error('Initialization failed:', error);
        }
    }

    loadSettings() {
        this.settings = {
            sheetId: JFCustomWidget.getWidgetSetting('googleSheetId'),
            columnIndex: parseInt(JFCustomWidget.getWidgetSetting('columnIndex')) || 0,
            maxResults: parseInt(JFCustomWidget.getWidgetSetting('maxResults')) || 5,
            minCharRequired: parseInt(JFCustomWidget.getWidgetSetting('minCharRequired')) || 3,
            placeholder: JFCustomWidget.getWidgetSetting('placeholderText') || 'Start typing...',
            threshold: parseFloat(JFCustomWidget.getWidgetSetting('threshold')) || 0.2,
            distance: parseInt(JFCustomWidget.getWidgetSetting('distance')) || 100,
            debounceTime: parseInt(JFCustomWidget.getWidgetSetting('debounceTime')) || 300,
            dynamicResize: JFCustomWidget.getWidgetSetting('dynamicResize') !== false
        };

        // Apply settings
        this.input.placeholder = this.settings.placeholder;
        
        // Apply width settings if provided
        const inputWidth = JFCustomWidget.getWidgetSetting('inputWidth');
        if (inputWidth) {
            this.input.style.width = inputWidth;
        }

        const listWidth = JFCustomWidget.getWidgetSetting('autocompleteWidth');
        if (listWidth) {
            this.suggestionsList.style.width = listWidth;
        }
    }

    setupEventListeners() {
        this.input.addEventListener('input', this.debounce(this.handleInput.bind(this), this.settings.debounceTime));
        this.input.addEventListener('keydown', this.handleKeydown.bind(this));
        document.addEventListener('click', this.handleClickOutside.bind(this));
        
        // Add resize observer to handle dynamic content changes
        if (this.settings.dynamicResize) {
            const resizeObserver = new ResizeObserver(this.debounce(() => {
                this.resizeWidget();
            }, 100));
            resizeObserver.observe(this.widgetContainer);
        }
    }

    resizeWidget() {
        if (!this.settings.dynamicResize) return;

        const height = this.calculateTotalHeight();
        JFCustomWidget.requestFrameResize({
            height: Math.ceil(height)
        });
    }

    calculateTotalHeight() {
        const styles = window.getComputedStyle(this.widgetContainer);
        const margins = parseFloat(styles.marginTop) + parseFloat(styles.marginBottom);
        
        let totalHeight = this.widgetContainer.offsetHeight + margins;

        // Add extra padding for suggestions list when visible
        if (this.suggestionsList.style.display === 'block') {
            totalHeight += this.suggestionsList.offsetHeight;
        }

        // Add error message height if visible
        const errorElement = document.getElementById('error-message');
        if (errorElement && errorElement.style.display !== 'none') {
            totalHeight += errorElement.offsetHeight;
        }

        // Add some buffer to prevent scrollbars
        return totalHeight + 10;
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async initialFetch() {
        try {
            this.showLoading();
            this.data = await DataFetcher.fetchFromSheet(this.settings.sheetId);
            this.hideLoading();
        } catch (error) {
            console.error('Initial fetch failed:', error);
            this.hideLoading();
            this.showError('Failed to load data. Please try again later.');
        }
    }

    showLoading() {
        this.loadingIndicator.style.display = 'block';
    }

    hideLoading() {
        this.loadingIndicator.style.display = 'none';
    }

    showError(message) {
        const errorElement = document.getElementById('error-message');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        this.resizeWidget();
    }

    hideError() {
        const errorElement = document.getElementById('error-message');
        errorElement.style.display = 'none';
        this.resizeWidget();
    }

    async handleInput(event) {
        const searchTerm = event.target.value.trim();
        this.hideError();
        
        if (searchTerm.length < this.settings.minCharRequired) {
            this.hideSuggestions();
            return;
        }

        try {
            if (!this.data) {
                this.showLoading();
                this.data = await DataFetcher.fetchFromSheet(this.settings.sheetId);
                this.hideLoading();
            }

            const matches = SearchModule.search(
                searchTerm,
                this.data,
                this.settings.columnIndex,
                this.settings.maxResults,
                this.settings.threshold,
                this.settings.distance
            );

            this.displaySuggestions(matches);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            this.hideLoading();
            this.showError('Failed to retrieve suggestions. Please try again.');
        }
    }

    displaySuggestions(matches) {
        if (matches.length === 0) {
            this.hideSuggestions();
            return;
        }

        this.suggestionsList.innerHTML = matches
            .map(({ original, highlighted }, index) => `
                <li role="option" 
                    id="suggestion-${index}"
                    class="suggestion-item ${index === 0 ? 'selected' : ''}"
                    tabindex="-1"
                    aria-selected="${index === 0}"
                >${highlighted}</li>
            `)
            .join('');

        this.suggestionsList.style.display = 'block';
        this.selectedIndex = 0;

        // Ensure first item is visible
        const firstItem = this.suggestionsList.querySelector('li');
        if (firstItem) {
            firstItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        this.addSuggestionClickHandlers();
        this.resizeWidget();
    }

    addSuggestionClickHandlers() {
        const items = this.suggestionsList.getElementsByTagName('li');
        Array.from(items).forEach(item => {
            item.addEventListener('click', () => {
                this.input.value = item.textContent.replace(/<\/?mark>/g, '');
                this.hideSuggestions();
                this.input.focus();
            });
        });
    }

    handleKeydown(event) {
        const items = this.suggestionsList.getElementsByTagName('li');
        if (!items.length) return;
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
                this.updateSelection(items);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
                this.updateSelection(items);
                break;
            case 'Enter':
                event.preventDefault();
                if (this.selectedIndex >= 0) {
                    this.input.value = items[this.selectedIndex].textContent.replace(/<\/?mark>/g, '');
                    this.hideSuggestions();
                }
                break;
            case 'Escape':
                this.hideSuggestions();
                break;
        }
    }

    updateSelection(items) {
        Array.from(items).forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
            item.setAttribute('aria-selected', index === this.selectedIndex);
            if (index === this.selectedIndex) {
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    handleClickOutside(event) {
        if (!this.input.contains(event.target) && !this.suggestionsList.contains(event.target)) {
            this.hideSuggestions();
        }
    }

    hideSuggestions() {
        this.suggestionsList.style.display = 'none';
        this.selectedIndex = -1;
        this.resizeWidget();
    }
}

// Initialize the widget
new AutocompleteWidget();