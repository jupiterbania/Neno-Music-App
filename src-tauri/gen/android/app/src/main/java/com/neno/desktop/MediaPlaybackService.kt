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
import android.os.IBinder
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

        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_ARTIST = "extra_artist"
        const val EXTRA_IS_PLAYING = "extra_is_playing"
        const val EXTRA_ARTWORK_URL = "extra_artwork_url"
        const val EXTRA_DURATION_SEC = "extra_duration_sec"
        const val EXTRA_POSITION_SEC = "extra_position_sec"

        fun startOrUpdate(
            context: Context,
            title: String,
            artist: String,
            isPlaying: Boolean,
            artworkUrl: String? = null,
            durationSec: Long = 0L,
            positionSec: Long = 0L
        ) {
            val intent = Intent(context, MediaPlaybackService::class.java).apply {
                action = ACTION_UPDATE
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_ARTIST, artist)
                putExtra(EXTRA_IS_PLAYING, isPlaying)
                putExtra(EXTRA_ARTWORK_URL, artworkUrl)
                putExtra(EXTRA_DURATION_SEC, durationSec)
                putExtra(EXTRA_POSITION_SEC, positionSec)
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
    private var resumeOnCallEnd: Boolean = false
    private var audioFocusRequest: AudioFocusRequest? = null

    private val audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS -> {
                resumeOnCallEnd = false
                dispatchPause()
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                if (isPlaying) {
                    resumeOnCallEnd = true
                    dispatchPause()
                }
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                // Audio ducking permitted by Android
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                if (resumeOnCallEnd) {
                    resumeOnCallEnd = false
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
    private var currentArtworkUrl: String? = null
    private var currentArtworkBitmap: Bitmap? = null
    private var durationSec: Long = 0L
    private var positionSec: Long = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        createNotificationChannel()
        acquireWakeLock()
        initMediaSession()
        setupTelephonyListener()
        updateNotification()
    }

    // ── Becoming Noisy (Headphones / Bluetooth unplugged) ───────────────
    private val noisyReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
                if (isPlaying) {
                    resumeOnCallEnd = false
                    dispatchPause()
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
                    resumeOnCallEnd = true
                    dispatchPause()
                }
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                // Call ended ("call cut hone ke baad")! Auto-resume playback.
                if (resumeOnCallEnd) {
                    resumeOnCallEnd = false
                    dispatchPlay()
                }
            }
        }
    }

    // ── Systematic Play / Pause Dispatching ────────────────────────────
    private fun dispatchPlay() {
        isPlaying = true
        requestAudioFocus()
        acquireWakeLock()
        registerNoisyReceiver()
        MainActivity.instance?.dispatchMediaControl("play")
        sendBroadcast(Intent("com.neno.desktop.MEDIA_CONTROL").putExtra("command", "play"))
        updateNotification()
    }

    private fun dispatchPause() {
        isPlaying = false
        abandonAudioFocus()
        releaseWakeLock()
        unregisterNoisyReceiver()
        MainActivity.instance?.dispatchMediaControl("pause")
        sendBroadcast(Intent("com.neno.desktop.MEDIA_CONTROL").putExtra("command", "pause"))
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
                        resumeOnCallEnd = false
                        dispatchPause()
                    }

                    override fun onSkipToNext() {
                        MainActivity.instance?.dispatchMediaControl("next")
                        sendBroadcast(Intent("com.neno.desktop.MEDIA_CONTROL").putExtra("command", "next"))
                    }

                    override fun onSkipToPrevious() {
                        MainActivity.instance?.dispatchMediaControl("prev")
                        sendBroadcast(Intent("com.neno.desktop.MEDIA_CONTROL").putExtra("command", "prev"))
                    }

                    override fun onSeekTo(pos: Long) {
                        val posSec = pos / 1000L
                        positionSec = posSec
                        MainActivity.instance?.dispatchMediaControl("seekTo:$posSec")
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
                resumeOnCallEnd = false
                abandonAudioFocus()
                unregisterNoisyReceiver()
                releaseWakeLock()
                stopForeground(true)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_PLAY -> {
                dispatchPlay()
            }
            ACTION_PAUSE -> {
                resumeOnCallEnd = false
                dispatchPause()
            }
            ACTION_NEXT -> {
                MainActivity.instance?.dispatchMediaControl("next")
                sendBroadcast(Intent("com.neno.desktop.MEDIA_CONTROL").putExtra("command", "next"))
            }
            ACTION_PREV -> {
                MainActivity.instance?.dispatchMediaControl("prev")
                sendBroadcast(Intent("com.neno.desktop.MEDIA_CONTROL").putExtra("command", "prev"))
            }
            ACTION_UPDATE -> {
                currentTitle = intent.getStringExtra(EXTRA_TITLE) ?: "Neno"
                currentArtist = intent.getStringExtra(EXTRA_ARTIST) ?: "Playing"
                val newIsPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true)
                durationSec = intent.getLongExtra(EXTRA_DURATION_SEC, 0L)
                positionSec = intent.getLongExtra(EXTRA_POSITION_SEC, 0L)
                val newArtworkUrl = intent.getStringExtra(EXTRA_ARTWORK_URL)

                if (newIsPlaying) {
                    isPlaying = true
                    requestAudioFocus()
                    acquireWakeLock()
                    registerNoisyReceiver()
                } else {
                    isPlaying = false
                    abandonAudioFocus()
                    releaseWakeLock()
                    unregisterNoisyReceiver()
                }

                loadArtworkAsync(newArtworkUrl)
                updateNotification()
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
            return
        }
        if (url == currentArtworkUrl && currentArtworkBitmap != null) {
            return
        }
        currentArtworkUrl = url
        imageExecutor.execute {
            val candidates = artworkUrlCandidates(url)
            var loaded: Bitmap? = null
            for (candidate in candidates) {
                if (currentArtworkUrl != url) return@execute // track changed mid-load
                try {
                    val connection = (java.net.URL(candidate).openConnection() as java.net.HttpURLConnection).apply {
                        connectTimeout = 6000
                        readTimeout = 8000
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
            if (loaded != null && currentArtworkUrl == url) {
                currentArtworkBitmap = loaded
                updateNotification()
            }
        }
    }

    private fun acquireWakeLock() {
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

    private fun releaseWakeLock() {
        try {
            wakeLock?.let {
                if (it.isHeld) {
                    it.release()
                }
            }
        } catch (_: Exception) {}
        // Do NOT null out wakeLock here — keeping the reference means acquireWakeLock() can
        // re-acquire the same lock object without a race where the reference is momentarily
        // absent and a concurrent acquire call skips the isHeld check on a null reference.
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

    private fun updateNotification() {
        try {
            val playbackActions = PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_SEEK_TO or
                PlaybackStateCompat.ACTION_STOP

            val stateBuilder = PlaybackStateCompat.Builder()
                .setActions(playbackActions)
                .setState(
                    if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
                    positionSec * 1000L,
                    if (isPlaying) 1.0f else 0.0f
                )
            mediaSession?.setPlaybackState(stateBuilder.build())

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
        } catch (_: Exception) {}

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

        val playPauseAction = if (isPlaying) ACTION_PAUSE else ACTION_PLAY
        val playPauseIntent = Intent(this, MediaPlaybackService::class.java).apply { action = playPauseAction }
        val playPausePendingIntent = PendingIntent.getService(this, 2, playPauseIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val nextIntent = Intent(this, MediaPlaybackService::class.java).apply { action = ACTION_NEXT }
        val nextPendingIntent = PendingIntent.getService(this, 3, nextIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val mediaStyle = androidx.media.app.NotificationCompat.MediaStyle()
            .setShowActionsInCompactView(0, 1, 2)
        mediaSession?.sessionToken?.let { token ->
            mediaStyle.setMediaSession(token)
        }

        val fallbackLargeIcon: Bitmap = try {
            BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher)
        } catch (_: Exception) { BitmapFactory.decodeResource(resources, android.R.drawable.ic_menu_info_details) }

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setLargeIcon(currentArtworkBitmap ?: fallbackLargeIcon)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSubText("Neno Music")
            .setContentIntent(contentPendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(isPlaying)
            .setColorized(true)
            .setColor(0xFFFF7700.toInt())
            .addAction(android.R.drawable.ic_media_previous, "Previous", prevPendingIntent)
            .addAction(
                if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
                if (isPlaying) "Pause" else "Play",
                playPausePendingIntent
            )
            .addAction(android.R.drawable.ic_media_next, "Next", nextPendingIntent)
            .setStyle(mediaStyle)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        try {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            notificationManager?.notify(NOTIFICATION_ID, notification)
        } catch (_: Exception) {}
    }

    override fun onDestroy() {
        abandonAudioFocus()
        unregisterNoisyReceiver()
        releaseWakeLock()
        try {
            mediaSession?.isActive = false
            mediaSession?.release()
            mediaSession = null
        } catch (_: Exception) {}
        imageExecutor.shutdown()
        super.onDestroy()
    }
}
