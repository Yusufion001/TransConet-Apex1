module.exports = {
  expo: {
    name: "TransConet",
    slug: "transconet-apex1",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "transconet",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",

    android: {
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          category: ["BROWSABLE", "DEFAULT"],
          data: [
            {
              scheme: "https",
              host: "verify.transconet.com",
              pathPrefix: "/verify-email"
            }
          ]
        },
      ],
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png"
      },
      predictiveBackGestureEnabled: false,
      package: "com.transconet.apex1"
    },

    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "TransConet uses your location to provide live trip tracking while you are on an active assignment.",
          "isAndroidBackgroundLocationEnabled": true
        }
      ],
      [
        "react-native-maps",
        process.env.GOOGLE_MAP_PLATFORM_KEY
          ? {
              androidGoogleMapsApiKey:
                process.env.GOOGLE_MAP_PLATFORM_KEY
            }
          : {}
      ]
    ],

    platforms: ["android"],

    extra: {
      router: {},
      eas: {
        projectId: "a83a809c-d835-4844-a02a-df74aaf25234"
      },
      apiUrl: process.env.EXPO_PUBLIC_API_URL
    }
  }
};
