# SoilBot deployment package

This folder is a complete cross-platform project. Do not upload or copy a `node_modules` folder; deployment services install the exact dependencies from `package-lock.json`.

## Desktop browser

- Windows: double-click `OPEN SOILBOT DESKTOP.cmd`.
- Static hosting: upload the contents of `dist` to a host that supports the headers in `dist/_headers`.
- Vercel: upload or connect the whole folder. `vercel.json` runs the web build.
- Rebuild on Windows/OneDrive with `npm.cmd run build:web:windows`.

## Android and iOS

- Double-click `RUN SOILBOT.cmd`, then scan the QR code with Expo Go.
- Android APK: `npm run build:android:preview`
- Android production: `npm run build:android:production`
- iOS production: `npm run build:ios:production`

The app starts in demo mode and does not require robot hardware. Configure the ROS bridge later from the System screen.
