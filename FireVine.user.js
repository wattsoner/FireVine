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
// @description Reskinned, optimised fork of MDK23' VineToolsUK - FireVine by wattie / 8068
// ==/UserScript==

GM_addStyle(`
#vvp-items-grid {
  display:none !important;
}
`);

document.onreadystatechange = function () {
  if (document.readyState === "interactive") {

    const rootElement = document.querySelector(":root");
    const gridContainer = document.querySelector("#vvp-items-grid-container > p");

    let hiddenCount = 0;
    let filteredCount = 0;
    const bgColour = window.getComputedStyle(document.body).getPropertyValue('background-color');
    const textColour = 'Firebrick';
    const hideSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/eye-black.png";
    const unhideSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/angry-eye-red.png";
    const filterSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/abc-100.png";
    const unfilterSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/remove-100.png";
    const highlightSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/highlight-100.png";
    const unhighlightSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/remove-100.png";
    const resetCacheSymbol = "https://raw.githubusercontent.com/wattsoner/FireVine/main/assets/reset-100.png";
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

    const fragment = document.createDocumentFragment();
    const messageSpan = document.createElement("span");
    messageSpan.innerHTML = `
      <span id="hideVineItems-count"></span>
      <span class="bullet">&#x2022</span>
      <span id="hideVineItems-toggleText">${showMessageNarrow}</span>
      <label class="switch"><input id="hideVineItems-togglePage" type="checkbox" autocomplete="off"><span class="slider round"></span></label><br>
      <a id="hideVineItems-hideAll">${hideMessageNarrow}</a>
      <span class="bullet">&#x2022</span>
      <a id="hideVineItems-unhideAll">${unhideMessageNarrow}</a>
      <span class="bullet">&#x2022</span>
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
        </div>
      </span>
    `;
    fragment.appendChild(messageSpan);
    gridContainer.appendChild(fragment);

    function toggleHidden() {
      if (document.querySelector("#hideVineItems-togglePage").checked) {
        rootElement.classList.add("hideVineItems-showHidden");
      } else {
        rootElement.classList.remove("hideVineItems-showHidden");
      }
    }

    function updateCount() {
      document.getElementById("hideVineItems-count").innerHTML = `(${hiddenCount}${hiddenText} / ${filteredCount}${filteredText})`;
    }

    function isHidden(ASIN) {
      return GM_getValue("ASIN:" + ASIN) ? true : false;
    }

    function containsKeyword(filtertype, productDescription) {
      const savedKeywords = JSON.parse(GM_getValue(filtertype + ":", null));
      return savedKeywords ? savedKeywords.some(keyword => productDescription.match(new RegExp(keyword, "gi"))) : false;
    }

    function addHideLink(tile, ASIN) {
      const tileContent = tile.querySelector(".vvp-item-tile .vvp-item-tile-content");
      if (tileContent) {
        const filteredProduct = tile.querySelector(".vvp-item-tile:not(.hideVineItems-filterProduct) .vvp-item-tile-content");
        const a = document.createElement("span");
        if (filteredProduct) {
          a.addEventListener("click", () => {
            tile.classList.toggle("hideVineItems-hideASIN");
            if (isHidden(ASIN)) {
              GM_deleteValue("ASIN:" + ASIN);
              hiddenCount -= 1;
            } else {
              GM_setValue("ASIN:" + ASIN, new Date().toJSON().slice(0, 10));
              hiddenCount += 1;
            }
            updateCount();
          });
        }
        a.classList.add("hideVineItems-toggleASIN");
        tileContent.append(a);
      }
    }

    function convertASIN() {
      if (GM_getValue("CONFIG:DBUpgraded") !== true) {
        const gmValues = GM_listValues();
        const storage_orphan = gmValues.filter((keyword) => !keyword.match(new RegExp(":", "gi")));
        storage_orphan.forEach((orphan) => {
          GM_setValue("ASIN:" + orphan, GM_getValue(orphan));
          GM_deleteValue(orphan);
        });
        GM_setValue("CONFIG:DBUpgraded", true);
      }
    }

    function convertFilters() {
      if (!GM_getValue("FILTERS:")) {
        const gmValues = GM_listValues();
        const newFilters = [];
        const storage_keywords = gmValues.filter((keyword) => keyword.match(new RegExp("KEYWORD:", "gi")));
        storage_keywords.forEach((keyword) => {
          newFilters.push(keyword.substring(8));
          GM_deleteValue(keyword);
        });
        GM_setValue("FILTERS:", JSON.stringify(newFilters));
      }
    }

    function displayaddPopup(filtertype) {
      document.querySelectorAll(".dropdown .dropdown-content").forEach((tile) => {
        tile.classList.remove("dropdown-click");
      });
      const response = prompt(filterMessage, "");
      if (response && response.length > 0) {
        const newFilters = [];
        const savedFilters = JSON.parse(GM_getValue(filtertype + ":", null));
        if (savedFilters) {
          savedFilters.forEach((filter) => newFilters.push(filter));
        }
        newFilters.push(response);
        GM_setValue(filtertype + ":", JSON.stringify(newFilters));
        location.reload();
      }
    }

    function displayremovePopup(filtertype) {
      document.querySelectorAll(".dropdown .dropdown-content").forEach((tile) => {
        tile.classList.remove("dropdown-click");
      });
      const numberedFilters = JSON.parse(GM_getValue(filtertype + ":"));
      if (numberedFilters.length > 0) {
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
            } else if (response === moreText || response === moreText.substring(0, 1)) {
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
    }

    function clearHiddenCache() {
      const gmValues = GM_listValues();
      const hiddenItems = gmValues.filter((key) => key.startsWith("ASIN:"));
      hiddenItems.forEach((item) => {
        GM_deleteValue(item);
      });
      hiddenCount = 0;
      updateCount();
      alert("All cached hidden items have been cleared.");
      location.reload(); // Refresh the page
    }

    convertASIN();
    convertFilters();

    const itemTiles = document.querySelectorAll(".vvp-item-tile");
    itemTiles.forEach((tile) => {
      const itemLink = tile.querySelector(".vvp-item-product-title-container > a[href^='/dp/']");
      if (itemLink) {
        const ASIN = itemLink.getAttribute("href").slice(4);
        const linkText = itemLink.textContent;
        if (isHidden(ASIN)) {
          tile.classList.add("hideVineItems-hideASIN");
          hiddenCount += 1;
        } else {
          if (containsKeyword("HIGHLIGHTS", linkText)) {
            tile.classList.add("hideVineItems-highlightProduct");
          } else if (containsKeyword("FILTERS", linkText)) {
            tile.classList.add("hideVineItems-filterProduct");
            filteredCount += 1;
          }
        }
        addHideLink(tile, ASIN);
      }
    });

    if (location.search.includes("search=")) {
      document.getElementById("hideVineItems-togglePage").checked = true;
      rootElement.classList.toggle("hideVineItems-showHidden");
    }

    updateCount();

    messageSpan.querySelector("#hideVineItems-togglePage").addEventListener("change", toggleHidden);
    messageSpan.querySelector("#hideVineItems-hideAll").addEventListener("click", () => {
      document.querySelectorAll(".vvp-item-tile:not(.hideVineItems-hideASIN) .hideVineItems-toggleASIN").forEach((hideLink) => hideLink.click());
    });
    messageSpan.querySelector("#hideVineItems-unhideAll").addEventListener("click", () => {
      document.querySelectorAll(".vvp-item-tile.hideVineItems-hideASIN .hideVineItems-toggleASIN").forEach((hideLink) => hideLink.click());
    });
    messageSpan.querySelector("#hideVineItems-filterText").addEventListener("click", () => displayaddPopup("FILTERS"));
    messageSpan.querySelector("#hideVineItems-unfilterText").addEventListener("click", () => displayremovePopup("FILTERS"));
    messageSpan.querySelector("#hideVineItems-highlightText").addEventListener("click", () => displayaddPopup("HIGHLIGHTS"));
    messageSpan.querySelector("#hideVineItems-unhighlightText").addEventListener("click", () => displayremovePopup("HIGHLIGHTS"));
    messageSpan.querySelector("#hideVineItems-clearCache").addEventListener("click", clearHiddenCache);
    messageSpan.querySelector("#hideVineItems-filtersMenu").addEventListener("click", () => {
      document.querySelectorAll(".dropdown .dropdown-content").forEach((tile) => tile.classList.toggle("dropdown-click"));
    });

    GM_addStyle(`
      #hideVineItems-hideAll, #hideVineItems-unhideAll, #hideVineItems-filtersMenu {
        color: Firebrick;
      }
      #hideVineItems-hideAll:hover, #hideVineItems-unhideAll:hover, #hideVineItems-filtersMenu:hover {
        color: #C7511F;
        text-decoration: underline;
      }
      .hideVineItems-hideASIN, .hideVineItems-filterProduct {
        display:none;
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
        right: 0px;
        background-color: rgba(0,0,0,0.0);
        padding: 0;
        background: url("${hideSymbol}");
        background-repeat: no-repeat;
        background-size:contain;
      }
      .hideVineItems-hideASIN .vvp-item-tile-content .hideVineItems-toggleASIN {
        background: url("${unhideSymbol}");
        background-repeat: no-repeat;
        background-size:contain;
      }
      .hideVineItems-filterProduct .vvp-item-tile-content .hideVineItems-toggleASIN {
        background: url("${filterSymbol}");
        background-repeat: no-repeat;
        background-size:contain;
      }
      .hideVineItems-showHidden .hideVineItems-hideASIN, .hideVineItems-showHidden .hideVineItems-filterProduct {
        display:unset;
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
        background-size:contain;
        padding-left:30px;
      }
      #hideVineItems-unhideAll {
        background: url("${unhideSymbol}");
        background-repeat: no-repeat;
        background-size:contain;
        padding-left:30px;
      }
      #hideVineItems-filterText {
        background: url("${filterSymbol}");
        background-repeat: no-repeat;
        background-size:contain;
        padding-left:40px;
      }
      #hideVineItems-unfilterText {
        background: url("${unfilterSymbol}");
        background-repeat: no-repeat;
        background-size:contain;
        padding-left:40px;
      }
      #hideVineItems-highlightText {
        background: url("${highlightSymbol}");
        background-repeat: no-repeat;
        background-size:contain;
        padding-left:40px;
      }
      #hideVineItems-unhighlightText {
        background: url("${unhighlightSymbol}");
        background-repeat: no-repeat;
        background-size:contain;
        padding-left:40px;
      }
      #hideVineItems-clearCache {
        background: url("${resetCacheSymbol}");
        background-repeat: no-repeat;
        background-size:contain;
        padding-left:40px;
      }
      #hideVineItems-filtersMenu {
        background: url("${unfilterSymbol}");
        background-repeat: no-repeat;
        background-size:contain;
        padding-left:30px;
      }
      .bullet {
        margin-left:10px;
        margin-right:10px;
      }
      .switch {
        position: relative;
        display: inline-block;
        width: 32px;
        height: 20px;
        margin-left:10px;
        margin-bottom:5px;
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
        -webkit-transition: .4s;
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
        -webkit-transition: .4s;
        transition: .4s;
      }
      input:checked + .slider {
        background-color: #2196F3;
      }
      input:focus + .slider {
        box-shadow: 0 0 1px #2196F3;
      }
      input:checked + .slider:before {
        -webkit-transform: translateX(12px);
        -ms-transform: translateX(12px);
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
        z-index:5000;
        padding:5px;
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
        margin:5px;
        width: auto
      }
      .dropdown-content a:hover {
        color: #C7511F;
      }
      hr {
        margin-top:10px;
      }
      #vvp-items-grid {
        display:grid !important;
      }
    `);
  }
};
