package com.neno.desktop

import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {

    companion object {
        init {
            try {
                System.loadLibrary("neno_lib")
            } catch (e: Throwable) {
                try {
                    System.loadLibrary("zuno_lib")
                } catch (e2: Throwable) {
                    e2.printStackTrace()
                }
            }
        }

        @JvmStatic
        var instance: MainActivity? = null
            private set
    }

    var targetWebView: WebView? = null
        private set

    private external fun initAndroidContext(context: android.content.Context)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        instance = this

        try {
            initAndroidContext(applicationContext)
        } catch (e: Throwable) {
            e.printStackTrace()
        }

        onBackPressedDispatcher.addCallback(this, object : androidx.activity.OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val webView = targetWebView
                if (webView != null) {
                    webView.evaluateJavascript(
                        "(function() { if (typeof window.__neno_handle_android_back === 'function') { return window.__neno_handle_android_back(); } if (typeof window.__zuno_handle_android_back === 'function') { return window.__zuno_handle_android_back(); } return false; })()"
                    ) { result ->
                        if (result != "true") {
                            moveTaskToBack(true)
                        }
                    }
                } else {
                    moveTaskToBack(true)
                }
            }
        })

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }

        registerMediaControlReceiver()

        window.decorView.post {
            setupWebView()
        }
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        targetWebView = webView
        setupWebView()
    }

    override fun onResume() {
        super.onResume()
        setupWebView()
        targetWebView?.resumeTimers()
    }

    override fun onPause() {
        super.onPause()
        // Counteract WryActivity calling webView.onPause() which stops media and JS
        targetWebView?.onResume()
        targetWebView?.resumeTimers()
    }

    override fun onStop() {
        super.onStop()
        // Keep webview media playback engine active when screen locks or app minimizes
        targetWebView?.onResume()
        targetWebView?.resumeTimers()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        val webView = targetWebView
        if (webView != null) {
            webView.evaluateJavascript(
                "(function() { if (typeof window.__neno_handle_android_back === 'function') { return window.__neno_handle_android_back(); } if (typeof window.__zuno_handle_android_back === 'function') { return window.__zuno_handle_android_back(); } return false; })()"
            ) { result ->
                if (result != "true") {
                    moveTaskToBack(true)
                }
            }
        } else {
            moveTaskToBack(true)
        }
    }

    private fun setupWebView() {
        val webView = targetWebView ?: findWebView(window.decorView)
        if (webView != null) {
            targetWebView = webView
            webView.settings.apply {
                mediaPlaybackRequiresUserGesture = false
                domStorageEnabled = true
                databaseEnabled = true
                cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
                useWideViewPort = true
                loadWithOverviewMode = true
                mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                allowFileAccess = true
                allowContentAccess = true
            }
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
            webView.isVerticalScrollBarEnabled = false
            webView.isHorizontalScrollBarEnabled = false
            webView.addJavascriptInterface(WebAppInterface(this), "AndroidMediaBridge")
        }
    }

    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                val child = findWebView(view.getChildAt(i))
                if (child != null) return child
            }
        }
        return null
    }

    fun dispatchMediaControl(command: String) {
        runOnUiThread {
            targetWebView?.evaluateJavascript(
                "if (window.__neno_media_command) { window.__neno_media_command('$command'); } else if (window.__zuno_media_command) { window.__zuno_media_command('$command'); } else { window.dispatchEvent(new CustomEvent('com.neno.desktop.MEDIA_CONTROL', { detail: { command: '$command' } })); }",
                null
            )
        }
    }

    private var mediaControlReceiver: android.content.BroadcastReceiver? = null

    private fun registerMediaControlReceiver() {
        mediaControlReceiver = object : android.content.BroadcastReceiver() {
            override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
                val command = intent?.getStringExtra("command")
                if (!command.isNullOrBlank()) {
                    dispatchMediaControl(command)
                }
            }
        }
        val filter = android.content.IntentFilter().apply {
            addAction("com.neno.desktop.MEDIA_CONTROL")
            addAction("com.zuno.desktop.MEDIA_CONTROL")
        }
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(mediaControlReceiver, filter, android.content.Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(mediaControlReceiver, filter)
        }
    }

    private fun unregisterMediaControlReceiver() {
        mediaControlReceiver?.let {
            try {
                unregisterReceiver(it)
            } catch (_: Exception) {}
            mediaControlReceiver = null
        }
    }

    override fun onDestroy() {
        unregisterMediaControlReceiver()
        if (instance == this) {
            instance = null
        }
        super.onDestroy()
    }

    var currentSignInDialog: android.app.Dialog? = null

    fun dismissGoogleSignInDialog() {
        runOnUiThread {
            if (currentSignInDialog?.isShowing == true) {
                currentSignInDialog?.dismiss()
            }
            currentSignInDialog = null
        }
    }

    class WebAppInterface(private val activity: MainActivity) {
        @JavascriptInterface
        fun updateMedia(title: String, artist: String, isPlaying: Boolean) {
            MediaPlaybackService.startOrUpdate(activity, title, artist, isPlaying)
        }

        @JavascriptInterface
        fun updateMedia(title: String, artist: String, isPlaying: Boolean, artworkUrl: String?, durationSec: Long, positionSec: Long) {
            MediaPlaybackService.startOrUpdate(activity, title, artist, isPlaying, artworkUrl, durationSec, positionSec)
        }

        @JavascriptInterface
        fun stopMedia() {
            MediaPlaybackService.stop(activity)
        }

        @JavascriptInterface
        fun signInGoogle() {
            activity.showGoogleSignInDialog()
        }

        @JavascriptInterface
        fun cancelSignInGoogle() {
            activity.dismissGoogleSignInDialog()
        }

        @JavascriptInterface
        fun signOutGoogle() {
            activity.clearGoogleSession()
        }
    }

    fun clearGoogleSession() {
        runOnUiThread {
            try {
                val cookieManager = android.webkit.CookieManager.getInstance()
                cookieManager.removeAllCookies(null)
                cookieManager.flush()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun showGoogleSignInDialog() {
        runOnUiThread {
            val dialog = android.app.Dialog(this, android.R.style.Theme_Black_NoTitleBar_Fullscreen)
            currentSignInDialog = dialog

            val rootLayout = android.widget.LinearLayout(this).apply {
                orientation = android.widget.LinearLayout.VERTICAL
                setBackgroundColor(android.graphics.Color.BLACK)
            }

            // Top Bar
            val topBar = android.widget.LinearLayout(this).apply {
                orientation = android.widget.LinearLayout.HORIZONTAL
                setBackgroundColor(android.graphics.Color.parseColor("#18181b"))
                setPadding(32, 32, 32, 32)
                gravity = android.view.Gravity.CENTER_VERTICAL
            }

            val titleView = android.widget.TextView(this).apply {
                text = "Sign in to YouTube Music"
                setTextColor(android.graphics.Color.WHITE)
                textSize = 18f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                layoutParams = android.widget.LinearLayout.LayoutParams(0, android.view.ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            }

            val closeButton = android.widget.Button(this).apply {
                text = "✕ Close"
                setTextColor(android.graphics.Color.WHITE)
                setBackgroundColor(android.graphics.Color.TRANSPARENT)
                setOnClickListener {
                    dialog.dismiss()
                }
            }

            topBar.addView(titleView)
            topBar.addView(closeButton)
            rootLayout.addView(topBar)

            // Progress Bar
            val progressBar = android.widget.ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
                layoutParams = android.widget.LinearLayout.LayoutParams(
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                    6
                )
                max = 100
                progress = 0
                visibility = android.view.View.VISIBLE
            }
            rootLayout.addView(progressBar)

            // WebView for Google login
            val loginWebView = android.webkit.WebView(this)
            loginWebView.layoutParams = android.widget.LinearLayout.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.MATCH_PARENT
            )

            val settings = loginWebView.settings
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.setSupportZoom(true)
            settings.builtInZoomControls = true
            settings.displayZoomControls = false
            settings.setSupportMultipleWindows(false)
            settings.javaScriptCanOpenWindowsAutomatically = true

            // Critical: Google OAuth blocks WebView with disallowed_useragent if userAgent contains "; wv" or "Version/4.0"
            val defaultUa = settings.userAgentString
            val customUa = defaultUa
                .replace("; wv", "")
                .replace(Regex("""Version/\d+\.\d+\s*"""), "")
            settings.userAgentString = customUa

            val cookieManager = android.webkit.CookieManager.getInstance()
            cookieManager.setAcceptCookie(true)
            cookieManager.setAcceptThirdPartyCookies(loginWebView, true)

            var signedIn = false
            var pageFinishedOnMusic = false

            fun checkCookies(url: String?, isPageFinished: Boolean) {
                if (signedIn) return
                val currentUrl = url ?: loginWebView.url ?: ""

                val uri = try { android.net.Uri.parse(currentUrl) } catch (e: Exception) { null }
                val host = uri?.host?.lowercase() ?: ""

                // Must actually be on music.youtube.com (not accounts.google.com with continue= param)
                if (host != "music.youtube.com") return

                cookieManager.flush()
                // Only inspect YouTube domains, NEVER accounts.google.com (which has mismatched SAPISID)
                val urls = listOf("https://www.youtube.com", "https://music.youtube.com")
                val mergedCookies = mutableMapOf<String, String>()
                for (u in urls) {
                    val raw = cookieManager.getCookie(u) ?: continue
                    for (part in raw.split(";")) {
                        val trimmed = part.trim()
                        if (trimmed.isEmpty()) continue
                        val eqIdx = trimmed.indexOf('=')
                        if (eqIdx > 0) {
                            val key = trimmed.substring(0, eqIdx).trim()
                            val value = trimmed.substring(eqIdx + 1).trim()
                            mergedCookies[key] = value
                        }
                    }
                }

                // YouTube Music API requires SAPISID to compute SAPISIDHASH for authentication
                val hasSapisid = mergedCookies.containsKey("SAPISID") ||
                    mergedCookies.containsKey("__Secure-1PAPISID") ||
                    mergedCookies.containsKey("__Secure-3PAPISID")

                // Ensure YouTube session authentication has completed (LOGIN_INFO or SID)
                val hasSession = mergedCookies.containsKey("LOGIN_INFO") ||
                    mergedCookies.containsKey("SID") ||
                    mergedCookies.containsKey("__Secure-1PSID") ||
                    mergedCookies.containsKey("__Secure-3PSID")

                val hasAuth = hasSapisid && (hasSession || isPageFinished)

                if (hasAuth) {
                    signedIn = true
                    titleView.text = "Signed in! Loading library..."
                    cookieManager.flush()
                    val fullCookieHeader = mergedCookies.entries.joinToString("; ") { "${it.key}=${it.value}" }
                    val quoted = org.json.JSONObject.quote(fullCookieHeader)

                    // Small delay to ensure all session cookie writes are fully flushed before closing
                    loginWebView.postDelayed({
                        targetWebView?.post {
                            targetWebView?.evaluateJavascript("if (window.__neno_on_google_signin) { window.__neno_on_google_signin($quoted); } else if (window.__zuno_on_google_signin) { window.__zuno_on_google_signin($quoted); }", null)
                        }
                        dialog.dismiss()
                    }, 600)
                }
            }

            loginWebView.webChromeClient = object : android.webkit.WebChromeClient() {
                override fun onProgressChanged(view: android.webkit.WebView?, newProgress: Int) {
                    super.onProgressChanged(view, newProgress)
                    progressBar.progress = newProgress
                    if (newProgress >= 100) {
                        progressBar.visibility = android.view.View.GONE
                    } else {
                        progressBar.visibility = android.view.View.VISIBLE
                    }
                }
            }

            loginWebView.webViewClient = object : android.webkit.WebViewClient() {
                override fun onPageFinished(view: android.webkit.WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    val uri = try { android.net.Uri.parse(url ?: "") } catch (e: Exception) { null }
                    if (uri?.host?.lowercase() == "music.youtube.com") {
                        pageFinishedOnMusic = true
                    }
                    checkCookies(url, pageFinishedOnMusic)
                }
            }

            // Back button handling inside the Google sign-in dialog
            dialog.setOnKeyListener { _, keyCode, event ->
                if (keyCode == android.view.KeyEvent.KEYCODE_BACK && event.action == android.view.KeyEvent.ACTION_UP) {
                    if (loginWebView.canGoBack()) {
                        loginWebView.goBack()
                        true
                    } else {
                        dialog.dismiss()
                        true
                    }
                } else {
                    false
                }
            }

            dialog.setOnDismissListener {
                if (currentSignInDialog == dialog) {
                    currentSignInDialog = null
                }
                if (!signedIn) {
                    targetWebView?.evaluateJavascript("if (window.__neno_on_google_signin_cancelled) { window.__neno_on_google_signin_cancelled(); } else if (window.__zuno_on_google_signin_cancelled) { window.__zuno_on_google_signin_cancelled(); }", null)
                }
            }

            // Periodic cookie poll while dialog is visible
            val pollRunnable = object : Runnable {
                override fun run() {
                    if (!signedIn && dialog.isShowing) {
                        checkCookies(loginWebView.url, pageFinishedOnMusic)
                        loginWebView.postDelayed(this, 1000)
                    }
                }
            }
            loginWebView.postDelayed(pollRunnable, 1000)

            rootLayout.addView(loginWebView)
            dialog.setContentView(rootLayout)
            dialog.show()

            // Start fresh without stale cookies so Google always prompts cleanly
            cookieManager.removeAllCookies {
                cookieManager.flush()
                runOnUiThread {
                    loginWebView.loadUrl("https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fmusic.youtube.com%2F")
                }
            }
        }
    }
}
