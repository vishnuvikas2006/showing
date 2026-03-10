 // main.js - Main application functions

// Initialize map on report page
function initMap() {
    if (typeof L === 'undefined') {
        console.warn('Leaflet not loaded');
        return;
    }
    
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    // Default location (India Gate, Delhi)
    const defaultLocation = [28.6129, 77.2295];
    
    const map = L.map('map').setView(defaultLocation, 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    let marker = L.marker(defaultLocation, { draggable: true }).addTo(map);
    
    // Update coordinates when marker is dragged
    marker.on('dragend', function(e) {
        const latlng = e.target.getLatLng();
        document.getElementById('coordDisplay').textContent = 
            `Selected: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
    });
    
    // Click on map to move marker
    map.on('click', function(e) {
        marker.setLatLng(e.latlng);
        document.getElementById('coordDisplay').textContent = 
            `Selected: ${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
    });
    
    return { map, marker };
}

// File upload handling
function initFileUpload() {
    const uploadBox = document.getElementById('uploadBox');
    const fileInput = document.getElementById('fileInput');
    const filePreview = document.getElementById('filePreview');
    
    if (!uploadBox || !fileInput) return;
    
    uploadBox.addEventListener('click', () => fileInput.click());
    
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.style.background = '#e8f0fa';
    });
    
    uploadBox.addEventListener('dragleave', () => {
        uploadBox.style.background = '#f1f6fc';
    });
    
    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.style.background = '#f1f6fc';
        handleFiles(e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
    });
    
    function handleFiles(files) {
        if (!files || files.length === 0) return;
        
        if (files.length > 5) {
            alert('Maximum 5 files allowed');
            return;
        }
        
        filePreview.innerHTML = '';
        
        for (let i = 0; i < Math.min(files.length, 5); i++) {
            const file = files[i];
            
            if (file.size > 10 * 1024 * 1024) {
                alert(`File ${file.name} exceeds 10MB limit`);
                continue;
            }
            
            const reader = new FileReader();
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            
            reader.onload = function(e) {
                if (file.type.startsWith('image/')) {
                    previewItem.innerHTML = `
                        <img src="${e.target.result}" alt="Preview">
                        <div class="remove-file" onclick="this.parentElement.remove()">×</div>
                    `;
                } else {
                    previewItem.innerHTML = `
                        <div style="padding: 20px; text-align: center; background: #f0f0f0;">
                            <i class="fas fa-file"></i>
                            <div>${file.name.substring(0, 10)}...</div>
                        </div>
                        <div class="remove-file" onclick="this.parentElement.remove()">×</div>
                    `;
                }
            };
            
            reader.readAsDataURL(file);
            filePreview.appendChild(previewItem);
        }
    }
}

// Category selection
function initCategorySelection() {
    const categoryChips = document.querySelectorAll('.cat-chip');
    
    categoryChips.forEach(chip => {
        chip.addEventListener('click', function() {
            categoryChips.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// Rewards system
function updateRewards(points) {
    const pointsDisplay = document.getElementById('userPoints');
    const levelBadge = document.getElementById('levelBadge');
    const levelProgress = document.getElementById('levelProgress');
    const nextLevel = document.getElementById('nextLevel');
    
    if (!pointsDisplay) return;
    
    pointsDisplay.textContent = points;
    
    let level = 'Bronze';
    let nextLevelPoints = 200;
    let progress = (points / 200) * 100;
    
    if (points >= 500) {
        level = 'Gold';
        nextLevelPoints = 1000;
        progress = (points / 1000) * 100;
        if (nextLevel) nextLevel.textContent = 'Next level: Platinum (1000 points)';
    } else if (points >= 200) {
        level = 'Silver';
        nextLevelPoints = 500;
        progress = ((points - 200) / 300) * 100;
        if (nextLevel) nextLevel.textContent = 'Next level: Gold (500 points)';
    } else {
        if (nextLevel) nextLevel.textContent = 'Next level: Silver (200 points)';
    }
    
    if (levelBadge) levelBadge.textContent = level;
    if (levelProgress) levelProgress.style.width = Math.min(progress, 100) + '%';
}

// Initialize all components
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    initFileUpload();
    initCategorySelection();
    
    // Get user points if available
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.points) {
        updateRewards(user.points);
    }
});