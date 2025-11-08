const CardUI = (() => {
    const container = document.getElementById("card-container");
    const svgNS = "http://www.w3.org/2000/svg";
    const LONG_PRESS_DURATION = 500;
    const MOVE_THRESHOLD = 6;
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

        CardModel.getConnectors().forEach(connector => {
            const start = getCardCenter(connector.fromCardId);
            const end = getCardCenter(connector.toCardId);
            if (!start || !end) {
                return;
            }

            const control = computeControlPoint(start, end);
            const path = document.createElementNS(svgNS, 'path');
            path.classList.add('connector-path');
            path.setAttribute('d', `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`);
            path.dataset.connectorId = connector.id;
            layer.appendChild(path);

            const midPoint = computeQuadraticPoint(start, control, end, 0.5);
            const text = document.createElementNS(svgNS, 'text');
            text.classList.add('connector-label');
            text.setAttribute('x', midPoint.x);
            text.setAttribute('y', midPoint.y - 6);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'central');
            text.textContent = connector.type;
            text.dataset.connectorId = connector.id;
            layer.appendChild(text);

            const editHandler = () => editConnector(connector.id);
            const deleteHandler = (event) => {
                event.preventDefault();
                deleteConnectorWithConfirm(connector.id);
            };

            path.addEventListener('click', editHandler);
            text.addEventListener('click', editHandler);
            path.addEventListener('contextmenu', deleteHandler);
            text.addEventListener('contextmenu', deleteHandler);
        });

        if (activeConnection && tempConnectionPath) {
            layer.appendChild(tempConnectionPath);
        }
    }

    function startConnectionDrag(cardId, pointerEvent) {
        const start = getCardCenter(cardId);
        if (!start) return;
        ensureConnectionLayer();

        activeConnection = {
            fromCardId: cardId,
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
        const { start } = activeConnection;
        const control = computeControlPoint(start, end);
        tempConnectionPath.setAttribute('d', `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`);
    }

    function finishConnectionDrag(targetCardId) {
        if (tempConnectionPath && tempConnectionPath.parentNode) {
            tempConnectionPath.parentNode.removeChild(tempConnectionPath);
        }
        tempConnectionPath = null;

        if (activeConnection && targetCardId && targetCardId !== activeConnection.fromCardId) {
            const suggestionText = `Suggestions: ${RELATION_SUGGESTIONS.join(', ')}`;
            const relationType = prompt(`Relationship type between cards?\n${suggestionText}`, RELATION_SUGGESTIONS[0]);
            if (relationType !== null) {
                const trimmed = relationType.trim();
                const created = CardModel.addConnector(activeConnection.fromCardId, targetCardId, trimmed || RELATION_SUGGESTIONS[0]);
                if (!created) {
                    alert('A connector with this relationship already exists between the selected cards.');
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
    }

    function createCardElement(card) {
        const div = document.createElement("div");
        div.classList.add("card");
        if (card.nucleus) div.classList.add("nucleus");
        div.style.left = card.x + "px";
        div.style.top = card.y + "px";
        div.style.backgroundColor = card.color;
        div.dataset.cardId = card.id;
        cardElements.set(card.id, div);

        let suppressClick = false;

        const titleDiv = document.createElement("div");
        titleDiv.classList.add("card-title");
        titleDiv.textContent = card.title;
        div.appendChild(titleDiv);

        const blurbDiv = document.createElement("div");
        blurbDiv.classList.add("card-blurb");
        blurbDiv.textContent = card.blurb;
        div.appendChild(blurbDiv);

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
            const newBlurb = prompt("Edit Blurb:", card.blurb);
            if (newBlurb !== null) {
                card.blurb = newBlurb;
                blurbDiv.textContent = newBlurb;
            }
        });

        div.addEventListener("dblclick", (e) => {
            if (e.target === div) {
                card.nucleus = !card.nucleus;
                div.classList.toggle("nucleus");
            }
        });

        const dragHandle = document.createElement("div");
        dragHandle.classList.add("drag-handle");
        dragHandle.innerHTML = "⠿";
        dragHandle.style.touchAction = 'none';
        div.appendChild(dragHandle);

        const deleteBtn = document.createElement("div");
        deleteBtn.classList.add("delete-btn");
        deleteBtn.innerHTML = "&times;";
        div.appendChild(deleteBtn);

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

        dragHandle.addEventListener('pointerdown', (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            cancelActiveConnection();
            dragging = true;
            dragPointerId = event.pointerId;
            const rect = div.getBoundingClientRect();
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;
            div.style.cursor = "grabbing";
            dragHandle.setPointerCapture(dragPointerId);
            event.preventDefault();
        });

        dragHandle.addEventListener('pointermove', (event) => {
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
            div.style.cursor = "grab";
            if (dragHandle.hasPointerCapture(dragPointerId)) {
                dragHandle.releasePointerCapture(dragPointerId);
            }
            dragPointerId = null;
            renderConnections();
        }

        dragHandle.addEventListener('pointerup', endDrag);
        dragHandle.addEventListener('pointercancel', endDrag);

        const colors = ['#ffffff', '#fff0f0', '#f0faff', '#f5f5dc', '#f0fff0'];
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

        div.appendChild(palette);

        const tagContainer = document.createElement("div");
        tagContainer.classList.add("tags");
        div.appendChild(tagContainer);

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
                target.closest('.drag-handle') ||
                target.closest('.delete-btn') ||
                target.closest('.color-palette') ||
                target.closest('.tag')
            );
        }

        function clearLongPressTimer() {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }

        function endConnectionSequence(event, cancelled = false) {
            if (connectionPointerId === null || event.pointerId !== connectionPointerId) {
                return;
            }

            clearLongPressTimer();
            if (div.hasPointerCapture(connectionPointerId)) {
                div.releasePointerCapture(connectionPointerId);
            }

            if (connectionStarted && !cancelled) {
                const elementUnderPointer = document.elementFromPoint(event.clientX, event.clientY);
                const targetCard = elementUnderPointer ? elementUnderPointer.closest('.card') : null;
                const targetId = targetCard ? Number(targetCard.dataset.cardId) : null;
                finishConnectionDrag(targetId || null);
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
            longPressTimer = setTimeout(() => {
                connectionStarted = true;
                startConnectionDrag(card.id, lastPointerEvent || event);
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

    return { render };
})();
