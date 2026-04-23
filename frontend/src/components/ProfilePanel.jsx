import { useEffect, useState } from "react";
import { getUserProfile, updateUserProfile } from "../services/api";

const defaultProfile = {
  fullName: "",
  age: "",
  gender: "",
  allergies: "",
  conditions: "",
  medications: "",
  emergencyContact: "",
  preferredLanguage: "en",
};

export default function ProfilePanel({
  userId,
  isOpen,
  onClose,
  onToast,
  onProfileSaved,
}) {
  const [profile, setProfile] = useState(defaultProfile);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const showToast = (message, type = "info") => {
    if (typeof onToast === "function") {
      onToast(message, type);
    }
  };

  useEffect(() => {
    if (!isOpen || !userId) return;

    const loadProfile = async () => {
      setLoading(true);
      setStatus("");

      try {
        const data = await getUserProfile(userId);
        const normalizedProfile = {
          fullName: data.fullName || "",
          age: data.age ?? "",
          gender: data.gender || "",
          allergies: data.allergies || "",
          conditions: data.conditions || "",
          medications: data.medications || "",
          emergencyContact: data.emergencyContact || "",
          preferredLanguage: data.preferredLanguage || "en",
        };

        setProfile(normalizedProfile);
      } catch (error) {
        setStatus("Failed to load profile.");
        showToast(error.message || "Failed to load profile.", "error");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [isOpen, userId]);

  const handleChange = (field, value) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus("");

    try {
      const savedProfile = await updateUserProfile(userId, profile);

      const normalizedProfile = {
        fullName: savedProfile.fullName || "",
        age: savedProfile.age ?? "",
        gender: savedProfile.gender || "",
        allergies: savedProfile.allergies || "",
        conditions: savedProfile.conditions || "",
        medications: savedProfile.medications || "",
        emergencyContact: savedProfile.emergencyContact || "",
        preferredLanguage: savedProfile.preferredLanguage || "en",
      };

      setProfile(normalizedProfile);
      setStatus("Profile saved successfully. Preferred language updated.");
      showToast("Profile saved successfully.", "success");

      if (typeof onProfileSaved === "function") {
        onProfileSaved(normalizedProfile);
      }
    } catch (error) {
      setStatus("Failed to save profile.");
      showToast(error.message || "Failed to save profile.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-[360px] bg-white border-l border-gray-200 h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
        <div>
          <div className="text-lg font-semibold text-gray-800">Patient Profile</div>
          <div className="text-xs text-gray-500">
            Add health background for smarter guidance
          </div>
        </div>

        <button
          onClick={onClose}
          type="button"
          className="text-gray-500 hover:text-black text-lg"
        >
          ✕
        </button>
      </div>

      {loading ? (
        <div className="p-4 text-sm text-gray-500">Loading profile...</div>
      ) : (
        <form onSubmit={handleSave} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full name
            </label>
            <input
              type="text"
              value={profile.fullName}
              onChange={(e) => handleChange("fullName", e.target.value)}
              className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Age
              </label>
              <input
                type="number"
                min="0"
                max="120"
                value={profile.age}
                onChange={(e) => handleChange("age", e.target.value)}
                className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                value={profile.gender}
                onChange={(e) => handleChange("gender", e.target.value)}
                className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Allergies
            </label>
            <textarea
              rows="2"
              value={profile.allergies}
              onChange={(e) => handleChange("allergies", e.target.value)}
              placeholder="Example: penicillin, peanuts"
              className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Existing conditions
            </label>
            <textarea
              rows="2"
              value={profile.conditions}
              onChange={(e) => handleChange("conditions", e.target.value)}
              placeholder="Example: asthma, diabetes"
              className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current medications
            </label>
            <textarea
              rows="2"
              value={profile.medications}
              onChange={(e) => handleChange("medications", e.target.value)}
              placeholder="Example: paracetamol, inhaler"
              className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emergency contact
            </label>
            <input
              type="text"
              value={profile.emergencyContact}
              onChange={(e) => handleChange("emergencyContact", e.target.value)}
              placeholder="Name / phone"
              className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred language
            </label>
            <select
              value={profile.preferredLanguage}
              onChange={(e) => handleChange("preferredLanguage", e.target.value)}
              className="w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="mr">Marathi</option>
            </select>
          </div>

          {status && (
            <div className="text-sm rounded-xl px-4 py-3 bg-gray-50 border text-gray-700">
              {status}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className={`w-full py-3 rounded-xl text-white font-semibold transition ${
              saving
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      )}
    </div>
  );
}