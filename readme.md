## NEW : 
Use Polygon instead of pinpoint+radius to define flag area. (retrocompatibility is ensured)

# CTFd Geo Challenges Plugin

A geographic challenges plugin for CTFd that allows challenge creators to set location-based puzzles. Players must find specific geographic coordinates to solve challenges.

## Overview

This plugin was originally developed for [Oscar Zulu](https://oscarzulu.org) to enhance Capture The Flag competitions with geographic elements, and is now being offered to the broader CTF creator community.

## Features

- Create challenges requiring users to find specific geographic locations
- Two answer types:
  - **Point + tolerance radius** — an answer counts if it lands within a given radius of the target
  - **Polygon zone** — an answer counts if it lands inside a drawn area (e.g. a specific building)
- Optional dynamic scoring (`geo_dynamic` type): the value decays with solves exactly like CTFd's built-in dynamic challenges (initial value, linear/logarithmic decay function, decay, minimum value)
- Draw and edit polygon answer zones directly on the map (Leaflet.Draw)
- Geocoding support for location search, including exact coordinate input (decimal, DMS, DMM, N/S/E/W)
- Multilingual interface (English, French, Spanish)
- Interactive map interface using Leaflet and OpenStreetMap
- Coordinate selection via map click or search
- Visual feedback showing tolerance zones
- Mobile-friendly responsive design

## Installation

1. Clone this repository to your CTFd installation's `plugins/` directory:
   ```bash
   cd /path/to/CTFd/plugins
   git clone https://github.com/yourusername/geo_challenges.git
   ```

2. Restart your CTFd instance to load the plugin.

## Usage

### Creating a Geo Challenge

1. In the CTFd admin panel, go to Challenges → Create Challenge
2. Select "geo" as the challenge type (fixed value), or "geo_dynamic" for a value that decreases as the challenge gets solved
3. Fill in the standard fields (name, category, description, etc.). For "geo_dynamic", also set the initial value, decay function (linear or logarithmic), decay and minimum value — these behave exactly like CTFd's "dynamic" challenge type
4. Choose the **answer type**:
   - *Point + tolerance radius*: click the target location on the map and set a tolerance radius (in meters)
   - *Polygon zone*: use the polygon tool (top-left of the map) to draw the answer area, then fine-tune its vertices
5. Save your challenge

You can search for a place by name or paste exact coordinates (decimal, DMS, DMM, or N/S/E/W) into the search box.

### Solving a Geo Challenge

Players will:
1. See an interactive map when viewing the challenge
2. Place a marker by clicking on the map or using the search box
3. Submit their answer
4. Receive points if their point is within the tolerance radius of the target (point mode) or inside the answer zone (polygon mode)

The target location — coordinates, radius or polygon — is never sent to the player.

## Configuration

The plugin works out of the box with OpenStreetMap, but you can customize the following aspects:

- Tile server URLs in the JavaScript files if you prefer another map provider
- Tolerance radius default values
- UI text via the i18n.js file

## Internationalization

The plugin supports multiple languages. Add additional translations to the `i18n.js` file.

## Requirements

- CTFd v3.0.0 or higher
- Modern browser with JavaScript enabled

## License

This project is licensed under the GPLv3 License - see the LICENSE file for details.

## Acknowledgments

- [Leaflet](https://leafletjs.com/) for the map interface
- [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw) for polygon drawing and editing
- [OpenStreetMap](https://www.openstreetmap.org) for the map tiles
- [Leaflet Control Geocoder](https://github.com/perliedman/leaflet-control-geocoder) for geocoding functionality

## Support the Developer

If you find this plugin useful for your CTF events, consider supporting the developer:

<a href='https://ko-fi.com/D1D11CYJEY' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi1.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request