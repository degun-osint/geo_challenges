# WARNING : This plugins has been refactored because of a previous security issue.

(it is also now compatible with CTFd3.8)


# CTFd Geo Challenges Plugin

A geographic challenges plugin for CTFd that allows challenge creators to set location-based puzzles. Players must find specific geographic coordinates to solve challenges.

## Overview

This plugin was originally developed for [Oscar Zulu](https://oscarzulu.org) to enhance Capture The Flag competitions with geographic elements, and is now being offered to the broader CTF creator community.

## Features

- Create challenges requiring users to find specific geographic locations
- Set custom tolerance radius for accepting answers
- Geocoding support for location search
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
2. Select "geo" as the challenge type
3. Fill in the standard fields (name, category, description, etc.)
4. Set the point value and select the target location on the map
5. Set a tolerance radius (in meters)
6. Save your challenge

### Solving a Geo Challenge

Players will:
1. See an interactive map when viewing the challenge
2. Place a marker by clicking on the map or using the search box
3. Submit their answer
4. Receive points if their selected location is within the tolerance radius of the target

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