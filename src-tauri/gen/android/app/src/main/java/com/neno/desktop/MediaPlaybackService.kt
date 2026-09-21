package com.neno.desktop

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.core.app.NotificationCompat
import java.net.URL
import java.util.concurrent.Executors

class MediaPlaybackService : Service() {

    companion object {
        const val CHANNEL_ID = "neno_playback_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_PLAY = "com.neno.desktop.ACTION_PLAY"
        const val ACTION_PAUSE = "com.neno.desktop.ACTION_PAUSE"
        const val ACTION_NEXT = "com.neno.desktop.ACTION_NEXT"
        const val ACTION_PREV = "com.neno.desktop.ACTION_PREV"
        const val ACTION_STOP = "com.neno.desktop.ACTION_STOP"
        const val ACTION_UPDATE = "com.neno.desktop.ACTION_UPDATE"
        const val ACTION_SYNC_POSITION = "com.neno.desktop.ACTION_SYNC_POSITION"

        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_ARTIST = "extra_artist"
        const val EXTRA_IS_PLAYING = "extra_is_playing"
        const val EXTRA_ARTWORK_URL = "extra_artwork_url"
        const val EXTRA_DURATION_SEC = "extra_duration_sec"
        const val EXTRA_POSITION_SEC = "extra_position_sec"
        const val EXTRA_PLAYBACK_STATE = "extra_playback_state"

        fun startOrUpdate(
            context: Context,
            title: String,
            artist: String,
            isPlaying: Boolean,
            artworkUrl: String? = null,
            durationSec: Long = 0L,
            positionSec: Long = 0L,
            playbackState: String? = null
        ) {
            val intent = Intent(context, MediaPlaybackService::class.java).apply {
                action = ACTION_UPDATE
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_ARTIST, artist)
                putExtra(EXTRA_IS_PLAYING, isPlaying)
                putExtra(EXTRA_ARTWORK_URL, artworkUrl)
                putExtra(EXTRA_DURATION_SEC, durationSec)
                putExtra(EXTRA_POSITION_SEC, positionSec)
                putExtra(EXTRA_PLAYBACK_STATE, playbackState ?: if (isPlaying) "playing" else "paused")
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        fun syncPosition(context: Context, positionSec: Long) {
            val intent = Intent(context, MediaPlaybackService::class.java).apply {
                action = ACTION_SYNC_POSITION
                putExtra(EXTRA_POSITION_SEC, positionSec)
            }
            try {
                context.startService(intent)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, MediaPlaybackService::class.java).apply {
                action = ACTION_STOP
            }
            try {
                context.startService(intent)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var mediaSession: MediaSessionCompat? = null
    private val imageExecutor = Executors.newSingleThreadExecutor()

    private var audioManager: AudioManager? = null
    private var resumeOnFocusGain: Boolean = false
    private var audioFocusRequest: AudioFocusRequest? = null

    private val audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS -> {
                // Permanent loss of audio focus (e.g. another music app started)
                resumeOnFocusGain = false
                if (isPlaying && currentPlaybackState == "playing") {
                    dispatchPause(isTransient = false)
                }
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                // Transient loss of audio focus (e.g. incoming call, another app playing video)
                if (isPlaying && currentPlaybackState == "playing") {
                    resumeOnFocusGain = true
                    dispatchPause(isTransient = true)
                }
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                // Notifications, navigation alerts, chimes: DO NOT pause music playback
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                // Focus regained! (call ended, video finished, audio focus restored)
                if (resumeOnFocusGain) {
                    resumeOnFocusGain = false
                    dispatchPlay()
                }
            }
        }
    }

    private fun requestAudioFocus(): Boolean {
        val am = audioManager ?: return false
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (audioFocusRequest == null) {
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
                audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(audioAttributes)
                    .setAcceptsDelayedFocusGain(true)
                    .setOnAudioFocusChangeListener(audioFocusChangeListener)
                    .build()
            }
            am.requestAudioFocus(audioFocusRequest!!) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        } else {
            @Suppress("DEPRECATION")
            am.requestAudioFocus(
                audioFocusChangeListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        }
    }

    private fun abandonAudioFocus() {
        val am = audioManager ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest?.let { am.abandonAudioFocusRequest(it) }
            } else {
                @Suppress("DEPRECATION")
                am.abandonAudioFocus(audioFocusChangeListener)
            }
        } catch (_: Exception) {}
    }

    private var telephonyManager: TelephonyManager? = null
    private var isNoisyReceiverRegistered: Boolean = false

    private var currentTitle: String = "Neno"
    private var currentArtist: String = "Playing"
    private var isPlaying: Boolean = true
    private var currentPlaybackState: String = "playing" // "playing" | "paused" | "loading" | "idle"
    private var currentArtworkUrl: String? = null
    private var currentArtworkBitmap: Bitmap? = null
    private var loadingArtworkUrl: String? = null
    private var failedArtworkUrl: String? = null
    private var cachedFallbackIcon: Bitmap? = null
    private var durationSec: Long = 0L
    private var positionSec: Long = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    private val serviceKeepaliveHandler = Handler(Looper.getMainLooper())
    private val serviceKeepaliveRunnable = object : Runnable {
        override fun run() {
            try {
                MainActivity.instance?.let { act ->
                    act.runOnUiThread {
                        act.targetWebView?.let { wv ->
                            wv.resumeTimers()
                            wv.evaluateJavascript("void 0;", null)
                        }
                    }
                }
            } catch (_: Throwable) {}
            serviceKeepaliveHandler.postDelayed(this, 1000)
        }
    }

    override fun onCreate() {
        super.onCreate()
        try {
            audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            createNotificationChannel()
            acquireWakeLock()
            initMediaSession()
            setupTelephonyListener()
            registerAudioRouteMonitoring()
            updateNotification()
            serviceKeepaliveHandler.post(serviceKeepaliveRunnable)
        } catch (e: Throwable) {
            e.printStackTrace()
        }
    }

    // ── Becoming Noisy & Audio Route Changes (Bluetooth / Headphones) ──
    private var audioDeviceCallback: android.media.AudioDeviceCallback? = null
    private var audioRouteReceiver: BroadcastReceiver? = null
    private var lastServiceRouteEventTime: Long = 0L
    private var isAudioRouteMonitoringActive: Boolean = false

    private fun notifyAudioDeviceChanged() {
        if (!isAudioRouteMonitoringActive) return
        val now = System.currentTimeMillis()
        if (now - lastServiceRouteEventTime < 1000) return
        lastServiceRouteEventTime = now

        sendMediaCommand("audioDeviceChanged")
    }

    private fun registerAudioRouteMonitoring() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val am = audioManager ?: (getSystemService(Context.AUDIO_SERVICE) as? AudioManager)
                if (am != null) {
                    audioDeviceCallback = object : android.media.AudioDeviceCallback() {
                        override fun onAudioDevicesAdded(addedDevices: Array<out android.media.AudioDeviceInfo>?) {
                            notifyAudioDeviceChanged()
                        }

                        override fun onAudioDevicesRemoved(removedDevices: Array<out android.media.AudioDeviceInfo>?) {
                            notifyAudioDeviceChanged()
                        }
                    }
                    try {
                        am.registerAudioDeviceCallback(audioDeviceCallback, android.os.Handler(android.os.Looper.getMainLooper()))
                    } catch (_: Throwable) {}
                }
            }

            audioRouteReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    when (intent?.action) {
                        android.bluetooth.BluetoothDevice.ACTION_ACL_CONNECTED,
                        android.bluetooth.BluetoothDevice.ACTION_ACL_DISCONNECTED,
                        android.bluetooth.BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED,
                        AudioManager.ACTION_HEADSET_PLUG -> {
                            notifyAudioDeviceChanged()
                        }
                    }
                }
            }
            val filter = IntentFilter().apply {
                addAction(android.bluetooth.BluetoothDevice.ACTION_ACL_CONNECTED)
                addAction(android.bluetooth.BluetoothDevice.ACTION_ACL_DISCONNECTED)
                addAction(android.bluetooth.BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED)
                addAction(AudioManager.ACTION_HEADSET_PLUG)
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    registerReceiver(audioRouteReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
                } else {
                    registerReceiver(audioRouteReceiver, filter)
                }
            } catch (_: Throwable) {}
        } catch (_: Throwable) {}

        Handler(Looper.getMainLooper()).postDelayed({
            isAudioRouteMonitoringActive = true
        }, 2000)
    }

    private fun unregisterAudioRouteMonitoring() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val am = audioManager ?: (getSystemService(Context.AUDIO_SERVICE) as? AudioManager)
            audioDeviceCallback?.let {
                try {
                    am?.unregisterAudioDeviceCallback(it)
                } catch (_: Exception) {}
                audioDeviceCallback = null
            }
        }
        audioRouteReceiver?.let {
            try {
                unregisterReceiver(it)
            } catch (_: Exception) {}
            audioRouteReceiver = null
        }
    }

    // ── Becoming Noisy (Headphones / Bluetooth unplugged) ───────────────
    private val noisyReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
                if (isPlaying) {
                    resumeOnFocusGain = false
                    dispatchPause(isTransient = false)
                }
            }
        }
    }

    private fun registerNoisyReceiver() {
        if (!isNoisyReceiverRegistered) {
            try {
                registerReceiver(noisyReceiver, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY))
                isNoisyReceiverRegistered = true
            } catch (_: Exception) {}
        }
    }

    private fun unregisterNoisyReceiver() {
        if (isNoisyReceiverRegistered) {
            try {
                unregisterReceiver(noisyReceiver)
            } catch (_: Exception) {}
            isNoisyReceiverRegistered = false
        }
    }

    // ── Telephony Call State Detection ─────────────────────────────────
    private fun setupTelephonyListener() {
        try {
            telephonyManager = getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
            val manager = telephonyManager ?: return

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val callback = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                    override fun onCallStateChanged(state: Int) {
                        handleCallState(state)
                    }
                }
                manager.registerTelephonyCallback(mainExecutor, callback)
            } else {
                @Suppress("DEPRECATION")
                val listener = object : PhoneStateListener() {
                    @Deprecated("Deprecated in Java")
                    override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                        handleCallState(state)
                    }
                }
                @Suppress("DEPRECATION")
                manager.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
            }
        } catch (_: Exception) {
            // Audio focus handles calls even if telephony access is restricted
        }
    }

    private fun handleCallState(state: Int) {
        when (state) {
            TelephonyManager.CALL_STATE_RINGING,
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                // Phone call incoming or active!
                if (isPlaying) {
                    resumeOnFocusGain = true
                    dispatchPause(isTransient = true)
                }
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                // Call ended ("call cut hone ke baad")! Auto-resume playback.
                if (resumeOnFocusGain) {
                    resumeOnFocusGain = false
                    dispatchPlay()
                }
            }
        }
    }

    private fun sendMediaCommand(command: String) {
        val act = MainActivity.instance
        if (act != null) {
            act.dispatchMediaControl(command)
        } else {
            sendBroadcast(Intent("com.neno.desktop.MEDIA_CONTROL").putExtra("command", command))
        }
    }

    // ── Systematic Play / Pause Dispatching ────────────────────────────
    private fun dispatchPlay() {
        isPlaying = true
        currentPlaybackState = "playing"
        resumeOnFocusGain = false
        requestAudioFocus()
        acquireWakeLock()
        registerNoisyReceiver()
        sendMediaCommand("play")
        updateNotification()
    }

    private fun dispatchPause(isTransient: Boolean = false) {
        isPlaying = false
        currentPlaybackState = "paused"
        if (!isTransient) {
            abandonAudioFocus()
        }
        releaseWakeLock()
        unregisterNoisyReceiver()
        sendMediaCommand("pause")
        updateNotification()
    }

    private fun initMediaSession() {
        try {
            mediaSession = MediaSessionCompat(this, "NenoMediaSession").apply {
                isActive = true
                setCallback(object : MediaSessionCompat.Callback() {
                    override fun onPlay() {
                        dispatchPlay()
                    }

                    override fun onPause() {
                        resumeOnFocusGain = false
                        dispatchPause(isTransient = false)
                    }

                    override fun onSkipToNext() {
                        sendMediaCommand("next")
                    }

                    override fun onSkipToPrevious() {
                        sendMediaCommand("prev")
                    }

                    override fun onSeekTo(pos: Long) {
                        val posSec = pos / 1000L
                        positionSec = posSec
                        sendMediaCommand("seekTo:$posSec")
                        updateNotification()
                    }

                    override fun onStop() {
                        stop(this@MediaPlaybackService)
                    }
                })
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                resumeOnFocusGain = false
                abandonAudioFocus()
                unregisterNoisyReceiver()
                releaseWakeLock(immediate = true)
                stopForeground(true)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_PLAY -> {
                resumeOnFocusGain = false
                dispatchPlay()
            }
            ACTION_PAUSE -> {
                resumeOnFocusGain = false
                dispatchPause(isTransient = false)
            }
            ACTION_NEXT -> {
                sendMediaCommand("next")
            }
            ACTION_PREV -> {
                sendMediaCommand("prev")
            }
            ACTION_SYNC_POSITION -> {
                val newPos = intent.getLongExtra(EXTRA_POSITION_SEC, positionSec)
                if (Math.abs(newPos - positionSec) >= 2L) {
                    positionSec = newPos
                    updateMediaSessionPlaybackState()
                }
            }
            ACTION_UPDATE -> {
                val newTitle = intent.getStringExtra(EXTRA_TITLE) ?: "Neno"
                val newArtist = intent.getStringExtra(EXTRA_ARTIST) ?: "Playing"
                val newIsPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true)
                val newDurationSec = intent.getLongExtra(EXTRA_DURATION_SEC, 0L)
                val newPositionSec = intent.getLongExtra(EXTRA_POSITION_SEC, 0L)
                val newArtworkUrl = intent.getStringExtra(EXTRA_ARTWORK_URL)
                val newPlaybackState = intent.getStringExtra(EXTRA_PLAYBACK_STATE) ?: if (newIsPlaying) "playing" else "paused"

                val metadataChanged = (newTitle != currentTitle) ||
                    (newArtist != currentArtist) ||
                    (newDurationSec != durationSec) ||
                    (newArtworkUrl != null && newArtworkUrl != currentArtworkUrl)

                val playStateChanged = (newIsPlaying != isPlaying) || (newPlaybackState != currentPlaybackState)

                currentTitle = newTitle
                currentArtist = newArtist
                durationSec = newDurationSec
                positionSec = newPositionSec
                currentPlaybackState = newPlaybackState

                if (newIsPlaying || newPlaybackState == "loading" || newPlaybackState == "playing") {
                    isPlaying = (newPlaybackState == "playing")
                    resumeOnFocusGain = false
                    requestAudioFocus()
                    acquireWakeLock()
                    registerNoisyReceiver()
                } else {
                    isPlaying = false
                    if (!resumeOnFocusGain) {
                        abandonAudioFocus()
                    }
                    releaseWakeLock()
                    unregisterNoisyReceiver()
                }

                if (metadataChanged || playStateChanged) {
                    if (newArtworkUrl != null) {
                        loadArtworkAsync(newArtworkUrl)
                    }
                    updateNotification()
                } else {
                    updateMediaSessionPlaybackState()
                }
            }
            else -> {
                updateNotification()
            }
        }
        return START_STICKY
    }

    /**
     * Returns an ordered list of URLs to try for artwork, preferring the highest resolution HD images.
     *
     * For YouTube video thumbnails (i.ytimg.com/vi/…) maxresdefault (1280×720) and sddefault (640×480)
     * provide crystal clear notification artwork.
     * For YouTube Music covers (googleusercontent / ggpht), converting low-res thumbnails (=w120, =s60)
     * to =w1200-h1200-l90-rj or =s1200 provides pristine HD album art.
     */
    private fun artworkUrlCandidates(url: String): List<String> {
        val trimmed = url.trim()
        if (trimmed.isEmpty()) return emptyList()

        val candidates = mutableListOf<String>()

        // 1. YouTube video thumbnails: i.ytimg.com, img.youtube.com
        val videoIdRegex = Regex("""(?:i\.ytimg\.com|img\.youtube\.com)/(?:vi|vi_webp)/([A-Za-z0-9_-]{11})""")
        val videoId = videoIdRegex.find(trimmed)?.groupValues?.getOrNull(1)
        if (videoId != null) {
            candidates.add("https://i.ytimg.com/vi/$videoId/maxresdefault.jpg")
            candidates.add("https://i.ytimg.com/vi/$videoId/sddefault.jpg")
            candidates.add("https://i.ytimg.com/vi/$videoId/hq720.jpg")
            candidates.add("https://i.ytimg.com/vi/$videoId/hqdefault.jpg")
            candidates.add(trimmed)
            return candidates.distinct()
        }

        // 2. Google User Content / GGPHT covers (YouTube Music albums, singles, artist covers)
        if (trimmed.contains("googleusercontent.com") || trimmed.contains("ggpht.com")) {
            val base = if (trimmed.contains("=")) trimmed.substringBeforeLast("=") else trimmed
            candidates.add("$base=w1200-h1200-l90-rj")
            candidates.add("$base=w800-h800-l90-rj")
            candidates.add("$base=w544-h544-l90-rj")
            candidates.add("$base=s1200")
            candidates.add("$base=s800")
            candidates.add(trimmed)
            return candidates.distinct()
        }

        // 3. Fallback for other URLs
        candidates.add(trimmed)
        return candidates.distinct()
    }

    private fun loadArtworkAsync(url: String?) {
        if (url.isNullOrBlank()) {
            currentArtworkUrl = null
            currentArtworkBitmap = null
            loadingArtworkUrl = null
            failedArtworkUrl = null
            return
        }
        if (url == currentArtworkUrl && currentArtworkBitmap != null) {
            return
        }
        if (url == loadingArtworkUrl || url == failedArtworkUrl) {
            return
        }

        loadingArtworkUrl = url
        imageExecutor.execute {
            val candidates = artworkUrlCandidates(url)
            var loaded: Bitmap? = null
            for (candidate in candidates) {
                if (loadingArtworkUrl != url) return@execute // track changed mid-load
                try {
                    val connection = (java.net.URL(candidate).openConnection() as java.net.HttpURLConnection).apply {
                        connectTimeout = 4000
                        readTimeout = 5000
                        instanceFollowRedirects = true
                        setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 10)")
                    }
                    if (connection.responseCode in 200..299) {
                        connection.inputStream.use { stream ->
                            val bitmap = BitmapFactory.decodeStream(stream)
                            if (bitmap != null && bitmap.width > 20 && bitmap.height > 20) {
                                loaded = bitmap
                            }
                        }
                    }
                    connection.disconnect()
                    if (loaded != null) break
                } catch (_: Exception) {
                    // try next candidate
                }
            }
            if (loadingArtworkUrl == url) {
                loadingArtworkUrl = null
                if (loaded != null) {
                    currentArtworkUrl = url
                    currentArtworkBitmap = loaded
                    failedArtworkUrl = null
                    updateNotification()
                } else {
                    failedArtworkUrl = url
                }
            }
        }
    }

    private val wakeLockReleaseHandler = Handler(Looper.getMainLooper())
    private val wakeLockReleaseRunnable = Runnable {
        if (!isPlaying) {
            try {
                wakeLock?.let {
                    if (it.isHeld) {
                        it.release()
                    }
                }
            } catch (_: Exception) {}
        }
    }

    private fun acquireWakeLock() {
        wakeLockReleaseHandler.removeCallbacks(wakeLockReleaseRunnable)
        if (wakeLock == null) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "Neno:AudioPlaybackWakeLock"
            ).apply {
                setReferenceCounted(false)
            }
        }
        if (wakeLock?.isHeld == false) {
            wakeLock?.acquire(12 * 60 * 60 * 1000L) // 12 hours max
        }
    }

    private fun releaseWakeLock(immediate: Boolean = false) {
        if (immediate) {
            wakeLockReleaseHandler.removeCallbacks(wakeLockReleaseRunnable)
            try {
                wakeLock?.let {
                    if (it.isHeld) {
                        it.release()
                    }
                }
            } catch (_: Exception) {}
        } else {
            // 20-second grace period: prevents CPU from instantly sleeping during track
            // transition, buffering, or temporary pause.
            wakeLockReleaseHandler.removeCallbacks(wakeLockReleaseRunnable)
            wakeLockReleaseHandler.postDelayed(wakeLockReleaseRunnable, 20000L)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Neno Music Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Controls and status for music playback"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun updateMediaSessionPlaybackState() {
        try {
            val playbackActions = PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_SEEK_TO or
                PlaybackStateCompat.ACTION_STOP

            val sessionState = when (currentPlaybackState) {
                "loading" -> PlaybackStateCompat.STATE_BUFFERING
                "playing" -> PlaybackStateCompat.STATE_PLAYING
                else -> PlaybackStateCompat.STATE_PAUSED
            }

            val playbackSpeed = if (sessionState == PlaybackStateCompat.STATE_PLAYING) 1.0f else 0.0f

            val stateBuilder = PlaybackStateCompat.Builder()
                .setActions(playbackActions)
                .setState(
                    sessionState,
                    positionSec * 1000L,
                    playbackSpeed
                )
            mediaSession?.setPlaybackState(stateBuilder.build())
        } catch (_: Exception) {}
    }

    private fun getFallbackLargeIcon(): Bitmap? {
        cachedFallbackIcon?.let { return it }
        val icon: Bitmap? = try {
            val drawable = androidx.core.content.ContextCompat.getDrawable(this, R.mipmap.ic_launcher)
                ?: androidx.core.content.ContextCompat.getDrawable(this, android.R.drawable.ic_menu_info_details)
            if (drawable != null) {
                val width = if (drawable.intrinsicWidth > 0) Math.min(drawable.intrinsicWidth, 256) else 192
                val height = if (drawable.intrinsicHeight > 0) Math.min(drawable.intrinsicHeight, 256) else 192
                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                val canvas = android.graphics.Canvas(bitmap)
                drawable.setBounds(0, 0, canvas.width, canvas.height)
                drawable.draw(canvas)
                bitmap
            } else {
                null
            }
        } catch (_: Throwable) {
            null
        }
        cachedFallbackIcon = icon
        return icon
    }

    private fun updateNotification() {
        try {
            updateMediaSessionPlaybackState()
            try {
                val metaBuilder = MediaMetadataCompat.Builder()
                    .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                    .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                    .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Neno Music")
                    .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationSec * 1000L)

                currentArtworkBitmap?.let {
                    metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, it)
                    metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, it)
                    metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, it)
                }
                mediaSession?.setMetadata(metaBuilder.build())
            } catch (_: Throwable) {}

            val openAppIntent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val contentPendingIntent = PendingIntent.getActivity(
                this,
                0,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val prevIntent = Intent(this, MediaPlaybackService::class.java).apply { action = ACTION_PREV }
            val prevPendingIntent = PendingIntent.getService(this, 1, prevIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

            val isLoading = (currentPlaybackState == "loading")
            val isPlayingNow = isPlaying && !isLoading

            val playPauseAction = if (isPlayingNow || isLoading) ACTION_PAUSE else ACTION_PLAY
            val playPauseIntent = Intent(this, MediaPlaybackService::class.java).apply { action = playPauseAction }
            val playPausePendingIntent = PendingIntent.getService(this, 2, playPauseIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

            val nextIntent = Intent(this, MediaPlaybackService::class.java).apply { action = ACTION_NEXT }
            val nextPendingIntent = PendingIntent.getService(this, 3, nextIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

            val mediaStyle = androidx.media.app.NotificationCompat.MediaStyle()
                .setShowActionsInCompactView(0, 1, 2)
            mediaSession?.sessionToken?.let { token ->
                mediaStyle.setMediaSession(token)
            }

            val largeIcon = currentArtworkBitmap ?: getFallbackLargeIcon()

            val subTextString = when {
                isLoading -> "Neno Music • Loading..."
                !isPlayingNow -> "Neno Music • Paused"
                else -> "Neno Music"
            }

            val contentTextString = if (isLoading) {
                "$currentArtist • Searching stream..."
            } else {
                currentArtist
            }

            val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(currentTitle)
                .setContentText(contentTextString)
                .setSubText(subTextString)
                .setContentIntent(contentPendingIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(isPlayingNow || isLoading)
                .setColorized(true)
                .setColor(0xFFFF7700.toInt())
                .addAction(android.R.drawable.ic_media_previous, "Previous", prevPendingIntent)
                .addAction(
                    if (isPlayingNow || isLoading) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
                    if (isPlayingNow || isLoading) "Pause" else "Play",
                    playPausePendingIntent
                )
                .addAction(android.R.drawable.ic_media_next, "Next", nextPendingIntent)
                .setStyle(mediaStyle)

            if (largeIcon != null) {
                notificationBuilder.setLargeIcon(largeIcon)
            }

            val notification = notificationBuilder.build()

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                    )
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
            } catch (e: Throwable) {
                e.printStackTrace()
            }

            try {
                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                notificationManager?.notify(NOTIFICATION_ID, notification)
            } catch (_: Throwable) {}
        } catch (e: Throwable) {
            e.printStackTrace()
        }
    }

    override fun onDestroy() {
        resumeOnFocusGain = false
        serviceKeepaliveHandler.removeCallbacks(serviceKeepaliveRunnable)
        wakeLockReleaseHandler.removeCallbacks(wakeLockReleaseRunnable)
        abandonAudioFocus()
        unregisterNoisyReceiver()
        unregisterAudioRouteMonitoring()
        releaseWakeLock(immediate = true)
        try {
            mediaSession?.isActive = false
            mediaSession?.release()
            mediaSession = null
        } catch (_: Exception) {}
        imageExecutor.shutdown()
        super.onDestroy()
    }
}
