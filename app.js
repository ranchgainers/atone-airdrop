// Configuration
const DATA_URL = 'balances.json';

// State
let balancesData = null; // Stores all balances in memory
let isDataLoaded = false;
let loadingStartTime = null;
let totalAddressCount = 0;

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
});

// Initialize and load data
async function initializeApp() {
    try {
        await loadDataIntoMemory();
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize the application. Please refresh the page.');
    }
}

// Load data into memory (browser will cache the JSON file)
async function loadDataIntoMemory() {
    try {
        showLoadingBanner(true);
        loadingStartTime = Date.now();
        updateBannerText('Loading airdrop data...', 'This will only download once - your browser will cache it');
        updateProgress(10);
        
        const response = await fetch(DATA_URL);
        if (!response.ok) {
            throw new Error('Failed to fetch balances data');
        }
        
        updateProgress(50);
        updateBannerText('Parsing data...', 'Almost ready...');
        
        // Parse JSON directly into memory
        balancesData = await response.json();
        totalAddressCount = Object.keys(balancesData).length;
        isDataLoaded = true;
        
        const loadTime = ((Date.now() - loadingStartTime) / 1000).toFixed(2);
        
        updateBannerText(
            `✅ Ready! Loaded in ${loadTime}s`,
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
        throw error;
    }
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
    
    // Check if data is loaded
    if (!isDataLoaded) {
        showError('Data is still loading. Please wait a moment and try again.');
        return;
    }
    
    // Disable button during search
    const checkBtn = document.getElementById('checkBtn');
    checkBtn.disabled = true;
    checkBtn.textContent = 'Checking...';
    
    try {
        const result = getBalanceFromMemory(address);
        
        if (result) {
            const gnot = convertToGNOT(result);
            showSuccess(address, gnot);
        } else {
            showError('Address not found in airdrop allocation. This address is not eligible for the airdrop.');
        }
    } catch (error) {
        console.error('Error checking balance:', error);
        showError('An error occurred while checking the balance');
    } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = 'Check Airdrop';
    }
}

// Get balance from in-memory data (O(1) lookup)
function getBalanceFromMemory(address) {
    if (!balancesData) return null;
    const amount = balancesData[address];
    return amount || null;
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

// Resync data (force reload)
async function resyncData() {
    hideResult();
    balancesData = null;
    isDataLoaded = false;
    await loadDataIntoMemory();
}

// Stop sync (for compatibility, though not needed for in-memory mode)
function stopSync() {
    // Not applicable for in-memory mode, but keep function for button compatibility
    showError('Cannot stop loading - data loads very quickly in this version!');
}
