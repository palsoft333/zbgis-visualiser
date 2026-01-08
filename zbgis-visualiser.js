// ==UserScript==
// @name         ZBGIS visualiser
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @updateURL    https://raw.githubusercontent.com/palsoft333/zbgis-visualiser/refs/heads/main/zbgis-visualiser.js
// @downloadURL  https://raw.githubusercontent.com/palsoft333/zbgis-visualiser/refs/heads/main/zbgis-visualiser.js
// @description  Tool that allows visualization and information retrieval of all "E-ground plots" for a given name and city in Slovak Cadastre of Real Estate
// @author       Palsoft
// @match        https://zbgis.skgeodesy.sk/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=skgeodesy.sk
// @grant        GM.cookie
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(async function() {
    'use strict';

    const cs = await GM.cookie.list({ url: 'https://zbgis.skgeodesy.sk/', partitionKey: {} });

    function checkCaptcha() {
        const cookie = cs.find(c => c.name === '.ESKN_RECAPTCHA');
        if (!cookie) {
            alert('Error: CAPTCHA not solved. Please solve the CAPTCHA by clicking on the map and then reload the page.');
            return false;
        }
        return cookie.value;
    }

    let progressData = { current: 0, total: 0 };
    let isEnabled = localStorage.getItem('zbgis-visualizer-enabled') !== 'false';
    let shouldStop = false;

    function addToggleButton() {
        const controlDiv = document.querySelector('.control.top-right');
        if (!controlDiv || document.getElementById('zbgis-toggle')) return;
        
        const toggleButton = document.createElement('div');
        toggleButton.className = 'map-action-button mat-elevation-z2';
        toggleButton.style.cssText = 'position: relative; z-index: 1000; pointer-events: auto;';
        toggleButton.innerHTML = `
            <button id="zbgis-toggle" color="basic" mat-icon-button="" class="mat-mdc-tooltip-trigger mdc-icon-button mat-mdc-icon-button mat-basic mat-mdc-button-base" style="background-color: ${isEnabled ? '#4CAF50' : '#f44336'}; cursor: pointer; pointer-events: auto;" title="ZBGIS Visualiser">
                <span class="mat-mdc-button-persistent-ripple mdc-icon-button__ripple"></span>
                <mat-icon role="img" class="mat-icon notranslate material-icons mat-ligature-font mat-icon-no-color" style="color: white">${isEnabled ? 'visibility' : 'visibility_off'}</mat-icon>
                <span class="mat-mdc-focus-indicator"></span>
                <span class="mat-mdc-button-touch-target"></span>
            </button>
        `;
        
        toggleButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            isEnabled = !isEnabled;
            localStorage.setItem('zbgis-visualizer-enabled', isEnabled);
            const button = toggleButton.querySelector('button');
            const icon = toggleButton.querySelector('mat-icon');
            button.style.backgroundColor = isEnabled ? '#4CAF50' : '#f44336';
            icon.textContent = isEnabled ? 'visibility' : 'visibility_off';
            
            if (!isEnabled) {
                // Clear existing graphics
                if (unsafeWindow.zbgismap?._accessor?.obj?.view?.graphics) {
                    unsafeWindow.zbgismap._accessor.obj.view.graphics.removeAll();
                }
            }
        }, true);
        
        controlDiv.appendChild(toggleButton);
    }

    async function fetchAllParticipants(url, cookie) {
        console.log(url);
        const response = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: { 'Cookie': `.ESKN_RECAPTCHA=${cookie}` },
                onload: (response) => resolve(JSON.parse(response.responseText)),
                onerror: reject
            });
        });
        
        let allItems = [...response.value];
        
        if (response['@odata.nextLink']) {
            const nextItems = await fetchAllParticipants(response['@odata.nextLink'], cookie);
            allItems = allItems.concat(nextItems);
        }
        
        return allItems;
    }

    async function searchParcels(id, ku) {
        if (!isEnabled) return;
        
        const cookie = checkCaptcha();
        if (!cookie) return;
        
        // Clear existing graphics
        if (unsafeWindow.zbgismap?._accessor?.obj?.view?.graphics) {
            unsafeWindow.zbgismap._accessor.obj.view.graphics.removeAll();
        }
        
        showProgress();
        
        try {
            const url = `https://kataster.skgeodesy.sk/PortalODataPublic/Participants?$filter=Subjects/any(p:%20p/Id%20eq%20${id})%20and%20Municipality/Code%20eq%20${ku}&$select=Name&$expand=Municipality($select=Name;$expand=District($select=Name)),OwnershipRecord($select=Id,Order;$expand=Folio($select=No,Id,OwnersCount,CountOfParcelsC,CountOfParcelsE)),CadastralUnit($select=Name,Code)&$orderby=OwnershipRecord/Folio/No,OwnershipRecord/Order&$skip=0`;
            
            const allItems = await fetchAllParticipants(url, cookie);
            const actualName = allItems[0]?.Name;
            
            // Count total parcels
            let totalParcels = 0;
            for (const item of allItems) {
                if (item.OwnershipRecord.Folio.OwnersCount < 50) {
                    totalParcels += item.OwnershipRecord.Folio.CountOfParcelsE + item.OwnershipRecord.Folio.CountOfParcelsC;
                }
            }
            
            progressData = { current: 0, total: totalParcels };
            updateProgress();
            
            for (const item of allItems) {
                if (shouldStop) break;
                if (item.OwnershipRecord.Folio.OwnersCount < 50) {
                    await loadParcels(item.OwnershipRecord.Folio.Id, actualName);
                    if (shouldStop) break;
                    await loadParcelsC(item.OwnershipRecord.Folio.Id, actualName);
                }
            }
        } catch (e) {
            console.error('Search error:', e);
        }
        
        hideProgress();
    }
    
    async function loadParcels(folioId, name) {
        const cookie = checkCaptcha();
        const url = `https://kataster.skgeodesy.sk/PortalODataPublic/ParcelsE?$filter=FolioId%20eq%20${folioId}&$select=Id,No,NoFull,Area&$orderby=NoSort&$skip=0`;
        
        const allParcels = await fetchAllParticipants(url, cookie);
        
        for (const parcel of allParcels) {
            if (shouldStop) break;
            progressData.current++;
            updateProgress();
            await addParcelToMap(parcel.Id, name, 'E');
        }
    }
    
    async function loadParcelsC(folioId, name) {
        const cookie = checkCaptcha();
        const url = `https://kataster.skgeodesy.sk/PortalODataPublic/ParcelsC?$filter=FolioId%20eq%20${folioId}&$select=Id,No,Area&$skip=0`;
        
        const allParcels = await fetchAllParticipants(url, cookie);
        
        for (const parcel of allParcels) {
            if (shouldStop) break;
            progressData.current++;
            updateProgress();
            await addParcelToMap(parcel.Id, name, 'C');
        }
    }
    
    let tooltipSetup = false;

    async function getParcelShare(parcelId, area, name, type) {
        const cookie = checkCaptcha();
        const url = `https://kataster.skgeodesy.sk/PortalODataPublic/Parcels${type}(${parcelId})/Kn.Participants?$filter=Type/Code%20eq%201&$select=Id,Name,ValidTo,Numerator,Denominator&$expand=OwnershipRecord($select=Order)&$orderby=OwnershipRecord/Order&$skip=0`;
        
        const allParticipants = await fetchAllParticipants(url, cookie);
        
        for (const participant of allParticipants) {
            if (participant.Name === name) {
                return Math.round((area / participant.Denominator) * participant.Numerator * 10) / 10;
            }
        }
        return 0;
    }

    async function addParcelToMap(parcelId, name, type) {
        const cookie = checkCaptcha();
        const mapService = type === 'E' ? 'parcels_e_view' : 'parcels_c_view';
        const response = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://kataster.skgeodesy.sk/eskn/rest/services/VRM/${mapService}/MapServer/0/query?objectIds=${parcelId}&returnGeometry=true&outSR=4326&f=json&outFields=DESCRIPTIVE_AREA_OF_PARCEL,PARCEL_NUMBER`,
                headers: { 'Cookie': `.ESKN_RECAPTCHA=${cookie}` },
                onload: (response) => resolve(JSON.parse(response.responseText)),
                onerror: reject
            });
        });
      
        if (response.features && response.features[0]) {
            const feature = response.features[0];
            const view = unsafeWindow.zbgismap._accessor.obj.view;
            const area = feature.attributes.DESCRIPTIVE_AREA_OF_PARCEL;
            const share = await getParcelShare(parcelId, area, name, type);
            const color = type === 'E' ? [255, 0, 0] : [0, 0, 255];
            
            view.graphics.add({
                geometry: {
                    type: "polygon",
                    rings: feature.geometry.rings,
                    spatialReference: { wkid: 4326 }
                },
                symbol: {
                    type: "simple-fill",
                    color: [...color, 0.3],
                    outline: { 
                        color: color,
                        width: 2 
                    }
                },
                attributes: {
                    PARCEL_NUMBER: feature.attributes.PARCEL_NUMBER,
                    AREA: area,
                    SHARE: share,
                    TYPE: type
                }
            });
            
            if (!tooltipSetup) {
                setupTooltip(view);
                tooltipSetup = true;
            }
        }
    }
    
    function setupTooltip(view) {
        view.on("pointer-move", (event) => {
            view.hitTest(event).then((response) => {
                if (response.results.length > 0) {
                    const graphic = response.results[0].graphic;
                    if (graphic.attributes && graphic.attributes.PARCEL_NUMBER) {
                        const typeLabel = graphic.attributes.TYPE === 'E' ? 'E-parcel' : 'C-parcel';
                        showTooltip(event.native.clientX, event.native.clientY, `${graphic.attributes.PARCEL_NUMBER} (${typeLabel})`, `Area: ${graphic.attributes.AREA}m²<br>Share: ${graphic.attributes.SHARE}m²`);
                        return;
                    }
                }
                hideTooltip();
            });
        });
    }
    
    function showTooltip(x, y, title, content) {
        let tooltip = document.getElementById('parcel-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'parcel-tooltip';
            tooltip.style.cssText = 'position:fixed;background:white;border:1px solid #ccc;padding:5px;z-index:10000;pointer-events:none;font-size:12px;';
            document.body.appendChild(tooltip);
        }
        tooltip.innerHTML = `<strong>${title}</strong><br>${content}`;
        tooltip.style.left = x + 10 + 'px';
        tooltip.style.top = y - 30 + 'px';
        tooltip.style.display = 'block';
    }
    
    function hideTooltip() {
        const tooltip = document.getElementById('parcel-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    }
    
    function showProgress() {
        shouldStop = false;
        const progress = document.createElement('div');
        progress.id = 'search-progress';
        progress.innerHTML = '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;border:1px solid #ccc;z-index:9999"><div id="progress-text">Loading parcels...</div><button id="stop-button" style="margin-top:10px;padding:5px 10px;background:#f44336;color:white;border:none;cursor:pointer">Stop</button></div>';
        document.body.appendChild(progress);
        
        document.getElementById('stop-button').addEventListener('click', () => {
            shouldStop = true;
            hideProgress();
        });
    }
    
    function updateProgress() {
        const progressText = document.getElementById('progress-text');
        if (progressText) {
            const remaining = progressData.total - progressData.current;
            progressText.textContent = `Loading parcels: ${progressData.current}/${progressData.total} (${remaining} remaining)`;
        }
    }
    
    function hideProgress() {
        const progress = document.getElementById('search-progress');
        if (progress) progress.remove();
    }

    // Listen for URL changes
    let currentPath = window.location.pathname;
    
    function checkUrlChange() {
        addToggleButton();
        
        if (window.location.pathname !== currentPath) {
            currentPath = window.location.pathname;
            
            const urlPattern = /\/kataster\/detail\/kataster\/fyzicka-osoba\/mu\/(\d+)\/(\d+)/;
            const match = currentPath.match(urlPattern);
            
            if (match) {
                const ku = match[1];
                const id = match[2];
                
                searchParcels(id, ku);
            }
        }
    }
    
    // Check for URL changes every 500ms
    setInterval(checkUrlChange, 500);
})();
