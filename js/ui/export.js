const CardExport = (() => {
    const modal = document.getElementById('export-modal');

    // Helper to make a string safe for a filename
    function slugify(text) {
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')       // Replace spaces with -
            .replace(/[^\w-]+/g, '')    // Remove all non-word chars
            .replace(/--+/g, '-')      // Replace multiple - with single -
            .replace(/^-+/, '')         // Trim - from start of text
            .replace(/-+$/, '');        // Trim - from end of text
    }

    function openExportDialog() {
        const cards = CardModel.getCards();
        const allTags = [...new Set(cards.flatMap(c => c.tags))].sort();
        const allColors = [...new Set(cards.map(c => c.color))];

        const tagContainer = document.getElementById('tag-filters');
        tagContainer.innerHTML = '';
        allTags.forEach(tag => {
            tagContainer.innerHTML += `<label class="tag-option"><input type="checkbox" name="tag" value="${tag}"> ${tag}</label>`;
        });

        const colorContainer = document.getElementById('color-filters');
        colorContainer.innerHTML = '';
        allColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-option';
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            swatch.addEventListener('click', () => swatch.classList.toggle('selected'));
            colorContainer.appendChild(swatch);
        });

        modal.style.display = 'flex';
    }

    function closeExportDialog() {
        modal.style.display = 'none';
        document.getElementById('report-title').value = '';
    }

    // --- Helper for grouping and formatting cards ---
    function processCards(cards) {
        const tagsMap = {};
        const untaggedCards = [];
        cards.forEach(card => {
            if (card.tags && card.tags.length > 0) {
                card.tags.forEach(tag => {
                    if (!tagsMap[tag]) tagsMap[tag] = [];
                    tagsMap[tag].push(card);
                });
            } else {
                untaggedCards.push(card);
            }
        });
        return { tagsMap, untaggedCards };
    }

    // --- Content Generators for Each Format ---

    function getConnectorLabel(connector) {
        if (!connector) {
            return 'relates to';
        }
        const label = connector.type !== undefined && connector.type !== null ? connector.type.toString().trim() : '';
        return label || 'relates to';
    }

    function describeEndpoint(endpoint, cardLookup, connectorLookup) {
        if (!endpoint) return 'Unknown';
        if (endpoint.type === 'card') {
            const card = cardLookup.get(endpoint.id);
            if (!card) {
                return `Card #${endpoint.id}`;
            }
            const title = card.title ? card.title.trim() : `Card #${card.id}`;
            return card.nucleus ? `(Nucleus) ${title}` : title;
        }
        if (endpoint.type === 'connector') {
            const connector = connectorLookup.get(endpoint.id);
            if (!connector) {
                return `Connector #${endpoint.id}`;
            }
            const label = getConnectorLabel(connector);
            return `Connector #${connector.id} (“${label}”)`;
        }
        return 'Unknown';
    }

    function describeEndpointHtml(endpoint, cardLookup, connectorLookup) {
        if (!endpoint) return 'Unknown';
        if (endpoint.type === 'card') {
            const card = cardLookup.get(endpoint.id);
            if (!card) {
                return `Card #${endpoint.id}`;
            }
            const title = card.title ? card.title.trim() : `Card #${card.id}`;
            return card.nucleus ? `<strong>(Nucleus) ${title}</strong>` : `<strong>${title}</strong>`;
        }
        if (endpoint.type === 'connector') {
            const connector = connectorLookup.get(endpoint.id);
            if (!connector) {
                return `Connector #${endpoint.id}`;
            }
            const label = getConnectorLabel(connector);
            return `<strong>Connector #${connector.id}</strong> (“${label}”)`;
        }
        return 'Unknown';
    }

    function generateMarkdownContent(cards, connectors, options) {
        const { tagsMap, untaggedCards } = processCards(cards);
        const sortedTags = Object.keys(tagsMap).sort();
        const now = new Date();
        const timestamp = `${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;

        let content = `# ${options.title}\n\n*Generated on: ${timestamp}*\n\n---\n\n`;

        const createList = (cardList) => {
            let listContent = '';
            cardList.forEach(c => {
                let prefix = c.nucleus ? `- **(Nucleus) ${c.title.trim()}**: ` : `- **${c.title.trim()}**: `;
                listContent += `${prefix}${c.blurb.trim()}\n`;
            });
            return listContent;
        };

        sortedTags.forEach(tag => {
            content += `## Tag: ${tag}\n${createList(tagsMap[tag])}\n---\n\n`;
        });
        if (untaggedCards.length > 0) {
            content += `## Untagged Cards\n${createList(untaggedCards)}\n---\n\n`;
        }

        if (connectors.length > 0) {
            const cardLookup = new Map(cards.map(card => [card.id, card]));
            const connectorLookup = new Map(connectors.map(connector => [connector.id, connector]));
            const sortedConnectors = [...connectors].sort((a, b) => {
                const typeCompare = getConnectorLabel(a).localeCompare(getConnectorLabel(b));
                if (typeCompare !== 0) return typeCompare;
                return a.id - b.id;
            });
            content += `## Connections\n`;
            sortedConnectors.forEach(connector => {
                const from = describeEndpoint(connector.from, cardLookup, connectorLookup);
                const to = describeEndpoint(connector.to, cardLookup, connectorLookup);
                const label = getConnectorLabel(connector);
                content += `- **${label}**: ${from} ➔ ${to}\n`;
            });
            content += `\n---\n\n`;
        }

        return { content, mimeType: 'text/markdown', extension: 'md' };
    }

    function generateHtmlContent(cards, connectors, options) {
        const { tagsMap, untaggedCards } = processCards(cards);
        const sortedTags = Object.keys(tagsMap).sort();
        const now = new Date();
        const timestamp = `${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;

        let content = `<!DOCTYPE html><html><head><title>${options.title}</title><style>body{font-family:sans-serif;line-height:1.6;}h1,h2{border-bottom:1px solid #eee;padding-bottom:5px;}</style></head><body>`;
        content += `<h1>${options.title}</h1><p><em>Generated on: ${timestamp}</em></p>`;

        const createList = (cardList) => {
            let listHtml = '<ul>';
            cardList.forEach(c => {
                let prefix = c.nucleus ? '<li><b>(Nucleus) ' : '<li><b>';
                listHtml += `${prefix}${c.title.trim()}</b>: ${c.blurb.trim()}</li>`;
            });
            return listHtml + '</ul>';
        };

        sortedTags.forEach(tag => {
            content += `<h2>Tag: ${tag}</h2>${createList(tagsMap[tag])}`;
        });
        if (untaggedCards.length > 0) {
            content += `<h2>Untagged Cards</h2>${createList(untaggedCards)}`;
        }

        if (connectors.length > 0) {
            const cardLookup = new Map(cards.map(card => [card.id, card]));
            const connectorLookup = new Map(connectors.map(connector => [connector.id, connector]));
            const sortedConnectors = [...connectors].sort((a, b) => {
                const typeCompare = getConnectorLabel(a).localeCompare(getConnectorLabel(b));
                if (typeCompare !== 0) return typeCompare;
                return a.id - b.id;
            });
            content += `<h2>Connections</h2><ul>`;
            sortedConnectors.forEach(connector => {
                const from = describeEndpointHtml(connector.from, cardLookup, connectorLookup);
                const to = describeEndpointHtml(connector.to, cardLookup, connectorLookup);
                const label = getConnectorLabel(connector);
                content += `<li><strong>${label}</strong>: ${from} ➔ ${to}</li>`;
            });
            content += `</ul>`;
        }

        content += `</body></html>`;
        return { content, mimeType: 'text/html', extension: 'html' };
    }
    
    function generateJsonContent(cards, connectors) {
        const content = JSON.stringify({ cards, connectors }, null, 2);
        return { content, mimeType: 'application/json', extension: 'json' };
    }

    function exportFilteredData(options) {
        const state = CardModel.getState();
        let cards = state.cards;
        let connectors = state.connectors;
        if (options.selectedTags.length > 0) {
            cards = cards.filter(card => options.selectedTags.some(tag => card.tags.includes(tag)));
        }
        if (options.selectedColors.length > 0) {
            cards = cards.filter(card => options.selectedColors.includes(card.color));
        }

        if (cards.length === 0) {
            alert("No cards match the selected filters.");
            return;
        }

        const cardIdSet = new Set(cards.map(card => card.id));
        const initialConnectors = state.connectors.filter(connector => {
            if (connector.from.type === 'card' && !cardIdSet.has(connector.from.id)) {
                return false;
            }
            if (connector.to.type === 'card' && !cardIdSet.has(connector.to.id)) {
                return false;
            }
            return true;
        });

        const allowedKeys = new Set(Array.from(cardIdSet).map(id => `card:${id}`));
        const pending = new Map(initialConnectors.map(connector => [connector.id, connector]));
        const includedConnectors = [];

        let expanded = true;
        while (expanded) {
            expanded = false;
            for (const [connectorId, connector] of Array.from(pending.entries())) {
                const fromKey = `${connector.from.type}:${connector.from.id}`;
                const toKey = `${connector.to.type}:${connector.to.id}`;
                if (allowedKeys.has(fromKey) && allowedKeys.has(toKey)) {
                    includedConnectors.push(connector);
                    pending.delete(connectorId);
                    const connectorKey = `connector:${connectorId}`;
                    if (!allowedKeys.has(connectorKey)) {
                        allowedKeys.add(connectorKey);
                    }
                    expanded = true;
                }
            }
        }

        connectors = includedConnectors;

        let result;
        switch(options.format) {
            case 'html':
                result = generateHtmlContent(cards, connectors, options);
                break;
            case 'json':
                result = generateJsonContent(cards, connectors);
                break;
            default:
                result = generateMarkdownContent(cards, connectors, options);
                break;
        }

        const blob = new Blob([result.content], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date();
        const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        a.download = `${slugify(options.title)}-${dateString}.${result.extension}`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    document.getElementById('cancel-export').addEventListener('click', closeExportDialog);
    document.getElementById('confirm-export').addEventListener('click', () => {
        const options = {
            title: document.getElementById('report-title').value || "Card Export",
            format: document.querySelector('input[name="format"]:checked').value,
            selectedTags: Array.from(document.querySelectorAll('#tag-filters input:checked')).map(el => el.value),
            selectedColors: Array.from(document.querySelectorAll('#color-filters .selected')).map(el => el.dataset.color)
        };
        exportFilteredData(options);
        closeExportDialog();
    });

    return { openExportDialog };
})();