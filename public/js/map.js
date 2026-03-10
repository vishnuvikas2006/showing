 // map.js - Map functionality for complaint reporting

let map, marker;

function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || typeof L === 'undefined') return;
    
    // Default to Delhi, India
    const defaultLocation = [28.6139, 77.2090];
    
    map = L.map('map').setView(defaultLocation, 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    marker = L.marker(defaultLocation, { draggable: true }).addTo(map);
    
    const coordDisplay = document.getElementById('coordDisplay');
    if (coordDisplay) {
        coordDisplay.textContent = `Selected: ${defaultLocation[0].toFixed(6)}, ${defaultLocation[1].toFixed(6)}`;
    }
    
    marker.on('dragend', function(e) {
        const latlng = e.target.getLatLng();
        if (coordDisplay) {
            coordDisplay.textContent = `Selected: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
        }
    });
    
    map.on('click', function(e) {
        marker.setLatLng(e.latlng);
        if (coordDisplay) {
            coordDisplay.textContent = `Selected: ${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
        }
    });
    
    return { map, marker };
}

function getCurrentLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const latlng = [position.coords.latitude, position.coords.longitude];
            
            if (map && marker) {
                map.setView(latlng, 15);
                marker.setLatLng(latlng);
                
                const coordDisplay = document.getElementById('coordDisplay');
                if (coordDisplay) {
                    coordDisplay.textContent = `Selected: ${latlng[0].toFixed(6)}, ${latlng[1].toFixed(6)}`;
                }
            }
        },
        function(error) {
            alert('Error getting location: ' + error.message);
        }
    );
}

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', initMap);