# Custom Proguard rules for Neno Music Android App

# Keep all JavascriptInterface annotations and methods for WebView <-> JS Bridge
-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep the WebAppInterface and its methods used by AndroidMediaBridge
-keep class com.neno.desktop.MainActivity$WebAppInterface {
    public <methods>;
}

# Keep MediaPlaybackService and its public members for background audio playback & notifications
-keep class com.neno.desktop.MediaPlaybackService {
    public <methods>;
}

# Keep AndroidX Media and MediaSession classes
-keep class androidx.media.** { *; }
-keep class android.support.v4.media.** { *; }

# Strip verbose/debug logging calls in release builds if desired, but keep crash handlers
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
}