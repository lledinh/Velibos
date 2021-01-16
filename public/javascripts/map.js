function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(loadMap, showError)
    } else {
        x.innerHTML = "Geolocation is not supported by this browser."
    }
}

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
    const R = 6371 // Radius of the earth in km
    const dLat = deg2rad(lat2-lat1) // deg2rad below
    const dLon = deg2rad(lon2-lon1)
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon/2) * Math.sin(dLon/2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    const d = R * c // Distance in km
    return d
}

function deg2rad(deg) {
    return deg * (Math.PI/180)
}

function compareDistance(a, b) {
    if (a.distance < b.distance)
        return -1;
    if (a.distance > b.distance)
        return 1;

    return 0;
}

function goToPoint(map, latitude, longitude) {
    map.panTo(new L.LatLng(latitude, longitude))
}

async function loadMap(position) {
    const leafletMap = L.map('map').setView([position.coords.latitude, position.coords.longitude], 16.5)

    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: 'Map data &copy <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: 'pk.eyJ1IjoibGxlZGluaCIsImEiOiJja2pza3h1ajQzcHc0MnNxb2d1a2ZoeGRjIn0.gB75rUjNLxU8Tk_NN3phsg'
    }).addTo(leafletMap)

    const bikeOkIcon = L.icon({
        iconUrl: '/images/bike-ok.png',
        iconSize: [48, 48]
    })
    const bikeKoIcon = L.icon({
        iconUrl: '/images/bike-ko.png',
        iconSize: [48, 48]
    })
    const bikeNearIcon = L.icon({
        iconUrl: '/images/bike-pres.png',
        iconSize: [48, 48]
    })

    const userPositionMarker = L.marker([position.coords.latitude, position.coords.longitude]).addTo(leafletMap)

    const response = await fetch('https://api.jcdecaux.com/vls/v3/stations?contract=toulouse&apiKey=254dd398a3d00e44977933694734ba3829e89e32')
    const json = await response.json()

    const nearbyStations = json.filter(station => {
        return station.mainStands.availabilities.bikes > 0
    }).map(station => {
            station.distance = getDistanceFromLatLonInKm(position.coords.latitude, position.coords.longitude, station.position.latitude, station.position.longitude)
            return station
    }).filter(station => {
        return station.distance < 0.5;
    }).sort(compareDistance)

    var template = Handlebars.compile("<li><div class='divClick' data-name='{{ titre }}'><h4>{{ titre }}</h4><p>{{ distance }} {{ velos }}</p></div.divClick><div class='separator'></div></li>")

    const nearestStation = nearbyStations[0]

    console.log(json.length)
    console.log(nearbyStations.length)
    console.log(nearbyStations)

    let content = "";
    for (let i = 0; i < nearbyStations.length; i++) {
        content = content + template({
            latitude: nearbyStations[i].position.latitude,
            longitude: nearbyStations[i].position.longitude,
            titre: nearbyStations[i].name,
            distance: nearbyStations[i].distance,
            velos: nearbyStations[i].mainStands.availabilities.bikes,
        })
    }
    let node = document.querySelector("#list-stations ul");
    node.innerHTML = node.innerHTML + content;

    const elements = node.querySelectorAll('.divClick')

    elements.forEach(function(element) {
        element.onclick = () => {
            const station = nearbyStations.filter(station => {
               return station.name === element.dataset.name
            })[0];
            leafletMap.panTo(new L.LatLng(station.position.latitude, station.position.longitude))
        }
    });


    for (const r of json) {
        // console.log(r.name + " => " + (getDistanceFromLatLonInKm(position.coords.latitude, position.coords.longitude, r.position.latitude, r.position.longitude)))
        let icon = (r.mainStands.availabilities.bikes > 0) ? bikeOkIcon : bikeKoIcon
        if (r.name === nearestStation.name) icon = bikeNearIcon;
        var marker = L.marker([r.position.latitude, r.position.longitude], {icon: icon}).addTo(leafletMap)
        marker
            .bindPopup('<h3>' + r.name + '</h3>' + '<p>' + r.mainStands.availabilities.bikes + ' vélos disponibles sur ' + r.mainStands.capacity + ' places</p>')
            .on("popupopen", () => {
                leafletMap.panTo(new L.LatLng(r.position.latitude, r.position.longitude))
            })
    }
}

function showError(error) {
    switch(error.code) {
        case error.PERMISSION_DENIED:
            x.innerHTML = "User denied the request for Geolocation."
            break
        case error.POSITION_UNAVAILABLE:
            x.innerHTML = "Location information is unavailable."
            break
        case error.TIMEOUT:
            x.innerHTML = "The request to get user location timed out."
            break
        case error.UNKNOWN_ERROR:
            x.innerHTML = "An unknown error occurred."
            break
    }
}

window.onload = (e) => {
    getLocation()
}
