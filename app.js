// IndexedDB Configuration
const DB_NAME = 'GATAAirdropDB';
const DB_VERSION = 1;
const STORE_NAME = 'balances';
const DATA_VERSION_KEY = 'dataVersion';
const CURRENT_DATA_VERSION = '1.0'; // Increment this when balances.json changes

let db = null;
let isLoadingData = false;
let loadingComplete = false;
let searchCheckInterval = null;
let lastSearchAddress = null;
let loadingStartTime = null;
let totalAddressCount = 0;
let processedAddressCount = 0;
let syncStopped = false;
let currentLoadingPromise = null;

// In-memory search mode
let balancesData = null; // Stores all balances in memory
let isDataLoaded = false;
let currentSearchMode = 'memory'; // 'memory' or 'indexeddb'

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
});

// Initialize IndexedDB and load data if needed
async function initializeApp() {
    try {
        // Check which mode is selected
        const modeRadio = document.querySelector('input[name="searchMode"]:checked');
        currentSearchMode = modeRadio ? modeRadio.value : 'memory';
        
        if (currentSearchMode === 'memory') {
            // In-memory mode: Just load JSON into memory
            await loadDataIntoMemory();
        } else {
            // IndexedDB mode: Use the existing IndexedDB flow
            db = await openDatabase();
            const needsUpdate = await checkIfDataNeedsUpdate();
            
            if (needsUpdate) {
                startSync();
            } else {
                loadingComplete = true;
                showResyncButton();
            }
        }
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize the application. Please refresh the page.');
    }
}

// Load data into memory (fast mode)
async function loadDataIntoMemory() {
    try {
        showLoadingBanner(true);
        loadingStartTime = Date.now();
        updateBannerText('Loading airdrop data...', 'Fast in-memory mode - should take just a few seconds');
        
        const response = await fetch('balances.json');
        if (!response.ok) {
            throw new Error('Failed to fetch balances data');
        }
        
        // Parse JSON directly into memory
        balancesData = await response.json();
        totalAddressCount = Object.keys(balancesData).length;
        isDataLoaded = true;
        loadingComplete = true;
        
        const loadTime = ((Date.now() - loadingStartTime) / 1000).toFixed(2);
        
        updateBannerText(
            `✅ Data loaded in ${loadTime}s!`,
            `${totalAddressCount.toLocaleString()} addresses ready for instant search`
        );
        updateProgress(100);
        
        // Hide banner after 2 seconds
        setTimeout(() => {
            showLoadingBanner(false);
        }, 2000);
        
    } catch (error) {
        console.error('Error loading data into memory:', error);
        showError('Failed to load airdrop data. Please refresh the page.');
    }
}

// Open IndexedDB connection
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'address' });
                objectStore.createIndex('address', 'address', { unique: true });
            }
            
            // Create metadata store
            if (!db.objectStoreNames.contains('metadata')) {
                db.createObjectStore('metadata', { keyPath: 'key' });
            }
        };
    });
}

// Check if data needs to be loaded/updated
async function checkIfDataNeedsUpdate() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['metadata', STORE_NAME], 'readonly');
        const metadataStore = transaction.objectStore('metadata');
        const balancesStore = transaction.objectStore(STORE_NAME);
        
        const versionRequest = metadataStore.get(DATA_VERSION_KEY);
        const countRequest = balancesStore.count();
        
        transaction.oncomplete = () => {
            const storedVersion = versionRequest.result?.value;
            const count = countRequest.result;
            
            // Need update if version doesn't match or no data exists
            resolve(storedVersion !== CURRENT_DATA_VERSION || count === 0);
        };
        
        transaction.onerror = () => reject(transaction.error);
    });
}

// Load balances from JSON file into IndexedDB
async function loadBalancesIntoIndexedDB() {
    try {
        syncStopped = false;
        loadingStartTime = Date.now();
        updateBannerText('Downloading airdrop data...', 'Please wait while we fetch the data');
        
        const response = await fetch('balances.json');
        if (!response.ok) {
            throw new Error('Failed to fetch balances data');
        }
        
        const balances = await response.json();
        const addresses = Object.keys(balances);
        totalAddressCount = addresses.length;
        processedAddressCount = 0;
        
        updateBannerText(`Syncing ${totalAddressCount.toLocaleString()} addresses...`, 'You can search now - we\'ll check periodically as data loads');
        
        // Clear existing data
        await clearStore(STORE_NAME);
        
        // Batch insert for better performance
        const BATCH_SIZE = 5000;
        
        for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
            // Check if sync was stopped
            if (syncStopped) {
                updateBannerText('Sync stopped', 'Data partially loaded. Click "Sync Fresh" to reload all data.');
                isLoadingData = false;
                showResyncButton();
                return;
            }
            
            const batch = addresses.slice(i, i + BATCH_SIZE);
            await insertBatch(batch, balances);
            
            processedAddressCount += batch.length;
            const progress = Math.round((processedAddressCount / totalAddressCount) * 100);
            updateProgress(progress);
            
            // Calculate ETA
            const elapsed = Date.now() - loadingStartTime;
            const rate = processedAddressCount / elapsed; // addresses per ms
            const remaining = totalAddressCount - processedAddressCount;
            const etaMs = remaining / rate;
            const etaSeconds = Math.ceil(etaMs / 1000);
            
            updateBannerText(
                `Syncing: ${processedAddressCount.toLocaleString()} / ${totalAddressCount.toLocaleString()}`,
                'You can search now - we\'ll check periodically as data loads',
                `ETA: ${etaSeconds}s remaining`
            );
            
            // If user is searching, check their address periodically
            if (lastSearchAddress) {
                const result = await getBalance(lastSearchAddress);
                if (result) {
                    // Found it! Show result immediately
                    const gnot = convertToGNOT(result.amount);
                    showSuccess(lastSearchAddress, gnot);
                    lastSearchAddress = null; // Clear so we don't keep checking
                }
            }
            
            // Small delay to keep UI responsive
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        // Save data version
        await saveMetadata(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
        
        updateBannerText('Sync complete!', 'All addresses loaded successfully');
        
        // If user searched but address wasn't found, show final message
        if (lastSearchAddress) {
            showNotFoundAfterSync(lastSearchAddress);
            lastSearchAddress = null;
        }
        
    } catch (error) {
        console.error('Error loading balances:', error);
        throw new Error('Failed to load airdrop data. Please refresh the page and try again.');
    }
}

// Insert a batch of addresses
function insertBatch(addresses, balances) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        addresses.forEach(address => {
            store.add({
                address: address,
                amount: balances[address]
            });
        });
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

// Clear an object store
function clearStore(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Save metadata
function saveMetadata(key, value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['metadata'], 'readwrite');
        const store = transaction.objectStore('metadata');
        const request = store.put({ key, value });
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Get balance for an address
function getBalance(address) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(address);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Setup event listeners
function setupEventListeners() {
    const addressInput = document.getElementById('addressInput');
    const checkBtn = document.getElementById('checkBtn');
    
    // Check on button click
    checkBtn.addEventListener('click', handleCheck);
    
    // Check on Enter key
    addressInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleCheck();
        }
    });
    
    // Clear result when input changes
    addressInput.addEventListener('input', () => {
        hideResult();
    });
    
    // Handle mode change
    const modeRadios = document.querySelectorAll('input[name="searchMode"]');
    modeRadios.forEach(radio => {
        radio.addEventListener('change', handleModeChange);
    });
}

// Handle search mode change
async function handleModeChange(e) {
    const newMode = e.target.value;
    if (newMode === currentSearchMode) return;
    
    currentSearchMode = newMode;
    hideResult();
    
    // Reset state
    isLoadingData = false;
    loadingComplete = false;
    
    if (newMode === 'memory') {
        // Switch to in-memory mode
        if (!isDataLoaded) {
            await loadDataIntoMemory();
        }
    } else {
        // Switch to IndexedDB mode
        if (!db) {
            db = await openDatabase();
        }
        const needsUpdate = await checkIfDataNeedsUpdate();
        if (needsUpdate) {
            startSync();
        } else {
            loadingComplete = true;
        }
    }
}

// Handle check button click
async function handleCheck() {
    const addressInput = document.getElementById('addressInput');
    const address = addressInput.value.trim();
    
    // Validate address format
    if (!address) {
        showError('Please enter an address');
        return;
    }
    
    if (!isValidGnolandAddress(address)) {
        showError('Invalid Gnoland address format. Address should start with "g1" followed by 38 characters.');
        return;
    }
    
    // Store the address for periodic checking during load
    lastSearchAddress = address;
    
    // Disable button during search
    const checkBtn = document.getElementById('checkBtn');
    checkBtn.disabled = true;
    checkBtn.textContent = 'Checking...';
    
    try {
        let result;
        
        // Use appropriate search method based on mode
        if (currentSearchMode === 'memory') {
            result = getBalanceFromMemory(address);
        } else {
            result = await getBalance(address);
        }
        
        if (result) {
            const gnot = convertToGNOT(result.amount || result);
            showSuccess(address, gnot);
            lastSearchAddress = null; // Clear since we found it
        } else if (loadingComplete || isDataLoaded) {
            // Only show "not found" if we've loaded all data
            showError('Address not found in airdrop allocation. This address is not eligible for the airdrop.');
            lastSearchAddress = null;
        } else if (isLoadingData) {
            // Still loading - show waiting message
            showWaitingForSync(address);
            // lastSearchAddress stays set so we can check periodically
        } else {
            showError('Address not found in airdrop allocation.');
            lastSearchAddress = null;
        }
    } catch (error) {
        console.error('Error checking balance:', error);
        showError('An error occurred while checking the balance');
        lastSearchAddress = null;
    } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = 'Check Airdrop';
    }
}

// Get balance from in-memory data (fast O(1) lookup)
function getBalanceFromMemory(address) {
    if (!balancesData) return null;
    const amount = balancesData[address];
    return amount ? { amount } : null;
}

// Validate Gnoland address format
function isValidGnolandAddress(address) {
    // Gnoland addresses start with 'g1' and are 40 characters total
    const regex = /^g1[a-z0-9]{38}$/;
    return regex.test(address);
}

// Convert ugnot to GNOT (divide by 1,000,000)
function convertToGNOT(ugnot) {
    const gnot = parseFloat(ugnot) / 1000000;
    return gnot;
}

// Format number with commas
function formatNumber(num) {
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6
    });
}

// Show success result
function showSuccess(address, gnot) {
    const resultContainer = document.getElementById('resultContainer');
    const resultTitle = document.getElementById('resultTitle');
    const resultContent = document.getElementById('resultContent');
    
    resultTitle.textContent = '🎉 Airdrop Found!';
    
    resultContent.innerHTML = `
        <div class="result-amount">${formatNumber(gnot)}</div>
        <div class="result-unit">GNOT</div>
        <div class="result-address">${address}</div>
        <button class="copy-btn" onclick="copyToClipboard('${gnot}')">
            📋 Copy Amount
        </button>
    `;
    
    resultContainer.className = 'result-container success show';
}

// Show error message
function showError(message) {
    const resultContainer = document.getElementById('resultContainer');
    const resultTitle = document.getElementById('resultTitle');
    const resultContent = document.getElementById('resultContent');
    
    resultTitle.textContent = '❌ Error';
    resultContent.innerHTML = `<div class="error-message">${message}</div>`;
    
    resultContainer.className = 'result-container error show';
}

// Hide result
function hideResult() {
    const resultContainer = document.getElementById('resultContainer');
    resultContainer.classList.remove('show');
}

// Show/hide loading banner
function showLoadingBanner(show) {
    const loadingBanner = document.getElementById('loadingBanner');
    if (loadingBanner) {
        loadingBanner.classList.toggle('show', show);
    }
}

// Update banner text
function updateBannerText(title, subtitle, eta = '') {
    const bannerTitle = document.getElementById('bannerTitle');
    const bannerSubtitle = document.getElementById('bannerSubtitle');
    const bannerEta = document.getElementById('bannerEta');
    
    if (bannerTitle) bannerTitle.textContent = title;
    if (bannerSubtitle) bannerSubtitle.textContent = subtitle;
    if (bannerEta) bannerEta.textContent = eta;
}

// Show waiting message while sync continues
function showWaitingForSync(address) {
    const resultContainer = document.getElementById('resultContainer');
    const resultTitle = document.getElementById('resultTitle');
    const resultContent = document.getElementById('resultContent');
    
    const progress = totalAddressCount > 0 ? Math.round((processedAddressCount / totalAddressCount) * 100) : 0;
    
    resultTitle.textContent = '⏳ Searching...';
    resultContent.innerHTML = `
        <div style="color: #aaa; font-size: 1.1em; line-height: 1.8;">
            <p style="margin-bottom: 15px;">We're still syncing airdrop data (${progress}% complete).</p>
            <p style="margin-bottom: 15px;">Your address hasn't been found yet, but it might appear as we continue loading.</p>
            <p style="color: #ff3399; font-weight: 600;">We'll automatically notify you if your address is found!</p>
            <div class="result-address" style="margin-top: 20px;">${address}</div>
        </div>
    `;
    
    resultContainer.className = 'result-container show';
}

// Show not found message after sync completes
function showNotFoundAfterSync(address) {
    const resultContainer = document.getElementById('resultContainer');
    const resultTitle = document.getElementById('resultTitle');
    const resultContent = document.getElementById('resultContent');
    
    resultTitle.textContent = '❌ Not Eligible';
    resultContent.innerHTML = `
        <div style="color: #aaa; font-size: 1.1em; line-height: 1.8;">
            <p style="margin-bottom: 15px;">Sync complete! We've checked all ${totalAddressCount.toLocaleString()} addresses.</p>
            <p style="color: #ff5555; font-weight: 600; margin-bottom: 15px;">This address is not eligible for the GATA airdrop.</p>
            <div class="result-address" style="margin-top: 20px;">${address}</div>
        </div>
    `;
    
    resultContainer.className = 'result-container error show';
}

// Update progress bar
function updateProgress(percentage) {
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
        progressFill.style.width = percentage + '%';
    }
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Start sync process
function startSync() {
    isLoadingData = true;
    loadingComplete = false;
    syncStopped = false;
    showLoadingBanner(true);
    hideResyncButton();
    showStopButton();
    
    // Load data in background, don't block UI
    currentLoadingPromise = loadBalancesIntoIndexedDB().then(() => {
        if (!syncStopped) {
            isLoadingData = false;
            loadingComplete = true;
            
            // Wait 2 seconds then hide banner
            setTimeout(() => {
                showLoadingBanner(false);
                showResyncButton();
            }, 2000);
            
            // If user searched while loading, check again now
            if (lastSearchAddress) {
                handleCheck();
            }
        }
    }).catch(error => {
        console.error('Error loading data:', error);
        showError('Failed to load airdrop data. Please refresh the page.');
        isLoadingData = false;
        showLoadingBanner(false);
        showResyncButton();
    });
}

// Stop sync
function stopSync() {
    syncStopped = true;
    isLoadingData = false;
    lastSearchAddress = null; // Clear any pending search
}

// Resync data (force fresh download)
async function resyncData() {
    // Clear stored version to force re-download
    try {
        await clearStore(STORE_NAME);
        await saveMetadata(DATA_VERSION_KEY, 'outdated');
        
        // Reset state
        loadingComplete = false;
        processedAddressCount = 0;
        totalAddressCount = 0;
        
        // Start fresh sync
        startSync();
    } catch (error) {
        console.error('Error clearing data:', error);
        showError('Failed to clear existing data. Please refresh the page.');
    }
}

// Show/hide resync button
function showResyncButton() {
    const resyncBtn = document.getElementById('resyncBtn');
    const stopBtn = document.getElementById('stopSyncBtn');
    if (resyncBtn) resyncBtn.style.display = 'inline-block';
    if (stopBtn) stopBtn.style.display = 'none';
}

function hideResyncButton() {
    const resyncBtn = document.getElementById('resyncBtn');
    if (resyncBtn) resyncBtn.style.display = 'none';
}

function showStopButton() {
    const stopBtn = document.getElementById('stopSyncBtn');
    if (stopBtn) stopBtn.style.display = 'inline-block';
}

