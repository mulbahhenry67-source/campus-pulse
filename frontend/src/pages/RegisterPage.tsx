import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, isApiError } from "../context/AuthContext";
import { Button, TextField } from "../components/ui/primitives";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", dateOfBirth: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
      navigate("/onboarding/photos");
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-paper dark:bg-midnight">
      <div className="w-full max-w-sm">
        <Link to="/" className="font-display text-2xl font-semibold text-pulse-600 block text-center mb-8">
          Campus Pulse
        </Link>
        <form onSubmit={handleSubmit} className="bg-white dark:bg-pulse-900 rounded-xl2 shadow-card p-6 flex flex-col gap-4">
          <h1 className="font-display text-xl font-semibold text-center mb-1">Create your account</h1>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="First name" name="firstName" required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
            <TextField label="Last name" name="lastName" required value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
          </div>
          <TextField label="Email" type="email" name="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
          <TextField
            label="Date of birth"
            type="date"
            name="dateOfBirth"
            required
            value={form.dateOfBirth}
            onChange={(e) => update("dateOfBirth", e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            name="password"
            required
            minLength={10}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
          />
          <p className="text-[11px] text-pulse-400 -mt-2">At least 10 characters, with an uppercase letter, a lowercase letter, and a number.</p>
          {error && <p className="text-sm text-ember-700">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-[11px] text-center text-pulse-300">
            By continuing you confirm you meet Campus Pulse's minimum age requirement.
          </p>
        </form>
        <p className="text-center text-sm text-pulse-400 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-ember-500 font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
