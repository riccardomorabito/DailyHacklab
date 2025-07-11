import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AlertTriangle, Home } from "lucide-react";
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "404 - Page Not Found | Daily Hacklab",
};

/**
 * NotFoundPage component - Custom 404 error page with a card-based layout.
 * This page is displayed when a user navigates to a non-existent route.
 * It provides a user-friendly error message and a clear call-to-action to return to the homepage.
 * @returns {JSX.Element} The rendered 404 page.
 */
export default function NotFoundPage() {
  return (
    <div className="container mx-auto flex items-center justify-center min-h-[calc(100vh-200px)] py-12">
      <Card className="w-full max-w-md text-center shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-destructive/10 via-background to-background p-6">
          <div className="mx-auto bg-destructive/10 rounded-full p-3 w-fit mb-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-3xl font-bold">Page Not Found</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <CardDescription className="text-base text-muted-foreground mb-6">
            Oops! The page you were looking for couldn't be found.
          </CardDescription>
          <Button asChild size="lg">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go Back Home
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
