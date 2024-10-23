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
                this.adjustIframeHeight();
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
        const getWidgetSetting = (settingName, defaultValue, parseFunc = (val) => val) => {
            const setting = JFCustomWidget.getWidgetSetting(settingName);
            return setting !== undefined && setting !== '' ? parseFunc(setting) : defaultValue;
        };

        this.settings = {
            sheetId: getWidgetSetting('googleSheetId', ''),
            columnIndex: getWidgetSetting('columnIndex', 0, parseInt),
            maxResults: getWidgetSetting('maxResults', 5, parseInt),
            minCharRequired: getWidgetSetting('minCharRequired', 3, parseInt),
            placeholder: getWidgetSetting('placeholderText', 'Start typing...'),
            threshold: getWidgetSetting('threshold', 0.2, parseFloat),
            distance: getWidgetSetting('distance', 100, parseInt),
            debounceTime: getWidgetSetting('debounceTime', 300, parseInt),
            dynamicResize: getWidgetSetting('dynamicResize', true, Boolean),
            inputWidth: getWidgetSetting('inputWidth', '100%'),
            autocompleteWidth: getWidgetSetting('autocompleteWidth', '100%')
        };

        // Apply settings
        this.input.placeholder = this.settings.placeholder;
        
        // Apply width settings
        if (this.settings.inputWidth) {
            this.input.style.width = this.settings.inputWidth;
        }
        if (this.settings.autocompleteWidth) {
            this.suggestionsList.style.width = this.settings.autocompleteWidth;
        }
    }

    setupEventListeners() {
        this.input.addEventListener('input', this.debounce(this.handleInput.bind(this), this.settings.debounceTime));
        this.input.addEventListener('keydown', this.handleKeydown.bind(this));
        this.input.addEventListener('focus', () => this.adjustIframeHeight());
        this.input.addEventListener('blur', () => {
            setTimeout(() => {
                this.hideSuggestions();
                this.adjustIframeHeight();
            }, 100);
        });
        document.addEventListener('click', this.handleClickOutside.bind(this));
        
        // Add resize observer
        if (this.settings.dynamicResize) {
            const resizeObserver = new ResizeObserver(this.debounce(() => {
                this.adjustIframeHeight();
            }, 100));
            resizeObserver.observe(this.widgetContainer);
        }

        // Handle window resize
        window.addEventListener('resize', this.debounce(() => {
            this.adjustIframeHeight();
        }, 100));
    }

    adjustIframeHeight() {
        if (!this.settings.dynamicResize) {
            JFCustomWidget.requestFrameResize({ height: 250 });
            return;
        }

        let totalHeight = this.input.offsetHeight;

        // Include suggestions list height if visible
        if (this.suggestionsList.style.display === 'block' && this.suggestionsList.childElementCount > 0) {
            totalHeight += this.suggestionsList.scrollHeight;
        }

        // Include error message height if visible
        const errorElement = document.getElementById('error-message');
        if (errorElement && errorElement.style.display !== 'none') {
            totalHeight += errorElement.offsetHeight;
        }

        // Add margins and padding
        const styles = window.getComputedStyle(this.widgetContainer);
        totalHeight += parseFloat(styles.marginTop) + parseFloat(styles.marginBottom);
        totalHeight += parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);

        // Additional padding for smooth appearance
        totalHeight += 20;

        JFCustomWidget.requestFrameResize({ height: Math.ceil(totalHeight) });
    }

    // ... rest of the class implementation remains the same ...
}

// Initialize the widget
new AutocompleteWidget();
