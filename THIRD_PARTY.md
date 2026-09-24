# Third-party software

Linkoi originated from the author's Attolink package in Tabstash. It uses Metascraper and its metadata rules (Microlink contributors, MIT) as a fallback, and Hono (MIT) for the Worker HTTP adapter. These dependencies are installed separately; their licenses remain applicable. Linkoi's koi SVGs are original assets created for this repository.

Before a public release, review the resolved dependency tree and ship required notices for any code that is bundled. Do not describe Linkoi as independent of Metascraper: the fallback uses it.

## Landing page animation

The landing page adapts DitherVeil from React Bits by David Haz, under its MIT + Commons Clause terms. The full notice is in `site/vendor/REACT-BITS-LICENSE.md`. This code is part of the website only and is not included in the Linkoi npm packages. Source: https://github.com/DavidHDev/react-bits/tree/main/src/content/Animations/DitherVeil

The website also adapts React Bits SpotlightCard and MagnetLines. These website-only interactions use the same notice in `site/vendor/REACT-BITS-LICENSE.md`. The pointer handlers are scoped to their sections and disabled for reduced motion and touch input.
