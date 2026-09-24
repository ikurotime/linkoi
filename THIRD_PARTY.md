# Third-party software

Linkoi's extraction code uses its own HTML parser and normalization rules. The core package has no runtime dependencies. The Worker HTTP adapter uses Hono under the MIT license. Its license remains applicable.

## Landing page animation

The landing page adapts DitherVeil from React Bits by David Haz, under its MIT + Commons Clause terms. The full notice is in `site/vendor/REACT-BITS-LICENSE.md`. This code is part of the website only and is not included in the Linkoi npm packages. Source: https://github.com/DavidHDev/react-bits/tree/main/src/content/Animations/DitherVeil

The website also adapts React Bits SpotlightCard and MagnetLines. These website-only interactions use the same notice in `site/vendor/REACT-BITS-LICENSE.md`. The pointer handlers are scoped to their sections and disabled for reduced motion and touch input.
