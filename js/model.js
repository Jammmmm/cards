const CardModel = (() => {
    let cards = [];
    let connectors = [];
    let idCounter = 1;
    let connectorIdCounter = 1;

    function addCard(title = "New Title", blurb = "Click to edit...") {
        const card = {
            id: idCounter++,
            title,
            blurb,
            x: 50,
            y: 50,
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

    function addConnector(fromCardId, toCardId, type = 'relates to') {
        const fromExists = cards.some(c => c.id === fromCardId);
        const toExists = cards.some(c => c.id === toCardId);
        if (!fromExists || !toExists || fromCardId === toCardId) {
            return null;
        }

        const normalizedType = type && type.trim() ? type.trim() : 'relates to';
        const duplicate = connectors.some(connector =>
            connector.fromCardId === fromCardId &&
            connector.toCardId === toCardId &&
            connector.type.toLowerCase() === normalizedType.toLowerCase()
        );
        if (duplicate) {
            return null;
        }

        const connector = {
            id: connectorIdCounter++,
            fromCardId,
            toCardId,
            type: normalizedType
        };

        connectors.push(connector);
        return connector;
    }

    function updateConnector(id, data) {
        const connector = connectors.find(c => c.id === id);
        if (connector) Object.assign(connector, data);
    }

    function deleteConnector(id) {
        const index = connectors.findIndex(c => c.id === id);
        if (index > -1) {
            connectors.splice(index, 1);
        }
    }

    function getConnector(id) {
        return connectors.find(c => c.id === id);
    }

    function getState() {
        return {
            cards: JSON.parse(JSON.stringify(cards)),
            connectors: JSON.parse(JSON.stringify(connectors))
        };
    }

    function loadCards(loadedData) {
        if (Array.isArray(loadedData)) {
            cards = loadedData;
            connectors = [];
        } else if (loadedData && Array.isArray(loadedData.cards)) {
            cards = loadedData.cards;
            const cardIds = new Set(cards.map(card => card.id));
            if (Array.isArray(loadedData.connectors)) {
                const seen = new Set();
                const sanitized = [];
                loadedData.connectors.forEach(connector => {
                    if (!cardIds.has(connector.fromCardId) || !cardIds.has(connector.toCardId) || connector.fromCardId === connector.toCardId) {
                        return;
                    }
                    const type = connector.type && typeof connector.type === 'string' && connector.type.trim() ? connector.type.trim() : 'relates to';
                    const key = `${connector.fromCardId}->${connector.toCardId}:${type.toLowerCase()}`;
                    if (seen.has(key)) {
                        return;
                    }
                    seen.add(key);
                    sanitized.push({
                        id: typeof connector.id === 'number' && Number.isFinite(connector.id) ? connector.id : null,
                        fromCardId: connector.fromCardId,
                        toCardId: connector.toCardId,
                        type
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
                    fromCardId: connector.fromCardId,
                    toCardId: connector.toCardId,
                    type: connector.type
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
    }

    function deleteCard(id) {
        const cardIndex = cards.findIndex(c => c.id === id);
        if (cardIndex > -1) {
            cards.splice(cardIndex, 1);
            connectors = connectors.filter(connector => connector.fromCardId !== id && connector.toCardId !== id);
        }
    }

    return {
        addCard,
        updateCard,
        getCards,
        getConnectors,
        addConnector,
        updateConnector,
        deleteConnector,
        getConnector,
        getState,
        loadCards,
        deleteCard
    };
})();
