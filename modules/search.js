export const SearchModule = {
    search(searchTerm, data, columnIndex, maxResults, threshold = 0.2, distance = 100) {
        if (!data || !Array.isArray(data) || !data.length) {
            console.error('[SearchModule] Invalid data provided');
            return [];
        }

        if (columnIndex >= data[0].length) {
            console.error('[SearchModule] Column index out of bounds');
            return [];
        }

        const term = searchTerm.toLowerCase().trim();
        
        return data
            .slice(1) // Skip header row
            .map(row => {
                const value = row[columnIndex];
                if (!value || typeof value !== 'string') return null;
                
                const score = this.fuzzySearch(value.toLowerCase(), term, threshold, distance);
                return score > threshold ? {
                    original: value,
                    highlighted: this.highlightMatch(value, term),
                    score
                } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map(({ original, highlighted }) => ({
                original,
                highlighted
            }));
    },

    fuzzySearch(str, pattern, threshold, distance) {
        const string = str.toLowerCase();
        const term = pattern.toLowerCase();
        
        if (string.includes(term)) return 1;
        
        let score = 0;
        let patternIdx = 0;
        let prevMatchingCharIdx = -1;
        
        for (let strIdx = 0; strIdx < string.length && patternIdx < term.length; strIdx++) {
            if (string[strIdx] === term[patternIdx]) {
                score += prevMatchingCharIdx + 1 === strIdx ? 0.9 : 0.6;
                prevMatchingCharIdx = strIdx;
                patternIdx++;
            }
        }
        
        // Apply distance penalty
        const lengthDiff = Math.abs(string.length - term.length);
        if (lengthDiff > distance) {
            score *= Math.max(0, 1 - (lengthDiff - distance) / string.length);
        }
        
        return patternIdx === term.length ? score / term.length : 0;
    },

    highlightMatch(text, searchTerm) {
        if (!searchTerm) return text;
        
        const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
};