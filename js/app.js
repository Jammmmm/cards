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

document.getElementById("about-btn").addEventListener("click", () => {
    document.getElementById("about-modal").style.display = "flex";
});

document.getElementById("close-about").addEventListener("click", () => {
    document.getElementById("about-modal").style.display = "none";
});

if (CardModel.loadFromStorage()) {
    document.getElementById("session-title").value = CardModel.getSessionTitle();
}
CardUI.render();
