import { useState } from "react";
import { X } from "lucide-react";
import { OnboardingLayout } from "./OnboardingLayout";
import { api } from "../../lib/api";
import { Button, TextField } from "../../components/ui/primitives";

export function StepPhotos() {
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const [saving, setSaving] = useState(false);

  async function addPhoto() {
    if (!photoUrl.trim()) return;
    const res = await api.post<{ id: string }>("/api/profiles/me/photos", { url: photoUrl.trim(), isPrimary: photos.length === 0 });
    setPhotos((p) => [...p, { id: res.id, url: photoUrl.trim() }]);
    setPhotoUrl("");
  }

  async function removePhoto(id: string) {
    await api.delete(`/api/profiles/me/photos/${id}`);
    setPhotos((p) => p.filter((ph) => ph.id !== id));
  }

  async function save() {
    setSaving(true);
    try {
      await api.patch("/api/profiles/me", { bio });
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingLayout step="photos" title="Add your photos" subtitle="Show people who you are — add at least one photo." onNext={save} saving={saving}>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {photos.map((p) => (
          <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-pulse-100">
            <img src={p.url} alt="" className="w-full h-full object-cover" />
            <button onClick={() => removePhoto(p.id)} className="absolute top-1 right-1 bg-midnight/60 text-white rounded-full p-1" aria-label="Remove photo">
              <X size={12} />
            </button>
          </div>
        ))}
        {photos.length < 9 && (
          <div className="aspect-square rounded-xl border-2 border-dashed border-pulse-200 flex items-center justify-center text-pulse-300 text-xs">
            Empty
          </div>
        )}
      </div>
      <div className="flex gap-2 mb-6 items-end">
        <TextField label="" placeholder="Paste an image URL" className="flex-1" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
        <Button type="button" variant="secondary" onClick={addPhoto}>
          Add
        </Button>
      </div>
      <label className="block text-sm font-semibold text-pulse-800 dark:text-pulse-100 mb-1.5">A little about you</label>
      <textarea
        className="w-full rounded-xl border border-pulse-100 dark:border-pulse-700 bg-white dark:bg-pulse-900 px-4 py-2.5 text-sm"
        rows={4}
        maxLength={500}
        placeholder="Study abroad enthusiast, amateur DJ, always down for late-night ramen…"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
      />
    </OnboardingLayout>
  );
}
