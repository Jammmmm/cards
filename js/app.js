document.getElementById("add-card").addEventListener("click", () => {
    CardModel.addCard();
    CardModel.persist();
    CardUI.render();
});

document.getElementById("new-session").addEventListener("click", () => {
    if (confirm("Are you sure you want to start a new session? All current cards and connections will be lost.")) {
        CardModel.loadCards({ cards: [], connectors: [] });
        CardModel.persist();
        document.getElementById("session-title").value = "";
        CardUI.render();
    }
});

document.getElementById("export-json").addEventListener("click", () => {
    CardExport.openExportDialog(); 
});

document.getElementById("save-screenshot").addEventListener("click", () => {
    const container = document.getElementById("card-container");
    html2canvas(container, {
        useCORS: true,
        scale: 2, 
    }).then(canvas => {
        const image = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = image;
        a.download = "cards-screenshot.png";
        a.click();
    });
});

document.getElementById("save-session").addEventListener("click", () => {
    const sessionState = CardModel.getState();
    const dataStr = JSON.stringify(sessionState, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cards-session.json";
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById("load-session-btn").addEventListener("click", () => {
    document.getElementById("load-session-input").click();
});

document.getElementById("load-session-input").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const loadedData = JSON.parse(e.target.result);
            CardModel.loadCards(loadedData);
            CardModel.persist();
            document.getElementById("session-title").value = CardModel.getSessionTitle();
            CardUI.render();
        } catch (error) {
            alert("Error: Could not parse the session file.");
            console.error(error);
        }
    };
    reader.readAsText(file);

    event.target.value = '';
});

document.getElementById("session-title").addEventListener("input", (event) => {
    CardModel.setSessionTitle(event.target.value);
    CardModel.persist();
});

document.getElementById("zoom-out").addEventListener("click", () => {
    CardUI.setZoom(CardUI.getZoom() - 0.1);
});

document.getElementById("zoom-in").addEventListener("click", () => {
    CardUI.setZoom(CardUI.getZoom() + 0.1);
});

document.getElementById("zoom-display").addEventListener("change", (event) => {
    const val = parseInt(event.target.value, 10);
    if (!isNaN(val)) CardUI.setZoom(val / 100);
});

const CARD_COLORS = ['#ffffff', '#fff0f0', '#f0faff', '#f5f5dc', '#f0fff0', '#fff9e6', '#ffe6f0', '#e6e6ff', '#ffe6d9', '#e6fff9', '#f9e6ff', '#ffffcc', '#ffd9e6', '#e6f9ff'];

document.getElementById("options-btn").addEventListener("click", () => {
    const defaults = CardModel.getCardDefaults();
    document.getElementById("default-card-title").value = defaults.title;
    document.getElementById("default-card-blurb").value = defaults.blurb;

    const palette = document.getElementById("default-color-palette");
    palette.innerHTML = '';
    CARD_COLORS.forEach(color => {
        const swatch = document.createElement('div');
        swatch.classList.add('color-swatch');
        swatch.style.backgroundColor = color;
        swatch.dataset.color = color;
        if (color === defaults.color) {
            swatch.classList.add('selected');
        }
        swatch.addEventListener('click', () => {
            palette.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            swatch.classList.add('selected');
        });
        palette.appendChild(swatch);
    });

    document.getElementById("show-background").checked = defaults.showBackground;
    document.getElementById("options-modal").style.display = "flex";
});

document.getElementById("cancel-options").addEventListener("click", () => {
    document.getElementById("options-modal").style.display = "none";
});

document.getElementById("confirm-options").addEventListener("click", () => {
    const title = document.getElementById("default-card-title").value;
    const blurb = document.getElementById("default-card-blurb").value;
    const selectedSwatch = document.querySelector("#default-color-palette .color-swatch.selected");
    const color = selectedSwatch ? selectedSwatch.dataset.color : '#ffffff';
    const showBackground = document.getElementById("show-background").checked;
    CardModel.setCardDefaults(title, blurb, color);
    CardModel.setShowBackground(showBackground);
    document.getElementById("card-container").classList.toggle("no-background", !showBackground);
    CardModel.persist();
    document.getElementById("options-modal").style.display = "none";
});

document.getElementById("options-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("options-modal")) {
        document.getElementById("options-modal").style.display = "none";
    }
});

document.getElementById("about-btn").addEventListener("click", () => {
    document.getElementById("about-modal").style.display = "flex";
});

document.getElementById("close-about").addEventListener("click", () => {
    document.getElementById("about-modal").style.display = "none";
});

if (CardModel.loadFromStorage()) {
    document.getElementById("session-title").value = CardModel.getSessionTitle();
}
if (!CardModel.getCardDefaults().showBackground) {
    document.getElementById("card-container").classList.add("no-background");
}
CardUI.render();
