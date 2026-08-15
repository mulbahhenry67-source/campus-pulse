import { useEffect, useState } from "react";
import { OnboardingLayout } from "./OnboardingLayout";
import { api } from "../../lib/api";
import { ACADEMIC_YEARS } from "../../lib/types";

interface Option {
  id: string;
  name: string;
}

export function StepSchool() {
  const [schools, setSchools] = useState<Option[]>([]);
  const [majors, setMajors] = useState<Option[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [majorId, setMajorId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ items: Option[] }>("/api/profiles/schools").then((r) => setSchools(r.items));
    api.get<{ items: Option[] }>("/api/profiles/majors").then((r) => setMajors(r.items));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.patch("/api/profiles/me", {
        schoolId: schoolId || null,
        majorId: majorId || null,
        academicYear: academicYear || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingLayout step="school" title="Your school" subtitle="Help us connect you with people on your campus." onNext={save} saving={saving}>
      <div className="flex flex-col gap-4">
        <Select label="School" value={schoolId} onChange={setSchoolId} options={schools} placeholder="Search for your school" />
        <Select label="Major" value={majorId} onChange={setMajorId} options={majors} placeholder="Select your major" />
        <div>
          <label className="block text-sm font-semibold text-pulse-800 dark:text-pulse-100 mb-1.5">Academic year</label>
          <div className="grid grid-cols-3 gap-2">
            {ACADEMIC_YEARS.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setAcademicYear(y)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold capitalize border ${
                  academicYear === y ? "bg-pulse-500 text-white border-pulse-500" : "border-pulse-100 dark:border-pulse-700 text-pulse-700 dark:text-pulse-200"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>
    </OnboardingLayout>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-pulse-800 dark:text-pulse-100 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-pulse-100 dark:border-pulse-700 bg-white dark:bg-pulse-900 px-4 py-2.5 text-sm"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
