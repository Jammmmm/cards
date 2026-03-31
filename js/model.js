const CardModel = (() => {
    let cards = [];
    let connectors = [];
    let idCounter = 1;
    let connectorIdCounter = 1;
    let sessionTitle = '';

    function normalizeEndpoint(endpoint, fallbackType = 'card') {
        if (endpoint && typeof endpoint === 'object' && 'id' in endpoint) {
            const type = endpoint.type === 'connector' ? 'connector' : 'card';
            const id = Number(endpoint.id);
            if (!Number.isFinite(id)) return null;
            return { type, id };
        }

        const id = Number(endpoint);
        if (!Number.isFinite(id)) return null;
        return { type: fallbackType, id };
    }

    function endpointExists(endpoint) {
        if (!endpoint) return false;
        if (endpoint.type === 'card') {
            return cards.some(c => c.id === endpoint.id);
        }
        if (endpoint.type === 'connector') {
            return connectors.some(c => c.id === endpoint.id);
        }
        return false;
    }

    function clonePosition(position) {
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') return null;
        return { x: position.x, y: position.y };
    }

    function addCard(title = "New Title", blurb = "Click to edit...") {
        const card = {
            id: idCounter++,
            title,
            blurb,
            x: 50,
            y: 50,
            width: 190,
            height: 'auto',
            tags: [],
            nucleus: false,
            color: '#ffffff'
        };
        cards.push(card);
        return card;
    }

    function updateCard(id, data) {
        const card = cards.find(c => c.id === id);
        if (card) Object.assign(card, data);
    }

    function getCards() {
        return cards;
    }

    function getConnectors() {
        return connectors;
    }

    function getConnectorPosition(id) {
        const connector = connectors.find(c => c.id === id);
        if (!connector) return null;
        if (!connector.position) return null;
        return clonePosition(connector.position);
    }

    function setConnectorPosition(id, position, options = {}) {
        const connector = connectors.find(c => c.id === id);
        if (!connector || !position) return;
        const { autoPosition } = options;
        connector.position = { x: position.x, y: position.y };
        if (typeof autoPosition === 'boolean') {
            connector.autoPosition = autoPosition;
        }
    }

    function addConnector(fromInput, toInput, type = 'relates to', options = {}) {
        const from = normalizeEndpoint(fromInput, 'card');
        const to = normalizeEndpoint(toInput, 'card');
        if (!from || !to) return null;

        if (!endpointExists(from) || !endpointExists(to)) {
            return null;
        }

        if (from.type === to.type && from.id === to.id) {
            return null;
        }

        const normalizedType = type && type.trim() ? type.trim() : 'relates to';
        const duplicate = connectors.some(connector =>
            connector.from.type === from.type &&
            connector.from.id === from.id &&
            connector.to.type === to.type &&
            connector.to.id === to.id &&
            connector.type.toLowerCase() === normalizedType.toLowerCase()
        );
        if (duplicate) {
            return null;
        }

        const connector = {
            id: connectorIdCounter++,
            from,
            to,
            type: normalizedType,
            position: options.position ? clonePosition(options.position) : { x: 0, y: 0 },
            autoPosition: options.autoPosition !== undefined ? options.autoPosition : true
        };

        connectors.push(connector);
        return connector;
    }

    function updateConnector(id, data) {
        const connector = connectors.find(c => c.id === id);
        if (connector) Object.assign(connector, data);
    }

    function deleteConnector(id) {
        const toRemove = new Set();
        const collectDependents = (targetId) => {
            if (toRemove.has(targetId)) return;
            toRemove.add(targetId);
            connectors
                .filter(connector =>
                    (connector.from.type === 'connector' && connector.from.id === targetId) ||
                    (connector.to.type === 'connector' && connector.to.id === targetId)
                )
                .forEach(connector => collectDependents(connector.id));
        };

        collectDependents(id);
        connectors = connectors.filter(connector => !toRemove.has(connector.id));
    }

    function getConnector(id) {
        return connectors.find(c => c.id === id);
    }

    function getState() {
        return {
            title: sessionTitle,
            cards: JSON.parse(JSON.stringify(cards)),
            connectors: JSON.parse(JSON.stringify(connectors))
        };
    }

    function loadCards(loadedData) {
        if (Array.isArray(loadedData)) {
            cards = loadedData;
            connectors = [];
            sessionTitle = '';
        } else if (loadedData && Array.isArray(loadedData.cards)) {
            cards = loadedData.cards;
            sessionTitle = loadedData.title || '';
            const cardIds = new Set(cards.map(card => card.id));
            if (Array.isArray(loadedData.connectors)) {
                const seen = new Set();
                const sanitized = [];

                loadedData.connectors.forEach(connector => {
                    const from = connector.from ? normalizeEndpoint(connector.from) : normalizeEndpoint(connector.fromCardId, 'card');
                    const to = connector.to ? normalizeEndpoint(connector.to) : normalizeEndpoint(connector.toCardId, 'card');
                    if (!from || !to) {
                        return;
                    }

                    const fromValid = from.type === 'card' ? cardIds.has(from.id) : true;
                    const toValid = to.type === 'card' ? cardIds.has(to.id) : true;
                    if (!fromValid || !toValid) {
                        return;
                    }

                    if (from.type === to.type && from.id === to.id) {
                        return;
                    }

                    const type = connector.type && typeof connector.type === 'string' && connector.type.trim() ? connector.type.trim() : 'relates to';
                    const key = `${from.type}:${from.id}->${to.type}:${to.id}:${type.toLowerCase()}`;
                    if (seen.has(key)) {
                        return;
                    }
                    seen.add(key);

                    let position = null;
                    if (connector.position && typeof connector.position.x === 'number' && typeof connector.position.y === 'number') {
                        position = { x: connector.position.x, y: connector.position.y };
                    }

                    sanitized.push({
                        id: typeof connector.id === 'number' && Number.isFinite(connector.id) ? connector.id : null,
                        from,
                        to,
                        type,
                        position,
                        autoPosition: connector.autoPosition !== undefined ? Boolean(connector.autoPosition) : true
                    });
                });

                let maxId = 0;
                sanitized.forEach(connector => {
                    if (typeof connector.id === 'number') {
                        maxId = Math.max(maxId, connector.id);
                    }
                });
                let nextId = maxId + 1;
                connectors = sanitized.map(connector => ({
                    id: typeof connector.id === 'number' ? connector.id : nextId++,
                    from: connector.from,
                    to: connector.to,
                    type: connector.type,
                    position: connector.position ? { x: connector.position.x, y: connector.position.y } : { x: 0, y: 0 },
                    autoPosition: connector.autoPosition !== undefined ? connector.autoPosition : true
                }));
            } else {
                connectors = [];
            }
        } else {
            console.error("Failed to load session: Data is not valid.");
            return;
        }

        idCounter = Math.max(0, ...cards.map(c => c.id)) + 1;
        connectorIdCounter = Math.max(0, ...connectors.map(c => c.id)) + 1;

        // Remove connectors that reference non-existent connectors after ids reset
        let stable = false;
        while (!stable) {
            stable = true;
            const connectorIds = new Set(connectors.map(connector => connector.id));
            const filtered = connectors.filter(connector => {
                const fromValid = connector.from.type === 'connector' ? connectorIds.has(connector.from.id) : true;
                const toValid = connector.to.type === 'connector' ? connectorIds.has(connector.to.id) : true;
                return fromValid && toValid;
            });
            if (filtered.length !== connectors.length) {
                connectors = filtered;
                stable = false;
            }
        }
    }

    function deleteCard(id) {
        const cardIndex = cards.findIndex(c => c.id === id);
        if (cardIndex > -1) {
            cards.splice(cardIndex, 1);
            const removedConnectors = connectors
                .filter(connector =>
                    (connector.from.type === 'card' && connector.from.id === id) ||
                    (connector.to.type === 'card' && connector.to.id === id)
                )
                .map(connector => connector.id);

            const toRemove = new Set(removedConnectors);
            const collectDependents = (targetId) => {
                connectors
                    .filter(connector =>
                        (connector.from.type === 'connector' && connector.from.id === targetId) ||
                        (connector.to.type === 'connector' && connector.to.id === targetId)
                    )
                    .forEach(connector => {
                        if (!toRemove.has(connector.id)) {
                            toRemove.add(connector.id);
                            collectDependents(connector.id);
                        }
                    });
            };

            removedConnectors.forEach(collectDependents);
            connectors = connectors.filter(connector => !toRemove.has(connector.id));
        }
    }

    function getSessionTitle() {
        return sessionTitle;
    }

    function setSessionTitle(title) {
        sessionTitle = title || '';
    }

    function persist() {
        localStorage.setItem('cards-session', JSON.stringify(getState()));
    }

    function loadFromStorage() {
        const saved = localStorage.getItem('cards-session');
        if (!saved) return false;
        try {
            loadCards(JSON.parse(saved));
            return true;
        } catch (e) {
            console.error('Failed to restore session from localStorage:', e);
            return false;
        }
    }

    return {
        addCard,
        updateCard,
        getCards,
        getConnectors,
        getConnectorPosition,
        setConnectorPosition,
        addConnector,
        updateConnector,
        deleteConnector,
        getConnector,
        getState,
        loadCards,
        deleteCard,
        getSessionTitle,
        setSessionTitle,
        persist,
        loadFromStorage
    };
})();
