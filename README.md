# London Nights

A playable third-person open-world prototype of central London in the browser. Walk and drive around London Bridge and the City, visit the Shard and the Gherkin, hop a red double-decker, and take the Tube between stations.

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, licensed under the [ODbL](https://opendatacommons.org/licenses/odbl/).

This is an original game. It is not affiliated with any existing series, and the cars are unbranded originals.

## Play

Open the deployed site, or run it locally:

```bash
npm install
npm run dev
```

On a phone, add the page to your Home Screen for a full-screen view. Tested with desktop browsers and mobile Safari (iPhone).

## Controls

| Action | Desktop | Phone |
| --- | --- | --- |
| Walk | WASD or arrows | Left stick |
| Run | Shift | RUN |
| Look | Mouse (click to lock) | Drag on the right |
| Enter / exit cars, shops, Tube | E | E button |
| Brake (in a car) | Space | BRAKE |
| Customise a car | F | — |
| Help | H | — |

Add `?play=1` to the URL to skip the character creator (useful for tests).

## Credits

- Street layout, river, parks and station positions: OpenStreetMap
- Engine: Three.js
