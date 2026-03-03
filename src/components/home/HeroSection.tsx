import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardList, ShieldCheck, Users, Wallet, Trophy, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function HeroSection() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const glassButtonClass =
    "inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/25 bg-[#0F3D2E] px-5 py-3 text-sm font-semibold text-[#FFFFFF] shadow-lg transition-all duration-300 hover:scale-[1.03] hover:bg-[#14532D] hover:shadow-[0_0_30px_rgba(20,83,45,0.35)]";

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await login(email, password);
      toast.success("Login successful");
      setIsLoginOpen(false);
      setEmail("");
      setPassword("");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error("Login failed", {
        description: error.message || "Invalid email or password",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      className="relative min-h-screen bg-cover bg-center bg-no-repeat px-4 sm:px-6 lg:px-8"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <div className="absolute inset-0 bg-black/15" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center pb-10 pt-8 text-center text-white sm:pb-12 sm:pt-10">
        <div className="mt-2 sm:mt-0">
          <div className="mb-6 flex justify-center">
            <div className="rounded-2xl border border-white/35 bg-white/10 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <img
                src="/icon.jpeg"
                alt="UBI Smashers team symbol"
                className="h-20 w-20 rounded-xl object-cover sm:h-24 sm:w-24"
              />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">UBI Smashers</h1>
          <p className="mt-3 text-sm font-semibold tracking-[0.16em] text-emerald-100 sm:text-base lg:text-lg">
            SMASH HARD | PLAY FAIR | STAY UNITED
          </p>
        </div>

        <div className="mt-10 w-full max-w-3xl sm:mt-12">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
              <DialogTrigger asChild>
                <button type="button" className={glassButtonClass}>
                  <ShieldCheck className="h-4 w-4" />
                  Admin Login
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Admin Login</DialogTitle>
                  <DialogDescription>Sign in to manage UBI Smashers.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-2 text-left">
                    <Label htmlFor="admin-email">Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="admin-password">Password</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Link to="/member-bills" className={glassButtonClass}>
              <Wallet className="h-4 w-4" />
              View Member Bills
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:mt-4 sm:grid-cols-2 sm:gap-4">
            <a href="#rules" className={glassButtonClass}>
              <ClipboardList className="h-4 w-4" />
              Club Rules
            </a>
            <a href="#team" className={glassButtonClass}>
              <Users className="h-4 w-4" />
              Meet the Team
            </a>
          </div>

          <div className="mt-3 sm:mt-4">
            <Link to="/signup" className={glassButtonClass}>
              <Trophy className="h-4 w-4" />
              Join UBI Smashers
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
