# Test videos for Parking Counter

Open the live counter (http://localhost:3000/app), click **Video fileâ€¦** and pick a clip,
or paste a **direct link** from the table into **Video link** and press **Open**.
Then draw a **line** (counts crossings, in / out) or a **zone** (counts what is inside it).

Tips: set **Camera view** first (Overhead for clips 01â€“02). Pick **Detection model â†’ Accurate**
when vehicle *types* matter (bus / truck / bike). Draw lines across the lane, away from parked cars.

| # | File | What's in it | Camera view | Try this | True answer |
|---|---|---|---|---|---|
| 01 | 01-overhead-parking-lot.mp4 | Parking lot from directly above, 4 cars drive through | **Overhead** | Line across the middle, or zone = middle band | 4 cars (2 up, 2 down), 2 at once at 16â€“17 s |
| 02 | 02-street-cars-bikes-people.mp4 | Overhead lot: 2 cars on the left, people and a cyclist on the right | **Overhead** | Zone = left half | 2 cars in zone, never more than 1 at once |
| 03 | 03-underground-garage-dark.mp4 | Dark underground garage, cars drive toward the camera, parked cars both sides | Street level | Line across the lane only, or a zone on the lane | 2 moving cars |
| 04 | 04-garage-car-cinematic.mp4 | 2 parked cars + 1 white car behind them, camera slowly moving | Street level | Zone over the lower part | 3 cars |
| 05 | 05-garage-portrait-phone.mp4 | Phone (portrait) video of a dark row of small parked cars | Street level | Zone over the row | ~6â€“7 cars; the app finds about half (too small and dark) |
| 06 | 06-bus-cars-passing-building.mp4 | A yellow bus and cars passing close to the camera | Street level | Vertical line in the middle | 1 bus + cars (a very close bus may be counted more than once) |
| 07 | 07-bus-busy-city-street.mp4 | Busy New York crossing: taxis, cars, a city bus, crowds | Street level | Line across the road | 1 bus, many cars (taxis are cars) |
| 08 | 08-truck-cargo-highway.mp4 | Lorry with a green container driving away on a highway | Street level | Zone over the road | 1 truck (use **Accurate**; Fast calls it a bus) |
| 09 | 09-truck-rural-highway.mp4 | Lorry with a green trailer crossing a bridge (aerial) | Street level | Vertical line across the bridge | 1 truck (+ small cars far away) |
| 10 | 10-motorcycle-front-view.mp4 | A motorcycle riding toward the camera (portrait) | Street level | Zone over the road | 1 motorcycle |
| 11 | 11-motorcycle-london-streets.mp4 | Riding through London (moving camera), red double-decker buses | Street level | Zone over the frame | buses + cars (moving camera: counts are rough) |
| 12 | 12-bicycle-on-bridge.mp4 | Cyclist in silhouette at sunset | Street level | Zone over the bridge | 1 bicycle â€“ too dark, the app misses it |
| 13 | 13-bicycle-city-streets.mp4 | Cyclists on a sunny city street | Street level | Line across the street | several bicycles |
| 14 | 14-motorcycles-hanoi-traffic.mp4 | Hanoi at night, dense motorbike traffic | Street level | Line across the road | many motorcycles |

## Direct links (for the Video link box) and licences

| # | Direct link | Source page | Licence |
|---|---|---|---|
| 01 | https://github.com/intel-iot-devkit/sample-videos/raw/master/car-detection.mp4 | https://github.com/intel-iot-devkit/sample-videos | CC BY 4.0 (credit: Intel) |
| 02 | https://github.com/intel-iot-devkit/sample-videos/raw/master/person-bicycle-car-detection.mp4 | https://github.com/intel-iot-devkit/sample-videos | CC BY 4.0 (credit: Intel) |
| 03 | â€“ (file only; 4K original) | https://www.pexels.com/video/parking-lot-18320892/ | Pexels licence |
| 04 | â€“ (file only) | https://www.pexels.com/video/cinematic-car-scene-in-parking-garage-30418723/ | Pexels licence |
| 05 | â€“ (file only) | https://www.pexels.com/video/moody-cinematic-urban-parking-garage-scene-29019380/ | Pexels licence |
| 06 | https://assets.mixkit.co/videos/2623/2623-720.mp4 | https://mixkit.co/free-stock-video/cars-and-buses-passing-by-a-large-city-building-2623/ | Mixkit licence |
| 07 | https://assets.mixkit.co/videos/4000/4000-720.mp4 | https://mixkit.co/free-stock-video/busy-street-in-the-city-4000/ | Mixkit licence |
| 08 | https://assets.mixkit.co/videos/28787/28787-720.mp4 | https://mixkit.co/free-stock-video/cargo-truck-driving-on-the-highway-28787/ | Mixkit licence |
| 09 | https://assets.mixkit.co/videos/45488/45488-720.mp4 | https://mixkit.co/free-stock-video/large-truck-driving-along-a-rural-highway-45488/ | Mixkit licence |
| 10 | https://assets.mixkit.co/videos/39930/39930-720.mp4 | https://mixkit.co/free-stock-video/motorcyclist-going-down-a-road-seen-from-the-front-39930/ | Mixkit licence |
| 11 | https://assets.mixkit.co/videos/4263/4263-720.mp4 | https://mixkit.co/free-stock-video/ride-through-the-streets-of-london-4263/ | Mixkit licence |
| 12 | https://assets.mixkit.co/videos/1590/1590-720.mp4 | https://mixkit.co/free-stock-video/person-cycling-on-bridge-1590/ | Mixkit licence |
| 13 | https://assets.mixkit.co/videos/41884/41884-720.mp4 | https://mixkit.co/free-stock-video/bike-ride-as-a-couple-through-the-streets-of-a-41884/ | Mixkit licence |
| 14 | https://upload.wikimedia.org/wikipedia/commons/e/e2/Trafiko_en_Hanojo.webm | https://commons.wikimedia.org/wiki/File:Trafiko_en_Hanojo.webm | Wikimedia Commons (see file page) |

Files 03â€“05 and 14 were converted to 720p H.264 MP4 for quick upload; the rest are as downloaded.
These clips are for testing and demos. Mixkit and Pexels don't allow re-hosting their clips as a
collection, so the files themselves are not in this repository - use the links above.

