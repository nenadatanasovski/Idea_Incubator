import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Mail,
  MessageCircle,
  Monitor,
  Loader2,
  AlertCircle,
  CheckCircle,
  VolumeX,
  Volume2,
  ArrowLeft,
  Save,
} from "lucide-react";
import clsx from "clsx";

type NotificationChannel = "in_app" | "email" | "telegram";

interface ChannelPreference {
  id: string;
  userId: string;
  notificationType: string;
  channels: NotificationChannel[];
  mutedUntil: string | null;
}

interface NotificationType {
  type: string;
  title: string;
  defaultChannels: NotificationChannel[];
}

interface PreferencesResponse {
  preferences: ChannelPreference[];
  availableTypes: NotificationType[];
}

const CHANNEL_ICONS: Record<NotificationChannel, typeof Bell> = {
  in_app: Monitor,
  email: Mail,
  telegram: MessageCircle,
};

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: "In-App",
  email: "Email",
  telegram: "Telegram",
};

const MUTE_DURATIONS = [
  { value: 60, label: "1 hour" },
  { value: 240, label: "4 hours" },
  { value: 480, label: "8 hours" },
  { value: 1440, label: "24 hours" },
  { value: 10080, label: "1 week" },
];

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function NotificationPreferences() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<ChannelPreference[]>([]);
  const [availableTypes, setAvailableTypes] = useState<NotificationType[]>([]);
  const [pendingChanges, setPendingChanges] = useState<
    Map<string, NotificationChannel[]>
  >(new Map());
  const [muteModalOpen, setMuteModalOpen] = useState<string | null>(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/notifications/preferences`);
      if (!res.ok) throw new Error("Failed to fetch preferences");
      const data: PreferencesResponse = await res.json();
      setPreferences(data.preferences);
      setAvailableTypes(data.availableTypes);
    } catch (err) {
      setError("Failed to load notification preferences");
      console.error("Failed to fetch preferences:", err);
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveChannels = (type: string): NotificationChannel[] => {
    // Check pending changes first
    if (pendingChanges.has(type)) {
      return pendingChanges.get(type)!;
    }
    // Then check saved preferences
    const pref = preferences.find((p) => p.notificationType === type);
    if (pref) {
      return pref.channels;
    }
    // Fall back to default
    const typeInfo = availableTypes.find((t) => t.type === type);
    return typeInfo?.defaultChannels || ["in_app"];
  };

  const getMuteStatus = (
    type: string,
  ): { muted: boolean; until: Date | null } => {
    const pref = preferences.find((p) => p.notificationType === type);
    if (pref?.mutedUntil) {
      const until = new Date(pref.mutedUntil);
      if (until > new Date()) {
        return { muted: true, until };
      }
    }
    return { muted: false, until: null };
  };

  const toggleChannel = (type: string, channel: NotificationChannel) => {
    const current = getEffectiveChannels(type);
    let updated: NotificationChannel[];

    if (current.includes(channel)) {
      // Don't allow removing the last channel
      if (current.length === 1) {
        setError("At least one notification channel must be enabled");
        setTimeout(() => setError(null), 3000);
        return;
      }
      updated = current.filter((c) => c !== channel);
    } else {
      updated = [...current, channel];
    }

    setPendingChanges(new Map(pendingChanges).set(type, updated));
  };

  const savePreferences = async () => {
    if (pendingChanges.size === 0) return;

    try {
      setSaving(true);
      setError(null);

      const updates = Array.from(pendingChanges.entries()).map(
        ([type, channels]) => ({
          notificationType: type,
          channels,
        }),
      );

      const res = await fetch(`${API_URL}/api/notifications/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: updates }),
      });

      if (!res.ok) throw new Error("Failed to save preferences");

      const data = await res.json();
      setPreferences(data.preferences);
      setPendingChanges(new Map());
      setSuccess("Preferences saved successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to save preferences");
      console.error("Failed to save preferences:", err);
    } finally {
      setSaving(false);
    }
  };

  const muteNotificationType = async (
    type: string,
    durationMinutes: number,
  ) => {
    try {
      const res = await fetch(
        `${API_URL}/api/notifications/preferences/${encodeURIComponent(type)}/mute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ duration: durationMinutes }),
        },
      );

      if (!res.ok) throw new Error("Failed to mute notification type");

      await fetchPreferences();
      setMuteModalOpen(null);
      setSuccess(`Muted ${type} notifications`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to mute notification type");
      console.error("Failed to mute:", err);
    }
  };

  const unmuteNotificationType = async (type: string) => {
    try {
      const res = await fetch(
        `${API_URL}/api/notifications/preferences/${encodeURIComponent(type)}/unmute`,
        {
          method: "POST",
        },
      );

      if (!res.ok) throw new Error("Failed to unmute notification type");

      await fetchPreferences();
      setSuccess(`Unmuted ${type} notifications`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to unmute notification type");
      console.error("Failed to unmute:", err);
    }
  };

  const formatMuteUntil = (date: Date): string => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? "s" : ""}`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Bell className="h-8 w-8 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">
            Notification Preferences
          </h1>
        </div>
        {pendingChanges.size > 0 && (
          <button
            onClick={savePreferences}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </button>
        )}
      </div>

      <p className="text-gray-600 mb-6">
        Choose how you want to receive notifications for different event types.
      </p>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Channel Legend */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Notification Channels
        </h3>
        <div className="flex flex-wrap gap-4">
          {(Object.keys(CHANNEL_ICONS) as NotificationChannel[]).map(
            (channel) => {
              const Icon = CHANNEL_ICONS[channel];
              return (
                <div
                  key={channel}
                  className="flex items-center gap-2 text-sm text-gray-600"
                >
                  <Icon className="h-4 w-4" />
                  <span>{CHANNEL_LABELS[channel]}</span>
                </div>
              );
            },
          )}
        </div>
      </div>

      {/* Notification Types */}
      <div className="space-y-4">
        {availableTypes.map((typeInfo) => {
          const channels = getEffectiveChannels(typeInfo.type);
          const muteStatus = getMuteStatus(typeInfo.type);
          const hasChanges = pendingChanges.has(typeInfo.type);

          return (
            <div
              key={typeInfo.type}
              className={clsx(
                "bg-white rounded-lg shadow-sm border p-4",
                hasChanges && "ring-2 ring-primary-200",
                muteStatus.muted && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">
                      {typeInfo.title}
                    </h3>
                    {muteStatus.muted && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                        <VolumeX className="h-3 w-3" />
                        Muted for {formatMuteUntil(muteStatus.until!)}
                      </span>
                    )}
                    {hasChanges && (
                      <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs">
                        Unsaved
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{typeInfo.type}</p>
                </div>

                {/* Mute/Unmute Button */}
                {muteStatus.muted ? (
                  <button
                    onClick={() => unmuteNotificationType(typeInfo.type)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    title="Unmute"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setMuteModalOpen(typeInfo.type)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    title="Mute temporarily"
                  >
                    <VolumeX className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Channel Toggles */}
              <div className="flex gap-2 mt-3">
                {(Object.keys(CHANNEL_ICONS) as NotificationChannel[]).map(
                  (channel) => {
                    const Icon = CHANNEL_ICONS[channel];
                    const isActive = channels.includes(channel);
                    const isDefault =
                      typeInfo.defaultChannels.includes(channel);

                    return (
                      <button
                        key={channel}
                        onClick={() => toggleChannel(typeInfo.type, channel)}
                        disabled={muteStatus.muted}
                        className={clsx(
                          "inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition",
                          isActive
                            ? "bg-primary-50 border-primary-300 text-primary-700"
                            : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300",
                          muteStatus.muted && "cursor-not-allowed",
                        )}
                        title={
                          isDefault
                            ? `${CHANNEL_LABELS[channel]} (default)`
                            : CHANNEL_LABELS[channel]
                        }
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-sm">
                          {CHANNEL_LABELS[channel]}
                        </span>
                        {isDefault && !isActive && (
                          <span className="text-xs text-gray-400">
                            (default)
                          </span>
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          );
        })}

        {availableTypes.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No notification types configured
          </div>
        )}
      </div>

      {/* Mute Modal */}
      {muteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Mute Notifications
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              How long do you want to mute <strong>{muteModalOpen}</strong>{" "}
              notifications?
            </p>
            <div className="space-y-2">
              {MUTE_DURATIONS.map((duration) => (
                <button
                  key={duration.value}
                  onClick={() =>
                    muteNotificationType(muteModalOpen, duration.value)
                  }
                  className="w-full px-4 py-2 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                >
                  {duration.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setMuteModalOpen(null)}
              className="w-full mt-4 px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pending changes footer */}
      {pendingChanges.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {pendingChanges.size} unsaved change
              {pendingChanges.size > 1 ? "s" : ""}
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingChanges(new Map())}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Discard
              </button>
              <button
                onClick={savePreferences}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
