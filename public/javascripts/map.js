function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(loadMap, showError)
    } else {
        x.innerHTML = "Geolocation is not supported by this browser."
    }
}

function isScreenMobile() {
    return window.innerWidth < 1025;
}


function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371 // Radius of the earth in km
    const dLat = deg2rad(lat2-lat1) // deg2rad below
    const dLon = deg2rad(lon2-lon1)
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon/2) * Math.sin(dLon/2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
     // Distance in km
    return R * c
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

async function loadMap(position) {
    const leafletMap = L.map('map').setView([position.coords.latitude, position.coords.longitude], 16.5)

    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: 'Map data &copy <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 30,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: 'pk.eyJ1IjoibGxlZGluaCIsImEiOiJja2pza3h1ajQzcHc0MnNxb2d1a2ZoeGRjIn0.gB75rUjNLxU8Tk_NN3phsg'
    }).addTo(leafletMap)

    const bikeOkIcon = L.icon({
        iconUrl: '/velibos/static/images/bike-ok.png',
        iconSize: [48, 48]
    })
    const bikeKoIcon = L.icon({
        iconUrl: '/velibos/static/images/bike-ko.png',
        iconSize: [48, 48]
    })
    const bikeNearIcon = L.icon({
        iconUrl: '/velibos/static/images/bike-pres.png',
        iconSize: [48, 48]
    })

    const buttonCenter = document.querySelector('#center-button')
    buttonCenter.onclick = (() => {
        leafletMap.panTo(new L.LatLng(position.coords.latitude, position.coords.longitude))
    })

    const buttonList = document.querySelector('#list-button')
    buttonList.onclick = (() => {
        const stations = document.querySelector('#list-stations')
        stations.classList.toggle("show");
    })

    const userPositionMarker = L.marker([position.coords.latitude, position.coords.longitude]).addTo(leafletMap)

    const response = await fetch('https://api.jcdecaux.com/vls/v3/stations?contract=toulouse&apiKey=254dd398a3d00e44977933694734ba3829e89e32')
    const json = await response.json()

    const stations = json.map(station => {
        station.distance = getDistanceFromLatLonInKm(position.coords.latitude, position.coords.longitude, station.position.latitude, station.position.longitude)
        return station
    });

    const nearbyStations = json.filter(station => {
        return station.mainStands.availabilities.bikes > 0
    }).map(station => {
            station.distance = getDistanceFromLatLonInKm(position.coords.latitude, position.coords.longitude, station.position.latitude, station.position.longitude)
            return station
    }).filter(station => {
        return station.distance < 0.5;
    }).sort(compareDistance)

    const templateStationItemList = Handlebars.compile("<li><div class='divClick' data-name='{{ titre }}'><h4>{{ titre }}</h4><p>Situé à {{ distance }}m. {{ velos }}</p></div><div class='separator'></div></li>")
    const templateStationInfo = Handlebars.compile(
        "<div class='name'><h4>{{ titre }}</h4></div><div class='infos'><p>Situé à {{ distance }}m</p>" +
        "<p>{{ address }}</p>" +
        "<p><a href='https://www.google.com/maps/dir//43.6057292,1.4492338'>J'y vais!</a></p></div>")

    const nearestStation = nearbyStations[0]

    console.log(json.length)
    console.log(nearbyStations.length)
    console.log(nearbyStations)

    let content = "";
    for (let i = 0; i < nearbyStations.length; i++) {
        content = content + templateStationItemList({
            latitude: nearbyStations[i].position.latitude,
            longitude: nearbyStations[i].position.longitude,
            titre: nearbyStations[i].name,
            distance: Math.floor(nearbyStations[i].distance * 1000),
            velos: nearbyStations[i].mainStands.availabilities.bikes,
        })
    }
    let nodeUl = document.querySelector("#list-stations ul");
    nodeUl.innerHTML = nodeUl.innerHTML + content;

    const elements = nodeUl.querySelectorAll('.divClick')
    elements.forEach(function(element) {
        element.onclick = () => {
            const station = nearbyStations.filter(station => {
               return station.name === element.dataset.name
            })[0];
            leafletMap.panTo(new L.LatLng(station.position.latitude, station.position.longitude))
            if (isScreenMobile()) {
                console.log("Mobile screen")
            }
        }
    });

    let node = document.querySelector("#nearest-station");

    node.innerHTML = templateStationInfo({
        titre: nearestStation.name,
        distance: Math.floor(nearestStation.distance * 1000),
        velos: nearestStation.mainStands.availabilities.bikes,
        address: nearestStation.address,
    })

    for (const r of stations) {
        // console.log(r.name + " => " + (getDistanceFromLatLonInKm(position.coords.latitude, position.coords.longitude, r.position.latitude, r.position.longitude)))
        let icon = (r.mainStands.availabilities.bikes > 0) ? bikeOkIcon : bikeKoIcon
        if (r.name === nearestStation.name) icon = bikeNearIcon;
        var marker = L.marker([r.position.latitude, r.position.longitude], {icon: icon}).addTo(leafletMap)
        marker
            .bindPopup('<h4>' + r.name + '</h4>' + '<p>' + r.mainStands.availabilities.bikes + ' vélos disponibles sur ' + r.mainStands.capacity + ' places</p>')
            .on("popupopen", () => {
                leafletMap.panTo(new L.LatLng(r.position.latitude, r.position.longitude))
                node.innerHTML = templateStationInfo({
                    titre: r.name,
                    distance: Math.floor(r.distance * 1000),
                    velos: r.mainStands.availabilities.bikes,
                    address: r.address,
                })
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
