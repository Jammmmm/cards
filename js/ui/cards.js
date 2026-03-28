const CardUI = (() => {
    const container = document.getElementById("card-container");
    const svgNS = "http://www.w3.org/2000/svg";
    const LONG_PRESS_DURATION = 500;
    const MOVE_THRESHOLD = 24;
    const RELATION_SUGGESTIONS = [
        'relates to',
        'type of',
        'reminds me of',
        'leads to',
        'supports'
    ];

    let connectionLayer = null;
    let tempConnectionPath = null;
    let activeConnection = null;
    const cardElements = new Map();

    // Blurb modal elements
    const blurbModal = document.getElementById('blurb-modal');
    const blurbTextarea = document.getElementById('blurb-textarea');
    const cancelBlurbBtn = document.getElementById('cancel-blurb');
    const confirmBlurbBtn = document.getElementById('confirm-blurb');
    let currentBlurbCard = null;
    let currentBlurbDiv = null;

    function ensureConnectionLayer() {
        if (!connectionLayer) {
            connectionLayer = document.createElementNS(svgNS, 'svg');
            connectionLayer.classList.add('connection-layer');
            container.appendChild(connectionLayer);
        }

        const rect = container.getBoundingClientRect();
        connectionLayer.setAttribute('width', rect.width);
        connectionLayer.setAttribute('height', rect.height);
        connectionLayer.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

        return connectionLayer;
    }

    function openBlurbModal(card, blurbDiv) {
        currentBlurbCard = card;
        currentBlurbDiv = blurbDiv;
        blurbTextarea.value = card.blurb;
        blurbModal.style.display = 'flex';
        blurbTextarea.focus();
        blurbTextarea.select();
    }

    function closeBlurbModal() {
        blurbModal.style.display = 'none';
        currentBlurbCard = null;
        currentBlurbDiv = null;
        blurbTextarea.value = '';
    }

    function saveBlurb() {
        if (currentBlurbCard && currentBlurbDiv) {
            currentBlurbCard.blurb = blurbTextarea.value;
            currentBlurbDiv.textContent = blurbTextarea.value;
        }
        closeBlurbModal();
    }

    function getContainerRect() {
        return container.getBoundingClientRect();
    }

    function getCardCenter(cardId) {
        const el = cardElements.get(cardId);
        if (!el) return null;
        const containerRect = getContainerRect();
        const rect = el.getBoundingClientRect();
        return {
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + rect.height / 2
        };
    }

    function getConnectorCenter(connectorId) {
        const position = CardModel.getConnectorPosition(connectorId);
        if (!position) return null;
        return { x: position.x, y: position.y };
    }

    function getEndpointCenter(endpoint) {
        if (!endpoint) return null;
        if (endpoint.type === 'card') {
            return getCardCenter(endpoint.id);
        }
        if (endpoint.type === 'connector') {
            return getConnectorCenter(endpoint.id);
        }
        return null;
    }

    function identifyTargetElement(element) {
        if (!element) return null;
        const cardEl = element.closest && element.closest('.card');
        if (cardEl) {
            return { type: 'card', id: Number(cardEl.dataset.cardId) };
        }
        const connectorEl = element.closest && element.closest('.connector-node');
        if (connectorEl) {
            return { type: 'connector', id: Number(connectorEl.dataset.connectorId) };
        }
        if (element.classList && element.classList.contains('connector-node')) {
            return { type: 'connector', id: Number(element.dataset.connectorId) };
        }
        return null;
    }

    function findTargetAtPoint(clientX, clientY) {
        const element = document.elementFromPoint(clientX, clientY);
        return identifyTargetElement(element);
    }

    function computeControlPoint(start, end) {
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const offset = Math.min(80, distance / 3);
        const offsetX = (-dy / distance) * offset;
        const offsetY = (dx / distance) * offset;
        return {
            x: midX + offsetX,
            y: midY + offsetY
        };
    }

    function computeQuadraticPoint(start, control, end, t) {
        const oneMinusT = 1 - t;
        const x = oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * control.x + t * t * end.x;
        const y = oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * control.y + t * t * end.y;
        return { x, y };
    }

    function editConnector(connectorId) {
        const connector = CardModel.getConnector(connectorId);
        if (!connector) return;
        const suggestionText = `Suggestions: ${RELATION_SUGGESTIONS.join(', ')}`;
        const newType = prompt(`Edit relationship description (current: "${connector.type}")\n${suggestionText}`, connector.type);
        if (newType === null) return;
        const trimmed = newType.trim();
        CardModel.updateConnector(connectorId, { type: trimmed || RELATION_SUGGESTIONS[0] });
        renderConnections();
    }

    function deleteConnectorWithConfirm(connectorId) {
        if (!confirm('Delete this connector?')) return;
        CardModel.deleteConnector(connectorId);
        renderConnections();
    }

    function renderConnections() {
        const layer = ensureConnectionLayer();
        layer.innerHTML = '';

        const connectors = CardModel.getConnectors();

        connectors.forEach(connector => {
            const start = getEndpointCenter(connector.from);
            const end = getEndpointCenter(connector.to);
            if (!start || !end) {
                return;
            }

            const control = computeControlPoint(start, end);
            const path = document.createElementNS(svgNS, 'path');
            path.classList.add('connector-path');
            path.setAttribute('d', `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`);
            path.dataset.connectorId = connector.id;
            layer.appendChild(path);

            let nodePosition;
            if (connector.autoPosition || !connector.position) {
                nodePosition = computeQuadraticPoint(start, control, end, 0.5);
                CardModel.setConnectorPosition(connector.id, nodePosition, { autoPosition: true });
            } else {
                nodePosition = { x: connector.position.x, y: connector.position.y };
            }

            const group = document.createElementNS(svgNS, 'g');
            group.classList.add('connector-node');
            group.dataset.connectorId = connector.id;

            const background = document.createElementNS(svgNS, 'rect');
            background.classList.add('connector-node-bg');
            group.appendChild(background);

            const text = document.createElementNS(svgNS, 'text');
            text.classList.add('connector-label');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.textContent = connector.type;
            group.appendChild(text);

            layer.appendChild(group);

            const paddingX = 12;
            const textLength = text.getComputedTextLength();
            const height = 24;
            const width = Math.max(textLength + paddingX * 2, height);

            background.setAttribute('x', nodePosition.x - width / 2);
            background.setAttribute('y', nodePosition.y - height / 2);
            background.setAttribute('width', width);
            background.setAttribute('height', height);
            background.setAttribute('rx', height / 2);
            background.setAttribute('ry', height / 2);

            text.setAttribute('x', nodePosition.x);
            text.setAttribute('y', nodePosition.y);

            const editHandler = () => editConnector(connector.id);
            const deleteHandler = (event) => {
                event.preventDefault();
                deleteConnectorWithConfirm(connector.id);
            };

            path.addEventListener('click', editHandler);
            path.addEventListener('contextmenu', deleteHandler);
            group.addEventListener('contextmenu', deleteHandler);

            setupConnectorNodeInteractions(group, connector.id);
        });

        if (activeConnection && tempConnectionPath) {
            layer.appendChild(tempConnectionPath);
        }
    }

    function setupConnectorNodeInteractions(group, connectorId) {
        let pointerId = null;
        let longPressTimer = null;
        let connectionStarted = false;
        let startPoint = null;
        let lastPointerEvent = null;

        const clearTimer = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };

        function resetState(cancelConnection = false) {
            clearTimer();
            if (pointerId !== null && group.hasPointerCapture && group.hasPointerCapture(pointerId)) {
                group.releasePointerCapture(pointerId);
            }
            pointerId = null;
            startPoint = null;
            lastPointerEvent = null;
            if (cancelConnection) {
                cancelActiveConnection();
            }
            connectionStarted = false;
            group.classList.remove('connector-node-active');
        }

        group.addEventListener('pointerdown', (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            event.stopPropagation();
            event.preventDefault();
            cancelActiveConnection();
            pointerId = event.pointerId;
            startPoint = { x: event.clientX, y: event.clientY };
            lastPointerEvent = event;
            connectionStarted = false;
            group.classList.remove('connector-node-active');
            if (group.setPointerCapture) {
                group.setPointerCapture(pointerId);
            }
            clearTimer();
            longPressTimer = setTimeout(() => {
                connectionStarted = true;
                group.classList.add('connector-node-active');
                startConnectionDrag({ type: 'connector', id: connectorId }, lastPointerEvent || event);
            }, LONG_PRESS_DURATION);
        });

        group.addEventListener('pointermove', (event) => {
            if (pointerId === null || event.pointerId !== pointerId) return;
            lastPointerEvent = event;
            if (!connectionStarted) {
                const dx = event.clientX - startPoint.x;
                const dy = event.clientY - startPoint.y;
                if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
                    resetState(true);
                }
                return;
            }
            updateConnectionDrag(event);
        });

        const finalizeConnection = (event, cancelled = false) => {
            if (pointerId === null || event.pointerId !== pointerId) return;
            const started = connectionStarted;
            resetState(cancelled);
            if (!started) {
                if (!cancelled) {
                    editConnector(connectorId);
                }
                return;
            }

            const target = cancelled ? null : findTargetAtPoint(event.clientX, event.clientY);
            finishConnectionDrag(target);
        };

        group.addEventListener('pointerup', (event) => finalizeConnection(event));
        group.addEventListener('pointercancel', (event) => finalizeConnection(event, true));
    }

    function startConnectionDrag(source, pointerEvent) {
        const start = getEndpointCenter(source);
        if (!start) return;
        ensureConnectionLayer();

        activeConnection = {
            from: { type: source.type, id: source.id },
            start
        };

        tempConnectionPath = document.createElementNS(svgNS, 'path');
        tempConnectionPath.classList.add('connector-path', 'temp-connector');
        connectionLayer.appendChild(tempConnectionPath);
        updateConnectionDrag(pointerEvent);
    }

    function updateConnectionDrag(pointerEvent) {
        if (!activeConnection || !tempConnectionPath) return;
        const containerRect = getContainerRect();
        const end = {
            x: pointerEvent.clientX - containerRect.left,
            y: pointerEvent.clientY - containerRect.top
        };
        const start = getEndpointCenter(activeConnection.from) || activeConnection.start;
        const control = computeControlPoint(start, end);
        tempConnectionPath.setAttribute('d', `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`);
    }

    function finishConnectionDrag(targetEndpoint) {
        if (tempConnectionPath && tempConnectionPath.parentNode) {
            tempConnectionPath.parentNode.removeChild(tempConnectionPath);
        }
        tempConnectionPath = null;

        if (activeConnection && targetEndpoint && (targetEndpoint.type !== activeConnection.from.type || targetEndpoint.id !== activeConnection.from.id)) {
            const suggestionText = `Suggestions: ${RELATION_SUGGESTIONS.join(', ')}`;
            let defaultSuggestion = RELATION_SUGGESTIONS[0];
            if (activeConnection.from.type === 'connector') {
                const sourceConnector = CardModel.getConnector(activeConnection.from.id);
                if (sourceConnector && sourceConnector.type) {
                    defaultSuggestion = sourceConnector.type;
                }
            }
            const relationType = prompt(`Relationship type between items?\n${suggestionText}`, defaultSuggestion);
            if (relationType !== null) {
                const trimmed = relationType.trim();
                const created = CardModel.addConnector(
                    { type: activeConnection.from.type, id: activeConnection.from.id },
                    { type: targetEndpoint.type, id: targetEndpoint.id },
                    trimmed || defaultSuggestion,
                    { autoPosition: true }
                );
                if (!created) {
                    alert('A connector with this relationship already exists between the selected items.');
                }
                renderConnections();
            }
        }

        activeConnection = null;
    }

    function cancelActiveConnection() {
        if (tempConnectionPath && tempConnectionPath.parentNode) {
            tempConnectionPath.parentNode.removeChild(tempConnectionPath);
        }
        tempConnectionPath = null;
        activeConnection = null;
        document.querySelectorAll('.connector-node-active').forEach(el => el.classList.remove('connector-node-active'));
    }

    function createCardElement(card) {
        const div = document.createElement("div");
        div.classList.add("card");
        if (card.nucleus) div.classList.add("nucleus");
        div.style.left = card.x + "px";
        div.style.top = card.y + "px";
        div.style.backgroundColor = card.color;

        // Apply width and height
        if (card.width) {
            div.style.width = typeof card.width === 'number' ? card.width + "px" : card.width;
        }
        if (card.height && card.height !== 'auto') {
            div.style.height = typeof card.height === 'number' ? card.height + "px" : card.height;
        }

        div.dataset.cardId = card.id;
        cardElements.set(card.id, div);

        let suppressClick = false;

        const dragBar = document.createElement("div");
        dragBar.classList.add("drag-bar");
        dragBar.style.touchAction = 'none';
        div.appendChild(dragBar);

        const cardContent = document.createElement("div");
        cardContent.classList.add("card-content");
        div.appendChild(cardContent);

        const titleDiv = document.createElement("div");
        titleDiv.classList.add("card-title");
        titleDiv.textContent = card.title;
        cardContent.appendChild(titleDiv);

        const blurbDiv = document.createElement("div");
        blurbDiv.classList.add("card-blurb");
        blurbDiv.textContent = card.blurb;
        cardContent.appendChild(blurbDiv);

        titleDiv.addEventListener("click", () => {
            if (suppressClick) return;
            const newTitle = prompt("Edit Title:", card.title);
            if (newTitle !== null && newTitle.trim() !== "") {
                card.title = newTitle;
                titleDiv.textContent = newTitle;
                renderConnections();
            }
        });

        blurbDiv.addEventListener("click", () => {
            if (suppressClick) return;
            openBlurbModal(card, blurbDiv);
        });

        div.addEventListener("dblclick", (e) => {
            if (e.target === div || e.target === cardContent) {
                card.nucleus = !card.nucleus;
                div.classList.toggle("nucleus");
            }
        });

        const deleteBtn = document.createElement("div");
        deleteBtn.classList.add("delete-btn");
        deleteBtn.innerHTML = "&times;";
        cardContent.appendChild(deleteBtn);

        deleteBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to permanently delete this card?")) {
                CardModel.deleteCard(card.id);
                render();
            }
        });

        let dragging = false;
        let dragPointerId = null;
        let offsetX = 0;
        let offsetY = 0;

        dragBar.addEventListener('pointerdown', (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            cancelActiveConnection();
            dragging = true;
            dragPointerId = event.pointerId;
            const rect = div.getBoundingClientRect();
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;
            dragBar.style.cursor = "grabbing";
            dragBar.setPointerCapture(dragPointerId);
            event.preventDefault();
        });

        dragBar.addEventListener('pointermove', (event) => {
            if (!dragging || event.pointerId !== dragPointerId) return;
            const containerRect = getContainerRect();
            card.x = event.clientX - containerRect.left - offsetX;
            card.y = event.clientY - containerRect.top - offsetY;
            div.style.left = card.x + "px";
            div.style.top = card.y + "px";
            renderConnections();
        });

        function endDrag(event) {
            if (event.pointerId !== dragPointerId) return;
            dragging = false;
            dragBar.style.cursor = "grab";
            if (dragBar.hasPointerCapture(dragPointerId)) {
                dragBar.releasePointerCapture(dragPointerId);
            }
            dragPointerId = null;
            renderConnections();
        }

        dragBar.addEventListener('pointerup', endDrag);
        dragBar.addEventListener('pointercancel', endDrag);

        const colors = ['#ffffff', '#fff0f0', '#f0faff', '#f5f5dc', '#f0fff0', '#fff9e6', '#ffe6f0', '#e6e6ff', '#ffe6d9', '#e6fff9', '#f9e6ff', '#ffffcc', '#ffd9e6', '#e6f9ff'];
        const palette = document.createElement('div');
        palette.classList.add('color-palette');

        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.classList.add('color-swatch');
            swatch.style.backgroundColor = color;
            if (card.color === color) {
                swatch.classList.add('selected');
            }

            swatch.addEventListener('click', () => {
                card.color = color;
                div.style.backgroundColor = color;
                palette.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
                renderConnections();
            });

            palette.appendChild(swatch);
        });

        cardContent.appendChild(palette);

        const connectionPad = document.createElement('div');
        connectionPad.classList.add('connection-pad');
        connectionPad.setAttribute('role', 'button');
        connectionPad.setAttribute('aria-label', 'Hold to start connecting this card to another');
        connectionPad.innerHTML = '<span class="connection-pad-icon">⤳</span><span class="connection-pad-text">Hold to connect</span>';
        cardContent.appendChild(connectionPad);

        const tagContainer = document.createElement("div");
        tagContainer.classList.add("tags");
        cardContent.appendChild(tagContainer);

        function updateTagDisplay() {
            tagContainer.innerHTML = "";
            card.tags.forEach((tag, index) => {
                const t = document.createElement("span");
                t.classList.add("tag");
                t.textContent = tag + ' ×';

                t.addEventListener("click", () => {
                    card.tags.splice(index, 1);
                    updateTagDisplay();
                });
                tagContainer.appendChild(t);
            });

            const addTagButton = document.createElement("span");
            addTagButton.classList.add("tag", "add-tag-btn");
            addTagButton.textContent = "+ tag";

            addTagButton.addEventListener("click", () => {
                const newTag = prompt("Add a new tag:");
                if (newTag && newTag.trim() !== "") {
                    const trimmedTag = newTag.trim();
                    if (!card.tags.includes(trimmedTag)) {
                        card.tags.push(trimmedTag);
                        updateTagDisplay();
                    } else {
                        alert("This tag already exists.");
                    }
                }
            });
            tagContainer.appendChild(addTagButton);
        }

        updateTagDisplay();

        let longPressTimer = null;
        let connectionPointerId = null;
        let connectionStart = null;
        let connectionStarted = false;
        let lastPointerEvent = null;

        function shouldIgnoreConnectionStart(target) {
            return Boolean(
                target.closest('.drag-bar') ||
                target.closest('.delete-btn') ||
                target.closest('.color-palette') ||
                target.closest('.tag') ||
                target.closest('.card-title') ||
                target.closest('.card-blurb') ||
                target.closest('.resize-handle')
            );
        }

        function clearLongPressTimer() {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }

        function resetConnectionVisualState() {
            connectionPad.classList.remove('press-ready');
            connectionPad.classList.remove('active');
        }

        function endConnectionSequence(event, cancelled = false) {
            if (connectionPointerId === null || event.pointerId !== connectionPointerId) {
                return;
            }

            clearLongPressTimer();
            resetConnectionVisualState();
            if (div.hasPointerCapture(connectionPointerId)) {
                div.releasePointerCapture(connectionPointerId);
            }

            if (connectionStarted && !cancelled) {
                const target = findTargetAtPoint(event.clientX, event.clientY);
                finishConnectionDrag(target || null);
                suppressClick = true;
                setTimeout(() => {
                    suppressClick = false;
                }, 0);
            } else if (cancelled) {
                cancelActiveConnection();
            }

            connectionPointerId = null;
            connectionStart = null;
            connectionStarted = false;
            lastPointerEvent = null;
        }

        div.addEventListener('pointerdown', (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            if (shouldIgnoreConnectionStart(event.target)) return;

            cancelActiveConnection();
            connectionPointerId = event.pointerId;
            connectionStart = { x: event.clientX, y: event.clientY };
            connectionStarted = false;
            lastPointerEvent = event;
            div.setPointerCapture(connectionPointerId);

            clearLongPressTimer();
            resetConnectionVisualState();
            connectionPad.classList.add('press-ready');
            longPressTimer = setTimeout(() => {
                connectionStarted = true;
                connectionPad.classList.remove('press-ready');
                connectionPad.classList.add('active');
                startConnectionDrag({ type: 'card', id: card.id }, lastPointerEvent || event);
            }, LONG_PRESS_DURATION);
        });

        div.addEventListener('pointermove', (event) => {
            if (connectionPointerId === null || event.pointerId !== connectionPointerId) return;
            lastPointerEvent = event;

            if (!connectionStarted) {
                const dx = event.clientX - connectionStart.x;
                const dy = event.clientY - connectionStart.y;
                if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
                    clearLongPressTimer();
                    resetConnectionVisualState();
                    if (div.hasPointerCapture(connectionPointerId)) {
                        div.releasePointerCapture(connectionPointerId);
                    }
                    connectionPointerId = null;
                    connectionStart = null;
                    lastPointerEvent = null;
                }
                return;
            }

            updateConnectionDrag(event);
        });

        div.addEventListener('pointerup', (event) => endConnectionSequence(event));
        div.addEventListener('pointercancel', (event) => endConnectionSequence(event, true));

        // Resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.classList.add('resize-handle');
        resizeHandle.style.touchAction = 'none';
        div.appendChild(resizeHandle);

        let resizing = false;
        let resizePointerId = null;
        let startWidth = 0;
        let startHeight = 0;
        let startX = 0;
        let startY = 0;

        resizeHandle.addEventListener('pointerdown', (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            event.stopPropagation();
            cancelActiveConnection();
            resizing = true;
            resizePointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            startWidth = div.offsetWidth;
            startHeight = div.offsetHeight;
            resizeHandle.setPointerCapture(resizePointerId);
            event.preventDefault();
        });

        resizeHandle.addEventListener('pointermove', (event) => {
            if (!resizing || event.pointerId !== resizePointerId) return;
            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            const newWidth = Math.max(150, startWidth + deltaX);
            const newHeight = Math.max(100, startHeight + deltaY);
            div.style.width = newWidth + "px";
            div.style.height = newHeight + "px";
            card.width = newWidth;
            card.height = newHeight;
            renderConnections();
        });

        function endResize(event) {
            if (event.pointerId !== resizePointerId) return;
            resizing = false;
            if (resizeHandle.hasPointerCapture(resizePointerId)) {
                resizeHandle.releasePointerCapture(resizePointerId);
            }
            resizePointerId = null;
            renderConnections();
        }

        resizeHandle.addEventListener('pointerup', endResize);
        resizeHandle.addEventListener('pointercancel', endResize);

        container.appendChild(div);
    }

    function render() {
        cardElements.clear();
        container.innerHTML = "";
        connectionLayer = null;
        tempConnectionPath = null;
        activeConnection = null;
        ensureConnectionLayer();
        CardModel.getCards().forEach(createCardElement);
        renderConnections();
    }

    window.addEventListener('resize', () => {
        if (container.childElementCount === 0) return;
        renderConnections();
    });

    // Blurb modal event listeners
    cancelBlurbBtn.addEventListener('click', closeBlurbModal);
    confirmBlurbBtn.addEventListener('click', saveBlurb);

    // Close modal on overlay click
    blurbModal.addEventListener('click', (e) => {
        if (e.target === blurbModal) {
            closeBlurbModal();
        }
    });

    // Handle Enter key with Ctrl/Cmd to save
    blurbTextarea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            saveBlurb();
        }
    });

    return { render };
})();
