import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Target,
  Heart,
  Wrench,
  Users,
  Clock,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Plus,
  X,
  Link as LinkIcon,
  MapPin,
  DollarSign,
} from "lucide-react";

// Types matching backend schemas
type PrimaryGoal =
  | "income"
  | "impact"
  | "learning"
  | "portfolio"
  | "lifestyle"
  | "exit"
  | "passion"
  | "legacy";
type EmploymentStatus =
  | "full_time_employed"
  | "part_time_employed"
  | "freelance"
  | "unemployed"
  | "student"
  | "retired"
  | "founder";
type RiskTolerance = "very_low" | "low" | "moderate" | "high" | "very_high";
type AgeRange = "18-24" | "25-34" | "35-44" | "45-54" | "55-64" | "65+";
type EducationLevel =
  | "high_school"
  | "some_college"
  | "bachelors"
  | "masters"
  | "phd"
  | "bootcamp"
  | "self_taught"
  | "other";

interface UserProfile {
  id: string;
  name: string;
  slug: string;
  primary_goals: string;
  success_definition: string | null;
  interests: string | null;
  motivations: string | null;
  technical_skills: string | null;
  professional_experience: string | null;
  domain_expertise: string | null;
  industry_connections: string | null;
  professional_network: string | null;
  employment_status: EmploymentStatus | null;
  weekly_hours_available: number | null;
  financial_runway_months: number | null;
  risk_tolerance: RiskTolerance | null;
  other_commitments: string | null;
  // Geographic
  country: string | null;
  city: string | null;
  timezone: string | null;
  // Financial
  currency: string | null;
  current_monthly_income: number | null;
  target_monthly_income: number | null;
  monthly_expenses: number | null;
  available_capital: number | null;
  total_savings: number | null;
  // Demographics
  age_range: AgeRange | null;
  dependents: number | null;
  education_level: EducationLevel | null;
  education_field: string | null;
  // Communication
  languages: string | null;
  social_media_following: number | null;
  existing_audience: string | null;
  // Resources
  has_investor_access: number | null;
  has_existing_customers: number | null;
  resource_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileFormData {
  name: string;
  // Goals (FT1)
  primaryGoals: PrimaryGoal[];
  successDefinition: string;
  targetMonthlyIncome: number | null;
  // Passion (FT2)
  interests: string[];
  motivations: string;
  // Skills (FT3)
  technicalSkills: string[];
  professionalExperience: string;
  domainExpertise: string;
  educationLevel: EducationLevel | "";
  educationField: string;
  languages: string[];
  // Network (FT4)
  industryConnections: string[];
  professionalNetwork: string;
  socialMediaFollowing: number | null;
  existingAudience: string;
  hasInvestorAccess: boolean;
  hasExistingCustomers: boolean;
  resourceNotes: string;
  // Life Stage (FT5)
  country: string;
  city: string;
  timezone: string;
  currency: string;
  employmentStatus: EmploymentStatus | "";
  currentMonthlyIncome: number | null;
  monthlyExpenses: number | null;
  totalSavings: number | null;
  availableCapital: number | null;
  weeklyHoursAvailable: number | null;
  riskTolerance: RiskTolerance | "";
  ageRange: AgeRange | "";
  dependents: number | null;
  currentCommitments: string;
}

const PRIMARY_GOALS: {
  value: PrimaryGoal;
  label: string;
  description: string;
}[] = [
  {
    value: "income",
    label: "Income",
    description: "Generate revenue or salary",
  },
  {
    value: "impact",
    label: "Impact",
    description: "Make a difference in the world",
  },
  {
    value: "learning",
    label: "Learning",
    description: "Gain new skills and knowledge",
  },
  {
    value: "portfolio",
    label: "Portfolio",
    description: "Build a body of work",
  },
  {
    value: "lifestyle",
    label: "Lifestyle",
    description: "Achieve work-life balance",
  },
  { value: "exit", label: "Exit", description: "Build to sell" },
  { value: "passion", label: "Passion", description: "Pursue what you love" },
  { value: "legacy", label: "Legacy", description: "Create something lasting" },
];

const EMPLOYMENT_STATUSES: { value: EmploymentStatus; label: string }[] = [
  { value: "full_time_employed", label: "Full-time Employed" },
  { value: "part_time_employed", label: "Part-time Employed" },
  { value: "freelance", label: "Freelance/Consultant" },
  { value: "unemployed", label: "Currently Unemployed" },
  { value: "student", label: "Student" },
  { value: "retired", label: "Retired" },
  { value: "founder", label: "Founder/Self-employed" },
];

const RISK_TOLERANCES: { value: RiskTolerance; label: string }[] = [
  { value: "very_low", label: "Very Low" },
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
  { value: "very_high", label: "Very High" },
];

const AGE_RANGES: { value: AgeRange; label: string }[] = [
  { value: "18-24", label: "18-24" },
  { value: "25-34", label: "25-34" },
  { value: "35-44", label: "35-44" },
  { value: "45-54", label: "45-54" },
  { value: "55-64", label: "55-64" },
  { value: "65+", label: "65+" },
];

const EDUCATION_LEVELS: { value: EducationLevel; label: string }[] = [
  { value: "high_school", label: "High School" },
  { value: "some_college", label: "Some College" },
  { value: "bachelors", label: "Bachelor's Degree" },
  { value: "masters", label: "Master's Degree" },
  { value: "phd", label: "PhD / Doctorate" },
  { value: "bootcamp", label: "Bootcamp / Certification" },
  { value: "self_taught", label: "Self-taught" },
  { value: "other", label: "Other" },
];

const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "INR",
  "JPY",
  "CNY",
  "BRL",
  "MXN",
  "CHF",
  "SEK",
  "NZD",
  "SGD",
  "HKD",
  "KRW",
  "Other",
];

const COMMON_TIMEZONES = [
  "UTC-12:00",
  "UTC-11:00",
  "UTC-10:00 (Hawaii)",
  "UTC-09:00 (Alaska)",
  "UTC-08:00 (PST/LA)",
  "UTC-07:00 (MST/Denver)",
  "UTC-06:00 (CST/Chicago)",
  "UTC-05:00 (EST/NYC)",
  "UTC-04:00 (AST)",
  "UTC-03:00 (Sao Paulo)",
  "UTC-02:00",
  "UTC-01:00",
  "UTC+00:00 (London)",
  "UTC+01:00 (Paris/Berlin)",
  "UTC+02:00 (Cairo)",
  "UTC+03:00 (Moscow)",
  "UTC+04:00 (Dubai)",
  "UTC+05:00",
  "UTC+05:30 (Mumbai)",
  "UTC+06:00",
  "UTC+07:00 (Bangkok)",
  "UTC+08:00 (Singapore/HK)",
  "UTC+09:00 (Tokyo)",
  "UTC+10:00 (Sydney)",
  "UTC+11:00",
  "UTC+12:00 (Auckland)",
];

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Tag input component
function TagInput({
  label,
  tags,
  onTagsChange,
  placeholder,
  helpText,
}: {
  label: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder: string;
  helpText?: string;
}) {
  const [inputValue, setInputValue] = useState("");
  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
      setInputValue("");
    }
  };
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
          placeholder={placeholder}
          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
        />
        <button
          type="button"
          onClick={addTag}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {helpText && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
            >
              {tag}
              <button
                type="button"
                onClick={() => onTagsChange(tags.filter((t) => t !== tag))}
                className="hover:text-primary-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Currency input component
function CurrencyInput({
  label,
  value,
  onChange,
  currency,
  placeholder,
  helpText,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  currency: string;
  placeholder?: string;
  helpText?: string;
}) {
  const symbol =
    currency === "USD"
      ? "$"
      : currency === "EUR"
        ? "€"
        : currency === "GBP"
          ? "£"
          : currency === "INR"
            ? "₹"
            : currency;
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
          {symbol}
        </span>
        <input
          type="number"
          min="0"
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value ? parseInt(e.target.value) : null)
          }
          placeholder={placeholder}
          className="w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
        />
      </div>
      {helpText && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
    </div>
  );
}

const initialFormData: ProfileFormData = {
  name: "",
  primaryGoals: [],
  successDefinition: "",
  targetMonthlyIncome: null,
  interests: [],
  motivations: "",
  technicalSkills: [],
  professionalExperience: "",
  domainExpertise: "",
  educationLevel: "",
  educationField: "",
  languages: [],
  industryConnections: [],
  professionalNetwork: "",
  socialMediaFollowing: null,
  existingAudience: "",
  hasInvestorAccess: false,
  hasExistingCustomers: false,
  resourceNotes: "",
  country: "",
  city: "",
  timezone: "",
  currency: "USD",
  employmentStatus: "",
  currentMonthlyIncome: null,
  monthlyExpenses: null,
  totalSavings: null,
  availableCapital: null,
  weeklyHoursAvailable: null,
  riskTolerance: "",
  ageRange: "",
  dependents: null,
  currentCommitments: "",
};

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [linkedIdeas, setLinkedIdeas] = useState<
    { id: string; title: string; slug: string }[]
  >([]);
  const [formData, setFormData] = useState<ProfileFormData>(initialFormData);

  useEffect(() => {
    fetchProfiles();
  }, []);
  useEffect(() => {
    selectedProfileId
      ? fetchLinkedIdeas(selectedProfileId)
      : setLinkedIdeas([]);
  }, [selectedProfileId]);

  const fetchProfiles = async () => {
    try {
      const res = await fetch(`${API_URL}/api/profiles`);
      const data = await res.json();
      if (data.success) {
        setProfiles(data.data);
        if (data.data.length > 0) loadProfile(data.data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch profiles:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkedIdeas = async (profileId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/profiles/${profileId}/ideas`);
      const data = await res.json();
      if (data.success) setLinkedIdeas(data.data);
    } catch (err) {
      console.error("Failed to fetch linked ideas:", err);
    }
  };

  const loadProfile = (p: UserProfile) => {
    setSelectedProfileId(p.id);
    setFormData({
      name: p.name,
      primaryGoals: JSON.parse(p.primary_goals || "[]"),
      successDefinition: p.success_definition || "",
      targetMonthlyIncome: p.target_monthly_income,
      interests: JSON.parse(p.interests || "[]"),
      motivations: p.motivations || "",
      technicalSkills: JSON.parse(p.technical_skills || "[]"),
      professionalExperience: p.professional_experience || "",
      domainExpertise: p.domain_expertise || "",
      educationLevel: (p.education_level as EducationLevel) || "",
      educationField: p.education_field || "",
      languages: JSON.parse(p.languages || "[]"),
      industryConnections: JSON.parse(p.industry_connections || "[]"),
      professionalNetwork: p.professional_network || "",
      socialMediaFollowing: p.social_media_following,
      existingAudience: p.existing_audience || "",
      hasInvestorAccess: p.has_investor_access === 1,
      hasExistingCustomers: p.has_existing_customers === 1,
      resourceNotes: p.resource_notes || "",
      country: p.country || "",
      city: p.city || "",
      timezone: p.timezone || "",
      currency: p.currency || "USD",
      employmentStatus: p.employment_status || "",
      currentMonthlyIncome: p.current_monthly_income,
      monthlyExpenses: p.monthly_expenses,
      totalSavings: p.total_savings,
      availableCapital: p.available_capital,
      weeklyHoursAvailable: p.weekly_hours_available,
      riskTolerance: p.risk_tolerance || "",
      ageRange: (p.age_range as AgeRange) || "",
      dependents: p.dependents,
      currentCommitments: p.other_commitments || "",
    });
  };

  const createNewProfile = () => {
    setSelectedProfileId(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        primary_goals: JSON.stringify(formData.primaryGoals),
        success_definition: formData.successDefinition || null,
        target_monthly_income: formData.targetMonthlyIncome,
        interests: JSON.stringify(formData.interests),
        motivations: formData.motivations || null,
        technical_skills: JSON.stringify(formData.technicalSkills),
        professional_experience: formData.professionalExperience || null,
        domain_expertise: formData.domainExpertise || null,
        education_level: formData.educationLevel || null,
        education_field: formData.educationField || null,
        languages: JSON.stringify(formData.languages),
        industry_connections: JSON.stringify(formData.industryConnections),
        professional_network: formData.professionalNetwork || null,
        social_media_following: formData.socialMediaFollowing,
        existing_audience: formData.existingAudience || null,
        has_investor_access: formData.hasInvestorAccess ? 1 : 0,
        has_existing_customers: formData.hasExistingCustomers ? 1 : 0,
        resource_notes: formData.resourceNotes || null,
        country: formData.country || null,
        city: formData.city || null,
        timezone: formData.timezone || null,
        currency: formData.currency || "USD",
        employment_status: formData.employmentStatus || null,
        current_monthly_income: formData.currentMonthlyIncome,
        monthly_expenses: formData.monthlyExpenses,
        total_savings: formData.totalSavings,
        available_capital: formData.availableCapital,
        weekly_hours_available: formData.weeklyHoursAvailable,
        financial_runway_months:
          formData.totalSavings && formData.monthlyExpenses
            ? Math.floor(formData.totalSavings / formData.monthlyExpenses)
            : null,
        risk_tolerance: formData.riskTolerance || null,
        age_range: formData.ageRange || null,
        dependents: formData.dependents,
        other_commitments: formData.currentCommitments || null,
      };
      const url = selectedProfileId
        ? `${API_URL}/api/profiles/${selectedProfileId}`
        : `${API_URL}/api/profiles`;
      const res = await fetch(url, {
        method: selectedProfileId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(selectedProfileId ? "Profile updated!" : "Profile created!");
        await fetchProfiles();
        if (!selectedProfileId && data.data?.id)
          setSelectedProfileId(data.data.id);
      } else setError(data.error || "Failed to save profile");
    } catch {
      setError("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const toggleGoal = (goal: PrimaryGoal) =>
    setFormData((prev) => ({
      ...prev,
      primaryGoals: prev.primaryGoals.includes(goal)
        ? prev.primaryGoals.filter((g) => g !== goal)
        : [...prev.primaryGoals, goal],
    }));

  const calculatedRunway =
    formData.totalSavings &&
    formData.monthlyExpenses &&
    formData.monthlyExpenses > 0
      ? Math.floor(formData.totalSavings / formData.monthlyExpenses)
      : null;

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <User className="h-8 w-8 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">User Profile</h1>
        </div>
        <button
          onClick={createNewProfile}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> New Profile
        </button>
      </div>

      <p className="text-gray-600 mb-6">
        Comprehensive profile for accurate Personal Fit evaluation (FT1-FT5).
        More detail = better scores.
      </p>

      {profiles.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Profile
          </label>
          <select
            value={selectedProfileId || ""}
            onChange={(e) => {
              const p = profiles.find((x) => x.id === e.target.value);
              if (p) loadProfile(p);
            }}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            <option value="">-- Create New --</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle className="h-5 w-5" />
          {success}
        </div>
      )}

      {selectedProfileId && linkedIdeas.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2 text-blue-700 font-medium">
            <LinkIcon className="h-4 w-4" />
            Linked Ideas
          </div>
          <div className="flex flex-wrap gap-2">
            {linkedIdeas.map((idea) => (
              <button
                key={idea.id}
                onClick={() => navigate(`/ideas/${idea.slug}`)}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200"
              >
                {idea.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Location & Demographics */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Location & Demographics</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Profile Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., My Professional Profile"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country *
              </label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })
                }
                placeholder="e.g., United States, Germany, India"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Affects market access, regulations, costs
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                placeholder="e.g., San Francisco, Berlin, Mumbai"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Affects cost of living calculations
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timezone
              </label>
              <select
                value={formData.timezone}
                onChange={(e) =>
                  setFormData({ ...formData, timezone: e.target.value })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Select timezone...</option>
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Age Range
              </label>
              <select
                value={formData.ageRange}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ageRange: e.target.value as AgeRange,
                  })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Select age range...</option>
                {AGE_RANGES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Affects time horizon & risk capacity
              </p>
            </div>
          </div>
        </div>

        {/* Financial Reality */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold">Financial Reality</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Actual numbers for calculating runway and assessing idea
            feasibility.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) =>
                  setFormData({ ...formData, currency: e.target.value })
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <CurrencyInput
              label="Current Monthly Income"
              value={formData.currentMonthlyIncome}
              onChange={(v) =>
                setFormData({ ...formData, currentMonthlyIncome: v })
              }
              currency={formData.currency}
              placeholder="5000"
              helpText="From job, freelance, etc."
            />
            <CurrencyInput
              label="Target Monthly Income"
              value={formData.targetMonthlyIncome}
              onChange={(v) =>
                setFormData({ ...formData, targetMonthlyIncome: v })
              }
              currency={formData.currency}
              placeholder="10000"
              helpText="What you want to earn"
            />
            <CurrencyInput
              label="Monthly Expenses"
              value={formData.monthlyExpenses}
              onChange={(v) => setFormData({ ...formData, monthlyExpenses: v })}
              currency={formData.currency}
              placeholder="3000"
              helpText="Rent, food, bills"
            />
            <CurrencyInput
              label="Total Savings"
              value={formData.totalSavings}
              onChange={(v) => setFormData({ ...formData, totalSavings: v })}
              currency={formData.currency}
              placeholder="50000"
              helpText="Emergency fund + savings"
            />
            <CurrencyInput
              label="Available to Invest"
              value={formData.availableCapital}
              onChange={(v) =>
                setFormData({ ...formData, availableCapital: v })
              }
              currency={formData.currency}
              placeholder="10000"
              helpText="Capital for ideas"
            />
          </div>
          {calculatedRunway !== null && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm font-medium text-green-700">
                Calculated Runway: {calculatedRunway} months
              </div>
              <div className="text-xs text-green-600">
                Based on savings / monthly expenses
              </div>
            </div>
          )}
        </div>

        {/* FT1 - Personal Goals */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Personal Goals (FT1)</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Goals (select all that apply)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {PRIMARY_GOALS.map((goal) => (
                  <button
                    key={goal.value}
                    type="button"
                    onClick={() => toggleGoal(goal.value)}
                    className={`p-3 rounded-lg border text-left transition-colors ${formData.primaryGoals.includes(goal.value) ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"}`}
                  >
                    <div className="font-medium text-sm">{goal.label}</div>
                    <div className="text-xs opacity-75">{goal.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                How do you define success?
              </label>
              <textarea
                value={formData.successDefinition}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    successDefinition: e.target.value,
                  })
                }
                placeholder="What does success look like in 2-3 years? Be specific about numbers, lifestyle, impact."
                rows={3}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* FT2 - Passion */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold">Passion & Interests (FT2)</h2>
          </div>
          <div className="space-y-4">
            <TagInput
              label="Interests & Passions"
              tags={formData.interests}
              onTagsChange={(interests) =>
                setFormData({ ...formData, interests })
              }
              placeholder="Add an interest..."
              helpText="Topics you're genuinely excited about"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What motivates you?
              </label>
              <textarea
                value={formData.motivations}
                onChange={(e) =>
                  setFormData({ ...formData, motivations: e.target.value })
                }
                placeholder="What drives you? What problems excite you?"
                rows={3}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* FT3 - Skills */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold">Skills & Experience (FT3)</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Education Level
                </label>
                <select
                  value={formData.educationLevel}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      educationLevel: e.target.value as EducationLevel,
                    })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="">Select level...</option>
                  {EDUCATION_LEVELS.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field of Study
                </label>
                <input
                  type="text"
                  value={formData.educationField}
                  onChange={(e) =>
                    setFormData({ ...formData, educationField: e.target.value })
                  }
                  placeholder="e.g., Computer Science, Business"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>
            <TagInput
              label="Technical Skills"
              tags={formData.technicalSkills}
              onTagsChange={(technicalSkills) =>
                setFormData({ ...formData, technicalSkills })
              }
              placeholder="Add a skill..."
              helpText="Programming, frameworks, tools"
            />
            <TagInput
              label="Languages Spoken"
              tags={formData.languages}
              onTagsChange={(languages) =>
                setFormData({ ...formData, languages })
              }
              placeholder="Add a language..."
              helpText="Affects markets you can target"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Professional Experience
              </label>
              <textarea
                value={formData.professionalExperience}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    professionalExperience: e.target.value,
                  })
                }
                placeholder="Years of experience, roles, achievements"
                rows={2}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Domain Expertise
              </label>
              <input
                type="text"
                value={formData.domainExpertise}
                onChange={(e) =>
                  setFormData({ ...formData, domainExpertise: e.target.value })
                }
                placeholder="e.g., Fintech, Healthcare, E-commerce"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* FT4 - Network */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold">Network & Resources (FT4)</h2>
          </div>
          <div className="space-y-4">
            <TagInput
              label="Industry Connections"
              tags={formData.industryConnections}
              onTagsChange={(industryConnections) =>
                setFormData({ ...formData, industryConnections })
              }
              placeholder="Add an industry..."
              helpText="Industries where you have connections"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Professional Network
              </label>
              <textarea
                value={formData.professionalNetwork}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    professionalNetwork: e.target.value,
                  })
                }
                placeholder="Communities, groups, advisors, partners"
                rows={2}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Social Media Following
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.socialMediaFollowing ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      socialMediaFollowing: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  placeholder="Total across platforms"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Existing Audience
                </label>
                <input
                  type="text"
                  value={formData.existingAudience}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      existingAudience: e.target.value,
                    })
                  }
                  placeholder="Newsletter (2k), YouTube (10k)"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasInvestorAccess}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hasInvestorAccess: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm">Access to investors/funding</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasExistingCustomers}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hasExistingCustomers: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm">Have existing customers</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Other Resources
              </label>
              <textarea
                value={formData.resourceNotes}
                onChange={(e) =>
                  setFormData({ ...formData, resourceNotes: e.target.value })
                }
                placeholder="Equipment, office space, partnerships, etc."
                rows={2}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* FT5 - Life Stage */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-semibold">
              Life Stage & Capacity (FT5)
            </h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employment Status
                </label>
                <select
                  value={formData.employmentStatus}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      employmentStatus: e.target.value as EmploymentStatus,
                    })
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="">Select status...</option>
                  {EMPLOYMENT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weekly Hours Available
                </label>
                <input
                  type="number"
                  min="0"
                  max="80"
                  value={formData.weeklyHoursAvailable ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      weeklyHoursAvailable: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  placeholder="For side projects"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dependents
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.dependents ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dependents: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  placeholder="People relying on you"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Risk Tolerance
              </label>
              <div className="grid grid-cols-5 gap-2">
                {RISK_TOLERANCES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, riskTolerance: r.value })
                    }
                    className={`p-2 rounded-lg border text-center transition-colors ${formData.riskTolerance === r.value ? "bg-purple-50 border-purple-500 text-purple-700" : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"}`}
                  >
                    <div className="font-medium text-xs">{r.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Commitments
              </label>
              <textarea
                value={formData.currentCommitments}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    currentCommitments: e.target.value,
                  })
                }
                placeholder="Family, other projects, health considerations"
                rows={2}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              saving || !formData.name || formData.primaryGoals.length === 0
            }
            className="inline-flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {selectedProfileId ? "Update Profile" : "Create Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
