import { useEffect, useState } from "react";
import { LogOut, ShieldCheck, BadgeCheck } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Profile, Interest, Photo } from "../lib/types";
import { Avatar, Badge, Button, TextField } from "../components/ui/primitives";

interface VerificationStatus {
  id: string;
  method: string;
  status: "pending" | "approved" | "rejected";
  reviewer_notes: string | null;
}

export function ProfilePage() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [verification, setVerification] = useState<VerificationStatus | null>(null);
  const [schoolEmail, setSchoolEmail] = useState("");
  const [submittingVerification, setSubmittingVerification] = useState(false);

  useEffect(() => {
    api.get<{ request: VerificationStatus | null }>("/api/verification/me").then((res) => setVerification(res.request));
  }, []);

  useEffect(() => {
    api.get<{ profile: Profile; interests: Interest[]; photos: Photo[] }>("/api/profiles/me").then((res) => {
      setProfile(res.profile);
      setInterests(res.interests);
      setPhotos(res.photos);
      setBio(res.profile.bio ?? "");
    });
  }, []);

  async function saveBio() {
    setSaving(true);
    setSaved(false);
    try {
      await api.patch("/api/profiles/me", { bio });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <div className="p-8 text-pulse-400">Loading profile…</div>;

  async function submitVerification() {
    if (!schoolEmail.trim()) return;
    setSubmittingVerification(true);
    try {
      const res = await api.post<{ request: VerificationStatus }>("/api/verification/request", {
        method: "school_email",
        schoolEmail: schoolEmail.trim(),
      });
      setVerification(res.request);
    } finally {
      setSubmittingVerification(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 md:pt-10 pb-24">
      <div className="flex items-center gap-4 mb-6">
        <Avatar url={photos[0]?.url ?? null} name={profile.first_name} size={72} />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-semibold">{profile.first_name}</h1>
            {profile.verified && (
              <Badge tone="meadow">
                <ShieldCheck size={12} /> Verified
              </Badge>
            )}
          </div>
          <p className="text-sm text-pulse-400 capitalize">{profile.relationship_goal?.replace("_", " ") ?? "No goal set"}</p>
        </div>
      </div>

      {interests.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {interests.map((i) => (
            <Badge key={i.id}>{i.name}</Badge>
          ))}
        </div>
      )}

      <div className="mb-6">
        <TextField
          label="Bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="mb-2"
          maxLength={500}
        />
        <div className="flex items-center gap-3">
          <Button onClick={saveBio} disabled={saving}>
            {saving ? "Saving…" : "Save bio"}
          </Button>
          {saved && <span className="text-xs text-meadow-700">Saved</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <Stat label="Max distance" value={`${profile.max_distance_km} km`} />
        <Stat label="Age range" value={`${profile.min_age_preference}–${profile.max_age_preference}`} />
      </div>

      {!profile.verified && (
        <div className="mb-8 bg-white dark:bg-pulse-900 rounded-xl2 shadow-card p-5">
          <p className="flex items-center gap-2 font-semibold text-sm mb-2">
            <BadgeCheck size={16} className="text-pulse-500" /> Get verified
          </p>
          {!verification && (
            <>
              <p className="text-xs text-pulse-400 mb-3">
                Verify with your school email to earn the Verified badge and build trust with matches.
              </p>
              <div className="flex gap-2">
                <TextField
                  label=""
                  type="email"
                  placeholder="you@university.edu"
                  value={schoolEmail}
                  onChange={(e) => setSchoolEmail(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={submitVerification} disabled={submittingVerification || !schoolEmail.trim()} className="!py-2 !px-4 text-xs self-end">
                  Submit
                </Button>
              </div>
            </>
          )}
          {verification?.status === "pending" && (
            <p className="text-xs text-sunbeam-700">Your verification request is under review.</p>
          )}
          {verification?.status === "rejected" && (
            <div>
              <p className="text-xs text-ember-700 mb-1">Your last request wasn't approved{verification.reviewer_notes ? `: ${verification.reviewer_notes}` : "."}</p>
              <div className="flex gap-2 mt-2">
                <TextField
                  label=""
                  type="email"
                  placeholder="you@university.edu"
                  value={schoolEmail}
                  onChange={(e) => setSchoolEmail(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={submitVerification} disabled={submittingVerification || !schoolEmail.trim()} className="!py-2 !px-4 text-xs self-end">
                  Try again
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Button variant="danger" onClick={logout} className="w-full">
        <LogOut size={16} /> Log out
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-pulse-900 rounded-xl2 p-4 shadow-card">
      <p className="text-xs text-pulse-400 mb-1">{label}</p>
      <p className="font-mono font-bold">{value}</p>
    </div>
  );
}
