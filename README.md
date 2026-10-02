# SoilBot Operator

A cross-platform Expo/React Native field console for Android, iOS, tablets, and desktop browsers. Operators can create a grid, follow a robot on the map, assign genetic clone varieties to exact coordinates, monitor environmental telemetry, and retain every run in a local SQLite database.

## Run the app

Requirements: Node.js 22.13 or newer. Install Expo Go for physical Android and iOS testing.

```powershell
npm.cmd install
npm.cmd run start
```

On this Windows/OneDrive workspace, double-click **RUN SOILBOT.cmd**. The launcher synchronizes the source to a local runtime directory and displays a QR code. Scan it with Expo Go on Android, or with the Camera app on iOS.

For the desktop version, double-click **OPEN SOILBOT DESKTOP.cmd** or run:

```powershell
npm.cmd run desktop
```

Create a production desktop website in `dist` with:

```powershell
npm.cmd run build:web:windows
```

On a normal workspace outside OneDrive, including Linux/macOS and cloud CI, use `npm run build:web`.

Demo mode is enabled initially, so the full mapping workflow works without robot hardware.

`index.ts` is the shared native entry point. `public/index.html` is only the desktop web shell and PWA metadata; application features remain shared React Native code.

## Project structure

```text
soilbot/
|-- App.tsx                 Main application state and navigation
|-- index.ts                React Native entry point
|-- app.json                Expo configuration for Android, iOS, and web
|-- eas.json                Android and iOS build profiles
|-- RUN SOILBOT.cmd         Android/iOS Expo launcher
|-- OPEN SOILBOT DESKTOP.cmd Desktop browser launcher
|-- assets/                 Shared app icons and splash artwork
|-- public/                 Desktop HTML, PWA, and hosting headers
|-- scripts/                Local development launcher scripts
`-- src/
    |-- components/         Reusable interface components
    |-- data/               Supported tree clone varieties
    |-- screens/            Operator workflow screens
    |-- services/           SQLite and ROS bridge integrations
    |-- theme.ts            Shared colors and visual tokens
    `-- types.ts            Shared TypeScript models
```

## Connect to ROS

The app uses the standard `rosbridge_suite` JSON protocol over WebSocket, avoiding coupling the Android build to a ROS distribution. Run a rosbridge server on the robot/network:

```bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

Open **System**, disable Demo mode, enter the bridge URL (for example `ws://192.168.1.10:9090`), and tap **Save & connect**. Android and iOS are configured for a local field network. A desktop app hosted with HTTPS must use a secure `wss://` bridge.

Default topic contract:

| Topic | Accepted values |
| --- | --- |
| `/soilbot/position` | `{x, y, theta}` or a pose containing `position.x` and `position.y` |
| `/soilbot/battery` | `percentage`, `battery`, `level`, or `data` (0–1 or 0–100) |
| `/soilbot/environment` | `temperature`, `air_quality`/`aqi`, and `oxygen`/`o2` |
| `/soilbot/telemetry` | Optional combined message containing any fields above |

Grid coordinates are 1-based (`X1, Y1`). If the robot publishes metric map coordinates, add a ROS transform node that converts them to grid coordinates before publishing to `/soilbot/position`. Topic names can be changed in the app.

The bridge reconnects automatically with exponential backoff. Clone mapping remains available offline, and telemetry is sampled to SQLite every 15 seconds instead of on every ROS message.

## Data model

`expo-sqlite` stores `field_runs`, unique `clone_assignments`, `telemetry_samples`, and connection settings in `soilbot.db`. WAL mode and foreign keys are enabled. Reassigning a coordinate performs an upsert and preserves one authoritative clone per coordinate/run.

## Mobile builds

After signing in to an Expo account, create an installable APK:

```powershell
npx.cmd eas-cli@latest build --platform android --profile preview
```

The production profile creates an Android App Bundle for Google Play:

```powershell
npx.cmd eas-cli@latest build --platform android --profile production
```

Create an iOS App Store build with:

```powershell
npx.cmd eas-cli@latest build --platform ios --profile production
```

## Desktop deployment

Desktop storage uses the WebAssembly build of `expo-sqlite`. Hosting must preserve the `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers supplied in `public/_headers` or `vercel.json`.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd run doctor
```
