Cards: A Simple Browser-Based Brainstorming Tool
================================================

This project is a lightweight, single-page web application for creating and organizing ideas on a digital canvas. It functions like a virtual corkboard, allowing users to create draggable "cards" for brainstorming, note-taking, or organizing thoughts.

* * *
**Try it live** [here](https://bertjerred.github.io/cards/)
* * *

Features
--------

* **Dynamic Card Creation**: Spin up a new card on the canvas with a single click.

* **Inline Editing**: Click a card's title or blurb to update it without leaving the canvas.

* **Freeform Drag & Drop**: Drag cards around with the dedicated handle to arrange ideas spatially.

* **Categorization & Styling**:

  * Add and remove
    **tags** to cluster related thoughts.

  * Choose from a soft
    **color palette** to create quick visual groupings.

  * Double-click a card to mark it as a
    **nucleus**, highlighting the most critical ideas.

* **Relationship Mapping**:

  * Long-press anywhere on a card to start a connector, then release over another card to describe the relationship between them.

  * Edit connectors by clicking their labels, or remove them via the context menu.

* **Session Management**:

  * Persist your progress locally with **Save Session** and restore it later with **Load Session**.

  * Capture a **high-resolution screenshot** of the current board (powered by [html2canvas](https://html2canvas.hertzen.com/)).

* **Advanced Exporting**:

  * Generate detailed reports from your board using the export dialog.

  * **Filter** exports by specific tags or card colors to craft targeted summaries.

  * Export in multiple formats:
    **Markdown, HTML, or JSON**, including connector data when relevant.

* * *

How to Use
----------

No installation or build process is required. Simply open the `index.html` file in any modern web browser to start using the application.

Once the page loads:

1. Click **Add Card** to drop a new idea on the canvas, then click the text to edit it.
2. Drag cards with the grip icon in the upper-left corner to rearrange your board.
3. Long-press on a card body to start drawing a connector, release over another card, and choose a relationship description.
4. Use **Save Session** / **Load Session** to preserve progress, **Save Screenshot** for quick sharing, and **Export Report** to generate Markdown, HTML, or JSON summaries filtered by tags or colors.

* * *

File Structure
--------------

The project code is organized to separate concerns between data, user interface, and application logic.

* `index.html`: The main HTML document that structures the page and contains the containers for the toolbar, cards, and export modal.

* `css/style.css`: Contains all the styling for the application, including cards, tags, and the export modal.

* `js/app.js`: The main entry point for the JavaScript, which initializes the application and sets up the primary event listeners for adding cards and opening the export dialog.

* `js/model.js`: Manages the application's state, including the array of card data and functions to add or update cards.

* `js/ui/cards.js`: Handles all DOM manipulation related to displaying, creating, and interacting with the cards on the screen, including drag-and-drop, editing, and styling.

* `js/ui/export.js`: Contains all logic for the export modal, filtering cards based on user selection, and generating the report files in different formats.
