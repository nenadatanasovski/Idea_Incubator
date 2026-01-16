import { useState } from "react";
import { X, User, Check, Search, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import type { UserProfileSummary } from "../types";
import clsx from "clsx";

interface ProfileSelectorProps {
  profiles: UserProfileSummary[];
  currentProfileId: string | null;
  onSelect: (profileId: string) => void;
  onClose: () => void;
  loading?: boolean;
}

function parseGoals(goalsJson: string): string[] {
  try {
    const parsed = JSON.parse(goalsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ProfileSelector({
  profiles,
  currentProfileId,
  onSelect,
  onClose,
  loading = false,
}: ProfileSelectorProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(currentProfileId);

  const filteredProfiles = profiles.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Select Profile
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search profiles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
        </div>

        {/* Profile List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredProfiles.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">
                {profiles.length === 0
                  ? "No profiles created yet"
                  : "No profiles match your search"}
              </p>
              <Link
                to="/profile"
                className="btn btn-primary inline-flex items-center"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Profile
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProfiles.map((profile) => {
                const goals = parseGoals(profile.primary_goals);
                const isSelected = selectedId === profile.id;

                return (
                  <button
                    key={profile.id}
                    onClick={() => setSelectedId(profile.id)}
                    className={clsx(
                      "w-full text-left p-4 rounded-lg border-2 transition",
                      isSelected
                        ? "border-primary-500 bg-primary-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={clsx(
                            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                            isSelected ? "bg-primary-100" : "bg-gray-100",
                          )}
                        >
                          <User
                            className={clsx(
                              "h-5 w-5",
                              isSelected ? "text-primary-600" : "text-gray-500",
                            )}
                          />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {profile.name}
                          </div>
                          {goals.length > 0 && (
                            <div className="text-sm text-gray-500 mt-0.5">
                              Goals:{" "}
                              {goals
                                .slice(0, 3)
                                .map(
                                  (g) => g.charAt(0).toUpperCase() + g.slice(1),
                                )
                                .join(", ")}
                              {goals.length > 3 && ` +${goals.length - 3}`}
                            </div>
                          )}
                          {profile.employment_status && (
                            <div className="text-sm text-gray-500">
                              {profile.employment_status.replace(/-/g, " ")}
                              {profile.weekly_hours_available &&
                                ` - ${profile.weekly_hours_available} hrs/week`}
                            </div>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="h-5 w-5 text-primary-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-between items-center">
          <Link
            to="/profile"
            className="text-sm text-primary-600 hover:text-primary-800"
          >
            Manage profiles
          </Link>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedId || loading}
              className="btn btn-primary"
            >
              {loading ? "Linking..." : "Link Profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
