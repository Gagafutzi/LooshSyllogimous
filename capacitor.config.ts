import { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android wrapper.
 *
 * Capacitor serves the built app from a local server inside the WebView, so
 * the absolute base href in index.html is correct here — unlike the Pages
 * build, which lives under a subpath and rewrites it.
 */
const config: CapacitorConfig = {
    appId: 'com.gagafutzi.looshsyllogimous',
    appName: 'Loosh Syllogimous',
    webDir: 'dist/multi-layout',
    android: {
        // Nothing here talks to a network; a cleartext exception would only
        // widen what the app is allowed to do.
        allowMixedContent: false,
    },
};

export default config;
