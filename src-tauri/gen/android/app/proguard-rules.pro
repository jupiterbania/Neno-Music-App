# ── Tauri & WebView bridge ────────────────────────────────────────────────────
# Tauri uses reflection and JS→native calls extensively. Without these rules the
# R8 minifier strips the bridge classes and the app crashes at runtime even
# though it compiles fine.

# Keep all Tauri internals
-keep class app.tauri.** { *; }
-keep interface app.tauri.** { *; }
-keepclassmembers class app.tauri.** { *; }

# Keep the main Activity and anything annotated for JS interop
-keep class com.neno.desktop.** { *; }
-keepclassmembers class com.neno.desktop.** { *; }
-keep class com.zuno.desktop.** { *; }
-keepclassmembers class com.zuno.desktop.** { *; }

# AndroidMediaBridge — called from JavaScript by name
-keep class * extends android.webkit.WebView { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Tauri plugin entry points loaded via reflection
-keep class * implements app.tauri.plugin.Plugin { *; }
-keepclassmembers class * implements app.tauri.plugin.Plugin {
    public *;
}

# ── AndroidX / Lifecycle ──────────────────────────────────────────────────────
-keep class androidx.lifecycle.** { *; }
-keep class androidx.media.** { *; }
-keep class androidx.webkit.** { *; }

# ── Kotlin runtime ────────────────────────────────────────────────────────────
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.**

# ── General safety ────────────────────────────────────────────────────────────
# Preserve line numbers in stack traces for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Suppress warnings about missing classes that are optional at runtime
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**