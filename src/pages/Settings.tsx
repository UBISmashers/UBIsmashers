// src/pages/Settings.tsx
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, Clock } from "lucide-react";

export default function Settings() {
  return (
    <MainLayout>
      <div className="flex items-center justify-center min-h-[70vh] animate-fade-in">
        <Card className="max-w-md w-full text-center shadow-lg">
          <CardContent className="p-8 space-y-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-muted">
                <SettingsIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>

            <h1 className="text-3xl font-display font-bold">
              Settings
            </h1>

            <Badge variant="secondary" className="text-sm">
              Coming Soon
            </Badge>

            <p className="text-muted-foreground">
              We’re working on bringing powerful customization and preferences
              to your account. This section will be available soon.
            </p>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Stay tuned for updates
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
