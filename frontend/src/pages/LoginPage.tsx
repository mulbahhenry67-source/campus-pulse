import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, isApiError } from "../context/AuthContext";
import { Button, TextField } from "../components/ui/primitives";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/discover");
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-paper dark:bg-midnight">
      <div className="w-full max-w-sm">
        <Link to="/" className="font-display text-2xl font-semibold text-pulse-600 block text-center mb-8">
          Campus Pulse
        </Link>
        <form onSubmit={handleSubmit} className="bg-white dark:bg-pulse-900 rounded-xl2 shadow-card p-6 flex flex-col gap-4">
          <h1 className="font-display text-xl font-semibold text-center mb-1">Welcome back</h1>
          <TextField label="Email" type="email" name="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" name="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-ember-700">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <Link to="/forgot-password" className="text-xs text-center text-pulse-400 hover:text-pulse-600">
            Forgot your password?
          </Link>
        </form>
        <p className="text-center text-sm text-pulse-400 mt-6">
          New here?{" "}
          <Link to="/register" className="text-ember-500 font-semibold">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
