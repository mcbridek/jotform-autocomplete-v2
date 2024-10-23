import { DataFetcher } from './modules/dataFetcher.js';
import { SearchModule } from './modules/search.js';
import { Cache } from './modules/cache.js';
import { EventBus } from './modules/eventBus.js';

class AutocompleteWidget {
    constructor() {
        this.cache = new Cache();
        this.dataFetcher = new DataFetcher();
        this.searchModule = new SearchModule();
        this.eventBus = new EventBus();

        this.elements = {
            input: document.getElementById('autocomplete-input'),
            suggestionsList: document.getElementById('suggestions-list'),
            loadingIndicator: document.getElementById('loading-indicator'),
            errorMessage: document.getElementById('error-message'),
            widgetContainer: document.getElementById('widget-container')
        };

        this.state = {
            selectedIndex: -1,
            isDataLoaded: false
        };

        this.init();
    }

    async init() {
        JFCustomWidget.subscribe("ready", async () => {
            this.config = JFCustomWidget.getWidgetSettings();
            this.setupEventListeners();
            await this.loadInitialData();
            this.adjustIframeHeight();
        });

        JFCustomWidget.subscribe("submit", () => {
            JFCustomWidget.sendSubmit({
                valid: true,
                value: this.elements.input.value
            });
        });
    }

    setupEventListeners() {
        this.elements.input.addEventListener('input', this.debounce(this.handleInput.bind(this), this.config.debounceTime));
        this.elements.input.addEventListener('keydown', this.handleKeydown.bind(this));
        this.elements.input.addEventListener('focus', () => this.adjustIframeHeight());
        this.elements.input.addEventListener('blur', this.handleBlur.bind(this));
        document.addEventListener('click', this.handleClickOutside.bind(this));

        if (this.config.dynamicResize) {
            this.setupResizeObserver();
        }

        window.addEventListener('resize', this.debounce(this.adjustIframeHeight.bind(this), 100));

        this.eventBus.subscribe('dataLoaded', this.handleDataLoaded.bind(this));
        this.eventBus.subscribe('searchCompleted', this.displaySuggestions.bind(this));
    }

    async loadInitialData() {
        try {
            const data = await this.dataFetcher.fetchFromSheet(this.config.googleSheetId);
            this.cache.set(data);
            this.eventBus.publish('dataLoaded', data);
        } catch (error) {
            this.showError('Failed to load data. Please try again later.');
        }
    }

    async handleInput(event) {
        const searchTerm = event.target.value;
        if (searchTerm.length < this.config.minCharRequired) {
            this.clearSuggestions();
            return;
        }

        if (!this.state.isDataLoaded) {
            await this.loadInitialData();
        }

        const results = this.searchModule.search(
            searchTerm,
            this.cache.get(),
            this.config.columnIndex,
            this.config.maxResults,
            this.config.threshold,
            this.config.distance
        );

        this.eventBus.publish('searchCompleted', results);
    }

    handleKeydown(event) {
        // ... (keydown handling logic)
    }

    handleBlur() {
        setTimeout(() => {
            this.clearSuggestions();
            this.adjustIframeHeight();
        }, 100);
    }

    handleClickOutside(event) {
        if (!this.elements.widgetContainer.contains(event.target)) {
            this.clearSuggestions();
        }
    }

    displaySuggestions(results) {
        // ... (display suggestions logic)
    }

    clearSuggestions() {
        this.elements.suggestionsList.innerHTML = '';
        this.elements.suggestionsList.style.display = 'none';
        this.adjustIframeHeight();
    }

    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.style.display = 'block';
        this.adjustIframeHeight();
    }

    adjustIframeHeight() {
        // ... (iframe height adjustment logic)
    }

    setupResizeObserver() {
        const resizeObserver = new ResizeObserver(this.debounce(() => {
            this.adjustIframeHeight();
        }, 100));
        resizeObserver.observe(this.elements.widgetContainer);
    }

    debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    handleDataLoaded(data) {
        this.state.isDataLoaded = true;
        // Any additional logic after data is loaded
    }
}

class EventBus {
    constructor() {
        this.events = {};
    }

    subscribe(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    publish(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => callback(data));
        }
    }
}

// Initialize the widget
new AutocompleteWidget();
