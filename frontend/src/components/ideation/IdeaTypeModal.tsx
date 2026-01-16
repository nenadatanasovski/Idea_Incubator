// =============================================================================
// FILE: frontend/src/components/ideation/IdeaTypeModal.tsx
// Modal for selecting idea type when creating a new idea
// Implements TEST-UI-010 requirements
// =============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { X, Building2, Puzzle, Globe, Server, RefreshCw } from "lucide-react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type IdeaTypeValue =
  | "business"
  | "feature_internal"
  | "feature_external"
  | "service"
  | "pivot";

export interface ExistingIdeaInfo {
  slug: string;
  title: string;
}

export interface IdeaTypeModalProps {
  isOpen: boolean;
  userSlug: string;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    ideaType: IdeaTypeValue;
    parent?: {
      type: "internal" | "external";
      slug?: string;
      name?: string;
    };
  }) => void;
}

// Define the 5 idea type options as per spec
const IDEA_TYPE_OPTIONS = [
  {
    id: "business" as IdeaTypeValue,
    number: 1,
    title: "A brand new standalone business/app",
    description: "A completely new product, service, or business venture",
    icon: Building2,
    hasFollowUp: false,
  },
  {
    id: "feature_internal" as IdeaTypeValue,
    number: 2,
    title: "A feature for an existing idea",
    description: "Add functionality to one of your existing ideas",
    icon: Puzzle,
    hasFollowUp: true,
    followUpType: "existing-ideas" as const,
  },
  {
    id: "feature_external" as IdeaTypeValue,
    number: 3,
    title: "A feature/integration for external platform",
    description:
      "Build something for an external platform (e.g., Shopify app, Chrome extension)",
    icon: Globe,
    hasFollowUp: true,
    followUpType: "platform-input" as const,
  },
  {
    id: "service" as IdeaTypeValue,
    number: 4,
    title: "A microservice/API",
    description: "A standalone service or API that could be shared or sold",
    icon: Server,
    hasFollowUp: true,
    followUpType: "service-type" as const,
  },
  {
    id: "pivot" as IdeaTypeValue,
    number: 5,
    title: "A pivot/evolution of existing idea",
    description: "Transform or pivot an existing idea in a new direction",
    icon: RefreshCw,
    hasFollowUp: true,
    followUpType: "existing-ideas" as const,
  },
];

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export const IdeaTypeModal: React.FC<IdeaTypeModalProps> = ({
  isOpen,
  userSlug,
  onClose,
  onSubmit,
}) => {
  // State
  const [selectedType, setSelectedType] = useState<IdeaTypeValue | null>(null);
  const [ideaName, setIdeaName] = useState("");
  const [existingIdeas, setExistingIdeas] = useState<ExistingIdeaInfo[]>([]);
  const [selectedExistingIdea, setSelectedExistingIdea] = useState<
    string | null
  >(null);
  const [platformName, setPlatformName] = useState("");
  const [serviceScope, setServiceScope] = useState<"shared" | "standalone">(
    "standalone",
  );
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get the selected option config
  const selectedOption = IDEA_TYPE_OPTIONS.find(
    (opt) => opt.id === selectedType,
  );

  // Fetch existing ideas when needed
  const fetchExistingIdeas = useCallback(async () => {
    if (!userSlug) return;

    setIsLoadingIdeas(true);
    try {
      const response = await fetch(`/api/ideation/ideas/${userSlug}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.ideas) {
          // Filter out drafts
          const nonDraftIdeas = result.data.ideas.filter(
            (idea: ExistingIdeaInfo & { isDraft?: boolean }) => !idea.isDraft,
          );
          setExistingIdeas(nonDraftIdeas);
        }
      }
    } catch (error) {
      console.error("Failed to fetch existing ideas:", error);
    } finally {
      setIsLoadingIdeas(false);
    }
  }, [userSlug]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedType(null);
      setIdeaName("");
      setSelectedExistingIdea(null);
      setPlatformName("");
      setServiceScope("standalone");
    }
  }, [isOpen]);

  // Fetch ideas when an option requiring existing ideas is selected
  useEffect(() => {
    if (selectedOption?.followUpType === "existing-ideas") {
      fetchExistingIdeas();
    }
  }, [selectedOption, fetchExistingIdeas]);

  // Handle type selection
  const handleSelectType = (typeId: IdeaTypeValue) => {
    setSelectedType(typeId);
    // Reset follow-up selections
    setSelectedExistingIdea(null);
    setPlatformName("");
    setServiceScope("standalone");
  };

  // Check if form is valid for submission
  const isFormValid = (): boolean => {
    if (!selectedType || !ideaName.trim()) return false;

    if (selectedOption?.hasFollowUp) {
      switch (selectedOption.followUpType) {
        case "existing-ideas":
          return !!selectedExistingIdea;
        case "platform-input":
          return !!platformName.trim();
        case "service-type":
          return !!serviceScope;
        default:
          return true;
      }
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!selectedType || !ideaName.trim()) return;

    setIsSubmitting(true);

    try {
      // Build parent info based on selected type
      let parent:
        | { type: "internal" | "external"; slug?: string; name?: string }
        | undefined;

      if (
        selectedOption?.followUpType === "existing-ideas" &&
        selectedExistingIdea
      ) {
        parent = {
          type: "internal",
          slug: selectedExistingIdea,
        };
      } else if (
        selectedOption?.followUpType === "platform-input" &&
        platformName.trim()
      ) {
        parent = {
          type: "external",
          name: platformName.trim(),
        };
      }

      await onSubmit({
        name: ideaName.trim(),
        ideaType: selectedType,
        parent,
      });

      // Modal will be closed by parent component on success
    } catch (error) {
      console.error("Failed to create idea:", error);
      setIsSubmitting(false);
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="idea-type-modal"
        className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            What type of idea is this?
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Idea Type Options */}
        <div className="space-y-2 mb-6">
          {IDEA_TYPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedType === option.id;

            return (
              <button
                key={option.id}
                data-testid={`idea-type-option-${option.number}`}
                onClick={() => handleSelectType(option.id)}
                className={`
                  w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all
                  ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500"
                      : "bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                  }
                `}
              >
                <div
                  className={`
                    flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                    ${isSelected ? "bg-blue-500 text-white" : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"}
                  `}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    data-testid="idea-type-option"
                    className={`font-medium ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-gray-100"}`}
                  >
                    {option.title}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {option.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Follow-up Questions */}
        {selectedOption?.hasFollowUp && (
          <div
            data-testid="idea-type-followup"
            className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
          >
            {/* Existing Ideas List (for feature_internal and pivot) */}
            {selectedOption.followUpType === "existing-ideas" && (
              <div data-testid="existing-ideas-list">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select the parent idea:
                </label>
                {isLoadingIdeas ? (
                  <div className="text-center py-4 text-gray-500">
                    Loading ideas...
                  </div>
                ) : existingIdeas.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No existing ideas found. Create a standalone idea first.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {existingIdeas.map((idea) => (
                      <button
                        key={idea.slug}
                        data-testid="idea-option"
                        onClick={() => setSelectedExistingIdea(idea.slug)}
                        className={`
                          w-full p-2 rounded-lg text-left text-sm transition-colors
                          ${
                            selectedExistingIdea === idea.slug
                              ? "bg-blue-100 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300 border border-blue-300"
                              : "bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 border border-gray-200 dark:border-gray-500"
                          }
                        `}
                      >
                        {idea.title || idea.slug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Platform Input (for feature_external) */}
            {selectedOption.followUpType === "platform-input" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Platform name:
                </label>
                <input
                  type="text"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  placeholder="e.g., Shopify, Chrome, Slack"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Service Type (for service) */}
            {selectedOption.followUpType === "service-type" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Service scope:
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="serviceScope"
                      value="shared"
                      checked={serviceScope === "shared"}
                      onChange={() => setServiceScope("shared")}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Shared - Reusable across multiple ideas
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="serviceScope"
                      value="standalone"
                      checked={serviceScope === "standalone"}
                      onChange={() => setServiceScope("standalone")}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Standalone - Independent service/product
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Idea Name Input */}
        {selectedType && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Idea name:
            </label>
            <input
              data-testid="new-idea-name"
              type="text"
              value={ideaName}
              onChange={(e) => setIdeaName(e.target.value)}
              placeholder="Enter a name for your idea"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === "Enter" && isFormValid()) {
                  handleSubmit();
                }
              }}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="btn-create-idea"
            onClick={handleSubmit}
            disabled={!isFormValid() || isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Creating..." : "Create Idea"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdeaTypeModal;
