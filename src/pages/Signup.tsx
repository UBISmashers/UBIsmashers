import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type AvailabilityOption = "weekly_twice" | "only_weekends" | "weekdays_only" | "flexible";

const availabilityLabels: Record<AvailabilityOption, string> = {
  weekly_twice: "Weekly Twice",
  only_weekends: "Only Weekends",
  weekdays_only: "Weekdays Only",
  flexible: "Flexible",
};

const joiningRules = [
  "The weekly players list or voting poll (usually created on Sunday) is the reference for court booking. If your name is on the list and you withdraw at the last moment, it is still counted as played and you must share the session cost.",
  "If you want to withdraw from the players list, it is your responsibility to find a replacement. Otherwise, it will be considered as played.",
  "Maintain sportsmanship and respect.",
  "One-time advance fee: $30.",
  "Confirm attendance before match day.",
  "Expenses are shared equally among players.",
  "At the end of every month, expenses must be paid.",
];

export default function Signup() {
  const { api } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    mobileNumber: "",
    address: "",
    availability: "weekly_twice" as AvailabilityOption,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.mobileNumber.trim() || !formData.address.trim()) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.submitJoiningRequest({
        name: formData.name.trim(),
        mobileNumber: formData.mobileNumber.trim(),
        address: formData.address.trim(),
        availability: formData.availability,
      });

      toast.success("Joining request submitted", {
        description: "Admin will review your request soon.",
      });

      setFormData({
        name: "",
        mobileNumber: "",
        address: "",
        availability: "weekly_twice",
      });
    } catch (error: any) {
      toast.error("Failed to submit joining request", {
        description: error.message || "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/20 p-4">
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Join UBISmashers</CardTitle>
          <CardDescription className="text-center">
            Submit your details. Admin will review and contact you.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">Important Rules to Join</p>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-amber-900">
                {joiningRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ol>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter your name"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobileNumber">Mobile Number</Label>
              <Input
                id="mobileNumber"
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                placeholder="Enter mobile number"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter your address"
                rows={3}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="availability">Availability</Label>
              <Select
                value={formData.availability}
                onValueChange={(value) =>
                  setFormData({ ...formData, availability: value as AvailabilityOption })
                }
                disabled={isSubmitting}
              >
                <SelectTrigger id="availability">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(availabilityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
            <Link to="/admin-login" className="text-sm text-primary hover:underline">
              Admin Login
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
