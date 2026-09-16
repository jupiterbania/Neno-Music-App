import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from "react";
import { Switch } from "@/components/motion/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { RangeSlider } from "@/components/motion/range-slider";
import {
  activeEqualizerPreset,
  EQUALIZER_BANDS_HZ,
  EQUALIZER_MAX_DB,
  EQUALIZER_PRESETS,
  isEqualizerFlat,
  setEqualizer,
  setEqualizerEnabled,
  useEqualizer,
  useEqualizerEnabled,
} from "../settings/equalizer";
import {
  MAX_CROSSFADE_SEC,
  setCrossfadeSec,
  setGaplessEnabled,
  useCrossfadeSec,
  useGaplessEnabled,
} from "../settings/playbackTransitions";
import {
  setSessionRestoreEnabled,
  useSessionRestoreEnabled,
} from "../settings/sessionRestore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import {
  BugIcon,
  DownloadIcon,
  FolderAddIcon,
  FolderIcon,
  FolderOpenIcon,
  KeyIcon,
  LastFmIcon,
  LogFileIcon,
  LogoutIcon,
  LyricsIcon,
  PaletteIcon,
  PlayIcon,
  QueuePanelIcon,
  RefreshIcon,
  SettingsIcon,
  TrashIcon,
  UserIcon,
} from "@/ui/icons";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  setThemePreference,
  useThemePreference,
  type ThemePreference,
} from "../settings/theme";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  checkForUpdates,
  getUpdateFailureMessage,
  getInstalledVersion,
  installUpdate,
  type UpdateInfo,
  type UpdateInstallProgress,
} from "../../internal/updateChecker";
import {
  clearCache,
  DEFAULT_CACHE_SIZE_GB,
  getCacheStats,
  setCacheMaxBytes,
  type CacheStats,
} from "../../internal/cache";
import type { LibraryController, LibraryState } from "../../player/LibraryController";
import {
  getAutostartEnabled,
  setAutostartEnabled,
} from "../settings/autostart";
import {
  setCompactPlayerBar,
  setExtraPlayerControlsAlwaysVisible,
  useCompactPlayerBar,
  useExtraPlayerControlsAlwaysVisible,
} from "../settings/playerControls";
import {
  RENDER_EFFECTS,
  setEffectDisabled,
  setPotatoPcMode,
  useEffectDisabled,
  usePotatoPcMode,
} from "../settings/renderEffects";
import { setMadeForYouVisible, setYtmHomeFeedVisible, useMadeForYouVisible, useYtmHomeFeedVisible } from "../settings/homeSections";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { ExternalLinkButton } from "../components/ExternalLinkButton";
import {
  AUTO_LYRICS_SOURCE,
  setPreferredLyricsSourceId,
  usePreferredLyricsSourceId,
} from "../../internal/lyricsSourcePreference";
import { LYRICS_SOURCES } from "../../datasource/youtube/lyricsSources";
import {
  LYRICS_FONT_SCALES,
  setLyricsFontScale,
  useLyricsFontScale,
} from "../settings/lyricsFontScale";
import {
  TRANSLATION_LANGUAGES,
  TRANSLATION_OFF,
  getLanguageLabel,
  setLyricsTranslationLang,
  useLyricsTranslationLang,
} from "../settings/lyricsTranslation";
import {
  setToolbarItemVisible,
  TOOLBAR_ITEMS,
  useToolbarItemVisible,
} from "../settings/toolbarItems";
import {
  setForceWindowControls,
  setNativeWindowControls,
  setWindowsStyleWindowControls,
  useForceWindowControls,
  useNativeWindowControls,
  useWindowsStyleWindowControls,
} from "../settings/windowControls";
import {
  resetMiniPlayerPosition,
  setMiniPlayerEnabled,
  setMiniPlayerHoverAction,
  useMiniPlayerEnabled,
  useMiniPlayerHoverAction,
  type MiniPlayerHoverAction,
} from "../settings/miniPlayer";
import {
  setMainWindowGeometryPersistenceEnabled,
  useMainWindowGeometryPersistenceEnabled,
} from "../settings/mainWindowGeometry";
import { setMinimizeToTray, useMinimizeToTray } from "../settings/tray";
import {
  setLinuxMediaSession,
  useLinuxMediaSession,
} from "../settings/mediaSession";
import {
  SIDEBAR_MODES,
  setSidebarMode,
  useSidebarMode,
  type SidebarMode,
} from "../settings/sidebarMode";
import {
  setAuthenticatedStreaming,
  setYouTubeScrobbling,
  useAuthenticatedStreaming,
  useYouTubeScrobbling,
} from "../settings/youtubeAccount";
import {
  AUDIO_ENGINE_MODES,
  setAudioEngineMode,
  useAudioEngineMode,
  type AudioEngineMode,
} from "../settings/audioEngine";
import {
  listOutputDevices,
  setOutputDevice,
  SYSTEM_DEFAULT_DEVICE,
  useOutputDevice,
  type OutputDevice,
} from "../settings/audioOutputDevice";
import {
  captureKeyboardShortcut,
  formatKeyboardShortcut,
  KEYBOARD_SHORTCUT_ACTIONS,
  resetKeyboardShortcut,
  resetKeyboardShortcuts,
  setKeyboardShortcut,
  useKeyboardShortcuts,
  type KeyboardShortcutAction,
} from "../settings/keyboardShortcuts";
import {
  addLocalPlaylistPath,
  createLocalPlaylist,
  deleteLocalPlaylist,
  getLocalPlaylists,
  removeLocalPlaylistPath,
  subscribeToLocalPlaylists,
} from "../../player/localPlaylists";
import { LastFmService, type LastFmAuthStart, type LastFmSessionStatus } from "../../player/LastFm";
import { DiscordRpcService } from "../../player/DiscordRPC";
import { useDiscordPresenceEnabled } from "../settings/discord";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  setLastFmScrobblingEnabled,
  useLastFmScrobblingEnabled,
} from "../settings/lastfm";
import { isAndroid, isLinux, isTilingWindowManager, subscribeTilingWindowManager } from "../platform";
import { AccountAvatar, AccountSwitcher, AddGoogleAccountButton, GoogleAccountSwitcher } from "../components/AccountSwitcher";
import {
  AUDIO_QUALITY_LABELS,
  setDownloadQuality,
  setStreamingQuality,
  useDownloadQuality,
  useStreamingQuality,
  type AudioQuality,
} from "../../internal/audioQuality";
import {
  getOfflineMaxBytes,
  removeAllDownloads,
  setOfflineMaxBytes,
  useOfflineState,
} from "../../player/offlineStore";




/*
 * Label + description pair used by every settings row.
 *
 * `flex flex-col` is the load-bearing part: both children are inline elements, so without a
 * block/flex wrapper the description runs straight on from the label ("Scrobble playsSend
 * now playing updates...") — the CSS Modules used to stack them and the Tailwind migration
 * dropped it.
 */
const SETTING_LABEL =
  "flex flex-col gap-0.5 text-sm text-muted-foreground [&>strong]:text-sm [&>strong]:font-medium [&>strong]:text-foreground";

/** Section card. One shape for every group so the page reads as a single system. */
const SETTINGS_CARD = "flex flex-col gap-4 sm:gap-5 rounded-2xl bg-card/60 border border-border/40 p-4 sm:p-6 shadow-sm";

/**
 * How long ago YouTube last answered as this account, in words.
 *
 * Deliberately visible rather than internal: with no telemetry, this one line is what turns
 * "liking songs stopped working" into a report somebody can act on.
 */
function formatSessionAge(confirmedAt: number | null): string {
  if (confirmedAt === null) return "not yet";
  const minutes = Math.floor((Date.now() - confirmedAt) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

/**
 * Text field. Preflight strips the browser's default input chrome, and these two fields were
 * left bare by the CSS Modules migration — they rendered as invisible text on the card.
 */
const SETTINGS_FIELD =
  "min-w-0 rounded-lg bg-background px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-ring/60";

/**
 * The ten-band equaliser.
 *
 * A component of its own rather than a run of `SettingRow`s because the bands are one control,
 * not eleven: they share a scale, a reset and a set of presets, and reading one slider only
 * means anything next to its neighbours.
 *
 * Sliders are horizontal, stacked. The usual picture of an equaliser is vertical, but that would
 * mean a second slider component built to be rotated, and the frequency and the gain read more
 * clearly written out than inferred from a bar's height.
 *
 * The switch is a bypass, not a reset — it never touches the stored curve, only whether Rust is
 * currently told to apply it. See `setEqualizerEnabled`.
 */
function EqualizerSettings({ engineMode }: { engineMode: AudioEngineMode }) {
  const equalizer = useEqualizer();
  const enabled = useEqualizerEnabled();
  // Only the Rust engine has the samples. A track that fell back to the YouTube player plays
  // unequalised no matter what these say, which the note below is there to admit.
  const available = engineMode === "rust";
  const flat = isEqualizerFlat(equalizer);
  const labelId = useId();

  const setBand = (index: number, gain: number) => {
    const bandsDb = equalizer.bandsDb.slice();
    bandsDb[index] = gain;
    setEqualizer({ ...equalizer, bandsDb });
  };

  const activePreset = activeEqualizerPreset(equalizer);

  return (
    <div className={cn("flex flex-col gap-3 pt-1 border-b border-border/20 pb-3", !available && "opacity-50")}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span id={labelId} className="text-sm font-medium text-foreground">
            Equaliser
          </span>
          <span className="text-xs text-muted-foreground">
            {available
              ? enabled
                ? flat
                  ? "Flat"
                  : `${equalizer.preampDb > 0 ? "+" : ""}${equalizer.preampDb} dB preamp`
                : "Off"
              : "Needs the Rust playback method"}
          </span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEqualizerEnabled}
          disabled={!available}
          aria-labelledby={labelId}
        />
      </div>

      {enabled && (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-wrap gap-2">
            {EQUALIZER_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                disabled={!available}
                onClick={() => setEqualizer(preset.settings)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  activePreset?.name === preset.name
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-card",
                )}
              >
                {preset.name}
              </button>
            ))}
          </div>

          <EqualizerBand
            label="Preamp"
            value={equalizer.preampDb}
            disabled={!available}
            onChange={(preampDb) => setEqualizer({ ...equalizer, preampDb })}
          />

          <div className="h-px bg-border" />

          {EQUALIZER_BANDS_HZ.map((hz, index) => (
            <EqualizerBand
              key={hz}
              label={hz >= 1000 ? `${hz / 1000}k` : String(hz)}
              value={equalizer.bandsDb[index]}
              disabled={!available}
              onChange={(gain) => setBand(index, gain)}
            />
          ))}

          <p className="px-1 text-xs text-muted-foreground">
            Applies immediately, to the track playing. A limiter sits after the bands, so a heavy
            boost is held back rather than clipped — lower the preamp to hear the difference instead.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Which sound card the Rust engine writes to.
 *
 * Only the Rust engine opens one itself — the IFrame and native paths play through the webview
 * and follow whatever the OS default routes to, same as any other browser tab.
 */
function OutputDeviceSetting({ engineMode }: { engineMode: AudioEngineMode }) {
  const selected = useOutputDevice();
  const [devices, setDevices] = useState<OutputDevice[]>([]);
  const available = engineMode === "rust";

  useEffect(() => {
    let cancelled = false;
    listOutputDevices()
      .then((found) => {
        if (!cancelled) setDevices(found);
      })
      // The row still works with an empty list — it just offers nothing but "System default".
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SettingRow
      title="Output device"
      description="Which sound card the Rust engine plays to."
      disabled={!available}
    >
      {(labelId) => (
        <Select
          className="w-36 sm:w-48 shrink-0"
          value={selected ?? SYSTEM_DEFAULT_DEVICE}
          onValueChange={(value) => {
            setOutputDevice(value === SYSTEM_DEFAULT_DEVICE ? null : value);
          }}
        >
          <SelectTrigger aria-labelledby={labelId} className="h-9 rounded-full border border-white/10 bg-card/70 px-3 text-xs sm:text-sm hover:bg-card">
            <SelectValue className="truncate whitespace-nowrap" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SYSTEM_DEFAULT_DEVICE}>System default</SelectItem>
            {devices.map((device) => (
              <SelectItem key={device.id} value={device.id}>
                {device.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </SettingRow>
  );
}

function EqualizerBand({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {label}
      </span>
      <RangeSlider
        className="min-w-0 flex-1"
        value={value}
        min={-EQUALIZER_MAX_DB}
        max={EQUALIZER_MAX_DB}
        step={1}
        showTicks={false}
        disabled={disabled}
        onValueChange={onChange}
        aria-label={`${label} gain in decibels`}
      />
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {value > 0 ? "+" : ""}
        {value} dB
      </span>
    </div>
  );
}

/**
 * One settings row: label and description on the left, control on the right.
 *
 * The wrapper is a `div`, not a `label`, because the controls are now buttons
 * (`role="switch"`, `role="listbox"`) rather than native inputs — a button inside a label
 * gets its activation swallowed by the label's own click forwarding. The association is made
 * explicitly instead, via `aria-labelledby` on the control, so screen readers still announce
 * the row title when the control takes focus.
 */
function SettingRow({
  title,
  description,
  disabled,
  children,
}: {
  title: string;
  description?: ReactNode;
  disabled?: boolean;
  /** Receives the id of the row title so the control can point `aria-labelledby` at it. */
  children: (labelId: string) => ReactNode;
}) {
  const labelId = useId();
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-6 py-2.5 border-b border-border/20 last:border-b-0",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id={labelId} className="text-sm font-medium text-foreground">
          {title}
        </span>
        {description ? (
          <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{description}</span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-2 pt-0.5 self-start sm:self-auto">{children(labelId)}</span>
    </div>
  );
}

/**
 * The Motion & performance card's contents.
 *
 * One switch for the blunt version, and a Manage disclosure for the eleven behind it. The
 * individual switches are a debugging instrument — you flip one, watch the GPU, flip it back —
 * and eleven of them sitting open in Settings read as eleven decisions the user has to make.
 */
function PotatoPcSettings() {
  const potatoPcMode = usePotatoPcMode();
  const [isManaging, setIsManaging] = useState(false);
  const panelId = useId();

  return (
    <>
      <SettingRow
        title="Potato PC"
        description="Turns off animations, blur, shadows and the ambient artwork, and switches to opaque surfaces. Manage picks them off one at a time."
      >
        {(labelId) => (
          <>
            <button
              type="button"
              onClick={() => setIsManaging((current) => !current)}
              aria-expanded={isManaging}
              aria-controls={panelId}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {isManaging ? "Done" : "Manage"}
            </button>
            <Switch
              checked={potatoPcMode}
              onCheckedChange={setPotatoPcMode}
              aria-labelledby={labelId}
            />
          </>
        )}
      </SettingRow>

      {isManaging && (
        <div id={panelId} className="flex flex-col">
          <p className="pb-1 pt-2 text-sm text-muted-foreground">
            One switch per effect. Turn them off one at a time to find which one your machine is
            paying for.
          </p>
          {RENDER_EFFECTS.map((effect) => (
            <RenderEffectToggle key={effect.id} effect={effect} />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Same reason as `ToolbarItemToggle`: one subscription per row.
 *
 * The switch reads as "effect on", the store as "effect disabled" — inverted here rather than
 * in the store, because the attribute the CSS matches on is a list of what is *off*, and an
 * empty list has to mean "nothing disabled" for a fresh install to look normal.
 */
function RenderEffectToggle({ effect }: { effect: (typeof RENDER_EFFECTS)[number] }) {
  const disabled = useEffectDisabled(effect.id);
  return (
    <SettingToggle
      title={effect.label}
      description={effect.description}
      checked={!disabled}
      onCheckedChange={(checked) => setEffectDisabled(effect.id, !checked)}
    />
  );
}

/** Its own component so each row can hold its own subscription rather than one per item here. */
function ToolbarItemToggle({ item }: { item: (typeof TOOLBAR_ITEMS)[number] }) {
  const visible = useToolbarItemVisible(item.id);
  return (
    <SettingToggle
      title={item.label}
      description={item.description}
      checked={visible}
      onCheckedChange={(checked) => setToolbarItemVisible(item.id, checked)}
    />
  );
}

/** The common case: a row whose only control is a switch. */
function SettingToggle({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  title: string;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const labelId = useId();
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 sm:gap-6 py-2.5 border-b border-border/20 last:border-b-0",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id={labelId} className="text-sm font-medium text-foreground">
          {title}
        </span>
        {description ? (
          <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{description}</span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center pl-2">
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-labelledby={labelId}
        />
      </span>
    </div>
  );
}

/**
 * Header for a settings card: icon, title and description on the left, status on the right.
 *
 * The four cards each rolled their own, and three of them put the status chip immediately
 * after the description inside a plain `flex gap-3` — so "Signed out" read as part of the
 * sentence rather than as the card's state. `justify-between` plus a `min-w-0 flex-1` text
 * column is what actually pins it to the right edge and truncates instead of overflowing.
 */
function SettingsCardHeader({
  title,
  titleId,
  description,
  icon,
  status,
}: {
  title: string;
  titleId: string;
  description: ReactNode;
  icon?: ReactNode;
  /** Right-aligned state, e.g. "Connected". */
  status?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      {icon ? (
        <span className="grid size-7 sm:size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 id={titleId} className="truncate text-sm sm:text-base font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {typeof description === "string" ? (
          <p className="text-xs text-muted-foreground leading-snug">{description}</p>
        ) : (
          <div className="text-xs text-muted-foreground leading-snug">{description}</div>
        )}
      </div>
      {status ? <span className="shrink-0">{status}</span> : null}
    </div>
  );
}

/** Quiet outbound links in the page header. */
type SettingsTab = "about" | "appearance" | "playback" | "system" | "shortcuts" | "window";

type WindowControlStyle = "macos" | "windows" | "native";

const SETTINGS_TABS: Array<{
  id: SettingsTab;
  label: string;
  description: string;
  icon: typeof UserIcon;
}> = [
  { id: "about", label: "Account", description: "Sign-in, integrations, updates", icon: UserIcon },
  { id: "appearance", label: "Appearance", description: "Theme and motion", icon: PaletteIcon },
  {
    id: "playback",
    label: "Playback",
    description: "Transitions and session",
    icon: PlayIcon,
  },
  { id: "system", label: "Library", description: "Cache and local files", icon: FolderIcon },
  { id: "window", label: "Window", description: "Chrome and mini player", icon: QueuePanelIcon },
  { id: "shortcuts", label: "Shortcuts", description: "Keyboard bindings", icon: KeyIcon },
];

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  hint: string;
  swatch: string;
}> = [
  { value: "light", label: "Light", hint: "Always light", swatch: "bg-white" },
  { value: "dark", label: "Dark", hint: "Always dark", swatch: "bg-neutral-900" },
  {
    value: "system",
    label: "System",
    hint: "Match the OS",
    swatch: "bg-linear-to-br from-white to-neutral-900",
  },
];

interface SettingsPageProps {
  libraryController: LibraryController;
  libraryState: LibraryState;
  onRestartOnboarding: () => void;
  onSignIn: () => Promise<void>;
  onDeleteAllAppData: () => Promise<void>;
}

export function SettingsPage({
  libraryController,
  libraryState,
  onRestartOnboarding,
  onSignIn,
  onDeleteAllAppData,
}: SettingsPageProps) {
  const isMobile = useIsMobile();
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheSizeGb, setCacheSizeGb] = useState(DEFAULT_CACHE_SIZE_GB.toString());
  const [cacheBusy, setCacheBusy] = useState(false);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [updateResult, setUpdateResult] = useState<UpdateInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<
    "idle" | "checking" | "installing" | "current" | "error"
  >("idle");
  const [updateProgress, setUpdateProgress] = useState<UpdateInstallProgress | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [autostartEnabled, setAutostartEnabledState] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(true);
  const [autostartError, setAutostartError] = useState<string | null>(null);
  const [logOpening, setLogOpening] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [miniPlayerResetting, setMiniPlayerResetting] = useState(false);
  const [resetSettingsConfirming, setResetSettingsConfirming] = useState(false);
  const [resetSettingsBusy, setResetSettingsBusy] = useState(false);
  const [resetSettingsError, setResetSettingsError] = useState<string | null>(null);
  const [localPlaylistName, setLocalPlaylistName] = useState("");
  const [localPlaylistPathInputs, setLocalPlaylistPathInputs] = useState<Record<string, string>>({});
  const [localPlaylistError, setLocalPlaylistError] = useState<string | null>(null);
  const [localPlaylistBrowsingId, setLocalPlaylistBrowsingId] = useState<string | null>(null);
  const [lastFmSession, setLastFmSession] = useState<LastFmSessionStatus | null>(null);
  const [lastFmAuth, setLastFmAuth] = useState<LastFmAuthStart | null>(null);
  const [lastFmBusy, setLastFmBusy] = useState(false);
  const [lastFmError, setLastFmError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("about");
  const themePreference = useThemePreference();
  const [listeningShortcut, setListeningShortcut] = useState<KeyboardShortcutAction | null>(null);
  const keyboardShortcuts = useKeyboardShortcuts();
  const miniPlayerEnabled = useMiniPlayerEnabled();
  const miniPlayerHoverAction = useMiniPlayerHoverAction();
  const sidebarMode = useSidebarMode();
  const audioEngineMode = useAudioEngineMode();
  const authenticatedStreaming = useAuthenticatedStreaming();
  const youtubeScrobbling = useYouTubeScrobbling();
  const preferredLyricsSource = usePreferredLyricsSourceId();
  const lyricsFontScale = useLyricsFontScale();
  const lyricsTranslationLang = useLyricsTranslationLang();
  const madeForYouVisible = useMadeForYouVisible();
  const ytmHomeFeedVisible = useYtmHomeFeedVisible();
  const crossfadeSec = useCrossfadeSec();
  const gaplessEnabled = useGaplessEnabled();
  const sessionRestoreEnabled = useSessionRestoreEnabled();
  const extraPlayerControlsAlwaysVisible = useExtraPlayerControlsAlwaysVisible();
  const compactPlayerBar = useCompactPlayerBar();
  const windowsStyleWindowControls = useWindowsStyleWindowControls();
  const nativeWindowControls = useNativeWindowControls();
  const forceWindowControls = useForceWindowControls();
  const tilingWindowManager = useSyncExternalStore(
    subscribeTilingWindowManager,
    isTilingWindowManager,
    () => false,
  );
  // "Native" and "Windows-style" used to be two separate switches, one of which only meant
  // anything when the other was off. Collapsing them into one three-way pick removes the
  // combination that did nothing (native + windows-style both on).
  const windowControlStyle: WindowControlStyle = nativeWindowControls
    ? "native"
    : windowsStyleWindowControls ? "windows" : "macos";
  const handleWindowControlStyleChange = (style: WindowControlStyle) => {
    const goingNative = style === "native";
    if (goingNative !== nativeWindowControls) {
      setNativeWindowControls(goingNative);
      // GTK decorations don't reliably flip live on Linux, so this style needs a fresh window.
      if (isLinux) void relaunch().catch(() => window.location.reload());
    }
    if (!goingNative) setWindowsStyleWindowControls(style === "windows");
  };
  const mainWindowGeometryPersistenceEnabled = useMainWindowGeometryPersistenceEnabled();
  const minimizeToTray = useMinimizeToTray();
  const linuxMediaSession = useLinuxMediaSession();
  const offlineState = useOfflineState();
  const streamingQuality = useStreamingQuality();
  const downloadQuality = useDownloadQuality();
  const [offlineMaxGb, setOfflineMaxGb] = useState(
    () => getOfflineMaxBytes() / 1024 ** 3,
  );
  const [clearingDownloads, setClearingDownloads] = useState(false);
  const lastFmScrobblingEnabled = useLastFmScrobblingEnabled();
  const discordPresenceEnabled = useDiscordPresenceEnabled();
  const localPlaylists = useSyncExternalStore(
    subscribeToLocalPlaylists,
    getLocalPlaylists,
    getLocalPlaylists,
  );
  const account = libraryState.library?.account;
  const isSignedIn = (libraryState.status === "ready" || libraryState.status === "loading")
    && Boolean(account);
  const isConnecting = !isSignedIn
    && (libraryState.status === "restoring"
      || libraryState.status === "loading"
      || libraryState.status === "authorizing");
  const authBusy = libraryState.status === "restoring"
    || libraryState.status === "authorizing"
    || libraryState.status === "loading";

  useEffect(() => {
    let active = true;
    void getCacheStats()
      .then((stats) => {
        if (!active) return;
        setCacheStats(stats);
        setCacheSizeGb((stats.maxBytes / 1024 ** 3).toString());
      })
      .catch(() => {
        if (active) setCacheError("Unable to load cache settings.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void getInstalledVersion()
      .then((version) => {
        if (active) setInstalledVersion(version);
      })
      .catch(() => {
        if (active) setInstalledVersion("Unknown");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void LastFmService.getSession()
      .then((session) => {
        if (active) setLastFmSession(session);
      })
      .catch((error) => {
        if (active) {
          setLastFmError(error instanceof Error ? error.message : "Unable to load Last.fm connection.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!resetSettingsConfirming) return undefined;
    const timeout = window.setTimeout(() => setResetSettingsConfirming(false), 4000);
    return () => window.clearTimeout(timeout);
  }, [resetSettingsConfirming]);

  const handleCheckForUpdates = async () => {
    setUpdateStatus("checking");
    setUpdateResult(null);
    setUpdateError(null);
    setUpdateProgress(null);
    try {
      const update = await checkForUpdates();
      setUpdateResult(update);
      setUpdateStatus(update ? "idle" : "current");
    } catch (error) {
      setUpdateError(getUpdateFailureMessage(error));
      setUpdateStatus("error");
    }
  };

  const handleInstallUpdate = async () => {
    if (!updateResult) return;
    setUpdateStatus("installing");
    setUpdateError(null);
    try {
      await installUpdate(updateResult, setUpdateProgress);
    } catch {
      setUpdateError("Unable to install the update. Please check your connection and try again.");
      setUpdateStatus("error");
    }
  };

  useEffect(() => {
    let active = true;
    void getAutostartEnabled()
      .then((enabled) => {
        if (active) setAutostartEnabledState(enabled);
      })
      .catch(() => {
        if (active) setAutostartError("Unable to load the startup setting.");
      })
      .finally(() => {
        if (active) setAutostartLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleAutostartChange = async (enabled: boolean) => {
    setAutostartLoading(true);
    setAutostartError(null);
    try {
      await setAutostartEnabled(enabled);
      setAutostartEnabledState(enabled);
    } catch {
      setAutostartError("Unable to update the startup setting.");
    } finally {
      setAutostartLoading(false);
    }
  };

  const handleOpenLog = async () => {
    setLogOpening(true);
    setLogError(null);
    try {
      await invoke("open_current_log");
    } catch {
      setLogError("Unable to open the log file.");
    } finally {
      setLogOpening(false);
    }
  };

  const handleResetMiniPlayerPosition = async () => {
    setMiniPlayerResetting(true);
    try {
      await resetMiniPlayerPosition();
    } finally {
      setMiniPlayerResetting(false);
    }
  };

  const saveCacheSize = async () => {
    const sizeGb = Number(cacheSizeGb);
    if (!Number.isFinite(sizeGb) || sizeGb < 0.25 || sizeGb > 64) {
      setCacheError("Cache size must be between 0.25 GB and 64 GB.");
      return;
    }

    setCacheBusy(true);
    setCacheError(null);
    try {
      setCacheStats(await setCacheMaxBytes(Math.round(sizeGb * 1024 ** 3)));
    } catch {
      setCacheError("Unable to save the cache size.");
    } finally {
      setCacheBusy(false);
    }
  };

  const handleClearCache = async () => {
    setCacheBusy(true);
    setCacheError(null);
    try {
      setCacheStats(await clearCache());
    } catch {
      setCacheError("Unable to clear cached content.");
    } finally {
      setCacheBusy(false);
    }
  };

  const handleClearAllSettings = async () => {
    setResetSettingsError(null);
    if (!resetSettingsConfirming) {
      setResetSettingsConfirming(true);
      return;
    }

    setResetSettingsBusy(true);
    try {
      await onDeleteAllAppData();
      await relaunch().catch(() => {
        window.location.reload();
      });
    } catch {
      setResetSettingsError("Unable to delete all app data.");
      setResetSettingsBusy(false);
      setResetSettingsConfirming(false);
    }
  };

  const handleCreateLocalPlaylist = () => {
    setLocalPlaylistError(null);
    try {
      createLocalPlaylist(localPlaylistName);
      setLocalPlaylistName("");
    } catch (error) {
      setLocalPlaylistError(error instanceof Error ? error.message : "Unable to create local playlist.");
    }
  };

  const handleStartLastFmAuth = async () => {
    setLastFmBusy(true);
    setLastFmError(null);
    try {
      const auth = await LastFmService.startAuth();
      setLastFmAuth(auth);
    } catch (error) {
      setLastFmError(error instanceof Error ? error.message : "Unable to start Last.fm sign-in.");
    } finally {
      setLastFmBusy(false);
    }
  };

  const handleFinishLastFmAuth = async () => {
    if (!lastFmAuth) return;
    setLastFmBusy(true);
    setLastFmError(null);
    try {
      const session = await LastFmService.completeAuth(lastFmAuth.token);
      setLastFmSession(session);
      setLastFmAuth(null);
      setLastFmScrobblingEnabled(true);
    } catch (error) {
      setLastFmError(error instanceof Error ? error.message : "Unable to finish Last.fm sign-in.");
    } finally {
      setLastFmBusy(false);
    }
  };

  const handleDisconnectLastFm = async () => {
    setLastFmBusy(true);
    setLastFmError(null);
    try {
      await LastFmService.disconnect();
      setLastFmSession(null);
      setLastFmAuth(null);
    } catch (error) {
      setLastFmError(error instanceof Error ? error.message : "Unable to disconnect Last.fm.");
    } finally {
      setLastFmBusy(false);
    }
  };

  const handleAddLocalPlaylistPath = (playlistId: string) => {
    setLocalPlaylistError(null);
    const path = localPlaylistPathInputs[playlistId]?.trim() ?? "";
    if (!path) {
      setLocalPlaylistError("Enter a folder path before adding it.");
      return;
    }
    addLocalPlaylistPath(playlistId, path);
    setLocalPlaylistPathInputs((current) => ({ ...current, [playlistId]: "" }));
  };

  const handleBrowseLocalPlaylistPath = async (playlistId: string) => {
    setLocalPlaylistError(null);
    setLocalPlaylistBrowsingId(playlistId);
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Choose music folder",
      });
      if (typeof selected !== "string") return;
      addLocalPlaylistPath(playlistId, selected);
      setLocalPlaylistPathInputs((current) => ({
        ...current,
        [playlistId]: "",
      }));
    } catch {
      setLocalPlaylistError("Unable to open the folder picker.");
    } finally {
      setLocalPlaylistBrowsingId(null);
    }
  };

  const handleShortcutCapture = (
    event: KeyboardEvent<HTMLButtonElement>,
    action: KeyboardShortcutAction,
  ) => {
    if (listeningShortcut !== action) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.code === "Escape") {
      setListeningShortcut(null);
      return;
    }

    const shortcut = captureKeyboardShortcut(event.nativeEvent);
    if (!shortcut) return;

    setKeyboardShortcut(action, shortcut);
    setListeningShortcut(null);
  };

  useEffect(() => {
    if (!listeningShortcut) return undefined;

    const handleShortcutKeyDown = (event: globalThis.KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (event.code === "Escape") {
        setListeningShortcut(null);
        return;
      }

      const shortcut = captureKeyboardShortcut(event);
      if (!shortcut) return;

      setKeyboardShortcut(listeningShortcut, shortcut);
      setListeningShortcut(null);
    };

    window.addEventListener("keydown", handleShortcutKeyDown, true);
    return () => window.removeEventListener("keydown", handleShortcutKeyDown, true);
  }, [listeningShortcut]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 sm:gap-7">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage your account, library, appearance, and playback.
          </p>
        </div>

      </header>

      {/* Mobile horizontal pill navigation */}
      <div className="flex w-full items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-0.5 md:hidden">
        {SETTINGS_TABS.filter((tab) => !isMobile || (tab.id !== "window" && tab.id !== "shortcuts")).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all select-none",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 scale-[1.02]"
                  : "bg-card/70 text-muted-foreground border border-border/40 hover:bg-card hover:text-foreground",
              )}
            >
              <Icon size={14} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row items-start gap-4 md:gap-10 w-full">
        <nav
          className="hidden md:flex sticky top-0 w-56 shrink-0 flex-col gap-0.5"
          role="tablist"
          aria-label="Settings categories"
        >
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "group/tab relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  isActive ? "text-foreground" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="settings-tab-active"
                    transition={{ type: "spring", stiffness: 520, damping: 42 }}
                    className="absolute inset-0 -z-10 rounded-xl bg-card"
                  />
                )}
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
                    isActive ? "bg-primary/15 text-primary" : "bg-card/70 text-muted-foreground",
                  )}
                >
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{tab.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {tab.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex min-h-0 w-full min-w-0 max-w-full md:max-w-2xl flex-1 flex-col pb-36 md:pb-8">

      {activeTab === "about" && (
        <div className="flex flex-col gap-5" role="tabpanel" aria-label="About settings">
          <section className={SETTINGS_CARD} aria-labelledby="account-settings-title">
            <SettingsCardHeader
              title="YouTube Music Account"
              titleId="account-settings-title"
              icon={<UserIcon size={18} aria-hidden="true" />}
              description={
                isSignedIn
                  ? `Connected as ${account?.name || "YouTube Music"}`
                  : isConnecting
                    ? "Connecting to YouTube Music..."
                    : "Connect your account to load your library"
              }
              status={
                isSignedIn ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20 shrink-0">
                    <span className="size-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                    Connected
                  </span>
                ) : isConnecting ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20 shrink-0">
                    <span className="size-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                    Connecting
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-card/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-border/40 shrink-0">
                    Signed out
                  </span>
                )
              }
            />

            {isSignedIn ? (
              <div className="flex flex-col gap-3 rounded-2xl bg-card/40 border border-border/40 p-3.5 sm:p-4">
                {/* Active profile showcase */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/20">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <AccountAvatar artworkUrl={account?.artworkUrl} className="size-11 rounded-full border border-white/10 shadow-xs" iconSize={24} />
                      <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 border-2 border-background" />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                      <span className="truncate text-base font-bold text-foreground leading-tight">
                        {account?.name || "YouTube Music"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span className="inline-block size-1.5 rounded-full bg-emerald-400 shrink-0" />
                        Active session · {formatSessionAge(libraryState.sessionConfirmedAt)}
                      </span>
                    </div>
                  </div>

                  <button
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition-all hover:bg-destructive/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                    type="button"
                    disabled={authBusy}
                    onClick={() => void libraryController.signOut()}
                  >
                    <LogoutIcon size={14} />
                    <span>Sign out</span>
                  </button>
                </div>

                {/* Account Switcher and Channel Switcher */}
                <div className="flex flex-col gap-2.5 pt-1">
                  <GoogleAccountSwitcher
                    libraryController={libraryController}
                    showSingle={false}
                    allowRemove
                    label="Accounts"
                  />
                  <AddGoogleAccountButton disabled={authBusy} onClick={() => void onSignIn()} />

                  <AccountSwitcher libraryController={libraryController} showSingle={false} label="Channel" className="border-t border-border/20 pt-2.5 mt-1" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 rounded-xl bg-card/40 border border-border/40 p-4 sm:p-5">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-foreground">
                    Connect your YouTube Music library
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sign in with your Google account to sync your playlists, liked tracks, custom albums, and personalized recommendations across devices.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1">
                  <div className="flex items-center gap-2 rounded-lg bg-background/50 border border-border/30 px-3 py-2 text-xs text-foreground/85">
                    <span className="text-primary font-bold">✓</span>
                    <span>Liked Songs</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-background/50 border border-border/30 px-3 py-2 text-xs text-foreground/85">
                    <span className="text-primary font-bold">✓</span>
                    <span>Your Playlists</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-background/50 border border-border/30 px-3 py-2 text-xs text-foreground/85">
                    <span className="text-primary font-bold">✓</span>
                    <span>Personal Mixes</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-muted-foreground order-2 sm:order-1">
                    Secure login · Credentials stay safely on this device
                  </span>
                  <div className="order-1 sm:order-2 flex justify-center sm:justify-end">
                    <GoogleSignInButton
                      isBusy={authBusy}
                      onClick={() => void onSignIn()}
                    />
                  </div>
                </div>
              </div>
            )}

            {libraryState.error && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">
                <span>{libraryState.error}</span>
                <button
                  type="button"
                  onClick={() => void libraryController.recoverConnection()}
                  className="shrink-0 font-medium underline hover:opacity-80 focus-visible:outline-none"
                >
                  Retry
                </button>
              </div>
            )}
          </section>

          <section className={SETTINGS_CARD} aria-labelledby="lastfm-settings-title">
            <SettingsCardHeader
              title="Last.fm"
              titleId="lastfm-settings-title"
              icon={<LastFmIcon size={18} aria-hidden="true" />}
              description={
                lastFmSession
                  ? `Connected as ${lastFmSession.username}`
                  : "Connect Last.fm to scrobble your listening history."
              }
              status={
                <span className={lastFmSession ? "text-primary" : "text-muted-foreground"}>
                  {lastFmSession ? "Connected" : "Signed out"}
                </span>
              }
            />

            <div className="flex flex-col gap-5">
              <SettingToggle
                title="Scrobble plays"
                description="Send now playing updates and scrobbles after a track reaches the Last.fm listening threshold."
                checked={lastFmSession ? lastFmScrobblingEnabled : false}
                disabled={!lastFmSession}
                onCheckedChange={setLastFmScrobblingEnabled}
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className={cn(SETTING_LABEL, "min-w-0 flex-1")}>
                  <strong>Account connection</strong>
                  <span>
                    {lastFmAuth
                      ? "Approve the connection in your browser, then finish it here."
                      : lastFmSession
                        ? "Disconnecting stops future Last.fm updates from this app."
                        : "A browser window will open so you can approve this app on Last.fm."}
                  </span>
                </span>
                {lastFmSession ? (
                  <button
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    type="button"
                    disabled={lastFmBusy}
                    onClick={() => void handleDisconnectLastFm()}
                  >
                    <LastFmIcon size={18} />
                    {lastFmBusy ? "Disconnecting..." : "Disconnect"}
                  </button>
                ) : lastFmAuth ? (
                  <button
                    className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    type="button"
                    disabled={lastFmBusy}
                    onClick={() => void handleFinishLastFmAuth()}
                  >
                    <LastFmIcon size={18} />
                    {lastFmBusy ? "Finishing..." : "Finish connection"}
                  </button>
                ) : (
                  <button
                    className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    type="button"
                    disabled={lastFmBusy}
                    onClick={() => void handleStartLastFmAuth()}
                  >
                    <LastFmIcon size={18} />
                    {lastFmBusy ? "Opening..." : "Connect Last.fm"}
                  </button>
                )}
              </div>

              {lastFmError && <p className="text-sm text-destructive">{lastFmError}</p>}
            </div>
          </section>

          {!isMobile && (
            <section className={SETTINGS_CARD} aria-labelledby="discord-settings-title">
              <h2 className="text-lg font-semibold text-foreground" id="discord-settings-title">
                Discord
              </h2>

              <div className="flex flex-col gap-5">
                <SettingToggle
                  title="Show what you're playing"
                  description="Publishes the current track, artist and artwork to your Discord profile. Turning this off clears whatever is showing there now."
                  checked={discordPresenceEnabled}
                  onCheckedChange={(enabled) => void DiscordRpcService.setEnabled(enabled)}
                />
              </div>
            </section>
          )}

          <section className={SETTINGS_CARD} aria-labelledby="about-settings-title">
            <SettingsCardHeader
              title="About Zuno"
              titleId="about-settings-title"
              icon={<SettingsIcon size={18} aria-hidden="true" />}
              description="App details, updates, and community links."
            />

            <div className="flex flex-col gap-4">
              {/* App details card */}
              <div className="flex items-center justify-between gap-3 rounded-xl bg-card/40 border border-border/40 p-3.5 sm:p-4">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">Zuno Music</span>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {isAndroid ? "Android" : isMobile ? "Mobile" : "Desktop"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Installed version: {
                      installedVersion
                        ? installedVersion === "Unknown" ? installedVersion : `v${installedVersion}`
                        : "v1.4.0"
                    }
                  </span>
                </div>

                <button
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold text-foreground bg-card hover:bg-card/80 border border-border/40 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  type="button"
                  disabled={updateStatus === "checking"}
                  onClick={() => void handleCheckForUpdates()}
                >
                  <RefreshIcon size={16} className={updateStatus === "checking" ? "animate-spin" : undefined} />
                  <span>{updateStatus === "checking" ? "Checking..." : "Check for updates"}</span>
                </button>
              </div>

              {updateResult && (
                <div className="flex flex-col gap-2 rounded-xl bg-primary/10 border border-primary/25 p-3.5 text-xs text-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-primary">
                      Version {updateResult.version} is available!
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {updateStatus === "installing"
                      ? updateProgress?.percent !== undefined
                        ? `Downloading version ${updateResult.version}: ${updateProgress.percent}%`
                        : `Preparing version ${updateResult.version}...`
                      : isAndroid
                        ? "A new APK release is available. Tap below to download the latest update."
                        : "A new version of Zuno is available to install."}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {updateResult.canInstall && (
                      <button
                        className="flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none"
                        type="button"
                        disabled={updateStatus === "installing"}
                        onClick={() => void handleInstallUpdate()}
                      >
                        {updateStatus === "installing" ? "Installing..." : "Install now"}
                      </button>
                    )}
                    <ExternalLinkButton
                      label={isAndroid ? "Download APK" : updateResult.canInstall ? "View release" : "Download"}
                      url={updateResult.releaseUrl}
                      className="px-3.5 py-1.5 text-xs"
                    />
                  </div>
                </div>
              )}
              {updateStatus === "current" && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs text-emerald-400">
                  <span className="font-bold">✓</span>
                  <span>You are up to date with the latest release.</span>
                </div>
              )}
              {updateStatus === "error" && (
                <p className="text-xs text-destructive">{updateError}</p>
              )}

              {/* Quick start onboarding */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card/40 border border-border/40 p-3.5 sm:p-4">
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-sm font-semibold text-foreground">Quick start tour</span>
                  <span className="text-xs text-muted-foreground">Replay the guided feature introduction.</span>
                </div>
                <button
                  className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-foreground bg-card hover:bg-card/80 border border-border/40 transition-colors disabled:opacity-50 focus-visible:outline-none"
                  type="button"
                  onClick={onRestartOnboarding}
                >
                  <RefreshIcon size={15} />
                  <span>Start onboarding</span>
                </button>
              </div>

            </div>
          </section>
        </div>
      )}

      {activeTab === "system" && (
        <div className="flex flex-col gap-5" role="tabpanel" aria-label="Library settings">
          {!isMobile && (
            <section className={SETTINGS_CARD} aria-labelledby="library-local-title">
              <SettingsCardHeader
                title="Local music"
                titleId="library-local-title"
                icon={<FolderIcon size={18} aria-hidden="true" />}
                description="Folders on this computer, scanned into playlists."
              />

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <span className={cn(SETTING_LABEL, "min-w-0 flex-1")}>
                    <strong>Local playlists</strong>
                    <span>Create playlists from folders on this computer.</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className={cn(SETTINGS_FIELD, "w-44")}
                      type="text"
                      value={localPlaylistName}
                      placeholder="Playlist name"
                      aria-label="Local playlist name"
                      onChange={(event) => setLocalPlaylistName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleCreateLocalPlaylist();
                      }}
                    />
                    <button
                      className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      type="button"
                      onClick={handleCreateLocalPlaylist}
                    >
                      <FolderAddIcon size={18} />
                      Create
                    </button>
                  </div>
                </div>

                {localPlaylistError && <p className="text-sm text-destructive">{localPlaylistError}</p>}

                {localPlaylists.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {localPlaylists.map((playlist) => (
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-background/40 px-3 py-2 text-sm" key={playlist.id}>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-foreground">
                            <FolderIcon size={18} aria-hidden="true" />
                            {playlist.name}
                          </span>
                          <button
                            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            type="button"
                            onClick={() => deleteLocalPlaylist(playlist.id)}
                          >
                            <TrashIcon size={18} />
                            Delete
                          </button>
                        </div>

                        <div className="flex flex-col gap-2">
                          <span className="flex items-center gap-2">
                            <input
                              className={cn(SETTINGS_FIELD, "flex-1")}
                              type="text"
                              value={localPlaylistPathInputs[playlist.id] ?? ""}
                              placeholder="/Users/name/Music"
                              aria-label={`Folder path for ${playlist.name}`}
                              onChange={(event) => setLocalPlaylistPathInputs((current) => ({
                                ...current,
                                [playlist.id]: event.target.value,
                              }))}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") handleAddLocalPlaylistPath(playlist.id);
                              }}
                            />
                            <button
                              type="button"
                              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                              disabled={localPlaylistBrowsingId === playlist.id}
                              title="Browse for folder"
                              aria-label={`Browse for a folder for ${playlist.name}`}
                              onClick={() => void handleBrowseLocalPlaylistPath(playlist.id)}
                            >
                              <FolderOpenIcon size={17} aria-hidden="true" />
                            </button>
                          </span>
                          <button
                            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            type="button"
                            onClick={() => handleAddLocalPlaylistPath(playlist.id)}
                          >
                            Add
                          </button>
                        </div>

                        {playlist.paths.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {playlist.paths.map((path) => (
                              <div className="flex items-center justify-between gap-3 rounded-lg bg-background/40 px-3 py-2 text-sm" key={path}>
                                <span>{path}</span>
                                <button
                                  type="button"
                                  aria-label={`Remove ${path}`}
                                  onClick={() => removeLocalPlaylistPath(playlist.id, path)}
                                >
                                  <TrashIcon size={16} aria-hidden="true" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="px-1 py-3 text-sm text-muted-foreground">No paths added yet.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </section>
          )}

          <section className={SETTINGS_CARD} aria-labelledby="library-storage-title">
            <SettingsCardHeader
              title="Storage"
              titleId="library-storage-title"
              icon={<DownloadIcon size={16} aria-hidden="true" />}
              description="Disk space allocated for cached audio, artwork, and offline downloads."
            />

            {/* Sub-card 1: App Cache */}
            <div className="flex flex-col gap-3 rounded-xl bg-background/50 border border-border/30 p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-semibold text-foreground">App Cache</span>
                  <span className="text-xs text-muted-foreground">
                    Temporary streaming chunks and album covers.
                  </span>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary tabular-nums shrink-0">
                  {cacheStats ? `${formatBytes(cacheStats.usedBytes)} used` : "Loading…"}
                </span>
              </div>

              {/* Progress bar */}
              {cacheStats && (
                <div className="flex flex-col gap-1.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(2, (cacheStats.usedBytes / cacheStats.maxBytes) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                    <span>{formatBytes(cacheStats.usedBytes)} of {formatBytes(cacheStats.maxBytes)} limit</span>
                    <span>{cacheStats.entryCount} items</span>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Limit</span>
                  <span className="flex items-center gap-1 rounded-lg bg-card border border-border/40 px-2.5 py-1 text-xs text-foreground focus-within:border-primary/60">
                    <input
                      className="w-10 min-w-0 bg-transparent tabular-nums outline-none text-right font-medium"
                      type="number"
                      min="0.25"
                      max="64"
                      step="0.25"
                      value={cacheSizeGb}
                      disabled={cacheBusy}
                      onChange={(event) => setCacheSizeGb(event.target.value)}
                      aria-label="Cache limit in GB"
                    />
                    <span className="text-muted-foreground text-[11px]">GB</span>
                  </span>
                  <button
                    className="flex items-center justify-center rounded-lg bg-card border border-border/40 px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    type="button"
                    disabled={cacheBusy}
                    onClick={() => void saveCacheSize()}
                  >
                    Save
                  </button>
                </div>

                <button
                  className="flex items-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50 self-start sm:self-auto"
                  type="button"
                  disabled={cacheBusy}
                  onClick={() => void handleClearCache()}
                >
                  <TrashIcon size={13} />
                  <span>Clear cache</span>
                </button>
              </div>

              {cacheError && <p className="text-xs text-destructive">{cacheError}</p>}
            </div>

            {/* Sub-card 2: Offline Downloads */}
            <div className="flex flex-col gap-3 rounded-xl bg-background/50 border border-border/30 p-3.5 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-semibold text-foreground">Offline Downloads</span>
                  <span className="text-xs text-muted-foreground">
                    Songs saved locally on this device for offline playback.
                  </span>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary tabular-nums shrink-0">
                  {Object.keys(offlineState.entries).length} {Object.keys(offlineState.entries).length === 1 ? "song" : "songs"}
                </span>
              </div>

              {/* Progress bar */}
              <div className="flex flex-col gap-1.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(2, (offlineState.usedBytes / (Math.max(1, offlineMaxGb) * 1024 ** 3)) * 100))}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>
                    {formatBytes(offlineState.usedBytes)} of {offlineMaxGb} GB limit
                    {offlineState.downloadingId
                      ? offlineState.progress !== null
                        ? ` · downloading ${offlineState.progress}%`
                        : " · downloading"
                      : ""}
                    {offlineState.queued.length > 0 ? ` · ${offlineState.queued.length} queued` : ""}
                  </span>
                  <span>{Math.round((offlineState.usedBytes / (Math.max(1, offlineMaxGb) * 1024 ** 3)) * 100)}%</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Limit</span>
                  <span className="flex items-center gap-1 rounded-lg bg-card border border-border/40 px-2.5 py-1 text-xs text-foreground focus-within:border-primary/60">
                    <input
                      className="w-10 min-w-0 bg-transparent tabular-nums outline-none text-right font-medium"
                      type="number"
                      min={1}
                      max={512}
                      value={Math.round(offlineMaxGb)}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (!Number.isFinite(next)) return;
                        setOfflineMaxGb(next);
                        setOfflineMaxBytes(Math.max(1, next) * 1024 ** 3);
                      }}
                      aria-label="Maximum download size in gigabytes"
                    />
                    <span className="text-muted-foreground text-[11px]">GB</span>
                  </span>
                </div>

                <button
                  className="flex items-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50 self-start sm:self-auto"
                  type="button"
                  disabled={clearingDownloads || Object.keys(offlineState.entries).length === 0}
                  onClick={() => {
                    setClearingDownloads(true);
                    void removeAllDownloads().finally(() => setClearingDownloads(false));
                  }}
                >
                  <TrashIcon size={13} />
                  <span>{clearingDownloads ? "Removing..." : "Remove all"}</span>
                </button>
              </div>
            </div>
          </section>

          <section className={SETTINGS_CARD} aria-labelledby="library-quality-title">
            <SettingsCardHeader
              title="Quality"
              titleId="library-quality-title"
              icon={<PlayIcon size={18} aria-hidden="true" />}
              description="Bitrate picked when a track is streamed or saved."
            />

            <SettingRow
              title="Streaming quality"
              description="Applies to songs played over the network. Lower uses less data."
            >
              {(labelId) => (
                <Select
                  className="w-full sm:w-52"
                  value={streamingQuality}
                  onValueChange={(value) => setStreamingQuality(value as AudioQuality)}
                >
                  <SelectTrigger aria-labelledby={labelId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(AUDIO_QUALITY_LABELS) as AudioQuality[]).map((quality) => (
                      <SelectItem key={quality} value={quality}>
                        {AUDIO_QUALITY_LABELS[quality]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </SettingRow>


            <SettingRow
              title="Download quality"
              description="Applies to songs saved for offline. Higher sounds better and uses more disk."
            >
              {(labelId) => (
                <Select
                  className="w-full sm:w-52"
                  value={downloadQuality}
                  onValueChange={(value) => setDownloadQuality(value as AudioQuality)}
                >
                  <SelectTrigger aria-labelledby={labelId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(AUDIO_QUALITY_LABELS) as AudioQuality[]).map((quality) => (
                      <SelectItem key={quality} value={quality}>
                        {AUDIO_QUALITY_LABELS[quality]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </SettingRow>

          </section>

          <section className={SETTINGS_CARD} aria-labelledby="library-lyrics-title">
            <SettingsCardHeader
              title="Lyrics"
              titleId="library-lyrics-title"
              icon={<LyricsIcon size={18} aria-hidden="true" />}
              description="Where lyrics come from and how they read."
            />

            <SettingRow
              title="Translate lyrics"
              description="Shows a translation under each line. Sends the lyrics to Google Translate."
            >
              {(labelId) => (
                <Select
                  className="w-full sm:w-52"
                  value={lyricsTranslationLang}
                  onValueChange={setLyricsTranslationLang}
                >
                  <SelectTrigger aria-labelledby={labelId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TRANSLATION_OFF}>Off</SelectItem>
                    {TRANSLATION_LANGUAGES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {getLanguageLabel(code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </SettingRow>


            <SettingRow
              title="Lyrics text size"
              description="Scales the lyrics screen. The size still adapts to the window on top of this."
            >
              {(labelId) => (
                <Select
                  className="w-full sm:w-52"
                  value={String(lyricsFontScale)}
                  onValueChange={(value) => setLyricsFontScale(Number(value))}
                >
                  <SelectTrigger aria-labelledby={labelId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LYRICS_FONT_SCALES.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </SettingRow>


            <SettingRow
              title="Preferred lyrics source"
              description="Tried first when a song opens. If it has nothing for that song, the others still run."
            >
              {(labelId) => (
                <Select
                  className="w-full sm:w-52"
                  value={preferredLyricsSource}
                  onValueChange={setPreferredLyricsSourceId}
                >
                  <SelectTrigger aria-labelledby={labelId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_LYRICS_SOURCE}>Automatic</SelectItem>
                    {LYRICS_SOURCES.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </SettingRow>

          </section>

          {!isMobile && (
            <section className={SETTINGS_CARD} aria-labelledby="library-system-title">
              <SettingsCardHeader
                title="System"
                titleId="library-system-title"
                icon={<SettingsIcon size={18} aria-hidden="true" />}
                description="How Zuno behaves outside the window."
              />

              <SettingToggle
                title="Launch at startup"
                description="Start Zuno when your computer starts."
                checked={autostartEnabled}
                disabled={autostartLoading}
                onCheckedChange={(checked) => void handleAutostartChange(checked)}
              />

              {autostartError && <p className="text-sm text-destructive">{autostartError}</p>}


              <SettingToggle
                title="Minimize to tray"
                description="Closing the window hides Zuno to the system tray and keeps playing. Quit from the tray icon."
                checked={minimizeToTray}
                onCheckedChange={setMinimizeToTray}
              />


              <SettingToggle
                title="Remember window size and location"
                description="Reopen the main window with its last size and screen position."
                checked={mainWindowGeometryPersistenceEnabled}
                onCheckedChange={setMainWindowGeometryPersistenceEnabled}
              />


            </section>
          )}

          <section className={SETTINGS_CARD} aria-labelledby="library-trouble-title">
            <SettingsCardHeader
              title="Troubleshooting"
              titleId="library-trouble-title"
              icon={<BugIcon size={18} aria-hidden="true" />}
              description="Diagnostics, and the irreversible reset."
            />

            {!isMobile && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={cn(SETTING_LABEL, "min-w-0 flex-1")}>
                    <strong>Application log</strong>
                    <span>Open the current log file for sharing or troubleshooting.</span>
                  </span>
                  <button
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    type="button"
                    disabled={logOpening}
                    onClick={() => void handleOpenLog()}
                  >
                    <LogFileIcon size={18} />
                    {logOpening ? "Opening..." : "Open log"}
                  </button>
                </div>

                {logError && <p className="text-sm text-destructive">{logError}</p>}
              </>
            )}


            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={cn(SETTING_LABEL, "min-w-0 flex-1")}>
                <strong>Delete all app data</strong>
                <span>Reset settings, cache, account, queue, tabs, onboarding, and local data.</span>
              </span>
              <button
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                type="button"
                disabled={resetSettingsBusy}
                onClick={() => void handleClearAllSettings()}
              >
                <TrashIcon size={18} />
                {resetSettingsBusy
                  ? "Deleting..."
                  : resetSettingsConfirming
                    ? "Press again to confirm"
                    : "Delete everything"}
              </button>
            </div>

            {resetSettingsError && <p className="text-sm text-destructive">{resetSettingsError}</p>}
          </section>
        </div>
      )}

      {activeTab === "shortcuts" && (
        <div className="flex flex-col gap-5" role="tabpanel" aria-label="Keyboard shortcut settings">
          <section className={SETTINGS_CARD} aria-labelledby="keyboard-shortcuts-settings-title">
            <h2
              className="text-lg font-semibold text-foreground"
              id="keyboard-shortcuts-settings-title"
            >
              Keyboard shortcuts
            </h2>

            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className={cn(SETTING_LABEL, "min-w-0 flex-1")}>
                  <strong>Reset shortcuts</strong>
                  <span>Restore every keyboard shortcut to its default.</span>
                </span>
                <button
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  type="button"
                  onClick={resetKeyboardShortcuts}
                >
                  <RefreshIcon size={18} />
                  Reset all
                </button>
              </div>

              {KEYBOARD_SHORTCUT_ACTIONS.map((shortcutAction) => {
                const shortcut = keyboardShortcuts[shortcutAction.id];
                const isListening = listeningShortcut === shortcutAction.id;

                return (
                  <div className="flex items-center justify-between gap-4 py-2" key={shortcutAction.id}>
                    <span className={SETTING_LABEL}>
                      <strong>{shortcutAction.label}</strong>
                      <span>{shortcutAction.description}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        className={cn("min-w-32 rounded-lg bg-background px-2.5 py-1.5 text-center text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", isListening && "text-primary")}
                        type="button"
                        aria-pressed={isListening}
                        onClick={() => setListeningShortcut(shortcutAction.id)}
                        onKeyDown={(event) => handleShortcutCapture(event, shortcutAction.id)}
                        onBlur={() => {
                          if (isListening) setListeningShortcut(null);
                        }}
                      >
                        {isListening ? "Press shortcut..." : formatKeyboardShortcut(shortcut)}
                      </button>
                      <button
                        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        type="button"
                        onClick={() => resetKeyboardShortcut(shortcutAction.id)}
                      >
                        Reset
                      </button>
                      <button
                        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        type="button"
                        disabled={!shortcut}
                        onClick={() => setKeyboardShortcut(shortcutAction.id, null)}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {activeTab === "window" && (
        <div className="flex flex-col gap-5" role="tabpanel" aria-label="Style settings">
          <section className={SETTINGS_CARD} aria-labelledby="window-settings-title">
            <SettingsCardHeader
              title="Window controls"
              titleId="window-settings-title"
              icon={<QueuePanelIcon size={18} aria-hidden="true" />}
              description="Choose the title bar buttons and compact player behavior."
            />

            <SettingToggle
              title="Mini player"
              description="Show compact playback controls when the main window is not focused. Turning this off closes its window and frees around 30 MB."
              checked={miniPlayerEnabled}
              onCheckedChange={setMiniPlayerEnabled}
            />

            <SettingRow
              title="Library sidebar"
              description="How much room the playlist rail takes. Expand on hover keeps the collapsed width while still letting you read the list."
            >
              {() => (
                <Select
                  className="w-52"
                  value={sidebarMode}
                  onValueChange={(value) => setSidebarMode(value as SidebarMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIDEBAR_MODES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </SettingRow>

            <SettingRow
              title="Mini player hover bar"
              description="Choose what the expanded hover slider controls."
            >
              {() => (
                <Select
                  className="w-44"
                  value={miniPlayerHoverAction}
                  onValueChange={(value) =>
                    setMiniPlayerHoverAction(value as MiniPlayerHoverAction)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seek">Song position</SelectItem>
                    <SelectItem value="volume">Volume</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </SettingRow>

            <div className="flex items-center justify-between gap-4 py-2">
              <span className={SETTING_LABEL}>
                <strong>Mini player position</strong>
                <span>Move the mini player back to the bottom center of this screen.</span>
              </span>
              <button
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                type="button"
                disabled={miniPlayerResetting}
                onClick={() => void handleResetMiniPlayerPosition()}
              >
                {miniPlayerResetting ? "Resetting..." : "Reset position"}
              </button>
            </div>

            <SettingRow
              title="Window controls"
              description={isLinux
                ? "How minimize, maximize and close are drawn. Switching OS native restarts the app."
                : "How minimize, maximize and close are drawn."}
            >
              {(labelId) => (
                <div role="group" aria-labelledby={labelId}>
                  <Tabs
                    value={windowControlStyle}
                    onValueChange={(value) =>
                      handleWindowControlStyleChange(value as WindowControlStyle)}
                    variant="segment"
                  >
                    <TabsList>
                      <TabsTrigger value="macos">macOS</TabsTrigger>
                      <TabsTrigger value="windows">Windows</TabsTrigger>
                      <TabsTrigger value="native">OS native</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}
            </SettingRow>

            {/* Only reachable when it does something: hidden once native chrome takes over,
                and off tiling compositors the buttons already show without this. */}
            {isLinux && tilingWindowManager && windowControlStyle !== "native" && (
              <SettingToggle
                title="Show on this compositor"
                description="Tiling compositors don't draw window buttons for apps, so they're hidden by default. Turn this on to show them anyway."
                checked={forceWindowControls}
                onCheckedChange={setForceWindowControls}
              />
            )}

            {isLinux && (
              <SettingToggle
                title="Show in system media controls"
                description="Expose playback to the desktop's media widget and media keys (MPRIS). Turning this off stops the now-playing notifications some desktops show."
                checked={linuxMediaSession}
                onCheckedChange={setLinuxMediaSession}
              />
            )}
          </section>

          <section className={SETTINGS_CARD} aria-labelledby="behavior-settings-title">
            <div className="flex items-center gap-2">
              <h2 className="text-lg" id="behavior-settings-title">Behavior</h2>
            </div>

            <SettingToggle
              title="Compact player bar"
              description="Tuck the seek bar under the transport controls instead of spanning the full width."
              checked={compactPlayerBar}
              onCheckedChange={setCompactPlayerBar}
            />

            <SettingToggle
              title="Always show extra controls"
              description="Keep lyrics and queue visible instead of showing them only on hover."
              checked={extraPlayerControlsAlwaysVisible}
              onCheckedChange={setExtraPlayerControlsAlwaysVisible}
            />
          </section>
        </div>
      )}

      {activeTab === "playback" && (
        <div className="flex flex-col gap-5" role="tabpanel" aria-label="Playback settings">
          <section className={SETTINGS_CARD} aria-labelledby="playback-engine-title">
            <SettingsCardHeader
              title="Audio engine"
              titleId="playback-engine-title"
              icon={<PlayIcon size={18} aria-hidden="true" />}
              description="What actually plays the sound."
            />

            <SettingRow
              title="Playback method"
              description={
                audioEngineMode === "rust"
                  ? "Decoded directly in Rust. Lowest memory, gapless and crossfade support."
                  : audioEngineMode === "native"
                  ? "Zuno plays each track itself. About 90 MB lighter, slower to start, no gapless or crossfade."
                  : "A hidden YouTube frame plays each track. Costs about 90 MB, starts faster, required for gapless and crossfade."
              }
            >
              {() => (
                <Select
                  className="w-36 sm:w-48 shrink-0"
                  value={audioEngineMode}
                  onValueChange={(value) => setAudioEngineMode(value as AudioEngineMode)}
                >
                  <SelectTrigger className="h-9 rounded-full border border-white/10 bg-card/70 px-3 text-xs sm:text-sm hover:bg-card">
                    <SelectValue className="truncate whitespace-nowrap" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIO_ENGINE_MODES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </SettingRow>

            <p className="px-1 text-xs text-muted-foreground">
              Applies from the next track.
            </p>

            {!isMobile && <OutputDeviceSetting engineMode={audioEngineMode} />}

            <EqualizerSettings engineMode={audioEngineMode} />

            <SettingToggle
              title="Resolve streams as your account"
              description="Attaches your session when resolving a track — required for Premium bitrates. Downloads always resolve anonymously."
              checked={authenticatedStreaming}
              onCheckedChange={setAuthenticatedStreaming}
            />

            <SettingToggle
              title="Add plays to YouTube Music history"
              description="Reports plays to YouTube, feeding its recommendations. Also enables the setting above. The YouTube frame always reports its own."
              checked={youtubeScrobbling}
              onCheckedChange={(enabled) => {
                // Paired here rather than inside the setter, so the toolbar shortcut can flip
                // scrobbling on its own without silently changing stream resolution too.
                setYouTubeScrobbling(enabled);
                setAuthenticatedStreaming(enabled);
              }}
            />
          </section>

          <section className={SETTINGS_CARD} aria-labelledby="playback-settings-title">
            <SettingsCardHeader
              title="Transitions"
              titleId="playback-settings-title"
              icon={<PlayIcon size={18} aria-hidden="true" />}
              description="How one track becomes the next."
            />

            <SettingToggle
              title="Gapless playback"
              description="Load the next track while the current one is still playing, so albums and live sets run without a pause between songs."
              checked={gaplessEnabled}
              onCheckedChange={setGaplessEnabled}
            />

            <SettingRow
              title="Crossfade"
              description={
                crossfadeSec > 0
                  ? `Overlap each track with the next by ${crossfadeSec} second${
                    crossfadeSec === 1 ? "" : "s"
                  }.`
                  : "Off. Move the slider to overlap the end of each track with the start of the next."
              }
            >
              {(labelId) => (
                <span className="flex items-center gap-3">
                  <RangeSlider
                    className="w-44"
                    value={crossfadeSec}
                    min={0}
                    max={MAX_CROSSFADE_SEC}
                    step={1}
                    onValueChange={setCrossfadeSec}
                    aria-label="Crossfade length in seconds"
                  />
                  <span
                    id={labelId}
                    className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground"
                  >
                    {crossfadeSec > 0 ? `${crossfadeSec}s` : "Off"}
                  </span>
                </span>
              )}
            </SettingRow>

            {/*
              Crossfading a downloaded track is not possible: offline files play through an
              audio element rather than the deck pair the overlap needs. Saying so beats
              leaving people to wonder why it only sometimes works.
            */}
            <p className="text-sm text-muted-foreground">
              Both apply to streamed tracks. Downloaded and local files always play back to back.
            </p>
          </section>

          <section className={SETTINGS_CARD} aria-labelledby="session-settings-title">
            <SettingsCardHeader
              title="Session"
              titleId="session-settings-title"
              icon={<QueuePanelIcon size={18} aria-hidden="true" />}
              description="What comes back when you reopen Zuno."
            />

            <SettingToggle
              title="Restore tabs and queues"
              description="Reopen your tabs, queues and playback position on launch. Playback always starts paused."
              checked={sessionRestoreEnabled}
              onCheckedChange={setSessionRestoreEnabled}
            />
          </section>
        </div>
      )}

      {activeTab === "appearance" && (
        <div className="flex flex-col gap-5" role="tabpanel" aria-label="Appearance settings">
          <section className={SETTINGS_CARD} aria-labelledby="theme-settings-title">
            <SettingsCardHeader
              title="Theme"
              titleId="theme-settings-title"
              icon={<PaletteIcon size={18} aria-hidden="true" />}
              description="Applies instantly across both windows."
            />

            <div
              className="grid grid-cols-3 gap-2"
              role="radiogroup"
              aria-labelledby="theme-settings-title"
            >
              {THEME_OPTIONS.map((option) => {
                const isActive = themePreference === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setThemePreference(option.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl p-3 transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      isActive ? "bg-primary/15" : "bg-background/40 hover:bg-card",
                    )}
                  >
                    {/* Miniature window preview rather than a colour dot — it shows what
                        the choice actually does. */}
                    <span
                      className={cn(
                        "flex h-12 w-full flex-col justify-end overflow-hidden rounded-lg p-1 ring-1",
                        option.swatch,
                        isActive ? "ring-primary" : "ring-black/10",
                      )}
                      aria-hidden="true"
                    >
                      <span
                        className={cn(
                          "h-2 w-full rounded-sm",
                          option.value === "light" ? "bg-neutral-300" : "bg-neutral-700",
                        )}
                      />
                    </span>
                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.hint}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {!isMobile && (
            <section className={SETTINGS_CARD} aria-labelledby="toolbar-settings-title">
              <div className="min-w-0">
                <h2 className="text-lg" id="toolbar-settings-title">Title bar</h2>
                <p className="text-sm text-muted-foreground">
                  Which optional buttons sit next to the window controls.
                </p>
              </div>

              {TOOLBAR_ITEMS.map((item) => (
                <ToolbarItemToggle key={item.id} item={item} />
              ))}
            </section>
          )}

          <section className={SETTINGS_CARD} aria-labelledby="home-settings-title">
            <div className="min-w-0">
              <h2 className="text-lg" id="home-settings-title">Home</h2>
              <p className="text-sm text-muted-foreground">
                Which sections the home page shows.
              </p>
            </div>

            <SettingToggle
              title="Made for you"
              description="The recommendation carousel at the top. Hiding it leaves the surprise button and More recommendations working."
              checked={madeForYouVisible}
              onCheckedChange={setMadeForYouVisible}
            />

            <SettingToggle
              title="YouTube Music feed"
              description="Personalized shelves from YouTube Music — Quick picks, New releases for you, Recommended albums, and more. Requires sign-in."
              checked={ytmHomeFeedVisible}
              onCheckedChange={setYtmHomeFeedVisible}
            />
          </section>

          <section className={SETTINGS_CARD} aria-labelledby="motion-settings-title">
            <div className="min-w-0">
              <h2 className="text-lg" id="motion-settings-title">Motion &amp; performance</h2>
              <p className="text-sm text-muted-foreground">
                Turn these off on low-powered machines.
              </p>
            </div>

            <PotatoPcSettings />
          </section>
        </div>
      )}

        </div>
      </div>
    </main>
  );
}
