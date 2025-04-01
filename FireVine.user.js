// ==UserScript==
// @name        FireVine
// @namespace   https://github.com/wattsoner/FireVine
// @run-at      document-start
// @match       https://www.amazon.co.uk/vine/vine-items*
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_addStyle
// @grant       GM_listValues
// @version     0.1.1
// @description Reskinned, optimised fork of MDK23' VineToolsUK - FireVine by wattie / 8068. Now with integrated OC Order (instant-purchase) functionality.
// ==/UserScript==

GM_addStyle(`
  #vvp-items-grid {
    display: none !important;
  }
`);

(function () {
  "use strict";

  function init() {
    const rootElement = document.querySelector(":root");
    const gridContainer = document.querySelector("#vvp-items-grid-container > p");
    if (!gridContainer) return; // exit if container not found

    let hiddenCount = 0;
    let filteredCount = 0;
    const bgColour = window.getComputedStyle(document.body).getPropertyValue("background-color");
    const textColour = "Firebrick";

    // Image symbol URLs
    const hideSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/eye-black.png";
    const unhideSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/angry-eye-red.png";
    const filterSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/abc-100.png";
    const unfilterSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/remove-100.png";
    const highlightSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/highlight-100.png";
    const unhighlightSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/remove-100.png";
    const resetCacheSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/reset-100.png";
    const ocOrderSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/remove-100.png"; // New symbol for OC Order
    const showCountChangeSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/remove-100.png"; // New symbol for Show Count Change in AI

    // Text constants
    const hiddenText = " Items hidden";
    const filteredText = " Items filtered";
    const filterMessage = "Enter a keyword, phrase, or regular expression to filter items:";
    const unfilterMessage = "Enter the number of the item to remove the filter, or type 'more' or 'm' to see more items:";
    const filterText = "Filter by keyword/phrase";
    const unfilterText = "Remove keyword/phrase filter";
    const highlightText = "Highlight keyword/phrase";
    const unhighlightText = "Remove highlight from keyword/phrase";
    const menuText = "Settings";
    const showMessage = "Show all hidden & filtered items";
    const hideMessage = "Hide all items on this page";
    const unhideMessage = "Unhide all items on this page";
    const nofiltersMessage = "No items to remove";
    const invalidfilterMessage = "Invalid index number entered";
    const moreText = "Show more";
    const nomoreText = "No more items to show";
    const deleteText = "Delete this item";
    const clearCacheText = "Clear hidden items cache";

    const isNarrowViewport = window.innerWidth < 1000;
    const menuTextNarrow = isNarrowViewport ? "Advanced" : menuText;
    const showMessageNarrow = isNarrowViewport ? "Show Hidden" : showMessage;
    const hideMessageNarrow = isNarrowViewport ? "Hide all" : hideMessage;
    const unhideMessageNarrow = isNarrowViewport ? "Unhide all" : unhideMessage;

    // Create the settings menu element
    const fragment = document.createDocumentFragment();
    const messageSpan = document.createElement("span");
    messageSpan.innerHTML = `
      <span id="hideVineItems-count"></span>
      <span class="bullet">&#x2022;</span>
      <span id="hideVineItems-toggleText">${showMessageNarrow}</span>
      <label class="switch">
        <input id="hideVineItems-togglePage" type="checkbox" autocomplete="off">
        <span class="slider round"></span>
      </label><br>
      <a id="hideVineItems-hideAll">${hideMessageNarrow}</a>
      <span class="bullet">&#x2022;</span>
      <a id="hideVineItems-unhideAll">${unhideMessageNarrow}</a>
      <span class="bullet">&#x2022;</span>
      <span class="dropdown">
        <a id="hideVineItems-filtersMenu">${menuTextNarrow}</a>
        <div class="dropdown-content">
          <a id="hideVineItems-filterText">${filterText}</a>
          <a id="hideVineItems-unfilterText">${unfilterText}</a>
          <hr>
          <a id="hideVineItems-highlightText">${highlightText}</a>
          <a id="hideVineItems-unhighlightText">${unhighlightText}</a>
          <hr>
          <a id="hideVineItems-clearCache">${clearCacheText}</a>
          <hr>
          <label id="showCountChangeLabel">
            <input id="showCountChangeToggle" type="checkbox"> Show Count Change in AI
          </label>
          <hr>
          <a id="hideVineItems-ocOrderMenu">OC Order</a>
          <div id="hideVineItems-ocOrderContent" style="display:none; padding-left: 10px;">
            <label><input id="enableOCOrder" type="checkbox"> Enable OC Order</label>
            <label><input id="enableConfirmation" type="checkbox" checked> Confirmation</label>
          </div>
        </div>
      </span>
    `;
    fragment.appendChild(messageSpan);
    gridContainer.appendChild(fragment);

    // Cache some commonly used elements
    const countEl = messageSpan.querySelector("#hideVineItems-count");
    const togglePageCheckbox = messageSpan.querySelector("#hideVineItems-togglePage");

    // Helper to remove the dropdown-click class from all dropdown menus
    const resetDropdowns = () => {
      document.querySelectorAll(".dropdown .dropdown-content").forEach((el) => el.classList.remove("dropdown-click"));
    };

    // Toggle showing hidden/filtered items on the page
    const toggleHidden = () => {
      if (togglePageCheckbox.checked) {
        rootElement.classList.add("hideVineItems-showHidden");
      } else {
        rootElement.classList.remove("hideVineItems-showHidden");
      }
    };

    // Update the counter display
    const updateCount = () => {
      countEl.textContent = `(${hiddenCount}${hiddenText} / ${filteredCount}${filteredText})`;
    };

    // Check if an ASIN is in the hidden cache
    const isHidden = (ASIN) => Boolean(GM_getValue("ASIN:" + ASIN));

    // Return true if the product description matches any saved keyword in the given filter type
    const containsKeyword = (filtertype, productDescription) => {
      const savedKeywords = JSON.parse(GM_getValue(filtertype + ":", null));
      return savedKeywords ? savedKeywords.some((keyword) => productDescription.match(new RegExp(keyword, "gi"))) : false;
    };

    // Add a clickable hide/unhide icon to each item tile
    const addHideLink = (tile, ASIN) => {
      const tileContent = tile.querySelector(".vvp-item-tile .vvp-item-tile-content");
      if (!tileContent) return;
      const filteredProduct = tile.querySelector(".vvp-item-tile:not(.hideVineItems-filterProduct) .vvp-item-tile-content");
      const hideLink = document.createElement("span");
      if (filteredProduct) {
        hideLink.addEventListener("click", () => {
          tile.classList.toggle("hideVineItems-hideASIN");
          if (isHidden(ASIN)) {
            GM_deleteValue("ASIN:" + ASIN);
            hiddenCount--;
          } else {
            GM_setValue("ASIN:" + ASIN, new Date().toJSON().slice(0, 10));
            hiddenCount++;
          }
          updateCount();
        });
      }
      hideLink.classList.add("hideVineItems-toggleASIN");
      tileContent.append(hideLink);
    };

    // Convert legacy ASIN values if needed
    const convertASIN = () => {
      if (GM_getValue("CONFIG:DBUpgraded") !== true) {
        const gmValues = GM_listValues();
        const storageOrphans = gmValues.filter((key) => !key.includes(":"));
        storageOrphans.forEach((orphan) => {
          GM_setValue("ASIN:" + orphan, GM_getValue(orphan));
          GM_deleteValue(orphan);
        });
        GM_setValue("CONFIG:DBUpgraded", true);
      }
    };

    // Convert legacy filter keywords if needed
    const convertFilters = () => {
      if (!GM_getValue("FILTERS:")) {
        const gmValues = GM_listValues();
        const newFilters = gmValues
          .filter((key) => key.startsWith("KEYWORD:"))
          .map((key) => key.substring(8));
        if (newFilters.length > 0) {
          GM_setValue("FILTERS:", JSON.stringify(newFilters));
        }
        gmValues.forEach((key) => {
          if (key.startsWith("KEYWORD:")) {
            GM_deleteValue(key);
          }
        });
      }
    };

    // Show a prompt to add a new keyword/regex filter
    const displayaddPopup = (filtertype) => {
      resetDropdowns();
      const response = prompt(filterMessage, "");
      if (response && response.length > 0) {
        const newFilters = JSON.parse(GM_getValue(filtertype + ":", "[]"));
        newFilters.push(response);
        GM_setValue(filtertype + ":", JSON.stringify(newFilters));
        location.reload();
      }
    };

    // Show a prompt to remove an existing filter
    const displayremovePopup = (filtertype) => {
      resetDropdowns();
      const numberedFilters = JSON.parse(GM_getValue(filtertype + ":"));
      if (numberedFilters && numberedFilters.length > 0) {
        const originalFilters = [...numberedFilters];
        let response;
        let start = 0;
        let end = 20;
        while (numberedFilters.length > 0) {
          if (end > numberedFilters.length) {
            end = numberedFilters.length;
          }
          if (start < numberedFilters.length) {
            let message = unfilterMessage + "\r\n\r\n";
            for (let i = start; i < end; i++) {
              const filter = numberedFilters[i].length >= 60 ? `${numberedFilters[i].substring(0, 56)} ...` : numberedFilters[i];
              message += `${i + 1}. ${filter}\r\n`;
            }
            response = prompt(message, "");
            if (response == null) {
              break;
            } else if (response.toLowerCase() === moreText.toLowerCase() || response.toLowerCase() === moreText.charAt(0)) {
              start += 20;
              end += 20;
            } else {
              const index = parseInt(response);
              if (index >= start + 1 && index <= end) {
                numberedFilters.splice(index - 1, 1);
                end--;
                break;
              } else {
                alert(invalidfilterMessage);
              }
            }
          } else {
            alert(nomoreText);
            response = null;
            break;
          }
        }
        if (response != null) {
          const strdelete = confirm(`${deleteText} '${originalFilters[response - 1]}'?`);
          if (strdelete) {
            GM_setValue(filtertype + ":", JSON.stringify(numberedFilters));
            location.reload();
          }
        }
      } else {
        alert(nofiltersMessage);
      }
    };

    // Clear all hidden items from the cache
    const clearHiddenCache = () => {
      const gmValues = GM_listValues();
      const hiddenItems = gmValues.filter((key) => key.startsWith("ASIN:"));
      hiddenItems.forEach((item) => GM_deleteValue(item));
      hiddenCount = 0;
      updateCount();
      alert("All cached hidden items have been cleared.");
      location.reload();
    };

    // Functions for counting and comparing item numbers in tabs
    const getCountFromPage = () => {
      const tabs = document.querySelectorAll(".parent-node");
      const counts = {};
      tabs.forEach((tab) => {
        const countSpan = tab.querySelector("span");
        if (countSpan) {
          const countMatch = countSpan.textContent.match(/\((\d+)\)/);
          if (countMatch) {
            const count = parseInt(countMatch[1]);
            const tabName = tab.querySelector("a").textContent.trim();
            counts[tabName] = count;
          }
        }
      });
      return counts;
    };

    const compareCounts = (oldCounts, newCounts) => {
      const showCountChange = GM_getValue("showCountChange", true);
      if (!showCountChange) return;
      for (const tabName in newCounts) {
        if (oldCounts.hasOwnProperty(tabName)) {
          const oldCount = oldCounts[tabName];
          const newCount = newCounts[tabName];
          const difference = newCount - oldCount;
          const tabElement = Array.from(document.querySelectorAll(".parent-node")).find(
            (el) => el.querySelector("a").textContent.trim() === tabName
          );
          if (tabElement && difference !== 0) {
            const countSpan = tabElement.querySelector("span");
            if (countSpan) {
              countSpan.textContent = ` (${newCount} ${difference > 0 ? "+" : ""}${difference})`;
            }
          }
        }
      }
    };

    const isAdditionalItemsTab = () => location.search.includes("queue=encore");

    // Compare tab counts if we are on the Additional Items tab
    if (isAdditionalItemsTab()) {
      const previousCounts = JSON.parse(GM_getValue("tabCounts_AdditionalItems", "{}"));
      const currentCounts = getCountFromPage();
      compareCounts(previousCounts, currentCounts);
      GM_setValue("tabCounts_AdditionalItems", JSON.stringify(currentCounts));
    }

    // Convert legacy data (if necessary)
    convertASIN();
    convertFilters();

    // Process each item tile on the page
    const itemTiles = document.querySelectorAll(".vvp-item-tile");
    itemTiles.forEach((tile) => {
      const itemLink = tile.querySelector(".vvp-item-product-title-container > a[href^='/dp/']");
      if (itemLink) {
        const ASIN = itemLink.getAttribute("href").slice(4);
        const linkText = itemLink.textContent;
        if (isHidden(ASIN)) {
          tile.classList.add("hideVineItems-hideASIN");
          hiddenCount++;
        } else {
          if (containsKeyword("HIGHLIGHTS", linkText)) {
            tile.classList.add("hideVineItems-highlightProduct");
          } else if (containsKeyword("FILTERS", linkText)) {
            tile.classList.add("hideVineItems-filterProduct");
            filteredCount++;
          }
        }
        addHideLink(tile, ASIN);
      }
    });

    // Auto-toggle the hidden items display if a search parameter is present
    if (location.search.includes("search=")) {
      togglePageCheckbox.checked = true;
      rootElement.classList.toggle("hideVineItems-showHidden");
    }

    updateCount();

    // Set up event listeners for the main controls
    togglePageCheckbox.addEventListener("change", toggleHidden);
    messageSpan.querySelector("#hideVineItems-hideAll").addEventListener("click", () => {
      document
        .querySelectorAll(".vvp-item-tile:not(.hideVineItems-hideASIN) .hideVineItems-toggleASIN")
        .forEach((hideLink) => hideLink.click());
    });
    messageSpan.querySelector("#hideVineItems-unhideAll").addEventListener("click", () => {
      document
        .querySelectorAll(".vvp-item-tile.hideVineItems-hideASIN .hideVineItems-toggleASIN")
        .forEach((hideLink) => hideLink.click());
    });
    messageSpan.querySelector("#hideVineItems-filterText").addEventListener("click", () => displayaddPopup("FILTERS"));
    messageSpan.querySelector("#hideVineItems-unfilterText").addEventListener("click", () => displayremovePopup("FILTERS"));
    messageSpan.querySelector("#hideVineItems-highlightText").addEventListener("click", () => displayaddPopup("HIGHLIGHTS"));
    messageSpan.querySelector("#hideVineItems-unhighlightText").addEventListener("click", () => displayremovePopup("HIGHLIGHTS"));
    messageSpan.querySelector("#hideVineItems-clearCache").addEventListener("click", clearHiddenCache);
    messageSpan.querySelector("#hideVineItems-filtersMenu").addEventListener("click", () => {
      document.querySelectorAll(".dropdown .dropdown-content").forEach((el) => el.classList.toggle("dropdown-click"));
    });

    const showCountChangeToggle = document.getElementById("showCountChangeToggle");
    showCountChangeToggle.addEventListener("change", function () {
      GM_setValue("showCountChange", this.checked);
    });
    showCountChangeToggle.checked = GM_getValue("showCountChange", true);

    // Toggle OC Order submenu display
    document.getElementById("hideVineItems-ocOrderMenu").addEventListener("click", function () {
      const content = document.getElementById("hideVineItems-ocOrderContent");
      content.style.display = content.style.display === "none" ? "block" : "none";
    });

    // Load OC Order settings
    const enableOCOrderEl = document.getElementById("enableOCOrder");
    const enableConfirmationEl = document.getElementById("enableConfirmation");
    const enableOCOrder = GM_getValue("enableOCOrder", true);
    const enableConfirmation = GM_getValue("enableConfirmation", true);
    enableOCOrderEl.checked = enableOCOrder;
    enableConfirmationEl.checked = enableConfirmation;
    enableOCOrderEl.addEventListener("change", function () {
      GM_setValue("enableOCOrder", this.checked);
      // A page reload is needed for changes to take effect.
      alert("OC Order setting changed. Please reload the page for changes to take effect.");
    });
    enableConfirmationEl.addEventListener("change", function () {
      GM_setValue("enableConfirmation", this.checked);
    });

    // Add the dynamic CSS styles (including OC Order related styling)
    GM_addStyle(`
      #hideVineItems-hideAll, #hideVineItems-unhideAll, #hideVineItems-filtersMenu, #showCountChangeLabel {
        color: Firebrick;
      }
      #hideVineItems-hideAll:hover, #hideVineItems-unhideAll:hover, #hideVineItems-filtersMenu:hover, #showCountChangeLabel:hover {
        color: #C7511F;
        text-decoration: underline;
      }
      .hideVineItems-hideASIN, .hideVineItems-filterProduct {
        display: none;
      }
      .vvp-item-tile-content {
        position: relative;
      }
      .hideVineItems-toggleASIN {
        position: absolute;
        width: 20px !important;
        height: 17px !important;
        overflow: hidden;
        top: 2px;
        right: 0;
        background-color: transparent;
        padding: 0;
        background: url("${hideSymbol}");
        background-repeat: no-repeat;
        background-size: contain;
      }
      .hideVineItems-hideASIN .vvp-item-tile-content .hideVineItems-toggleASIN {
        background: url("${unhideSymbol}");
        background-repeat: no-repeat;
        background-size: contain;
      }
      .hideVineItems-filterProduct .vvp-item-tile-content .hideVineItems-toggleASIN {
        background: url("${filterSymbol}");
        background-repeat: no-repeat;
        background-size: contain;
      }
      .hideVineItems-showHidden .hideVineItems-hideASIN, .hideVineItems-showHidden .hideVineItems-filterProduct {
        display: unset;
      }
      .hideVineItems-showHidden .hideVineItems-hideASIN img, .hideVineItems-showHidden .hideVineItems-hideASIN .a-button, .hideVineItems-showHidden .hideVineItems-hideASIN a,
      .hideVineItems-showHidden .hideVineItems-filterProduct img, .hideVineItems-showHidden .hideVineItems-filterProduct .a-button, .hideVineItems-showHidden .hideVineItems-filterProduct a {
        opacity: 50%;
      }
      .hideVineItems-highlightProduct {
        background-color: rgba(255, 165, 0, 0.3);
        border: 1px solid orange;
        padding: 1px;
        box-shadow: 0 4px 8px rgba(255, 165, 0, 0.3);
      }
      .hideVineItems-highlightProduct img {
        opacity: 0.9;
      }
      #hideVineItems-hideAll {
        background: url("${hideSymbol}");
        background-repeat: no-repeat;
        background-size: contain;
        padding-left: 30px;
      }
      #hideVineItems-unhideAll {
        background: url("${unhideSymbol}");
        background-repeat: no-repeat;
        background-size: contain;
        padding-left: 30px;
      }
      #hideVineItems-filterText {
        background: url("${filterSymbol}");
        background-repeat: no-repeat;
        background-size: contain;
        padding-left: 40px;
      }
      #hideVineItems-unfilterText {
        background: url("${unfilterSymbol}");
        background-repeat: no-repeat;
        background-size: contain;
        padding-left: 40px;
      }
      #hideVineItems-highlightText {
        background: url("${highlightSymbol}");
        background-repeat: no-repeat;
        background-size: contain;
        padding-left: 40px;
      }
      #hideVineItems-unhighlightText {
        background: url("${unhighlightSymbol}");
        background-repeat: no-repeat;
        background-size: contain;
        padding-left: 40px;
      }
      #hideVineItems-clearCache {
        background: url("${resetCacheSymbol}");
        background-repeat: no-repeat;
        background-size: contain;
        padding-left: 40px;
      }
      #hideVineItems-filtersMenu {
        background: url("${unfilterSymbol}");
        background-repeat: no-repeat;
        background-size: contain;
        padding-left: 30px;
      }
      #showCountChangeLabel {
        background: url("${showCountChangeSymbol}");
        background-repeat: no-repeat;
        background-size: contain;
        padding-left: 30px;
        display: block;
      }
      .bullet {
        margin-left: 10px;
        margin-right: 10px;
      }
      .switch {
        position: relative;
        display: inline-block;
        width: 32px;
        height: 20px;
        margin-left: 10px;
        margin-bottom: 5px;
      }
      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: .4s;
      }
      .slider:before {
        position: absolute;
        content: "";
        height: 12px;
        width: 12px;
        left: 4px;
        bottom: 4px;
        background-color: white;
        transition: .4s;
      }
      input:checked + .slider {
        background-color: #2196F3;
      }
      input:focus + .slider {
        box-shadow: 0 0 1px #2196F3;
      }
      input:checked + .slider:before {
        transform: translateX(12px);
      }
      .slider.round {
        border-radius: 12px;
      }
      .slider.round:before {
        border-radius: 50%;
      }
      .dropdown {
        display: inline-block;
        position: relative;
      }
      .dropdown-content {
        background-color: ${bgColour};
        display: none;
        position: absolute;
        width: max-content;
        overflow: auto;
        box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
        z-index: 5000;
        padding: 5px;
        border: 0.5px solid ${textColour};
      }
      .dropdown:hover .dropdown-content {
        display: block;
      }
      .dropdown .dropdown-click {
        display: block;
      }
      .dropdown-content a {
        display: block;
        color: Firebrick;
        text-decoration: none;
        margin: 5px;
        width: auto;
      }
      .dropdown-content a:hover {
        color: #C7511F;
      }
      hr {
        margin-top: 10px;
      }
      #hideVineItems-ocOrderMenu {
        background: url("${ocOrderSymbol}");
        background-repeat: no-repeat;
        background-size: contain;
        padding-left: 30px;
      }
      #vvp-items-grid {
        display: grid !important;
      }
    `);

    if (GM_getValue("enableOCOrder", true)) {
      setupOCOrder();
    }

    function setupOCOrder() {
      
      const csrfInput = document.querySelector('input[name="csrf-token"]');
      if (!csrfInput) {
        console.error("CSRF token not found. OC Order functionality will not work.");
        return;
      }
      const CRSRF_TOKEN = csrfInput.value;

      if (!document.getElementById("notification-popup")) {
        const style = document.createElement("style");
        style.textContent = `
          #notification-popup {
            display: none;
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: #333;
            color: #fff;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            max-width: 400px;
            word-wrap: break-word;
            z-index: 1000;
            font-size: 14px;
            font-family: Arial, sans-serif;
            white-space: pre-wrap;
          }
          #address-selector {
            margin: 10px 0;
            padding: 5px;
            font-size: 14px;
          }
        `;
        document.head.appendChild(style);
      }
      if (!document.getElementById("notification-popup")) {
        const notification = document.createElement("div");
        notification.id = "notification-popup";
        document.body.appendChild(notification);
      }
      
      function showNotification(text, duration = 5000) {
        const notification = document.getElementById("notification-popup");
        if (!notification) return;
        notification.textContent = text;
        notification.style.display = "block";
        setTimeout(() => {
          notification.style.display = "none";
        }, duration);
      }

      function createAddressDropdown() {
        const addressElements = document.querySelectorAll(".vvp-address-option");
        if (addressElements.length === 0) {
          showNotification("No address options available");
          return;
        }
        const dropdown = document.createElement("select");
        dropdown.style.marginRight = "10px";
        dropdown.id = "address-selector";

        addressElements.forEach((element) => {
          const addressId = element.getAttribute("data-address-id");
          const legacyAddressId = element.getAttribute("data-legacy-address-id");
          // Use only the street address (first span inside .a-radio-label)
          const streetAddress = element.querySelector(".a-radio-label > span:nth-of-type(1)")?.textContent.trim();
          if (streetAddress) {
            const option = document.createElement("option");
            option.value = addressId;
            option.textContent = streetAddress;
            option.dataset.legacyAddressId = legacyAddressId;
            dropdown.appendChild(option);
          }
        });

        // Use stored address IDs if available, otherwise default to first option
        let selectedAddressId = localStorage.getItem("selectedAddressId");
        let selectedLegacyAddressId = localStorage.getItem("selectedLegacyAddressId");
        if (dropdown.options.length > 0) {
          if (selectedAddressId) {
            dropdown.value = selectedAddressId;
          } else {
            selectedAddressId = dropdown.options[0].value;
            selectedLegacyAddressId = dropdown.options[0].dataset.legacyAddressId;
            localStorage.setItem("selectedAddressId", selectedAddressId);
            localStorage.setItem("selectedLegacyAddressId", selectedLegacyAddressId);
          }
        }
        dropdown.onchange = function () {
          localStorage.setItem("selectedAddressId", this.value);
          localStorage.setItem("selectedLegacyAddressId", this.options[this.selectedIndex].dataset.legacyAddressId);
        };
        
        const container = document.querySelector(".a-section.vvp-container-right-align");
        if (container) {
          container.prepend(dropdown);
        } else {
          document.body.prepend(dropdown);
        }
      }

      createAddressDropdown();

      function createCartPurchaseButton(item) {
        const inputEl = item.querySelector('input[data-is-parent-asin]');
        if (!inputEl) return;
        const isParent = inputEl.getAttribute("data-is-parent-asin") === "true";
        const btnInput = item.querySelector(".vvp-details-btn .a-button-input");
        if (!btnInput) return;
        let asin = btnInput.dataset.asin;
        const recommendationId = item.getAttribute("data-recommendation-id");
        if (!recommendationId) return;

        const cartButton = document.createElement("button");
        cartButton.type = "button";
        cartButton.className = "a-button a-button-primary a-button-small";
        cartButton.style.marginTop = "-10px";
        cartButton.style.height = "30px";
        cartButton.style.display = "block";
       
        const buttonText = isParent ? "🛍️" : "🛒";
        cartButton.innerHTML = `<span class="a-button-inner"><span class="a-button-text emoji">${buttonText}</span></span>`;

        cartButton.addEventListener("click", async function () {
          
          if (GM_getValue("enableConfirmation", true)) {
            if (!confirm("Proceed with purchase?")) return;
          }
          await cartPurchase(recommendationId, asin, isParent);
        });

        const content = item.querySelector(".vvp-item-tile-content");
        if (content) {
          content.appendChild(cartButton);
        }
      }

      async function cartPurchase(recommendationId, asin, isParent) {
  
        if (isParent) {
          const encodedId = encodeURIComponent(recommendationId);
          const url = `https://www.amazon.co.uk/vine/api/recommendations/${encodedId}`;
          try {
            const response = await fetch(url);
            const data = await response.json();
            asin = data.result?.variations?.[0]?.asin;
            if (!asin) {
              showNotification("Could not retrieve variation ASIN");
              return;
            }
          } catch (error) {
            showNotification("Error fetching variation ASIN");
            return;
          }
        }
        const selectedAddressId = localStorage.getItem("selectedAddressId");
        const selectedLegacyAddressId = localStorage.getItem("selectedLegacyAddressId");
        if (!recommendationId || !asin || !selectedAddressId || !selectedLegacyAddressId || !CRSRF_TOKEN) {
          showNotification("Missing one or more key variables for purchase.");
          return;
        }
        const payload = JSON.stringify({
          recommendationId: recommendationId,
          recommendationType: "SEARCH",
          itemAsin: asin,
          addressId: selectedAddressId,
          legacyAddressId: selectedLegacyAddressId
        });
        try {
          const req = await fetch("https://www.amazon.co.uk/vine/api/voiceOrders", {
            method: "POST",
            body: payload,
            headers: {
              "anti-csrftoken-a2z": CRSRF_TOKEN,
              "content-type": "application/json"
            }
          });
          const response = await req.json();
          showNotification(JSON.stringify(response));
        } catch (error) {
          showNotification("Purchase failed");
        }
      }
      
      const itemTiles = document.querySelectorAll(".vvp-item-tile");
      itemTiles.forEach(createCartPurchaseButton);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
