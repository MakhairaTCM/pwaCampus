export default class SensorManager {
    watchPosition(callback) {
        if (!navigator.geolocation) return;
        navigator.geolocation.watchPosition(
            (pos) => callback({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy
            }),
            (err) => console.warn("GPS Error", err),
            { enableHighAccuracy: true }
        );
    }
}